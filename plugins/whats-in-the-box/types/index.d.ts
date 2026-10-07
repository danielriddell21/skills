export type Row = { name: string; tokens: number }
export type Snapshot = { rows: Row[]; total: number; max: number; percent: number }

declare module 'claude-code' {
  interface PluginState {
    'whats-in-the-box': { snapshot: Snapshot | null; pct: number }
  }
}
