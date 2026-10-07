export type TreeNode = { label: string; children?: TreeNode[] }
export type Viz =
  | { type: 'bars'; title?: string; values: Record<string, number>; max?: number }
  | { type: 'flow'; title?: string; lanes: string[][] }
  | { type: 'tree'; title?: string; nodes: TreeNode[] }
export type Card = { id: number; viz: Viz }

declare module 'claude-code' {
  interface PluginState {
    'too-long-didnt-read': { card: Card | null }
    // Published by your-call (a dependency); only read here.
    'your-call': { ready: boolean }
  }
}
