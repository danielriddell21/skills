export type Variant = 'safe' | 'decide' | 'plan' | 'push' | 'yolo'
export type Phase = 'off' | 'armed' | 'active'
/** What the current variant allows, as plain flags the other plugins read. */
export type Matrix = {
  pick: boolean
  plan: { medium: boolean; high: boolean; ship: boolean; delete: boolean }
  danger: boolean
  sensitive: boolean
}
/** Published for the plugins that ask you things; they read it, only this plugin writes it. */
export type GateState = { mode: Variant | null; phase: Phase; since: number; allow: Matrix | null }
export type Approval = { at: number; kind: string; detail: string }

declare module 'claude-code' {
  interface PluginState {
    'looks-good-to-me': { gate: GateState }
    // Written by the plugins that act on the gate; read here for the count and the log.
    'are-you-sure-bro': { approvals: Approval[] }
    'your-call': { approvals: Approval[] }
  }
}
