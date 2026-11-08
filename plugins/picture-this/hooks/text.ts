// Every component as plain text lines: the terminal's form (it has no Svg), and the fallback anywhere Svg is missing.
import type { Component, Edge, GraphNode, Panel, TreeNode } from '../types'

import { tickLabel } from './charts'
import { diffPanel, zoomTo } from './graphs'
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

const SHADE = ' ░▒▓█'
const shade = (f: number) => SHADE[Math.max(1, Math.min(4, Math.round(f * 4)))] ?? '█'
const MARK: Record<string, string> = { added: '+ ', removed: '− ', changed: '~ ' }

/** Each node with what it points at, in layout order: `API ─▶ Auth, DB (reads)`; ● hot or in focus, ↺ on a cycle,
 * + − ~ for a diff, a shade block for heat, ⊕ for a part you can open. */
const graphLines = (c: { nodes: GraphNode[]; edges: Edge[] }, focus?: Set<string>): string[] => {
  const ids = c.nodes.map(n => n.id)
  const byId = new Map(c.nodes.map(n => [n.id, n]))
  const loop = cyclic(ids, c.edges)
  const name = (id: string) => {
    const n = byId.get(id)
    const on = focus ? focus.has(id) : n?.hot
    const heat = n?.heat === undefined ? '' : shade(n.heat) + ' '
    return `${MARK[n?.change ?? ''] ?? ''}${heat}${on ? '● ' : ''}${n?.label ?? id}${n?.inside ? ' ⊕' : ''}${loop.has(id) ? ' ↺' : ''}`
  }
  const target = (e: Edge) => `${MARK[e.change ?? ''] ?? ''}${byId.get(e.to)?.label ?? e.to}${e.label ? ` (${e.label})` : ''}`
  const order = columns(ids, c.edges).flat()
  const w = Math.min(26, Math.max(...order.map(id => name(id).length)))
  return order.flatMap(id => {
    const out = c.edges.filter(e => e.from === id).map(target)
    const into = c.edges.some(e => e.to === id)
    // An end of the line is already named by what points at it, unless it carries a mark of its own.
    if (!out.length) return into ? (name(id) === (byId.get(id)?.label ?? id) ? [] : [name(id)]) : [`${name(id)} (alone)`]
    return [`${pad(name(id), w)} ─▶ ${out.join(', ')}`]
  })
}

/** Numbered messages under the actor row: `1. Client → API: POST /login`. */
const sequenceLines = (c: Extract<Component, { type: 'sequence' }>): string[] => {
  const w = String(c.steps.length).length
  return [c.actors.join('  ·  '), ...c.steps.map((s, i) => `${String(i + 1).padStart(w)}. ${s.from} ${s.from === s.to ? '↻' : '→'} ${s.to}${s.label ? ': ' + s.label : ''}`)]
}

/** The baseline as a graph, then each other panel as what it adds and removes. */
const compareLines = (c: Extract<Component, { type: 'compare' }>): string[] => {
  const base = c.panels[0] as Panel
  const label = new Map(c.panels.flatMap(p => p.nodes.map(n => [n.id, n.label] as const)))
  const edge = (e: Edge) => `${label.get(e.from) ?? e.from} ─▶ ${label.get(e.to) ?? e.to}`
  return [
    `${base.label}:`,
    ...graphLines(base).map(l => '  ' + l),
    ...c.panels.slice(1).flatMap(p => {
      const d = diffPanel(base, p)
      const changed = [...d.nodes.filter(n => n.change).map(n => `${MARK[n.change ?? '']}${n.label}`), ...d.edges.filter(e => e.change).map(e => `${MARK[e.change ?? '']}${edge(e)}`)]
      return [`${p.label} (vs ${base.label}):`, ...(changed.length ? changed.map(l => '  ' + l) : ['  (no change)'])]
    }),
  ]
}

/** Each step as a row: its number, then its lane's column marked. */
const swimLines = (c: Extract<Component, { type: 'swimlane' }>): string[] => {
  const w = Math.max(...c.lanes.map(l => l.length))
  return c.lanes.map(l => {
    const mine = c.steps.flatMap((s, i) => (s.lane === l ? [`${i + 1} ${s.label}`] : []))
    return `${pad(l, w)} │ ${mine.join('  ·  ')}`
  })
}

const TRACK = 30
const timeLines = (c: Extract<Component, { type: 'timeline' }>): string[] => {
  const lo = Math.min(...c.items.map(i => i.start))
  const hi = Math.max(...c.items.map(i => i.end ?? i.start))
  const at = (v: number) => Math.round(((v - lo) / (hi - lo || 1)) * (TRACK - 1))
  const w = Math.max(...c.items.map(i => i.label.length))
  return [
    `${pad('', w)}  ${pad(tickLabel(lo, c.clock, c.unit), TRACK - 6)}${tickLabel(hi, c.clock, c.unit)}`,
    ...c.items.map(it => {
      const row = new Array<string>(TRACK).fill('·')
      if (it.end === undefined) row[at(it.start)] = '◆'
      else row.fill('█', at(it.start), at(it.end) + 1)
      const when = tickLabel(it.start, c.clock, c.unit) + (it.end === undefined ? '' : '–' + tickLabel(it.end, c.clock, c.unit))
      return `${pad(it.label, w)}  ${row.join('')} ${when}${it.hot ? '  ●' : ''}`
    }),
  ]
}

const matrixLines = (c: Extract<Component, { type: 'matrix' }>): string[] => {
  const max = c.max ?? Math.max(1, ...c.values.flat())
  const w = Math.max(...c.rows.map(r => r.length))
  const keys = c.cols.map((k, j) => `${String.fromCodePoint(97 + j)}=${k}`)
  return [
    `${pad('', w)}  ${c.cols.map((_, j) => String.fromCodePoint(97 + j)).join(' ')}`,
    ...c.rows.map((r, i) => `${pad(r, w)}  ${c.cols.map((_, j) => ((c.values[i]?.[j] ?? 0) ? shade((c.values[i]?.[j] ?? 0) / max) : '·')).join(' ')}`),
    keys.join('  '),
  ]
}

const sankeyLines = (c: Extract<Component, { type: 'sankey' }>): string[] => {
  const max = Math.max(...c.links.map(l => l.value))
  const w = Math.max(...c.links.map(l => `${l.from} ─▶ ${l.to}`.length))
  return c.links.map(l => `${pad(`${l.from} ─▶ ${l.to}`, w)} ${'█'.repeat(Math.max(1, Math.round((l.value / max) * BAR)))} ${fmtNum(l.value)}${unitOf(c.unit)}`)
}

const radarLines = (c: Extract<Component, { type: 'radar' }>): string[] => {
  const names = Object.keys(c.series)
  const w = Math.max(...c.axes.map(a => a.length))
  return [`${pad('', w)}  ${names.join(' / ')}`, ...c.axes.map((a, i) => `${pad(a, w)}  ${names.map(k => `${shade((c.series[k]?.[i] ?? 0) / c.max)} ${fmtNum(c.series[k]?.[i] ?? 0)}`).join('   ')}`)]
}

const treemapLines = (c: Extract<Component, { type: 'treemap' }>): string[] => {
  const groups = new Map<string, [string, number][]>()
  for (const [path, v] of Object.entries(c.values)) {
    const [head, ...rest] = path.split('/')
    const g = rest.length ? (head ?? path) : '.'
    groups.set(g, [...(groups.get(g) ?? []), [path, v]])
  }
  const hot = new Set(c.hot ?? [])
  const total = Object.values(c.values).reduce((a, b) => a + b, 0) || 1
  return [...groups.entries()]
    .map(([g, fs]) => [g, fs, fs.reduce((a, [, v]) => a + v, 0)] as const)
    .sort((a, b) => b[2] - a[2])
    .flatMap(([g, fs, gv]) => [
      `${g}/  ${'█'.repeat(Math.max(1, Math.round((gv / total) * BAR)))} ${fmtNum(gv)}${unitOf(c.unit)}`,
      ...[...fs].sort((a, b) => b[1] - a[1]).map(([p, v]) => `  ${hot.has(p) ? '● ' : ''}${p.split('/').slice(1).join('/') || p}  ${fmtNum(v)}`),
    ])
}

/** Lines for a component (no title: the caller draws it bold). `step` picks a tour's stop (-1 the overview); `path` a zoom. */
export const textLines = (c: Component, step = -1, path = ''): string[] => {
  switch (c.type) {
    case 'graph':
      return graphLines(zoomTo(c, path))
    case 'compare':
      return compareLines(c)
    case 'tour': {
      const s = c.steps[step]
      return graphLines(c, s ? new Set(s.focus) : undefined)
    }
    case 'storyboard':
      return c.steps.map((s, i) => `${i + 1}. ${s.text}${s.focus.length ? '  [' + s.focus.map(id => c.nodes.find(n => n.id === id)?.label ?? id).join(', ') + ']' : ''}`)
    case 'flow':
      return c.lanes.map(l => l.join(' ──▶ '))
    case 'sequence':
      return sequenceLines(c)
    case 'swimlane':
      return swimLines(c)
    case 'timeline':
      return timeLines(c)
    case 'tree':
      return treeLines(c.nodes)
    case 'treemap':
      return treemapLines(c)
    case 'matrix':
      return matrixLines(c)
    case 'sankey':
      return sankeyLines(c)
    case 'bars':
      return barLines(c.values, c.max ?? Math.max(1, ...Object.values(c.values)), c.unit)
    case 'scatter':
      return scatterLines(c)
    case 'radar':
      return radarLines(c)
  }
}

/** One line saying what a picture holds, for `alt` and the terminal's summary. */
export const summaryOf = (c: Component): string => {
  switch (c.type) {
    case 'graph':
      return `${c.nodes.length} parts, ${c.edges.length} links`
    case 'compare':
      return c.panels.map(p => p.label).join(' vs ')
    case 'tour':
      return `a ${c.steps.length}-step tour of ${c.nodes.length} parts`
    case 'storyboard':
      return `${c.steps.length} frames: ${c.steps.map(s => s.text).join(' / ')}`
    case 'sequence':
      return `${c.actors.length} actors, ${c.steps.length} messages`
    case 'flow':
      return c.lanes.map(l => l.join(' → ')).join('; ')
    case 'swimlane':
      return `${c.steps.length} steps across ${c.lanes.join(', ')}`
    case 'timeline':
      return `${c.items.length} events from ${tickLabel(Math.min(...c.items.map(i => i.start)), c.clock, c.unit)}`
    case 'tree':
      return c.nodes.map(n => n.label).join(', ')
    case 'treemap':
      return `${Object.keys(c.values).length} items by size`
    case 'matrix':
      return `${c.rows.length} × ${c.cols.length} grid`
    case 'sankey':
      return `${c.links.length} flows`
    case 'bars':
      return Object.entries(c.values)
        .map(([k, v]) => `${k} ${fmtNum(v)}`)
        .join(', ')
    case 'scatter':
      return `${c.points.length} points, ${c.x} by ${c.y}`
    case 'radar':
      return `${Object.keys(c.series).join(', ')} on ${c.axes.join(', ')}`
  }
}
