// 应用全局状态

use crate::auth::AuthState;
use crate::core::account::{AccountStore, GroupTagStore};
use crate::gateway::GatewayRuntime;
use crate::ksk_ide::runtime::KskIdeRuntime;
use std::sync::Mutex;
use tokio::sync::Mutex as AsyncMutex;

#[derive(Clone)]
pub struct PendingLogin {
    pub provider: String,
    pub code_verifier: String,
    pub state: String,
    pub machineid: String,
}

pub struct AppState {
    pub store: Mutex<AccountStore>,
    pub group_tag_store: Mutex<GroupTagStore>,
    pub auth: AuthState,
    pub pending_login: Mutex<Option<PendingLogin>>,
    pub gateway: Mutex<Option<GatewayRuntime>>,
    pub ksk_ide: AsyncMutex<Option<KskIdeRuntime>>,
}
