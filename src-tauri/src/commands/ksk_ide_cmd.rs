#![allow(clippy::needless_pass_by_value)]

use std::path::PathBuf;

use chrono::Duration as ChronoDuration;
use serde::Deserialize;
use tauri::State;

use crate::{
    ksk_ide::{
        launcher::PROCESS_STOP_TIMEOUT,
        profile::{recover_stale_settings, KiroUserDataPaths},
        runtime::{KskIdeRuntime, KskIdeStatus},
    },
    state::AppState,
};

const PLACEHOLDER_TTL_HOURS: i64 = 24;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartKskIdeRequest {
    pub ksk: String,
    pub region: String,
}

#[tauri::command]
pub async fn start_ksk_ide(
    state: State<'_, AppState>,
    request: StartKskIdeRequest,
) -> Result<KskIdeStatus, String> {
    let mut slot = state.ksk_ide.lock().await;
    if slot.is_some() {
        return Err("已有 KSK 隔离 Kiro 实例正在运行".to_string());
    }
    recover_ksk_ide_settings()?;
    let isolation_root = isolated_ide_root()?;
    let mut runtime = KskIdeRuntime::start(
        &isolation_root,
        &request.region,
        &request.ksk,
        ChronoDuration::hours(PLACEHOLDER_TTL_HOURS),
    )
    .await?;
    let status = runtime.status()?;
    log::info!(
        "[KskIde] 隔离实例已启动，region={}, session={}, pid={}",
        status.region.as_deref().unwrap_or("unknown"),
        status.session_id.as_deref().unwrap_or("unknown"),
        status.pid.unwrap_or_default()
    );
    *slot = Some(runtime);
    Ok(status)
}

#[tauri::command]
pub async fn stop_ksk_ide(state: State<'_, AppState>) -> Result<KskIdeStatus, String> {
    if shutdown_ksk_ide_runtime(&state.ksk_ide).await? {
        log::info!("[KskIde] 隔离实例已停止并完成清理");
    }
    Ok(KskIdeStatus::idle())
}

#[tauri::command]
pub async fn get_ksk_ide_status(state: State<'_, AppState>) -> Result<KskIdeStatus, String> {
    let mut slot = state.ksk_ide.lock().await;
    match slot.as_mut() {
        Some(runtime) => runtime.status(),
        None => Ok(KskIdeStatus::idle()),
    }
}

#[tauri::command]
pub fn get_ksk_ide_regions() -> Vec<String> {
    crate::clients::http_client::supported_kiro_regions()
}

pub(crate) fn isolated_ide_root() -> Result<PathBuf, String> {
    dirs::data_local_dir()
        .ok_or_else(|| "无法获取应用本地数据目录".to_string())
        .map(|path| path.join(".kiro-account-manager").join("isolated-ide"))
}

pub(crate) fn recover_ksk_ide_settings() -> Result<usize, String> {
    let isolation_root = isolated_ide_root()?;
    let settings_path = KiroUserDataPaths::default_settings_path()?;
    recover_stale_settings(&isolation_root, &settings_path)
}

pub(crate) async fn shutdown_ksk_ide_runtime(
    slot: &tokio::sync::Mutex<Option<KskIdeRuntime>>,
) -> Result<bool, String> {
    let mut runtime_slot = slot.lock().await;
    let Some(runtime) = runtime_slot.as_mut() else {
        return Ok(false);
    };
    runtime.stop(PROCESS_STOP_TIMEOUT).await?;
    *runtime_slot = None;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use tokio::sync::Mutex;

    use super::shutdown_ksk_ide_runtime;

    #[tokio::test]
    async fn shutdown_empty_runtime_slot_is_idempotent() {
        let slot = Mutex::new(None);

        assert!(!shutdown_ksk_ide_runtime(&slot)
            .await
            .expect("shutdown empty KSK runtime slot"));
        assert!(!shutdown_ksk_ide_runtime(&slot)
            .await
            .expect("repeat shutdown empty KSK runtime slot"));
        assert!(slot.lock().await.is_none());
    }
}
