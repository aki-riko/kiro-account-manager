// Hooks 管理命令

use crate::hooks::{HookFile, HooksManager};
use tauri::command;

#[command]
pub async fn get_hooks(project_dir: Option<String>) -> Result<Vec<HookFile>, String> {
    tokio::task::spawn_blocking(move || HooksManager::load_all(project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_hook(file_name: String, project_dir: Option<String>) -> Result<HookFile, String> {
    tokio::task::spawn_blocking(move || HooksManager::load(&file_name, project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn save_hook(file_name: String, content: String, project_dir: Option<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || HooksManager::save(&file_name, &content, project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn delete_hook(file_name: String, project_dir: Option<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || HooksManager::delete(&file_name, project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn create_hook(file_name: String, content: String, project_dir: Option<String>) -> Result<HookFile, String> {
    tokio::task::spawn_blocking(move || HooksManager::create(&file_name, &content, project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}
