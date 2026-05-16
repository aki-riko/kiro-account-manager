/// MITM 代理管理命令

use crate::mitm::cert_manager::CertManager;
use crate::mitm::config::{self, MitmConfig};
use crate::mitm::proxy_server::{MitmProxyConfig, MitmProxyServer};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// MITM 代理状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MitmStatus {
    pub running: bool,
    pub port: u16,
    pub ca_generated: bool,
    pub ca_installed: bool,
    pub ca_cert_path: Option<String>,
    pub mitm_domains: Vec<String>,
    pub target_device_id: Option<String>,
}

/// 获取 MITM 代理状态
#[tauri::command]
pub async fn get_mitm_status(state: State<'_, AppState>) -> Result<MitmStatus, String> {
    let certs_dir = crate::mitm::cert_manager::default_certs_dir();
    let ca_generated = certs_dir.join("ca.crt").exists();
    let ca_installed = if ca_generated {
        CertManager::check_ca_installed_in_system(&certs_dir)
    } else {
        false
    };
    let ca_cert_path = if ca_generated {
        Some(certs_dir.join("ca.crt").to_string_lossy().to_string())
    } else {
        None
    };

    let running = state.mitm_shutdown.lock()
        .map(|guard| guard.is_some())
        .unwrap_or(false);

    Ok(MitmStatus {
        running,
        port: 8766,
        ca_generated,
        ca_installed,
        ca_cert_path,
        mitm_domains: vec![
            "q.us-east-1.amazonaws.com".to_string(),
            "q.eu-central-1.amazonaws.com".to_string(),
        ],
        target_device_id: None,
    })
}

/// 启动 MITM 代理
#[tauri::command]
pub async fn start_mitm_proxy(
    state: State<'_, AppState>,
    port: u16,
    target_device_id: Option<String>,
    mitm_domains: Vec<String>,
) -> Result<(), String> {
    // 检查是否已在运行
    {
        let guard = state.mitm_shutdown.lock().map_err(|_| "锁失败")?;
        if guard.is_some() {
            return Err("MITM 代理已在运行".to_string());
        }
    }

    let certs_dir = crate::mitm::cert_manager::default_certs_dir();
    let cert_manager = CertManager::new(certs_dir)?;

    let config = MitmProxyConfig {
        host: "127.0.0.1".to_string(),
        port,
        mitm_domains: if mitm_domains.is_empty() {
            vec![
                "q.us-east-1.amazonaws.com".to_string(),
                "q.eu-central-1.amazonaws.com".to_string(),
            ]
        } else {
            mitm_domains
        },
        target_device_id,
        log_requests: true,
    };

    let (shutdown_tx, mut shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    let server = MitmProxyServer::new(config, cert_manager);

    tokio::spawn(async move {
        tokio::select! {
            result = server.start() => {
                if let Err(e) = result {
                    log::error!("[MITM] 代理服务器错误: {}", e);
                }
            }
            _ = &mut shutdown_rx => {
                log::info!("[MITM] 代理服务器已停止");
            }
        }
    });

    let mut guard = state.mitm_shutdown.lock().map_err(|_| "锁失败")?;
    *guard = Some(shutdown_tx);

    log::info!("[MITM] 代理已启动，端口 {}", port);
    Ok(())
}

/// 停止 MITM 代理
#[tauri::command]
pub async fn stop_mitm_proxy(state: State<'_, AppState>) -> Result<(), String> {
    let shutdown_tx = {
        let mut guard = state.mitm_shutdown.lock().map_err(|_| "锁失败")?;
        guard.take()
    };

    if let Some(tx) = shutdown_tx {
        let _ = tx.send(());
        log::info!("[MITM] 已发送停止信号");
        Ok(())
    } else {
        Err("MITM 代理未运行".to_string())
    }
}

/// 生成 CA 证书
#[tauri::command]
pub async fn generate_mitm_ca() -> Result<String, String> {
    let certs_dir = crate::mitm::cert_manager::default_certs_dir();
    let manager = CertManager::new(certs_dir)?;
    Ok(manager.ca_cert_path().to_string_lossy().to_string())
}

/// 安装 CA 到系统信任存储
#[tauri::command]
pub async fn install_mitm_ca() -> Result<(), String> {
    let certs_dir = crate::mitm::cert_manager::default_certs_dir();
    let manager = CertManager::new(certs_dir)?;
    manager.install_ca_to_system()
}

/// 获取 CA 证书 PEM 内容
#[tauri::command]
pub async fn get_mitm_ca_pem() -> Result<String, String> {
    let certs_dir = crate::mitm::cert_manager::default_certs_dir();
    let manager = CertManager::new(certs_dir)?;
    Ok(manager.ca_cert_pem().to_string())
}


/// 获取 MITM 配置
#[tauri::command]
pub async fn get_mitm_config() -> Result<MitmConfig, String> {
    Ok(config::load_mitm_config())
}

/// 保存 MITM 配置
#[tauri::command]
pub async fn save_mitm_config(config_data: MitmConfig) -> Result<(), String> {
    config::save_mitm_config(&config_data)
}
