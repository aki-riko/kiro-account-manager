// 卡密兑换命令 - 调用 LicenseSystem API 兑换卡密并导入账号

use serde::{Deserialize, Serialize};
use tauri::State;
use crate::state::AppState;
use crate::account::Account;
use crate::commands::app_settings_cmd::get_app_settings;

/// 兑换响应
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedeemResponse {
    pub success: bool,
    pub message: String,
    pub email: Option<String>,
    pub account: Option<Account>,
}

/// LicenseSystem API 响应
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LicenseRedeemResponse {
    pub success: bool,
    pub message: Option<String>,
    pub data: Option<LicenseRedeemData>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LicenseRedeemData {
    pub payload: Option<String>,  // JSON 字符串，包含账号信息
}

/// 兑换卡密
/// 1. 调用 LicenseSystem API 验证卡密
/// 2. 获取 payload（账号 JSON）
/// 3. 导入账号到本地
#[tauri::command]
pub async fn redeem_card(
    state: State<'_, AppState>,
    card_key: String,
) -> Result<RedeemResponse, String> {
    // 获取兑换服务地址
    let settings = get_app_settings().await?;
    let server = settings.redeem_server
        .filter(|s| !s.is_empty())
        .ok_or("未配置卡密兑换服务地址，请在设置中配置")?;
    
    // 构建 API URL
    let url = format!("{}/api/cards/redeem", server.trim_end_matches('/'));
    
    // 调用 LicenseSystem API
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({ "cardKey": card_key }))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("服务器返回错误 {}: {}", status, text));
    }
    
    let result: LicenseRedeemResponse = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;
    
    if !result.success {
        return Err(result.message.unwrap_or_else(|| "兑换失败".to_string()));
    }
    
    // 获取 payload
    let payload = result.data
        .and_then(|d| d.payload)
        .ok_or("卡密无效或已被使用")?;
    
    // 解析账号 JSON
    let account: Account = serde_json::from_str(&payload)
        .map_err(|e| format!("账号数据格式错误: {}", e))?;
    
    let email = account.email.clone();
    
    // 导入账号
    let mut store = state.store.lock().unwrap();
    
    // 检查是否已存在相同邮箱的账号
    let existing_idx = store.accounts.iter().position(|a| a.email == email);
    
    if let Some(idx) = existing_idx {
        // 更新现有账号
        store.accounts[idx] = account.clone();
    } else {
        // 添加新账号
        store.accounts.insert(0, account.clone());
    }
    
    store.save_to_file();
    
    Ok(RedeemResponse {
        success: true,
        message: "兑换成功".to_string(),
        email: Some(email),
        account: Some(account),
    })
}
