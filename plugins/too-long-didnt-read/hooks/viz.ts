// The three chart shapes a summary can take: the same `viz` spec as your-call's charts, which draws them.
import type { TreeNode, Viz } from '../types'

import { clip } from './toast'

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

/** Whatever JSON the model returned, as a chart that is safe to draw; undefined when it is not one. */
export const normalizeViz = (raw: unknown): Viz | undefined => {
  if (!isObj(raw)) return undefined
  const title = label(raw.title)
  if (raw.type === 'bars' && isObj(raw.values)) {
    const values: Record<string, number> = {}
    for (const [k, v] of Object.entries(raw.values).slice(0, MAX_ITEMS)) {
      const key = label(k)
      if (key && typeof v === 'number' && Number.isFinite(v) && v >= 0) values[key] = v
    }
    return Object.keys(values).length >= 2 ? { type: 'bars', title, values } : undefined
  }
  if (raw.type === 'flow' && Array.isArray(raw.lanes)) {
    const lanes = raw.lanes
      .slice(0, 3)
      .map(l => (Array.isArray(l) ? l.slice(0, MAX_ITEMS).flatMap(s => label(s) ?? []) : []))
      .filter(l => l.length >= 2)
    return lanes.length ? { type: 'flow', title, lanes } : undefined
  }
  if (raw.type === 'tree') {
    const nodes = normNodes(raw.nodes)
    return nodes.length ? { type: 'tree', title, nodes } : undefined
  }
  return undefined
}

/** Pull the JSON object out of a reply that may wrap it in a code fence or prose. */
export const parseJsonLoose = (text: string): unknown => {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return undefined
  try {
    return JSON.parse(m[0])
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
