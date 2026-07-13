#![allow(clippy::needless_pass_by_value)]

use std::path::PathBuf;

use chrono::{Duration as ChronoDuration, Utc};
use serde::Deserialize;
use tauri::State;

use crate::{
    commands::{
        account_cmd::refresh_token_inner,
        app_settings_cmd::{get_app_settings_inner, AppSettings},
        common::{find_account_by_id, KIRO_SOCIAL_PROFILE_ARN},
    },
    core::account::Account,
    ksk_ide::{
        control_plane::{KskControlPlaneClient, ManagedKskLease},
        launcher::{ensure_isolated_launch_available, PROCESS_STOP_TIMEOUT},
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartKskIdeFromAccountRequest {
    pub account_id: String,
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
    if !crate::clients::http_client::is_supported_kiro_region(request.region.trim()) {
        return Err(format!("KSK 代理不支持区域: {}", request.region.trim()));
    }
    ensure_isolated_launch_available()?;
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
pub async fn start_ksk_ide_from_account(
    state: State<'_, AppState>,
    request: StartKskIdeFromAccountRequest,
) -> Result<KskIdeStatus, String> {
    let mut slot = state.ksk_ide.lock().await;
    if slot.is_some() {
        return Err("已有 KSK 隔离 Kiro 实例正在运行".to_string());
    }
    if !crate::clients::http_client::is_supported_kiro_region(request.region.trim()) {
        return Err(format!("KSK 代理不支持区域: {}", request.region.trim()));
    }
    ensure_isolated_launch_available()?;
    recover_ksk_ide_settings()?;

    let source_account = find_account_by_id(&state, request.account_id.trim())?;
    ensure_account_can_issue_ksk(&source_account)?;
    let account = refresh_token_inner(&state, request.account_id.trim()).await?;
    ensure_account_can_issue_ksk(&account)?;
    let access_token = account
        .access_token
        .as_deref()
        .filter(|token| !token.trim().is_empty())
        .ok_or_else(|| "账号刷新后仍缺少 access_token".to_string())?;
    let profile_arn = issuable_profile_arn(&account)?;
    let (ttl_hours, fallback_control_plane_region) = managed_key_settings()?;
    let control_plane_region = crate::clients::http_client::resolve_kiro_upstream_region(
        Some(&profile_arn),
        account.region.as_deref(),
        &fallback_control_plane_region,
    );
    let expires_at = Utc::now() + ChronoDuration::hours(ttl_hours);
    let label = managed_key_label(&account);
    let control_plane = KskControlPlaneClient::for_account(&account, &control_plane_region)?;
    let issued = control_plane
        .create_api_key(access_token, &profile_arn, &label, expires_at)
        .await?;

    let isolation_root = isolated_ide_root()?;
    let mut runtime = match KskIdeRuntime::start(
        &isolation_root,
        &request.region,
        &issued.raw_key,
        ChronoDuration::hours(ttl_hours),
    )
    .await
    {
        Ok(runtime) => runtime,
        Err(start_error) => {
            let revoke_result = control_plane
                .delete_api_key(access_token, &issued.key_id, &profile_arn)
                .await;
            return match revoke_result {
                Ok(()) => Err(start_error),
                Err(revoke_error) => Err(format!(
                    "{start_error}; 启动失败后的临时 KSK 撤销也失败（prefix={}，到期时间={}）：{revoke_error}",
                    issued.key_prefix,
                    issued.expires_at.to_rfc3339()
                )),
            };
        }
    };
    runtime.attach_managed_lease(ManagedKskLease {
        source_account_id: account.id.clone(),
        source_account_label: account.label.clone(),
        key_id: issued.key_id,
        key_prefix: issued.key_prefix,
        profile_arn,
        expires_at: issued.expires_at,
        control_plane_region,
    });
    let status = runtime.status()?;
    log::info!(
        "[KskIde] 已从账号 {} 签发短期 KSK 并启动隔离实例，prefix={}, expires_at={}",
        account.id,
        status.key_prefix.as_deref().unwrap_or("unknown"),
        status.key_expires_at.as_deref().unwrap_or("unknown")
    );
    *slot = Some(runtime);
    Ok(status)
}

#[tauri::command]
pub async fn stop_ksk_ide(state: State<'_, AppState>) -> Result<KskIdeStatus, String> {
    if shutdown_ksk_ide_runtime(&state).await? {
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

pub(crate) async fn shutdown_ksk_ide_runtime(state: &AppState) -> Result<bool, String> {
    let (stopped, lease) = stop_runtime_slot(&state.ksk_ide).await?;
    if let Some(lease) = lease {
        revoke_managed_lease(state, &lease).await?;
        clear_managed_runtime(&state.ksk_ide, &lease).await?;
        log::info!(
            "[KskIde] 已撤销账号 {} 的临时 KSK（prefix={}）",
            lease.source_account_id,
            lease.key_prefix
        );
    }
    Ok(stopped)
}

async fn stop_runtime_slot(
    slot: &tokio::sync::Mutex<Option<KskIdeRuntime>>,
) -> Result<(bool, Option<ManagedKskLease>), String> {
    let mut runtime_slot = slot.lock().await;
    let Some(runtime) = runtime_slot.as_mut() else {
        return Ok((false, None));
    };
    runtime.stop(PROCESS_STOP_TIMEOUT).await?;
    let lease = runtime.managed_lease();
    if lease.is_none() {
        *runtime_slot = None;
    }
    Ok((true, lease))
}

async fn clear_managed_runtime(
    slot: &tokio::sync::Mutex<Option<KskIdeRuntime>>,
    revoked_lease: &ManagedKskLease,
) -> Result<(), String> {
    let mut runtime_slot = slot.lock().await;
    let Some(runtime) = runtime_slot.as_ref() else {
        return Err("临时 KSK 已撤销，但隔离运行时状态已丢失".to_string());
    };
    let Some(current_lease) = runtime.managed_lease() else {
        return Err("临时 KSK 已撤销，但隔离运行时租约状态已丢失".to_string());
    };
    if current_lease.key_id != revoked_lease.key_id {
        return Err("临时 KSK 已撤销，但隔离运行时租约已发生变化".to_string());
    }
    *runtime_slot = None;
    Ok(())
}

async fn revoke_managed_lease(state: &AppState, lease: &ManagedKskLease) -> Result<(), String> {
    let account = refresh_token_inner(state, &lease.source_account_id).await?;
    let access_token = account
        .access_token
        .as_deref()
        .filter(|token| !token.trim().is_empty())
        .ok_or_else(|| "撤销临时 KSK 时账号缺少 access_token".to_string())?;
    KskControlPlaneClient::for_account(&account, &lease.control_plane_region)?
        .delete_api_key(access_token, &lease.key_id, &lease.profile_arn)
        .await
}

fn managed_key_settings() -> Result<(i64, String), String> {
    let settings = get_app_settings_inner()?;
    let defaults = AppSettings::default();
    let ttl_hours = settings
        .ksk_ide_key_ttl_hours
        .or(defaults.ksk_ide_key_ttl_hours)
        .ok_or_else(|| "缺少 KSK IDE Key 租约时长配置".to_string())?;
    if !(1..=168).contains(&ttl_hours) {
        return Err("KSK IDE Key 租约时长必须在 1 到 168 小时之间".to_string());
    }
    let control_plane_region = settings
        .ksk_ide_control_plane_region
        .or(defaults.ksk_ide_control_plane_region)
        .filter(|region| !region.trim().is_empty())
        .ok_or_else(|| "缺少 KSK IDE 签发服务区域配置".to_string())?;
    Ok((ttl_hours, control_plane_region))
}

fn ensure_account_can_issue_ksk(account: &Account) -> Result<(), String> {
    if account
        .auth_method
        .as_deref()
        .is_some_and(|method| method.eq_ignore_ascii_case("external_idp"))
    {
        return Err("external_idp 账号禁止签发 KSK；请使用已有 KSK 的高级启动入口".to_string());
    }
    if account.refresh_token.as_deref().is_none_or(str::is_empty) {
        return Err("该账号缺少 refresh_token，无法签发 KSK".to_string());
    }
    Ok(())
}

fn issuable_profile_arn(account: &Account) -> Result<String, String> {
    if let Some(profile_arn) = account
        .profile_arn
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Ok(profile_arn.to_string());
    }
    let is_social = account
        .auth_method
        .as_deref()
        .is_some_and(|method| method.eq_ignore_ascii_case("social"))
        || matches!(account.provider.as_deref(), Some("Github" | "Google"));
    if is_social {
        return Ok(KIRO_SOCIAL_PROFILE_ARN.to_string());
    }
    Err("该账号缺少 profileArn，无法签发 KSK；请先刷新或重新导入账号".to_string())
}

fn managed_key_label(account: &Account) -> String {
    let short_id: String = account.id.chars().take(8).collect();
    format!("KAM-IDE-{short_id}-{}", Utc::now().format("%Y%m%d%H%M%S"))
}

#[cfg(test)]
mod tests {
    use tokio::sync::Mutex;

    use super::{ensure_account_can_issue_ksk, issuable_profile_arn, stop_runtime_slot};
    use crate::{commands::common::KIRO_SOCIAL_PROFILE_ARN, core::account::Account};

    #[tokio::test]
    async fn shutdown_empty_runtime_slot_is_idempotent() {
        let slot = Mutex::new(None);

        assert_eq!(
            stop_runtime_slot(&slot)
                .await
                .expect("shutdown empty KSK runtime slot"),
            (false, None)
        );
        assert_eq!(
            stop_runtime_slot(&slot)
                .await
                .expect("repeat shutdown empty KSK runtime slot"),
            (false, None)
        );
        assert!(slot.lock().await.is_none());
    }

    #[test]
    fn social_account_uses_official_profile_fallback() {
        let mut account = Account::new("user@example.com".to_string(), "social".to_string());
        account.auth_method = Some("social".to_string());
        account.provider = Some("Github".to_string());
        account.refresh_token = Some("refresh-fixture".to_string());

        ensure_account_can_issue_ksk(&account).expect("social account is eligible");
        assert_eq!(
            issuable_profile_arn(&account).expect("social profile fallback"),
            KIRO_SOCIAL_PROFILE_ARN
        );
    }

    #[test]
    fn external_idp_and_idc_without_profile_are_rejected() {
        let mut external = Account::new("user@example.com".to_string(), "external".to_string());
        external.auth_method = Some("external_idp".to_string());
        external.refresh_token = Some("refresh-fixture".to_string());
        assert!(ensure_account_can_issue_ksk(&external).is_err());

        let mut idc = Account::new_enterprise("user-id".to_string(), "idc".to_string());
        idc.refresh_token = Some("refresh-fixture".to_string());
        assert!(issuable_profile_arn(&idc).is_err());
        idc.profile_arn = Some("arn:aws:codewhisperer:us-east-1:1:profile/test".to_string());
        assert!(issuable_profile_arn(&idc).is_ok());
    }
}
