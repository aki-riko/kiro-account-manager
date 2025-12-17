// 硬件指纹命令

use sha2::{Sha256, Digest};
use std::sync::OnceLock;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// 缓存硬件指纹（硬件信息不会变，只需获取一次）
static FINGERPRINT_CACHE: OnceLock<String> = OnceLock::new();
static FULL_FINGERPRINT_CACHE: OnceLock<String> = OnceLock::new();

/// 获取硬件指纹（带缓存）
#[tauri::command]
pub fn get_hardware_fingerprint() -> Result<String, String> {
    if let Some(cached) = FINGERPRINT_CACHE.get() {
        return Ok(cached.clone());
    }
    
    let raw = get_raw_hardware_info()?;
    let fingerprint = hash_fingerprint(&raw);
    let _ = FINGERPRINT_CACHE.set(fingerprint.clone());
    Ok(fingerprint)
}

/// 获取原始硬件信息
#[cfg(target_os = "windows")]
fn get_raw_hardware_info() -> Result<String, String> {
    // 使用 SMBIOS UUID（硬件级别唯一标识，来自主板 BIOS）
    if let Ok(output) = Command::new("powershell")
        .args(["-NoProfile", "-Command", "(Get-CimInstance Win32_ComputerSystemProduct).UUID"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        let uuid = String::from_utf8_lossy(&output.stdout).trim().to_string();
        // 排除无效值（全0或全F表示未设置）
        if !uuid.is_empty() 
            && uuid != "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF"
            && uuid != "00000000-0000-0000-0000-000000000000" 
        {
            return Ok(uuid);
        }
    }
    
    Err("无法获取硬件信息".to_string())
}

#[cfg(target_os = "macos")]
fn get_raw_hardware_info() -> Result<String, String> {
    // 使用 IOPlatformUUID（稳定且唯一）
    if let Ok(output) = Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
    {
        let s = String::from_utf8_lossy(&output.stdout);
        for line in s.lines() {
            if line.contains("IOPlatformUUID") {
                if let Some(uuid) = line.split('"').nth(3) {
                    return Ok(uuid.to_string());
                }
            }
        }
    }
    
    Err("无法获取硬件信息".to_string())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn get_raw_hardware_info() -> Result<String, String> {
    Err("不支持的操作系统".to_string())
}

/// 哈希并截取前 8 位作为指纹（用于水印显示）
fn hash_fingerprint(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..4]).to_uppercase()
}

/// 获取完整硬件指纹（64位十六进制，带缓存）
#[tauri::command]
pub fn get_full_hardware_fingerprint() -> Result<String, String> {
    if let Some(cached) = FULL_FINGERPRINT_CACHE.get() {
        return Ok(cached.clone());
    }
    
    let raw = get_raw_hardware_info()?;
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let result = hasher.finalize();
    let fingerprint = hex::encode(result).to_uppercase();
    let _ = FULL_FINGERPRINT_CACHE.set(fingerprint.clone());
    Ok(fingerprint)
}
