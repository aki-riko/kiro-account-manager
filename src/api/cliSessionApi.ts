import { invoke } from '@tauri-apps/api/core'
import { CliSession, CliSessionSummary } from '@/types/cliSession'

export const cliSessionApi = {
  async listSessions(): Promise<CliSessionSummary[]> {
    return invoke('list_cli_sessions')
  },

  async loadSession(sessionId: string): Promise<CliSession> {
    return invoke('load_cli_session', { sessionId })
  },

  async deleteSession(sessionId: string): Promise<void> {
    return invoke('delete_cli_session', { sessionId })
  },

  async searchSessions(query: string): Promise<CliSessionSummary[]> {
    return invoke('search_cli_sessions', { query })
  },

  async exportSession(sessionId: string, format: 'json' | 'markdown'): Promise<string> {
    return invoke('export_cli_session', { sessionId, format })
  },
}
