// Auth 相关命令 - 直接存储 usage_data
// Auth 相关命令 - 直接存储 usage_data

#![allow(clippy::needless_pass_by_value)] // Tauri 命令需要按值传递 State
use crate::auth::auth_social;
use crate::auth::providers::{
    authenticate_external_idp, cancel_pending_idc_login, cancel_pending_portal_login,
    create_idc_provider, extract_external_idp_email, generate_external_idp_machine_id,
    get_provider_config, AuthMethod, AuthProvider,
};
use crate::auth::User;
use crate::clients::kiro_auth_client::KiroAuthServiceClient;
use crate::clients::kiro_client::KiroProfile;
use crate::commands::common::{
    extract_user_info, find_existing_account_idx, generate_account_machine_id,
    get_usage_by_provider_with_machine_id, lock_store, save_store, update_account_status,
};
use crate::core::account::Account;
use crate::core::protocol_registry;
use crate::state::AppState;
use sha2::{Digest, Sha256};
use std::fmt::Display;
use std::sync::{Mutex, OnceLock};
use tauri::{Emitter, State};
use tokio::sync::oneshot;

struct PendingExternalIdpProfileSelection {
    id: String,
    sender: oneshot::Sender<String>,
}

static PENDING_EXTERNAL_IDP_PROFILE_SELECTION: OnceLock<
    Mutex<Option<PendingExternalIdpProfileSelection>>,
> = OnceLock::new();

fn require_login_email(email: Option<String>) -> Result<String, String> {
    email.ok_or("获取邮箱失败，请检查账号状态".to_string())
}

fn resolve_idc_login_email(
    provider_id: &str,
    email: Option<String>,
    user_id: Option<String>,
) -> Result<Option<String>, String> {
    if provider_id == "Enterprise" {
        // Enterprise 账号允许没有 email 和 userId，都没有时返回 None
        Ok(email.or(user_id))
    } else if provider_id == "BuilderId" {
        // BuilderId 允许没有 email/userId
        Ok(email
            .or(user_id)
            .or_else(|| Some("builderid_unknown".to_string())))
    } else {
        require_login_email(email).map(Some)
    }
}

fn social_callback_redirect_uri() -> String {
    crate::core::deep_link_handler::DeepLinkCallbackWaiter::get_redirect_uri()
}

fn prepare_pending_social_login(provider: &str, machineid: String) -> crate::state::PendingLogin {
    crate::state::PendingLogin {
        provider: provider.to_string(),
        code_verifier: auth_social::generate_code_verifier_social(),
        state: uuid::Uuid::new_v4().to_string(),
        machineid,
    }
}

fn social_stage_error(stage: &str, error: impl Display) -> String {
    format!("SOCIAL_LOGIN_FAILED stage={stage}: {error}")
}

fn summarize_social_error(error: &str) -> String {
    let summary = error
        .lines()
        .next()
        .unwrap_or(error)
        .split(" - ")
        .next()
        .unwrap_or(error)
        .trim();
    let mut summary = summary.to_string();
    if summary.chars().count() > 240 {
        summary = summary.chars().take(240).collect::<String>() + "...";
    }
    summary
}

fn clear_pending_social_login_if_matches(
    pending_login: &Mutex<Option<crate::state::PendingLogin>>,
    expected_state: &str,
) {
    match lock_store(pending_login, "pending_login cleanup") {
        Ok(mut pending) => {
            if pending
                .as_ref()
                .is_some_and(|current| current.state == expected_state)
            {
                *pending = None;
            }
        }
        Err(error) => {
            log::error!("[auth_cmd][social] Failed to clean up pending login: {error}");
        }
    }
}

fn apply_social_token_expiry(account: &mut Account, expires_in: i64) {
    account.expires_at = Some(crate::commands::common::calc_expires_at(expires_in));
}

fn social_fallback_account_id(provider_id: &str, refresh_token: &str) -> String {
    let digest = Sha256::digest(refresh_token.as_bytes());
    format!(
        "{}_{}",
        provider_id.to_lowercase(),
        hex::encode(&digest[..8])
    )
}

fn register_pending_external_idp_profile_selection() -> (String, oneshot::Receiver<String>) {
    let id = uuid::Uuid::new_v4().to_string();
    let (sender, receiver) = oneshot::channel();
    let storage = PENDING_EXTERNAL_IDP_PROFILE_SELECTION.get_or_init(|| Mutex::new(None));
    let mut guard = storage
        .lock()
        .expect("Failed to acquire External IdP profile selection lock");
    guard.replace(PendingExternalIdpProfileSelection {
        id: id.clone(),
        sender,
    });
    (id, receiver)
}

fn clear_pending_external_idp_profile_selection(id: &str) {
    let Some(storage) = PENDING_EXTERNAL_IDP_PROFILE_SELECTION.get() else {
        return;
    };
    let mut guard = storage
        .lock()
        .expect("Failed to acquire External IdP profile selection lock");
    if guard.as_ref().is_some_and(|pending| pending.id == id) {
        guard.take();
    }
}

fn cancel_pending_external_idp_profile_selection() -> bool {
    let Some(storage) = PENDING_EXTERNAL_IDP_PROFILE_SELECTION.get() else {
        return false;
    };
    storage
        .lock()
        .expect("Failed to acquire External IdP profile selection lock")
        .take()
        .is_some()
}

fn resolve_selected_external_idp_profile(
    profiles: &[KiroProfile],
    selected_arn: Option<&str>,
) -> Result<KiroProfile, String> {
    if let Some(selected_arn) = selected_arn
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return profiles
            .iter()
            .find(|profile| profile.arn == selected_arn)
            .cloned()
            .ok_or_else(|| "选择的 External IdP profile 不在本次登录候选列表中".to_string());
    }
    match profiles {
        [profile] => Ok(profile.clone()),
        [] => Err("External IdP 登录后未返回可用 profile".to_string()),
        _ => Err("External IdP 登录返回多个 profile，必须由用户选择".to_string()),
    }
}

async fn choose_external_idp_profile(
    app_handle: &tauri::AppHandle,
    profiles: &[KiroProfile],
    timeout_seconds: u64,
) -> Result<KiroProfile, String> {
    if profiles.len() == 1 {
        return resolve_selected_external_idp_profile(profiles, None);
    }

    let (selection_id, receiver) = register_pending_external_idp_profile_selection();
    if let Err(error) = app_handle.emit("external-idp-profiles-available", profiles.to_vec()) {
        clear_pending_external_idp_profile_selection(&selection_id);
        return Err(format!("通知前端选择 External IdP profile 失败: {error}"));
    }
    let selected_arn =
        match tokio::time::timeout(std::time::Duration::from_secs(timeout_seconds), receiver).await
        {
            Ok(Ok(profile_arn)) => Ok(profile_arn),
            Ok(Err(_)) => Err("登录已取消".to_string()),
            Err(_) => Err("External IdP profile 选择超时".to_string()),
        };
    clear_pending_external_idp_profile_selection(&selection_id);
    resolve_selected_external_idp_profile(profiles, Some(&selected_arn?))
}

#[tauri::command]
pub fn get_current_user(state: State<AppState>) -> Option<User> {
    match lock_store(&state.auth.user, "auth user") {
        Ok(user) => user.clone(),
        Err(_) => {
            log::error!("[auth_cmd] Failed to get current user");
            None
        }
    }
}

#[tauri::command]
pub fn logout(state: State<AppState>) {
    clear_auth_state(&state.auth);
}

fn clear_auth_state(auth: &crate::auth::AuthState) {
    if let Ok(mut user) = lock_store(&auth.user, "auth user") {
        *user = None;
    }
    if let Ok(mut access_token) = lock_store(&auth.access_token, "auth access_token") {
        *access_token = None;
    }
    if let Ok(mut refresh_token) = lock_store(&auth.refresh_token, "auth refresh_token") {
        *refresh_token = None;
    }
}

#[tauri::command]
pub fn cancel_kiro_login(state: State<'_, AppState>) -> bool {
    let cancelled_social = crate::core::deep_link_handler::cancel_waiter();
    let cancelled_idc = cancel_pending_idc_login();
    let cancelled_external_portal = cancel_pending_portal_login();
    let cancelled_external_profile = cancel_pending_external_idp_profile_selection();
    match lock_store(&state.pending_login, "pending_login") {
        Ok(mut pending_login) => {
            *pending_login = None;
        }
        Err(_) => {
            log::error!("[auth_cmd] Failed to cancel login");
        }
    }
    cancelled_social || cancelled_idc || cancelled_external_portal || cancelled_external_profile
}

#[tauri::command]
pub fn select_external_idp_profile(profile_arn: String) -> Result<(), String> {
    let profile_arn = profile_arn.trim().to_string();
    if profile_arn.is_empty() {
        return Err("请选择 External IdP profile".to_string());
    }
    let storage = PENDING_EXTERNAL_IDP_PROFILE_SELECTION
        .get()
        .ok_or("当前没有等待选择的 External IdP 登录".to_string())?;
    let pending = storage
        .lock()
        .map_err(|_| "Failed to acquire External IdP profile selection lock".to_string())?
        .take()
        .ok_or("当前没有等待选择的 External IdP 登录".to_string())?;
    pending
        .sender
        .send(profile_arn)
        .map_err(|_| "External IdP 登录已结束，无法提交 profile".to_string())
}

#[tauri::command]
pub async fn kiro_login(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    provider: String,
    start_url: Option<String>, // 新增：支持自定义 start_url（Enterprise 用）
    region: Option<String>,    // 新增：支持自定义 region（Enterprise 用）
) -> Result<String, String> {
    let mut config = get_provider_config(&provider)
        .ok_or_else(|| format!("Unsupported provider: {provider}"))?;

    // 如果传入了自定义 start_url，覆盖默认值
    if let Some(url) = start_url {
        config.start_url = Some(url);
    }

    // 如果传入了自定义 region，覆盖默认值
    if let Some(reg) = region {
        config.region = reg;
    }

    match config.auth_method {
        AuthMethod::Social => login_social(app_handle, state, &config).await,
        AuthMethod::Idc => login_idc(app_handle, state, &config).await,
        AuthMethod::ExternalIdp => login_external_idp(app_handle, state).await,
    }
}

async fn login_external_idp(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let session = authenticate_external_idp().await?;
    let profile = choose_external_idp_profile(
        &app_handle,
        &session.profiles,
        session.selection_timeout_seconds,
    )
    .await?;
    let mut auth_result = session.auth_result;
    auth_result.profile_arn = Some(profile.arn);
    auth_result.profile_name = Some(profile.name);
    auth_result.region = Some(profile.region);
    let email = extract_external_idp_email(&auth_result.access_token);
    let mut account = Account::new(
        email.clone().unwrap_or_else(|| "external-idp".to_string()),
        "Kiro Azure / Entra 账号".to_string(),
    );
    account.email = email;
    account.access_token = Some(auth_result.access_token.clone());
    account.refresh_token = Some(auth_result.refresh_token.clone());
    account.expires_at = Some(auth_result.expires_at.clone());
    account.provider = Some(auth_result.provider.clone());
    account.auth_method = Some(auth_result.auth_method.clone());
    account.client_id = auth_result.client_id.clone();
    account.region = auth_result.region.clone();
    account.token_endpoint = auth_result.token_endpoint.clone();
    account.issuer_url = auth_result.issuer_url.clone();
    account.scopes = auth_result.scopes.clone();
    account.audience = auth_result.audience.clone();
    account.profile_arn = auth_result.profile_arn.clone();
    account.profile_name = auth_result.profile_name.clone();
    account.machine_id = auth_result.machine_id.clone().or_else(|| {
        Some(generate_external_idp_machine_id(Some(
            &auth_result.access_token,
        )))
    });

    let result = crate::commands::account_cmd::upsert_external_idp_account(state.inner(), account)?;
    let saved_account = result.account;
    update_auth_state(
        &state,
        saved_account.email.as_ref(),
        "ExternalIdp",
        &auth_result.access_token,
        &auth_result.refresh_token,
    )?;
    let _ = app_handle.emit("login-success", saved_account.id.clone());
    let _ = app_handle.emit("accounts-updated", ());

    Ok("External IdP login completed".to_string())
}

async fn login_social(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    config: &crate::auth::providers::ProviderConfig,
) -> Result<String, String> {
    let provider_id = config.provider_id.clone();
    let pending = prepare_pending_social_login(&provider_id, generate_account_machine_id());
    let login_id = pending.state[..8].to_string();
    let pending_state = pending.state.clone();
    let result = async {
        // 确保协议注册指向当前应用（解决多版本/移动应用的问题）
        protocol_registry::ensure_protocol_registration()
            .map_err(|error| social_stage_error("protocol_registration", error))?;

        let redirect_uri = social_callback_redirect_uri();
        let code_challenge = auth_social::generate_code_challenge_social(&pending.code_verifier);
        let client = KiroAuthServiceClient::new(&pending.machineid)
            .map_err(|error| social_stage_error("client_init", error))?;

        lock_store(&state.pending_login, "pending_login")
            .map(|mut pending_login| *pending_login = Some(pending.clone()))
            .map_err(|error| social_stage_error("pending_state", error))?;
        log::info!("[auth_cmd][social][{login_id}] login started provider={provider_id}");

        // 1. 注册 deep link 回调等待器
        let waiter = crate::core::deep_link_handler::register_waiter(
            crate::core::deep_link_handler::CallbackRoute::Social,
            &pending.state,
        );

        // 2. 打开浏览器授权
        client
            .login(&provider_id, &redirect_uri, &code_challenge, &pending.state)
            .await
            .map_err(|error| social_stage_error("browser_authorization", error))?;
        log::info!("[auth_cmd][social][{login_id}] browser authorization opened");

        // 3. 等待回调（阻塞直到用户完成授权或超时）
        let callback_result = waiter
            .wait_for_callback()
            .map_err(|error| social_stage_error("oauth_callback", error))?;
        log::info!("[auth_cmd][social][{login_id}] oauth callback accepted");

        // 4. 用 code 换 token
        let token_result: crate::auth::providers::SocialTokenResponse = client
            .create_token(
                &callback_result.code,
                &pending.code_verifier,
                &redirect_uri,
                None, // invitation_code
            )
            .await
            .map_err(|error| social_stage_error("token_exchange", error))?;
        log::info!(
            "[auth_cmd][social][{login_id}] token exchange succeeded expires_in={}",
            token_result.expires_in
        );

        // 5. 获取配额信息
        let usage_result = get_usage_by_provider_with_machine_id(
            &provider_id,
            &token_result.access_token,
            &pending.machineid,
        )
        .await
        .map_err(|error| social_stage_error("usage_limits", error))?;
        log::info!(
            "[auth_cmd][social][{login_id}] usage loaded banned={} auth_error={}",
            usage_result.is_banned,
            usage_result.is_auth_error
        );

        // 封禁账号直接报错
        if usage_result.is_banned {
            return Err(social_stage_error("usage_limits", "BANNED: 账号已被封禁"));
        }

        let (new_email, user_id) = extract_user_info(&usage_result.usage_data);
        let has_email = new_email.is_some();
        let has_user_id = user_id.is_some();
        let final_email = new_email.clone().or(user_id.clone()).unwrap_or_else(|| {
            social_fallback_account_id(&provider_id, &token_result.refresh_token)
        });
        log::info!(
            "[auth_cmd][social][{login_id}] identity resolved has_email={} has_user_id={}",
            has_email,
            has_user_id
        );

        // 6. 保存账号
        let mut store = lock_store(&state.store, "store")
            .map_err(|error| social_stage_error("account_store", error))?;
        let existing_idx = find_existing_account_idx(
            &store.accounts,
            Some(&final_email),
            &provider_id,
            &token_result.refresh_token,
            user_id.as_ref(),
        );

        let account = if let Some(idx) = existing_idx {
            let existing = &mut store.accounts[idx];
            existing.access_token = Some(token_result.access_token.clone());
            existing.refresh_token = Some(token_result.refresh_token.clone());
            existing.profile_arn = token_result.profile_arn.clone();
            if new_email.is_some() {
                existing.email = new_email.clone();
            }
            existing.user_id = user_id;
            existing.usage_data = Some(usage_result.usage_data);
            if existing
                .machine_id
                .as_ref()
                .is_none_or(|id| id.trim().is_empty())
            {
                existing.machine_id = Some(pending.machineid.clone());
            }
            apply_social_token_expiry(existing, token_result.expires_in);
            update_account_status(existing, usage_result.is_banned, usage_result.is_auth_error);
            existing.clone()
        } else {
            let mut account = Account::new(final_email.clone(), format!("Kiro {provider_id} 账号"));
            account.access_token = Some(token_result.access_token.clone());
            account.refresh_token = Some(token_result.refresh_token.clone());
            account.profile_arn = token_result.profile_arn.clone();
            account.provider = Some(provider_id.clone());
            account.auth_method = Some("social".to_string());
            account.user_id = user_id;
            account.usage_data = Some(usage_result.usage_data);
            update_account_status(
                &mut account,
                usage_result.is_banned,
                usage_result.is_auth_error,
            );
            account.machine_id = Some(pending.machineid.clone());
            apply_social_token_expiry(&mut account, token_result.expires_in);
            store.accounts.insert(0, account.clone());
            account
        };

        save_store(&store).map_err(|error| social_stage_error("save_account", error))?;
        log::info!(
            "[auth_cmd][social][{login_id}] account saved account_count={}",
            store.accounts.len()
        );
        drop(store);

        // 7. 更新认证状态（失败不影响账号已保存）
        let user = crate::auth::User {
            id: uuid::Uuid::new_v4().to_string(),
            email: account.email.clone(),
            name: account
                .email
                .as_ref()
                .and_then(|e| e.split('@').next())
                .unwrap_or("User")
                .to_string(),
            avatar: None,
            provider: provider_id.clone(),
        };
        lock_store(&state.auth.user, "auth user")
            .map(|mut u| *u = Some(user))
            .map_err(|error| social_stage_error("auth_state", error))?;
        lock_store(&state.auth.access_token, "auth access_token")
            .map(|mut t| *t = Some(token_result.access_token))
            .map_err(|error| social_stage_error("auth_state", error))?;
        lock_store(&state.auth.refresh_token, "auth refresh_token")
            .map(|mut t| *t = Some(token_result.refresh_token))
            .map_err(|error| social_stage_error("auth_state", error))?;

        lock_store(&state.pending_login, "pending_login")
            .map(|mut pending_login| *pending_login = None)
            .map_err(|error| social_stage_error("pending_state", error))?;
        let _ = app_handle.emit("login-success", account.id.clone());
        log::info!("[auth_cmd][social][{login_id}] login succeeded");

        Ok(format!("Successfully logged in with {provider_id}"))
    }
    .await;

    if let Err(error) = &result {
        crate::core::deep_link_handler::cancel_waiter_if_matches(
            crate::core::deep_link_handler::CallbackRoute::Social,
            &pending_state,
        );
        clear_pending_social_login_if_matches(&state.pending_login, &pending_state);
        log::error!(
            "[auth_cmd][social][{login_id}] login failed: {}",
            summarize_social_error(error)
        );
    }

    result
}

async fn login_idc(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    config: &crate::auth::providers::ProviderConfig,
) -> Result<String, String> {
    let idc_provider = create_idc_provider(config);
    let provider_id = idc_provider.get_provider_id().to_string();
    let auth_method = idc_provider.get_auth_method();

    let auth_result = idc_provider.login().await?;

    // 先查找已存在账号，优先使用已有的 machine_id
    let existing_machine_id = {
        let store = lock_store(&state.store, "store")?;
        store
            .accounts
            .iter()
            .find(|acc| {
                // 通过 start_url + client_id_hash 匹配 Enterprise 账号
                if provider_id == "Enterprise" {
                    if let (
                        Some(ref acc_start_url),
                        Some(ref acc_hash),
                        Some(ref auth_start_url),
                        Some(ref auth_hash),
                    ) = (
                        &acc.start_url,
                        &acc.client_id_hash,
                        &auth_result.start_url,
                        &auth_result.client_id_hash,
                    ) {
                        return acc_start_url == auth_start_url && acc_hash == auth_hash;
                    }
                }
                // BuilderId 通过 refresh_token 匹配
                if let Some(ref acc_rt) = acc.refresh_token {
                    return acc_rt == &auth_result.refresh_token;
                }
                false
            })
            .and_then(|acc| acc.machine_id.clone())
    }; // store 在此作用域结束时自动释放

    let account_machine_id = existing_machine_id
        .filter(|id| !id.trim().is_empty())
        .unwrap_or_else(generate_account_machine_id);

    let usage_result = match get_usage_by_provider_with_machine_id(
        &provider_id,
        &auth_result.access_token,
        &account_machine_id,
    )
    .await
    {
        Ok(result) => result,
        Err(e) => {
            log::warn!("Failed to get usage for {}: {}", provider_id, e);
            // 即使 getUsageLimits 失败，也能保存账号
            crate::commands::common::UsageResult {
                usage_data: serde_json::json!({}),
                is_banned: false,
                is_auth_error: false,
            }
        }
    };

    // 封禁账号直接报错
    if usage_result.is_banned {
        return Err("BANNED: 账号已被封禁".to_string());
    }

    let (new_email, user_id) = extract_user_info(&usage_result.usage_data);

    // 调试：输出 Enterprise 账号的 userInfo 对象
    if provider_id == "Enterprise" {
        log::info!(
            "Enterprise userInfo: {}",
            usage_result
                .usage_data
                .get("userInfo")
                .unwrap_or(&serde_json::json!(null))
        );
        log::info!("Extracted email: {:?}, user_id: {:?}", new_email, user_id);
    }

    // Enterprise 账号允许没有 email,使用 userId 作为标识
    let final_email = resolve_idc_login_email(&provider_id, new_email.clone(), user_id.clone())?;
    log::info!("final_email for {} account: {:?}", provider_id, final_email);

    let mut store = lock_store(&state.store, "store")?;
    let existing_idx = find_existing_account_idx(
        &store.accounts,
        new_email.as_ref(),
        &provider_id,
        &auth_result.refresh_token,
        user_id.as_ref(),
    );
    log::info!(
        "existing_idx: {:?}, will create new account: {}",
        existing_idx,
        existing_idx.is_none()
    );

    let account = if let Some(idx) = existing_idx {
        log::info!("Updating existing account at index {}", idx);
        let existing = &mut store.accounts[idx];
        existing.access_token = Some(auth_result.access_token.clone());
        existing.refresh_token = Some(auth_result.refresh_token.clone());
        existing.email.clone_from(&new_email);
        existing.user_id.clone_from(&user_id);
        existing.provider = Some(provider_id.clone()); // 确保 provider 不变
        existing.expires_at = Some(auth_result.expires_at.clone());
        existing.client_id_hash = auth_result.client_id_hash;
        existing.client_id = auth_result.client_id;
        existing.client_secret = auth_result.client_secret;
        existing.region = auth_result.region;
        existing.start_url.clone_from(&auth_result.start_url); // 保存 start_url
        existing.sso_session_id = auth_result.sso_session_id;
        existing.id_token = auth_result.id_token;
        existing.profile_arn = auth_result.profile_arn;
        existing.usage_data = Some(usage_result.usage_data);
        // machine_id 应该已经存在且被复用了，这里仅作兜底
        if existing
            .machine_id
            .as_ref()
            .is_none_or(|id| id.trim().is_empty())
        {
            existing.machine_id = Some(account_machine_id.clone());
        }
        update_account_status(existing, usage_result.is_banned, usage_result.is_auth_error);
        existing.clone()
    } else {
        let mut account = Account::new(
            final_email
                .clone()
                .unwrap_or_else(|| format!("{provider_id}_account")),
            format!("Kiro {provider_id} 账号"),
        );
        // 如果 Enterprise 账号没有 email，设回 None
        if provider_id == "Enterprise" && final_email.is_none() {
            account.email = None;
        }
        account.access_token = Some(auth_result.access_token.clone());
        account.refresh_token = Some(auth_result.refresh_token.clone());
        account.provider = Some(provider_id.clone());
        account.auth_method = Some("IdC".to_string());
        account.user_id = user_id;
        account.expires_at = Some(auth_result.expires_at.clone());
        account.client_id_hash = auth_result.client_id_hash;
        account.client_id = auth_result.client_id;
        account.client_secret = auth_result.client_secret;
        account.region = auth_result.region;
        account.start_url.clone_from(&auth_result.start_url); // 保存 start_url
        account.sso_session_id = auth_result.sso_session_id;
        account.id_token = auth_result.id_token;
        account.profile_arn = auth_result.profile_arn;
        account.usage_data = Some(usage_result.usage_data);
        update_account_status(
            &mut account,
            usage_result.is_banned,
            usage_result.is_auth_error,
        );

        // 为所有新账号生成唯一的 machine_id（每个账号独立 UUID，避免隐私泄露）
        account.machine_id = Some(account_machine_id);
        log::info!(
            "Generated unique machine_id for new {} account",
            provider_id
        );

        store.accounts.insert(0, account.clone());
        log::info!("Inserted new {} account into store", provider_id);
        account
    };

    log::info!("Saving store with {} accounts...", store.accounts.len());
    save_store(&store)?;
    log::info!("Store saved successfully");
    drop(store);

    let display_id = account.get_display_id();
    update_auth_state(
        &state,
        account.email.as_ref(),
        &provider_id,
        &auth_result.access_token,
        &auth_result.refresh_token,
    )?;
    println!("\n[{auth_method}] LOGIN SUCCESS: {display_id}");

    log::info!("Emitting login-success event for account: {}", account.id);
    let _ = app_handle.emit("login-success", account.id.clone());
    let _ = app_handle.emit("accounts-updated", ());
    log::info!("Emitted login-success and accounts-updated events");
    log::info!("Returning success response");
    Ok(format!("{auth_method} login completed for {display_id}"))
}

fn update_auth_state(
    state: &State<'_, AppState>,
    email: Option<&String>,
    provider: &str,
    access_token: &str,
    refresh_token: &str,
) -> Result<(), String> {
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: email.cloned(),
        name: email
            .and_then(|e| e.split('@').next())
            .unwrap_or("User")
            .to_string(),
        avatar: None,
        provider: provider.to_string(),
    };
    *lock_store(&state.auth.user, "auth user")? = Some(user);
    *lock_store(&state.auth.access_token, "auth access_token")? = Some(access_token.to_string());
    *lock_store(&state.auth.refresh_token, "auth refresh_token")? = Some(refresh_token.to_string());
    *lock_store(&state.pending_login, "pending_login")? = None;
    Ok(())
}

#[tauri::command]
pub async fn handle_kiro_social_callback(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    code: String,
    callback_state: String,
) -> Result<(), String> {
    let pending = {
        let lock = lock_store(&state.pending_login, "pending_login")?;
        lock.clone().ok_or("No pending login found")?
    };

    if pending.state != callback_state {
        return Err("State mismatch".to_string());
    }

    let redirect_uri = social_callback_redirect_uri();
    let token_response = auth_social::exchange_social_code_for_token(
        &code,
        &pending.code_verifier,
        &redirect_uri,
        &pending.machineid,
    )
    .await?;

    let usage_result = get_usage_by_provider_with_machine_id(
        &pending.provider,
        &token_response.access_token,
        &pending.machineid,
    )
    .await?;

    if usage_result.is_banned {
        return Err("BANNED: 账号已被封禁".to_string());
    }

    let (new_email, user_id) = extract_user_info(&usage_result.usage_data);
    let final_email = new_email.clone().or(user_id.clone()).unwrap_or_else(|| {
        social_fallback_account_id(&pending.provider, &token_response.refresh_token)
    });

    let mut store = lock_store(&state.store, "store")?;
    let existing_idx = find_existing_account_idx(
        &store.accounts,
        new_email.as_ref(),
        &pending.provider,
        &token_response.refresh_token,
        user_id.as_ref(),
    );

    let account = if let Some(idx) = existing_idx {
        let existing = &mut store.accounts[idx];
        existing.access_token = Some(token_response.access_token.clone());
        existing.refresh_token = Some(token_response.refresh_token.clone());
        if new_email.is_some() {
            existing.email.clone_from(&new_email);
        } else if existing
            .email
            .as_ref()
            .is_none_or(|email| email.trim().is_empty())
        {
            existing.email = Some(final_email.clone());
        }
        existing.user_id.clone_from(&user_id);
        existing.usage_data = Some(usage_result.usage_data);
        if existing
            .machine_id
            .as_ref()
            .is_none_or(|id| id.trim().is_empty())
        {
            existing.machine_id = Some(pending.machineid.clone());
        }
        apply_social_token_expiry(existing, token_response.expires_in);
        update_account_status(existing, usage_result.is_banned, usage_result.is_auth_error);
        existing.clone()
    } else {
        let mut account = Account::new(
            final_email.clone(),
            format!("Kiro {} 账号", pending.provider),
        );
        account.access_token = Some(token_response.access_token.clone());
        account.refresh_token = Some(token_response.refresh_token.clone());
        account.provider = Some(pending.provider.clone());
        account.auth_method = Some("social".to_string());
        account.user_id = user_id;
        account.usage_data = Some(usage_result.usage_data);
        apply_social_token_expiry(&mut account, token_response.expires_in);
        update_account_status(
            &mut account,
            usage_result.is_banned,
            usage_result.is_auth_error,
        );

        // 为所有新账号生成唯一的 machine_id（每个账号独立 UUID，避免隐私泄露）
        account.machine_id = Some(pending.machineid.clone());
        log::info!(
            "Generated unique machine_id for new {} account",
            pending.provider
        );

        store.accounts.insert(0, account.clone());
        account
    };

    save_store(&store)?;
    drop(store);

    let display_id = account.get_display_id();
    update_auth_state(
        &state,
        account.email.as_ref(),
        &pending.provider,
        &token_response.access_token,
        &token_response.refresh_token,
    )?;
    let _ = app_handle.emit("login-success", account.id);
    println!("Social callback login completed: {display_id}");
    Ok(())
}

#[tauri::command]
pub fn get_supported_providers() -> Vec<&'static str> {
    crate::auth::providers::get_supported_providers()
}

#[cfg(test)]
mod tests {
    use super::{
        apply_social_token_expiry, clear_auth_state, require_login_email, resolve_idc_login_email,
        resolve_selected_external_idp_profile, social_fallback_account_id, social_stage_error,
        summarize_social_error,
    };
    use crate::auth::AuthState;
    use crate::auth::User;
    use crate::clients::kiro_client::KiroProfile;
    use crate::core::account::Account;

    #[test]
    fn require_login_email_rejects_missing_email() {
        assert_eq!(
            require_login_email(Some("user@example.com".to_string())).unwrap(),
            "user@example.com".to_string()
        );
        assert_eq!(
            require_login_email(None).unwrap_err(),
            "获取邮箱失败，请检查账号状态".to_string()
        );
    }

    #[test]
    fn external_idp_login_requires_selection_for_multiple_profiles() {
        let profiles = vec![
            KiroProfile {
                arn: "arn:aws:codewhisperer:us-east-1:1:profile/first".to_string(),
                name: "First".to_string(),
                region: "us-east-1".to_string(),
            },
            KiroProfile {
                arn: "arn:aws:codewhisperer:eu-central-1:1:profile/second".to_string(),
                name: "Second".to_string(),
                region: "eu-central-1".to_string(),
            },
        ];

        assert!(resolve_selected_external_idp_profile(&profiles, None).is_err());
        assert_eq!(
            resolve_selected_external_idp_profile(&profiles, Some(&profiles[1].arn))
                .unwrap()
                .name,
            "Second"
        );
    }

    #[test]
    fn resolve_idc_login_email_uses_enterprise_user_id_fallback() {
        assert_eq!(
            resolve_idc_login_email("Enterprise", None, Some("enterprise-user".to_string()))
                .unwrap(),
            Some("enterprise-user".to_string())
        );
        assert_eq!(
            resolve_idc_login_email("BuilderId", None, Some("builder-user".to_string())).unwrap(),
            Some("builder-user".to_string())
        );
        // Enterprise 账号允许都没有 email 和 userId
        assert_eq!(
            resolve_idc_login_email("Enterprise", None, None).unwrap(),
            None
        );
    }

    #[test]
    fn clear_auth_state_removes_refresh_token_too() {
        let auth = AuthState::new();
        *auth.user.lock().expect("user lock should work") = Some(User {
            id: "user-1".to_string(),
            email: Some("user@example.com".to_string()),
            name: "user".to_string(),
            avatar: None,
            provider: "Google".to_string(),
        });
        *auth
            .access_token
            .lock()
            .expect("access_token lock should work") = Some("access-token".to_string());
        *auth
            .refresh_token
            .lock()
            .expect("refresh_token lock should work") = Some("refresh-token".to_string());

        clear_auth_state(&auth);

        assert!(auth.user.lock().expect("user lock should work").is_none());
        assert!(auth
            .access_token
            .lock()
            .expect("access_token lock should work")
            .is_none());
        assert!(auth
            .refresh_token
            .lock()
            .expect("refresh_token lock should work")
            .is_none());
    }

    #[test]
    fn social_stage_error_keeps_failure_stage() {
        assert_eq!(
            social_stage_error("token_exchange", "HTTP 400"),
            "SOCIAL_LOGIN_FAILED stage=token_exchange: HTTP 400"
        );
    }

    #[test]
    fn social_error_summary_drops_response_body() {
        let summary = summarize_social_error(
            "Kiro Auth Service token creation failed: HTTP 400 - {\"refreshToken\":\"secret\"}",
        );
        assert_eq!(summary, "Kiro Auth Service token creation failed: HTTP 400");
        assert!(!summary.contains("secret"));
    }

    #[test]
    fn social_token_expiry_is_written_to_account() {
        let mut account = Account::new("user@example.com".to_string(), "Google".to_string());

        apply_social_token_expiry(&mut account, 3600);

        assert!(account.expires_at.is_some());
    }

    #[test]
    fn social_fallback_account_id_is_stable_without_exposing_token_prefix() {
        let first = social_fallback_account_id("Google", "short-token");
        let second = social_fallback_account_id("Google", "short-token");

        assert_eq!(first, second);
        assert!(first.starts_with("google_"));
        assert!(!first.contains("short-token"));
        assert_eq!(first.len(), "google_".len() + 16);
    }
}
