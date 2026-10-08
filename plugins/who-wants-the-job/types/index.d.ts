export type CrewStatus = 'running' | 'done' | 'failed'

export type CrewRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  status: CrewStatus
  startedAt: number
  endedAt?: number
  ctxTokens: number
  ctxMax: number
  tokens: number
  costUsd: number
  steps: number
  stepDone?: number
  stepTotal?: number
  stepNote?: string
}

declare module 'claude-code' {
  interface PluginState {
    'who-wants-the-job': { agents: CrewRun[]; now: number }
  }
}
