export type TreeNode = { label: string; children?: TreeNode[] }
export type Viz =
  | { type: 'bars'; title?: string; values: Record<string, number>; max?: number }
  | { type: 'flow'; title?: string; lanes: string[][] }
  | { type: 'tree'; title?: string; nodes: TreeNode[] }
// `key` ties a chart to the answer it summarises (see answerKey), so it draws under that message.
export type Card = { id: number; key: string; viz: Viz }

declare module 'claude-code' {
  interface PluginState {
    'too-long-didnt-read': { cards: Card[] }
    // Published by your-call (a dependency); only read here.
    'your-call': { ready: boolean }
  }
}
