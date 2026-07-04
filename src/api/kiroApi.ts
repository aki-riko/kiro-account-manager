// Kiro 本地 token 与机器码 API 调用
import { invoke } from '@tauri-apps/api/core'

// 读取 Kiro IDE 当前登录的本地 token
export function getKiroLocalToken<T = any>() {
  return invoke<T>('get_kiro_local_token')
}

// 生成新的机器码
export function generateMachineGuid() {
  return invoke<string>('generate_machine_guid')
}

// 设置自定义机器码
export function setCustomMachineGuid(newGuid: string) {
  return invoke('set_custom_machine_guid', { newGuid })
}

// 获取系统机器码
export function getSystemMachineGuid<T = any>() {
  return invoke<T>('get_system_machine_guid')
}

// 重置系统机器码，返回新机器码
export function resetSystemMachineGuid() {
  return invoke<string>('reset_system_machine_guid')
}
