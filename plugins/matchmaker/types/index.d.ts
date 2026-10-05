export type Route = string | null

declare module 'claude-code' {
  interface PluginState {
    'matchmaker': { route: Route; isOff: boolean }
  }
}
