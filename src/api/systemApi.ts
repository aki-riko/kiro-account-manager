// 系统与环境相关 API 调用（更新、窗口、Kiro CLI 检测）
import { invoke } from '@tauri-apps/api/core'

// 检查应用更新
export function checkUpdate<T = any>() {
  return invoke<T>('check_update')
}

// 显示主窗口
export function showMainWindow() {
  return invoke('show_main_window')
}

// 检测 Kiro CLI 安装状态
export function checkCliInstallation<T = any>() {
  return invoke<T>('check_cli_installation')
}

// 获取 Kiro CLI 默认数据库路径
export function getKiroCliDefaultPath() {
  return invoke<string>('get_kiro_cli_default_path')
}

// 读取 Kiro CLI 数据库快照
export function readCliDbSnapshot<T = any>(dbPath: string) {
  return invoke<T>('read_cli_db_snapshot', { dbPath })
}
