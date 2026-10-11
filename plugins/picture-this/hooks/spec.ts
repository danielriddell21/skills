// From what Claude wrote to components that are safe to draw: ```ui blocks hold one JSON component per
// line (JSON Lines, so finished lines draw while the rest streams); ```viz blocks hold one older chart.
import type { CalcInput, CalcOutput, Component, Point, Stop, TreeNode } from '../types'

export type Block = { index: number; components: Component[]; skipped: number; pending: boolean }
export type Segment = { kind: 'text'; text: string } | { kind: 'block'; block: Block }

const LABEL = 48
const ITEMS = 12
const ROWS = 50
const COLS = 8
const SERIES = 4
const POINTS = 20
const SLICES = 4
const TEXT = 600

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const str = (v: unknown, n = LABEL): string | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return typeof v === 'string' && v.trim() ? clip(v.replace(/\s+/g, ' ').trim(), n) : undefined
}
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const ident = (v: unknown): string | undefined => (typeof v === 'string' && /^[A-Za-z_]\w{0,31}$/.test(v) ? v : undefined)
const arr = (v: unknown, n: number): unknown[] => (Array.isArray(v) ? v.slice(0, n) : [])
const opt = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

const numMap = (raw: unknown, n: number, nonNeg: boolean): Record<string, number> | undefined => {
  if (!isObj(raw)) return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw).slice(0, n)) {
    const key = str(k)
    const val = num(v)
    if (key && val !== undefined && (!nonNeg || val >= 0)) out[key] = val
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

type Norm = (r: Record<string, unknown>, title: string | undefined) => Component | undefined

const bars: Norm = (r, title) => {
  const values = numMap(r.values, ITEMS, true)
  return values ? opt({ type: 'bars' as const, title, values, max: num(r.max), unit: str(r.unit, 12) }) : undefined
}

const line: Norm = (r, title) => {
  const x = arr(r.x, 40).flatMap(v => str(v, 16) ?? [])
  if (x.length < 2 || !isObj(r.series)) return undefined
  const series: Record<string, number[]> = {}
  for (const [k, v] of Object.entries(r.series).slice(0, SERIES)) {
    const ys = arr(v, x.length).map(num)
    if (str(k) && ys.length === x.length && ys.every(y => y !== undefined)) series[str(k) as string] = ys as number[]
  }
  return Object.keys(series).length ? opt({ type: 'line' as const, title, x, series, unit: str(r.unit, 12) }) : undefined
}

const scatter = (quadrant: boolean): Norm => (r, title) => {
  const points = arr(r.points, POINTS).flatMap((p): Point[] => {
    const l = isObj(p) ? str(p.label ?? p.id) : undefined
    const x = isObj(p) ? num(p.x) : undefined
    const y = isObj(p) ? num(p.y) : undefined
    return l && x !== undefined && y !== undefined ? [{ label: l, x, y }] : []
  })
  return points.length ? opt({ type: 'scatter' as const, title, x: str(r.x) ?? 'x', y: str(r.y) ?? 'y', points, quadrant: quadrant || r.quadrant === true || undefined }) : undefined
}

const pie: Norm = (r, title) => {
  const all = numMap(r.values, ITEMS, true)
  if (!all || !Object.values(all).some(v => v > 0)) return undefined
  // Past four slices the colours stop being tellable apart: keep the three biggest and fold the rest into Other.
  const sorted = Object.entries(all).sort((a, b) => b[1] - a[1])
  const values = sorted.length > SLICES ? { ...Object.fromEntries(sorted.slice(0, SLICES - 1)), Other: sorted.slice(SLICES - 1).reduce((a, [, v]) => a + v, 0) } : all
  return { type: 'pie', title, values }
}

const table: Norm = (r, title) => {
  const columns = arr(r.columns, COLS).flatMap(c => str(c, 24) ?? [])
  if (!columns.length) return undefined
  const rows = arr(r.rows, ROWS).flatMap(row => {
    if (!Array.isArray(row)) return []
    const cells = columns.map((_, i) => num(row[i]) ?? str(row[i], 40) ?? '')
    return cells.some(c => c !== '') ? [cells] : []
  })
  return rows.length ? { type: 'table', title, columns, rows } : undefined
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

const edgeParts = (e: unknown): unknown[] => {
  if (Array.isArray(e)) return e
  return isObj(e) ? [e.from, e.to, e.label] : []
}

const graph: Norm = (r, title) => {
  const ns = arr(r.nodes, ITEMS).flatMap(n => {
    const id = isObj(n) ? str(n.id, 32) : str(n, 32)
    return id ? [{ id, label: (isObj(n) ? str(n.label, 32) : undefined) ?? id }] : []
  })
  const ids = new Set(ns.map(n => n.id))
  const edges = arr(r.edges, 24).flatMap(e => {
    const [from, to, label] = edgeParts(e)
    const f = str(from, 32)
    const t = str(to, 32)
    return f && t && ids.has(f) && ids.has(t) ? [opt({ from: f, to: t, label: str(label, 24) })] : []
  })
  return ns.length >= 2 && edges.length ? { type: 'graph', title, nodes: ns, edges } : undefined
}

const card: Norm = (r, title) => {
  if (!title) return undefined
  const fields: Record<string, string> = {}
  if (isObj(r.fields)) for (const [k, v] of Object.entries(r.fields).slice(0, ITEMS)) if (str(k, 24) && str(v)) fields[str(k, 24) as string] = str(v) as string
  const tags = arr(r.tags, 6).flatMap(t => str(t, 20) ?? [])
  return opt({ type: 'card' as const, title, body: str(r.body, TEXT), fields: Object.keys(fields).length ? fields : undefined, tags: tags.length ? tags : undefined })
}

const stat: Norm = r => {
  const label = str(r.label)
  const value = str(r.value, 24)
  return label && value ? opt({ type: 'stat' as const, label, value, delta: str(r.delta, 24), note: str(r.note) }) : undefined
}

const calcInput = (i: unknown): CalcInput[] => {
  if (!isObj(i)) return []
  const id = ident(i.id)
  const min = num(i.min) ?? 0
  const max = num(i.max) ?? 100
  if (!id || max <= min) return []
  const step = num(i.step) && (i.step as number) > 0 ? (i.step as number) : (max - min) / 100
  const value = Math.min(max, Math.max(min, num(i.value) ?? min))
  return [opt({ id, label: str(i.label) ?? id, value, min, max, step, unit: str(i.unit, 12) })]
}

const calc: Norm = (r, title) => {
  const inputs = arr(r.inputs, 8).flatMap(calcInput)
  const outputs = arr(r.outputs, 8).flatMap((o): CalcOutput[] => {
    if (!isObj(o) || typeof o.formula !== 'string' || o.formula.length > 300) return []
    return [opt({ id: ident(o.id), label: str(o.label) ?? 'result', formula: o.formula, unit: str(o.unit, 12), digits: num(o.digits) })]
  })
  return inputs.length && outputs.length ? { type: 'calc', title, inputs, outputs } : undefined
}

const choice: Norm = r => {
  const id = ident(r.id)
  const options = arr(r.options, 8).flatMap(o => str(o, 32) ?? [])
  if (!id || options.length < 2) return undefined
  const value = str(r.value, 32)
  return opt({ type: 'choice' as const, id, label: str(r.label) ?? id, options, value: value && options.includes(value) ? value : undefined })
}

const map: Norm = (r, title) => {
  const stops = arr(r.stops, ITEMS).flatMap((s): Stop[] => {
    const label = isObj(s) ? str(s.label) : str(s)
    if (!label) return []
    const lat = isObj(s) ? num(s.lat) : undefined
    const lon = isObj(s) ? num(s.lon) : undefined
    const ok = lat !== undefined && lon !== undefined && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    return [opt({ label, lat: ok ? lat : undefined, lon: ok ? lon : undefined, note: isObj(s) ? str(s.note, 80) : undefined })]
  })
  return stops.length ? { type: 'map', title, stops } : undefined
}

const send: Norm = r => {
  const label = str(r.label, 32)
  const prompt = typeof r.prompt === 'string' && r.prompt.trim() ? r.prompt.trim().slice(0, 1000) : undefined
  return label && prompt ? { type: 'send', label, prompt } : undefined
}

const NORMS: Record<string, Norm> = {
  bars,
  bar: bars,
  line,
  scatter: scatter(false),
  quadrant: scatter(true),
  pie,
  table,
  tree,
  flow,
  graph,
  card,
  stat,
  calc,
  calculator: calc,
  choice,
  map,
  send,
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
  const components = raws.slice(0, 24).flatMap(r => normalize(r) ?? [])
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
