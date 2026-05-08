use tauri::{AppHandle, Manager};

/// 获取应用数据目录路径
#[tauri::command]
pub fn get_app_data_dir(app: AppHandle) -> Result<String, String> {
    // 使用固定的目录名 .kiro-account-manager
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Failed to get home directory".to_string())?;
    
    let app_data_dir = home_dir.join(".kiro-account-manager");
    
    Ok(app_data_dir.to_string_lossy().to_string())
}

/// 使用系统文件管理器打开应用数据目录
#[tauri::command]
pub fn open_app_data_dir(app: AppHandle) -> Result<(), String> {
    // 使用固定的目录名 .kiro-account-manager
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Failed to get home directory".to_string())?;
    
    let app_data_dir = home_dir.join(".kiro-account-manager");
    
    // 确保目录存在
    if !app_data_dir.exists() {
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    }
    
    // 使用系统默认文件管理器打开目录
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(app_data_dir)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(app_data_dir)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(app_data_dir)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    
    Ok(())
}
