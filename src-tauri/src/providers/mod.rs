// Providers 模块 - 认证提供者

mod base;
mod social;
mod idc;
mod factory;

pub use base::{AuthResult, AuthProvider, RefreshMetadata};
pub use social::SocialProvider;
pub use idc::IdcProvider;
pub use factory::*;
// KiroPortalClient 用于获取配额（GetUserUsageAndLimits）
pub use crate::kiro_portal_client::KiroPortalClient;
