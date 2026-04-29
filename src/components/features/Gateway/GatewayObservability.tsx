import { Activity, AlertTriangle, FolderOpen, Radio, RefreshCw, Search, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatGatewayRequestDuration } from './gatewayPageUtils'
import { GatewayCodeCard, GatewayPathCard, GatewaySectionHeader, GatewayStatCard, GatewaySubCard, GatewaySurfaceCard } from './GatewayShared'
import { MetricBar } from './MetricBar'
import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type {
  RequestLog,
  ProcessedRequestLog,
  RequestLogSummary,
  RequestMetrics,
  ErrorHistoryItem,
  StatusSummary,
  IntegrationSummary,
  GatewayStatus,
  GatewayConfig
} from './types'

interface GatewayObservabilityProps {
  colors: any;
  observabilityHighlights: any[];
  effectiveConfig: GatewayConfig;
  status: GatewayStatus;
  loading: boolean;
  handleRefresh: () => Promise<void>;
  handleClearErrors: () => void;
  errorHistory: ErrorHistoryItem[];
  statusSummary: StatusSummary;
  hasUnsavedChanges: boolean;
  filteredRequestLogSummary: RequestLogSummary;
  integrationSummary: IntegrationSummary;
  logDir: string;
  handleOpenLogDir: () => Promise<void>;
  loadRequestLogs: (limit?: number) => Promise<void>;
  requestLogsLoading: boolean;
  handleClearRequestLogs: () => Promise<void>;
  requestLogs: RequestLog[];
  lastRequestLogsSyncAt: string;
  requestLogOutcome: string;
  setRequestLogOutcome: (value: string) => void;
  requestLogQuery: string;
  setRequestLogQuery: (value: string) => void;
  requestLogSummary: RequestLogSummary;
  requestMetrics: RequestMetrics;
  filteredRequestLogs: RequestLog[];
}

function GatewayErrorHistoryCard({ errorHistory }: { errorHistory: ErrorHistoryItem[] }) {
  const entries = errorHistory.length
    ? errorHistory
    : [{ message: '暂无流式错误', firstSeenAt: '-', lastSeenAt: '-', count: 1 }]

  return (
    <GatewayCodeCard title="流式 / 上游错误明细">
      <div className="flex flex-col gap-1.5 mt-2">
        {entries.map((item, idx) => (
          <GatewaySubCard key={`${item.message}-${idx}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} />
                <div className="text-sm font-semibold">错误命中 {item.count} 次</div>
              </div>
              <Badge variant="secondary">{item.lastSeenAt}</Badge>
            </div>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words">
              {`首次: ${item.firstSeenAt}\n最近: ${item.lastSeenAt}\n次数: ${item.count}\n${item.message}`}
            </pre>
          </GatewaySubCard>
        ))}
      </div>
    </GatewayCodeCard>
  )
}

function GatewayObservability({
  colors,
  observabilityHighlights,
  effectiveConfig,
  status,
  loading,
  handleRefresh,
  handleClearErrors,
  errorHistory,
  statusSummary,
  hasUnsavedChanges,
  filteredRequestLogSummary,
  integrationSummary,
  logDir,
  handleOpenLogDir,
  loadRequestLogs,
  requestLogsLoading,
  handleClearRequestLogs,
  requestLogs,
  lastRequestLogsSyncAt,
  requestLogOutcome,
  setRequestLogOutcome,
  requestLogQuery,
  setRequestLogQuery,
  requestLogSummary,
  requestMetrics,
  filteredRequestLogs}: GatewayObservabilityProps) {
  // Local state for immediate input feedback
  const [searchInput, setSearchInput] = useState(requestLogQuery)

  // Debounced search handler
  const debouncedSetQuery = useMemo(() => {
    let timeoutId: NodeJS.Timeout
    return (value: string) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setRequestLogQuery(value)
      }, 300)
    }
  }, [setRequestLogQuery])

  // Handle search input change
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setSearchInput(value)
    debouncedSetQuery(value)
  }, [debouncedSetQuery])

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {observabilityHighlights.map((item) => (
          <GatewayStatCard
            key={item.label}
            colors={colors}
            label={item.label}
            value={item.value}
            detail={item.detail}
            className={`glass-card border-border`}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] gap-4">
        <GatewaySurfaceCard colors={colors}>
          <div className="flex flex-col gap-3">
            <GatewaySectionHeader
              colors={colors}
              icon={Shield}
              title="观测总览"
              actions={(
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="flex items-center gap-1">
                    <Radio size={12} />
                    {`账号池 ${effectiveConfig.strategy}`}
                  </Badge>
                  <Badge variant={effectiveConfig.localOnly ? 'default' : 'secondary'}>{effectiveConfig.localOnly ? '仅本机' : '允许远程'}</Badge>
                  <Badge variant={status.running ? 'default' : 'destructive'}>{status.running ? '运行中' : '已停止'}</Badge>
                  <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                    <RefreshCw size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
                    刷新状态
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClearErrors} disabled={!errorHistory.length}>
                    清空错误
                  </Button>
                </div>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <GatewayStatCard colors={colors} label="监听地址" value={statusSummary.listen} />
              <GatewayStatCard colors={colors} label="请求计数" value={statusSummary.requests} />
              <GatewayStatCard colors={colors} label="路由策略" value={statusSummary.routing} />
              <GatewayStatCard colors={colors} label="暴露范围" value={statusSummary.exposure} />
              <GatewayStatCard colors={colors} label="Region / 日志级别" value={`${statusSummary.region} / ${statusSummary.logLevel}`} />
              <GatewayStatCard colors={colors} label="最后同步" value={statusSummary.sync} />
            </div>

            <Alert>
              <AlertTitle>运行摘要</AlertTitle>
              <AlertDescription>
                {`错误历史 ${statusSummary.errorCount}，当前${status.running ? '已启动' : '未启动'}，${hasUnsavedChanges ? '页面存在未保存变更。' : '页面配置已与已保存状态同步。'}`}
              </AlertDescription>
            </Alert>

            {/* Prompt Caching 统计 */}
            {requestLogSummary.requestsWithCache > 0 && (
              <GatewaySubCard>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">Prompt Caching</div>
                    <Badge variant="default" className="text-xs">节省 {requestLogSummary.costSavings}%</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">命中率</span>
                      <span className="font-semibold">{requestLogSummary.cacheHitRate}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">读</span>
                      <span className="font-semibold text-green-600">{requestLogSummary.totalCacheReadTokens.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">写</span>
                      <span className="font-semibold">{requestLogSummary.totalCacheCreationTokens.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">I/O</span>
                      <span className="font-semibold">{requestLogSummary.totalInputTokens.toLocaleString()}/{requestLogSummary.totalOutputTokens.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </GatewaySubCard>
            )}

            <GatewaySubCard>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="text-sm font-semibold">运维建议</div>
                  <Badge variant={filteredRequestLogSummary.errors ? 'secondary' : 'default'}>
                    {filteredRequestLogSummary.errors ? '优先看错误明细' : '优先看请求趋势'}
                  </Badge>
                </div>
                <div className={`text-sm text-muted-foreground`}>
                  先看顶部指标判断是否是整体异常，再结合错误聚合确认是鉴权、限流、上游返回还是流式中断；最后下钻到最近请求明细核对状态码、模型、Region、上游来源与错误信息。
                </div>
              </div>
            </GatewaySubCard>
          </div>
        </GatewaySurfaceCard>

        <GatewaySurfaceCard colors={colors}>
          <div className="flex flex-col gap-3">
            <GatewaySectionHeader
              colors={colors}
              title="运维与排障"
              badge={<Badge variant={errorHistory.length ? 'secondary' : 'default'}>{integrationSummary.errorDigest}</Badge>}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <GatewayStatCard colors={colors} label="日志状态" value={integrationSummary.logDirState} />
              <GatewayStatCard colors={colors} label="错误摘要" value={integrationSummary.errorDigest} />
            </div>

            <GatewayPathCard
              value={logDir || '尚未获取'}
              actions={(
                <Button variant="outline" onClick={handleOpenLogDir}>
                  <FolderOpen size={16} className="mr-1" />
                  打开日志目录
                </Button>
              )}
            />

            <GatewayErrorHistoryCard errorHistory={errorHistory} />
          </div>
        </GatewaySurfaceCard>
      </div>

      <div className="flex flex-col gap-4 mt-4">
        <GatewaySurfaceCard colors={colors}>
          <div className="flex flex-col gap-3">
            <GatewaySectionHeader
              colors={colors}
              icon={Activity}
              title="请求日志"
              actions={(
                <div className="flex items-center gap-2">
                  <Badge variant="default">gateway-request-log.jsonl</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadRequestLogs()}
                    disabled={requestLogsLoading}
                  >
                    <RefreshCw size={14} className={`mr-1 ${requestLogsLoading ? 'animate-spin' : ''}`} />
                    刷新日志
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearRequestLogs}
                    disabled={requestLogsLoading || !requestLogs.length}
                  >
                    清空日志
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenLogDir}
                  >
                    <FolderOpen size={14} className="mr-1" />
                    打开目录
                  </Button>
                </div>
              )}
            />

            <div className={`text-sm text-muted-foreground`}>
              这里展示最近 120 条反代请求记录，按时间倒序读取本地 JSONL 文件。最后同步时间：{lastRequestLogsSyncAt}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="outcome-filter">结果过滤</Label>
                <Select value={requestLogOutcome} onValueChange={(value) => setRequestLogOutcome(value || 'all')}>
                  <SelectTrigger id="outcome-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部结果</SelectItem>
                    <SelectItem value="success">仅成功</SelectItem>
                    <SelectItem value="stream">仅流式</SelectItem>
                    <SelectItem value="error">仅错误</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="query-search">关键词搜索</Label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="query-search"
                    placeholder="搜索模型、端点、IP、错误、上游来源或 Region"
                    value={searchInput}
                    onChange={handleSearchChange}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <GatewayStatCard colors={colors} label="显示中 / 总记录" value={`${filteredRequestLogSummary.total} / ${requestLogSummary.total}`} />
              <GatewayStatCard colors={colors} label="成功 / 流式" value={`${filteredRequestLogSummary.success} / ${filteredRequestLogSummary.streaming}`} />
              <GatewayStatCard colors={colors} label="错误数" value={filteredRequestLogSummary.errors} />
              <GatewayStatCard colors={colors} label="最新记录 / 最长耗时" value={filteredRequestLogSummary.latestOccurredAt} detail={filteredRequestLogSummary.maxDurationLabel} />
            </div>

            <GatewayPathCard value={logDir || '尚未获取'} />
          </div>
        </GatewaySurfaceCard>

        <GatewaySurfaceCard colors={colors}>
          <div className="flex flex-col gap-3">
            <GatewaySectionHeader
              colors={colors}
              icon={Radio}
              title="统计视图"
              badge={(
                <Badge variant={requestMetrics.errorRateLabel === '0%' ? 'default' : 'secondary'}>
                  成功率 {requestMetrics.successRateLabel} / 错误率 {requestMetrics.errorRateLabel}
                </Badge>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <GatewayStatCard colors={colors} label="平均耗时" value={requestMetrics.avgDurationLabel} />
              <GatewayStatCard colors={colors} label="模型数" value={requestMetrics.uniqueModels} />
              <GatewayStatCard colors={colors} label="上游来源数" value={requestMetrics.uniqueUpstreams} />
              <GatewayStatCard colors={colors} label="统计样本" value={requestMetrics.total} />
            </div>

            {/* 统计可视化 - 紧凑布局 */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {/* 热门模型 */}
              <div className="border rounded-lg p-3">
                <div className="text-xs font-semibold mb-2 text-muted-foreground">热门模型</div>
                {requestMetrics.topModels.length === 0 ? (
                  <div className="text-center py-2 text-muted-foreground text-xs">暂无统计</div>
                ) : (
                  <div className="space-y-1.5">
                    {requestMetrics.topModels.map((item: any, idx: number) => (
                      <MetricBar key={idx} label={item.label} count={item.count} percent={item.percent} />
                    ))}
                  </div>
                )}
              </div>

              {/* 热门上游来源 */}
              <div className="border rounded-lg p-3">
                <div className="text-xs font-semibold mb-2 text-muted-foreground">热门上游来源</div>
                {requestMetrics.topUpstreams.length === 0 ? (
                  <div className="text-center py-2 text-muted-foreground text-xs">暂无统计</div>
                ) : (
                  <div className="space-y-1.5">
                    {requestMetrics.topUpstreams.map((item: any, idx: number) => (
                      <MetricBar key={idx} label={item.label} count={item.count} percent={item.percent} />
                    ))}
                  </div>
                )}
              </div>

              {/* 状态码分布 */}
              <div className="border rounded-lg p-3">
                <div className="text-xs font-semibold mb-2 text-muted-foreground">状态码分布</div>
                {requestMetrics.topStatuses.length === 0 ? (
                  <div className="text-center py-2 text-muted-foreground text-xs">暂无统计</div>
                ) : (
                  <div className="space-y-1.5">
                    {requestMetrics.topStatuses.map((item: any, idx: number) => {
                      const statusCode = parseInt(item.label)
                      const isError = statusCode >= 400
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs h-5 ${isError ? 'border-red-500 text-red-500' : ''}`}
                          >
                            {item.label}
                          </Badge>
                          <MetricBar label="" count={item.count} percent={item.percent} isError={isError} className="flex-1" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 端点 / Region */}
              <div className="border rounded-lg p-3">
                <div className="text-xs font-semibold mb-2 text-muted-foreground">端点 / Region</div>
                <div className="space-y-3">
                  {/* 端点 */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5">端点</div>
                    {requestMetrics.topEndpoints.length === 0 ? (
                      <div className="text-center py-1 text-muted-foreground text-xs">暂无统计</div>
                    ) : (
                      <div className="space-y-1.5">
                        {requestMetrics.topEndpoints.map((item: any, idx: number) => (
                          <MetricBar key={idx} label={item.label} count={item.count} percent={item.percent} />
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Region */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5">Region</div>
                    {requestMetrics.topRegions.length === 0 ? (
                      <div className="text-center py-1 text-muted-foreground text-xs">暂无统计</div>
                    ) : (
                      <div className="space-y-1.5">
                        {requestMetrics.topRegions.map((item: any, idx: number) => (
                          <MetricBar key={idx} label={item.label} count={item.count} percent={item.percent} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </GatewaySurfaceCard>

        <GatewaySurfaceCard colors={colors}>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className={`font-semibold text-foreground`}>最近请求明细</div>
              <Badge variant={filteredRequestLogSummary.errors ? 'destructive' : 'default'}>
                {filteredRequestLogSummary.errors ? `${filteredRequestLogSummary.errors} 条错误` : '无错误记录'}
              </Badge>
            </div>

            {!filteredRequestLogs.length ? (
              <Alert>
                <AlertTitle>暂无请求日志</AlertTitle>
                <AlertDescription>
                  {requestLogs.length
                    ? '当前筛选条件下没有匹配结果，请调整结果过滤或搜索关键词。'
                    : '当前还没有反代请求写入本地日志文件。启动反代并发起请求后，这里会显示最新记录。'}
                </AlertDescription>
              </Alert>
            ) : (
              <VirtualizedRequestLogTable filteredRequestLogs={filteredRequestLogs} />
            )}
          </div>
        </GatewaySurfaceCard>
      </div>
    </>
  )
}

// 提取行渲染组件，使用 React.memo 优化
const RequestLogTableRow = React.memo(({
  item,
  virtualRow,
  isExpanded,
  onToggle
}: {
  item: ProcessedRequestLog
  virtualRow: any
  isExpanded: boolean
  onToggle: () => void
}) => {
  const hasDetails = !!(item.error || item.requestBody || item.responseBody)

  return (
    <div
      className={`flex flex-col text-sm border-b absolute top-0 left-0 w-full ${
        item.outcome === 'error' ? 'bg-red-50 dark:bg-red-950/20' : ''
      }`}
      style={{
        height: `${virtualRow.size}px`,
        transform: `translateY(${virtualRow.start}px)`,
      }}
    >
      <div
        className={`flex hover:bg-muted/30 transition-colors ${hasDetails ? 'cursor-pointer' : ''}`}
        onClick={hasDetails ? onToggle : undefined}
      >
      <div className="flex-shrink-0 w-[80px] p-3 font-mono text-xs text-muted-foreground">
        #{item.requestIndex ?? '-'}
      </div>
      <div className="flex-shrink-0 w-[140px] p-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Badge
              variant={item.outcome === 'success' ? 'default' : 'destructive'}
              className="text-xs"
            >
              {item.outcome || 'unknown'}
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs ${item.statusCode >= 400 ? 'border-red-500 text-red-500' : ''}`}
            >
              {item.statusCode || 0}
            </Badge>
          </div>
          {item.stream && (
            <Badge variant="outline" className="text-xs border-blue-500 text-blue-500 w-fit">
              stream
            </Badge>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 w-[120px] p-3">
        <span className="text-xs">{item.endpoint || '-'}</span>
      </div>
      <div className="flex-shrink-0 w-[160px] p-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium">{item.model || '未记录'}</span>
          <span className="text-xs text-muted-foreground">{item.region || '-'}</span>
        </div>
      </div>
      <div className="flex-shrink-0 w-[160px] p-3">
        {item.totalTokens > 0 ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-mono">{item.inputTokens.toLocaleString()} → {item.outputTokens.toLocaleString()}</span>
            {item.hasCache && (
              <span className="text-xs text-green-600">
                ⚡ {item.cacheReadTokens > 0 ? `读${item.cacheReadTokens.toLocaleString()}` : ''}{item.cacheReadTokens > 0 && item.cacheCreationTokens > 0 ? ' ' : ''}{item.cacheCreationTokens > 0 ? `写${item.cacheCreationTokens.toLocaleString()}` : ''}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </div>
      <div className="flex-shrink-0 w-[180px] p-3">
        <span className="text-xs">
          {(() => {
            const source = item.upstreamSource || '未解析'
            const parts = source.split(':')
            return parts.length > 1 ? parts[parts.length - 1] : source
          })()}
        </span>
      </div>
      <div className="flex-shrink-0 w-[100px] p-3">
        <span className="text-xs font-mono font-semibold">
          {formatGatewayRequestDuration(item.durationMs)}
        </span>
      </div>
      <div className="flex-shrink-0 w-[140px] p-3">
        <span className="text-xs text-muted-foreground">{item.occurredAt || '-'}</span>
      </div>
      <div className="flex-1 min-w-[120px] p-3">
        <span className="text-xs text-muted-foreground">{item.clientIp || '-'}</span>
      </div>
      </div>

      {/* 展开的详情区域 */}
      {isExpanded && hasDetails && (
        <div className="px-3 pb-3 border-t bg-muted/10">
          {item.error && (
            <div className="mt-2">
              <div className="text-xs text-red-600 font-semibold mb-1">错误信息</div>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
                {item.error}
              </pre>
            </div>
          )}
          {(item.requestBody || item.responseBody) && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 mt-2">
              {item.requestBody && (
                <div>
                  <div className="text-xs font-semibold mb-1">请求体</div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                    {item.requestBody}
                  </pre>
                </div>
              )}
              {item.responseBody && (
                <div>
                  <div className="text-xs font-semibold mb-1">响应体</div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                    {item.responseBody}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

RequestLogTableRow.displayName = 'RequestLogTableRow'

function VirtualizedRequestLogTable({ filteredRequestLogs }: { filteredRequestLogs: RequestLog[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [sortConfig, setSortConfig] = useState<{ key: keyof RequestLog | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'desc'
  })
  const [containerHeight, setContainerHeight] = useState(600)

  // 响应式高度调整
  useEffect(() => {
    const handleResize = () => {
      const availableHeight = window.innerHeight - 500
      setContainerHeight(Math.max(400, Math.min(800, availableHeight)))
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 预计算行数据，避免在渲染时重复计算
  const processedLogs = useMemo<ProcessedRequestLog[]>(() => {
    let logs = filteredRequestLogs.map(item => {
      const inputTokens = item.inputTokens || 0
      const outputTokens = item.outputTokens || 0
      const cacheReadTokens = item.cacheReadInputTokens || 0
      const cacheCreationTokens = item.cacheCreationInputTokens || 0

      return {
        ...item,
        hasCache: cacheReadTokens > 0 || cacheCreationTokens > 0,
        totalTokens: inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
      }
    })

    // 应用排序
    if (sortConfig.key) {
      logs.sort((a, b) => {
        const aVal = a[sortConfig.key!]
        const bVal = b[sortConfig.key!]

        if (aVal === bVal) return 0

        const comparison = aVal > bVal ? 1 : -1
        return sortConfig.direction === 'asc' ? comparison : -comparison
      })
    }

    return logs
  }, [filteredRequestLogs, sortConfig])

  // 切换排序
  const handleSort = useCallback((key: keyof RequestLog) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }, [])

  // 切换行展开状态
  const toggleRow = useCallback((index: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }, [])

  // 动态行高估算（考虑展开状态）
  const estimateSize = useCallback((index: number) => {
    const item = processedLogs[index]
    if (!item) return 80

    const isExpanded = expandedRows.has(index)
    const hasDetails = !!(item.error || item.requestBody || item.responseBody)

    // 基础高度
    let baseHeight = 80
    if (item.error) baseHeight = 100
    else if (item.stream) baseHeight = 90

    // 展开状态额外高度
    if (isExpanded && hasDetails) {
      let expandedHeight = 100
      if (item.error) expandedHeight += 80
      if (item.requestBody || item.responseBody) expandedHeight += 120
      return baseHeight + expandedHeight
    }

    return baseHeight
  }, [processedLogs, expandedRows])

  const rowVirtualizer = useVirtualizer({
    count: processedLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5,
  })

  // 筛选后自动滚动到顶部
  useEffect(() => {
    if (rowVirtualizer && processedLogs.length > 0) {
      rowVirtualizer.scrollToIndex(0, { align: 'start' })
    }
  }, [filteredRequestLogs.length, rowVirtualizer])

  const hasDetailedLogs = useMemo(
    () => filteredRequestLogs.some(item => item.error || item.requestBody || item.responseBody),
    [filteredRequestLogs]
  )

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[1200px]">
          {/* 表头 */}
          <div className="bg-muted/50 border-b">
            <div className="flex text-sm">
              <div className="flex-shrink-0 w-[80px] p-3 font-semibold">#</div>
              <div
                className="flex-shrink-0 w-[140px] p-3 font-semibold cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => handleSort('statusCode')}
              >
                状态 {sortConfig.key === 'statusCode' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </div>
              <div className="flex-shrink-0 w-[120px] p-3 font-semibold">端点</div>
              <div
                className="flex-shrink-0 w-[160px] p-3 font-semibold cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => handleSort('model')}
              >
                模型 {sortConfig.key === 'model' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </div>
              <div className="flex-shrink-0 w-[160px] p-3 font-semibold">Tokens</div>
              <div className="flex-shrink-0 w-[180px] p-3 font-semibold">账号</div>
              <div
                className="flex-shrink-0 w-[100px] p-3 font-semibold cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => handleSort('durationMs')}
              >
                耗时 {sortConfig.key === 'durationMs' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </div>
              <div
                className="flex-shrink-0 w-[140px] p-3 font-semibold cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => handleSort('occurredAt')}
              >
                时间 {sortConfig.key === 'occurredAt' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </div>
              <div className="flex-1 min-w-[120px] p-3 font-semibold">客户端</div>
            </div>
          </div>

          {/* 虚拟化表体 */}
          <div
            ref={parentRef}
            className="overflow-auto"
            style={{ height: `${containerHeight}px` }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                <RequestLogTableRow
                  key={virtualRow.key}
                  item={processedLogs[virtualRow.index]}
                  virtualRow={virtualRow}
                  isExpanded={expandedRows.has(virtualRow.index)}
                  onToggle={() => toggleRow(virtualRow.index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 展开详情（可选） */}
      {hasDetailedLogs && (
        <div className="border-t bg-muted/20 p-3">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              查看详细日志（错误信息、请求/响应体）
            </summary>
            <div className="mt-3 space-y-3">
              {filteredRequestLogs.map((item, idx) => {
                if (!item.error && !item.requestBody && !item.responseBody) return null
                return (
                  <div key={`detail-${idx}`} className="border rounded-lg p-3 bg-background">
                    <div className="text-xs font-semibold mb-2">
                      #{item.requestIndex ?? '-'} - {item.occurredAt || '-'}
                    </div>
                    {item.error && (
                      <div className="mb-2">
                        <div className="text-xs text-red-600 font-semibold mb-1">错误信息</div>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
                          {item.error}
                        </pre>
                      </div>
                    )}
                    {(item.requestBody || item.responseBody) && (
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                        {item.requestBody && (
                          <div>
                            <div className="text-xs font-semibold mb-1">请求体</div>
                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                              {item.requestBody}
                            </pre>
                          </div>
                        )}
                        {item.responseBody && (
                          <div>
                            <div className="text-xs font-semibold mb-1">响应体</div>
                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                              {item.responseBody}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

export default GatewayObservability
