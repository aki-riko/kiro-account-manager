// 应用设置与 Kiro IDE 配置 API 调用
import { invoke } from '@tauri-apps/api/core'

// ============================================================
// 应用设置
// ============================================================

// 读取应用设置
export function getAppSettings<T = any>() {
  return invoke<T>('get_app_settings')
}

// 保存应用设置（settings 为待更新字段）
export function saveAppSettings(settings: Record<string, any>) {
  return invoke('save_app_settings', { settings })
}

// 应用数据目录
export function getAppDataDir() {
  return invoke<string>('get_app_data_dir')
}

export function openAppDataDir() {
  return invoke('open_app_data_dir')
}

// ============================================================
// Kiro IDE 配置
// ============================================================

// 读取 Kiro IDE 设置
export function getKiroSettings<T = any>() {
  return invoke<T>('get_kiro_settings')
}

// 设置 Kiro IDE 代理
export function setKiroProxy(proxy: string) {
  return invoke('set_kiro_proxy', { proxy })
}

// 设置 Kiro IDE 模型
export function setKiroModel(model: string) {
  return invoke('set_kiro_model', { model })
}

// 设置 Kiro IDE 可信命令
export function setKiroTrustedCommands(mode: string, customCommands: string) {
  return invoke('set_kiro_trusted_commands', { mode, customCommands })
}

// 设置 Kiro IDE 通知开关
export function setKiroNotification(key: string, enabled: boolean) {
  return invoke('set_kiro_notification', { key, enabled })
}

// 设置 Kiro IDE 遥测开关
export function setKiroTelemetry(key: string, enabled: boolean) {
  return invoke('set_kiro_telemetry', { key, enabled })
}

// ============================================================
// 自定义 Kiro 安装路径
// ============================================================

export function getCustomKiroPath() {
  return invoke<string | null>('get_custom_kiro_path')
}

export function setCustomKiroPath(path: string) {
  return invoke('set_custom_kiro_path', { path })
}

export function clearCustomKiroPath() {
  return invoke('clear_custom_kiro_path')
}

// ============================================================
// 环境检测
// ============================================================

// 检测 Kiro IDE 安装状态
export function checkIdeInstallation<T = any>() {
  return invoke<T>('check_ide_installation')
}

// 检测已安装的浏览器
export function detectInstalledBrowsers<T = any>() {
  return invoke<T[]>('detect_installed_browsers')
}

// 检测系统代理
export function detectSystemProxy<T = any>() {
  return invoke<T>('detect_system_proxy')
}
