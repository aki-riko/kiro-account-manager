#![allow(clippy::needless_pass_by_value)]

use std::{path::PathBuf, time::Duration as StdDuration};

use chrono::Duration as ChronoDuration;
use serde::Deserialize;
use tauri::State;

use crate::{
    ksk_ide::runtime::{KskIdeRuntime, KskIdeStatus},
    state::AppState,
};

const PLACEHOLDER_TTL_HOURS: i64 = 24;
const PROCESS_STOP_TIMEOUT_SECONDS: u64 = 5;

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
    let mut slot = state.ksk_ide.lock().await;
    let Some(runtime) = slot.as_mut() else {
        return Ok(KskIdeStatus::idle());
    };
    runtime
        .stop(StdDuration::from_secs(PROCESS_STOP_TIMEOUT_SECONDS))
        .await?;
    *slot = None;
    log::info!("[KskIde] 隔离实例已停止并完成清理");
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

fn isolated_ide_root() -> Result<PathBuf, String> {
    dirs::data_local_dir()
        .ok_or_else(|| "无法获取应用本地数据目录".to_string())
        .map(|path| path.join(".kiro-account-manager").join("isolated-ide"))
}
