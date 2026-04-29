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
  useEffect(() => {
    const timer = setInterval(() => {
      // 暂停不可见标签页的轮询以节省资源
      if (document.hidden) {
        return
      }

      fetchGatewayStatus()
        .then((status) => {
          onStatus({
            status,
            fallbackConfig,
            syncedAt: formatGatewayTimestamp()
          })
        })
        .catch(() => {})
    }, statusInterval)

    return () => clearInterval(timer)
  }, [fallbackConfig, onStatus, statusInterval])

  useEffect(() => {
    if (activeTab !== 'observability') {
      return undefined
    }

    fetchGatewayRequestLogs()
      .then((logs) => {
        onRequestLogs({
          logs,
          syncedAt: formatGatewayTimestamp()
        })
      })
      .catch(() => {})

    const timer = setInterval(() => {
      // 暂停不可见标签页的轮询以节省资源
      if (document.hidden) {
        return
      }

      fetchGatewayRequestLogs()
        .then((logs) => {
          onRequestLogs({
            logs,
            syncedAt: formatGatewayTimestamp()
          })
        })
        .catch(() => {})
    }, logsInterval)

    return () => clearInterval(timer)
  }, [activeTab, onRequestLogs, logsInterval])
}
