export type Approval = { at: number; kind: string; detail: string }
export type Matrix = {
  pick: boolean
  plan: { medium: boolean; high: boolean; ship: boolean; delete: boolean }
  danger: boolean
  sensitive: boolean
}
export type GateState = { mode: string | null; phase: 'off' | 'armed' | 'active'; since: number; allow: Matrix | null }

declare module 'claude-code' {
  interface PluginState {
    'are-you-sure-bro': { approvals: Approval[] }
    // Published by looks-good-to-me; only read here.
    'looks-good-to-me': { gate: GateState }
  }
}
