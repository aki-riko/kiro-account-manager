// Steering 管理命令

use crate::steering::{SteeringFile, SteeringManager};
use tauri::command;

#[command]
pub async fn get_steering_files(project_dir: Option<String>) -> Result<Vec<SteeringFile>, String> {
    tokio::task::spawn_blocking(move || SteeringManager::load_all(project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_steering_file(file_name: String, scope: Option<String>, project_dir: Option<String>) -> Result<SteeringFile, String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    tokio::task::spawn_blocking(move || SteeringManager::load(&file_name, &scope, project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn save_steering_file(file_name: String, content: String, scope: Option<String>, project_dir: Option<String>) -> Result<(), String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    tokio::task::spawn_blocking(move || SteeringManager::save(&file_name, &content, &scope, project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn delete_steering_file(file_name: String, scope: Option<String>, project_dir: Option<String>) -> Result<(), String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    tokio::task::spawn_blocking(move || SteeringManager::delete(&file_name, &scope, project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn create_steering_file(file_name: String, content: String, scope: Option<String>, project_dir: Option<String>) -> Result<SteeringFile, String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    tokio::task::spawn_blocking(move || SteeringManager::create(&file_name, &content, &scope, project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}
