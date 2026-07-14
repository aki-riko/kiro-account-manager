// Providers 模块 - 认证提供者

mod base;
mod external_idp;
mod factory;
mod idc;
mod social;

pub use base::{AuthProvider, AuthResult, RefreshMetadata};
pub use external_idp::{
    derive_external_idp_machine_id, discover_oidc, extract_external_idp_email,
    generate_external_idp_machine_id, normalize_external_idp_scopes, ExternalIdpProvider,
    OidcDiscoveryDocument,
};
pub use factory::*;
pub use idc::{cancel_pending_login as cancel_pending_idc_login, IdcProvider};
pub use social::{SocialProvider, SocialTokenResponse};
