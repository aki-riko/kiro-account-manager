// 账号相关 API 调用
import { invoke } from '@tauri-apps/api/core'
import type { Account, ListAvailableModelsResponse } from '../types/account'

// 获取全部账号
export function getAccounts() {
  return invoke<Account[]>('get_accounts')
}

// 获取账号配额（调用点对返回结构预期不一，用泛型兜底）
export function getUsageLimits<T = { account: Account; warning?: string }>(id: string) {
  return invoke<T>('get_usage_limits', { id })
}

// 刷新 token
export function refreshToken(id: string) {
  return invoke('refresh_token', { id })
}

// 同步账号
export function syncAccount(id: string) {
  return invoke<{ account: Account; warning?: string }>('sync_account', { id })
}

// 更新账号（params 为待更新字段，需含 id）
export function updateAccount<T = any>(params: Record<string, any>) {
  return invoke<T>('update_account', { params })
}

// 删除本地账号
export function deleteAccount(id: string) {
  return invoke('delete_account', { id })
}

// 删除远端账号（可选同时删除本地）
export function deleteAccountRemote(id: string, deleteLocal = true) {
  return invoke('delete_account_remote', { id, deleteLocal })
}

// 批量删除账号
export function deleteAccounts(ids: string[]) {
  return invoke('delete_accounts', { ids })
}

// 开关超额
export function setOverageStatus(id: string, enabled: boolean) {
  return invoke('set_overage_status', { id, enabled })
}

// 拉取账号可用模型
export function listAvailableModels(id: string, forceRefresh = false) {
  return invoke<ListAvailableModelsResponse>('list_available_models', { id, forceRefresh })
}

// 快速切换到下一个账号，返回切换后的邮箱
export function quickSwitchNext() {
  return invoke<string>('quick_switch_next')
}

// 获取当前登录用户
export function getCurrentUser<T = any>() {
  return invoke<T>('get_current_user')
}

// 登出当前用户
export function logout() {
  return invoke('logout')
}

// 测试账号代理连通性
export function testAccountProxy<T = any>(proxyConfig: any) {
  return invoke<T>('test_account_proxy', { proxyConfig })
}

// 校验账号（params 为待校验的 token/凭据字段）
export function verifyAccount<T = any>(params: Record<string, any>) {
  return invoke<T>('verify_account', { params })
}
