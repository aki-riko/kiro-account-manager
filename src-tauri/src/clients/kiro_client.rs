// Kiro API 客户端 - 统一的 REST API 接口
// 支持 management 与 runtime API 的 endpoint/header 构造，以及 getUsageLimits、ListAvailableModels、setUserPreference

use crate::clients::http_client::{
    build_http_client, build_kiro_control_plane_user_agent, build_kiro_management_user_agent,
    build_kiro_management_x_amz_user_agent, is_external_idp_auth_method,
    parse_region_from_profile_arn,
};
use crate::commands::common::resolve_default_profile_arn;
use futures_util::future::join_all;
use reqwest::{Client, RequestBuilder};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

pub struct KiroClient {
    client: reqwest::Client,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KiroProfile {
    pub arn: String,
    pub name: String,
    pub region: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AvailableProfile {
    arn: String,
    profile_name: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AvailableProfilesPage {
    #[serde(default)]
    profiles: Vec<AvailableProfile>,
    next_token: Option<String>,
}

pub fn build_kiro_runtime_host(region: &str) -> String {
    format!("runtime.{region}.kiro.dev")
}

fn build_kiro_runtime_service_url(region: &str) -> String {
    format!("https://{}", build_kiro_runtime_host(region))
}

pub fn build_generate_assistant_response_url(region: &str) -> String {
    format!(
        "{}/generateAssistantResponse",
        build_kiro_runtime_service_url(region)
    )
}

/// Kiro runtime MCP endpoint.
///
/// Kiro 0.12.301 capture:
/// `POST https://runtime.{region}.kiro.dev/mcp`
/// with `x-amzn-kiro-profile-arn` supplied by `with_kiro_upstream_headers`.
#[allow(dead_code)]
pub fn build_mcp_url(region: &str) -> String {
    format!("{}/mcp", build_kiro_runtime_service_url(region))
}

fn build_kiro_management_host(region: &str) -> String {
    format!("management.{region}.kiro.dev")
}

fn build_kiro_management_service_url(region: &str) -> String {
    format!("https://{}", build_kiro_management_host(region))
}

fn effective_profile_arn(
    profile_arn: Option<&str>,
    auth_method: Option<&str>,
    provider: Option<&str>,
) -> Result<String, String> {
    if let Some(profile_arn) = profile_arn.map(str::trim).filter(|value| !value.is_empty()) {
        return Ok(profile_arn.to_string());
    }
    if is_external_idp_auth_method(auth_method)
        || provider.is_some_and(|value| value.eq_ignore_ascii_case("ExternalIdp"))
    {
        return Err("External IdP 请求缺少已解析的 profileArn".to_string());
    }
    Ok(resolve_default_profile_arn(provider).to_string())
}

fn build_get_usage_limits_url(region: &str, profile_arn: &str) -> String {
    let base = build_kiro_management_service_url(region);
    format!(
        "{base}/getUsageLimits?isEmailRequired=true&origin=AI_EDITOR&profileArn={}&resourceType=AGENTIC_REQUEST",
        urlencoding::encode(profile_arn.trim())
    )
}

fn build_list_available_models_body(profile_arn: Option<&str>) -> serde_json::Value {
    let mut body = serde_json::json!({
        "origin": "AI_EDITOR",
    });
    if let Some(profile_arn) = profile_arn.filter(|value| !value.trim().is_empty()) {
        body["profileArn"] = serde_json::json!(profile_arn);
    }
    body
}

fn build_list_available_profiles_body(next_token: Option<&str>) -> serde_json::Value {
    let mut body = serde_json::json!({});
    if let Some(next_token) = next_token.filter(|value| !value.trim().is_empty()) {
        body["nextToken"] = serde_json::json!(next_token);
    }
    body
}

fn with_external_idp_token_type(req: RequestBuilder, auth_method: Option<&str>) -> RequestBuilder {
    if is_external_idp_auth_method(auth_method) {
        req.header("TokenType", "EXTERNAL_IDP")
    } else {
        req
    }
}

/// 给 RequestBuilder 加上 Kiro Management API 通用 headers
///
/// 包含 Authorization、UA、AWS SDK 中间件需要的请求 ID/重试头。
fn with_kiro_runtime_management_headers(
    req: RequestBuilder,
    access_token: &str,
    machine_id: &str,
    region: &str,
    auth_method: Option<&str>,
) -> RequestBuilder {
    let user_agent = build_kiro_management_user_agent(machine_id);
    let x_amz_user_agent = build_kiro_management_x_amz_user_agent(machine_id);
    let invocation_id = Uuid::new_v4().to_string();
    let req = req
        .header("Authorization", format!("Bearer {access_token}"))
        .header("host", build_kiro_management_host(region))
        .header("user-agent", user_agent.clone())
        .header("x-amz-user-agent", x_amz_user_agent)
        .header("amz-sdk-invocation-id", invocation_id)
        .header("amz-sdk-request", "attempt=1; max=1")
        .header("connection", "close");
    with_external_idp_token_type(req, auth_method)
}

fn with_kiro_control_plane_headers(
    req: RequestBuilder,
    access_token: &str,
    region: &str,
    auth_method: Option<&str>,
) -> RequestBuilder {
    let invocation_id = Uuid::new_v4().to_string();
    let req = req
        .header("Authorization", format!("Bearer {access_token}"))
        .header("host", build_kiro_management_host(region))
        .header("user-agent", build_kiro_control_plane_user_agent())
        .header("x-amz-user-agent", "aws-sdk-js/1.0.0")
        .header("amz-sdk-invocation-id", invocation_id)
        .header("amz-sdk-request", "attempt=1; max=3")
        .header("connection", "close");
    with_external_idp_token_type(req, auth_method)
}

async fn classify_kiro_management_error(api: &str, resp: reqwest::Response) -> String {
    let status_code = resp.status().as_u16();
    let body = resp.text().await.unwrap_or_default();

    if status_code == 401 {
        return format!("AUTH_ERROR: {api} 401: {body}");
    }

    if status_code == 403 {
        let body_lower = body.to_lowercase();
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&body) {
            let reason = parsed.get("reason").and_then(|r| r.as_str()).unwrap_or("");
            if reason == "TemporarilySuspended" {
                let message = parsed
                    .get("message")
                    .and_then(|m| m.as_str())
                    .unwrap_or("账号已被封禁");
                return format!("BANNED: {message}");
            }
        }
        // 检查消息中是否包含 "suspended" 关键词
        if body_lower.contains("suspended") {
            return format!("BANNED: {body}");
        }
        return format!("AUTH_ERROR: {api} 403: {body}");
    }

    if status_code == 423 {
        return "BANNED: Account suspended".to_string();
    }

    format!("{api} failed - HTTP {status_code}: {body}")
}

impl KiroClient {
    pub fn new() -> Result<Self, String> {
        let client = build_http_client()?;
        Ok(Self { client })
    }

    pub fn from_client(client: Client) -> Self {
        Self { client }
    }

    /// 统一的 getUsageLimits 接口（支持所有账号类型）
    pub async fn get_usage_limits(
        &self,
        access_token: &str,
        machine_id: &str,
        region: &str,
        profile_arn: Option<&str>,
        auth_method: Option<&str>,
        provider: Option<&str>,
    ) -> Result<serde_json::Value, String> {
        let profile_arn = effective_profile_arn(profile_arn, auth_method, provider)?;
        let url = build_get_usage_limits_url(region, &profile_arn);

        log::info!(
            "[GetUsageLimits] Request - region: {}, profileArn: {}",
            region,
            profile_arn
        );

        let request = with_kiro_runtime_management_headers(
            self.client.get(&url),
            access_token,
            machine_id,
            region,
            auth_method,
        )
        .header("accept", "application/json");

        let response = request
            .send()
            .await
            .map_err(|e| format!("getUsageLimits 请求失败: {e}"))?;

        if !response.status().is_success() {
            return Err(classify_kiro_management_error("getUsageLimits", response).await);
        }

        response
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON: {e}"))
    }

    /// 获取企业账号的 usage 数据（简化版，直接使用 us-east-1）
    /// 获取 Enterprise 账号的 usage limits（自动获取 profileArn）
    pub async fn get_enterprise_usage_limits(
        &self,
        access_token: &str,
        machine_id: &str,
    ) -> Result<serde_json::Value, String> {
        let region = "us-east-1";

        // Enterprise 账号需要先调用 ListAvailableProfiles 获取动态 profileArn
        let profile_arn = match self
            .list_available_profiles(access_token, region, Some("IdC"))
            .await
        {
            Ok(response) => {
                // 从响应中提取 profiles[0].arn
                response
                    .get("profiles")
                    .and_then(|profiles| profiles.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|profile| profile.get("arn"))
                    .and_then(|arn| arn.as_str())
                    .map(|s| s.to_string())
            }
            Err(e) => {
                log::warn!(
                    "[get_enterprise_usage_limits] ListAvailableProfiles 失败: {}",
                    e
                );
                None
            }
        };

        self.get_usage_limits(
            access_token,
            machine_id,
            region,
            profile_arn.as_deref(),
            None,
            Some("Enterprise"),
        )
        .await
    }

    /// ListAvailableModels 接口
    pub async fn list_available_models(
        &self,
        access_token: &str,
        _machine_id: &str,
        region: &str,
        profile_arn: Option<&str>,
        auth_method: Option<&str>,
    ) -> Result<serde_json::Value, String> {
        let url = build_kiro_management_service_url(region);
        let body = build_list_available_models_body(profile_arn);

        let request = with_kiro_control_plane_headers(
            self.client.post(&url),
            access_token,
            region,
            auth_method,
        )
        .header("content-type", "application/x-amz-json-1.0")
        .header(
            "x-amz-target",
            "KiroControlPlaneBearerService.ListAvailableModels",
        )
        .json(&body);

        let response = request
            .send()
            .await
            .map_err(|e| format!("ListAvailableModels 请求失败: {e}"))?;

        if !response.status().is_success() {
            return Err(classify_kiro_management_error("ListAvailableModels", response).await);
        }

        response
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON: {e}"))
    }

    /// ListAvailableProfiles 接口
    pub async fn list_available_profiles(
        &self,
        access_token: &str,
        region: &str,
        auth_method: Option<&str>,
    ) -> Result<serde_json::Value, String> {
        let url = build_kiro_management_service_url(region);
        let mut next_token = None;
        let mut seen_tokens = HashSet::new();
        let mut profiles = Vec::new();

        loop {
            let body = build_list_available_profiles_body(next_token.as_deref());
            let request = with_kiro_control_plane_headers(
                self.client.post(&url),
                access_token,
                region,
                auth_method,
            )
            .header("content-type", "application/x-amz-json-1.0")
            .header(
                "x-amz-target",
                "KiroControlPlaneBearerService.ListAvailableProfiles",
            )
            .json(&body);

            let response = request
                .send()
                .await
                .map_err(|e| format!("ListAvailableProfiles 请求失败: {e}"))?;

            if !response.status().is_success() {
                return Err(
                    classify_kiro_management_error("ListAvailableProfiles", response).await,
                );
            }

            let page = response
                .json::<AvailableProfilesPage>()
                .await
                .map_err(|e| format!("ListAvailableProfiles 响应解析失败: {e}"))?;
            profiles.extend(page.profiles);
            next_token = page
                .next_token
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty());
            let Some(token) = next_token.as_ref() else {
                break;
            };
            if !seen_tokens.insert(token.clone()) {
                return Err("ListAvailableProfiles 返回了重复 nextToken".to_string());
            }
        }

        serde_json::to_value(AvailableProfilesPage {
            profiles,
            next_token: None,
        })
        .map_err(|error| format!("ListAvailableProfiles 响应序列化失败: {error}"))
    }

    pub async fn discover_available_profiles(
        &self,
        access_token: &str,
        auth_method: Option<&str>,
        regions: &[String],
    ) -> Result<Vec<KiroProfile>, String> {
        let calls = regions.iter().map(|region| async move {
            (
                region.clone(),
                self.list_available_profiles(access_token, region, auth_method)
                    .await,
            )
        });
        let results = join_all(calls).await;
        let mut any_success = false;
        let mut errors = Vec::new();
        let mut profiles = Vec::new();
        let mut seen_arns = HashSet::new();

        for (queried_region, result) in results {
            match result {
                Ok(value) => {
                    any_success = true;
                    let page: AvailableProfilesPage = serde_json::from_value(value)
                        .map_err(|error| format!("解析 ListAvailableProfiles 响应失败: {error}"))?;
                    for profile in page.profiles {
                        let arn = profile.arn.trim().to_string();
                        let name = profile.profile_name.trim().to_string();
                        if arn.is_empty() || name.is_empty() {
                            continue;
                        }
                        let region = parse_region_from_profile_arn(Some(&arn))
                            .unwrap_or_else(|| queried_region.clone());
                        if seen_arns.insert(arn.clone()) {
                            profiles.push(KiroProfile { arn, name, region });
                        }
                    }
                }
                Err(error) => errors.push(format!("{queried_region}: {error}")),
            }
        }

        if any_success {
            Ok(profiles)
        } else {
            Err(format!(
                "ListAvailableProfiles 在所有候选 region 均失败: {}",
                errors.join("; ")
            ))
        }
    }

    /// setUserPreference 接口 - 设置用户偏好（超额开关）
    pub async fn set_user_preference(
        &self,
        access_token: &str,
        machine_id: &str,
        region: &str,
        profile_arn: Option<&str>,
        overage_status: &str,
        auth_method: Option<&str>,
    ) -> Result<(), String> {
        let url = format!(
            "{}/setUserPreference",
            build_kiro_management_service_url(region)
        );

        let mut body = serde_json::json!({
            "overageConfiguration": { "overageStatus": overage_status },
        });
        if let Some(profile_arn) = profile_arn.filter(|value| !value.trim().is_empty()) {
            body["profileArn"] = serde_json::json!(profile_arn);
        }

        let request = with_kiro_runtime_management_headers(
            self.client.post(&url),
            access_token,
            machine_id,
            region,
            auth_method,
        )
        .header("content-type", "application/json")
        .json(&body);

        let response = request
            .send()
            .await
            .map_err(|e| format!("setUserPreference 请求失败: {e} (URL: {url})"))?;

        if !response.status().is_success() {
            return Err(classify_kiro_management_error("setUserPreference", response).await);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_get_usage_limits_url, build_kiro_management_host, build_kiro_management_service_url,
        build_list_available_models_body, build_list_available_profiles_body,
        effective_profile_arn, with_kiro_control_plane_headers,
        with_kiro_runtime_management_headers,
    };

    #[test]
    fn builds_kiro_management_endpoint_for_region() {
        assert_eq!(
            build_kiro_management_host("us-east-1"),
            "management.us-east-1.kiro.dev"
        );
        assert_eq!(
            build_kiro_management_service_url("eu-central-1"),
            "https://management.eu-central-1.kiro.dev"
        );
    }

    #[test]
    fn builds_get_usage_limits_url_like_kiro_0_12_301_capture() {
        assert_eq!(
            build_get_usage_limits_url(
                "us-east-1",
                "arn:aws:codewhisperer:us-east-1:638616132270:profile/AAAACCCCXXXX"
            ),
            "https://management.us-east-1.kiro.dev/getUsageLimits?isEmailRequired=true&origin=AI_EDITOR&profileArn=arn%3Aaws%3Acodewhisperer%3Aus-east-1%3A638616132270%3Aprofile%2FAAAACCCCXXXX&resourceType=AGENTIC_REQUEST"
        );
        assert_eq!(
            effective_profile_arn(None, Some("IdC"), Some("BuilderId")),
            Ok(crate::commands::common::KIRO_BUILDER_ID_PROFILE_ARN.to_string())
        );
        assert_eq!(
            effective_profile_arn(None, Some("social"), Some("Github")),
            Ok(crate::commands::common::KIRO_SOCIAL_PROFILE_ARN.to_string())
        );
        assert!(effective_profile_arn(None, Some("external_idp"), Some("ExternalIdp")).is_err());
    }

    #[test]
    fn builds_list_available_models_body_like_control_plane_capture() {
        assert_eq!(
            build_list_available_models_body(Some(
                "arn:aws:codewhisperer:us-east-1:638616132270:profile/AAAACCCCXXXX"
            )),
            serde_json::json!({
                "origin": "AI_EDITOR",
                "profileArn": "arn:aws:codewhisperer:us-east-1:638616132270:profile/AAAACCCCXXXX"
            })
        );
        assert_eq!(
            build_list_available_models_body(None),
            serde_json::json!({ "origin": "AI_EDITOR" })
        );
    }

    #[test]
    fn builds_list_available_profiles_body_like_control_plane_schema() {
        assert_eq!(
            build_list_available_profiles_body(None),
            serde_json::json!({})
        );
        assert_eq!(
            build_list_available_profiles_body(Some("next-page")),
            serde_json::json!({ "nextToken": "next-page" })
        );
    }

    #[test]
    fn with_kiro_control_plane_headers_matches_list_available_profiles_capture_shape() {
        let request = with_kiro_control_plane_headers(
            reqwest::Client::new().post("https://management.us-east-1.kiro.dev/"),
            "token-cp",
            "us-east-1",
            Some("IdC"),
        )
        .header("content-type", "application/x-amz-json-1.0")
        .header(
            "x-amz-target",
            "KiroControlPlaneBearerService.ListAvailableProfiles",
        )
        .json(&build_list_available_profiles_body(None))
        .build()
        .expect("request should build");

        assert_eq!(request.method(), reqwest::Method::POST);
        assert_eq!(
            request.url().as_str(),
            "https://management.us-east-1.kiro.dev/"
        );
        assert_eq!(
            request
                .headers()
                .get("x-amz-target")
                .and_then(|value| value.to_str().ok()),
            Some("KiroControlPlaneBearerService.ListAvailableProfiles")
        );
        assert!(request.headers().get("TokenType").is_none());
    }

    #[test]
    fn with_kiro_runtime_management_headers_uses_kiro_aws_sdk_js_user_agents() {
        let request = with_kiro_runtime_management_headers(
            reqwest::Client::new().get(
                "https://management.eu-central-1.kiro.dev/getUsageLimits?isEmailRequired=true&origin=AI_EDITOR&profileArn=arn%3Aaws%3Acodewhisperer%3Aeu-central-1%3A123456789012%3Aprofile%2Ftest&resourceType=AGENTIC_REQUEST",
            ),
            "token-ua",
            "machine-ua",
            "eu-central-1",
            Some("external_idp"),
        )
        .build()
        .expect("request should build");

        let user_agent = request
            .headers()
            .get(reqwest::header::USER_AGENT)
            .and_then(|value| value.to_str().ok())
            .expect("user-agent header");
        let x_amz_user_agent = request
            .headers()
            .get("x-amz-user-agent")
            .and_then(|value| value.to_str().ok())
            .expect("x-amz-user-agent header");

        assert!(user_agent.starts_with("aws-sdk-js/1.0.0 ua/2.1 os/"));
        assert!(user_agent.contains(" api/codewhispererruntime#1.0.0 m/N,E KiroIDE-"));
        assert!(user_agent.ends_with("-machine-ua"));
        assert!(x_amz_user_agent.starts_with("aws-sdk-js/1.0.0 KiroIDE-"));
        assert!(x_amz_user_agent.ends_with("-machine-ua"));
        assert_eq!(
            request
                .headers()
                .get(reqwest::header::HOST)
                .and_then(|value| value.to_str().ok()),
            Some("management.eu-central-1.kiro.dev")
        );
        assert_eq!(
            request
                .headers()
                .get(reqwest::header::CONNECTION)
                .and_then(|value| value.to_str().ok()),
            Some("close")
        );
        assert_eq!(
            request
                .headers()
                .get("TokenType")
                .and_then(|value| value.to_str().ok()),
            Some("EXTERNAL_IDP")
        );
    }

    #[test]
    fn with_kiro_control_plane_headers_matches_list_available_models_capture_shape() {
        let request = with_kiro_control_plane_headers(
            reqwest::Client::new().post("https://management.us-east-1.kiro.dev/"),
            "token-cp",
            "us-east-1",
            Some("external_idp"),
        )
        .header("content-type", "application/x-amz-json-1.0")
        .header(
            "x-amz-target",
            "KiroControlPlaneBearerService.ListAvailableModels",
        )
        .build()
        .expect("request should build");

        assert_eq!(request.method(), reqwest::Method::POST);
        assert_eq!(
            request.url().as_str(),
            "https://management.us-east-1.kiro.dev/"
        );
        assert_eq!(
            request
                .headers()
                .get(reqwest::header::HOST)
                .and_then(|value| value.to_str().ok()),
            Some("management.us-east-1.kiro.dev")
        );
        assert_eq!(
            request
                .headers()
                .get("x-amz-target")
                .and_then(|value| value.to_str().ok()),
            Some("KiroControlPlaneBearerService.ListAvailableModels")
        );
        assert_eq!(
            request
                .headers()
                .get("x-amz-user-agent")
                .and_then(|value| value.to_str().ok()),
            Some("aws-sdk-js/1.0.0")
        );
        assert!(request
            .headers()
            .get(reqwest::header::USER_AGENT)
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.contains("api/kirocontrolplanebearer#1.0.0")));
        assert_eq!(
            request
                .headers()
                .get("amz-sdk-request")
                .and_then(|value| value.to_str().ok()),
            Some("attempt=1; max=3")
        );
        assert_eq!(
            request
                .headers()
                .get("TokenType")
                .and_then(|value| value.to_str().ok()),
            Some("EXTERNAL_IDP")
        );
    }
}
