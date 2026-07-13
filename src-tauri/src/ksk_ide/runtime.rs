use std::{
    net::{IpAddr, Ipv4Addr, SocketAddr},
    path::Path,
    sync::Arc,
    time::Duration as StdDuration,
};

use chrono::{DateTime, Duration as ChronoDuration, SecondsFormat, Utc};
use reqwest::Client;
use serde::Serialize;
use tokio::{net::TcpListener, sync::oneshot, task::JoinHandle};

use super::{
    config::{KiroService, KskProxyConfig},
    launcher::{ensure_isolated_launch_available, KiroIsolatedProcess},
    profile::{IsolatedIdeEndpoints, IsolatedIdeProfile},
    proxy,
};

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

struct KskProxySet {
    runtimes: Vec<(KiroService, KskProxyRuntime)>,
}

impl KskProxySet {
    async fn spawn(region: &str, ksk: Arc<str>, http: Client) -> Result<Self, String> {
        let mut set = Self {
            runtimes: Vec::new(),
        };
        for service in [
            KiroService::Runtime,
            KiroService::Generic,
            KiroService::Management,
        ] {
            let config = KskProxyConfig::from_shared(service, region, ksk.clone())?;
            match KskProxyRuntime::spawn(config, http.clone()).await {
                Ok(runtime) => set.runtimes.push((service, runtime)),
                Err(error) => return Err(set.cleanup_start_failure(error).await),
            }
        }
        Ok(set)
    }

    fn endpoints(&self) -> Result<IsolatedIdeEndpoints, String> {
        Ok(IsolatedIdeEndpoints {
            generic: self.address(KiroService::Generic)?,
            runtime: self.address(KiroService::Runtime)?,
            management: self.address(KiroService::Management)?,
        })
    }

    fn address(&self, service: KiroService) -> Result<SocketAddr, String> {
        self.runtimes
            .iter()
            .find_map(|(candidate, runtime)| (*candidate == service).then(|| runtime.local_addr()))
            .ok_or_else(|| format!("KSK {:?} 代理未启动", service))
    }

    async fn cleanup_start_failure(&mut self, error: String) -> String {
        match self.stop().await {
            Ok(()) => error,
            Err(cleanup_error) => format!("{error}; 清理已启动代理失败: {cleanup_error}"),
        }
    }

    async fn stop(&mut self) -> Result<(), String> {
        let mut errors = Vec::new();
        while let Some((service, mut runtime)) = self.runtimes.pop() {
            if let Err(error) = runtime.stop().await {
                errors.push(format!("停止 {:?} 代理失败: {error}", service));
            }
        }
        combine_errors(errors)
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KskIdeStatus {
    pub running: bool,
    pub region: Option<String>,
    pub pid: Option<u32>,
    pub session_id: Option<String>,
    pub started_at: Option<String>,
}

impl KskIdeStatus {
    pub fn idle() -> Self {
        Self {
            running: false,
            region: None,
            pid: None,
            session_id: None,
            started_at: None,
        }
    }
}

pub struct KskIdeRuntime {
    region: String,
    started_at: DateTime<Utc>,
    proxies: KskProxySet,
    profile: Option<IsolatedIdeProfile>,
    process: Option<KiroIsolatedProcess>,
}

impl KskIdeRuntime {
    pub async fn start(
        isolation_root: &Path,
        region: &str,
        ksk: &str,
        placeholder_ttl: ChronoDuration,
    ) -> Result<Self, String> {
        ensure_isolated_launch_available()?;
        let shared_ksk: Arc<str> = Arc::from(ksk.trim());
        let http = crate::clients::http_client::build_streaming_http_client()?;
        let mut proxies = KskProxySet::spawn(region, shared_ksk, http).await?;
        let endpoints = match proxies.endpoints() {
            Ok(endpoints) => endpoints,
            Err(error) => return Err(proxies.cleanup_start_failure(error).await),
        };
        let profile =
            match IsolatedIdeProfile::create(isolation_root, region, endpoints, placeholder_ttl) {
                Ok(profile) => profile,
                Err(error) => return Err(proxies.cleanup_start_failure(error).await),
            };
        let process = match KiroIsolatedProcess::launch(&profile) {
            Ok(process) => process,
            Err(error) => return Err(cleanup_launch_failure(error, &profile, &mut proxies).await),
        };
        Ok(Self {
            region: region.trim().to_string(),
            started_at: Utc::now(),
            proxies,
            profile: Some(profile),
            process: Some(process),
        })
    }

    pub fn status(&mut self) -> Result<KskIdeStatus, String> {
        let running = self
            .process
            .as_mut()
            .map(KiroIsolatedProcess::is_running)
            .transpose()?
            .unwrap_or(false);
        Ok(KskIdeStatus {
            running,
            region: Some(self.region.clone()),
            pid: self.process.as_ref().map(KiroIsolatedProcess::pid),
            session_id: self
                .profile
                .as_ref()
                .map(|profile| profile.session_id().simple().to_string()[..8].to_string()),
            started_at: Some(self.started_at.to_rfc3339_opts(SecondsFormat::Millis, true)),
        })
    }

    pub async fn stop(&mut self, process_timeout: StdDuration) -> Result<(), String> {
        let mut errors = Vec::new();
        let process_stopped = match self.stop_process(process_timeout) {
            Ok(()) => true,
            Err(error) => {
                errors.push(error);
                false
            }
        };
        if let Err(error) = self.proxies.stop().await {
            errors.push(error);
        }
        if process_stopped {
            if let Err(error) = self.cleanup_profile() {
                errors.push(error);
            }
        } else {
            errors.push("隔离 Kiro 仍在运行，已保留其 profile 以便再次停止".to_string());
        }
        combine_errors(errors)
    }

    fn stop_process(&mut self, timeout: StdDuration) -> Result<(), String> {
        let Some(process) = self.process.as_mut() else {
            return Ok(());
        };
        process.stop(timeout)?;
        self.process = None;
        Ok(())
    }

    fn cleanup_profile(&mut self) -> Result<(), String> {
        let Some(profile) = self.profile.as_ref() else {
            return Ok(());
        };
        profile.cleanup()?;
        self.profile = None;
        Ok(())
    }
}

async fn cleanup_launch_failure(
    error: String,
    profile: &IsolatedIdeProfile,
    proxies: &mut KskProxySet,
) -> String {
    let mut errors = vec![error];
    if let Err(cleanup_error) = profile.cleanup() {
        errors.push(format!("清理隔离 profile 失败: {cleanup_error}"));
    }
    if let Err(cleanup_error) = proxies.stop().await {
        errors.push(cleanup_error);
    }
    errors.join("; ")
}

fn combine_errors(errors: Vec<String>) -> Result<(), String> {
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

#[cfg(all(test, target_os = "windows"))]
mod lifecycle_tests;

#[cfg(test)]
mod tests {
    use std::{collections::HashSet, sync::Arc};

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

    use super::{KskProxyRuntime, KskProxySet};
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

    #[tokio::test]
    async fn proxy_set_uses_three_distinct_loopback_ports() {
        let http = reqwest::Client::builder()
            .no_proxy()
            .build()
            .expect("test http client");
        let mut set = KskProxySet::spawn("us-east-1", Arc::from("ksk_proxy-set-fixture"), http)
            .await
            .expect("spawn proxy set");
        let endpoints = set.endpoints().expect("proxy endpoints");
        let addresses = [endpoints.generic, endpoints.runtime, endpoints.management];

        assert!(addresses.iter().all(|address| address.ip().is_loopback()));
        assert_eq!(
            addresses
                .into_iter()
                .map(|address| address.port())
                .collect::<HashSet<_>>()
                .len(),
            3
        );

        set.stop().await.expect("stop proxy set");
    }
}
