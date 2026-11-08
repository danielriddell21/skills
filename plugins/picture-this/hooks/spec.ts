// From what Claude wrote to components that are safe to draw: ```ui blocks hold one JSON component per
// line (JSON Lines, so finished lines draw while the rest streams); ```viz blocks hold one older chart.
import type { Component, Edge, GraphNode, Message, Point, TourStep, TreeNode } from '../types'

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

/** `[from, to, label?]` or `{from, to, label}`, both ends among `ids`. */
const links = (raw: unknown, n: number, ids: Set<string>): Edge[] =>
  arr(raw, n).flatMap(e => {
    const [from, to, label] = Array.isArray(e) ? e : isObj(e) ? [e.from, e.to, e.label] : []
    const f = str(from, 32)
    const t = str(to, 32)
    return f && t && ids.has(f) && ids.has(t) ? [opt({ from: f, to: t, label: str(label, 32) })] : []
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

const graph: Norm = (r, title) => {
  const seen = new Set<string>()
  const ns = arr(r.nodes, NODES).flatMap((n): GraphNode[] => {
    const id = isObj(n) ? str(n.id, 32) : str(n, 32)
    if (!id || seen.has(id)) return []
    seen.add(id)
    if (!isObj(n)) return [{ id, label: id }]
    return [opt({ id, label: str(n.label, 32) ?? id, note: str(n.note, 120), hot: n.hot === true || undefined })]
  })
  const edges = links(r.edges, EDGES, seen)
  return ns.length >= 2 && edges.length ? { type: 'graph', title, nodes: ns, edges } : undefined
}

const tour: Norm = (r, title) => {
  const g = graph(r, title)
  if (g?.type !== 'graph') return undefined
  const ids = new Set(g.nodes.map(n => n.id))
  const steps = arr(r.steps, 12).flatMap((s): TourStep[] => {
    if (!isObj(s)) return []
    const text = str(s.text, 300)
    const focus = arr(s.focus, NODES).flatMap(f => str(f, 32) ?? []).filter(f => ids.has(f))
    return text ? [{ focus, text }] : []
  })
  return steps.length >= 2 ? { type: 'tour', title, nodes: g.nodes, edges: g.edges, steps } : undefined
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
  return used.length >= 2 && steps.length ? { type: 'sequence', title, actors: used, steps } : undefined
}

const NORMS: Record<string, Norm> = {
  graph,
  tour,
  walkthrough: tour,
  flow,
  sequence,
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
