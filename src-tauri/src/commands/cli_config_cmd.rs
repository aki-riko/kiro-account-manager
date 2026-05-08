// CLI 工具配置命令

use serde_json::Value;
use std::fs;
use std::process::Command;
use tauri::command;
use toml_edit::{value, DocumentMut};

#[command]
pub async fn check_claude_code_installed() -> Result<bool, String> {
    // 检查 claude 命令是否存在，使用 --version 验证
    let output = Command::new("claude")
        .arg("--version")
        .output();

    match output {
        Ok(result) => Ok(result.status.success()),
        Err(_) => Ok(false),
    }
}

#[command]
pub async fn check_codex_cli_installed() -> Result<bool, String> {
    // 检查 codex 命令是否存在，使用 --version 验证
    let output = Command::new("codex")
        .arg("--version")
        .output();

    match output {
        Ok(result) => Ok(result.status.success()),
        Err(_) => Ok(false),
    }
}

#[command]
pub async fn write_claude_code_config(base_url: String, api_key: String) -> Result<String, String> {
    let home_dir = dirs::home_dir().ok_or("无法获取用户目录")?;
    let config_path = home_dir.join(".claude").join("settings.json");

    // 确保目录存在
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }

    // 读取现有配置或创建新配置
    let mut config: Value = if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("读取配置文件失败: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("解析配置文件失败: {}", e))?
    } else {
        serde_json::json!({})
    };

    // 更新 env 配置
    if !config.is_object() {
        config = serde_json::json!({});
    }
    
    let env = config.get_mut("env").and_then(|v| v.as_object_mut());
    if let Some(env_obj) = env {
        env_obj.insert("ANTHROPIC_BASE_URL".to_string(), Value::String(base_url));
        env_obj.insert("ANTHROPIC_AUTH_TOKEN".to_string(), Value::String(api_key));
    } else {
        config["env"] = serde_json::json!({
            "ANTHROPIC_BASE_URL": base_url,
            "ANTHROPIC_AUTH_TOKEN": api_key
        });
    }

    // 写入配置文件
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;

    Ok(format!("已写入配置到 {}", config_path.display()))
}

#[command]
pub async fn write_codex_cli_config(
    base_url: String,
    api_key: String,
    model: Option<String>,
) -> Result<String, String> {
    let home_dir = dirs::home_dir().ok_or("无法获取用户目录")?;
    let codex_dir = home_dir.join(".codex");
    let config_path = codex_dir.join("config.toml");
    let auth_path = codex_dir.join("auth.json");

    // 确保目录存在
    fs::create_dir_all(&codex_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    // 1. 更新 config.toml
    let mut doc: DocumentMut = if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("读取 config.toml 失败: {}", e))?;
        content
            .parse::<DocumentMut>()
            .map_err(|e| format!("解析 config.toml 失败: {}", e))?
    } else {
        DocumentMut::new()
    };

    // 设置 model_provider 为 custom
    doc["model_provider"] = value("custom");

    // 设置模型（如果提供）
    if let Some(model_name) = model {
        doc["model"] = value(model_name);
    }

    // 确保 model_providers 表存在
    if !doc.contains_key("model_providers") {
        doc["model_providers"] = toml_edit::table();
    }

    // 确保 model_providers.custom 表存在
    if !doc["model_providers"]
        .as_table()
        .and_then(|t| t.get("custom"))
        .is_some()
    {
        doc["model_providers"]["custom"] = toml_edit::table();
    }

    // 更新 custom provider 配置
    let custom_table = doc["model_providers"]["custom"]
        .as_table_mut()
        .ok_or("无法获取 custom 配置表")?;

    custom_table.insert("name", value("custom"));
    custom_table.insert("base_url", value(base_url.clone()));
    custom_table.insert("wire_api", value("responses"));
    custom_table.insert("requires_openai_auth", value(true));

    // 写入 config.toml
    fs::write(&config_path, doc.to_string())
        .map_err(|e| format!("写入 config.toml 失败: {}", e))?;

    // 2. 更新 auth.json
    let mut auth_config: Value = if auth_path.exists() {
        let content = fs::read_to_string(&auth_path)
            .map_err(|e| format!("读取 auth.json 失败: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("解析 auth.json 失败: {}", e))?
    } else {
        serde_json::json!({})
    };

    // 更新 OPENAI_API_KEY
    auth_config["OPENAI_API_KEY"] = Value::String(api_key);

    // 写入 auth.json
    let auth_content = serde_json::to_string_pretty(&auth_config)
        .map_err(|e| format!("序列化 auth.json 失败: {}", e))?;
    fs::write(&auth_path, auth_content)
        .map_err(|e| format!("写入 auth.json 失败: {}", e))?;

    Ok(format!(
        "已写入配置到:\n- {}\n- {}",
        config_path.display(),
        auth_path.display()
    ))
}
