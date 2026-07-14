use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};
use tiny_http::{Header, Request, Response, Server, StatusCode};
use url::Url;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalIdpAuthConfig {
    pub portal_base_url: String,
    pub portal_url_env: String,
    pub signin_path: String,
    pub redirect_from: String,
    pub callback_bind_host: String,
    pub callback_url_host: String,
    pub callback_ports: Vec<u16>,
    pub callback_paths: Vec<String>,
    pub external_redirect_uri: String,
    pub profile_regions: Vec<String>,
    pub flow_timeout_seconds: u64,
    pub poll_interval_millis: u64,
    pub http_timeout_seconds: u64,
    pub connect_timeout_seconds: u64,
    pub default_token_lifetime_seconds: i64,
}

impl ExternalIdpAuthConfig {
    pub fn load() -> Result<Self, String> {
        let mut config = Self::load_bundled()?;
        if let Ok(override_url) = std::env::var(&config.portal_url_env) {
            let override_url = override_url.trim();
            if !override_url.is_empty() {
                config.portal_base_url = override_url.to_string();
            }
        }
        config.validate()?;
        Ok(config)
    }

    fn load_bundled() -> Result<Self, String> {
        serde_json::from_str(include_str!("../../../config/external-idp.json"))
            .map_err(|error| format!("External IdP 配置解析失败: {error}"))
    }

    fn validate(&self) -> Result<(), String> {
        let portal = Url::parse(&self.portal_base_url)
            .map_err(|_| "External IdP portalBaseUrl 不是有效 URL".to_string())?;
        if portal.scheme() != "https" && !is_loopback_http(&portal) {
            return Err("External IdP portalBaseUrl 必须使用 HTTPS".to_string());
        }
        if self.callback_bind_host.trim().is_empty()
            || self.callback_url_host.trim().is_empty()
            || self.callback_ports.is_empty()
            || self.callback_paths.is_empty()
            || self.profile_regions.is_empty()
            || self.portal_url_env.trim().is_empty()
            || self.redirect_from.trim().is_empty()
            || self.flow_timeout_seconds == 0
            || self.poll_interval_millis == 0
            || self.http_timeout_seconds == 0
            || self.connect_timeout_seconds == 0
            || self.default_token_lifetime_seconds <= 0
        {
            return Err("External IdP 本地回调配置不完整".to_string());
        }
        if !self.signin_path.starts_with('/') {
            return Err("External IdP signinPath 必须是绝对路径".to_string());
        }
        if !is_loopback_callback_host(&self.callback_bind_host)
            || !is_loopback_callback_host(&self.callback_url_host)
        {
            return Err("External IdP 本地回调只能使用 IPv4 回环地址".to_string());
        }
        if self.callback_ports.contains(&0) {
            return Err("External IdP callbackPorts 不能包含 0".to_string());
        }
        if self
            .profile_regions
            .iter()
            .any(|region| !crate::clients::http_client::is_supported_kiro_region(region))
        {
            return Err("External IdP profileRegions 包含不支持的 region".to_string());
        }
        if self
            .callback_paths
            .iter()
            .any(|path| !path.starts_with('/'))
        {
            return Err("External IdP callbackPaths 必须是绝对路径".to_string());
        }
        let redirect = Url::parse(&self.external_redirect_uri)
            .map_err(|_| "External IdP externalRedirectUri 不是有效 URL".to_string())?;
        if redirect.scheme() != "kiro"
            || redirect.host_str() != Some("kiro.oauth")
            || redirect.path() != "/callback"
        {
            return Err("External IdP externalRedirectUri 与官方回调不一致".to_string());
        }
        Ok(())
    }

    pub fn ordered_profile_regions(&self, preferred_region: Option<&str>) -> Vec<String> {
        let mut regions = Vec::new();
        if let Some(region) = preferred_region
            .map(str::trim)
            .filter(|region| crate::clients::http_client::is_supported_kiro_region(region))
        {
            regions.push(region.to_string());
        }
        for region in &self.profile_regions {
            if !regions.iter().any(|existing| existing == region) {
                regions.push(region.clone());
            }
        }
        regions
    }

    pub fn portal_signin_url(
        &self,
        state: &str,
        code_challenge: &str,
        redirect_uri: &str,
    ) -> Result<String, String> {
        let mut url = Url::parse(&self.portal_base_url)
            .map_err(|_| "External IdP portalBaseUrl 不是有效 URL".to_string())?;
        url.set_path(&self.signin_path);
        url.set_query(None);
        url.query_pairs_mut()
            .append_pair("state", state)
            .append_pair("code_challenge", code_challenge)
            .append_pair("code_challenge_method", "S256")
            .append_pair("redirect_uri", redirect_uri)
            .append_pair("redirect_from", &self.redirect_from);
        Ok(url.to_string())
    }

    fn portal_status_url(
        &self,
        status: &str,
        error_message: Option<&str>,
    ) -> Result<String, String> {
        let mut url = Url::parse(&self.portal_base_url)
            .map_err(|_| "External IdP portalBaseUrl 不是有效 URL".to_string())?;
        url.set_path(&self.signin_path);
        url.set_query(None);
        let mut query = url.query_pairs_mut();
        query
            .append_pair("auth_status", status)
            .append_pair("redirect_from", &self.redirect_from);
        if let Some(message) = error_message {
            query.append_pair("error_message", message);
        }
        drop(query);
        Ok(url.to_string())
    }
}

fn is_loopback_http(url: &Url) -> bool {
    url.scheme() == "http"
        && url.host_str().is_some_and(|host| {
            host == "localhost"
                || host
                    .parse::<std::net::IpAddr>()
                    .is_ok_and(|ip| ip.is_loopback())
        })
}

fn is_loopback_callback_host(host: &str) -> bool {
    let host = host.trim();
    host.eq_ignore_ascii_case("localhost")
        || host
            .parse::<std::net::Ipv4Addr>()
            .is_ok_and(|ip| ip.is_loopback())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PortalCallbackData {
    pub issuer_url: String,
    pub client_id: String,
    pub scopes: String,
    pub login_hint: Option<String>,
    pub audience: Option<String>,
}

pub struct PortalAuthServer {
    server: Arc<Server>,
    config: ExternalIdpAuthConfig,
    redirect_uri: String,
}

impl PortalAuthServer {
    pub fn start(config: ExternalIdpAuthConfig) -> Result<Self, String> {
        let mut last_error = None;
        for port in &config.callback_ports {
            let bind_address = format!("{}:{port}", config.callback_bind_host);
            match Server::http(&bind_address) {
                Ok(server) => {
                    let redirect_uri = format!("http://{}:{port}", config.callback_url_host.trim());
                    return Ok(Self {
                        server: Arc::new(server),
                        config,
                        redirect_uri,
                    });
                }
                Err(error) => last_error = Some(error.to_string()),
            }
        }
        Err(format!(
            "无法启动 External IdP 门户回调服务器: {}",
            last_error.unwrap_or_else(|| "没有可用端口".to_string())
        ))
    }

    pub fn redirect_uri(&self) -> &str {
        &self.redirect_uri
    }

    pub fn wait_for_callback(
        &self,
        expected_state: &str,
        cancelled: &AtomicBool,
    ) -> Result<PortalCallbackData, String> {
        let timeout = Duration::from_secs(self.config.flow_timeout_seconds);
        let poll_interval = Duration::from_millis(self.config.poll_interval_millis);
        let started_at = Instant::now();

        loop {
            if cancelled.load(Ordering::SeqCst) {
                return Err("登录已取消".to_string());
            }
            if started_at.elapsed() > timeout {
                return Err("External IdP 门户授权超时".to_string());
            }

            match self.server.try_recv() {
                Ok(Some(request)) => {
                    if let Some(result) = self.handle_request(request, expected_state) {
                        return result;
                    }
                }
                Ok(None) => std::thread::sleep(poll_interval),
                Err(error) => {
                    return Err(format!("External IdP 门户回调读取失败: {error}"));
                }
            }
        }
    }

    fn handle_request(
        &self,
        request: Request,
        expected_state: &str,
    ) -> Option<Result<PortalCallbackData, String>> {
        let parsed =
            match parse_portal_callback(request.url(), expected_state, &self.config.callback_paths)
            {
                Ok(Some(data)) => {
                    let location = self.config.portal_status_url("success", None).ok()?;
                    respond_redirect(request, &location);
                    return Some(Ok(data));
                }
                Ok(None) => {
                    let response =
                        Response::from_string("Not Found").with_status_code(StatusCode(404));
                    let _ = request.respond(response);
                    return None;
                }
                Err(error) => error,
            };

        let location = self
            .config
            .portal_status_url("error", Some(&parsed))
            .unwrap_or_else(|_| self.config.portal_base_url.clone());
        respond_redirect(request, &location);
        Some(Err(parsed))
    }
}

fn respond_redirect(request: Request, location: &str) {
    let response = Response::empty(StatusCode(302)).with_header(
        Header::from_bytes("Location", location).expect("Location header should be valid"),
    );
    let _ = request.respond(response);
}

pub fn parse_portal_callback(
    request_url: &str,
    expected_state: &str,
    callback_paths: &[String],
) -> Result<Option<PortalCallbackData>, String> {
    let parsed = Url::parse(&format!("http://localhost{request_url}"))
        .map_err(|_| "External IdP 门户回调 URL 无效".to_string())?;
    if !callback_paths.iter().any(|path| path == parsed.path()) {
        return Ok(None);
    }

    let params: std::collections::HashMap<_, _> = parsed.query_pairs().into_owned().collect();
    if let Some(error) = params.get("error") {
        let description = params
            .get("error_description")
            .map(String::as_str)
            .unwrap_or(error);
        return Err(format!("External IdP 门户拒绝登录: {description}"));
    }
    let state = params
        .get("state")
        .ok_or("External IdP 门户回调缺少 state")?;
    if state != expected_state {
        return Err("External IdP 门户回调 state 不匹配".to_string());
    }
    if params.get("login_option").map(String::as_str) != Some("external_idp") {
        return Err("External IdP 门户返回了非 external_idp 登录类型".to_string());
    }

    Ok(Some(PortalCallbackData {
        issuer_url: required_param(&params, "issuer_url")?,
        client_id: required_param(&params, "client_id")?,
        scopes: required_param(&params, "scopes")?,
        login_hint: optional_param(&params, "login_hint"),
        audience: optional_param(&params, "audience"),
    }))
}

fn required_param(
    params: &std::collections::HashMap<String, String>,
    name: &str,
) -> Result<String, String> {
    optional_param(params, name).ok_or_else(|| format!("External IdP 门户回调缺少 {name}"))
}

fn optional_param(
    params: &std::collections::HashMap<String, String>,
    name: &str,
) -> Option<String> {
    params
        .get(name)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

struct PendingPortalLogin {
    cancelled: Arc<AtomicBool>,
}

static PENDING_PORTAL_LOGIN: OnceLock<Mutex<Option<PendingPortalLogin>>> = OnceLock::new();

pub fn register_pending_portal_login(cancelled: Arc<AtomicBool>) -> PendingPortalLoginGuard {
    let storage = PENDING_PORTAL_LOGIN.get_or_init(|| Mutex::new(None));
    let mut guard = storage
        .lock()
        .expect("Failed to acquire External IdP portal login lock");
    if let Some(previous) = guard.take() {
        previous.cancelled.store(true, Ordering::SeqCst);
    }
    *guard = Some(PendingPortalLogin {
        cancelled: cancelled.clone(),
    });
    PendingPortalLoginGuard { cancelled }
}

pub fn cancel_pending_portal_login() -> bool {
    let Some(storage) = PENDING_PORTAL_LOGIN.get() else {
        return false;
    };
    let mut guard = storage
        .lock()
        .expect("Failed to acquire External IdP portal login lock");
    let Some(pending) = guard.take() else {
        return false;
    };
    pending.cancelled.store(true, Ordering::SeqCst);
    true
}

pub struct PendingPortalLoginGuard {
    cancelled: Arc<AtomicBool>,
}

impl Drop for PendingPortalLoginGuard {
    fn drop(&mut self) {
        if let Some(storage) = PENDING_PORTAL_LOGIN.get() {
            let mut guard = storage
                .lock()
                .expect("Failed to acquire External IdP portal login lock");
            if guard
                .as_ref()
                .is_some_and(|pending| Arc::ptr_eq(&pending.cancelled, &self.cancelled))
            {
                guard.take();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        cancel_pending_portal_login, parse_portal_callback, register_pending_portal_login,
        ExternalIdpAuthConfig,
    };
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    #[test]
    fn bundled_config_matches_official_kiro_portal_contract() {
        let config = ExternalIdpAuthConfig::load_bundled().unwrap();
        assert_eq!(config.portal_base_url, "https://app.kiro.dev");
        assert_eq!(
            config.callback_ports,
            vec![3128, 4649, 6588, 8008, 9091, 49153, 50153, 51153, 52153, 53153]
        );
        assert_eq!(
            config.callback_paths,
            vec!["/oauth/callback", "/signin/callback"]
        );
        assert_eq!(config.external_redirect_uri, "kiro://kiro.oauth/callback");
        assert_eq!(config.profile_regions, vec!["us-east-1", "eu-central-1"]);
    }

    #[test]
    fn portal_url_uses_official_query_contract() {
        let config = ExternalIdpAuthConfig::load().unwrap();
        let url = config
            .portal_signin_url("state-value", "challenge-value", "http://localhost:3128")
            .unwrap();
        let parsed = url::Url::parse(&url).unwrap();
        let params: std::collections::HashMap<_, _> = parsed.query_pairs().into_owned().collect();

        assert_eq!(parsed.path(), "/signin");
        assert_eq!(params.get("state").map(String::as_str), Some("state-value"));
        assert_eq!(
            params.get("code_challenge").map(String::as_str),
            Some("challenge-value")
        );
        assert_eq!(
            params.get("code_challenge_method").map(String::as_str),
            Some("S256")
        );
        assert_eq!(
            params.get("redirect_uri").map(String::as_str),
            Some("http://localhost:3128")
        );
        assert_eq!(
            params.get("redirect_from").map(String::as_str),
            Some("KiroIDE")
        );
    }

    #[test]
    fn config_rejects_non_loopback_callback_binding() {
        let mut config = ExternalIdpAuthConfig::load_bundled().unwrap();
        config.callback_bind_host = "0.0.0.0".to_string();

        assert!(config.validate().is_err());
    }

    #[test]
    fn profile_regions_prefer_account_region_and_deduplicate() {
        let config = ExternalIdpAuthConfig::load_bundled().unwrap();

        assert_eq!(
            config.ordered_profile_regions(Some("eu-central-1")),
            vec!["eu-central-1", "us-east-1"]
        );
    }

    #[test]
    fn portal_callback_requires_external_idp_and_exact_state() {
        let paths = vec![
            "/oauth/callback".to_string(),
            "/signin/callback".to_string(),
        ];
        let parsed = parse_portal_callback(
            "/oauth/callback?login_option=external_idp&state=expected&issuer_url=https%3A%2F%2Flogin.example.test%2Ftenant%2Fv2.0&client_id=client&scopes=openid%20profile&login_hint=user%40example.com&audience=api",
            "expected",
            &paths,
        )
        .unwrap()
        .unwrap();

        assert_eq!(parsed.client_id, "client");
        assert_eq!(parsed.login_hint.as_deref(), Some("user@example.com"));
        assert_eq!(parsed.audience.as_deref(), Some("api"));
        assert!(parse_portal_callback(
            "/signin/callback?login_option=google&state=expected",
            "expected",
            &paths,
        )
        .is_err());
        assert!(parse_portal_callback(
            "/signin/callback?login_option=external_idp&state=wrong&issuer_url=x&client_id=x&scopes=x",
            "expected",
            &paths,
        )
        .is_err());
    }

    #[test]
    fn stale_portal_guard_does_not_clear_replacement_login() {
        cancel_pending_portal_login();
        let first_cancelled = Arc::new(AtomicBool::new(false));
        let first_guard = register_pending_portal_login(first_cancelled.clone());
        let second_cancelled = Arc::new(AtomicBool::new(false));
        let second_guard = register_pending_portal_login(second_cancelled.clone());

        assert!(first_cancelled.load(Ordering::SeqCst));
        drop(first_guard);
        assert!(cancel_pending_portal_login());
        assert!(second_cancelled.load(Ordering::SeqCst));

        drop(second_guard);
    }
}
