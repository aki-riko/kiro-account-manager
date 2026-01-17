// MCP 服务器管理命令

use crate::mcp::{McpConfig, McpServer};

/// 获取 MCP 配置
#[tauri::command]
pub async fn get_mcp_config() -> Result<McpConfig, String> {
    tokio::task::spawn_blocking(McpConfig::load)
        .await
        .map_err(|e| e.to_string())?
}

/// 保存/更新服务器配置
#[tauri::command]
pub async fn save_mcp_server(name: String, config: McpServer) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        // 验证配置
        validate_mcp_server(&config)?;
        
        let mut mcp_config = McpConfig::load()?;
        mcp_config.mcp_servers.insert(name, config);
        mcp_config.save()
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 验证 MCP 服务器配置
fn validate_mcp_server(config: &McpServer) -> Result<(), String> {
    match config {
        McpServer::Command(cmd) => {
            // 验证 command 字段
            if cmd.command.trim().is_empty() {
                return Err("command 字段不能为空".to_string());
            }
            
            // 验证 autoApprove 字段（可选）
            for tool in &cmd.auto_approve {
                if tool.trim().is_empty() {
                    return Err("autoApprove 中不能包含空字符串".to_string());
                }
            }
            
            Ok(())
        }
        McpServer::Url(url_config) => {
            // 验证 URL 格式
            if url_config.url.trim().is_empty() {
                return Err("url 字段不能为空".to_string());
            }
            
            // 简单的 URL 格式验证
            if !url_config.url.starts_with("http://") && !url_config.url.starts_with("https://") {
                return Err("url 必须以 http:// 或 https:// 开头".to_string());
            }
            
            Ok(())
        }
    }
}

/// 删除服务器
#[tauri::command]
pub async fn delete_mcp_server(name: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut mcp_config = McpConfig::load()?;
        mcp_config.mcp_servers.remove(&name);
        mcp_config.save()
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 启用/禁用服务器
#[tauri::command]
pub async fn toggle_mcp_server(name: String, disabled: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut mcp_config = McpConfig::load()?;
        if let Some(server) = mcp_config.mcp_servers.get_mut(&name) {
            match server {
                McpServer::Command(cmd) => cmd.disabled = disabled,
                McpServer::Url(url) => url.disabled = disabled,
            }
            mcp_config.save()
        } else {
            Err(format!("服务器 {} 不存在", name))
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 获取 MCP 工具统计信息
#[tauri::command]
pub async fn get_mcp_tool_stats() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(|| {
        let mcp_config = McpConfig::load()?;
        
        let total_servers = mcp_config.mcp_servers.len();
        let enabled_servers = mcp_config.mcp_servers.values()
            .filter(|server| {
                match server {
                    McpServer::Command(cmd) => !cmd.disabled,
                    McpServer::Url(url) => !url.disabled,
                }
            })
            .count();
        
        // 估算工具数量：每个启用的服务器平均 5-10 个工具
        // 使用保守估计：每个服务器 7 个工具
        let estimated_tools = enabled_servers * 7;
        
        Ok(serde_json::json!({
            "totalServers": total_servers,
            "enabledServers": enabled_servers,
            "estimatedTools": estimated_tools,
        }))
    })
    .await
    .map_err(|e| e.to_string())?
}
