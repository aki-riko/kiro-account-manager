// 自动换号后台任务模块
// 使用 tokio::time::interval 实现真正的后台定时检查

use crate::commands::app_settings_cmd::{get_app_settings_inner, AppSettings};
use crate::commands::common::{account_machine_id_or_new, save_store};
use crate::commands::machine_guid::set_custom_machine_guid;
use crate::core::account::Account;
use crate::state::AppState;
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::{interval, Duration};

// 默认值
const DEFAULT_THRESHOLD: f64 = 1.0; // 余额阈值
const DEFAULT_INTERVAL: i32 = 5; // 检查间隔（分钟）

/// 启动自动换号后台任务
pub fn start_auto_switch_task(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        log::info!("[AutoSwitch] 后台任务已启动");

        let mut retry_count = 0;
        const MAX_RETRIES: u32 = 3;

        loop {
            // 读取配置
            let settings = match get_app_settings_inner() {
                Ok(s) => {
                    retry_count = 0; // 成功后重置重试计数
                    s
                }
                Err(e) => {
                    retry_count += 1;
                    log::error!(
                        "[AutoSwitch] 读取配置失败 ({}/{}): {}",
                        retry_count,
                        MAX_RETRIES,
                        e
                    );

                    if retry_count >= MAX_RETRIES {
                        log::error!(
                            "[AutoSwitch] 达到最大重试次数 ({}), 后台任务停止",
                            MAX_RETRIES
                        );
                        return;
                    }

                    tokio::time::sleep(Duration::from_secs(300)).await;
                    continue;
                }
            };

            // 检查是否启用自动换号
            if settings.auto_switch_enabled != Some(true) {
                log::debug!("[AutoSwitch] 自动换号已禁用，等待 30 分钟后重新检查");
                tokio::time::sleep(Duration::from_secs(1800)).await;
                continue;
            }

            // 获取配置参数
            let threshold = settings.auto_switch_threshold.unwrap_or(DEFAULT_THRESHOLD);
            let interval_minutes = settings.auto_switch_interval.unwrap_or(DEFAULT_INTERVAL);

            // 获取自动刷新间隔
            let refresh_interval = settings.auto_refresh_interval.unwrap_or(50);

            // 如果自动换号间隔小于自动刷新间隔，发出警告
            if interval_minutes < refresh_interval {
                log::warn!(
                    "[AutoSwitch] 自动换号间隔 ({} 分钟) 小于自动刷新间隔 ({} 分钟)，可能导致使用过期数据",
                    interval_minutes,
                    refresh_interval
                );
            }

            let interval_duration = Duration::from_secs((interval_minutes as u64) * 60);

            log::info!(
                "[AutoSwitch] 自动换号已启用，间隔 {} 分钟，阈值 {}",
                interval_minutes,
                threshold
            );

            // 创建定时器
            let mut timer = interval(interval_duration);
            // 消耗第一次 tick
            timer.tick().await;

            // 立即检查一次
            check_and_auto_switch(&app_handle, threshold).await;

            // 定时检查
            loop {
                timer.tick().await;

                // 重新检查配置（用户可能修改了设置）
                let current_settings = match get_app_settings_inner() {
                    Ok(s) => s,
                    Err(_) => break, // 读取失败，退出内层循环，重新初始化
                };

                // 如果禁用了自动换号，退出内层循环
                if current_settings.auto_switch_enabled != Some(true) {
                    log::info!("[AutoSwitch] 自动换号已禁用");
                    break;
                }

                // 如果配置改变了，退出内层循环，重新初始化定时器
                let current_threshold = current_settings
                    .auto_switch_threshold
                    .unwrap_or(DEFAULT_THRESHOLD);
                let current_interval = current_settings
                    .auto_switch_interval
                    .unwrap_or(DEFAULT_INTERVAL);

                if current_threshold != threshold || current_interval != interval_minutes {
                    log::info!(
                        "[AutoSwitch] 配置已改变: 阈值 {} -> {}, 间隔 {} -> {} 分钟",
                        threshold,
                        current_threshold,
                        interval_minutes,
                        current_interval
                    );
                    break;
                }

                // 执行检查
                check_and_auto_switch(&app_handle, threshold).await;
            }
        }
    });
}

/// 检查并自动切换账号
async fn check_and_auto_switch(app_handle: &AppHandle, threshold: f64) {
    log::debug!("[AutoSwitch] 开始检查是否需要切换账号");

    // 获取 AppState
    let state = app_handle.state::<AppState>();

    // 获取所有账号（从本地存储读取，不调用 API）
    let accounts = {
        match state.store.lock() {
            Ok(mut s) => {
                s.reload();
                s.get_all()
            }
            Err(poisoned) => {
                log::warn!("[AutoSwitch] 锁被污染，尝试恢复");
                let mut s = poisoned.into_inner();
                s.reload();
                s.get_all()
            }
        }
    };

    if accounts.is_empty() {
        log::debug!("[AutoSwitch] 没有账号");
        return;
    }

    // 获取当前使用的账号（从本地 Kiro 凭证）
    let current_account = match get_current_account(&accounts).await {
        Some(acc) => acc,
        None => {
            log::debug!("[AutoSwitch] 未检测到当前账号");
            return;
        }
    };

    log::debug!("[AutoSwitch] 当前账号: {:?}", current_account.email);

    // 直接使用本地数据计算剩余额度（不刷新，避免频繁调用 API）
    // 注意：自动刷新任务已经在定期更新所有账号数据，这里直接读取即可
    let remaining = calculate_remaining(&current_account);
    log::debug!(
        "[AutoSwitch] 当前账号剩余额度: {}, 阈值: {}",
        remaining,
        threshold
    );

    // 检查是否需要切换
    if remaining > threshold {
        log::debug!("[AutoSwitch] 剩余额度充足，无需切换");
        return;
    }

    log::info!(
        "[AutoSwitch] 剩余额度不足 ({} <= {})，查找可用账号",
        remaining,
        threshold
    );

    // 查找可用账号
    let available_account = find_available_account(&accounts, &current_account, threshold);

    let available_account = match available_account {
        Some(acc) => acc,
        None => {
            log::warn!("[AutoSwitch] 没有可用账号");
            return;
        }
    };

    log::info!(
        "[AutoSwitch] 找到可用账号: {:?}，准备切换",
        available_account.email
    );

    // 执行切换
    if let Err(e) = switch_account(app_handle, &available_account).await {
        log::error!("[AutoSwitch] 切换账号失败: {}", e);
        return;
    }

    log::info!("[AutoSwitch] 切换账号成功: {:?}", available_account.email);

    // 发送事件通知前端
    let _ = app_handle.emit("accounts-updated", ());
    let _ = app_handle.emit(
        "account-switched",
        serde_json::json!({
            "email": available_account.email
        }),
    );
}

/// 获取当前使用的账号
async fn get_current_account(accounts: &[Account]) -> Option<Account> {
    // 读取本地 Kiro Token
    let local_token = crate::kiro::ide::get_kiro_local_token().await?;

    // 优先用 refreshToken 匹配
    if let Some(refresh_token) = local_token.refresh_token.as_ref() {
        if let Some(acc) = accounts.iter().find(|acc| {
            acc.refresh_token
                .as_ref()
                .map(|rt| rt == refresh_token)
                .unwrap_or(false)
        }) {
            return Some(acc.clone());
        }
    }

    // 降级：用 accessToken 前缀匹配（token refresh 后 refreshToken 变了，但 accessToken 前缀一样）
    if let Some(access_token) = local_token.access_token.as_ref() {
        let prefix = &access_token[..access_token.len().min(20)];
        if let Some(acc) = accounts.iter().find(|acc| {
            acc.access_token
                .as_ref()
                .map(|at| at.starts_with(prefix))
                .unwrap_or(false)
        }) {
            return Some(acc.clone());
        }
    }

    // 再降级：用 clientIdHash 匹配（IdC 账号）
    if let Some(hash) = local_token.client_id_hash.as_ref() {
        if let Some(acc) = accounts.iter().find(|acc| {
            acc.client_id_hash
                .as_ref()
                .map(|h| h == hash)
                .unwrap_or(false)
        }) {
            return Some(acc.clone());
        }
    }

    log::warn!(
        "[AutoSwitch] 无法匹配当前账号 (refreshToken/accessToken/clientIdHash 均不匹配)"
    );
    None
}

/// 计算剩余额度（主配额 + 试用 + 奖励 + 已开启的超额，减去全部已用）
fn calculate_remaining(account: &Account) -> f64 {
    crate::core::usage::UsageDetails::from_usage_data(account.usage_data.as_ref())
        .map(|d| d.remaining())
        .unwrap_or(0.0)
}

/// 查找可用账号（选择剩余额度最多的）
fn find_available_account(
    accounts: &[Account],
    current_account: &Account,
    threshold: f64,
) -> Option<Account> {
    accounts
        .iter()
        .filter(|acc| {
            // 排除当前账号
            if acc.id == current_account.id {
                return false;
            }

            // 排除禁用的账号
            if !acc.enabled {
                return false;
            }

            // 排除不可用账号（banned / invalid 是真不可用）
            let status = acc.status.to_lowercase();
            if status == "banned"
                || status == "封禁"
                || status == "已封禁"
                || status == "invalid"
                || status == "失效"
            {
                return false;
            }

            // 排除余额不足的账号
            let remaining = calculate_remaining(acc);
            if remaining <= threshold {
                return false;
            }

            true
        })
        .max_by(|a, b| {
            calculate_remaining(a)
                .partial_cmp(&calculate_remaining(b))
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .cloned()
}

/// 切换账号
async fn switch_account(app_handle: &AppHandle, account: &Account) -> Result<(), String> {
    // 读取应用设置
    let settings = get_app_settings_inner().map_err(|e| e.to_string())?;

    // 应用机器码（如果需要）
    let account_to_switch = apply_machine_guid(app_handle, account, &settings).await?;

    // 构建切换参数
    let params = build_switch_params(&account_to_switch);

    // 执行切换
    crate::kiro::ide::switch_kiro_account(params)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum MachineGuidSwitchAction {
    UseAccountMachineId(String),
}

fn resolve_machine_guid_switch_action(
    account: &Account,
    _settings: &AppSettings,
) -> MachineGuidSwitchAction {
    MachineGuidSwitchAction::UseAccountMachineId(account_machine_id_or_new(&account.machine_id))
}

fn persist_account_machine_id_if_needed(
    app_handle: &AppHandle,
    account_id: &str,
    machine_id: &str,
) -> Result<(), String> {
    let state = app_handle.state::<AppState>();
    let mut store = match state.store.lock() {
        Ok(store) => store,
        Err(poisoned) => {
            log::warn!("[AutoSwitch] 锁被污染，尝试恢复");
            poisoned.into_inner()
        }
    };

    let Some(stored_account) = store
        .accounts
        .iter_mut()
        .find(|stored_account| stored_account.id == account_id)
    else {
        return Err("账号不存在".to_string());
    };

    let current_machine_id = stored_account
        .machine_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    if current_machine_id == Some(machine_id) {
        return Ok(());
    }

    stored_account.machine_id = Some(machine_id.to_string());
    save_store(&store)
}

/// 应用机器码
async fn apply_machine_guid(
    app_handle: &AppHandle,
    account: &Account,
    settings: &AppSettings,
) -> Result<Account, String> {
    let mut account = account.clone();

    match resolve_machine_guid_switch_action(&account, settings) {
        MachineGuidSwitchAction::UseAccountMachineId(machine_id) => {
            log::debug!("[AutoSwitch] 使用账号绑定的机器码: {}", machine_id);
            if let Err(error) =
                persist_account_machine_id_if_needed(app_handle, &account.id, &machine_id)
            {
                log::warn!("[AutoSwitch] 保存账号机器码失败: {}", error);
            }
            if let Err(error) = set_custom_machine_guid(machine_id.clone()).await {
                log::warn!("[AutoSwitch] 写入系统机器码失败: {}", error);
            }
            account.machine_id = Some(machine_id);
        }
    }

    Ok(account)
}

/// 构建切换参数
fn build_switch_params(account: &Account) -> crate::kiro::ide::SwitchAccountParams {
    crate::kiro::ide::SwitchAccountParams {
        access_token: account.access_token.clone().unwrap_or_default(),
        refresh_token: account.refresh_token.clone().unwrap_or_default(),
        provider: account.provider.clone().unwrap_or_default(),
        auth_method: account.auth_method.clone(),
        profile_arn: account.profile_arn.clone(),
        start_url: account.start_url.clone(),
        client_id: account.client_id.clone(),
        client_secret: account.client_secret.clone(),
        client_id_hash: account.client_id_hash.clone(),
        region: account.region.clone(),
    }
}

/// 一键切换到下一个可用账号（前端按钮调用，不弹确认）
#[tauri::command]
pub async fn quick_switch_next(app_handle: AppHandle) -> Result<String, String> {
    let state = app_handle.state::<AppState>();
    let settings = get_app_settings_inner().map_err(|e| e.to_string())?;
    let threshold = settings.auto_switch_threshold.unwrap_or(DEFAULT_THRESHOLD);

    // 读取所有账号
    let accounts = {
        match state.store.lock() {
            Ok(mut s) => {
                s.reload();
                s.get_all()
            }
            Err(poisoned) => {
                let mut s = poisoned.into_inner();
                s.reload();
                s.get_all()
            }
        }
    };

    if accounts.is_empty() {
        return Err("没有可用账号".to_string());
    }

    // 获取当前账号
    let current_account = get_current_account(&accounts).await;

    // 查找下一个可用账号
    let next_account = if let Some(ref current) = current_account {
        find_available_account(&accounts, current, threshold)
    } else {
        // 没有当前账号，找第一个有额度的
        accounts
            .iter()
            .find(|acc| {
                acc.enabled
                    && !["banned", "invalid", "封禁", "已封禁", "失效"]
                        .contains(&acc.status.to_lowercase().as_str())
                    && calculate_remaining(acc) > threshold
            })
            .cloned()
    };

    let next_account = next_account.ok_or("没有可切换的可用账号")?;
    let email = next_account.email.clone().unwrap_or_else(|| "未知账号".to_string());

    // 执行切换
    switch_account(&app_handle, &next_account).await?;

    // 通知前端
    let _ = app_handle.emit("accounts-updated", ());
    let _ = app_handle.emit(
        "account-switched",
        serde_json::json!({ "email": &email }),
    );

    Ok(email)
}

#[cfg(test)]
mod tests {
    use super::{resolve_machine_guid_switch_action, MachineGuidSwitchAction};
    use crate::commands::app_settings_cmd::AppSettings;
    use crate::core::account::Account;

    fn account_with_machine_id(machine_id: Option<&str>) -> Account {
        let mut account = Account::new("test@example.com".to_string(), "test".to_string());
        account.machine_id = machine_id.map(str::to_string);
        account
    }

    #[test]
    fn auto_switch_machine_guid_uses_existing_account_machine_id_by_default() {
        let account = account_with_machine_id(Some(" ACCOUNT-MACHINE "));
        let settings = AppSettings::default();

        assert_eq!(
            resolve_machine_guid_switch_action(&account, &settings),
            MachineGuidSwitchAction::UseAccountMachineId("account-machine".to_string())
        );
    }

    #[test]
    fn auto_switch_machine_guid_generates_account_machine_id_when_bound_id_is_missing() {
        let account = account_with_machine_id(Some("   "));
        let settings = AppSettings::default();

        let MachineGuidSwitchAction::UseAccountMachineId(machine_id) =
            resolve_machine_guid_switch_action(&account, &settings);
        assert!(!machine_id.trim().is_empty());
        assert_ne!(
            machine_id.trim(),
            account.machine_id.as_deref().unwrap().trim()
        );
    }
}
