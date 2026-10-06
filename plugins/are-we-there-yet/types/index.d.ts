export type Percent = number

declare module 'claude-code' {
  interface PluginState {
    'are-we-there-yet': { pct: Percent }
  }
}
