use super::{
    begin_external_idp_authorization, exchange_external_idp_authorization_code,
    register_pending_portal_login, AuthResult, ExternalIdpAuthConfig, PortalAuthServer,
};
use crate::auth::auth_social::{generate_code_challenge_social, generate_code_verifier_social};
use crate::clients::kiro_client::{KiroClient, KiroProfile};
use crate::core::deep_link_handler::{
    register_waiter_with_timeout, CallbackRoute, DeepLinkCallbackWaiter,
};
use crate::core::protocol_registry;
use crate::utils::browser::open_browser;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Duration;

pub struct ExternalIdpAuthSession {
    pub auth_result: AuthResult,
    pub profiles: Vec<KiroProfile>,
    pub selection_timeout_seconds: u64,
}

pub async fn authenticate_external_idp() -> Result<ExternalIdpAuthSession, String> {
    let config = ExternalIdpAuthConfig::load()?;
    let portal_state = uuid::Uuid::new_v4().to_string();
    let portal_code_verifier = generate_code_verifier_social();
    let portal_code_challenge = generate_code_challenge_social(&portal_code_verifier);
    let portal_server = PortalAuthServer::start(config.clone())?;
    let cancelled = Arc::new(AtomicBool::new(false));
    let _portal_guard = register_pending_portal_login(cancelled.clone());
    let portal_url = config.portal_signin_url(
        &portal_state,
        &portal_code_challenge,
        portal_server.redirect_uri(),
    )?;

    open_browser(&portal_url)?;
    let portal_callback = tokio::task::spawn_blocking(move || {
        portal_server.wait_for_callback(&portal_state, &cancelled)
    })
    .await
    .map_err(|error| format!("External IdP 门户回调任务失败: {error}"))??;

    protocol_registry::ensure_protocol_registration()?;
    let oidc_state = uuid::Uuid::new_v4().to_string();
    let oidc_code_verifier = generate_code_verifier_social();
    let oidc_code_challenge = generate_code_challenge_social(&oidc_code_verifier);
    let redirect_uri = DeepLinkCallbackWaiter::get_redirect_uri_for(CallbackRoute::ExternalIdp);
    if redirect_uri != config.external_redirect_uri {
        return Err("External IdP deep-link 配置与运行时路由不一致".to_string());
    }
    let authorization = begin_external_idp_authorization(
        &portal_callback,
        &redirect_uri,
        &oidc_state,
        &oidc_code_challenge,
    )
    .await?;
    let waiter = register_waiter_with_timeout(
        CallbackRoute::ExternalIdp,
        &oidc_state,
        Duration::from_secs(config.flow_timeout_seconds),
    );
    if let Err(error) = open_browser(&authorization.authorization_url) {
        crate::core::deep_link_handler::cancel_waiter();
        return Err(error);
    }
    let callback = tokio::task::spawn_blocking(move || waiter.wait_for_callback())
        .await
        .map_err(|error| format!("External IdP deep-link 回调任务失败: {error}"))??;

    let result = exchange_external_idp_authorization_code(
        &authorization,
        &callback.code,
        &oidc_code_verifier,
        &redirect_uri,
        callback.iss.as_deref(),
    )
    .await?;
    let profiles = KiroClient::new()?
        .discover_available_profiles(
            &result.access_token,
            Some(&result.auth_method),
            &config.ordered_profile_regions(result.region.as_deref()),
        )
        .await?;
    if profiles.is_empty() {
        return Err("External IdP 登录后未返回可用 profile".to_string());
    }
    Ok(ExternalIdpAuthSession {
        auth_result: result,
        profiles,
        selection_timeout_seconds: config.flow_timeout_seconds,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn configured_external_redirect_matches_deep_link_route() {
        let config = ExternalIdpAuthConfig::load().unwrap();
        assert_eq!(
            config.external_redirect_uri,
            DeepLinkCallbackWaiter::get_redirect_uri_for(CallbackRoute::ExternalIdp)
        );
    }
}
