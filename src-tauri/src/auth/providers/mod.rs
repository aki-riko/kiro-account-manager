// Providers 模块 - 认证提供者

mod base;
mod external_idp;
mod external_idp_flow;
mod external_idp_login;
mod external_idp_portal;
mod factory;
mod idc;
mod social;

pub use base::{AuthProvider, AuthResult, RefreshMetadata};
pub use external_idp::{
    derive_external_idp_machine_id, discover_oidc, extract_external_idp_email,
    generate_external_idp_machine_id, normalize_external_idp_scopes, ExternalIdpProvider,
    OidcDiscoveryDocument,
};
pub use external_idp_flow::authenticate_external_idp;
pub use external_idp_login::{
    begin_external_idp_authorization, exchange_external_idp_authorization_code,
};
pub use external_idp_portal::{
    cancel_pending_portal_login, register_pending_portal_login, ExternalIdpAuthConfig,
    PortalAuthServer, PortalCallbackData,
};
pub use factory::*;
pub use idc::{cancel_pending_login as cancel_pending_idc_login, IdcProvider};
pub use social::{SocialProvider, SocialTokenResponse};
