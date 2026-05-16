//! MITM 拦截器业务事件日志
//!
//! 与 `tauri-plugin-log` 输出的 app.log 解耦：
//! - app.log 由全局 log crate 写，包含所有模块的 trace/debug/info
//! - mitm.log 专门记录 MITM 拦截器的业务事件（CONNECT、机器码替换、提示词过滤）
//!   方便用户排查"我装好了 CA 装好了代理为啥还是没生效"这类问题

use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

const LOG_FILE: &str = "mitm.log";

/// MITM 日志文件路径
pub fn mitm_log_path() -> PathBuf {
    super::cert_manager::default_certs_dir()
        .parent()
        .map(std::path::Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."))
        .join("logs")
        .join(LOG_FILE)
}

/// 追加一行业务事件到 mitm.log（不阻塞，失败静默）
pub fn append(line: &str) {
    let path = mitm_log_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let entry = format!(
        "[{}] {}\n",
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
        line
    );
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = f.write_all(entry.as_bytes());
    }
}

/// 读取最近 N 行日志（用于前端实时滚动面板）
pub fn read_tail(max_lines: usize) -> Vec<String> {
    let path = mitm_log_path();
    let Ok(content) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    content
        .lines()
        .rev()
        .take(max_lines)
        .map(|s| s.to_string())
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect()
}

/// 清空 MITM 日志文件
pub fn clear() -> Result<(), String> {
    let path = mitm_log_path();
    if !path.exists() {
        return Ok(());
    }
    std::fs::write(&path, b"").map_err(|e| format!("清空日志失败: {e}"))
}
