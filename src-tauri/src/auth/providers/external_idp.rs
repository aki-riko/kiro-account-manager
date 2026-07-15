use super::{AuthProvider, AuthResult, RefreshMetadata};
use crate::clients::http_client::{
    build_http_client_with_timeout, build_http_client_with_timeout_for_account,
};
use async_trait::async_trait;
use base64::Engine;
use reqwest::Client;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use url::Url;

const OIDC_DISCOVERY_PATH: &str = ".well-known/openid-configuration";

#[derive(Debug, Clone, Deserialize)]
pub struct OidcDiscoveryDocument {
    #[serde(default)]
    pub issuer: Option<String>,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
}

#[derive(Debug, Deserialize)]
struct ExternalIdpTokenResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    expires_in: Option<i64>,
    #[serde(default)]
    token_type: Option<String>,
    #[serde(default)]
    id_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OAuthErrorResponse {
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    error_description: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ExternalIdpProvider {
    client_id: String,
    issuer_url: Option<String>,
    token_endpoint: Option<String>,
    scopes: Option<String>,
    audience: Option<String>,
}

impl ExternalIdpProvider {
    pub fn new(
        client_id: impl Into<String>,
        issuer_url: Option<String>,
        token_endpoint: Option<String>,
        scopes: Option<String>,
        audience: Option<String>,
    ) -> Self {
        Self {
            client_id: client_id.into(),
            issuer_url: non_empty(issuer_url),
            token_endpoint: non_empty(token_endpoint),
            scopes: scopes.map(|value| normalize_external_idp_scopes(&value)),
            audience: non_empty(audience),
        }
    }

    fn build_client(metadata: &RefreshMetadata) -> Result<Client, String> {
        let config = super::external_idp_portal::ExternalIdpAuthConfig::load()?;
        if let Some(account) = metadata.account.as_ref() {
            build_http_client_with_timeout_for_account(
                account,
                config.http_timeout_seconds,
                config.connect_timeout_seconds,
            )
        } else {
            build_http_client_with_timeout(
                config.http_timeout_seconds,
                config.connect_timeout_seconds,
            )
        }
    }

    async fn resolve_token_endpoint(
        &self,
        client: &Client,
        metadata: &RefreshMetadata,
    ) -> Result<String, String> {
        let issuer_url = non_empty(metadata.issuer_url.clone()).or_else(|| self.issuer_url.clone());
        if let Some(issuer_url) = issuer_url {
            return Ok(discover_oidc_with_client(client, &issuer_url)
                .await?
                .token_endpoint);
        }

        let token_endpoint = non_empty(metadata.token_endpoint.clone())
            .or_else(|| self.token_endpoint.clone())
            .ok_or("External IdP 刷新缺少 issuerUrl 或 tokenEndpoint")?;
        validate_external_idp_url(&token_endpoint, "tokenEndpoint")?;
        Ok(token_endpoint)
    }
}

#[async_trait]
impl AuthProvider for ExternalIdpProvider {
    async fn login(&self) -> Result<AuthResult, String> {
        Err("External IdP 在线登录尚未初始化门户元数据".to_string())
    }

    async fn refresh_token(
        &self,
        refresh_token: &str,
        metadata: RefreshMetadata,
    ) -> Result<AuthResult, String> {
        let refresh_token = refresh_token.trim();
        if refresh_token.is_empty() {
            return Err("External IdP 刷新缺少 refreshToken".to_string());
        }

        let client_id =
            non_empty(metadata.client_id.clone()).unwrap_or_else(|| self.client_id.clone());
        if client_id.trim().is_empty() {
            return Err("External IdP 刷新缺少 clientId".to_string());
        }

        let scopes = metadata
            .scopes
            .clone()
            .or_else(|| self.scopes.clone())
            .map(|value| normalize_external_idp_scopes(&value));
        let client = Self::build_client(&metadata)?;
        let token_endpoint = self.resolve_token_endpoint(&client, &metadata).await?;

        let mut form = vec![
            ("grant_type", "refresh_token".to_string()),
            ("refresh_token", refresh_token.to_string()),
            ("client_id", client_id.clone()),
        ];
        if let Some(scopes) = scopes.as_ref().filter(|value| !value.is_empty()) {
            form.push(("scope", scopes.clone()));
        }

        let response = client
            .post(&token_endpoint)
            .header("Accept", "application/json")
            .form(&form)
            .send()
            .await
            .map_err(|error| format!("External IdP token 刷新请求失败: {error}"))?;
        let status = response.status();
        if !status.is_success() {
            let oauth_error = response.json::<OAuthErrorResponse>().await.ok();
            let detail = oauth_error
                .and_then(|body| body.error_description.or(body.error))
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "身份提供商拒绝了刷新请求".to_string());
            return Err(format!(
                "External IdP token 刷新失败（HTTP {}）: {}",
                status.as_u16(),
                detail
            ));
        }

        let token = response
            .json::<ExternalIdpTokenResponse>()
            .await
            .map_err(|error| format!("External IdP token 响应解析失败: {error}"))?;
        if token.access_token.trim().is_empty() {
            return Err("External IdP token 响应缺少 access_token".to_string());
        }

        let expires_in = token.expires_in.filter(|seconds| *seconds > 0).unwrap_or(
            super::external_idp_portal::ExternalIdpAuthConfig::load()?
                .default_token_lifetime_seconds,
        );
        let expires_at = chrono::Local::now() + chrono::Duration::seconds(expires_in);
        let issuer_url = non_empty(metadata.issuer_url)
            .or_else(|| self.issuer_url.clone())
            .or_else(|| extract_external_idp_issuer(&token.access_token));
        let audience = non_empty(metadata.audience).or_else(|| self.audience.clone());

        Ok(AuthResult {
            machine_id: derive_external_idp_machine_id(&token.access_token),
            access_token: token.access_token,
            refresh_token: token
                .refresh_token
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| refresh_token.to_string()),
            expires_at: expires_at.format("%Y/%m/%d %H:%M:%S").to_string(),
            expires_in,
            provider: "ExternalIdp".to_string(),
            auth_method: "external_idp".to_string(),
            token_type: token.token_type.or_else(|| Some("Bearer".to_string())),
            id_token: token.id_token,
            region: metadata.region,
            client_id: Some(client_id),
            client_secret: None,
            client_id_hash: None,
            sso_session_id: None,
            start_url: None,
            token_endpoint: Some(token_endpoint),
            issuer_url,
            scopes,
            audience,
            profile_arn: metadata.profile_arn,
            profile_name: None,
        })
    }

    fn get_provider_id(&self) -> &str {
        "ExternalIdp"
    }

    fn get_auth_method(&self) -> &'static str {
        "external_idp"
    }
}

pub async fn discover_oidc(
    issuer_url: &str,
    account: Option<&crate::core::account::Account>,
) -> Result<OidcDiscoveryDocument, String> {
    let client = if let Some(account) = account {
        let config = super::external_idp_portal::ExternalIdpAuthConfig::load()?;
        build_http_client_with_timeout_for_account(
            account,
            config.http_timeout_seconds,
            config.connect_timeout_seconds,
        )?
    } else {
        let config = super::external_idp_portal::ExternalIdpAuthConfig::load()?;
        build_http_client_with_timeout(config.http_timeout_seconds, config.connect_timeout_seconds)?
    };
    discover_oidc_with_client(&client, issuer_url).await
}

async fn discover_oidc_with_client(
    client: &Client,
    issuer_url: &str,
) -> Result<OidcDiscoveryDocument, String> {
    let discovery_url = oidc_discovery_url(issuer_url)?;
    let response = client
        .get(discovery_url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|error| format!("OIDC Discovery 请求失败: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("OIDC Discovery 失败（HTTP {}）", status.as_u16()));
    }

    let document = response
        .json::<OidcDiscoveryDocument>()
        .await
        .map_err(|error| format!("OIDC Discovery 响应解析失败: {error}"))?;
    validate_external_idp_url(&document.authorization_endpoint, "authorization_endpoint")?;
    validate_external_idp_url(&document.token_endpoint, "token_endpoint")?;
    Ok(document)
}

fn oidc_discovery_url(issuer_url: &str) -> Result<Url, String> {
    let mut issuer = validate_external_idp_url(issuer_url, "issuerUrl")?;
    let base_path = issuer.path().trim_end_matches('/');
    issuer.set_path(&format!("{base_path}/{OIDC_DISCOVERY_PATH}"));
    issuer.set_query(None);
    issuer.set_fragment(None);
    Ok(issuer)
}

fn validate_external_idp_url(value: &str, field: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|_| format!("{field} 不是有效 URL"))?;
    let is_https = url.scheme() == "https";
    let is_loopback_http = url.scheme() == "http"
        && url.host_str().is_some_and(|host| {
            host == "localhost"
                || host
                    .parse::<std::net::IpAddr>()
                    .is_ok_and(|ip| ip.is_loopback())
        });
    if !is_https && !is_loopback_http {
        return Err(format!("{field} 必须使用 HTTPS"));
    }
    Ok(url)
}

fn non_empty(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

pub fn normalize_external_idp_scopes(scopes: &str) -> String {
    let mut normalized = Vec::new();
    for scope in scopes.split_whitespace() {
        if !normalized.contains(&scope) {
            normalized.push(scope);
        }
    }
    if !normalized.contains(&"offline_access") {
        normalized.push("offline_access");
    }
    normalized.join(" ")
}

fn decode_jwt_payload(token: &str) -> Option<serde_json::Value> {
    let encoded = token.split('.').nth(1)?.trim_end_matches('=');
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(encoded)
        .ok()?;
    serde_json::from_slice(&bytes).ok()
}

pub fn extract_external_idp_email(token: &str) -> Option<String> {
    let payload = decode_jwt_payload(token)?;
    ["preferred_username", "email", "upn", "unique_name"]
        .into_iter()
        .find_map(|key| {
            payload
                .get(key)
                .and_then(serde_json::Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
        })
}

pub fn extract_external_idp_issuer(token: &str) -> Option<String> {
    let payload = decode_jwt_payload(token)?;
    let issuer = payload
        .get("iss")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())?;
    validate_external_idp_url(issuer, "issuerUrl").ok()?;
    Some(issuer.to_string())
}

pub fn derive_external_idp_machine_id(token: &str) -> Option<String> {
    let payload = decode_jwt_payload(token)?;
    let stable_claim = ["oid", "sub"].into_iter().find_map(|key| {
        payload
            .get(key)
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
    })?;
    Some(sha256_hex(&format!("KotlinNativeAPI/{stable_claim}")))
}

pub fn generate_external_idp_machine_id(access_token: Option<&str>) -> String {
    access_token
        .and_then(derive_external_idp_machine_id)
        .unwrap_or_else(|| sha256_hex(&format!("KotlinNativeAPI/{}", uuid::Uuid::new_v4())))
}

fn sha256_hex(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        extract::{Form, State},
        http::HeaderMap,
        routing::post,
        Json, Router,
    };
    use std::{collections::HashMap, sync::Arc};
    use tokio::sync::Mutex;

    #[derive(Clone, Default)]
    struct CapturedRequest {
        headers: Arc<Mutex<Option<HeaderMap>>>,
        form: Arc<Mutex<Option<HashMap<String, String>>>>,
    }

    async fn token_handler(
        State(captured): State<CapturedRequest>,
        headers: HeaderMap,
        Form(form): Form<HashMap<String, String>>,
    ) -> Json<serde_json::Value> {
        *captured.headers.lock().await = Some(headers);
        *captured.form.lock().await = Some(form);
        Json(serde_json::json!({
            "access_token": test_jwt(),
            "refresh_token": "rotated-refresh-token",
            "expires_in": 7200,
            "token_type": "Bearer"
        }))
    }

    async fn start_token_server() -> (String, CapturedRequest) {
        let captured = CapturedRequest::default();
        let app = Router::new()
            .route("/token", post(token_handler))
            .with_state(captured.clone());
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        (format!("http://{address}/token"), captured)
    }

    fn test_jwt() -> String {
        let payload = serde_json::json!({
            "oid": "tenant-object-id",
            "sub": "fallback-subject",
            "preferred_username": "azure@example.com",
            "iss": "https://login.microsoftonline.com/tenant-id/v2.0"
        });
        let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(serde_json::to_vec(&payload).unwrap());
        format!("header.{encoded}.signature")
    }

    #[test]
    fn normalize_scopes_deduplicates_and_adds_offline_access() {
        assert_eq!(
            normalize_external_idp_scopes("openid profile openid"),
            "openid profile offline_access"
        );
        assert_eq!(
            normalize_external_idp_scopes("openid offline_access"),
            "openid offline_access"
        );
    }

    #[test]
    fn jwt_helpers_use_stable_oid_and_display_email() {
        let token = test_jwt();
        assert_eq!(
            extract_external_idp_email(&token).as_deref(),
            Some("azure@example.com")
        );
        assert_eq!(
            extract_external_idp_issuer(&token).as_deref(),
            Some("https://login.microsoftonline.com/tenant-id/v2.0")
        );
        assert_eq!(
            derive_external_idp_machine_id(&token).as_deref(),
            Some("95e1975150e65451a877f0e814d5b4aab09cbbac1932ffb3b6dfe2d2a31ad3b9")
        );
    }

    #[tokio::test]
    async fn refresh_uses_standard_form_without_kiro_token_type_header() {
        let (token_endpoint, captured) = start_token_server().await;
        let provider = ExternalIdpProvider::new(
            "public-client",
            None,
            Some(token_endpoint),
            Some("openid profile".to_string()),
            None,
        );
        let result = provider
            .refresh_token("original-refresh-token", RefreshMetadata::default())
            .await
            .unwrap();

        assert_eq!(result.refresh_token, "rotated-refresh-token");
        assert_eq!(result.expires_in, 7200);
        assert_eq!(result.auth_method, "external_idp");
        assert_eq!(
            result.issuer_url.as_deref(),
            Some("https://login.microsoftonline.com/tenant-id/v2.0")
        );
        assert_eq!(
            extract_external_idp_email(&result.access_token).as_deref(),
            Some("azure@example.com")
        );

        let headers = captured.headers.lock().await.clone().unwrap();
        assert!(headers.get("TokenType").is_none());
        let form = captured.form.lock().await.clone().unwrap();
        assert_eq!(
            form.get("grant_type").map(String::as_str),
            Some("refresh_token")
        );
        assert_eq!(
            form.get("client_id").map(String::as_str),
            Some("public-client")
        );
        assert_eq!(
            form.get("scope").map(String::as_str),
            Some("openid profile offline_access")
        );
    }
}
