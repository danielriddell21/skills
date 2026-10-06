export type TestState = 'none' | 'pass' | 'fail'
export type Summary = {
  files: string[]
  tests: TestState
  tools: number
  ms: number
  usd: number | null
  reason: string
  isOpen: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'how-did-that-go': { summary: Summary | null }
  }
}
