export type Task = { id: number; text: string; isDone: boolean }

declare module 'claude-code' {
  interface PluginState {
    'sticky-notes': { tasks: Task[] }
  }
}
