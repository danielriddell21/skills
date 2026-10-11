// Every drawable component as plain text lines: the terminal's form, and the fallback anywhere Svg is missing.
import type { Component, Sort, TreeNode } from '../types'

import { fmtNum } from './formula'

const BAR = 12
const W = 25
const H = 9
const SPARK = '▁▂▃▄▅▆▇█'

const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length))
const padL = (s: string, n: number) => ' '.repeat(Math.max(0, n - s.length)) + s
const unitOf = (u?: string) => (u ? ` ${u}` : '')

const treeLines = (nodes: TreeNode[], prefix = ''): string[] =>
  nodes.flatMap((n, i) => {
    const last = i === nodes.length - 1
    return [`${prefix}${last ? '└─ ' : '├─ '}${n.label}`, ...treeLines(n.children ?? [], prefix + (last ? '   ' : '│  '))]
  })

const barLines = (values: Record<string, number>, max: number, suffix: (n: number) => string): string[] => {
  const w = Math.max(...Object.keys(values).map(k => k.length))
  return Object.entries(values).map(([k, n]) => {
    const f = Math.max(0, Math.min(BAR, Math.round((n / (max || 1)) * BAR)))
    return `${pad(k, w)} ${'█'.repeat(f)}${'░'.repeat(BAR - f)} ${suffix(n)}`
  })
}

export const spark = (ys: number[]): string => {
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  return ys.map(y => SPARK[hi === lo ? 3 : Math.round(((y - lo) / (hi - lo)) * (SPARK.length - 1))]).join('')
}

/** Rows in display order for a sort; numbers compare as numbers. */
export const sortedRows = (rows: (string | number)[][], sort?: Sort): (string | number)[][] => {
  if (!sort) return rows
  const cmp = (a: string | number, b: string | number) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)))
  const out = [...rows].sort((a, b) => cmp(a[sort.col] ?? '', b[sort.col] ?? ''))
  return sort.desc ? out.reverse() : out
}

const cell = (c: string | number) => (typeof c === 'number' ? fmtNum(c) : c)

export const tableLines = (columns: string[], rows: (string | number)[][], sort?: Sort): string[] => {
  const shown = sortedRows(rows, sort)
  const widths = columns.map((c, i) => Math.max(c.length + 2, ...shown.map(r => cell(r[i] ?? '').length)))
  const head = columns.map((c, i) => pad(sort?.col === i ? `${c} ${sort.desc ? '↓' : '↑'}` : c, widths[i] ?? 0)).join(' │ ')
  const rule = widths.map(w => '─'.repeat(w)).join('─┼─')
  const body = shown.map(r => r.map((c, i) => (typeof c === 'number' ? padL(cell(c), widths[i] ?? 0) : pad(c, widths[i] ?? 0))).join(' │ '))
  return [head, rule, ...body]
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

const graphLines = (c: Extract<Component, { type: 'graph' }>): string[] => {
  const label = new Map(c.nodes.map(n => [n.id, n.label]))
  const edges = c.edges.map(e => `${label.get(e.from)} ──${e.label ? ` ${e.label} ` : ''}▶ ${label.get(e.to)}`)
  const linked = new Set(c.edges.flatMap(e => [e.from, e.to]))
  return [...edges, ...c.nodes.filter(n => !linked.has(n.id)).map(n => `${n.label} (alone)`)]
}

/** Lines for a static component (no title: the caller draws it bold). Interactive ones (calc, choice, send) give []. */
export const textLines = (c: Component, sort?: Sort): string[] => {
  switch (c.type) {
    case 'bars': {
      const max = c.max ?? Math.max(1, ...Object.values(c.values))
      return barLines(c.values, max, n => `${fmtNum(n)}${unitOf(c.unit)}`)
    }
    case 'pie': {
      const total = Object.values(c.values).reduce((a, b) => a + b, 0) || 1
      return barLines(c.values, total, n => `${Math.round((n / total) * 100)}%`)
    }
    case 'line': {
      const w = Math.max(...Object.keys(c.series).map(k => k.length))
      return [
        ...Object.entries(c.series).map(
          ([k, ys]) => `${pad(k, w)} ${spark(ys)}  ${fmtNum(ys[0] ?? 0)} → ${fmtNum(ys.at(-1) ?? 0)}${unitOf(c.unit)} (low ${fmtNum(Math.min(...ys))}, high ${fmtNum(Math.max(...ys))})`,
        ),
        `${' '.repeat(w + 1)}${c.x[0]} … ${c.x.at(-1)}`,
      ]
    }
    case 'scatter':
      return scatterLines(c)
    case 'table':
      return tableLines(c.columns, c.rows, sort)
    case 'tree':
      return treeLines(c.nodes)
    case 'flow':
      return c.lanes.map(l => l.join(' ──▶ '))
    case 'graph':
      return graphLines(c)
    case 'card':
      return [
        ...(c.body ? [c.body] : []),
        ...Object.entries(c.fields ?? {}).map(([k, v]) => `${k}: ${v}`),
        ...(c.tags?.length ? [c.tags.map(t => `[${t}]`).join(' ')] : []),
      ]
    case 'stat':
      return [`${c.value}${c.delta ? `  ${c.delta}` : ''}`, ...(c.note ? [c.note] : [])]
    case 'map':
      return [
        c.stops.map((s, i) => `(${i + 1}) ${s.label}`).join(' ──▶ '),
        ...c.stops.flatMap((s, i) => (s.note ? [`  ${i + 1}. ${s.note}`] : [])),
        ...(c.stops.some(s => s.lat !== undefined) ? [] : ['  (schematic: no coordinates)']),
      ]
    default:
      return []
  }
}

/** The heading a component draws above its lines. */
export const titleOf = (c: Component): string | undefined => {
  if (c.type === 'stat' || c.type === 'choice') return c.label
  if (c.type === 'send') return undefined
  return c.title
}

/** A text slider: `[████░░░░░░] 40`. */
export const sliderBar = (value: number, min: number, max: number, width = 16): string => {
  const f = Math.max(0, Math.min(width, Math.round(((value - min) / (max - min || 1)) * width)))
  return `[${'█'.repeat(f)}${'░'.repeat(width - f)}]`
}
