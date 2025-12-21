// 公共工具函数 - 提取重复逻辑

use crate::account::Account;
use crate::auth::get_usage_limits_desktop;
use crate::codewhisperer_client::CodeWhispererClient;
use crate::commands::machine_guid_cmd::get_machine_id;
use crate::providers::{AuthProvider, IdcProvider, RefreshMetadata, SocialProvider};

/// Token 刷新结果
pub struct RefreshResult {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: i64,
    pub profile_arn: Option<String>,
    pub id_token: Option<String>,
    pub sso_session_id: Option<String>,
}

/// Usage 获取结果
pub struct UsageResult {
    pub usage_data: serde_json::Value,
    pub is_banned: bool,
}

/// 根据 provider 刷新 token
pub async fn refresh_token_by_provider(
    account: &Account,
) -> Result<RefreshResult, String> {
    let provider = account.provider.as_deref().unwrap_or("Google");
    let refresh_token = account.refresh_token.as_ref().ok_or("No refresh token")?;

    if provider == "BuilderId" {
        let metadata = RefreshMetadata {
            client_id: account.client_id.clone(),
            client_secret: account.client_secret.clone(),
            region: account.region.clone(),
            ..Default::default()
        };
        let region = metadata.region.as_deref().unwrap_or("us-east-1");
        let idc_provider = IdcProvider::new("BuilderId", region, None);
        let auth = idc_provider.refresh_token(refresh_token, metadata).await?;
        Ok(RefreshResult {
            access_token: auth.access_token,
            refresh_token: Some(auth.refresh_token),
            expires_in: auth.expires_in,
            profile_arn: None,
            id_token: auth.id_token,
            sso_session_id: auth.sso_session_id,
        })
    } else {
        let metadata = RefreshMetadata {
            profile_arn: account.profile_arn.clone(),
            ..Default::default()
        };
        let social_provider = SocialProvider::new(provider);
        let auth = social_provider.refresh_token(refresh_token, metadata).await?;
        Ok(RefreshResult {
            access_token: auth.access_token,
            refresh_token: Some(auth.refresh_token),
            expires_in: auth.expires_in,
            profile_arn: auth.profile_arn,
            id_token: None,
            sso_session_id: None,
        })
    }
}

/// 根据 provider 获取 usage 数据
pub async fn get_usage_by_provider(
    provider: &str,
    access_token: &str,
) -> UsageResult {
    if provider == "BuilderId" {
        let machine_id = get_machine_id();
        let cw_client = CodeWhispererClient::new(&machine_id);
        let usage_call = cw_client.get_usage_limits(access_token).await;
        parse_usage_result(usage_call)
    } else {
        let usage_call = get_usage_limits_desktop(access_token).await;
        parse_usage_result(usage_call)
    }
}

/// 解析 usage 结果，提取封禁状态
fn parse_usage_result<T: serde::Serialize>(
    result: Result<T, String>,
) -> UsageResult {
    match result {
        Ok(usage) => UsageResult {
            usage_data: serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null),
            is_banned: false,
        },
        Err(e) if e.starts_with("BANNED:") => UsageResult {
            usage_data: serde_json::Value::Null,
            is_banned: true,
        },
        Err(_) => UsageResult {
            usage_data: serde_json::Value::Null,
            is_banned: false,
        },
    }
}

/// 计算过期时间字符串
pub fn calc_expires_at(expires_in: i64) -> String {
    let expires_at = chrono::Local::now() + chrono::Duration::seconds(expires_in);
    expires_at.format("%Y/%m/%d %H:%M:%S").to_string()
}
