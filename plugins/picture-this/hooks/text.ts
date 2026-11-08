// Every component as plain text lines: the terminal's form (it has no Svg), and the fallback anywhere Svg is missing.
import type { Component, TreeNode } from '../types'

import { columns, cyclic, fmtNum } from './layout'

const BAR = 12
const W = 25
const H = 9

const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length))
const unitOf = (u?: string) => (u ? ` ${u}` : '')

const treeLines = (nodes: TreeNode[], prefix = ''): string[] =>
  nodes.flatMap((n, i) => {
    const last = i === nodes.length - 1
    return [`${prefix}${last ? '└─ ' : '├─ '}${n.label}`, ...treeLines(n.children ?? [], prefix + (last ? '   ' : '│  '))]
  })

const barLines = (values: Record<string, number>, max: number, unit?: string): string[] => {
  const w = Math.max(...Object.keys(values).map(k => k.length))
  return Object.entries(values).map(([k, n]) => {
    const f = Math.max(0, Math.min(BAR, Math.round((n / (max || 1)) * BAR)))
    return `${pad(k, w)} ${'█'.repeat(f)}${'░'.repeat(BAR - f)} ${fmtNum(n)}${unitOf(unit)}`
  })
}

const scatterLines = (c: Extract<Component, { type: 'scatter' }>): string[] => {
  const xs = c.points.map(p => p.x)
  const ys = c.points.map(p => p.y)
  const [x0, x1] = c.quadrant ? [0, 10] : [Math.min(...xs), Math.max(...xs)]
  const [y0, y1] = c.quadrant ? [0, 10] : [Math.min(...ys), Math.max(...ys)]
  const grid = Array.from({ length: H }, () => new Array<string>(W).fill(' '))
  if (c.quadrant) {
    for (const row of grid) row[Math.floor(W / 2)] = '┊'
    grid[Math.floor(H / 2)]?.fill('┈')
  }
  c.points.forEach((p, i) => {
    const col = Math.max(0, Math.min(W - 1, Math.round(((p.x - x0) / (x1 - x0 || 1)) * (W - 1))))
    const row = H - 1 - Math.max(0, Math.min(H - 1, Math.round(((p.y - y0) / (y1 - y0 || 1)) * (H - 1))))
    const cells = grid[row]
    if (cells) cells[col] = String.fromCodePoint(65 + i)
  })
  return [
    `${c.y} ↑`,
    ...grid.map(row => `│${row.join('')}`),
    `└${'─'.repeat(W)}→ ${c.x}`,
    ...c.points.map((p, i) => `${String.fromCodePoint(65 + i)} ${p.label} (${fmtNum(p.x)}, ${fmtNum(p.y)})`),
  ]
}

/** Each node with what it points at, in layout order: `API ─▶ Auth, DB (reads)`; ● hot (or in focus), ↺ on a cycle. */
const graphLines = (c: Extract<Component, { type: 'graph' }>, focus?: Set<string>): string[] => {
  const ids = c.nodes.map(n => n.id)
  const byId = new Map(c.nodes.map(n => [n.id, n]))
  const loop = cyclic(ids, c.edges)
  const name = (id: string) => {
    const n = byId.get(id)
    const on = focus ? focus.has(id) : n?.hot
    return `${on ? '● ' : ''}${n?.label ?? id}${loop.has(id) ? ' ↺' : ''}`
  }
  const order = columns(ids, c.edges).flat()
  const w = Math.min(24, Math.max(...order.map(id => name(id).length)))
  return order.flatMap(id => {
    const out = c.edges.filter(e => e.from === id).map(e => (e.label ? `${byId.get(e.to)?.label ?? e.to} (${e.label})` : (byId.get(e.to)?.label ?? e.to)))
    const into = c.edges.some(e => e.to === id)
    if (!out.length) return into ? [] : [`${name(id)} (alone)`]
    return [`${pad(name(id), w)} ─▶ ${out.join(', ')}`]
  })
}

/** Numbered messages under the actor row: `1. Client → API: POST /login`. */
const sequenceLines = (c: Extract<Component, { type: 'sequence' }>): string[] => {
  const w = String(c.steps.length).length
  return [c.actors.join('  ·  '), ...c.steps.map((s, i) => `${String(i + 1).padStart(w)}. ${s.from} ${s.from === s.to ? '↻' : '→'} ${s.to}${s.label ? ': ' + s.label : ''}`)]
}

/** Lines for a component (no title: the caller draws it bold). `step` picks a tour's stop; -1 is the overview. */
export const textLines = (c: Component, step = -1): string[] => {
  switch (c.type) {
    case 'tour': {
      const s = c.steps[step]
      return graphLines({ type: 'graph', nodes: c.nodes, edges: c.edges }, s ? new Set(s.focus) : undefined)
    }
    case 'bars':
      return barLines(c.values, c.max ?? Math.max(1, ...Object.values(c.values)), c.unit)
    case 'scatter':
      return scatterLines(c)
    case 'tree':
      return treeLines(c.nodes)
    case 'flow':
      return c.lanes.map(l => l.join(' ──▶ '))
    case 'graph':
      return graphLines(c)
    case 'sequence':
      return sequenceLines(c)
  }
}

/** One line saying what a picture holds, for `alt` and the terminal's summary. */
export const summaryOf = (c: Component): string => {
  switch (c.type) {
    case 'graph':
      return `${c.nodes.length} parts, ${c.edges.length} links`
    case 'tour':
      return `a ${c.steps.length}-step tour of ${c.nodes.length} parts`
    case 'sequence':
      return `${c.actors.length} actors, ${c.steps.length} messages`
    case 'flow':
      return c.lanes.map(l => l.join(' → ')).join('; ')
    case 'tree':
      return c.nodes.map(n => n.label).join(', ')
    case 'bars':
      return Object.entries(c.values)
        .map(([k, v]) => `${k} ${fmtNum(v)}`)
        .join(', ')
    case 'scatter':
      return `${c.points.length} points, ${c.x} by ${c.y}`
  }
}
