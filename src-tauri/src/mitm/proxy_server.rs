#![allow(dead_code)]
//! MITM HTTPS 代理服务器
//!
//! 处理流程：
//! 1. 监听 HTTP CONNECT 请求
//! 2. 对目标域名进行 TLS 解密（使用动态签发的证书）
//! 3. 读取/修改请求内容
//! 4. 重新加密转发到真实服务器
//! 5. 将响应返回给客户端

use std::net::SocketAddr;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_rustls::rustls::{self, ServerConfig};
use tokio_rustls::TlsAcceptor;

use super::cert_manager::CertManager;

/// MITM 代理配置
#[derive(Debug, Clone)]
pub struct MitmProxyConfig {
    /// 监听地址
    pub host: String,
    /// 监听端口
    pub port: u16,
    /// 需要 MITM 拦截的域名列表
    pub mitm_domains: Vec<String>,
    /// 目标机器码（用于替换）
    pub target_device_id: Option<String>,
    /// 是否记录请求日志
    pub log_requests: bool,
    /// 上游代理（http://host:port 或 socks5://host:port），用于 MITM 转发出网时走代理
    /// 解决与 Kiro 原本的 HTTPS_PROXY 冲突的问题
    pub upstream_proxy: Option<String>,
}

impl Default for MitmProxyConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8766,
            mitm_domains: vec![
                // 主业务（chat/streaming/MCP）
                "q.us-east-1.amazonaws.com".to_string(),
                "q.eu-central-1.amazonaws.com".to_string(),
                // AWS SSO OIDC（refresh token）
                "oidc.us-east-1.amazonaws.com".to_string(),
                "oidc.eu-central-1.amazonaws.com".to_string(),
                // Kiro AuthService（POST /oauth/token、/refreshToken、/logout、DELETE /account）
                "prod.us-east-1.auth.desktop.kiro.dev".to_string(),
                // OTLP 遥测（x-kiro-machineid header）
                "prod.us-east-1.telemetry.desktop.kiro.dev".to_string(),
                "gamma.us-east-1.telemetry.desktop.kiro.dev".to_string(),
            ],
            target_device_id: None,
            log_requests: true,
            upstream_proxy: None,
        }
    }
}

/// MITM 代理服务器
pub struct MitmProxyServer {
    config: MitmProxyConfig,
    cert_manager: Arc<CertManager>,
}

impl MitmProxyServer {
    pub fn new(config: MitmProxyConfig, cert_manager: CertManager) -> Self {
        Self {
            config,
            cert_manager: Arc::new(cert_manager),
        }
    }

    /// 启动代理服务器
    pub async fn start(&self) -> Result<(), String> {
        let addr: SocketAddr = format!("{}:{}", self.config.host, self.config.port)
            .parse()
            .map_err(|e| format!("无效的监听地址: {e}"))?;

        let listener = TcpListener::bind(addr)
            .await
            .map_err(|e| format!("绑定端口失败: {e}"))?;

        log::info!("[MITM] 代理服务器已启动: {}", addr);
        super::mitm_log::append(&format!("代理服务器已启动: {}", addr));

        loop {
            let (stream, client_addr) = match listener.accept().await {
                Ok(conn) => conn,
                Err(e) => {
                    log::error!("[MITM] 接受连接失败: {e}");
                    continue;
                }
            };

            let cert_manager = self.cert_manager.clone();
            let config = self.config.clone();

            tokio::spawn(async move {
                if let Err(e) = handle_connection(stream, client_addr, &config, &cert_manager).await {
                    log::debug!("[MITM] 连接处理失败 {}: {}", client_addr, e);
                }
            });
        }
    }
}

/// 处理单个客户端连接
async fn handle_connection(
    mut stream: TcpStream,
    client_addr: SocketAddr,
    config: &MitmProxyConfig,
    cert_manager: &CertManager,
) -> Result<(), String> {
    // 读取第一行请求
    let mut buf = vec![0u8; 4096];
    let n = stream.read(&mut buf).await.map_err(|e| format!("读取请求失败: {e}"))?;
    if n == 0 {
        return Ok(());
    }

    let request = String::from_utf8_lossy(&buf[..n]);
    let first_line = request.lines().next().unwrap_or("");

    // 检查是否是 CONNECT 请求
    if !first_line.starts_with("CONNECT ") {
        // 非 CONNECT 请求，返回 405
        let response = "HTTP/1.1 405 Method Not Allowed\r\n\r\n";
        let _ = stream.write_all(response.as_bytes()).await;
        return Ok(());
    }

    // 解析目标地址：CONNECT host:port HTTP/1.1
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 {
        return Err("无效的 CONNECT 请求".to_string());
    }

    let target = parts[1];
    let (hostname, port) = parse_host_port(target)?;

    if config.log_requests {
        log::info!("[MITM] CONNECT {} from {}", target, client_addr);
        super::mitm_log::append(&format!("CONNECT {} from {}", target, client_addr));
    }

    // 判断是否需要 MITM 拦截
    let should_mitm = config.mitm_domains.iter().any(|d| hostname.contains(d));

    if should_mitm {
        // MITM 模式：解密 → 修改 → 重加密
        handle_mitm_connect(&mut stream, &hostname, port, config, cert_manager).await
    } else {
        // 直连模式：透明转发
        handle_direct_connect(&mut stream, &hostname, port, config).await
    }
}

/// MITM 拦截模式
async fn handle_mitm_connect(
    client_stream: &mut TcpStream,
    hostname: &str,
    port: u16,
    config: &MitmProxyConfig,
    cert_manager: &CertManager,
) -> Result<(), String> {
    // 回复 200 表示隧道建立
    client_stream
        .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        .await
        .map_err(|e| format!("回复 CONNECT 失败: {e}"))?;

    // 为目标域名生成证书
    let (cert_pem, key_pem) = cert_manager.generate_cert_for_host(hostname)?;

    // 构建 TLS 服务端配置
    let certs = rustls_pemfile::certs(&mut cert_pem.as_bytes())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("解析证书失败: {e}"))?;
    let key = rustls_pemfile::private_key(&mut key_pem.as_bytes())
        .map_err(|e| format!("解析私钥失败: {e}"))?
        .ok_or("未找到私钥")?;

    let tls_config = ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(certs, key)
        .map_err(|e| format!("构建 TLS 配置失败: {e}"))?;

    let acceptor = TlsAcceptor::from(Arc::new(tls_config));

    // 与客户端建立 TLS 连接（作为服务端）
    let mut tls_stream = acceptor
        .accept(client_stream)
        .await
        .map_err(|e| format!("TLS 握手失败: {e}"))?;

    // 读取解密后的 HTTP 请求
    let mut request_buf = vec![0u8; 1024 * 1024]; // 1MB
    let n = tls_stream
        .read(&mut request_buf)
        .await
        .map_err(|e| format!("读取 TLS 请求失败: {e}"))?;

    if n == 0 {
        return Ok(());
    }

    let request_data = &request_buf[..n];

    // 机器码替换
    let modified_request = if let Some(target_id) = &config.target_device_id {
        replace_machine_id(request_data, target_id)
    } else {
        request_data.to_vec()
    };

    // 提示词过滤（检测 Kiro IDE 系统提示并替换）
    let modified_request = filter_kiro_prompt(&modified_request);

    // 连接到真实服务器（如果配置了上游代理则经代理）
    let server_stream = connect_target(hostname, port, config.upstream_proxy.as_deref())
        .await
        .map_err(|e| format!("连接目标服务器失败: {e}"))?;

    // 与真实服务器建立 TLS 连接（作为客户端）
    let root_store = rustls::RootCertStore::from_iter(
        webpki_roots::TLS_SERVER_ROOTS.iter().cloned()
    );

    let client_config = rustls::ClientConfig::builder()
        .with_root_certificates(root_store)
        .with_no_client_auth();

    let connector = tokio_rustls::TlsConnector::from(Arc::new(client_config));

    let server_name = rustls::pki_types::ServerName::try_from(hostname.to_string())
        .map_err(|e| format!("无效的服务器名: {e}"))?;

    let mut server_tls = connector
        .connect(server_name, server_stream)
        .await
        .map_err(|e| format!("连接目标 TLS 失败: {e}"))?;

    // 发送（修改后的）请求到真实服务器
    server_tls
        .write_all(&modified_request)
        .await
        .map_err(|e| format!("发送请求到目标失败: {e}"))?;

    // 读取响应并转发回客户端
    let mut response_buf = vec![0u8; 1024 * 1024]; // 1MB
    loop {
        let n = server_tls
            .read(&mut response_buf)
            .await
            .map_err(|e| format!("读取目标响应失败: {e}"))?;
        if n == 0 {
            break;
        }
        tls_stream
            .write_all(&response_buf[..n])
            .await
            .map_err(|e| format!("转发响应失败: {e}"))?;
    }

    Ok(())
}

/// 直连模式（不拦截，透明转发）
async fn handle_direct_connect(
    client_stream: &mut TcpStream,
    hostname: &str,
    port: u16,
    config: &MitmProxyConfig,
) -> Result<(), String> {
    // 回复 200
    client_stream
        .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        .await
        .map_err(|e| format!("回复 CONNECT 失败: {e}"))?;

    // 连接目标服务器（如果配置了上游代理则经代理）
    let mut server_stream = connect_target(hostname, port, config.upstream_proxy.as_deref())
        .await
        .map_err(|e| format!("连接目标失败: {e}"))?;

    // 双向透传
    tokio::io::copy_bidirectional(client_stream, &mut server_stream)
        .await
        .map_err(|e| format!("双向转发失败: {e}"))?;

    Ok(())
}

/// 解析 host:port
fn parse_host_port(target: &str) -> Result<(String, u16), String> {
    let parts: Vec<&str> = target.rsplitn(2, ':').collect();
    if parts.len() == 2 {
        let port = parts[0].parse::<u16>().unwrap_or(443);
        let host = parts[1].to_string();
        Ok((host, port))
    } else {
        Ok((target.to_string(), 443))
    }
}

/// 连接目标服务器
///
/// 如果配置了 upstream_proxy（http://host:port），则通过该代理建立 CONNECT 隧道；
/// 否则直接 TCP 连接。
/// 用于解决与 Kiro 原本设置的 HTTPS_PROXY 冲突的问题：
/// 用户可以让 Kiro 走我们的 MITM，再让 MITM 走原本的代理出网。
async fn connect_target(
    hostname: &str,
    port: u16,
    upstream_proxy: Option<&str>,
) -> Result<TcpStream, String> {
    let Some(proxy_url) = upstream_proxy.and_then(|s| {
        let trimmed = s.trim();
        (!trimmed.is_empty()).then_some(trimmed)
    }) else {
        // 直连
        return TcpStream::connect(format!("{hostname}:{port}"))
            .await
            .map_err(|e| format!("TCP 连接失败 {hostname}:{port}: {e}"));
    };

    // 解析上游代理 URL（仅支持 http://）
    let proxy_addr = proxy_url
        .strip_prefix("http://")
        .or_else(|| proxy_url.strip_prefix("HTTP://"))
        .unwrap_or(proxy_url)
        .trim_end_matches('/');

    if proxy_addr.starts_with("socks") {
        return Err(format!("暂不支持 SOCKS 代理: {proxy_url}（请用 http://）"));
    }

    let mut stream = TcpStream::connect(proxy_addr)
        .await
        .map_err(|e| format!("连接上游代理 {proxy_addr} 失败: {e}"))?;

    // 发送 CONNECT 隧道请求
    let connect_req = format!(
        "CONNECT {hostname}:{port} HTTP/1.1\r\n\
         Host: {hostname}:{port}\r\n\
         Proxy-Connection: Keep-Alive\r\n\
         \r\n"
    );
    stream
        .write_all(connect_req.as_bytes())
        .await
        .map_err(|e| format!("发送 CONNECT 失败: {e}"))?;

    // 读取代理响应（直到 \r\n\r\n）
    let mut buf = Vec::with_capacity(512);
    let mut tmp = [0u8; 256];
    loop {
        let n = stream
            .read(&mut tmp)
            .await
            .map_err(|e| format!("读取代理响应失败: {e}"))?;
        if n == 0 {
            return Err("上游代理连接被关闭".to_string());
        }
        buf.extend_from_slice(&tmp[..n]);
        if buf.windows(4).any(|w| w == b"\r\n\r\n") {
            break;
        }
        if buf.len() > 8192 {
            return Err("上游代理响应过大".to_string());
        }
    }

    let resp = String::from_utf8_lossy(&buf);
    let first_line = resp.lines().next().unwrap_or_default();
    if !first_line.contains(" 200 ") {
        return Err(format!("上游代理拒绝 CONNECT: {first_line}"));
    }

    Ok(stream)
}

/// 64位十六进制机器码正则
const MACHINE_ID_PATTERN: &str = r"[a-f0-9]{64}";

/// 替换请求中的机器码
///
/// 替换范围：整个 HTTP 报文（headers + body），覆盖所有出现位置：
/// - User-Agent / X-Amz-User-Agent 头里的 KiroIDE/0.x.x/{64hex} 或 KiroIDE-0.x.x-{64hex}
/// - x-kiro-machineid 头（OTLP 遥测）
/// - body 里 Kiro 系统提示词模板渲染后的 `Machine ID: {64hex}`
/// - body 里 telemetry-meta 的 machineId 字段
///
/// 要求 target_id 也是 64 位小写 hex（与 IDE 内部 sha256 hash 输出格式一致），
/// 否则替换会改变报文长度导致 Content-Length 失配。
fn replace_machine_id(request_data: &[u8], target_id: &str) -> Vec<u8> {
    // 目标 ID 必须是 64 位小写 hex，否则不替换（避免长度失配）
    if target_id.len() != 64 || !target_id.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()) {
        log::warn!(
            "[MITM] 目标机器码格式不合法（应为 64 位小写十六进制），跳过替换: {}",
            target_id
        );
        return request_data.to_vec();
    }

    let request_str = String::from_utf8_lossy(request_data);
    let re = regex::Regex::new(MACHINE_ID_PATTERN).unwrap();

    let mut replaced = 0usize;
    let result = re.replace_all(&request_str, |caps: &regex::Captures| {
        let matched = caps.get(0).unwrap().as_str();
        if matched == target_id {
            return matched.to_string();
        }
        replaced += 1;
        target_id.to_string()
    });

    if replaced > 0 {
        log::info!(
            "[MITM] 已替换机器码 {} 处 → {}...",
            replaced,
            &target_id[..16]
        );
        super::mitm_log::append(&format!(
            "已替换机器码 {} 处 → {}...",
            replaced,
            &target_id[..16]
        ));
        result.as_bytes().to_vec()
    } else {
        request_data.to_vec()
    }
}

/// Kiro IDE 系统提示特征标记
const KIRO_PROMPT_MARKERS: &[&str] = &[
    "You are Kiro",
    "<goal>",
    "<subagents>",
    "<progress_reporting>",
    "<response_requirement>",
];

/// Kiro IDE 提示词精简替换
const KIRO_MINIMAL_PROMPT: &str = "You are a helpful AI assistant. Follow the user's instructions carefully. Be concise and actionable.";

/// 过滤 Kiro IDE 系统提示词
/// 检测请求体中的 Kiro 系统提示特征，替换为精简版
fn filter_kiro_prompt(request_data: &[u8]) -> Vec<u8> {
    // 尝试解析为 UTF-8
    let Ok(request_str) = std::str::from_utf8(request_data) else {
        return request_data.to_vec();
    };

    // 快速检查：是否包含 Kiro 提示特征
    let marker_count = KIRO_PROMPT_MARKERS.iter()
        .filter(|marker| request_str.contains(*marker))
        .count();

    if marker_count < 2 {
        return request_data.to_vec();
    }

    // 找到 Kiro 系统提示并替换
    // Kiro 的提示在 history 第一条 user 消息的 content 字段里
    let Ok(mut json) = serde_json::from_str::<serde_json::Value>(request_str) else {
        return request_data.to_vec();
    };

    let replaced = replace_kiro_prompt_in_payload(&mut json);
    if !replaced {
        return request_data.to_vec();
    }

    log::info!("[MITM] 已过滤 Kiro IDE 系统提示词");
    super::mitm_log::append("已过滤 Kiro IDE 系统提示词");

    match serde_json::to_vec(&json) {
        Ok(new_body) => new_body,
        Err(_) => request_data.to_vec(),
    }
}

/// 在 Kiro API payload 中替换系统提示
fn replace_kiro_prompt_in_payload(json: &mut serde_json::Value) -> bool {
    // 路径: conversationState.history[0].userInputMessage.content
    let history = json
        .pointer_mut("/conversationState/history")
        .and_then(|v| v.as_array_mut());

    let Some(history) = history else { return false };
    if history.is_empty() { return false }

    let first_item = &mut history[0];
    let content = first_item
        .pointer_mut("/userInputMessage/content")
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    let Some(content) = content else { return false };

    // 检查是否是 Kiro 系统提示
    let marker_count = KIRO_PROMPT_MARKERS.iter()
        .filter(|marker| content.contains(*marker))
        .count();

    if marker_count < 2 {
        return false;
    }

    // 替换为精简提示
    if let Some(user_msg) = first_item.pointer_mut("/userInputMessage/content") {
        *user_msg = serde_json::Value::String(KIRO_MINIMAL_PROMPT.to_string());
        return true;
    }

    false
}
