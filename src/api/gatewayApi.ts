// 网关（反代）相关 API 调用
import { invoke } from '@tauri-apps/api/core'

// 为选中的客户端写入反代配置
export function configureProxyClients(args: {
  clients: string[]
  host: string
  port: number
  apiKey: string
}) {
  return invoke<any[]>('configure_proxy_clients', args)
}
