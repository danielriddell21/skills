export type TreeNode = { label: string; children?: TreeNode[] }
export type Point = { label: string; x: number; y: number }
// `hot` marks where the complexity lives (a hub, a cycle, the risky part); `note` is the hover text.
export type GraphNode = { id: string; label: string; note?: string; hot?: boolean }
export type Edge = { from: string; to: string; label?: string }
export type Message = { from: string; to: string; label?: string }
// One stop of a guided tour: the parts to light up and what to say about them.
export type TourStep = { focus: string[]; text: string }

// One drawable piece of a ```ui block (one JSON object per line) or of the show tool.
// Only what the host cannot already draw: tables, choices and prose stay built-in (markdown, AskUserQuestion).
export type Component =
  | { type: 'graph'; title?: string; nodes: GraphNode[]; edges: Edge[] }
  | { type: 'tour'; title?: string; nodes: GraphNode[]; edges: Edge[]; steps: TourStep[] }
  | { type: 'flow'; title?: string; lanes: string[][] }
  | { type: 'sequence'; title?: string; actors: string[]; steps: Message[] }
  | { type: 'tree'; title?: string; nodes: TreeNode[] }
  | { type: 'bars'; title?: string; values: Record<string, number>; max?: number; unit?: string }
  | { type: 'scatter'; title?: string; x: string; y: string; points: Point[]; quadrant?: boolean }

// The older your-call chart spec; a subset of Component, still drawn.
export type Viz =
  | { type: 'bars'; title?: string; values: Record<string, number>; max?: number }
  | { type: 'flow'; title?: string; lanes: string[][] }
  | { type: 'tree'; title?: string; nodes: TreeNode[] }
export type SummaryCard = { id: number; key: string; viz: Viz }

declare module 'claude-code' {
  interface PluginState {
    'picture-this': {
      // Components the show tool was given, by tool_use_id.
      shown: Record<string, Component[]>
      // Which step each tour is on, by its key; -1 (or absent) is the overview.
      steps: Record<string, number>
      ready: boolean
    }
    // Published by too-long-didnt-read: summary charts drawn under the answer they belong to.
    'too-long-didnt-read': { cards: SummaryCard[] }
  }
}
