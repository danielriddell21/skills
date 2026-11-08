export type TreeNode = { label: string; children?: TreeNode[] }
export type Point = { label: string; x: number; y: number }
// What a diff mark says about a part or link, against the baseline.
export type Change = 'added' | 'removed' | 'changed'
// `hot` marks where the complexity lives; `heat` (0-1) shades by a measure (churn, bugs, load);
// `change` marks a diff; `inside` is the part's own graph, opened by zooming in; `note` is the hover text.
export type GraphNode = { id: string; label: string; note?: string; hot?: boolean; heat?: number; change?: Change; inside?: SubGraph }
export type Edge = { from: string; to: string; label?: string; change?: Change }
export type SubGraph = { nodes: GraphNode[]; edges: Edge[] }
export type Message = { from: string; to: string; label?: string }
// One stop of a guided tour (or one frame of a storyboard): the parts to light up and what to say.
export type TourStep = { focus: string[]; text: string }
export type Panel = { label: string; nodes: GraphNode[]; edges: Edge[] }
export type LaneStep = { lane: string; label: string }
export type Span = { label: string; start: number; end?: number; lane?: string; hot?: boolean }
export type Flow = { from: string; to: string; value: number }

// One drawable piece of a ```ui block (one JSON object per line) or of the show tool.
// Only what the host cannot already draw: tables, choices and prose stay built-in (markdown, AskUserQuestion).
export type Component =
  // Structure: static, diffed, heated, zoomable.
  | { type: 'graph'; title?: string; nodes: GraphNode[]; edges: Edge[]; heatLabel?: string }
  // Before / after, or options side by side: the first panel is the baseline, all share one layout.
  | { type: 'compare'; title?: string; panels: Panel[] }
  // Guided: step through (tour) or see every step at once (storyboard).
  | { type: 'tour'; title?: string; nodes: GraphNode[]; edges: Edge[]; steps: TourStep[] }
  | { type: 'storyboard'; title?: string; nodes: GraphNode[]; edges: Edge[]; steps: TourStep[] }
  // Order and ownership.
  | { type: 'sequence'; title?: string; actors: string[]; steps: Message[]; animate?: boolean }
  | { type: 'flow'; title?: string; lanes: string[][] }
  | { type: 'swimlane'; title?: string; lanes: string[]; steps: LaneStep[] }
  | { type: 'timeline'; title?: string; items: Span[]; clock?: 'num' | 'time' | 'date'; unit?: string }
  // Size, weight, volume.
  | { type: 'tree'; title?: string; nodes: TreeNode[] }
  | { type: 'treemap'; title?: string; values: Record<string, number>; hot?: string[]; unit?: string }
  | { type: 'matrix'; title?: string; rows: string[]; cols: string[]; values: number[][]; max?: number }
  | { type: 'sankey'; title?: string; links: Flow[]; unit?: string }
  // Tradeoffs.
  | { type: 'bars'; title?: string; values: Record<string, number>; max?: number; unit?: string }
  | { type: 'scatter'; title?: string; x: string; y: string; points: Point[]; quadrant?: boolean }
  | { type: 'radar'; title?: string; axes: string[]; series: Record<string, number[]>; max: number }

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
      // Which part each zoomable graph is opened into, by its key: node ids joined by '/', '' at the top.
      paths: Record<string, string>
      // The person's Claude theme name from /config ('' when unknown: pictures follow the OS then).
      theme: string
      ready: boolean
    }
    // Published by the `skins` mod (hellosverre/claude-skins), only read here: which skin is on, whether it draws
    // replies (`tables`), the person's own skins, and light or dark. Pictures take the skin's colours while it is on.
    skins: {
      prefs: { skin: string; tables?: string }
      custom: Record<string, { base: string; palette: Record<string, string> }>
      isLight: boolean
    }
    // Published by too-long-didnt-read: summary charts drawn under the answer they belong to.
    'too-long-didnt-read': { cards: SummaryCard[] }
  }
}
