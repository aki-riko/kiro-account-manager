// 硬件指纹命令

use sha2::{Sha256, Digest};
use std::sync::OnceLock;

#[cfg(target_os = "windows")]
use std::process::Command;

#[cfg(target_os = "macos")]
use std::process::Command;

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
    let mut info = String::new();
    
    // 主板序列号
    if let Ok(output) = Command::new("wmic")
        .args(["baseboard", "get", "serialnumber"])
        .output()
    {
        let s = String::from_utf8_lossy(&output.stdout);
        let serial = s.lines()
            .nth(1)
            .map(|l| l.trim())
            .unwrap_or("");
        info.push_str(serial);
    }
    
    // BIOS 序列号
    if let Ok(output) = Command::new("wmic")
        .args(["bios", "get", "serialnumber"])
        .output()
    {
        let s = String::from_utf8_lossy(&output.stdout);
        let serial = s.lines()
            .nth(1)
            .map(|l| l.trim())
            .unwrap_or("");
        info.push_str(serial);
    }
    
    // 硬盘序列号
    if let Ok(output) = Command::new("wmic")
        .args(["diskdrive", "get", "serialnumber"])
        .output()
    {
        let s = String::from_utf8_lossy(&output.stdout);
        let serial = s.lines()
            .nth(1)
            .map(|l| l.trim())
            .unwrap_or("");
        info.push_str(serial);
    }
    
    if info.is_empty() {
        return Err("无法获取硬件信息".to_string());
    }
    
    Ok(info)
}

#[cfg(target_os = "macos")]
fn get_raw_hardware_info() -> Result<String, String> {
    let mut info = String::new();
    
    // IOPlatformUUID
    if let Ok(output) = Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
    {
        let s = String::from_utf8_lossy(&output.stdout);
        for line in s.lines() {
            if line.contains("IOPlatformUUID") {
                if let Some(uuid) = line.split('"').nth(3) {
                    info.push_str(uuid);
                }
            }
        }
    }
    
    // 主板序列号
    if let Ok(output) = Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
    {
        let s = String::from_utf8_lossy(&output.stdout);
        for line in s.lines() {
            if line.contains("IOPlatformSerialNumber") {
                if let Some(serial) = line.split('"').nth(3) {
                    info.push_str(serial);
                }
            }
        }
    }
    
    if info.is_empty() {
        return Err("无法获取硬件信息".to_string());
    }
    
    Ok(info)
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
