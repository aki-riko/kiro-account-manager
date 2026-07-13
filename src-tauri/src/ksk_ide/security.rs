use axum::http::{header, HeaderMap, HeaderName, HeaderValue};

pub fn build_upstream_headers(incoming: &HeaderMap, ksk: &str) -> Result<HeaderMap, String> {
    let ksk = ksk.trim();
    if ksk.is_empty() {
        return Err("KSK 不能为空".to_string());
    }

    let mut outgoing = HeaderMap::new();
    for (name, value) in incoming {
        if !should_strip_request_header(name) {
            outgoing.append(name.clone(), value.clone());
        }
    }

    let authorization = HeaderValue::from_str(&format!("Bearer {ksk}"))
        .map_err(|error| format!("KSK 无法构造 Authorization 头: {error}"))?;
    outgoing.insert(header::AUTHORIZATION, authorization);
    outgoing.insert("tokentype", HeaderValue::from_static("API_KEY"));
    Ok(outgoing)
}

pub fn build_downstream_headers(incoming: &HeaderMap) -> HeaderMap {
    let mut outgoing = HeaderMap::new();
    for (name, value) in incoming {
        if !should_strip_response_header(name) {
            outgoing.append(name.clone(), value.clone());
        }
    }
    outgoing
}

fn should_strip_request_header(name: &HeaderName) -> bool {
    matches!(
        name.as_str(),
        "authorization"
            | "tokentype"
            | "host"
            | "content-length"
            | "connection"
            | "transfer-encoding"
            | "proxy-authorization"
            | "proxy-authenticate"
            | "keep-alive"
            | "te"
            | "trailer"
            | "upgrade"
    )
}

fn should_strip_response_header(name: &HeaderName) -> bool {
    matches!(
        name.as_str(),
        "content-length"
            | "connection"
            | "transfer-encoding"
            | "proxy-authenticate"
            | "keep-alive"
            | "te"
            | "trailer"
            | "upgrade"
    )
}

#[cfg(test)]
mod tests {
    use super::build_upstream_headers;
    use axum::http::{header, HeaderMap, HeaderValue};

    #[test]
    fn replaces_auth_and_removes_hop_by_hop_headers() {
        let mut incoming = HeaderMap::new();
        incoming.insert(
            header::AUTHORIZATION,
            HeaderValue::from_static("Bearer placeholder"),
        );
        incoming.insert("tokentype", HeaderValue::from_static("EXTERNAL_IDP"));
        incoming.insert(header::HOST, HeaderValue::from_static("127.0.0.1:3000"));
        incoming.insert(header::CONTENT_LENGTH, HeaderValue::from_static("42"));
        incoming.insert(header::CONNECTION, HeaderValue::from_static("keep-alive"));
        incoming.insert(header::USER_AGENT, HeaderValue::from_static("KiroIDE test"));

        let outgoing = build_upstream_headers(&incoming, "test-secret").expect("headers");

        assert_eq!(
            outgoing
                .get(header::AUTHORIZATION)
                .and_then(|value| value.to_str().ok()),
            Some("Bearer test-secret")
        );
        assert_eq!(
            outgoing
                .get("tokentype")
                .and_then(|value| value.to_str().ok()),
            Some("API_KEY")
        );
        assert!(outgoing.get(header::HOST).is_none());
        assert!(outgoing.get(header::CONTENT_LENGTH).is_none());
        assert!(outgoing.get(header::CONNECTION).is_none());
        assert_eq!(
            outgoing
                .get(header::USER_AGENT)
                .and_then(|value| value.to_str().ok()),
            Some("KiroIDE test")
        );
    }
}
