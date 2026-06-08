import React, { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody
} from '@/components/shared/dialog'
import {
  Activity,
  RefreshCw,
  XCircle,
  Trash2,
  Database,
  FolderOpen,
  Download,
  Search,
  Check,
  Copy,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ProcessedRequestLog {
  id: string
  timestamp: string
  path: string
  status: number
  duration: number
  model?: string
  error?: string
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  upstream?: string
  errorType?: string
  outcome?: string
  stream?: boolean
  requestBody?: string
  responseBody?: string
}

interface GatewayRequestStats {
  total: number
  success: number
  error: number
  streaming: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheCreationTokens: number
  requestsWithCache: number
  maxDurationMs: number
  avgDurationMs: number
}

interface CacheStats {
  delta_cache_size: number
  lru_cache_size: number
  persistent_cache_enabled: boolean
}

interface RequestLogsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  logLevel: string
  onLogLevelChange: (level: string) => void
  logRequests: boolean
  onLogRequestsChange: (enabled: boolean) => void
  onSave?: () => void
}

function formatRequestLogAccount(upstream?: string) {
  if (!upstream) return '-'

  if (upstream.startsWith('single:') || upstream.startsWith('pool:')) {
    return upstream.split(':').slice(1).join(':') || upstream
  }

  if (upstream.startsWith('group:')) {
    return upstream.split(':').slice(2).join(':') || upstream
  }

  return upstream
}

export function RequestLogsDialog({
  open,
  onOpenChange,
  logLevel,
  onLogLevelChange,
  logRequests,
  onLogRequestsChange,
  onSave
}: RequestLogsDialogProps) {
  const [requestLogs, setRequestLogs] = useState<ProcessedRequestLog[]>([])
  const [requestStats, setRequestStats] = useState<GatewayRequestStats | null>(null)
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'success' | 'error'>('all')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const [displayLimit, setDisplayLimit] = useState(50)
  const [searchText, setSearchText] = useState('')
  const [copiedPayloadId, setCopiedPayloadId] = useState<string | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)

  const filteredLogs = requestLogs.filter(log => {
    if (activeFilter === 'success') return log.status < 400
    if (activeFilter === 'error') return log.status >= 400
    return true
  }).filter(log => {
    if (!searchText) return true
    const lower = searchText.toLowerCase()
    return (log.model?.toLowerCase().includes(lower))
      || log.path.toLowerCase().includes(lower)
      || log.upstream?.toLowerCase().includes(lower)
      || formatRequestLogAccount(log.upstream).toLowerCase().includes(lower)
      || log.error?.toLowerCase().includes(lower)
      || String(log.status).includes(lower)
  })

  const fetchRequestLogs = useCallback(async (limit?: number) => {
    setIsRefreshing(true)
    try {
      const [logs, stats, cache] = await Promise.all([
        invoke<any[]>('get_gateway_request_logs', { limit: limit || displayLimit }),
        invoke<GatewayRequestStats>('get_gateway_request_stats'),
        invoke<CacheStats>('get_cache_stats').catch(() => null)
      ])

      setRequestLogs(logs.map(log => ({
        id: `${log.requestIndex}-${log.occurredAt}`,
        timestamp: log.occurredAt,
        path: log.endpoint,
        status: log.statusCode,
        duration: log.durationMs,
        model: log.model,
        error: log.error?.length > 500 ? log.error.substring(0, 500) + '...' : log.error,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        cacheReadTokens: log.cacheReadInputTokens,
        cacheCreationTokens: log.cacheCreationInputTokens,
        upstream: log.upstreamSource,
        errorType: log.errorType,
        outcome: log.outcome,
        stream: log.stream,
        requestBody: log.requestBody,
        responseBody: log.responseBody
      })))
      setRequestStats(stats)
      if (cache) setCacheStats(cache)
    } catch (error) {
      console.error('Failed to fetch request logs:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [displayLimit])

  const handleClearCache = async () => {
    try {
      await invoke('clear_all_cache')
      setCacheStats(prev => prev ? { ...prev, delta_cache_size: 0, lru_cache_size: 0 } : null)
      toast.success('系统缓存已清理')
    } catch (err) {
      toast.error(`清理缓存失败: ${err}`)
    }
  }

  const handleClearLogs = async () => {
    if (!clearConfirm) {
      setClearConfirm(true)
      setTimeout(() => setClearConfirm(false), 3000)
      return
    }
    try {
      await invoke('clear_gateway_request_logs')
      setRequestLogs([])
      setRequestStats(null)
      setClearConfirm(false)
      toast.success('网关日志已清空')
    } catch (err) {
      toast.error(`清空失败: ${err}`)
    }
  }

  const handleExport = () => {
    const content = filteredLogs.map(log =>
      `[${log.timestamp}] ${log.status} ${log.path} ${log.model || '-'} account:${formatRequestLogAccount(log.upstream)} ${log.duration}ms in:${log.inputTokens || 0} out:${log.outputTokens || 0} cR:${log.cacheReadTokens || 0} cW:${log.cacheCreationTokens || 0}${log.error ? ' ERR:' + log.error : ''}`
    ).join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gateway-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.log`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('日志导出成功')
  }

  const handleCopyPayload = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedPayloadId(id)
      toast.success('Payload 已复制')
      setTimeout(() => setCopiedPayloadId(null), 1500)
    } catch {
      toast.error('复制失败')
    }
  }

  const formatPayload = (bodyStr?: string) => {
    if (!bodyStr) return '-'
    try {
      const parsed = JSON.parse(bodyStr)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return bodyStr
    }
  }

  // 依赖 displayLimit，修复 5 秒轮询重置显示条数 Bug
  useEffect(() => {
    if (!open) return
    fetchRequestLogs()
    const interval = setInterval(() => {
      fetchRequestLogs()
    }, 5000)
    return () => clearInterval(interval)
  }, [open, fetchRequestLogs])

  return (
    <DialogRoot open={open} onOpenChange={(v) => { onOpenChange(v); if (!v && onSave) onSave() }}>
      <DialogContent maxWidth="1000px" className="max-h-[95vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            请求日志监控
          </DialogTitle>
          <DialogDescription>实时查看网关请求记录、本地缓存命中与流量统计</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3 flex flex-col min-h-0">
          {/* 顶部：统计与缓存 */}
          <div className="flex items-center justify-between gap-2 bg-muted/20 p-2.5 rounded-lg flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">总计</span>
                <span className="font-semibold">{requestStats?.total || 0}</span>
                <span className="text-green-600 border-l pl-2 ml-1">成功</span>
                <span className="font-semibold text-green-600">{requestStats?.success || 0}</span>
                <span className="text-red-500 border-l pl-2 ml-1">错误</span>
                <span className="font-semibold text-red-500">{requestStats?.error || 0}</span>
              </div>

              {requestStats && requestStats.totalInputTokens > 0 && (
                <div className="text-xs text-muted-foreground border-l pl-3 ml-1">
                  <span>Tokens: </span>
                  <strong>{(requestStats.totalInputTokens / 1000).toFixed(1)}K</strong> 入 /
                  <strong> {(requestStats.totalOutputTokens / 1000).toFixed(1)}K</strong> 出
                  {requestStats.totalCacheReadTokens > 0 && (
                    <span className="text-blue-500 font-medium">
                      （节省 {((requestStats.totalCacheReadTokens / (requestStats.totalInputTokens + requestStats.totalCacheReadTokens)) * 100).toFixed(0)}% 输入缓存）
                    </span>
                  )}
                </div>
              )}

              {cacheStats && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-l pl-3 ml-1">
                  <Database size={11} className="text-blue-500" />
                  <span>缓存: <strong>{cacheStats.lru_cache_size + cacheStats.delta_cache_size}</strong> 项 (Delta: {cacheStats.delta_cache_size} / LRU: {cacheStats.lru_cache_size})</span>
                </div>
              )}
            </div>

            {/* 开关与缓存清理 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Switch size="sm" checked={logRequests} onCheckedChange={onLogRequestsChange} />
                <span className="text-xs text-muted-foreground">记录日志</span>
              </div>

              {cacheStats && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCache}
                  className="h-6 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 px-1.5 gap-1 font-normal"
                >
                  <Database size={10} />
                  清理缓存
                </Button>
              )}
            </div>
          </div>

          {/* 工具栏 */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1 max-w-xs">
                <Input
                  placeholder="搜索账号、模型、路径、上游或响应码..."
                  className="h-8 text-xs pl-7"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              </div>

              <select
                className="text-xs border rounded bg-background px-2 h-8 text-muted-foreground outline-none hover:border-primary/50 cursor-pointer transition-colors"
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as any)}
              >
                <option value="all">全部响应码</option>
                <option value="success">成功响应 (2xx/3xx)</option>
                <option value="error">错误响应 (4xx/5xx)</option>
              </select>

              <select
                className="text-xs border rounded bg-background px-2 h-8 text-muted-foreground outline-none hover:border-primary/50 cursor-pointer transition-colors"
                value={displayLimit}
                onChange={(e) => { setDisplayLimit(Number(e.target.value)) }}
              >
                <option value={50}>保留最新 50 条</option>
                <option value={100}>保留最新 100 条</option>
                <option value={200}>保留最新 200 条</option>
              </select>
            </div>

            {/* 操作控制 */}
            <div className="flex gap-1.5 items-center">
              <select
                className="text-xs border rounded bg-background px-2 h-8 text-muted-foreground outline-none hover:border-primary/50 cursor-pointer transition-colors mr-1"
                value={logLevel}
                onChange={(e) => onLogLevelChange(e.target.value)}
                title="网关日志级别"
              >
                <option value="debug">Debug 级别</option>
                <option value="info">Info 级别</option>
                <option value="warn">Warn 级别</option>
                <option value="error">Error 级别</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 gap-1 text-xs"
                onClick={() => invoke('open_gateway_log_dir')}
                title="打开本地日志文件夹"
              >
                <FolderOpen size={12} />
                日志目录
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 gap-1 text-xs"
                onClick={handleExport}
                disabled={filteredLogs.length === 0}
                title="导出为日志文本文件"
              >
                <Download size={12} />
                导出
              </Button>

              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 px-2 text-xs transition-all",
                  clearConfirm && "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground border-destructive"
                )}
                onClick={handleClearLogs}
                disabled={requestLogs.length === 0}
              >
                <Trash2 size={12} className="mr-1 inline-block" />
                {clearConfirm ? '确定清空？' : '清空'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => fetchRequestLogs()}
                disabled={isRefreshing}
              >
                <RefreshCw size={12} className={cn(isRefreshing && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {/* 日志表格区域 */}
          <div className="border rounded-lg flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs font-mono border-collapse">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
                  <tr className="border-b shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                    <th className="px-2 py-2 text-left w-[10px] font-sans"></th>
                    <th className="px-2 py-2 text-left w-[100px] font-sans">发生时间</th>
                    <th className="px-2 py-2 text-left w-[100px] font-sans">接口路径</th>
                    <th className="px-2 py-2 text-left w-[140px] font-sans">账号</th>
                    <th className="px-2 py-2 text-left w-[150px] font-sans">目标模型</th>
                    <th className="px-2 py-2 text-center w-[50px] font-sans" title="HTTP 响应状态码">响应码</th>
                    <th className="px-2 py-2 text-center w-[50px] font-sans">输入</th>
                    <th className="px-2 py-2 text-center w-[50px] font-sans">输出</th>
                    <th className="px-2 py-2 text-center w-[50px] font-sans" title="缓存命中 tokens">缓存读</th>
                    <th className="px-2 py-2 text-center w-[50px] font-sans" title="缓存存入 tokens">缓存写</th>
                    <th className="px-2 py-2 text-center w-[50px] font-sans">耗时</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-16 text-muted-foreground font-sans text-sm">
                        {requestLogs.length === 0 ? '等待接收网关流量中...' : '未找到匹配的请求日志'}
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      return (
                        <React.Fragment key={log.id}>
                          <tr
                            className={cn(
                              "border-b border-border/50 hover:bg-muted/40 cursor-pointer transition-colors",
                              isExpanded && "bg-muted/20"
                            )}
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          >
                            <td className="px-2 py-2 text-center text-muted-foreground">
                              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </td>
                            <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{log.timestamp}</td>
                            <td className="px-2 py-2 text-muted-foreground font-semibold truncate max-w-[140px]" title={log.path}>
                              {log.outcome?.includes('cache') && <span className="text-blue-500 mr-1" title="缓存命中">⚡</span>}
                              {log.path}
                            </td>
                            <td className="px-2 py-2 truncate max-w-[140px] text-muted-foreground" title={log.upstream || '-'}>
                              {formatRequestLogAccount(log.upstream)}
                            </td>
                            <td className="px-2 py-2 truncate max-w-[120px]" title={log.model}>{log.model || '-'}</td>
                            <td className="px-2 py-2 text-center">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                                log.status >= 400
                                  ? 'bg-destructive/10 text-destructive'
                                  : log.status >= 300
                                    ? 'bg-yellow-500/10 text-yellow-600'
                                    : 'bg-green-500/10 text-green-600'
                              )}>
                                {log.status}
                              </span>
                              {log.stream && <span className="ml-1 text-blue-400 font-semibold" title="流式响应">⇣</span>}
                            </td>
                            <td className="px-2 py-2 text-right text-muted-foreground">{log.inputTokens?.toLocaleString() || '-'}</td>
                            <td className="px-2 py-2 text-right text-muted-foreground">{log.outputTokens?.toLocaleString() || '-'}</td>
                            <td className="px-2 py-2 text-right text-blue-500 font-medium" title="缓存读取 tokens">{log.cacheReadTokens?.toLocaleString() || '-'}</td>
                            <td className="px-2 py-2 text-right text-purple-500 font-medium" title="缓存写入 tokens">{log.cacheCreationTokens?.toLocaleString() || '-'}</td>
                            <td className="px-2 py-2 text-right">
                              <span className={log.duration > 5000 ? 'text-orange-500 font-bold' : log.duration > 2000 ? 'text-yellow-600 font-medium' : 'text-muted-foreground'}>
                                {log.duration}ms
                              </span>
                            </td>
                          </tr>

                          {/* 展开详细信息（包括 Payload 格式化） */}
                          {isExpanded && (
                            <tr className="bg-muted/15 border-b">
                              <td colSpan={11} className="px-4 py-3">
                                <div className="space-y-3 font-sans">
                                  {log.error && (
                                    <div className="flex items-start gap-2 border border-destructive/20 bg-destructive/5 p-3 rounded-lg">
                                      <XCircle size={14} className="text-destructive mt-0.5 shrink-0" />
                                      <pre className="text-xs font-mono text-destructive dark:text-red-400 whitespace-pre-wrap break-all">{log.error}</pre>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* 请求体 */}
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                                        <span>请求 Payload (Request Body)</span>
                                        {log.requestBody && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 px-1.5 gap-1 text-[10px] hover:bg-muted"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleCopyPayload(log.requestBody!, 'req-' + log.id)
                                            }}
                                          >
                                            {copiedPayloadId === 'req-' + log.id ? <Check size={10} className="text-green-600" /> : <Copy size={10} />}
                                            复制
                                          </Button>
                                        )}
                                      </div>
                                      <pre className="text-[10px] font-mono bg-background p-3 rounded-lg border max-h-48 overflow-y-auto whitespace-pre-wrap break-all text-muted-foreground">
                                        {formatPayload(log.requestBody)}
                                      </pre>
                                    </div>

                                    {/* 响应体 */}
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                                        <span>EventStream 解码日志 (Decoded EventStream)</span>
                                        {log.responseBody && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 px-1.5 gap-1 text-[10px] hover:bg-muted"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleCopyPayload(log.responseBody!, 'resp-' + log.id)
                                            }}
                                          >
                                            {copiedPayloadId === 'resp-' + log.id ? <Check size={10} className="text-green-600" /> : <Copy size={10} />}
                                            复制
                                          </Button>
                                        )}
                                      </div>
                                      <pre className="text-[10px] font-mono bg-background p-3 rounded-lg border max-h-48 overflow-y-auto whitespace-pre-wrap break-all text-muted-foreground">
                                        {formatPayload(log.responseBody)}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  )
}

export default RequestLogsDialog
