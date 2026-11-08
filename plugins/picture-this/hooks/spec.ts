// From what Claude wrote to components that are safe to draw: ```ui blocks hold one JSON component per
// line (JSON Lines, so finished lines draw while the rest streams); ```viz blocks hold one older chart.
import type { Change, Component, Edge, Flow, GraphNode, LaneStep, Message, Panel, Point, Span, SubGraph, TourStep, TreeNode } from '../types'

export type Block = { index: number; components: Component[]; skipped: number; pending: boolean }
export type Segment = { kind: 'text'; text: string } | { kind: 'block'; block: Block }

const LABEL = 48
const ITEMS = 12
// A diagram past these is too big to read in the thread: the skill sends it to the side panel instead.
const NODES = 24
const EDGES = 40
const STEPS = 30
const POINTS = 20

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const str = (v: unknown, n = LABEL): string | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return typeof v === 'string' && v.trim() ? clip(v.replace(/\s+/g, ' ').trim(), n) : undefined
}
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const arr = (v: unknown, n: number): unknown[] => (Array.isArray(v) ? v.slice(0, n) : [])
const opt = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

const numMap = (raw: unknown, n: number): Record<string, number> | undefined => {
  if (!isObj(raw)) return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw).slice(0, n)) {
    const key = str(k)
    const val = num(v)
    if (key && val !== undefined && val >= 0) out[key] = val
  }
  return Object.keys(out).length ? out : undefined
}

const nodes = (raw: unknown, depth = 0): TreeNode[] =>
  arr(raw, ITEMS).flatMap(n => {
    const l = isObj(n) ? str(n.label) : str(n)
    if (!l) return []
    const kids = isObj(n) && depth < 3 ? nodes(n.children, depth + 1) : []
    return [kids.length ? { label: l, children: kids } : { label: l }]
  })

const changeOf = (v: unknown): Change | undefined => (v === 'added' || v === 'removed' || v === 'changed' ? v : undefined)
const unit01 = (v: unknown): number | undefined => {
  const n = num(v)
  return n === undefined ? undefined : Math.max(0, Math.min(1, n))
}

/** `[from, to, label?]` or `{from, to, label}`, both ends among `ids`. */
const links = (raw: unknown, n: number, ids: Set<string>): Edge[] =>
  arr(raw, n).flatMap(e => {
    const [from, to, label] = Array.isArray(e) ? e : isObj(e) ? [e.from, e.to, e.label] : []
    const f = str(from, 32)
    const t = str(to, 32)
    const change = isObj(e) ? changeOf(e.change) : undefined
    return f && t && ids.has(f) && ids.has(t) ? [opt({ from: f, to: t, label: str(label, 32), change })] : []
  })

type Norm = (r: Record<string, unknown>, title: string | undefined) => Component | undefined

const bars: Norm = (r, title) => {
  const values = numMap(r.values, ITEMS)
  return values ? opt({ type: 'bars' as const, title, values, max: num(r.max), unit: str(r.unit, 12) }) : undefined
}

const scatter =
  (quadrant: boolean): Norm =>
  (r, title) => {
    const points = arr(r.points, POINTS).flatMap((p): Point[] => {
      const l = isObj(p) ? str(p.label ?? p.id) : undefined
      const x = isObj(p) ? num(p.x) : undefined
      const y = isObj(p) ? num(p.y) : undefined
      return l && x !== undefined && y !== undefined ? [{ label: l, x, y }] : []
    })
    return points.length ? opt({ type: 'scatter' as const, title, x: str(r.x) ?? 'x', y: str(r.y) ?? 'y', points, quadrant: quadrant || r.quadrant === true || undefined }) : undefined
  }

const tree: Norm = (r, title) => {
  const n = nodes(r.nodes)
  return n.length ? { type: 'tree', title, nodes: n } : undefined
}

const flow: Norm = (r, title) => {
  const raw = Array.isArray(r.lanes) ? r.lanes : [r.steps]
  const lanes = raw
    .slice(0, 4)
    .map(l => arr(l, 8).flatMap(s => str(s, 32) ?? []))
    .filter(l => l.length >= 2)
  return lanes.length ? { type: 'flow', title, lanes } : undefined
}

/** Nodes and edges, as a graph or a part's inside; `depth` limits how far `inside` nests. */
const subGraph = (r: Record<string, unknown>, depth: number): SubGraph | undefined => {
  const seen = new Set<string>()
  const ns = arr(r.nodes, NODES).flatMap((n): GraphNode[] => {
    const id = isObj(n) ? str(n.id, 32) : str(n, 32)
    if (!id || seen.has(id)) return []
    seen.add(id)
    if (!isObj(n)) return [{ id, label: id }]
    const inside = depth < 2 && isObj(n.inside) ? subGraph(n.inside, depth + 1) : undefined
    return [opt({ id, label: str(n.label, 32) ?? id, note: str(n.note, 120), hot: n.hot === true || undefined, heat: unit01(n.heat), change: changeOf(n.change), inside })]
  })
  const edges = links(r.edges, EDGES, seen)
  return ns.length >= 2 && edges.length ? { nodes: ns, edges } : undefined
}

const graph: Norm = (r, title) => {
  const g = subGraph(r, 0)
  return g ? opt({ type: 'graph' as const, title, ...g, heatLabel: str(r.heatLabel ?? r.heat, 24) }) : undefined
}

const compare: Norm = (r, title) => {
  const panels = arr(r.panels ?? r.options, 3).flatMap((p, i): Panel[] => {
    if (!isObj(p)) return []
    const g = subGraph(p, 2)
    return g ? [{ label: str(p.label, 32) ?? (i ? `Option ${i}` : 'Today'), ...g }] : []
  })
  return panels.length >= 2 ? { type: 'compare', title, panels } : undefined
}

const stepsOf = (raw: unknown, ids: Set<string>): TourStep[] =>
  arr(raw, 12).flatMap((s): TourStep[] => {
    if (!isObj(s)) return []
    const text = str(s.text, 300)
    const focus = arr(s.focus, NODES).flatMap(f => str(f, 32) ?? []).filter(f => ids.has(f))
    return text ? [{ focus, text }] : []
  })

const guided =
  (type: 'tour' | 'storyboard'): Norm =>
  (r, title) => {
    const g = subGraph(r, 2)
    if (!g) return undefined
    const steps = stepsOf(r.steps ?? r.frames, new Set(g.nodes.map(n => n.id)))
    return steps.length >= 2 ? { type, title, nodes: g.nodes, edges: g.edges, steps } : undefined
  }

const swimlane: Norm = (r, title) => {
  const listed = arr(r.lanes, 6).flatMap(l => str(l, 24) ?? [])
  const lanes = new Set(listed)
  const steps = arr(r.steps, 16).flatMap((s): LaneStep[] => {
    const [lane, label] = Array.isArray(s) ? s : isObj(s) ? [s.lane, s.label] : []
    const l = str(lane, 24)
    const t = str(label, 40)
    if (!l || !t || (!lanes.has(l) && lanes.size >= 6)) return []
    lanes.add(l)
    return [{ lane: l, label: t }]
  })
  return steps.length >= 2 ? { type: 'swimlane', title, lanes: [...lanes].filter(l => steps.some(s => s.lane === l)), steps } : undefined
}

const CLOCK = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
/** A time as a number on one of three clocks: plain numbers, HH:MM(:SS) as seconds of the day, or a date as ms. */
export const timeOf = (v: unknown): { v: number; clock: 'num' | 'time' | 'date' } | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return { v, clock: 'num' }
  if (typeof v !== 'string') return undefined
  const m = CLOCK.exec(v.trim())
  if (m) return { v: Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0), clock: 'time' }
  const d = Date.parse(v)
  return Number.isFinite(d) ? { v: d, clock: 'date' } : undefined
}

const timeline: Norm = (r, title) => {
  let clock: 'num' | 'time' | 'date' | undefined
  const items = arr(r.items ?? r.events, 20).flatMap((it): Span[] => {
    if (!isObj(it)) return []
    const label = str(it.label, 40)
    const s = timeOf(it.start ?? it.at)
    const e = timeOf(it.end)
    clock ??= s?.clock
    if (!label || !s || s.clock !== clock || (e && (e.clock !== clock || e.v < s.v))) return []
    return [opt({ label, start: s.v, end: e?.v, lane: str(it.lane, 24), hot: it.hot === true || undefined })]
  })
  return items.length >= 2 && clock ? opt({ type: 'timeline' as const, title, items, clock, unit: str(r.unit, 12) }) : undefined
}

const matrix: Norm = (r, title) => {
  const rows = arr(r.rows, 16).flatMap(x => str(x, 24) ?? [])
  const cols = arr(r.cols ?? r.columns, 16).flatMap(x => str(x, 24) ?? [])
  const values = rows.map((_, i) => cols.map((__, j) => Math.max(0, num((arr(r.values, 16)[i] as unknown[] | undefined)?.[j]) ?? 0)))
  return rows.length && cols.length && values.flat().some(v => v > 0) ? opt({ type: 'matrix' as const, title, rows, cols, values, max: num(r.max) }) : undefined
}

const sankey: Norm = (r, title) => {
  const flows = arr(r.links ?? r.flows, 30).flatMap((l): Flow[] => {
    const [from, to, value] = Array.isArray(l) ? l : isObj(l) ? [l.from, l.to, l.value] : []
    const f = str(from, 24)
    const t = str(to, 24)
    const v = num(value)
    return f && t && f !== t && v !== undefined && v > 0 ? [{ from: f, to: t, value: v }] : []
  })
  return flows.length ? opt({ type: 'sankey' as const, title, links: flows, unit: str(r.unit, 12) }) : undefined
}

const radar: Norm = (r, title) => {
  const axes = arr(r.axes, 8).flatMap(a => str(a, 20) ?? [])
  if (axes.length < 3 || !isObj(r.series)) return undefined
  const series: Record<string, number[]> = {}
  for (const [k, v] of Object.entries(r.series).slice(0, 4)) {
    const vs = arr(v, axes.length).map(num)
    if (str(k) && vs.length === axes.length && vs.every(x => x !== undefined)) series[str(k) as string] = vs as number[]
  }
  const all = Object.values(series).flat()
  return all.length ? { type: 'radar', title, axes, series, max: num(r.max) ?? Math.max(10, ...all) } : undefined
}

const treemap: Norm = (r, title) => {
  const values = numMap(r.values, 40)
  if (!values) return undefined
  const hot = arr(r.hot, 10).flatMap(h => str(h) ?? []).filter(h => h in values)
  return opt({ type: 'treemap' as const, title, values, hot: hot.length ? hot : undefined, unit: str(r.unit, 12) })
}

const sequence: Norm = (r, title) => {
  const listed = arr(r.actors ?? r.participants, 8).flatMap(a => str(a, 24) ?? [])
  const rawSteps = r.steps ?? r.messages
  // Actors not listed are taken from the steps, in order of first appearance.
  const named = new Set(listed)
  for (const s of arr(rawSteps, STEPS)) {
    const [f, t] = Array.isArray(s) ? s : isObj(s) ? [s.from, s.to] : []
    for (const a of [str(f, 24), str(t, 24)]) if (a && named.size < 8) named.add(a)
  }
  const steps: Message[] = links(rawSteps, STEPS, named)
  const used = [...named].filter(a => steps.some(s => s.from === a || s.to === a))
  return used.length >= 2 && steps.length ? opt({ type: 'sequence' as const, title, actors: used, steps, animate: r.animate === true || r.replay === true || undefined }) : undefined
}

const NORMS: Record<string, Norm> = {
  graph,
  compare,
  diff: compare,
  tour: guided('tour'),
  walkthrough: guided('tour'),
  storyboard: guided('storyboard'),
  flow,
  sequence,
  swimlane,
  timeline,
  gantt: timeline,
  matrix,
  heatmap: matrix,
  sankey,
  radar,
  treemap,
  tree,
  bars,
  bar: bars,
  scatter: scatter(false),
  quadrant: scatter(true),
}

export const TYPES = Object.keys(NORMS)

/** One component from whatever JSON came in; undefined when it is not one we can draw honestly. */
export const normalize = (raw: unknown): Component | undefined => {
  if (!isObj(raw) || typeof raw.type !== 'string') return undefined
  const norm = Object.hasOwn(NORMS, raw.type) ? NORMS[raw.type] : undefined
  return norm?.(raw, str(raw.title, 64))
}

const parse = (s: string): unknown => {
  try {
    return JSON.parse(s)
  } catch {
    return undefined
  }
}

/** A block's body: one JSON array or object, else one object per line. `open` keeps the last, unfinished line out. */
export const parseBody = (body: string, open: boolean): { components: Component[]; skipped: number } => {
  const whole = open ? undefined : parse(body)
  let raws: unknown[]
  if (Array.isArray(whole)) raws = whole
  else if (whole !== undefined) raws = [whole]
  else {
    const lines = body.split('\n')
    if (open) lines.pop()
    raws = lines.filter(l => l.trim()).map(l => parse(l.trim()) ?? null)
  }
  const components = raws.slice(0, 8).flatMap(r => normalize(r) ?? [])
  return { components, skipped: raws.length - components.length }
}

const FENCE = /```(ui|viz)[ \t]*\n([\s\S]*?)```/g
const OPEN = /```(ui|viz)[ \t]*(\n|$)/

export const hasBlock = (text: string): boolean => OPEN.test(text)

/** The message split into prose and blocks; an unclosed block at the end is drawn so far and marked pending. */
export const splitBlocks = (text: string): Segment[] => {
  const out: Segment[] = []
  let at = 0
  let index = 0
  for (const m of text.matchAll(FENCE)) {
    const i = m.index ?? 0
    if (i > at) out.push({ kind: 'text', text: text.slice(at, i) })
    out.push({ kind: 'block', block: { index: index++, ...parseBody(m[2] ?? '', false), pending: false } })
    at = i + m[0].length
  }
  const rest = text.slice(at)
  const open = OPEN.exec(rest)
  if (open?.index !== undefined) {
    if (open.index > 0) out.push({ kind: 'text', text: rest.slice(0, open.index) })
    const body = rest.slice(open.index + open[0].length)
    out.push({ kind: 'block', block: { index, ...parseBody(body, true), pending: true } })
  } else if (rest) out.push({ kind: 'text', text: rest })
  return out
}

/** Identifies an answer's text; the same function is in too-long-didnt-read, which keys its cards with it. */
export const answerKey = (text: string): string => {
  const t = text.trim()
  return `${t.length}:${t.slice(0, 60)}`
}
