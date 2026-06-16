export interface CliSessionSummary {
  sessionId: string
  title: string
  cwd: string
  modelName: string | null
  agentName: string | null
  messageCount: number
  totalCredits: number
  contextUsage: number | null
  createdAt: string | null
  updatedAt: string | null
  fileSize: number
}

export interface CliSession {
  sessionId: string
  title: string
  cwd: string
  modelName: string | null
  agentName: string | null
  contextUsage: number | null
  createdAt: string | null
  updatedAt: string | null
  messages: CliSessionMessage[]
  permissions: any | null
}

export interface CliSessionMessage {
  version: string | null
  kind: string
  data: {
    messageId: string | null
    content: { kind: string; data: string }[]
    meta: { timestamp: number | null } | null
  }
}
