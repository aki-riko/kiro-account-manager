import React, { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Activity, RefreshCw, XCircle } from 'lucide-react'

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
  upstream?: string
  errorType?: string
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

interface RequestLogsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  logLevel: string
  onLogLevelChange: (level: string) => void
  logRequests: boolean
  onLogRequestsChange: (enabled: boolean) => void
}

export function RequestLogsDialog({ open, onOpenChange, logLevel, onLogLevelChange, logRequests, onLogRequestsChange }: RequestLogsDialogProps) {
  const [requestLogs, setRequestLogs] = useState<ProcessedRequestLog[]>([])
  const [requestStats, setRequestStats] = useState<GatewayRequestStats | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'success' | 'error'>('all')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const [displayLimit, setDisplayLimit] = useState(50)
  const [searchText, setSearchText] = useState('')

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
      || log.error?.toLowerCase().includes(lower)
      || String(log.status).includes(lower)
  })

  const fetchRequestLogs = async (limit?: number) => {
    if (!open) return
    setIsRefreshing(true)
    try {
      const [logs, stats] = await Promise.all([
        invoke<any[]>('get_gateway_request_logs', { limit: limit || displayLimit }),
        invoke<GatewayRequestStats>('get_gateway_request_stats')
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
        upstream: log.upstreamSource,
        errorType: log.errorType
      })))
      setRequestStats(stats)
    } catch (error) {
      console.error('Failed to fetch request logs:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (!open) return
    fetchRequestLogs()
    const interval = setInterval(fetchRequestLogs, 5000)
    return () => clearInterval(interval)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>请求日志</DialogTitle>
          <DialogDescription>实时查看网关请求记录与统计</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* 顶部：统计 + 操作 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity size={16} />
              {requestStats && (
                <div className="flex items-center gap-2 text-xs">
                  <span>总 <strong>{requestStats.total}</strong></span>
                  <span className="text-green-600">成功 <strong>{requestStats.success}</strong></span>
                  <span className="text-red-600">错误 <strong>{requestStats.error}</strong></span>
                  {requestStats.totalInputTokens > 0 && (
                    <span className="text-muted-foreground">
                      {(requestStats.totalInputTokens / 1000).toFixed(1)}K入 / {(requestStats.totalOutputTokens / 1000).toFixed(1)}K出
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="搜索..."
                className="text-xs border rounded px-2 py-1 w-32"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <select
                className="text-xs border rounded px-2 py-1"
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as any)}
              >
                <option value="all">全部</option>
                <option value="success">成功</option>
                <option value="error">错误</option>
              </select>
              <select
                className="text-xs border rounded px-2 py-1"
                value={displayLimit}
                onChange={(e) => { setDisplayLimit(Number(e.target.value)); fetchRequestLogs(Number(e.target.value)) }}
              >
                <option value={50}>50条</option>
                <option value={100}>100条</option>
                <option value={200}>200条</option>
              </select>
              <Button variant="outline" size="sm" className="h-7 px-2" onClick={async () => { await invoke('clear_gateway_request_logs'); setRequestLogs([]); setRequestStats(null) }} disabled={requestLogs.length === 0}>
                清空
              </Button>
              <div className="flex items-center gap-1.5">
                <Switch size="sm" checked={logRequests} onCheckedChange={onLogRequestsChange} />
                <span className="text-xs text-muted-foreground">记录</span>
              </div>
              <select
                className="text-xs border rounded px-2 py-1"
                value={logLevel}
                onChange={(e) => onLogLevelChange(e.target.value)}
                title="日志级别"
              >
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
              <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => fetchRequestLogs()} disabled={isRefreshing}>
                <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
              </Button>
            </div>
          </div>

          {/* 日志表格 */}
          <div className="border rounded-lg">
            <div className="h-[60vh] min-h-[300px] overflow-auto">
              <table className="w-full text-xs font-mono">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                  <tr className="border-b">
                    <th className="px-2 py-1.5 text-left w-[140px]">时间</th>
                    <th className="px-2 py-1.5 text-left">路径</th>
                    <th className="px-2 py-1.5 text-left">模型</th>
                    <th className="px-2 py-1.5 text-center w-[50px]">状态</th>
                    <th className="px-2 py-1.5 text-right w-[60px]">输入</th>
                    <th className="px-2 py-1.5 text-right w-[60px]">输出</th>
                    <th className="px-2 py-1.5 text-right w-[60px]">缓存</th>
                    <th className="px-2 py-1.5 text-right w-[55px]">耗时</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16 text-muted-foreground font-sans text-sm">
                        {requestLogs.length === 0 ? '等待第一个请求...' : '无匹配结果'}
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <React.Fragment key={log.id}>
                        <tr
                          className="border-b border-border/50 hover:bg-muted/40 cursor-pointer transition-colors"
                          onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                        >
                          <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{log.timestamp}</td>
                          <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[160px]" title={log.path}>{log.path}</td>
                          <td className="px-2 py-1.5 truncate max-w-[120px]" title={log.model}>{log.model || '-'}</td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={log.status >= 400 ? 'text-red-500 font-semibold' : 'text-green-600'}>{log.status}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right text-muted-foreground">{log.inputTokens?.toLocaleString() || '-'}</td>
                          <td className="px-2 py-1.5 text-right text-muted-foreground">{log.outputTokens?.toLocaleString() || '-'}</td>
                          <td className="px-2 py-1.5 text-right text-green-600">{log.cacheReadTokens?.toLocaleString() || '-'}</td>
                          <td className="px-2 py-1.5 text-right">
                            <span className={log.duration > 3000 ? 'text-orange-500' : 'text-muted-foreground'}>{log.duration}ms</span>
                          </td>
                        </tr>
                        {expandedLogId === log.id && log.error && (
                          <tr className="bg-red-50/50 dark:bg-red-950/10">
                            <td colSpan={8} className="px-3 py-2">
                              <div className="flex items-start gap-2">
                                <XCircle size={12} className="text-red-500 mt-0.5 shrink-0" />
                                <pre className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">{log.error}</pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
