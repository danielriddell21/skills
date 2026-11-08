// Shared by the SVG and the text forms: number formatting and a layered layout for graphs.
import type { Edge } from '../types'

const group = (whole: string): string => {
  const parts: string[] = []
  for (let end = whole.length; end > 0; end -= 3) parts.unshift(whole.slice(Math.max(0, end - 3), end))
  return parts.join(',')
}

/** A number for display: grouped thousands, `digits` decimals (default: up to 2). */
export const fmtNum = (n: number, digits?: number): string => {
  const d = digits ?? (Number.isInteger(n) ? 0 : 2)
  const fixed = Math.abs(n).toFixed(Math.max(0, Math.min(6, d)))
  const [whole = '', frac] = fixed.split('.')
  return (n < 0 ? '-' : '') + group(whole) + (frac ? '.' + frac : '')
}

/** Edges that close a cycle, found by a depth-first walk in the order given; dropping them leaves a DAG. */
export const backEdges = (ids: string[], edges: Edge[]): Set<Edge> => {
  const state = new Map<string, 1 | 2>()
  const back = new Set<Edge>()
  const visit = (id: string) => {
    state.set(id, 1)
    for (const e of edges.filter(x => x.from === id)) {
      const s = state.get(e.to)
      if (s === 1) back.add(e)
      else if (s === undefined) visit(e.to)
    }
    state.set(id, 2)
  }
  for (const id of ids) if (!state.has(id)) visit(id)
  return back
}

/** Columns by longest path from a source, with cycle-closing edges left out. */
export const layers = (ids: string[], edges: Edge[]): Map<string, number> => {
  const back = backEdges(ids, edges)
  const dag = edges.filter(e => !back.has(e))
  const depth = new Map(ids.map(id => [id, 0]))
  for (const _ of ids) {
    let moved = false
    for (const e of dag) {
      const d = (depth.get(e.from) ?? 0) + 1
      if (d > (depth.get(e.to) ?? 0)) {
        depth.set(e.to, d)
        moved = true
      }
    }
    if (!moved) break
  }
  return depth
}

/**
 * Ids per column, each column ordered by the mean row of what points into it (one barycenter pass),
 * so edges cross less than in the order given.
 */
export const columns = (ids: string[], edges: Edge[]): string[][] => {
  const depth = layers(ids, edges)
  const cols: string[][] = []
  for (const id of ids) (cols[depth.get(id) ?? 0] ??= []).push(id)
  const row = new Map<string, number>()
  for (const col of cols) {
    if (!col) continue
    const score = (id: string) => {
      const ins = edges.filter(e => e.to === id && row.has(e.from)).map(e => row.get(e.from) as number)
      return ins.length ? ins.reduce((a, b) => a + b, 0) / ins.length : col.indexOf(id)
    }
    const scored = col.map(id => [id, score(id)] as const)
    scored.sort((a, b) => a[1] - b[1])
    scored.forEach(([id], i) => row.set(id, i))
    col.splice(0, col.length, ...scored.map(s => s[0]))
  }
  return cols.filter(Boolean)
}

/** Ids on a cycle. */
export const cyclic = (ids: string[], edges: Edge[]): Set<string> => {
  const back = [...backEdges(ids, edges)]
  if (!back.length) return new Set()
  // Everything that can reach a back edge's start from its end is on that cycle.
  const out = new Set<string>()
  for (const b of back) {
    const path: string[] = []
    const walk = (id: string, seen: Set<string>): boolean => {
      if (id === b.from) return true
      seen.add(id)
      for (const e of edges) if (e.from === id && !seen.has(e.to) && walk(e.to, seen)) return path.push(e.to) > 0
      return false
    }
    if (walk(b.to, new Set())) for (const id of [b.from, b.to, ...path]) out.add(id)
  }
  return out
}
