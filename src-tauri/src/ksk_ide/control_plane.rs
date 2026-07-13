use std::fmt;

use chrono::{DateTime, SecondsFormat, Utc};
use regex::Regex;
use reqwest::Client;
use serde::Deserialize;
use url::Url;
use uuid::Uuid;

use crate::{
    clients::http_client::{
        build_http_client_with_user_agent_for_account, build_kiro_control_plane_user_agent,
    },
    core::account::Account,
};

const TARGET_CREATE_API_KEY: &str = "KiroControlPlaneBearerService.CreateApiKey";
const TARGET_DELETE_API_KEY: &str = "KiroControlPlaneBearerService.DeleteApiKey";

#[derive(Clone)]
pub struct KskControlPlaneClient {
    http: Client,
    endpoint: Url,
}

impl KskControlPlaneClient {
    pub fn for_account(account: &Account, control_plane_region: &str) -> Result<Self, String> {
        let region = control_plane_region.trim();
        if !crate::clients::http_client::is_supported_kiro_region(region) {
            return Err(format!("KSK 签发服务不支持区域: {region}"));
        }
        let user_agent = build_kiro_control_plane_user_agent();
        let http = build_http_client_with_user_agent_for_account(&user_agent, account)?;
        let endpoint = Url::parse(&format!("https://management.{region}.kiro.dev/"))
            .map_err(|error| format!("构造 KSK 签发地址失败: {error}"))?;
        Ok(Self { http, endpoint })
    }

    #[cfg(test)]
    fn for_test(http: Client, endpoint: Url) -> Self {
        Self { http, endpoint }
    }

    pub async fn create_api_key(
        &self,
        access_token: &str,
        profile_arn: &str,
        label: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<IssuedKsk, String> {
        let body = serde_json::json!({
            "profileArn": profile_arn,
            "label": label,
            "expiresAt": expires_at.timestamp(),
        });
        let response = self
            .request(access_token, TARGET_CREATE_API_KEY)
            .body(body.to_string())
            .send()
            .await
            .map_err(|error| format!("签发 KSK 请求失败: {error}"))?;
        let status = response.status();
        let response_body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(format!(
                "签发 KSK 失败: HTTP {status}: {}",
                response_snippet(&response_body)
            ));
        }
        let parsed: CreateApiKeyResponse = serde_json::from_str(&response_body)
            .map_err(|error| format!("解析 KSK 签发响应失败: {error}"))?;
        let valid_raw_key = parsed
            .raw_key
            .strip_prefix("ksk_")
            .is_some_and(|suffix| !suffix.is_empty());
        if !valid_raw_key || parsed.key_id.trim().is_empty() || parsed.key_prefix.trim().is_empty()
        {
            return Err("KSK 签发响应缺少有效 rawKey、keyId 或 keyPrefix".to_string());
        }
        Ok(IssuedKsk {
            raw_key: parsed.raw_key,
            key_id: parsed.key_id,
            key_prefix: parsed.key_prefix,
            expires_at,
        })
    }

    pub async fn delete_api_key(
        &self,
        access_token: &str,
        key_id: &str,
        profile_arn: &str,
    ) -> Result<(), String> {
        let body = serde_json::json!({
            "keyId": key_id,
            "profileArn": profile_arn,
        });
        let response = self
            .request(access_token, TARGET_DELETE_API_KEY)
            .body(body.to_string())
            .send()
            .await
            .map_err(|error| format!("撤销 KSK 请求失败: {error}"))?;
        let status = response.status();
        let response_body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(format!(
                "撤销 KSK 失败: HTTP {status}: {}",
                response_snippet(&response_body)
            ));
        }
        Ok(())
    }

    fn request(&self, access_token: &str, target: &'static str) -> reqwest::RequestBuilder {
        self.http
            .post(self.endpoint.clone())
            .header("content-type", "application/x-amz-json-1.0")
            .header("x-amz-target", target)
            .header("x-amz-user-agent", build_kiro_control_plane_user_agent())
            .header("amz-sdk-invocation-id", Uuid::new_v4().to_string())
            .header("amz-sdk-request", "attempt=1; max=1")
            .bearer_auth(access_token)
    }
}

pub struct IssuedKsk {
    pub raw_key: String,
    pub key_id: String,
    pub key_prefix: String,
    pub expires_at: DateTime<Utc>,
}

impl fmt::Debug for IssuedKsk {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("IssuedKsk")
            .field("raw_key", &"[REDACTED]")
            .field("key_id", &self.key_id)
            .field("key_prefix", &self.key_prefix)
            .field("expires_at", &self.expires_at)
            .finish()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ManagedKskLease {
    pub source_account_id: String,
    pub source_account_label: String,
    pub key_id: String,
    pub key_prefix: String,
    pub profile_arn: String,
    pub expires_at: DateTime<Utc>,
    pub control_plane_region: String,
}

impl ManagedKskLease {
    pub fn expires_at_rfc3339(&self) -> String {
        self.expires_at.to_rfc3339_opts(SecondsFormat::Millis, true)
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateApiKeyResponse {
    raw_key: String,
    key_id: String,
    key_prefix: String,
}

fn response_snippet(body: &str) -> String {
    let redacted = Regex::new(r"ksk_[A-Za-z0-9_-]+")
        .expect("valid KSK redaction regex")
        .replace_all(body, "ksk_[REDACTED]");
    let mut chars = redacted.chars();
    let snippet: String = chars.by_ref().take(500).collect();
    if chars.next().is_some() {
        format!("{snippet}…(truncated)")
    } else {
        snippet
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use axum::{
        body::Bytes,
        extract::State,
        http::{HeaderMap, Method, StatusCode, Uri},
        routing::any,
        Router,
    };
    use chrono::Duration;
    use tokio::{net::TcpListener, sync::Mutex};

    use super::{response_snippet, KskControlPlaneClient};

    type CapturedRequest = (Method, Uri, HeaderMap, Bytes);

    #[derive(Clone, Default)]
    struct CaptureState {
        requests: Arc<Mutex<Vec<CapturedRequest>>>,
    }

    async fn capture_request(
        State(state): State<CaptureState>,
        method: Method,
        uri: Uri,
        headers: HeaderMap,
        body: Bytes,
    ) -> (StatusCode, String) {
        let target = headers
            .get("x-amz-target")
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .to_string();
        state
            .requests
            .lock()
            .await
            .push((method, uri, headers, body));
        if target.ends_with("CreateApiKey") {
            let raw_key = ["ksk_", "control-plane-fixture"].concat();
            (
                StatusCode::OK,
                serde_json::json!({
                    "rawKey": raw_key,
                    "keyId": "kskid_fixture",
                    "keyPrefix": "ksk_control",
                })
                .to_string(),
            )
        } else {
            (StatusCode::OK, "{}".to_string())
        }
    }

    #[tokio::test]
    async fn create_and_delete_use_rpc_contract_without_exposing_raw_key() {
        let capture = CaptureState::default();
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind control plane mock");
        let address = listener.local_addr().expect("control plane mock address");
        let app = Router::new()
            .fallback(any(capture_request))
            .with_state(capture.clone());
        let server = tokio::spawn(async move {
            axum::serve(listener, app)
                .await
                .expect("serve control plane mock");
        });
        let client = KskControlPlaneClient::for_test(
            reqwest::Client::builder()
                .no_proxy()
                .build()
                .expect("control plane client"),
            format!("http://{address}/")
                .parse()
                .expect("control plane mock url"),
        );
        let expires_at = chrono::Utc::now() + Duration::hours(1);

        let issued = client
            .create_api_key("oauth-access", "profile-arn", "KAM session", expires_at)
            .await
            .expect("issue KSK");
        assert_eq!(issued.key_id, "kskid_fixture");
        let raw_key_fixture = ["ksk_", "control-plane-fixture"].concat();
        assert!(!format!("{issued:?}").contains(&raw_key_fixture));
        client
            .delete_api_key("oauth-access", &issued.key_id, "profile-arn")
            .await
            .expect("delete KSK");

        let requests = capture.requests.lock().await;
        assert_eq!(requests.len(), 2);
        for (method, uri, headers, _) in requests.iter() {
            assert_eq!(*method, Method::POST);
            assert_eq!(uri.path(), "/");
            assert_eq!(
                headers
                    .get("content-type")
                    .and_then(|value| value.to_str().ok()),
                Some("application/x-amz-json-1.0")
            );
            assert_eq!(
                headers
                    .get("authorization")
                    .and_then(|value| value.to_str().ok()),
                Some("Bearer oauth-access")
            );
        }
        let create_body: serde_json::Value =
            serde_json::from_slice(&requests[0].3).expect("create body");
        assert_eq!(create_body["profileArn"], "profile-arn");
        assert_eq!(create_body["label"], "KAM session");
        assert!(create_body["expiresAt"].is_number());
        let delete_body: serde_json::Value =
            serde_json::from_slice(&requests[1].3).expect("delete body");
        assert_eq!(delete_body["keyId"], "kskid_fixture");
        assert_eq!(delete_body["profileArn"], "profile-arn");
        server.abort();
    }

    #[test]
    fn response_errors_redact_raw_ksk_values() {
        let first_fixture = ["ksk_", "secret-value"].concat();
        let second_fixture = ["ksk_", "another-secret"].concat();
        let body = serde_json::json!({
            "rawKey": first_fixture,
            "message": format!("failed for {second_fixture}"),
        })
        .to_string();
        let snippet = response_snippet(&body);

        assert!(!snippet.contains(&first_fixture));
        assert!(!snippet.contains(&second_fixture));
        assert!(snippet.contains("ksk_[REDACTED]"));
    }
}
