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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KskProxyOperation {
    GenerateAssistantResponse,
    ListAvailableModels,
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
        Self::from_shared(service, region, Arc::from(ksk.trim()))
    }

    pub(crate) fn from_shared(
        service: KiroService,
        region: &str,
        ksk: Arc<str>,
    ) -> Result<Self, String> {
        let region = region.trim();
        if !is_supported_kiro_region(region) {
            return Err(format!("KSK 代理不支持区域: {region}"));
        }

        let ksk_value = ksk.as_ref();
        if ksk_value != ksk_value.trim() {
            return Err("KSK 不得包含首尾空白".to_string());
        }
        if !ksk_value.starts_with("ksk_") || ksk_value.len() <= "ksk_".len() {
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
            ksk,
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

    pub fn upstream_url_for_operation(&self, uri: &Uri, operation: KskProxyOperation) -> Url {
        let mut url = self.upstream_url(uri);
        if operation != KskProxyOperation::ListAvailableModels {
            return url;
        }

        let query_pairs = url
            .query_pairs()
            .filter(|(name, _)| !name.eq_ignore_ascii_case("profileArn"))
            .map(|(name, value)| (name.into_owned(), value.into_owned()))
            .collect::<Vec<_>>();
        url.set_query(None);
        if !query_pairs.is_empty() {
            let mut query = url.query_pairs_mut();
            for (name, value) in query_pairs {
                query.append_pair(&name, &value);
            }
        }
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
    classify_operation(service, method, uri, headers).is_some()
}

pub fn classify_operation(
    service: KiroService,
    method: &Method,
    uri: &Uri,
    headers: &HeaderMap,
) -> Option<KskProxyOperation> {
    match service {
        KiroService::Runtime if method == Method::POST => {
            classify_generate_assistant_response(uri, headers)
        }
        KiroService::Management if method == Method::GET => {
            classify_list_available_models(uri, headers)
        }
        KiroService::Runtime | KiroService::Generic | KiroService::Management => None,
    }
}

fn classify_generate_assistant_response(
    uri: &Uri,
    headers: &HeaderMap,
) -> Option<KskProxyOperation> {
    let path_matches = uri
        .path()
        .trim_matches('/')
        .eq_ignore_ascii_case("generateAssistantResponse");

    match headers.get("x-amz-target") {
        Some(target) => (target.to_str().ok()
            == Some("AmazonCodeWhispererStreamingService.GenerateAssistantResponse"))
        .then_some(KskProxyOperation::GenerateAssistantResponse),
        None => path_matches.then_some(KskProxyOperation::GenerateAssistantResponse),
    }
}

fn classify_list_available_models(uri: &Uri, headers: &HeaderMap) -> Option<KskProxyOperation> {
    let path_matches = uri
        .path()
        .trim_matches('/')
        .eq_ignore_ascii_case("List-Available-Models");
    let target_matches = headers
        .get("x-amz-target")
        .and_then(|target| target.to_str().ok())
        == Some("KiroControlPlaneBearerService.ListAvailableModels");

    (path_matches && target_matches).then_some(KskProxyOperation::ListAvailableModels)
}

#[cfg(test)]
mod tests {
    use super::{
        classify_operation, is_allowed_operation, KiroService, KskProxyConfig, KskProxyOperation,
    };
    use axum::http::{HeaderMap, HeaderValue, Method, Uri};
    use url::Url;

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
    fn management_allows_only_list_available_models() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-amz-target",
            HeaderValue::from_static("KiroControlPlaneBearerService.ListAvailableModels"),
        );
        let with_slash: Uri = "/List-Available-Models/?origin=AI_EDITOR&profileArn=placeholder"
            .parse()
            .expect("model list uri");
        let without_slash: Uri = "/List-Available-Models?origin=AI_EDITOR"
            .parse()
            .expect("model list uri");

        assert_eq!(
            classify_operation(KiroService::Management, &Method::GET, &with_slash, &headers,),
            Some(KskProxyOperation::ListAvailableModels)
        );
        assert!(is_allowed_operation(
            KiroService::Management,
            &Method::GET,
            &without_slash,
            &headers,
        ));
        assert!(!is_allowed_operation(
            KiroService::Management,
            &Method::POST,
            &with_slash,
            &headers,
        ));

        headers.insert(
            "x-amz-target",
            HeaderValue::from_static("KiroControlPlaneBearerService.GetUsageLimits"),
        );
        assert!(!is_allowed_operation(
            KiroService::Management,
            &Method::GET,
            &with_slash,
            &headers,
        ));
        assert!(!is_allowed_operation(
            KiroService::Generic,
            &Method::GET,
            &with_slash,
            &headers,
        ));
    }

    #[test]
    fn model_list_upstream_url_removes_only_placeholder_profile() {
        let config = KskProxyConfig::for_test(
            KiroService::Management,
            "us-east-1",
            "ksk_fixture-secret",
            Url::parse("https://management.us-east-1.kiro.dev/").expect("management url"),
        );
        let uri: Uri = "/List-Available-Models/?origin=AI_EDITOR&profileArn=KAM-LOCAL&nextToken=page-2&maxResults=20"
            .parse()
            .expect("model list uri");

        let upstream =
            config.upstream_url_for_operation(&uri, KskProxyOperation::ListAvailableModels);
        let query = upstream
            .query_pairs()
            .map(|(name, value)| (name.into_owned(), value.into_owned()))
            .collect::<Vec<_>>();

        assert_eq!(upstream.path(), "/List-Available-Models/");
        assert!(query.contains(&("origin".to_string(), "AI_EDITOR".to_string())));
        assert!(query.contains(&("nextToken".to_string(), "page-2".to_string())));
        assert!(query.contains(&("maxResults".to_string(), "20".to_string())));
        assert!(!query.iter().any(|(name, _)| name == "profileArn"));
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
