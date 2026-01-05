// KiroGate 服务器命令

use crate::kiro_gate::{start_server, stop_server, get_server_status, ServerStatus};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartServerParams {
  pub port: u16,
  pub proxy_api_key: String,
}

// ============================================================
// KiroGate Token 管理
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KiroGateToken {
  pub id: String,
  pub name: String,
  pub refresh_token: String,
  #[serde(default)]
  pub auth_method: String, // "social" 或 "IdC"
  #[serde(skip_serializing_if = "Option::is_none")]
  pub profile_arn: Option<String>, // Social 需要
  #[serde(skip_serializing_if = "Option::is_none")]
  pub client_id_hash: Option<String>, // IdC 需要
  #[serde(skip_serializing_if = "Option::is_none")]
  pub region: Option<String>, // IdC 需要
  pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct KiroGateTokenStore {
  pub tokens: Vec<KiroGateToken>,
}

fn get_data_dir() -> PathBuf {
  dirs::data_dir().unwrap_or_else(|| {
    let home = std::env::var("USERPROFILE")
      .or_else(|_| std::env::var("HOME"))
      .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
  }).join(".kiro-account-manager")
}

fn get_tokens_path() -> PathBuf {
  get_data_dir().join("kiro-gate-tokens.json")
}

fn load_tokens() -> KiroGateTokenStore {
  let path = get_tokens_path();
  if !path.exists() {
    return KiroGateTokenStore::default();
  }
  std::fs::read_to_string(&path)
    .ok()
    .and_then(|c| serde_json::from_str(&c).ok())
    .unwrap_or_default()
}

fn save_tokens(store: &KiroGateTokenStore) -> Result<(), String> {
  let path = get_tokens_path();
  if let Some(parent) = path.parent() {
    std::fs::create_dir_all(parent).ok();
  }
  let content = serde_json::to_string_pretty(store)
    .map_err(|e| format!("序列化失败: {}", e))?;
  std::fs::write(&path, content)
    .map_err(|e| format!("写入失败: {}", e))
}

#[tauri::command]
pub async fn get_kiro_gate_tokens() -> Result<Vec<KiroGateToken>, String> {
  Ok(load_tokens().tokens)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddTokenParams {
  pub name: String,
  pub refresh_token: String,
  #[serde(default)]
  pub auth_method: String,
  pub profile_arn: Option<String>,
  pub client_id_hash: Option<String>,
  pub region: Option<String>,
}

#[tauri::command]
pub async fn add_kiro_gate_token(params: AddTokenParams) -> Result<KiroGateToken, String> {
  let mut store = load_tokens();
  let token = KiroGateToken {
    id: uuid::Uuid::new_v4().to_string(),
    name: params.name,
    refresh_token: params.refresh_token,
    auth_method: if params.auth_method.is_empty() { "social".to_string() } else { params.auth_method },
    profile_arn: params.profile_arn,
    client_id_hash: params.client_id_hash,
    region: params.region,
    created_at: chrono::Utc::now().to_rfc3339(),
  };
  store.tokens.push(token.clone());
  save_tokens(&store)?;
  Ok(token)
}

#[tauri::command]
pub async fn update_kiro_gate_token(id: String, name: String, refresh_token: String) -> Result<(), String> {
  let mut store = load_tokens();
  if let Some(t) = store.tokens.iter_mut().find(|t| t.id == id) {
    t.name = name;
    t.refresh_token = refresh_token;
    save_tokens(&store)?;
    Ok(())
  } else {
    Err("Token 不存在".to_string())
  }
}

#[tauri::command]
pub async fn delete_kiro_gate_token(id: String) -> Result<(), String> {
  let mut store = load_tokens();
  store.tokens.retain(|t| t.id != id);
  save_tokens(&store)?;
  Ok(())
}

/// 启动 KiroGate 服务器
#[tauri::command]
pub async fn start_kiro_gate(params: StartServerParams) -> Result<ServerStatus, String> {
  start_server(params.port, params.proxy_api_key).await?;
  Ok(get_server_status().await)
}

/// 停止 KiroGate 服务器
#[tauri::command]
pub async fn stop_kiro_gate() -> Result<(), String> {
  stop_server().await
}

/// 获取 KiroGate 服务器状态
#[tauri::command]
pub async fn get_kiro_gate_status() -> ServerStatus {
  get_server_status().await
}
