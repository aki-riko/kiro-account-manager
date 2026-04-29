export interface RequestLog {
  requestIndex: number
  outcome: 'success' | 'error' | 'streaming'
  statusCode: number
  endpoint: string
  model: string
  region: string
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  durationMs: number
  occurredAt: string
  clientIp: string
  upstreamSource: string
  stream?: boolean
  error?: string
  requestBody?: string
  responseBody?: string
}

export interface ProcessedRequestLog extends RequestLog {
  hasCache: boolean
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

export interface RequestLogSummary {
  total: number
  success: number
  streaming: number
  errors: number
  latestOccurredAt: string
  maxDurationLabel: string
  requestsWithCache: number
  cacheHitRate: string
  costSavings: string
  totalCacheReadTokens: number
  totalCacheCreationTokens: number
  totalInputTokens: number
  totalOutputTokens: number
}

export interface RequestMetrics {
  avgDurationLabel: string
  uniqueModels: number
  uniqueUpstreams: number
  total: number
  successRateLabel: string
  errorRateLabel: string
  topModels: Array<{ label: string; count: number; percent: number }>
  topUpstreams: Array<{ label: string; count: number; percent: number }>
  topStatuses: Array<{ label: string; count: number; percent: number }>
  topEndpoints: Array<{ label: string; count: number; percent: number }>
  topRegions: Array<{ label: string; count: number; percent: number }>
}

export interface ErrorHistoryItem {
  message: string
  firstSeenAt: string
  lastSeenAt: string
  count: number
}

export interface StatusSummary {
  listen: string
  requests: string
  routing: string
  exposure: string
  region: string
  logLevel: string
  sync: string
  errorCount: number
}

export interface IntegrationSummary {
  logDirState: string
  errorDigest: string
}

export interface GatewayStatus {
  running: boolean
}

export interface GatewayConfig {
  strategy: string
  localOnly: boolean
}
