import { useMemo, useState, useEffect } from 'react'
import { Users, CheckCircle2, AlertCircle, Clock, TrendingUp, Zap, ChevronDown, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getThemeAccent } from '../KiroConfig/themeAccent'
import { useApp } from '../../../hooks/useApp'
import { invoke } from '@tauri-apps/api/core'
import React from 'react'

interface Account {
  id: string
  label: string
  email?: string
  userId?: string
  provider: string
  groupId?: string
  usageData?: {
    usagePercent?: number
    remaining?: number
    total?: number
  }
  isAvailable?: boolean
  healthScore?: number
  successCount?: number
  failureCount?: number
  activeConnections?: number
}

interface AccountPoolStatusProps {
  config: any
  accounts: Account[]
  groups: any[]
}

function AccountPoolStatus({ config, accounts, groups }: AccountPoolStatusProps) {
  const { theme } = useApp()
  const accent = useMemo(() => getThemeAccent(theme), [theme])
  const [expanded, setExpanded] = useState(true)
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null)

  // 获取当前使用的账号
  useEffect(() => {
    invoke<any>('get_current_user')
      .then(user => setCurrentAccountId(user?.id || null))
      .catch(() => setCurrentAccountId(null))
  }, [])

  // 根据配置筛选账号池
  const poolAccounts = useMemo(() => {
    if (config.accountMode === 'single') {
      return accounts.filter(a => a.id === config.accountId)
    } else if (config.accountMode === 'group') {
      return accounts.filter(a => a.groupId === config.groupId && a.isAvailable !== false)
    }
    return []
  }, [config.accountMode, config.accountId, config.groupId, accounts])

  // 计算池子统计
  const poolStats = useMemo(() => {
    const total = poolAccounts.length
    const available = poolAccounts.filter(a => {
      const usage = a.usageData?.usagePercent || 0
      return usage < (config.threshold || 90)
    }).length
    const avgUsage = total > 0
      ? poolAccounts.reduce((sum, a) => sum + (a.usageData?.usagePercent || 0), 0) / total
      : 0

    return { total, available, avgUsage }
  }, [poolAccounts, config.threshold])

  // 获取分组名称
  const groupName = useMemo(() => {
    if (config.accountMode === 'group' && config.groupId) {
      return groups.find(g => g.id === config.groupId)?.name || config.groupId
    }
    return null
  }, [config.accountMode, config.groupId, groups])

  if (poolAccounts.length === 0) {
    return null
  }

  return (
    <Card className="border rounded-xl p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <Users size={18} className={accent.text} />
            <span className="font-semibold text-foreground">
              账号池状态
              {groupName && <span className="text-muted-foreground ml-2">({groupName})</span>}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <Badge variant={poolStats.available > 0 ? 'default' : 'destructive'}>
              {poolStats.available}/{poolStats.total} 可用
            </Badge>
          </div>
        </div>

        {expanded && (
          <>
            {/* 统计卡片 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Users size={14} />
                  总账号数
                </div>
                <div className="text-2xl font-bold text-foreground">{poolStats.total}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <CheckCircle2 size={14} />
                  可用账号
                </div>
                <div className="text-2xl font-bold text-green-600">{poolStats.available}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <TrendingUp size={14} />
                  平均使用率
                </div>
                <div className="text-2xl font-bold text-foreground">{poolStats.avgUsage.toFixed(0)}%</div>
              </div>
            </div>

            {/* 账号列表 */}
            <div className="space-y-2">
              {poolAccounts.map((account, index) => {
                const usage = account.usageData?.usagePercent || 0
                const isOverThreshold = usage >= (config.threshold || 90)
                const isCurrent = account.id === currentAccountId
                const isAvailable = !isOverThreshold

                // Calculate health score and metrics
                const healthScore = account.healthScore ?? null
                const successCount = account.successCount ?? 0
                const failureCount = account.failureCount ?? 0
                const activeConnections = account.activeConnections ?? 0
                const totalRequests = successCount + failureCount
                const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : null

                // Determine health badge color
                const getHealthBadgeVariant = (score: number | null) => {
                  if (score === null) return 'outline'
                  if (score >= 80) return 'default' // green
                  if (score >= 50) return 'secondary' // yellow
                  return 'destructive' // red
                }

                return (
                  <div
                    key={account.id}
                    className={`border rounded-lg p-3 transition-all ${
                      isCurrent
                        ? `border-primary bg-primary/5 shadow-sm`
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* 左侧：账号信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {/* 序号 */}
                          <span className="text-xs font-mono text-muted-foreground">
                            #{index + 1}
                          </span>
                          {/* 账号标签 */}
                          <span className="font-medium text-foreground truncate">
                            {account.label}
                          </span>
                          {/* 当前使用标记 */}
                          {isCurrent && (
                            <Badge variant="default" className="text-xs">
                              <Zap size={10} className="mr-1" />
                              当前
                            </Badge>
                          )}
                          {/* 状态标记 */}
                          {isAvailable ? (
                            <CheckCircle2 size={14} className="text-green-600" />
                          ) : (
                            <AlertCircle size={14} className="text-orange-600" />
                          )}
                          {/* 健康分数 */}
                          {healthScore !== null && (
                            <Badge variant={getHealthBadgeVariant(healthScore)} className="text-xs">
                              健康 {healthScore.toFixed(0)}
                            </Badge>
                          )}
                        </div>
                        {/* 邮箱/用户ID */}
                        <div className="text-xs text-muted-foreground truncate">
                          {account.email || account.userId || account.id}
                        </div>
                        {/* 健康指标 */}
                        {(totalRequests > 0 || activeConnections > 0) && (
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            {totalRequests > 0 && (
                              <span>
                                成功 <span className="text-green-600 font-semibold">{successCount}</span>
                                {failureCount > 0 && (
                                  <> / 失败 <span className="text-red-600 font-semibold">{failureCount}</span></>
                                )}
                                {successRate !== null && (
                                  <> ({successRate.toFixed(0)}%)</>
                                )}
                              </span>
                            )}
                            {activeConnections > 0 && (
                              <span className="flex items-center gap-1">
                                <Activity size={10} />
                                连接 <span className="font-semibold">{activeConnections}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 右侧：配额信息 */}
                      <div className="flex flex-col items-end gap-1 min-w-[100px]">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${
                            isOverThreshold ? 'text-orange-600' : 'text-foreground'
                          }`}>
                            {usage.toFixed(0)}%
                          </span>
                          {account.usageData?.remaining !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              剩余 {account.usageData.remaining}
                            </span>
                          )}
                        </div>
                        {/* 进度条 */}
                        <Progress
                          value={usage}
                          className="h-1.5 w-full"
                          indicatorClassName={
                            isOverThreshold
                              ? 'bg-orange-600'
                              : usage > 70
                              ? 'bg-yellow-600'
                              : 'bg-green-600'
                          }
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 轮询策略提示 */}
            {config.accountMode === 'group' && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Clock size={16} className="text-blue-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-blue-800 dark:text-blue-200">
                    <div className="font-semibold mb-1">
                      轮询策略：
                      {config.strategy === 'round_robin' && '轮询'}
                      {config.strategy === 'balanced' && '均衡使用'}
                      {config.strategy === 'most_quota' && '优先剩余额度'}
                      {config.strategy === 'random' && '随机'}
                      {config.strategy === 'weighted_random' && '加权随机'}
                      {config.strategy === 'least_connections' && '最少连接'}
                    </div>
                    <div>
                      {config.strategy === 'round_robin' && '按顺序依次使用账号，配额超过阈值时自动切换到下一个'}
                      {config.strategy === 'balanced' && '优先使用成功次数最少的账号，实现负载均衡'}
                      {config.strategy === 'most_quota' && '优先使用剩余配额最多的账号'}
                      {config.strategy === 'random' && '随机选择账号'}
                      {config.strategy === 'weighted_random' && '根据健康分数和剩余配额加权随机选择，配额多且健康的账号被选中概率更高'}
                      {config.strategy === 'least_connections' && '优先使用当前活跃连接数最少的账号，适合高并发场景'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

export default AccountPoolStatus
