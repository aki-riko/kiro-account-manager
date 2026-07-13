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
    GetUsageLimits,
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

#[cfg(test)]
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
        KiroService::Management if method == Method::POST => {
            classify_list_available_models(uri, headers)
        }
        KiroService::Management if method == Method::GET => classify_get_usage_limits(uri),
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
    let path_matches = uri.path() == "/";
    let target_matches = headers
        .get("x-amz-target")
        .and_then(|target| target.to_str().ok())
        == Some("KiroControlPlaneBearerService.ListAvailableModels");

    (path_matches && target_matches).then_some(KskProxyOperation::ListAvailableModels)
}

fn classify_get_usage_limits(uri: &Uri) -> Option<KskProxyOperation> {
    if uri.path() != "/getUsageLimits" {
        return None;
    }

    let mut origin = false;
    let mut resource_type = false;
    let mut profile_arn = false;
    let mut is_email_required = false;
    for (key, value) in url::form_urlencoded::parse(uri.query()?.as_bytes()) {
        match key.as_ref() {
            "origin" if !origin && value == "AI_EDITOR" => origin = true,
            "resourceType" if !resource_type && value == "AGENTIC_REQUEST" => {
                resource_type = true;
            }
            "profileArn" if !profile_arn && !value.trim().is_empty() => profile_arn = true,
            "isEmailRequired"
                if !is_email_required && matches!(value.as_ref(), "true" | "false") =>
            {
                is_email_required = true;
            }
            _ => return None,
        }
    }

    (origin && resource_type && profile_arn).then_some(KskProxyOperation::GetUsageLimits)
}

#[cfg(test)]
mod tests {
    use super::{
        classify_operation, is_allowed_operation, KiroService, KskProxyConfig, KskProxyOperation,
    };
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
    fn management_allows_only_model_rpc_and_exact_usage_query() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-amz-target",
            HeaderValue::from_static("KiroControlPlaneBearerService.ListAvailableModels"),
        );
        let root: Uri = "/".parse().expect("root uri");
        let schema_path: Uri = "/List-Available-Models".parse().expect("schema path uri");

        assert_eq!(
            classify_operation(KiroService::Management, &Method::POST, &root, &headers,),
            Some(KskProxyOperation::ListAvailableModels)
        );
        assert!(!is_allowed_operation(
            KiroService::Management,
            &Method::GET,
            &schema_path,
            &headers,
        ));
        assert!(!is_allowed_operation(
            KiroService::Management,
            &Method::POST,
            &schema_path,
            &headers,
        ));

        headers.insert(
            "x-amz-target",
            HeaderValue::from_static("KiroControlPlaneBearerService.GetUsageLimits"),
        );
        assert!(!is_allowed_operation(
            KiroService::Management,
            &Method::POST,
            &root,
            &headers,
        ));
        assert!(!is_allowed_operation(
            KiroService::Generic,
            &Method::POST,
            &root,
            &headers,
        ));

        let usage: Uri = "/getUsageLimits?profileArn=arn%3Aaws%3Acodewhisperer%3Aus-east-1%3A000000000000%3Aprofile%2FKAM-LOCAL&origin=AI_EDITOR&resourceType=AGENTIC_REQUEST&isEmailRequired=true"
            .parse()
            .expect("usage uri");
        assert_eq!(
            classify_operation(
                KiroService::Management,
                &Method::GET,
                &usage,
                &HeaderMap::new(),
            ),
            Some(KskProxyOperation::GetUsageLimits)
        );
        assert!(!is_allowed_operation(
            KiroService::Management,
            &Method::POST,
            &usage,
            &HeaderMap::new(),
        ));
        assert!(!is_allowed_operation(
            KiroService::Generic,
            &Method::GET,
            &usage,
            &HeaderMap::new(),
        ));
        let incomplete_usage: Uri = "/getUsageLimits?origin=AI_EDITOR&resourceType=AGENTIC_REQUEST"
            .parse()
            .expect("incomplete usage uri");
        assert!(!is_allowed_operation(
            KiroService::Management,
            &Method::GET,
            &incomplete_usage,
            &HeaderMap::new(),
        ));
        let unknown_query: Uri = "/getUsageLimits?profileArn=KAM-LOCAL&origin=AI_EDITOR&resourceType=AGENTIC_REQUEST&extra=true"
            .parse()
            .expect("unknown usage query");
        assert!(!is_allowed_operation(
            KiroService::Management,
            &Method::GET,
            &unknown_query,
            &HeaderMap::new(),
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
