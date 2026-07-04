// 使用量历史 API 调用
import { invoke } from '@tauri-apps/api/core'

// 读取使用量历史
export function getUsageHistory<T = { entries: any[] }>() {
  return invoke<T>('get_usage_history')
}

// 保存一条使用量历史记录
export function saveUsageHistoryEntry(entry: {
  date: string
  totalQuota: number
  totalUsed: number
  accountCount: number
}) {
  return invoke('save_usage_history_entry', { entry })
}
