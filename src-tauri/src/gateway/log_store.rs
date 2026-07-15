use crate::gateway::GatewayRequestLogEntry;
/// 内存日志存储模块
///
use std::sync::Arc;
use tokio::sync::RwLock;

/// 内存日志存储
#[derive(Debug, Clone)]
pub struct LogStore {
    inner: Arc<RwLock<LogStoreInner>>,
}

#[derive(Debug)]
struct LogStoreInner {
    /// 日志列表（按请求索引排序，最新的在后面）
    logs: Vec<GatewayRequestLogEntry>,
    /// 最大保存条数
    max_logs: usize,
}
impl LogStore {
    /// 创建新的日志存储
    ///
    /// # Arguments
    /// * `max_logs` - 最大保存的日志条数（默认 10000）
    pub fn new(max_logs: usize) -> Self {
        Self {
            inner: Arc::new(RwLock::new(LogStoreInner {
                logs: Vec::with_capacity(max_logs.min(1000)),
                max_logs,
            })),
        }
    }

    /// 添加一条日志
    pub async fn add(&self, entry: GatewayRequestLogEntry) {
        let mut inner = self.inner.write().await;

        // 添加到存储
        inner.logs.push(entry.clone());

        // 超过最大数量时删除最旧的
        if inner.logs.len() > inner.max_logs {
            // 保留最新的 max_logs 条
            let drain_count = inner.logs.len() - inner.max_logs;
            inner.logs.drain(0..drain_count);
        }
    }

    /// 获取所有日志
    pub async fn get_all(&self) -> Vec<GatewayRequestLogEntry> {
        let inner = self.inner.read().await;
        inner.logs.clone()
    }

    /// 获取最近 N 条日志
    pub async fn get_last(&self, count: usize) -> Vec<GatewayRequestLogEntry> {
        let inner = self.inner.read().await;
        let start = inner.logs.len().saturating_sub(count);
        inner.logs[start..].to_vec()
    }

    /// 清空所有日志
    pub async fn clear(&self) {
        let mut inner = self.inner.write().await;
        inner.logs.clear();
    }

    /// 获取日志统计信息
    pub async fn get_stats(&self) -> LogStats {
        let inner = self.inner.read().await;

        let mut stats = LogStats {
            total: inner.logs.len(),
            success: 0,
            error: 0,
            streaming: 0,
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cache_read_tokens: 0,
            total_cache_creation_tokens: 0,
            avg_duration_ms: 0,
            requests_with_cache: 0,
        };

        if inner.logs.is_empty() {
            return stats;
        }

        let mut total_duration: u64 = 0;

        for log in &inner.logs {
            if log.status_code < 400 {
                stats.success += 1;
            } else {
                stats.error += 1;
            }

            if log.stream {
                stats.streaming += 1;
            }

            stats.total_input_tokens += log.input_tokens.unwrap_or(0);
            stats.total_output_tokens += log.output_tokens.unwrap_or(0);
            stats.total_cache_read_tokens += log.cache_read_input_tokens.unwrap_or(0);
            stats.total_cache_creation_tokens += log.cache_creation_input_tokens.unwrap_or(0);

            if log.cache_read_input_tokens.unwrap_or(0) > 0
                || log.cache_creation_input_tokens.unwrap_or(0) > 0
            {
                stats.requests_with_cache += 1;
            }

            total_duration += log.duration_ms;
        }

        stats.avg_duration_ms = (total_duration as f64 / inner.logs.len() as f64) as u64;

        stats
    }

    /// 按模型分组统计
    pub async fn get_model_stats(&self) -> Vec<ModelStat> {
        let inner = self.inner.read().await;

        let mut model_map: std::collections::HashMap<String, ModelStat> =
            std::collections::HashMap::new();

        for log in &inner.logs {
            let model = log.model.clone().unwrap_or_else(|| "unknown".to_string());
            let stat = model_map.entry(model.clone()).or_insert(ModelStat {
                model,
                count: 0,
                success: 0,
                error: 0,
                total_input_tokens: 0,
                total_output_tokens: 0,
            });

            stat.count += 1;
            if log.outcome == "success" {
                stat.success += 1;
            } else if log.outcome == "error" {
                stat.error += 1;
            }
            stat.total_input_tokens += log.input_tokens.unwrap_or(0);
            stat.total_output_tokens += log.output_tokens.unwrap_or(0);
        }

        let mut stats: Vec<ModelStat> = model_map.into_values().collect();
        stats.sort_by_key(|stat| std::cmp::Reverse(stat.count));
        stats
    }

    /// 按端点分组统计
    pub async fn get_endpoint_stats(&self) -> Vec<EndpointStat> {
        let inner = self.inner.read().await;

        let mut endpoint_map: std::collections::HashMap<String, EndpointStat> =
            std::collections::HashMap::new();

        for log in &inner.logs {
            let stat = endpoint_map
                .entry(log.endpoint.clone())
                .or_insert(EndpointStat {
                    endpoint: log.endpoint.clone(),
                    count: 0,
                    success: 0,
                    error: 0,
                });

            stat.count += 1;
            if log.outcome == "success" {
                stat.success += 1;
            } else if log.outcome == "error" {
                stat.error += 1;
            }
        }

        let mut stats: Vec<EndpointStat> = endpoint_map.into_values().collect();
        stats.sort_by_key(|stat| std::cmp::Reverse(stat.count));
        stats
    }
}

impl Default for LogStore {
    fn default() -> Self {
        Self::new(10000) // 默认保存 10000 条日志
    }
}

/// 日志统计信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogStats {
    pub total: usize,
    pub success: usize,
    pub error: usize,
    pub streaming: usize,
    pub total_input_tokens: i32,
    pub total_output_tokens: i32,
    pub total_cache_read_tokens: i32,
    pub total_cache_creation_tokens: i32,
    pub avg_duration_ms: u64,
    pub requests_with_cache: usize,
}

/// 模型统计信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStat {
    pub model: String,
    pub count: usize,
    pub success: usize,
    pub error: usize,
    pub total_input_tokens: i32,
    pub total_output_tokens: i32,
}

/// 端点统计信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EndpointStat {
    pub endpoint: String,
    pub count: usize,
    pub success: usize,
    pub error: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_log(index: u64, outcome: &str, model: &str) -> GatewayRequestLogEntry {
        GatewayRequestLogEntry {
            occurred_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            request_id: uuid::Uuid::new_v4().to_string(),
            request_index: index,
            endpoint: "messages".to_string(),
            client_ip: "127.0.0.1".to_string(),
            model: Some(model.to_string()),
            stream: false,
            upstream_source: Some("test".to_string()),
            region: Some("us-east-1".to_string()),
            status_code: if outcome == "success" { 200 } else { 500 },
            outcome: outcome.to_string(),
            duration_ms: 1000,
            error: if outcome == "error" {
                Some("test error".to_string())
            } else {
                None
            },
            request_body: None,
            response_body: None,
            input_tokens: Some(100),
            output_tokens: Some(50),
            cache_read_input_tokens: None,
            cache_creation_input_tokens: None,
            error_type: None,
            stream_info: None,
            request_summary: None,
            response_summary: None,
        }
    }

    #[tokio::test]
    async fn test_log_store_add_and_get() {
        let store = LogStore::new(100);

        let log1 = create_test_log(1, "success", "claude-sonnet-4.5");
        let log2 = create_test_log(2, "error", "claude-opus-4");

        store.add(log1.clone()).await;
        store.add(log2.clone()).await;

        let all_logs = store.get_all().await;
        assert_eq!(all_logs.len(), 2);
        assert_eq!(all_logs[0].request_index, 1);
        assert_eq!(all_logs[1].request_index, 2);
    }

    #[tokio::test]
    async fn test_log_store_max_limit() {
        let store = LogStore::new(5);

        // 添加 10 条日志
        for i in 0..10 {
            store
                .add(create_test_log(i, "success", "claude-sonnet-4.5"))
                .await;
        }

        let all_logs = store.get_all().await;
        assert_eq!(all_logs.len(), 5); // 只保留最新的 5 条
        assert_eq!(all_logs[0].request_index, 5); // 最旧的是 #5
        assert_eq!(all_logs[4].request_index, 9); // 最新的是 #9
    }

    #[tokio::test]
    async fn test_log_store_get_last() {
        let store = LogStore::new(100);

        for i in 0..10 {
            store
                .add(create_test_log(i, "success", "claude-sonnet-4.5"))
                .await;
        }

        let last_3 = store.get_last(3).await;
        assert_eq!(last_3.len(), 3);
        assert_eq!(last_3[0].request_index, 7);
        assert_eq!(last_3[2].request_index, 9);
    }

    #[tokio::test]
    async fn test_log_store_stats() {
        let store = LogStore::new(100);

        store
            .add(create_test_log(1, "success", "claude-sonnet-4.5"))
            .await;
        store
            .add(create_test_log(2, "success", "claude-sonnet-4.5"))
            .await;
        store
            .add(create_test_log(3, "error", "claude-opus-4"))
            .await;

        let stats = store.get_stats().await;
        assert_eq!(stats.total, 3);
        assert_eq!(stats.success, 2);
        assert_eq!(stats.error, 1);
        assert_eq!(stats.total_input_tokens, 300); // 3 * 100
        assert_eq!(stats.total_output_tokens, 150); // 3 * 50
    }

    #[tokio::test]
    async fn test_log_store_stats_counts_http_successes_and_stream_flag() {
        let store = LogStore::new(100);

        let mut stream_log = create_test_log(1, "stream", "claude-sonnet-4.5");
        stream_log.status_code = 200;
        stream_log.stream = true;

        let mut cached_log = create_test_log(2, "success (cached)", "claude-sonnet-4.5");
        cached_log.status_code = 200;

        store.add(stream_log).await;
        store.add(cached_log).await;
        store
            .add(create_test_log(3, "error", "claude-opus-4"))
            .await;

        let stats = store.get_stats().await;
        assert_eq!(stats.total, 3);
        assert_eq!(stats.success, 2);
        assert_eq!(stats.error, 1);
        assert_eq!(stats.streaming, 1);
    }

    #[tokio::test]
    async fn test_log_store_model_stats() {
        let store = LogStore::new(100);

        store
            .add(create_test_log(1, "success", "claude-sonnet-4.5"))
            .await;
        store
            .add(create_test_log(2, "success", "claude-sonnet-4.5"))
            .await;
        store
            .add(create_test_log(3, "error", "claude-opus-4"))
            .await;

        let model_stats = store.get_model_stats().await;
        assert_eq!(model_stats.len(), 2);

        // 按 count 降序排列
        assert_eq!(model_stats[0].model, "claude-sonnet-4.5");
        assert_eq!(model_stats[0].count, 2);
        assert_eq!(model_stats[0].success, 2);

        assert_eq!(model_stats[1].model, "claude-opus-4");
        assert_eq!(model_stats[1].count, 1);
        assert_eq!(model_stats[1].error, 1);
    }

    #[tokio::test]
    async fn test_log_store_clear() {
        let store = LogStore::new(100);

        store
            .add(create_test_log(1, "success", "claude-sonnet-4.5"))
            .await;
        store
            .add(create_test_log(2, "success", "claude-sonnet-4.5"))
            .await;

        assert_eq!(store.get_all().await.len(), 2);

        store.clear().await;

        assert_eq!(store.get_all().await.len(), 0);
    }
}
