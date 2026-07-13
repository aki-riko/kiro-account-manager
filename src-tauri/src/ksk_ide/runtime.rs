use std::net::{IpAddr, Ipv4Addr, SocketAddr};

use reqwest::Client;
use tokio::{net::TcpListener, sync::oneshot, task::JoinHandle};

use super::{config::KskProxyConfig, proxy};

pub struct KskProxyRuntime {
    local_addr: SocketAddr,
    shutdown_tx: Option<oneshot::Sender<()>>,
    server_task: Option<JoinHandle<Result<(), String>>>,
}

impl KskProxyRuntime {
    pub async fn spawn(config: KskProxyConfig, http: Client) -> Result<Self, String> {
        let bind_addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0);
        let listener = TcpListener::bind(bind_addr)
            .await
            .map_err(|error| format!("绑定 KSK loopback 代理失败: {error}"))?;
        let local_addr = listener
            .local_addr()
            .map_err(|error| format!("读取 KSK 代理地址失败: {error}"))?;
        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let server =
            axum::serve(listener, proxy::router(config, http)).with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            });
        let server_task = tokio::spawn(async move {
            server
                .await
                .map_err(|error| format!("KSK loopback 代理运行失败: {error}"))
        });

        Ok(Self {
            local_addr,
            shutdown_tx: Some(shutdown_tx),
            server_task: Some(server_task),
        })
    }

    pub fn local_addr(&self) -> SocketAddr {
        self.local_addr
    }

    pub async fn stop(&mut self) -> Result<(), String> {
        if let Some(shutdown_tx) = self.shutdown_tx.take() {
            let _ = shutdown_tx.send(());
        }
        if let Some(server_task) = self.server_task.take() {
            server_task
                .await
                .map_err(|error| format!("等待 KSK 代理退出失败: {error}"))??;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use axum::{
        body::{Body, Bytes},
        extract::State,
        http::{header, HeaderMap, HeaderValue, StatusCode},
        response::Response,
        routing::any,
        Router,
    };
    use serde_json::{json, Value};
    use tokio::{net::TcpListener, sync::Mutex};
    use url::Url;

    use super::KskProxyRuntime;
    use crate::ksk_ide::config::{KiroService, KskProxyConfig};

    #[derive(Clone, Default)]
    struct CaptureState {
        request: Arc<Mutex<Option<(HeaderMap, Bytes)>>>,
    }

    async fn capture_request(
        State(state): State<CaptureState>,
        headers: HeaderMap,
        body: Bytes,
    ) -> Response {
        *state.request.lock().await = Some((headers, body));
        let eventstream = Bytes::from_static(b"\x00\x00\x00\x10eventstream");
        Response::builder()
            .status(StatusCode::OK)
            .header(
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/vnd.amazon.eventstream"),
            )
            .body(Body::from(eventstream))
            .expect("mock response")
    }

    #[tokio::test]
    async fn forwards_eventstream_bytes_and_rewrites_ksk_request() {
        let capture = CaptureState::default();
        let upstream_app = Router::new()
            .fallback(any(capture_request))
            .with_state(capture.clone());
        let upstream_listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind mock upstream");
        let upstream_addr = upstream_listener.local_addr().expect("mock upstream addr");
        let upstream_task = tokio::spawn(async move {
            axum::serve(upstream_listener, upstream_app)
                .await
                .expect("serve mock upstream");
        });

        let upstream_url = Url::parse(&format!("http://{upstream_addr}/")).expect("upstream url");
        let config = KskProxyConfig::for_test(
            KiroService::Runtime,
            "us-east-1",
            "integration-test-secret",
            upstream_url,
        );
        let http = reqwest::Client::builder()
            .no_proxy()
            .build()
            .expect("test http client");
        let mut runtime = KskProxyRuntime::spawn(config, http)
            .await
            .expect("spawn proxy runtime");
        assert!(runtime.local_addr().ip().is_loopback());
        assert_ne!(runtime.local_addr().port(), 0);

        let request_body = json!({
            "profileArn": "arn:aws:codewhisperer:us-east-1:000000000000:profile/KAM-LOCAL",
            "conversationState": { "conversationId": "conversation-1" }
        });
        let response = reqwest::Client::builder()
            .no_proxy()
            .build()
            .expect("caller client")
            .post(format!("http://{}/", runtime.local_addr()))
            .header(
                "x-amz-target",
                "AmazonCodeWhispererStreamingService.GenerateAssistantResponse",
            )
            .header(header::AUTHORIZATION.as_str(), "Bearer placeholder")
            .header("TokenType", "EXTERNAL_IDP")
            .json(&request_body)
            .send()
            .await
            .expect("proxy request");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_TYPE.as_str())
                .and_then(|value| value.to_str().ok()),
            Some("application/vnd.amazon.eventstream")
        );
        assert_eq!(
            response.bytes().await.expect("response bytes"),
            Bytes::from_static(b"\x00\x00\x00\x10eventstream")
        );

        let (headers, body) = capture
            .request
            .lock()
            .await
            .clone()
            .expect("captured upstream request");
        assert_eq!(
            headers
                .get(header::AUTHORIZATION)
                .and_then(|value| value.to_str().ok()),
            Some("Bearer integration-test-secret")
        );
        assert_eq!(
            headers
                .get("tokentype")
                .and_then(|value| value.to_str().ok()),
            Some("API_KEY")
        );
        let upstream_body: Value = serde_json::from_slice(&body).expect("upstream json");
        assert!(upstream_body.get("profileArn").is_none());
        assert_eq!(
            upstream_body["conversationState"]["conversationId"],
            "conversation-1"
        );

        runtime.stop().await.expect("stop proxy runtime");
        upstream_task.abort();
    }
}
