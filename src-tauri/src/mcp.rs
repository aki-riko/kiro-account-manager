// MCP 配置文件读写

use serde::{Deserialize, Serialize};

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpConfig {
    #[serde(rename = "mcpServers", default)]
    pub mcp_servers: HashMap<String, McpServer>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub powers: Option<PowersMcpConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PowersMcpConfig {
    #[serde(rename = "mcpServers", default)]
    pub mcp_servers: HashMap<String, PowerMcpServer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum McpServer {
    Command(McpServerCommand),
    Url(McpServerUrl),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerCommand {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default, rename = "autoApprove")]
    pub auto_approve: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerUrl {
    pub url: String,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default, rename = "disabledTools")]
    pub disabled_tools: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PowerMcpServer {
    pub url: String,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default, rename = "disabledTools")]
    pub disabled_tools: Vec<String>,
}

impl McpConfig {
    /// 获取 MCP 配置文件路径
    pub fn config_path() -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".kiro").join("settings").join("mcp.json"))
    }

    /// 读取配置文件
    pub fn load() -> Result<Self, String> {
        let path = Self::config_path().ok_or("无法获取用户目录")?;
        
        if !path.exists() {
            return Ok(Self::default());
        }
        
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("读取配置文件失败: {e}"))?;
        
        serde_json::from_str(&content)
            .map_err(|e| format!("解析配置文件失败: {e}"))
    }

    /// 保存配置文件
    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path().ok_or("无法获取用户目录")?;
        
        // 确保目录存在
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("创建目录失败: {e}"))?;
        }
        
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("序列化配置失败: {e}"))?;
        
        fs::write(&path, content)
            .map_err(|e| format!("写入配置文件失败: {e}"))
    }

}
