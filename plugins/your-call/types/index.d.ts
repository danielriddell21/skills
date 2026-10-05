export type Option = { id: string; label: string; detail?: string; pros?: string[]; cons?: string[] }
export type Criterion = { name: string; scores: Record<string, number> }
export type Viz =
  | { type: 'bars'; title?: string; values: Record<string, number>; max?: number }
  | { type: 'quadrant'; title?: string; x: string; y: string; points: { id?: string; label?: string; x: number; y: number }[] }
  | { type: 'tree'; title?: string; nodes: TreeNode[] }
  | { type: 'flow'; title?: string; lanes: string[][] }
export type TreeNode = { label: string; children?: TreeNode[] }
export type Step = {
  id: string
  question: string
  kind: 'one' | 'many' | 'rank' | 'compare'
  options: Option[]
  criteria?: Criterion[]
  viz?: Viz
}
export type View = {
  title: string
  steps: Step[]
  idx: number
  picks: Record<string, string[]>
  notes: Record<string, string>
  phase: 'step' | 'review'
  regen: string
}

declare module 'claude-code' {
  interface PluginState {
    'your-call': { view: View | null }
  }
}
