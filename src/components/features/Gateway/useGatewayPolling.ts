import { useEffect } from 'react'
import { fetchGatewayRequestLogs, fetchGatewayStatus } from './gatewayPageState'
import { formatGatewayTimestamp } from './gatewayPageUtils'

interface UseGatewayPollingOptions {
  activeTab: string
  fallbackConfig: any
  onStatus: (data: { status: any; fallbackConfig: any; syncedAt: string }) => void
  onRequestLogs: (data: { logs: any[]; syncedAt: string }) => void
  statusInterval?: number
  logsInterval?: number
}

export function useGatewayPolling({
  activeTab,
  fallbackConfig,
  onStatus,
  onRequestLogs,
  statusInterval = 2000,
  logsInterval = 5000
}: UseGatewayPollingOptions) {
  // 状态轮询
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    let isActive = true

    const poll = () => {
      if (!isActive || document.hidden) {
        return
      }

      fetchGatewayStatus()
        .then((status) => {
          if (isActive) {
            onStatus({
              status,
              fallbackConfig,
              syncedAt: formatGatewayTimestamp()
            })
          }
        })
        .catch((error) => {
          console.error('[Gateway] Failed to fetch status:', error)
        })
    }

    // 立即执行一次
    poll()

    // 设置定时轮询
    timer = setInterval(poll, statusInterval)

    // 监听页面可见性变化
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏时清除定时器
        if (timer) {
          clearInterval(timer)
          timer = null
        }
      } else {
        // 页面可见时重新启动轮询
        if (!timer && isActive) {
          poll()
          timer = setInterval(poll, statusInterval)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isActive = false
      if (timer) {
        clearInterval(timer)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fallbackConfig, onStatus, statusInterval])

  // 请求日志轮询
  useEffect(() => {
    if (activeTab !== 'observability') {
      return undefined
    }

    let timer: NodeJS.Timeout | null = null
    let isActive = true

    const poll = () => {
      if (!isActive || document.hidden) {
        return
      }

      fetchGatewayRequestLogs()
        .then((logs) => {
          if (isActive) {
            onRequestLogs({
              logs,
              syncedAt: formatGatewayTimestamp()
            })
          }
        })
        .catch((error) => {
          console.error('[Gateway] Failed to fetch request logs:', error)
        })
    }

    // 立即执行一次
    poll()

    // 设置定时轮询
    timer = setInterval(poll, logsInterval)

    // 监听页面可见性变化
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏时清除定时器
        if (timer) {
          clearInterval(timer)
          timer = null
        }
      } else {
        // 页面可见时重新启动轮询
        if (!timer && isActive) {
          poll()
          timer = setInterval(poll, logsInterval)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isActive = false
      if (timer) {
        clearInterval(timer)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [activeTab, onRequestLogs, logsInterval])
}
