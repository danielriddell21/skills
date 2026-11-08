// `color`: the theme key /context draws the category in (absent in snapshots saved before it was kept).
export type Row = { name: string; tokens: number; color?: string }
export type Snapshot = { rows: Row[]; total: number; max: number; percent: number }

declare module 'claude-code' {
  interface PluginState {
    'whats-in-the-box': { snapshot: Snapshot | null; pct: number }
  }
}
