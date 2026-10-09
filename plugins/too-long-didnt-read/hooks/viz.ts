// The three chart shapes a summary can take: the same `viz` spec as your-call's charts, which draws them.
import type { TreeNode, Viz } from '../types'

import { clip, colWidth } from './toast'

const LABEL = 36
const MAX_ITEMS = 6

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const label = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? clip(v.replace(/\s+/g, ' ').trim(), LABEL) : undefined)

const normNodes = (raw: unknown, depth = 0): TreeNode[] =>
  (Array.isArray(raw) ? raw : []).slice(0, MAX_ITEMS).flatMap(n => {
    const l = isObj(n) ? label(n.label) : label(n)
    if (!l) return []
    const kids = isObj(n) && depth < 2 ? normNodes(n.children, depth + 1) : []
    return [kids.length ? { label: l, children: kids } : { label: l }]
  })

const normBars = (raw: Record<string, unknown>, title: string | undefined): Viz | undefined => {
  if (!isObj(raw.values)) return undefined
  const values: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw.values).slice(0, MAX_ITEMS)) {
    const key = label(k)
    if (key && typeof v === 'number' && Number.isFinite(v) && v >= 0) values[key] = v
  }
  return Object.keys(values).length >= 2 ? { type: 'bars', title, values } : undefined
}

const normFlow = (raw: Record<string, unknown>, title: string | undefined): Viz | undefined => {
  if (!Array.isArray(raw.lanes)) return undefined
  const lanes = raw.lanes
    .slice(0, 3)
    .map(l => (Array.isArray(l) ? l.slice(0, MAX_ITEMS).flatMap(s => label(s) ?? []) : []))
    .filter(l => l.length >= 2)
  return lanes.length ? { type: 'flow', title, lanes } : undefined
}

const normTree = (raw: Record<string, unknown>, title: string | undefined): Viz | undefined => {
  const nodes = normNodes(raw.nodes)
  return nodes.length ? { type: 'tree', title, nodes } : undefined
}

const NORMALIZERS: Record<string, (raw: Record<string, unknown>, title: string | undefined) => Viz | undefined> = {
  bars: normBars,
  flow: normFlow,
  tree: normTree,
}

/** Whatever JSON the model returned, as a chart that is safe to draw; undefined when it is not one. */
export const normalizeViz = (raw: unknown): Viz | undefined => {
  if (!isObj(raw) || typeof raw.type !== 'string') return undefined
  return NORMALIZERS[raw.type]?.(raw, label(raw.title))
}

/** Pull the JSON object out of a reply that may wrap it in a code fence or prose. */
export const parseJsonLoose = (text: string): unknown => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) return undefined
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
}

/** The plain three-line summary as a tree: used when the model's chart is unusable. */
export const treeFromSummary = (summary: string): Viz | undefined => {
  const lines = summary.split('\n').map(l => l.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean)
  const nodes = lines.slice(0, 3).flatMap((l, i) => label(`${['Verdict', 'Why', 'Next'][i]}: ${l.replace(/^(verdict|why|next):?\s*/i, '')}`) ?? [])
  return nodes.length ? { type: 'tree', title: 'TL;DR', nodes: nodes.map(n => ({ label: n })) } : undefined
}

/** Identifies an answer's text for matching a chart to its message; the same function is in your-call. */
export const answerKey = (text: string): string => {
  const t = text.trim()
  return `${t.length}:${t.slice(0, 60)}`
}

const flat = (nodes: TreeNode[]): string[] => nodes.flatMap(n => [n.label, ...flat(n.children ?? [])])

/** The chart as toast lines when it is a small tree that fits 3 lines of 40 columns; otherwise undefined (draw it in the thread). */
export const toastLines = (viz: Viz): string[] | undefined => {
  if (viz.type !== 'tree') return undefined
  const lines = flat(viz.nodes).filter(Boolean)
  return lines.length >= 1 && lines.length <= 3 && lines.every(l => colWidth(l) <= 40) ? lines : undefined
}
