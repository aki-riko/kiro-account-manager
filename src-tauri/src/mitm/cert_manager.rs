#![allow(dead_code)]
//! CA 证书管理模块
//!
//! 负责：
//! 1. 生成自签名 CA 根证书（首次启动时）
//! 2. 为目标域名动态签发证书
//! 3. 证书存储与加载
//! 4. 三端自动安装 CA 到系统信任存储

use rcgen::{
    BasicConstraints, CertificateParams, DistinguishedName,
    DnType, IsCa, KeyPair, KeyUsagePurpose, SanType,
};
use std::fs;
use std::path::PathBuf;

const CA_CERT_FILE: &str = "ca.crt";
const CA_KEY_FILE: &str = "ca.key";
const CA_COMMON_NAME: &str = "Kiro Account Manager CA";
const CA_ORG: &str = "Kiro Account Manager";
#[allow(dead_code)]
const CA_VALIDITY_DAYS: u32 = 3650; // 10 年

/// 默认证书存储目录
pub fn default_certs_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| {
            let home = std::env::var("USERPROFILE")
                .or_else(|_| std::env::var("HOME"))
                .unwrap_or_else(|_| ".".to_string());
            PathBuf::from(home)
        })
        .join(".kiro-account-manager")
        .join("certs")
}

/// 证书管理器
pub struct CertManager {
    /// CA 证书 PEM
    ca_cert_pem: String,
    /// CA 私钥 PEM
    ca_key_pem: String,
    /// 证书存储目录
    certs_dir: PathBuf,
}

impl CertManager {
    /// 初始化证书管理器
    /// 如果 CA 证书不存在则自动生成
    pub fn new(certs_dir: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&certs_dir)
            .map_err(|e| format!("创建证书目录失败: {e}"))?;

        let cert_path = certs_dir.join(CA_CERT_FILE);
        let key_path = certs_dir.join(CA_KEY_FILE);

        let (ca_cert_pem, ca_key_pem) = if cert_path.exists() && key_path.exists() {
            let cert = fs::read_to_string(&cert_path)
                .map_err(|e| format!("读取 CA 证书失败: {e}"))?;
            let key = fs::read_to_string(&key_path)
                .map_err(|e| format!("读取 CA 私钥失败: {e}"))?;
            log::info!("[MITM] 已加载 CA 证书: {}", cert_path.display());
            (cert, key)
        } else {
            log::info!("[MITM] CA 证书不存在，正在生成...");
            let (cert, key) = Self::generate_ca()?;
            fs::write(&cert_path, &cert)
                .map_err(|e| format!("写入 CA 证书失败: {e}"))?;
            fs::write(&key_path, &key)
                .map_err(|e| format!("写入 CA 私钥失败: {e}"))?;
            log::info!("[MITM] CA 证书已生成: {}", cert_path.display());
            (cert, key)
        };

        Ok(Self {
            ca_cert_pem,
            ca_key_pem,
            certs_dir,
        })
    }

    /// 生成自签名 CA 根证书
    fn generate_ca() -> Result<(String, String), String> {
        let mut params = CertificateParams::default();

        let mut dn = DistinguishedName::new();
        dn.push(DnType::CommonName, CA_COMMON_NAME);
        dn.push(DnType::OrganizationName, CA_ORG);
        params.distinguished_name = dn;

        params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
        params.key_usages = vec![
            KeyUsagePurpose::KeyCertSign,
            KeyUsagePurpose::CrlSign,
        ];

        // 有效期 10 年
        params.not_before = rcgen::date_time_ymd(2024, 1, 1);
        params.not_after = rcgen::date_time_ymd(2034, 12, 31);

        let key_pair = KeyPair::generate()
            .map_err(|e| format!("生成 CA 密钥对失败: {e}"))?;
        let cert = params.self_signed(&key_pair)
            .map_err(|e| format!("生成 CA 证书失败: {e}"))?;

        let cert_pem = cert.pem();
        let key_pem = key_pair.serialize_pem();

        Ok((cert_pem, key_pem))
    }

    /// 为指定域名生成证书（由 CA 签发）
    pub fn generate_cert_for_host(&self, hostname: &str) -> Result<(String, String), String> {
        // 重建 CA 用于签发
        let ca_key = KeyPair::from_pem(&self.ca_key_pem)
            .map_err(|e| format!("解析 CA 私钥失败: {e}"))?;

        let mut ca_params = CertificateParams::default();
        let mut ca_dn = DistinguishedName::new();
        ca_dn.push(DnType::CommonName, CA_COMMON_NAME);
        ca_dn.push(DnType::OrganizationName, CA_ORG);
        ca_params.distinguished_name = ca_dn;
        ca_params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
        ca_params.key_usages = vec![
            KeyUsagePurpose::KeyCertSign,
            KeyUsagePurpose::CrlSign,
        ];
        ca_params.not_before = rcgen::date_time_ymd(2024, 1, 1);
        ca_params.not_after = rcgen::date_time_ymd(2034, 12, 31);
        let ca_cert = ca_params.self_signed(&ca_key)
            .map_err(|e| format!("重建 CA 证书失败: {e}"))?;

        // 生成域名证书
        let mut params = CertificateParams::default();
        let mut dn = DistinguishedName::new();
        dn.push(DnType::CommonName, hostname);
        params.distinguished_name = dn;
        params.subject_alt_names = vec![SanType::DnsName(hostname.try_into().map_err(|e| format!("无效域名: {e}"))?)];
        params.not_before = rcgen::date_time_ymd(2024, 1, 1);
        params.not_after = rcgen::date_time_ymd(2026, 12, 31);

        let host_key = KeyPair::generate()
            .map_err(|e| format!("生成域名密钥对失败: {e}"))?;
        let host_cert = params.signed_by(&host_key, &ca_cert, &ca_key)
            .map_err(|e| format!("签发域名证书失败: {e}"))?;

        Ok((host_cert.pem(), host_key.serialize_pem()))
    }

    /// 获取 CA 证书 PEM（用于导出/安装）
    pub fn ca_cert_pem(&self) -> &str {
        &self.ca_cert_pem
    }

    /// 获取 CA 证书文件路径
    pub fn ca_cert_path(&self) -> PathBuf {
        self.certs_dir.join(CA_CERT_FILE)
    }

    /// 安装 CA 到系统信任存储
    #[cfg(target_os = "windows")]
    pub fn install_ca_to_system(&self) -> Result<(), String> {
        let cert_path = self.ca_cert_path();
        // 使用 runas 提权执行 certutil
        let output = std::process::Command::new("powershell")
            .args([
                "-Command",
                &format!(
                    "Start-Process certutil -ArgumentList '-addstore','-f','ROOT','\"{}\"' -Verb RunAs -Wait",
                    cert_path.to_string_lossy()
                ),
            ])
            .output()
            .map_err(|e| format!("执行提权安装失败: {e}"))?;

        if output.status.success() {
            log::info!("[MITM] CA 证书已安装到 Windows 信任存储");
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("安装 CA 失败: {stderr}"))
        }
    }

    #[cfg(target_os = "macos")]
    pub fn install_ca_to_system(&self) -> Result<(), String> {
        let cert_path = self.ca_cert_path();
        let output = std::process::Command::new("security")
            .args([
                "add-trusted-cert", "-d", "-r", "trustRoot",
                "-k", "/Library/Keychains/System.keychain",
                &cert_path.to_string_lossy(),
            ])
            .output()
            .map_err(|e| format!("执行 security 失败: {e}"))?;

        if output.status.success() {
            log::info!("[MITM] CA 证书已安装到 macOS 信任存储");
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("安装 CA 失败（需要 sudo）: {stderr}"))
        }
    }

    #[cfg(target_os = "linux")]
    pub fn install_ca_to_system(&self) -> Result<(), String> {
        let cert_path = self.ca_cert_path();

        // 尝试 Ubuntu/Debian 方式
        let dest = PathBuf::from("/usr/local/share/ca-certificates/kiro-account-manager-ca.crt");
        if let Ok(_) = fs::copy(&cert_path, &dest) {
            let output = std::process::Command::new("update-ca-certificates")
                .output();
            if let Ok(out) = output {
                if out.status.success() {
                    log::info!("[MITM] CA 证书已安装到 Linux 信任存储 (Debian)");
                    return Ok(());
                }
            }
        }

        // 尝试 RHEL/Fedora 方式
        let dest = PathBuf::from("/etc/pki/ca-trust/source/anchors/kiro-account-manager-ca.crt");
        if let Ok(_) = fs::copy(&cert_path, &dest) {
            let output = std::process::Command::new("update-ca-trust")
                .output();
            if let Ok(out) = output {
                if out.status.success() {
                    log::info!("[MITM] CA 证书已安装到 Linux 信任存储 (RHEL)");
                    return Ok(());
                }
            }
        }

        Err("安装 CA 失败（需要 root 权限，请手动安装）".to_string())
    }

    /// 检查 CA 是否已安装到系统
    pub fn is_ca_installed(&self) -> bool {
        Self::check_ca_installed_in_system(&self.certs_dir)
    }

    /// 静态方法：检查 CA 是否已安装到系统信任存储
    #[cfg(target_os = "windows")]
    pub fn check_ca_installed_in_system(certs_dir: &std::path::Path) -> bool {
        // 用 PowerShell 检查 ROOT 存储中是否有我们的 CA
        let output = std::process::Command::new("powershell")
            .args([
                "-NoProfile", "-Command",
                &format!(
                    "Get-ChildItem Cert:\\LocalMachine\\Root | Where-Object {{ $_.Subject -like '*{}*' }} | Select-Object -First 1",
                    CA_COMMON_NAME
                ),
            ])
            .output();
        match output {
            Ok(o) => !o.stdout.is_empty() && o.status.success(),
            Err(_) => false,
        }
    }

    #[cfg(target_os = "macos")]
    pub fn check_ca_installed_in_system(certs_dir: &std::path::Path) -> bool {
        let cert_path = certs_dir.join(CA_CERT_FILE);
        if !cert_path.exists() { return false; }
        let output = std::process::Command::new("security")
            .args(["find-certificate", "-c", CA_COMMON_NAME, "/Library/Keychains/System.keychain"])
            .output();
        matches!(output, Ok(o) if o.status.success())
    }

    #[cfg(target_os = "linux")]
    pub fn check_ca_installed_in_system(certs_dir: &std::path::Path) -> bool {
        let cert_path = certs_dir.join(CA_CERT_FILE);
        if !cert_path.exists() { return false; }
        // 检查是否在系统 CA 目录中
        std::path::Path::new("/usr/local/share/ca-certificates/kiro-account-manager-ca.crt").exists()
            || std::path::Path::new("/etc/pki/ca-trust/source/anchors/kiro-account-manager-ca.crt").exists()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;

    #[test]
    fn test_generate_ca() {
        let (cert, key) = CertManager::generate_ca().unwrap();
        assert!(cert.contains("BEGIN CERTIFICATE"));
        assert!(key.contains("BEGIN PRIVATE KEY"));
    }

    #[test]
    fn test_cert_manager_new() {
        let dir = temp_dir().join("kiro-test-certs");
        let _ = fs::remove_dir_all(&dir);
        let manager = CertManager::new(dir.clone()).unwrap();
        assert!(manager.ca_cert_path().exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_generate_cert_for_host() {
        let dir = temp_dir().join("kiro-test-certs-host");
        let _ = fs::remove_dir_all(&dir);
        let manager = CertManager::new(dir.clone()).unwrap();
        let (cert, key) = manager.generate_cert_for_host("q.us-east-1.amazonaws.com").unwrap();
        assert!(cert.contains("BEGIN CERTIFICATE"));
        assert!(key.contains("BEGIN PRIVATE KEY"));
        let _ = fs::remove_dir_all(&dir);
    }
}
