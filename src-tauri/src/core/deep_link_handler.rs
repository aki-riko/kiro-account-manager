// Deep Link 回调处理
// 处理 kiro-account-manager://kiro.kiroAgent/authenticate-success?code=xxx&state=xxx 格式的 OAuth 回调

use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

const DEEP_LINK_SCHEME: &str = "kiro";
const SOCIAL_CALLBACK_AUTHORITY: &str = "kiro.kiroAgent";
const SOCIAL_CALLBACK_PATH: &str = "/authenticate-success";
const EXTERNAL_IDP_CALLBACK_AUTHORITY: &str = "kiro.oauth";
const EXTERNAL_IDP_CALLBACK_PATH: &str = "/callback";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CallbackRoute {
    Social,
    ExternalIdp,
}

impl CallbackRoute {
    fn authority(self) -> &'static str {
        match self {
            Self::Social => SOCIAL_CALLBACK_AUTHORITY,
            Self::ExternalIdp => EXTERNAL_IDP_CALLBACK_AUTHORITY,
        }
    }

    fn path(self) -> &'static str {
        match self {
            Self::Social => SOCIAL_CALLBACK_PATH,
            Self::ExternalIdp => EXTERNAL_IDP_CALLBACK_PATH,
        }
    }

    fn matches(self, url: &url::Url) -> bool {
        url.host_str()
            .is_some_and(|authority| authority.eq_ignore_ascii_case(self.authority()))
            && url.path() == self.path()
    }

    fn from_url(url: &url::Url) -> Option<Self> {
        [Self::Social, Self::ExternalIdp]
            .into_iter()
            .find(|route| route.matches(url))
    }
}

/// OAuth 回调结果（state 已在 `handle_deep_link` 中验证）
#[derive(Debug, Clone)]
pub struct OAuthCallbackResult {
    pub code: String,
    pub iss: Option<String>,
}

/// 回调结果类型别名
type CallbackResult = Result<OAuthCallbackResult, String>;
/// 回调接收器类型别名
type CallbackReceiver = Arc<Mutex<Option<Receiver<CallbackResult>>>>;
/// 待处理发送器类型别名
type PendingSender = Mutex<Option<(CallbackRoute, String, Sender<CallbackResult>)>>;

/// Deep Link OAuth 回调等待器
pub struct DeepLinkCallbackWaiter {
    result_rx: CallbackReceiver,
    timeout: Duration,
}

impl DeepLinkCallbackWaiter {
    /// 获取 `redirect_uri` (根据环境自动选择协议)
    pub fn get_redirect_uri() -> String {
        Self::get_redirect_uri_for(CallbackRoute::Social)
    }

    pub fn get_redirect_uri_for(route: CallbackRoute) -> String {
        format!(
            "{}://{}{}",
            DEEP_LINK_SCHEME,
            route.authority(),
            route.path()
        )
    }

    /// 获取当前环境的协议名称
    pub fn get_protocol_scheme() -> &'static str {
        DEEP_LINK_SCHEME
    }

    /// 等待回调结果
    pub fn wait_for_callback(&self) -> Result<OAuthCallbackResult, String> {
        let rx = self
            .result_rx
            .lock()
            .expect("Failed to acquire result_rx lock")
            .take()
            .ok_or("Callback channel already consumed")?;

        match rx.recv_timeout(self.timeout) {
            Ok(result) => result,
            Err(_) => Err("OAuth callback timeout (5 minutes)".to_string()),
        }
    }
}
/// 全局回调发送器存储
static PENDING_SENDER: std::sync::OnceLock<PendingSender> = std::sync::OnceLock::new();

/// 初始化 deep link 处理器（应用启动时调用）
pub fn init() {
    PENDING_SENDER.get_or_init(|| Mutex::new(None));
}

/// 注册一个新的回调等待器，返回接收端
pub fn register_waiter(route: CallbackRoute, state: &str) -> DeepLinkCallbackWaiter {
    register_waiter_with_timeout(route, state, Duration::from_secs(300))
}

pub fn register_waiter_with_timeout(
    route: CallbackRoute,
    state: &str,
    timeout: Duration,
) -> DeepLinkCallbackWaiter {
    let (tx, rx) = mpsc::channel();

    // 存储发送端
    let storage = PENDING_SENDER.get_or_init(|| Mutex::new(None));
    let mut guard = storage
        .lock()
        .expect("Failed to acquire pending sender lock");
    if let Some((_route, _state, previous_tx)) = guard.take() {
        let _ = previous_tx.send(Err("登录已取消".to_string()));
    }
    *guard = Some((route, state.to_string(), tx));

    DeepLinkCallbackWaiter {
        result_rx: Arc::new(Mutex::new(Some(rx))),
        timeout,
    }
}
/// 取消当前等待中的 deep link 登录
pub fn cancel_waiter() -> bool {
    let Some(storage) = PENDING_SENDER.get() else {
        return false;
    };

    let mut guard = storage
        .lock()
        .expect("Failed to acquire pending sender lock");
    let Some((_route, _state, tx)) = guard.take() else {
        return false;
    };
    let _ = tx.send(Err("登录已取消".to_string()));
    true
}

/// 将 deep link 中的 `/app/callback` 映射到应用内的 `/callback`
pub fn get_app_callback_route(url: &str) -> Option<String> {
    let parsed = url::Url::parse(url).ok()?;

    if parsed.scheme() != DeepLinkCallbackWaiter::get_protocol_scheme() {
        return None;
    }

    if parsed.path() != "/app/callback" {
        return None;
    }

    let mut route = "/callback".to_string();
    if let Some(query) = parsed.query() {
        route.push('?');
        route.push_str(query);
    }

    Some(route)
}
/// 处理 deep link URL（由 main.rs 调用）
/// 返回 (是否处理成功, 是否需要导航到 /callback)
pub fn handle_deep_link(url: &str) -> (bool, bool) {
    let parsed = match url::Url::parse(url) {
        Ok(parsed) => parsed,
        Err(error) => {
            log::warn!("[deep_link] Invalid callback URL: {error}");
            return (false, false);
        }
    };

    log::info!(
        "[deep_link] Received callback route: authority={}, path={}",
        parsed.host_str().unwrap_or(""),
        parsed.path()
    );

    if parsed.scheme() != DeepLinkCallbackWaiter::get_protocol_scheme() {
        return (false, false);
    }
    let Some(callback_route) = CallbackRoute::from_url(&parsed) else {
        return (false, false);
    };

    let Some(storage) = PENDING_SENDER.get() else {
        log::warn!("[deep_link] PENDING_SENDER not initialized");
        return (false, false);
    };

    let mut guard = storage
        .lock()
        .expect("Failed to acquire pending sender lock");
    let Some((expected_route, _, _)) = guard.as_ref() else {
        log::warn!("[deep_link] No pending login waiter");
        return (false, false);
    };
    if *expected_route != callback_route {
        log::debug!("[deep_link] Callback route does not match pending login");
        return (false, false);
    }
    let Some((_expected_route, expected_state, tx)) = guard.take() else {
        return (false, false);
    };

    log::info!("[deep_link] Processing matched OAuth callback");

    // 提取参数
    let params: std::collections::HashMap<_, _> = parsed.query_pairs().collect();

    // 检查错误
    if let Some(error) = params.get("error") {
        log::warn!("[deep_link] OAuth callback returned error={error}");
        let desc = params.get("error_description").map_or_else(
            || "Unknown error".to_string(),
            std::string::ToString::to_string,
        );
        let _ = tx.send(Err(format!("OAuth error: {error} - {desc}")));
        return (true, true); // 错误也需要导航到 /callback 显示错误
    }

    let Some(code) = params.get("code") else {
        log::warn!("[deep_link] OAuth callback missing code parameter");
        let _ = tx.send(Err("Missing code parameter".to_string()));
        return (true, true);
    };
    let code = code.to_string();

    let Some(state) = params.get("state") else {
        log::warn!("[deep_link] OAuth callback missing state parameter");
        let _ = tx.send(Err("Missing state parameter".to_string()));
        return (true, true);
    };
    let state = state.to_string();

    // 验证 state
    if state != expected_state {
        log::warn!("[deep_link] OAuth callback state mismatch");
        let _ = tx.send(Err("State mismatch - possible CSRF attack".to_string()));
        return (true, true);
    }

    let iss = params
        .get("iss")
        .map(std::string::ToString::to_string)
        .filter(|value| !value.trim().is_empty());
    let _ = tx.send(Ok(OAuthCallbackResult { code, iss }));
    (true, true) // 成功处理，需要导航到 /callback
}

#[cfg(test)]
mod tests {
    use super::{
        cancel_waiter, handle_deep_link, register_waiter, register_waiter_with_timeout,
        CallbackRoute, DeepLinkCallbackWaiter,
    };
    use std::sync::{Mutex, MutexGuard};
    use std::time::Duration;

    static DEEP_LINK_TEST_LOCK: Mutex<()> = Mutex::new(());

    fn lock_deep_link_test() -> MutexGuard<'static, ()> {
        let guard = DEEP_LINK_TEST_LOCK
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        cancel_waiter();
        guard
    }

    #[test]
    fn deep_link_scheme_matches_registered_tauri_scheme() {
        let config: serde_json::Value = serde_json::from_str(include_str!("../../tauri.conf.json"))
            .expect("tauri config should parse");
        let scheme = config["plugins"]["deep-link"]["desktop"]["schemes"][0]
            .as_str()
            .expect("deep-link scheme should exist");

        assert_eq!(DeepLinkCallbackWaiter::get_protocol_scheme(), scheme);
        assert!(
            DeepLinkCallbackWaiter::get_redirect_uri().starts_with(&format!("{scheme}://")),
            "redirect uri should use registered scheme"
        );
        assert!(
            DeepLinkCallbackWaiter::get_redirect_uri().contains("/authenticate-success"),
            "redirect uri should keep callback path for social/idc compatibility"
        );
        assert_eq!(
            DeepLinkCallbackWaiter::get_redirect_uri(),
            "kiro://kiro.kiroAgent/authenticate-success"
        );
        assert_eq!(
            DeepLinkCallbackWaiter::get_redirect_uri_for(CallbackRoute::ExternalIdp),
            "kiro://kiro.oauth/callback"
        );
    }

    #[test]
    fn registering_new_waiter_cancels_previous_waiter() {
        let _test_guard = lock_deep_link_test();
        let mut first = register_waiter(CallbackRoute::Social, "first-state");
        first.timeout = Duration::from_millis(20);
        let _second = register_waiter(CallbackRoute::ExternalIdp, "second-state");

        let result = first.wait_for_callback();

        assert!(matches!(result, Err(message) if message == "登录已取消"));
    }

    #[test]
    fn waiter_can_use_flow_specific_timeout() {
        let _test_guard = lock_deep_link_test();
        let waiter = register_waiter_with_timeout(
            CallbackRoute::ExternalIdp,
            "expected-state",
            Duration::from_secs(600),
        );

        assert_eq!(waiter.timeout, Duration::from_secs(600));
    }

    #[test]
    fn handle_deep_link_keeps_waiter_when_scheme_does_not_match() {
        let _test_guard = lock_deep_link_test();
        let waiter = register_waiter(CallbackRoute::Social, "expected-state");

        assert!(!handle_deep_link("wrong-scheme://callback?code=ok&state=expected-state").0);

        let handled = handle_deep_link(
            "kiro://kiro.kiroAgent/authenticate-success?code=ok&state=expected-state",
        );
        assert!(handled.0);
        assert!(handled.1);
        assert_eq!(
            waiter
                .wait_for_callback()
                .expect("callback should succeed")
                .code,
            "ok"
        );
    }

    #[test]
    fn handle_deep_link_keeps_waiter_when_callback_route_does_not_match() {
        let _test_guard = lock_deep_link_test();
        let waiter = register_waiter(CallbackRoute::ExternalIdp, "expected-state");

        assert!(
            !handle_deep_link(
                "kiro://kiro.kiroAgent/authenticate-success?code=social&state=expected-state"
            )
            .0
        );

        let handled = handle_deep_link(
            "kiro://kiro.oauth/callback?code=external&state=expected-state&iss=https%3A%2F%2Flogin.example.test%2Ftenant%2Fv2.0",
        );
        assert!(handled.0);
        let callback = waiter.wait_for_callback().unwrap();
        assert_eq!(callback.code, "external");
        assert_eq!(
            callback.iss.as_deref(),
            Some("https://login.example.test/tenant/v2.0")
        );
    }

    #[test]
    fn duplicate_callback_is_ignored_after_waiter_is_consumed() {
        let _test_guard = lock_deep_link_test();
        let waiter = register_waiter(CallbackRoute::Social, "expected-state");
        let callback = "kiro://kiro.kiroAgent/authenticate-success?code=ok&state=expected-state";

        assert!(handle_deep_link(callback).0);
        assert!(!handle_deep_link(callback).0);
        assert_eq!(waiter.wait_for_callback().unwrap().code, "ok");
    }
}
