export type Option = { id: string; label: string; detail?: string; pros?: string[]; cons?: string[]; recommended?: boolean }
export type Criterion = { name: string; scores: Record<string, number>; weight?: number }
export type ShowIf = { step: string; picked?: string[]; notPicked?: string[] }
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
  showIf?: ShowIf
  why?: string
  audience?: { votes: Record<string, number> }
  measured?: boolean
}
export type Snap = {
  picks: Record<string, string[]>
  notes: Record<string, string>
  others: Record<string, string>
  weights: Record<string, number>
  vetoed: Record<string, string[]>
  confidence: Record<string, string>
  idx: number
  phase: 'step' | 'review'
}
export type View = {
  title: string
  steps: Step[]
  idx: number
  picks: Record<string, string[]>
  notes: Record<string, string>
  phase: 'step' | 'review'
  regen: string
  weights: Record<string, number>
  fromReview: boolean
  others: Record<string, string>
  last: Record<string, string[]>
  vetoed: Record<string, string[]>
  confidence: Record<string, string>
  undo: Snap[]
  redo: Snap[]
  showAll: Record<string, boolean>
}

export type PlanRow = { id: string; label: string; detail?: string; command?: string; risk: 'low' | 'medium' | 'high'; action: 'read' | 'edit' | 'ship' | 'delete' | 'other'; auto: boolean }
export type PlanView = { title: string; why?: string; rows: PlanRow[]; ticked: string[]; note: string }
export type SummaryCard = { id: number; key: string; viz: Viz }
export type Approval = { at: number; kind: string; detail: string }
export type GateFlags = {
  pick: boolean
  plan: { medium: boolean; high: boolean; ship: boolean; delete: boolean }
  danger: boolean
  sensitive: boolean
}
export type GateState = { mode: string | null; phase: 'off' | 'armed' | 'active'; since: number; allow: GateFlags | null }

declare module 'claude-code' {
  interface PluginState {
    'your-call': { view: View | null; plan: PlanView | null; approvals: Approval[]; ready: boolean }
    // Published by looks-good-to-me; only read here.
    'looks-good-to-me': { gate: GateState }
    // Published by too-long-didnt-read: summary charts for this plugin to draw under the answer they belong to.
    'too-long-didnt-read': { cards: SummaryCard[] }
  }
}
