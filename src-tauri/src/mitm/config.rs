#![allow(dead_code)]
//! MITM 代理配置持久化

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const CONFIG_FILE: &str = "mitm-config.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MitmConfig {
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default)]
    pub target_device_id: Option<String>,
    #[serde(default = "default_mitm_domains")]
    pub mitm_domains: Vec<String>,
    #[serde(default = "default_true")]
    pub log_requests: bool,
    #[serde(default)]
    pub filter_kiro_prompt: bool,
    #[serde(default)]
    pub custom_prompt_replacement: Option<String>,
    #[serde(default)]
    pub enabled: bool,
}

fn default_port() -> u16 { 8766 }
fn default_true() -> bool { true }
fn default_mitm_domains() -> Vec<String> {
    vec![
        // 主业务（chat/streaming/MCP）
        "q.us-east-1.amazonaws.com".to_string(),
        "q.eu-central-1.amazonaws.com".to_string(),
        // AWS SSO OIDC（refresh token，AWS SDK 会带 KiroIDE UA）
        "oidc.us-east-1.amazonaws.com".to_string(),
        "oidc.eu-central-1.amazonaws.com".to_string(),
        // Kiro AuthService（POST /oauth/token、/refreshToken、/logout、DELETE /account）
        "prod.us-east-1.auth.desktop.kiro.dev".to_string(),
        // OTLP 遥测（x-kiro-machineid header）
        "prod.us-east-1.telemetry.desktop.kiro.dev".to_string(),
        "gamma.us-east-1.telemetry.desktop.kiro.dev".to_string(),
    ]
}

impl Default for MitmConfig {
    fn default() -> Self {
        Self {
            port: default_port(),
            target_device_id: None,
            mitm_domains: default_mitm_domains(),
            log_requests: true,
            filter_kiro_prompt: false,
            custom_prompt_replacement: None,
            enabled: false,
        }
    }
}

fn config_path() -> PathBuf {
    super::cert_manager::default_certs_dir()
        .parent()
        .unwrap_or(&PathBuf::from("."))
        .join(CONFIG_FILE)
}

pub fn load_mitm_config() -> MitmConfig {
    let path = config_path();
    if !path.exists() {
        return MitmConfig::default();
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_mitm_config(config: &MitmConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("写入配置失败: {e}"))
}
