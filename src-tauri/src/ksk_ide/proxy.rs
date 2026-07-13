use std::sync::Arc;

use axum::{
    body::{Body, Bytes},
    extract::State,
    http::{header, HeaderMap, HeaderValue, Method, StatusCode, Uri},
    response::Response,
    routing::any,
    Router,
};
use reqwest::Client;

use super::{
    config::{classify_operation, KskProxyConfig, KskProxyOperation},
    security::{build_downstream_headers, build_upstream_headers},
};

#[derive(Clone)]
struct ProxyState {
    config: Arc<KskProxyConfig>,
    http: Client,
}

pub fn router(config: KskProxyConfig, http: Client) -> Router {
    Router::new()
        .fallback(any(proxy_request))
        .with_state(ProxyState {
            config: Arc::new(config),
            http,
        })
}

async fn proxy_request(
    State(state): State<ProxyState>,
    method: Method,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let Some(operation) = classify_operation(state.config.service(), &method, &uri, &headers)
    else {
        return error_response(StatusCode::FORBIDDEN, "KSK 本地代理拒绝未授权操作");
    };

    let upstream_headers = match build_upstream_headers(&headers, state.config.ksk()) {
        Ok(headers) => headers,
        Err(error) => return error_response(StatusCode::BAD_REQUEST, &error),
    };
    let upstream_body = match operation {
        KskProxyOperation::GenerateAssistantResponse => match rewrite_runtime_body(&body) {
            Ok(body) => body,
            Err(error) => return error_response(StatusCode::BAD_REQUEST, &error),
        },
        KskProxyOperation::ListAvailableModels => body.to_vec(),
    };
    let upstream_url = state.config.upstream_url_for_operation(&uri, operation);

    let upstream = match state
        .http
        .request(method, upstream_url)
        .headers(upstream_headers)
        .body(upstream_body)
        .send()
        .await
    {
        Ok(response) => response,
        Err(error) => {
            log::error!("[KskIdeProxy] 上游请求失败: {error}");
            return error_response(StatusCode::BAD_GATEWAY, "KSK 上游请求失败");
        }
    };

    let status = upstream.status();
    let headers = build_downstream_headers(upstream.headers());
    let mut response = Response::new(Body::from_stream(upstream.bytes_stream()));
    *response.status_mut() = status;
    *response.headers_mut() = headers;
    response
}

fn error_response(status: StatusCode, message: &str) -> Response {
    let mut response = Response::new(Body::from(
        serde_json::json!({ "message": message }).to_string(),
    ));
    *response.status_mut() = status;
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/x-amz-json-1.0"),
    );
    response
}

pub fn rewrite_runtime_body(body: &[u8]) -> Result<Vec<u8>, String> {
    let mut value: serde_json::Value = serde_json::from_slice(body)
        .map_err(|error| format!("Kiro runtime 请求体不是有效 JSON: {error}"))?;
    let object = value
        .as_object_mut()
        .ok_or_else(|| "Kiro runtime 请求体必须是 JSON 对象".to_string())?;
    object.remove("profileArn");
    serde_json::to_vec(&value).map_err(|error| format!("序列化 Kiro runtime 请求体失败: {error}"))
}

#[cfg(test)]
mod tests {
    use super::rewrite_runtime_body;
    use serde_json::{json, Value};

    #[test]
    fn removes_only_top_level_profile_arn() {
        let source = json!({
            "profileArn": "arn:aws:codewhisperer:us-east-1:000000000000:profile/KAM-LOCAL",
            "conversationState": {
                "conversationId": "conversation-1",
                "nested": {
                    "profileArn": "keep-nested"
                }
            }
        });

        let rewritten = rewrite_runtime_body(source.to_string().as_bytes()).expect("rewrite");
        let parsed: Value = serde_json::from_slice(&rewritten).expect("valid json");

        assert!(parsed.get("profileArn").is_none());
        assert_eq!(
            parsed["conversationState"]["conversationId"],
            "conversation-1"
        );
        assert_eq!(
            parsed["conversationState"]["nested"]["profileArn"],
            "keep-nested"
        );
    }

    #[test]
    fn rejects_non_object_runtime_body() {
        assert!(rewrite_runtime_body(b"not-json").is_err());
        assert!(rewrite_runtime_body(br#"[1, 2, 3]"#).is_err());
    }
}
