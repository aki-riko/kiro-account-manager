// Custom Agents 管理命令

use crate::custom_agents::{CustomAgentFile, CustomAgentsManager};
use tauri::command;

#[command]
pub async fn get_custom_agents(project_dir: Option<String>) -> Result<Vec<CustomAgentFile>, String> {
    tokio::task::spawn_blocking(move || CustomAgentsManager::load_all(project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_custom_agent(file_name: String, scope: Option<String>, project_dir: Option<String>) -> Result<CustomAgentFile, String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    tokio::task::spawn_blocking(move || CustomAgentsManager::load(&file_name, &scope, project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn save_custom_agent(file_name: String, content: String, scope: Option<String>, project_dir: Option<String>) -> Result<(), String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    tokio::task::spawn_blocking(move || CustomAgentsManager::save(&file_name, &content, &scope, project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn delete_custom_agent(file_name: String, scope: Option<String>, project_dir: Option<String>) -> Result<(), String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    tokio::task::spawn_blocking(move || CustomAgentsManager::delete(&file_name, &scope, project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn create_custom_agent(file_name: String, content: String, scope: Option<String>, project_dir: Option<String>) -> Result<CustomAgentFile, String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    tokio::task::spawn_blocking(move || CustomAgentsManager::create(&file_name, &content, &scope, project_dir.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}
