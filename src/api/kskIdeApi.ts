import { invoke } from '@tauri-apps/api/core'

export interface KskIdeStatus {
  running: boolean
  region: string | null
  pid: number | null
  sessionId: string | null
  startedAt: string | null
}

export interface StartKskIdeRequest {
  ksk: string
  region: string
}

export function startKskIde(request: StartKskIdeRequest) {
  return invoke<KskIdeStatus>('start_ksk_ide', { request })
}

export function stopKskIde() {
  return invoke<KskIdeStatus>('stop_ksk_ide')
}

export function getKskIdeStatus() {
  return invoke<KskIdeStatus>('get_ksk_ide_status')
}

export function getKskIdeRegions() {
  return invoke<string[]>('get_ksk_ide_regions')
}
