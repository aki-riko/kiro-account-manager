// KiroConfig（agents / hooks / powers / skills / steering）API 调用
import { invoke } from '@tauri-apps/api/core'

// ============================================================
// 自定义 Agents
// ============================================================

export function getCustomAgents<T = any[]>(projectDir: string | null = null) {
  return invoke<T>('get_custom_agents', { projectDir })
}

export function saveCustomAgent(fileName: string, content: string, scope: string, projectDir: string | null = null) {
  return invoke('save_custom_agent', { fileName, content, scope, projectDir })
}

export function deleteCustomAgent(fileName: string, scope: string, projectDir: string | null = null) {
  return invoke('delete_custom_agent', { fileName, scope, projectDir })
}

export function createCustomAgent<T = any>(fileName: string, content: string, scope: string, projectDir: string | null = null) {
  return invoke<T>('create_custom_agent', { fileName, content, scope, projectDir })
}

// ============================================================
// Hooks
// ============================================================

export function getHooks<T = any[]>(projectDir: string | null = null) {
  return invoke<T>('get_hooks', { projectDir })
}

export function saveHook(fileName: string, content: string, projectDir: string | null = null) {
  return invoke('save_hook', { fileName, content, projectDir })
}

export function deleteHook(fileName: string, projectDir: string | null = null) {
  return invoke('delete_hook', { fileName, projectDir })
}

export function createHook<T = any>(fileName: string, content: string, projectDir: string | null = null) {
  return invoke<T>('create_hook', { fileName, content, projectDir })
}

// ============================================================
// Powers
// ============================================================

export function getPowers<T = any[]>() {
  return invoke<T>('get_powers')
}

export function getPowerRegistries<T = any[]>() {
  return invoke<T>('get_power_registries')
}

export function getRecommendedPowers<T = any[]>() {
  return invoke<T>('get_recommended_powers')
}

export function installPower(name: string, cloneUrl: string, pathInRepo: string, branch: string) {
  return invoke('install_power', { name, cloneUrl, pathInRepo, branch })
}

export function uninstallPower(name: string) {
  return invoke('uninstall_power', { name })
}

// ============================================================
// Skills / Steering
// ============================================================

export function getSkills<T = any[]>(projectDir: string | null = null) {
  return invoke<T>('get_skills', { projectDir })
}

export function getSteeringFiles<T = any[]>(projectDir: string | null = null) {
  return invoke<T>('get_steering_files', { projectDir })
}
