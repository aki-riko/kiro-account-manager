use axum::http::{HeaderMap, Method, Uri};
use std::{fmt, sync::Arc};
use url::Url;

use crate::clients::http_client::is_supported_kiro_region;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KiroService {
    Runtime,
    Generic,
    Management,
}

#[derive(Clone)]
pub struct KskProxyConfig {
    service: KiroService,
    region: String,
    ksk: Arc<str>,
    upstream_base: Url,
}

impl KskProxyConfig {
    pub fn new(service: KiroService, region: &str, ksk: &str) -> Result<Self, String> {
        let region = region.trim();
        if !is_supported_kiro_region(region) {
            return Err(format!("KSK 代理不支持区域: {region}"));
        }

        let ksk = ksk.trim();
        if !ksk.starts_with("ksk_") || ksk.len() <= "ksk_".len() {
            return Err("KSK 格式无效，必须使用 ksk_ 前缀".to_string());
        }

        let upstream_base = match service {
            KiroService::Runtime => format!("https://runtime.{region}.kiro.dev/"),
            KiroService::Generic => format!("https://q.{region}.amazonaws.com/"),
            KiroService::Management => format!("https://management.{region}.kiro.dev/"),
        };
        let upstream_base = Url::parse(&upstream_base)
            .map_err(|error| format!("构造 KSK 上游地址失败: {error}"))?;

        Ok(Self {
            service,
            region: region.to_string(),
            ksk: Arc::from(ksk),
            upstream_base,
        })
    }

    #[cfg(test)]
    pub fn for_test(service: KiroService, region: &str, ksk: &str, upstream_base: Url) -> Self {
        Self {
            service,
            region: region.to_string(),
            ksk: Arc::from(ksk),
            upstream_base,
        }
    }

    pub fn service(&self) -> KiroService {
        self.service
    }

    pub fn region(&self) -> &str {
        &self.region
    }

    pub fn ksk(&self) -> &str {
        &self.ksk
    }

    pub fn upstream_url(&self, uri: &Uri) -> Url {
        let mut url = self.upstream_base.clone();
        url.set_path(uri.path());
        url.set_query(uri.query());
        url
    }
}

impl fmt::Debug for KskProxyConfig {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("KskProxyConfig")
            .field("service", &self.service)
            .field("region", &self.region)
            .field("ksk", &"[REDACTED]")
            .field("upstream_base", &self.upstream_base)
            .finish()
    }
}

pub fn is_allowed_operation(
    service: KiroService,
    method: &Method,
    uri: &Uri,
    headers: &HeaderMap,
) -> bool {
    if service != KiroService::Runtime || method != Method::POST {
        return false;
    }

    let path_matches = uri
        .path()
        .trim_matches('/')
        .eq_ignore_ascii_case("generateAssistantResponse");

    match headers.get("x-amz-target") {
        Some(target) => {
            target.to_str().ok()
                == Some("AmazonCodeWhispererStreamingService.GenerateAssistantResponse")
        }
        None => path_matches,
    }
}

#[cfg(test)]
mod tests {
    use super::{is_allowed_operation, KiroService, KskProxyConfig};
    use axum::http::{HeaderMap, HeaderValue, Method, Uri};

    #[test]
    fn runtime_allows_only_generate_assistant_response() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-amz-target",
            HeaderValue::from_static(
                "AmazonCodeWhispererStreamingService.GenerateAssistantResponse",
            ),
        );
        let root: Uri = "/".parse().expect("root uri");

        assert!(is_allowed_operation(
            KiroService::Runtime,
            &Method::POST,
            &root,
            &headers,
        ));
        assert!(!is_allowed_operation(
            KiroService::Runtime,
            &Method::GET,
            &root,
            &headers,
        ));

        headers.insert(
            "x-amz-target",
            HeaderValue::from_static("AmazonCodeWhispererStreamingService.DeleteAccount"),
        );
        assert!(!is_allowed_operation(
            KiroService::Runtime,
            &Method::POST,
            &root,
            &headers,
        ));
        let generate_path: Uri = "/generateAssistantResponse"
            .parse()
            .expect("generate path uri");
        assert!(!is_allowed_operation(
            KiroService::Runtime,
            &Method::POST,
            &generate_path,
            &headers,
        ));
        assert!(!is_allowed_operation(
            KiroService::Generic,
            &Method::POST,
            &root,
            &headers,
        ));
        assert!(!is_allowed_operation(
            KiroService::Management,
            &Method::POST,
            &root,
            &headers,
        ));

        headers.remove("x-amz-target");
        assert!(is_allowed_operation(
            KiroService::Runtime,
            &Method::POST,
            &generate_path,
            &headers,
        ));
    }

    #[test]
    fn production_config_validates_region_and_redacts_ksk() {
        let config = KskProxyConfig::new(KiroService::Runtime, "us-east-1", "ksk_fixture-secret")
            .expect("valid config");

        assert_eq!(config.region(), "us-east-1");
        assert_eq!(
            config
                .upstream_url(&"/chat?x=1".parse().expect("uri"))
                .as_str(),
            "https://runtime.us-east-1.kiro.dev/chat?x=1"
        );
        let debug = format!("{config:?}");
        assert!(debug.contains("[REDACTED]"));
        assert!(!debug.contains("ksk_fixture-secret"));

        assert!(KskProxyConfig::new(
            KiroService::Runtime,
            "unsupported-region",
            "ksk_fixture-secret",
        )
        .is_err());
        assert!(KskProxyConfig::new(KiroService::Runtime, "us-east-1", "not-a-ksk",).is_err());
    }
}
