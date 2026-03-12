// Powers 管理命令

use crate::powers::{PowerInfo, PowersManager, RecommendedPower, RegistryInfo};
use tauri::command;

#[command]
pub async fn install_power(name: String, clone_url: String, path_in_repo: String, branch: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || PowersManager::install(&name, &clone_url, &path_in_repo, &branch))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_powers() -> Result<Vec<PowerInfo>, String> {
    tokio::task::spawn_blocking(PowersManager::load_all)
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_power(name: String) -> Result<PowerInfo, String> {
    tokio::task::spawn_blocking(move || PowersManager::load(&name))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn uninstall_power(name: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || PowersManager::uninstall(&name))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_power_registries() -> Result<Vec<RegistryInfo>, String> {
    tokio::task::spawn_blocking(PowersManager::list_registries)
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_recommended_powers() -> Result<Vec<RecommendedPower>, String> {
    PowersManager::fetch_recommended().await
}
