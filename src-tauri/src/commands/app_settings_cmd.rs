// 应用自身设置命令 (存到 ~/.kiro-account-manager/app-settings.json)

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: Option<String>,
    pub locale: Option<String>,  // 界面语言
    pub lock_model: Option<bool>,
    pub locked_model: Option<String>,
    pub auto_refresh: Option<bool>,
    pub auto_refresh_interval: Option<i32>,
    pub auto_change_machine_id: Option<bool>,  // 切换账号时是否更换机器码（默认 true）
    pub browser_path: Option<String>,
    // 账户机器码绑定功能
    pub bind_machine_id_to_account: Option<bool>,  // true=绑定模式（每个账号固定机器码），false=随机模式
    // 隐私模式：脱敏显示邮箱
    pub privacy_mode: Option<bool>,
    // Kiro IDE 开关设置（用户偏好）
    pub enable_codebase_indexing: Option<bool>,
    pub enable_tab_autocomplete: Option<bool>,
    pub usage_summary: Option<bool>,
    pub code_references: Option<bool>,
    pub enable_debug_logs: Option<bool>,
    pub notify_action_required: Option<bool>,
    pub notify_failure: Option<bool>,
    pub notify_success: Option<bool>,
    pub notify_billing: Option<bool>,
}

// 兼容旧配置文件中的 redeem_server 字段（已废弃）
// 读取时忽略，不再写入

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: Some("dark".to_string()),
            locale: Some("zh-CN".to_string()),
            lock_model: Some(true),
            locked_model: Some("claude-opus-4.5".to_string()),
            auto_refresh: Some(true),
            auto_refresh_interval: Some(50),
            auto_change_machine_id: Some(true),  // 默认开启
            browser_path: None,
            bind_machine_id_to_account: Some(true),
            privacy_mode: Some(true),  // 默认开启
            // Kiro IDE 开关默认值
            enable_codebase_indexing: Some(true),
            enable_tab_autocomplete: Some(true),
            usage_summary: Some(true),
            code_references: Some(true),
            enable_debug_logs: Some(false),
            notify_action_required: Some(true),
            notify_failure: Some(true),
            notify_success: Some(true),
            notify_billing: Some(true),
        }
    }
}

fn get_data_dir() -> PathBuf {
    dirs::data_dir().unwrap_or_else(|| {
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home)
    }).join(".kiro-account-manager")
}

fn get_app_settings_path() -> PathBuf {
    get_data_dir().join("app-settings.json")
}

pub fn get_app_settings_inner() -> Result<AppSettings, String> {
    let path = get_app_settings_path();
    if !path.exists() {
        // 首次启动：创建并保存默认值
        let default_settings = AppSettings::default();
        save_settings_to_file(&default_settings)?;
        return Ok(default_settings);
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取设置失败: {e}"))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("解析设置失败: {e}"))
}

pub fn save_settings_to_file(settings: &AppSettings) -> Result<(), String> {
    let path = get_app_settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("序列化失败: {e}"))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("写入失败: {e}"))
}

fn save_app_settings_inner(updates: AppSettings) -> Result<(), String> {
    let mut current = get_app_settings_inner().unwrap_or_default();
    
    // 只更新传入的非 None 字段
    if updates.theme.is_some() { current.theme = updates.theme; }
    if updates.locale.is_some() { current.locale = updates.locale; }
    if updates.lock_model.is_some() { current.lock_model = updates.lock_model; }
    if updates.locked_model.is_some() { current.locked_model = updates.locked_model; }
    if updates.auto_refresh.is_some() { current.auto_refresh = updates.auto_refresh; }
    if updates.auto_refresh_interval.is_some() { current.auto_refresh_interval = updates.auto_refresh_interval; }
    if updates.auto_change_machine_id.is_some() { current.auto_change_machine_id = updates.auto_change_machine_id; }
    if updates.browser_path.is_some() { current.browser_path = updates.browser_path; }
    if updates.bind_machine_id_to_account.is_some() { current.bind_machine_id_to_account = updates.bind_machine_id_to_account; }
    if updates.privacy_mode.is_some() { current.privacy_mode = updates.privacy_mode; }
    
    // Kiro IDE 开关设置
    if updates.enable_codebase_indexing.is_some() { current.enable_codebase_indexing = updates.enable_codebase_indexing; }
    if updates.enable_tab_autocomplete.is_some() { current.enable_tab_autocomplete = updates.enable_tab_autocomplete; }
    if updates.usage_summary.is_some() { current.usage_summary = updates.usage_summary; }
    if updates.code_references.is_some() { current.code_references = updates.code_references; }
    if updates.enable_debug_logs.is_some() { current.enable_debug_logs = updates.enable_debug_logs; }
    if updates.notify_action_required.is_some() { current.notify_action_required = updates.notify_action_required; }
    if updates.notify_failure.is_some() { current.notify_failure = updates.notify_failure; }
    if updates.notify_success.is_some() { current.notify_success = updates.notify_success; }
    if updates.notify_billing.is_some() { current.notify_billing = updates.notify_billing; }
    
    save_settings_to_file(&current)
}

#[tauri::command]
pub async fn get_app_settings() -> Result<AppSettings, String> {
    tokio::task::spawn_blocking(get_app_settings_inner)
        .await
        .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn save_app_settings(settings: AppSettings) -> Result<(), String> {
    tokio::task::spawn_blocking(move || save_app_settings_inner(settings))
        .await
        .map_err(|e| format!("Task failed: {e}"))?
}

/// 获取自定义浏览器路径（供打开浏览器时使用）
pub fn get_browser_path() -> Option<String> {
    get_app_settings_inner()
        .ok()
        .and_then(|s| s.browser_path)
        .filter(|p| !p.is_empty())
}

// ============================================================
// 账号绑定机器码功能（已废弃，保留空实现兼容旧调用）
// ============================================================

#[tauri::command]
pub async fn bind_machine_id_to_account(_account_id: String, _machine_id: String) -> Result<(), String> {
    // 已废弃：机器码现在存储在账号的 machine_id 字段
    Ok(())
}

#[tauri::command]
pub async fn unbind_machine_id_from_account(_account_id: String) -> Result<(), String> {
    // 已废弃：机器码现在存储在账号的 machine_id 字段
    Ok(())
}

#[tauri::command]
pub async fn get_bound_machine_id(_account_id: String) -> Result<Option<String>, String> {
    // 已废弃：机器码现在存储在账号的 machine_id 字段
    Ok(None)
}

#[tauri::command]
pub async fn get_all_bound_machine_ids() -> Result<std::collections::HashMap<String, String>, String> {
    // 已废弃：机器码现在存储在账号的 machine_id 字段
    Ok(std::collections::HashMap::new())
}


// ============================================================
// 使用量历史记录功能
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageHistoryEntry {
    pub date: String,           // YYYY-MM-DD
    pub total_quota: i32,
    pub total_used: i32,
    pub account_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UsageHistory {
    pub entries: Vec<UsageHistoryEntry>,
}

fn get_usage_history_path() -> PathBuf {
    get_data_dir().join("usage-history.json")
}

fn get_usage_history_inner() -> Result<UsageHistory, String> {
    let path = get_usage_history_path();
    if !path.exists() {
        return Ok(UsageHistory::default());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取历史记录失败: {e}"))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("解析历史记录失败: {e}"))
}

fn save_usage_history_entry_inner(entry: UsageHistoryEntry) -> Result<(), String> {
    let path = get_usage_history_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let mut history = get_usage_history_inner().unwrap_or_default();

    // 如果当天已有记录，则更新；否则添加新记录
    if let Some(existing) = history.entries.iter_mut().find(|e| e.date == entry.date) {
        existing.total_quota = entry.total_quota;
        existing.total_used = entry.total_used;
        existing.account_count = entry.account_count;
    } else {
        history.entries.push(entry);
    }

    // 只保留最近 30 天的记录
    history.entries.sort_by(|a, b| a.date.cmp(&b.date));
    if history.entries.len() > 30 {
        let skip_count = history.entries.len() - 30;
        history.entries = history.entries.into_iter().skip(skip_count).collect();
    }

    let content = serde_json::to_string_pretty(&history)
        .map_err(|e| format!("序列化失败: {e}"))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("写入失败: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn get_usage_history() -> Result<UsageHistory, String> {
    tokio::task::spawn_blocking(get_usage_history_inner)
        .await
        .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn save_usage_history_entry(entry: UsageHistoryEntry) -> Result<(), String> {
    tokio::task::spawn_blocking(move || save_usage_history_entry_inner(entry))
        .await
        .map_err(|e| format!("Task failed: {e}"))?
}
