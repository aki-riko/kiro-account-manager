//! AWS SSO OIDC Client
//! 实现 AWS SSO OIDC API 调用，用于 BuilderId/Enterprise 认证
//! 使用 Authorization Code Flow（跟 Kiro Desktop 一致）

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// 默认 scopes（跟 Kiro 一样）
pub const GRANT_SCOPES: &[&str] = &[
    "codewhisperer:completions",
    "codewhisperer:analysis",
    "codewhisperer:conversations",
    "codewhisperer:transformations",
    "codewhisperer:taskassist",
];

/// AWS SSO OIDC 客户端
pub struct AWSSSOClient {
    base_url: String,
    client: Client,
}

/// 客户端注册响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientRegistration {
    #[serde(rename = "clientId")]
    pub client_id: String,
    #[serde(rename = "clientSecret")]
    pub client_secret: String,
    #[serde(rename = "clientIdIssuedAt")]
    pub client_id_issued_at: Option<i64>,
    #[serde(rename = "clientSecretExpiresAt")]
    pub client_secret_expires_at: Option<i64>,
    #[serde(rename = "authorizationEndpoint")]
    pub authorization_endpoint: Option<String>,
    #[serde(rename = "tokenEndpoint")]
    pub token_endpoint: Option<String>,
}

/// Token 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenResponse {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "refreshToken")]
    pub refresh_token: String,
    #[serde(rename = "idToken")]
    pub id_token: Option<String>,
    #[serde(rename = "tokenType")]
    pub token_type: Option<String>,
    #[serde(rename = "expiresIn")]
    pub expires_in: i64,
    #[serde(rename = "aws_sso_app_session_id")]
    pub aws_sso_app_session_id: Option<String>,
    #[serde(rename = "issuedTokenType")]
    pub issued_token_type: Option<String>,
    #[serde(rename = "originSessionId")]
    pub origin_session_id: Option<String>,
}

impl AWSSSOClient {
    pub fn new(region: &str) -> Self {
        let base_url = format!("https://oidc.{}.amazonaws.com", region);
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            base_url,
            client,
        }
    }

    /// 获取 authorize URL
    pub fn get_authorize_url(&self) -> String {
        format!("{}/authorize", self.base_url)
    }

    /// 注册客户端（Authorization Code Flow，跟 Kiro 一样）
    pub async fn register_client(
        &self,
        issuer_url: &str,
        redirect_uri: &str,
    ) -> Result<ClientRegistration, String> {
        let url = format!("{}/client/register", self.base_url);
        
        let scopes: Vec<String> = GRANT_SCOPES.iter()
            .map(|s| s.to_string())
            .collect();
        
        let body = serde_json::json!({
            "clientName": "Kiro Account Manager",
            "clientType": "public",
            "scopes": scopes,
            "grantTypes": ["authorization_code", "refresh_token"],
            "redirectUris": [redirect_uri],
            "issuerUrl": issuer_url
        });

        #[cfg(debug_assertions)]
        println!("[AWS SSO] Register Client (Authorization Code Flow)");

        let resp = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Client registration failed: {}", e))?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(format!("Client registration failed ({}): {}", status, text));
        }

        #[cfg(debug_assertions)]
        println!("[AWS SSO] Client registered successfully");
        
        serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse client registration: {}", e))
    }

    /// 使用授权码交换 Token
    pub async fn create_token(
        &self,
        client_id: &str,
        client_secret: &str,
        code: &str,
        code_verifier: &str,
        redirect_uri: &str,
    ) -> Result<TokenResponse, String> {
        let url = format!("{}/token", self.base_url);

        let body = serde_json::json!({
            "clientId": client_id,
            "clientSecret": client_secret,
            "grantType": "authorization_code",
            "code": code,
            "codeVerifier": code_verifier,
            "redirectUri": redirect_uri
        });

        #[cfg(debug_assertions)]
        println!("[AWS SSO] Create Token with Authorization Code");

        let resp = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Token creation failed: {}", e))?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(format!("Token creation failed ({}): {}", status, text));
        }

        #[cfg(debug_assertions)]
        println!("[AWS SSO] Token created successfully");

        serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse token response: {}", e))
    }

    /// 刷新 Token
    pub async fn refresh_token(
        &self,
        client_id: &str,
        client_secret: &str,
        refresh_token: &str,
    ) -> Result<TokenResponse, String> {
        let url = format!("{}/token", self.base_url);

        let body = serde_json::json!({
            "clientId": client_id,
            "clientSecret": client_secret,
            "grantType": "refresh_token",
            "refreshToken": refresh_token
        });

        #[cfg(debug_assertions)]
        println!("[AWS SSO] Refresh Token");

        let resp = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Token refresh request failed: {}", e))?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            if status.as_u16() == 401 {
                return Err("RefreshToken 已过期或无效".to_string());
            }
            return Err(format!("Token refresh failed ({}): {}", status, text));
        }

        #[cfg(debug_assertions)]
        println!("[AWS SSO] Token refreshed successfully");

        serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse token response: {}", e))
    }
}
