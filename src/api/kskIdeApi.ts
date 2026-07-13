import { invoke } from '@tauri-apps/api/core'

export interface KskIdeStatus {
  running: boolean
  region: string | null
  pid: number | null
  sessionId: string | null
  startedAt: string | null
  managedKey: boolean
  sourceAccountId: string | null
  sourceAccountLabel: string | null
  keyPrefix: string | null
  keyExpiresAt: string | null
}

export const IDLE_KSK_IDE_STATUS: KskIdeStatus = {
  running: false,
  region: null,
  pid: null,
  sessionId: null,
  startedAt: null,
  managedKey: false,
  sourceAccountId: null,
  sourceAccountLabel: null,
  keyPrefix: null,
  keyExpiresAt: null,
}

export interface StartKskIdeRequest {
  ksk: string
  region: string
}

export interface StartKskIdeFromAccountRequest {
  accountId: string
  region?: string
}

export function startKskIde(request: StartKskIdeRequest) {
  return invoke<KskIdeStatus>('start_ksk_ide', { request })
}

export function startKskIdeFromAccount(request: StartKskIdeFromAccountRequest) {
  return invoke<KskIdeStatus>('start_ksk_ide_from_account', { request })
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
