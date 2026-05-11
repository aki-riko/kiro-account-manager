// 自动刷新后台任务模块
// 使用 tokio::time::interval 实现真正的后台定时刷新

use crate::commands::app_settings_cmd::get_app_settings_inner;
use crate::core::account::Account;
use crate::state::AppState;
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::{interval, Duration};

/// 启动自动刷新后台任务
pub fn start_auto_refresh_task(app_handle: AppHandle) {
    tokio::spawn(async move {
        log::info!("[AutoRefresh] 后台任务已启动");

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
                        "[AutoRefresh] 读取配置失败 ({}/{}): {}",
                        retry_count,
                        MAX_RETRIES,
                        e
                    );

                    if retry_count >= MAX_RETRIES {
                        log::error!(
                            "[AutoRefresh] 达到最大重试次数 ({}), 后台任务停止",
                            MAX_RETRIES
                        );
                        return;
                    }

                    tokio::time::sleep(Duration::from_secs(60)).await;
                    continue;
                }
            };

            // 检查是否启用自动刷新
            if settings.auto_refresh != Some(true) {
                log::debug!("[AutoRefresh] 自动刷新已禁用，等待 60 秒后重新检查");
                tokio::time::sleep(Duration::from_secs(60)).await;
                continue;
            }

            // 获取刷新间隔（分钟）
            let interval_minutes = settings.auto_refresh_interval.unwrap_or(50);
            let interval_duration = Duration::from_secs((interval_minutes as u64) * 60);

            log::info!(
                "[AutoRefresh] 自动刷新已启用，间隔 {} 分钟",
                interval_minutes
            );

            // 创建定时器
            let mut timer = interval(interval_duration);
            // 消耗第一次 tick（立即返回），避免重复刷新
            timer.tick().await;

            // 立即执行一次刷新
            refresh_all_accounts(&app_handle).await;

            // 定时刷新
            loop {
                timer.tick().await;

                // 重新检查配置（用户可能修改了设置）
                let current_settings = match get_app_settings_inner() {
                    Ok(s) => s,
                    Err(_) => break, // 读取失败，退出内层循环，重新初始化
                };

                // 如果禁用了自动刷新，退出内层循环
                if current_settings.auto_refresh != Some(true) {
                    log::info!("[AutoRefresh] 自动刷新已禁用");
                    break;
                }

                // 如果间隔改变了，退出内层循环，重新初始化定时器
                let current_interval = current_settings.auto_refresh_interval.unwrap_or(50);
                if current_interval != interval_minutes {
                    log::info!(
                        "[AutoRefresh] 刷新间隔已改变: {} -> {} 分钟",
                        interval_minutes,
                        current_interval
                    );
                    break;
                }

                // 执行刷新
                refresh_all_accounts(&app_handle).await;
            }
        }
    });
}

/// 刷新所有账号
async fn refresh_all_accounts(app_handle: &AppHandle) {
    log::debug!("[AutoRefresh] 开始刷新所有账号");

    // 获取 AppState
    let state = app_handle.state::<AppState>();

    // 获取所有账号
    let accounts = {
        match state.store.lock() {
            Ok(mut s) => {
                s.reload();
                s.get_all()
            }
            Err(e) => {
                log::error!("[AutoRefresh] 获取账号列表失败: {}", e);
                return;
            }
        }
    };

    if accounts.is_empty() {
        log::debug!("[AutoRefresh] 没有账号需要刷新");
        return;
    }

    // 过滤掉封禁和封顶的账号
    let valid_accounts: Vec<Account> = accounts
        .into_iter()
        .filter(|acc| {
            let status = acc.status.to_lowercase();
            status != "banned"
                && status != "封禁"
                && status != "已封禁"
                && status != "capped"
                && status != "封顶"
        })
        .collect();

    if valid_accounts.is_empty() {
        log::debug!("[AutoRefresh] 没有有效账号需要刷新");
        return;
    }

    log::debug!("[AutoRefresh] 需要刷新 {} 个账号", valid_accounts.len());

    // 计算并发数（每 10 个账号 1 个并发，最少 1，最多 5）
    let concurrency = (valid_accounts.len() / 10).clamp(1, 5);
    log::debug!("[AutoRefresh] 使用并发数: {}", concurrency);

    // 统计结果
    let network_error_count = std::sync::Arc::new(std::sync::Mutex::new(0usize));
    let success_count = std::sync::Arc::new(std::sync::Mutex::new(0usize));
    let error_count = std::sync::Arc::new(std::sync::Mutex::new(0usize));

    // 创建任务列表
    let mut tasks = Vec::new();

    for account in valid_accounts.iter() {
        let app_handle = app_handle.clone();
        let account_id = account.id.clone();
        let account_email = account.email.clone().unwrap_or_else(|| "未知".to_string());
        let network_error_count = std::sync::Arc::clone(&network_error_count);
        let success_count = std::sync::Arc::clone(&success_count);
        let error_count = std::sync::Arc::clone(&error_count);

        let task = tokio::spawn(async move {
            // 获取 AppState
            let state = app_handle.state::<AppState>();

            match crate::commands::account_cmd::sync_account(state, account_id.clone()).await {
                Ok(_) => {
                    log::debug!("[AutoRefresh] 账号 {} 刷新成功", account_email);
                    if let Ok(mut count) = success_count.lock() {
                        *count += 1;
                    }
                }
                Err(e) => {
                    let error_msg = e.to_string();

                    if error_msg.contains("BANNED") {
                        // 发送封禁事件
                        log::warn!("[AutoRefresh] 账号 {} 已被封禁", account_email);
                        let _ = app_handle.emit(
                            "account-banned",
                            serde_json::json!({
                                "email": account_email,
                                "id": account_id
                            }),
                        );
                    } else if error_msg.contains("AUTH_ERROR") {
                        // AUTH_ERROR: 静默处理
                        log::info!(
                            "[AutoRefresh] 账号 {} Token 已失效，已自动标记",
                            account_email
                        );
                    } else if error_msg.contains("invalid") {
                        // 其他 invalid 错误才发送事件
                        log::warn!("[AutoRefresh] 账号 {} Token 失效", account_email);
                        let _ = app_handle.emit(
                            "account-token-invalid",
                            serde_json::json!({
                                "email": account_email,
                                "id": account_id
                            }),
                        );
                    } else if error_msg.contains("request failed")
                        || error_msg.contains("network")
                        || error_msg.contains("timeout")
                        || error_msg.contains("connection")
                    {
                        // 网络错误，统计数量
                        if let Ok(mut count) = network_error_count.lock() {
                            *count += 1;
                        }
                    } else {
                        log::error!(
                            "[AutoRefresh] 账号 {} 刷新失败: {}",
                            account_email,
                            error_msg
                        );
                    }

                    if let Ok(mut count) = error_count.lock() {
                        *count += 1;
                    }
                }
            }
        });

        tasks.push(task);

        // 控制并发数
        if tasks.len() >= concurrency {
            // 等待一批任务完成
            for task in tasks.drain(..) {
                let _ = task.await;
            }
        }
    }

    // 等待剩余任务完成
    for task in tasks {
        let _ = task.await;
    }

    // 发送网络错误事件（如果有）
    if let Ok(count) = network_error_count.lock() {
        if *count > 0 {
            log::warn!("[AutoRefresh] {} 个账号遇到网络错误", *count);
            let _ = app_handle.emit(
                "sync-network-error",
                serde_json::json!({
                    "count": *count,
                    "total": valid_accounts.len()
                }),
            );
        }
    }

    // 发送账号更新事件
    let _ = app_handle.emit("accounts-updated", ());

    // 输出统计信息
    let success = success_count.lock().map(|c| *c).unwrap_or(0);
    let errors = error_count.lock().map(|c| *c).unwrap_or(0);
    log::info!(
        "[AutoRefresh] 刷新完成: 成功 {}, 失败 {}",
        success,
        errors
    );
}
