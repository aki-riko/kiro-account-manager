use super::{
    discover_oidc, normalize_external_idp_scopes, AuthResult, ExternalIdpAuthConfig,
    OidcDiscoveryDocument, PortalCallbackData,
};
use crate::clients::http_client::build_http_client_with_timeout;
use serde::Deserialize;
use url::Url;

#[derive(Debug, Clone)]
pub struct ExternalIdpAuthorizationContext {
    pub authorization_url: String,
    pub issuer_url: String,
    pub discovered_issuer: Option<String>,
    pub token_endpoint: String,
    pub client_id: String,
    pub scopes: String,
    pub audience: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AuthorizationTokenResponse {
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

pub async fn begin_external_idp_authorization(
    metadata: &PortalCallbackData,
    redirect_uri: &str,
    state: &str,
    code_challenge: &str,
) -> Result<ExternalIdpAuthorizationContext, String> {
    let discovery = discover_oidc(&metadata.issuer_url, None).await?;
    build_authorization_context(metadata, discovery, redirect_uri, state, code_challenge)
}

fn build_authorization_context(
    metadata: &PortalCallbackData,
    discovery: OidcDiscoveryDocument,
    redirect_uri: &str,
    state: &str,
    code_challenge: &str,
) -> Result<ExternalIdpAuthorizationContext, String> {
    let scopes = normalize_external_idp_scopes(&metadata.scopes);
    let mut authorization_url = Url::parse(&discovery.authorization_endpoint)
        .map_err(|_| "OIDC authorization_endpoint 不是有效 URL".to_string())?;
    authorization_url
        .query_pairs_mut()
        .append_pair("client_id", &metadata.client_id)
        .append_pair("response_type", "code")
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("scope", &scopes)
        .append_pair("code_challenge", code_challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("response_mode", "query")
        .append_pair("state", state);
    if let Some(login_hint) = metadata.login_hint.as_deref() {
        authorization_url
            .query_pairs_mut()
            .append_pair("login_hint", login_hint);
    }

    Ok(ExternalIdpAuthorizationContext {
        authorization_url: authorization_url.to_string(),
        issuer_url: metadata.issuer_url.clone(),
        discovered_issuer: discovery.issuer,
        token_endpoint: discovery.token_endpoint,
        client_id: metadata.client_id.clone(),
        scopes,
        audience: metadata.audience.clone(),
    })
}

pub async fn exchange_external_idp_authorization_code(
    context: &ExternalIdpAuthorizationContext,
    code: &str,
    code_verifier: &str,
    redirect_uri: &str,
    callback_issuer: Option<&str>,
) -> Result<AuthResult, String> {
    validate_callback_issuer(context, callback_issuer)?;
    if code.trim().is_empty() {
        return Err("External IdP 回调缺少授权码".to_string());
    }
    if code_verifier.trim().is_empty() {
        return Err("External IdP PKCE verifier 为空".to_string());
    }

    let config = ExternalIdpAuthConfig::load()?;
    let client = build_http_client_with_timeout(
        config.http_timeout_seconds,
        config.connect_timeout_seconds,
    )?;
    let form = [
        ("client_id", context.client_id.as_str()),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect_uri),
        ("code", code),
        ("code_verifier", code_verifier),
    ];
    let response = client
        .post(&context.token_endpoint)
        .header("Accept", "application/json")
        .form(&form)
        .send()
        .await
        .map_err(|error| format!("External IdP code exchange 请求失败: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        let oauth_error = response.json::<OAuthErrorResponse>().await.ok();
        let detail = oauth_error
            .and_then(|body| body.error_description.or(body.error))
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "身份提供商拒绝了授权码交换".to_string());
        return Err(format!(
            "External IdP code exchange 失败（HTTP {}）: {}",
            status.as_u16(),
            detail
        ));
    }

    let token = response
        .json::<AuthorizationTokenResponse>()
        .await
        .map_err(|error| format!("External IdP code exchange 响应解析失败: {error}"))?;
    if token.access_token.trim().is_empty() {
        return Err("External IdP code exchange 响应缺少 access_token".to_string());
    }
    let refresh_token = token
        .refresh_token
        .filter(|value| !value.trim().is_empty())
        .ok_or("External IdP code exchange 响应缺少 refresh_token")?;
    let expires_in = token
        .expires_in
        .filter(|seconds| *seconds > 0)
        .unwrap_or(config.default_token_lifetime_seconds);
    let expires_at = chrono::Local::now() + chrono::Duration::seconds(expires_in);

    Ok(AuthResult {
        machine_id: super::derive_external_idp_machine_id(&token.access_token),
        access_token: token.access_token,
        refresh_token,
        expires_at: expires_at.format("%Y/%m/%d %H:%M:%S").to_string(),
        expires_in,
        provider: "ExternalIdp".to_string(),
        auth_method: "external_idp".to_string(),
        token_type: token.token_type.or_else(|| Some("Bearer".to_string())),
        id_token: token.id_token,
        region: None,
        client_id: Some(context.client_id.clone()),
        client_secret: None,
        client_id_hash: None,
        sso_session_id: None,
        start_url: None,
        token_endpoint: Some(context.token_endpoint.clone()),
        issuer_url: Some(context.issuer_url.clone()),
        scopes: Some(context.scopes.clone()),
        audience: context.audience.clone(),
        profile_arn: None,
        profile_name: None,
    })
}

fn validate_callback_issuer(
    context: &ExternalIdpAuthorizationContext,
    callback_issuer: Option<&str>,
) -> Result<(), String> {
    let Some(callback_issuer) = callback_issuer else {
        return Ok(());
    };
    let expected = context
        .discovered_issuer
        .as_deref()
        .unwrap_or(&context.issuer_url);
    if normalize_issuer(expected) != normalize_issuer(callback_issuer) {
        return Err("External IdP 回调 iss 与 OIDC issuer 不匹配".to_string());
    }
    Ok(())
}

fn normalize_issuer(value: &str) -> String {
    value.trim().trim_end_matches('/').to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::{
        build_authorization_context, exchange_external_idp_authorization_code,
        ExternalIdpAuthorizationContext,
    };
    use crate::auth::providers::{OidcDiscoveryDocument, PortalCallbackData};
    use axum::{
        extract::{Form, State},
        http::HeaderMap,
        routing::post,
        Json, Router,
    };
    use std::{collections::HashMap, sync::Arc};
    use tokio::sync::Mutex;

    #[test]
    fn authorization_url_matches_official_external_idp_parameters() {
        let metadata = PortalCallbackData {
            issuer_url: "https://login.example.test/tenant/v2.0".to_string(),
            client_id: "public-client".to_string(),
            scopes: "openid profile".to_string(),
            login_hint: Some("azure@example.com".to_string()),
            audience: Some("stored-but-not-sent".to_string()),
        };
        let context = build_authorization_context(
            &metadata,
            OidcDiscoveryDocument {
                issuer: Some(metadata.issuer_url.clone()),
                authorization_endpoint: "https://login.example.test/authorize".to_string(),
                token_endpoint: "https://login.example.test/token".to_string(),
            },
            "kiro://kiro.oauth/callback",
            "state-value",
            "challenge-value",
        )
        .unwrap();
        let parsed = url::Url::parse(&context.authorization_url).unwrap();
        let params: HashMap<_, _> = parsed.query_pairs().into_owned().collect();

        assert_eq!(
            params.get("client_id").map(String::as_str),
            Some("public-client")
        );
        assert_eq!(
            params.get("response_type").map(String::as_str),
            Some("code")
        );
        assert_eq!(
            params.get("scope").map(String::as_str),
            Some("openid profile offline_access")
        );
        assert_eq!(
            params.get("login_hint").map(String::as_str),
            Some("azure@example.com")
        );
        assert!(!params.contains_key("audience"));
        assert!(!params.contains_key("prompt"));
        assert!(!params.contains_key("client_secret"));
        assert_eq!(context.audience.as_deref(), Some("stored-but-not-sent"));
    }

    #[derive(Clone, Default)]
    struct CapturedExchange {
        headers: Arc<Mutex<Option<HeaderMap>>>,
        form: Arc<Mutex<Option<HashMap<String, String>>>>,
    }

    async fn exchange_handler(
        State(captured): State<CapturedExchange>,
        headers: HeaderMap,
        Form(form): Form<HashMap<String, String>>,
    ) -> Json<serde_json::Value> {
        *captured.headers.lock().await = Some(headers);
        *captured.form.lock().await = Some(form);
        Json(serde_json::json!({
            "access_token": "header.eyJvaWQiOiJhenVyZS1vaWQifQ.signature",
            "refresh_token": "azure-refresh-token",
            "expires_in": 3600,
            "token_type": "Bearer"
        }))
    }

    #[tokio::test]
    async fn code_exchange_uses_public_client_form_without_extra_fields() {
        let captured = CapturedExchange::default();
        let app = Router::new()
            .route("/token", post(exchange_handler))
            .with_state(captured.clone());
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        let context = ExternalIdpAuthorizationContext {
            authorization_url: "https://login.example.test/authorize".to_string(),
            issuer_url: "https://login.example.test/tenant/v2.0".to_string(),
            discovered_issuer: Some("https://login.example.test/tenant/v2.0".to_string()),
            token_endpoint: format!("http://{address}/token"),
            client_id: "public-client".to_string(),
            scopes: "openid offline_access".to_string(),
            audience: Some("stored-only".to_string()),
        };

        let result = exchange_external_idp_authorization_code(
            &context,
            "authorization-code",
            "pkce-verifier",
            "kiro://kiro.oauth/callback",
            Some("https://login.example.test/tenant/v2.0"),
        )
        .await
        .unwrap();

        assert_eq!(result.refresh_token, "azure-refresh-token");
        assert_eq!(result.audience.as_deref(), Some("stored-only"));
        let headers = captured.headers.lock().await.clone().unwrap();
        assert!(headers.get("TokenType").is_none());
        let form = captured.form.lock().await.clone().unwrap();
        assert_eq!(
            form.get("grant_type").map(String::as_str),
            Some("authorization_code")
        );
        assert_eq!(
            form.get("code").map(String::as_str),
            Some("authorization-code")
        );
        assert_eq!(
            form.get("code_verifier").map(String::as_str),
            Some("pkce-verifier")
        );
        assert!(!form.contains_key("client_secret"));
        assert!(!form.contains_key("scope"));
        assert!(!form.contains_key("audience"));
    }
}
