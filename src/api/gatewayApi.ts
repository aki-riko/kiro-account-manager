// 网关（反代）相关 API 调用
import { invoke } from '@tauri-apps/api/core'

export function getGatewayConfig<T = any>() {
  return invoke<T>('get_gateway_config')
}

export function getGatewayStatus<T = any>() {
  return invoke<T>('get_gateway_status')
}

export function saveGatewayConfig(config: any) {
  return invoke('save_gateway_config', { config })
}

export function startGateway<T = any>(config: any) {
  return invoke<T>('start_gateway', { config })
}

export function stopGateway() {
  return invoke('stop_gateway')
}

export function getGatewayLogDir() {
  return invoke<string>('get_gateway_log_dir')
}

export function openGatewayLogDir() {
  return invoke<string>('open_gateway_log_dir')
}

export function getGatewayRequestLogs<T = any[]>(limit = 120) {
  return invoke<T>('get_gateway_request_logs', { limit })
}

export function clearGatewayRequestLogs() {
  return invoke('clear_gateway_request_logs')
}

export function getGatewayRequestStats<T = any>() {
  return invoke<T>('get_gateway_request_stats')
}

export function getCacheStats<T = any>() {
  return invoke<T>('get_cache_stats')
}

export function clearAllCache() {
  return invoke('clear_all_cache')
}

// 为选中的客户端写入反代配置
export function configureProxyClients(args: {
  clients: string[]
  host: string
  port: number
  apiKey: string
}) {
  return invoke<any[]>('configure_proxy_clients', args)
}
