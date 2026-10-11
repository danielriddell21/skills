export type TreeNode = { label: string; children?: TreeNode[] }
export type Point = { label: string; x: number; y: number }
export type CalcInput = { id: string; label: string; value: number; min: number; max: number; step: number; unit?: string }
export type CalcOutput = { id?: string; label: string; formula: string; unit?: string; digits?: number }
export type Stop = { label: string; lat?: number; lon?: number; note?: string }

// One drawable piece of a ```ui block (one JSON object per line) or of the show tool.
export type Component =
  | { type: 'bars'; title?: string; values: Record<string, number>; max?: number; unit?: string }
  | { type: 'line'; title?: string; x: string[]; series: Record<string, number[]>; unit?: string }
  | { type: 'scatter'; title?: string; x: string; y: string; points: Point[]; quadrant?: boolean }
  | { type: 'pie'; title?: string; values: Record<string, number> }
  | { type: 'table'; title?: string; columns: string[]; rows: (string | number)[][] }
  | { type: 'tree'; title?: string; nodes: TreeNode[] }
  | { type: 'flow'; title?: string; lanes: string[][] }
  | { type: 'graph'; title?: string; nodes: { id: string; label: string }[]; edges: { from: string; to: string; label?: string }[] }
  | { type: 'card'; title: string; body?: string; fields?: Record<string, string>; tags?: string[] }
  | { type: 'stat'; label: string; value: string; delta?: string; note?: string }
  | { type: 'calc'; title?: string; inputs: CalcInput[]; outputs: CalcOutput[] }
  | { type: 'choice'; id: string; label: string; options: string[]; value?: string }
  | { type: 'map'; title?: string; stops: Stop[] }
  | { type: 'send'; label: string; prompt: string }

// The older your-call chart spec; a subset of Component, still drawn.
export type Viz =
  | { type: 'bars'; title?: string; values: Record<string, number>; max?: number }
  | { type: 'flow'; title?: string; lanes: string[][] }
  | { type: 'tree'; title?: string; nodes: TreeNode[] }
export type SummaryCard = { id: number; key: string; viz: Viz }
export type Sort = { col: number; desc: boolean }

declare module 'claude-code' {
  interface PluginState {
    'picture-this': {
      // Control values (calc inputs, choices) by `<scope>/<component>/<field>`.
      values: Record<string, number | string>
      sorts: Record<string, Sort>
      // Components the show tool was given, by tool_use_id.
      shown: Record<string, Component[]>
      noClient: boolean
      ready: boolean
    }
    // Published by too-long-didnt-read: summary charts drawn under the answer they belong to.
    'too-long-didnt-read': { cards: SummaryCard[] }
    // Published by matchmaker; picture-this skips its own classifier while matchmaker is on.
    'matchmaker': { isOff: boolean }
  }
}
