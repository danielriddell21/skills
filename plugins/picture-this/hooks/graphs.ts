// Node-and-link pictures: graph (static, diffed, heated, zoomable), flow, tour steps, storyboards and compare panels.
// They share one layout and one painter, so a part sits in the same place in every panel or frame.
import type { Component, Edge, GraphNode, Panel, TourStep } from '../types'

import { columns, cyclic } from './layout'
import { CLAUDE, MID, esc, r1, svg, text, textW, tip, top, wrap } from './paint'

const NODE_H = 32
const GAP_X = 56
const GAP_Y = 22

type Box = { x: number; y: number; w: number; h: number; col: number }
// `under[i]`: the lowest box edge in column i, so an edge that skips columns can pass beneath them.
export type Layout = { pos: Map<string, Box>; w: number; h: number; under: number[] }

const nodeW = (n: GraphNode) => Math.max(76, Math.min(160, Math.max(...wrap(n.label).map(l => textW(l))) + 24))
const nodeH = (n: GraphNode) => (wrap(n.label).length > 1 ? NODE_H + 14 : NODE_H)

/** Positions for every node: columns by depth, rows by parents; room below for edges that loop back. */
export const layout = (nodes: GraphNode[], edges: Edge[]): Layout => {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const pos = new Map<string, Box>()
  let x = 0
  let bottom = 0
  const under: number[] = []
  columns(
    nodes.map(n => n.id),
    edges,
  ).forEach((col, ci) => {
    const cw = Math.max(...col.map(id => nodeW(byId.get(id) as GraphNode)))
    let y = 0
    for (const id of col) {
      const n = byId.get(id) as GraphNode
      pos.set(id, { x: x + (cw - nodeW(n)) / 2, y, w: nodeW(n), h: nodeH(n), col: ci })
      y += nodeH(n) + GAP_Y
    }
    bottom = Math.max(bottom, y - GAP_Y)
    under[ci] = y - GAP_Y
    x += cw + GAP_X
  })
  const backs = edges.filter(e => (pos.get(e.to)?.col ?? 0) <= (pos.get(e.from)?.col ?? 0)).length
  const skips = edges.some(e => (pos.get(e.to)?.col ?? 0) - (pos.get(e.from)?.col ?? 0) > 1)
  return { pos, w: Math.max(x - GAP_X, 100), h: bottom + (skips ? 14 : 0) + (backs ? 24 + backs * 14 : 0), under }
}

const NONE: Box = { x: 0, y: 0, w: 0, h: 0, col: 0 }

/** Heat 0-1 as a fill: the accent at rising strength. */
const heatFill = (h: number) => ` style="fill:${CLAUDE};fill-opacity:${r1(0.12 + 0.78 * Math.max(0, Math.min(1, h)))}"`

type Paint = { focus?: Set<string>; dx?: number; dy?: number }

const edgeLook = (e: Edge, focus?: Set<string>): { cls: string; arrow: string } => {
  if (e.change === 'added') return { cls: 'ln add', arrow: 'pt-add' }
  if (e.change === 'removed') return { cls: 'ln del', arrow: 'pt-del' }
  if (!focus) return { cls: e.change === 'changed' ? 'ln chg' : 'ln', arrow: 'pt-a' }
  return focus.has(e.from) && focus.has(e.to) ? { cls: 'ln on', arrow: 'pt-on' } : { cls: 'ln dm', arrow: 'pt-a' }
}

const boxLook = (n: GraphNode, focus?: Set<string>): { g: string; rect: string; style: string } => {
  const on = focus ? focus.has(n.id) : n.hot
  const g = `n${focus && !on ? ' dm' : ''}${n.change === 'removed' ? ' gone' : ''}`
  if (n.change === 'added') return { g, rect: 'nd add', style: ' stroke-width="2"' }
  if (n.change === 'removed') return { g, rect: 'nd del', style: ' stroke-width="1.5" stroke-dasharray="4 3"' }
  if (n.change === 'changed') return { g, rect: 'nd chg', style: ' stroke-width="2"' }
  if (n.heat !== undefined && !focus) return { g, rect: 'hot', style: ` stroke-width="1.5"${heatFill(n.heat)}` }
  return { g, rect: on ? 'hot' : 'nd', style: ' stroke-width="1.5"' }
}

/** Paint these nodes and edges at their places in `l`; the nodes need not be every node the layout holds. */
export const paintGraph = (l: Layout, nodes: GraphNode[], edges: Edge[], p: Paint = {}): string => {
  const { dx = 0, dy = 0, focus } = p
  const at = (id: string) => {
    const b = l.pos.get(id) ?? NONE
    return { ...b, x: b.x + dx, y: b.y + dy }
  }
  const byId = new Map(nodes.map(n => [n.id, n]))
  const loop = cyclic(
    nodes.map(n => n.id),
    edges,
  )
  const floor = dy + Math.max(...l.under) + (edges.some(e => (l.pos.get(e.to)?.col ?? 0) - (l.pos.get(e.from)?.col ?? 0) > 1) ? 14 : 0)
  let backs = 0
  const lines = edges
    .map(e => {
      const a = at(e.from)
      const b = at(e.to)
      let d: string
      let mid: { x: number; y: number }
      const back = b.col <= a.col
      if (back) {
        // Back edge (closes a cycle): down from its start, along a lane under every box, up into its end; dashed.
        const [x1, y1, x2, y2] = [a.x + a.w / 2 + 6, a.y + a.h, b.x + b.w / 2 - 6, b.y + b.h + 2]
        const lane = floor + 16 + backs++ * 14
        d = `M${r1(x1)} ${y1} V${lane - 6} Q${r1(x1)} ${lane} ${r1(x1 - 6)} ${lane} H${r1(x2 + 6)} Q${r1(x2)} ${lane} ${r1(x2)} ${lane - 6} V${y2}`
        mid = { x: (x1 + x2) / 2, y: lane - 3 }
      } else if (b.col - a.col > 1) {
        // Skips a column: out to the right, down under the boxes it passes, along, up into its end.
        const [x1, y1, x2, y2] = [a.x + a.w, a.y + a.h / 2, b.x - 2, b.y + b.h / 2]
        const lane = dy + Math.max(...l.under.slice(a.col + 1, b.col)) + 11
        const [ga, gb] = [x1 + GAP_X / 2, x2 - GAP_X / 2]
        d = `M${r1(x1)} ${r1(y1)} C${r1(ga)} ${r1(y1)} ${r1(ga)} ${r1(lane)} ${r1(ga + 12)} ${r1(lane)} H${r1(gb - 12)} C${r1(gb)} ${r1(lane)} ${r1(gb)} ${r1(y2)} ${r1(x2)} ${r1(y2)}`
        mid = { x: (x1 + x2) / 2, y: lane - 3 }
      } else {
        const [x1, y1, x2, y2] = [a.x + a.w, a.y + a.h / 2, b.x - 2, b.y + b.h / 2]
        const k = (x2 - x1) * 0.45
        d = `M${r1(x1)} ${r1(y1)} C${r1(x1 + k)} ${r1(y1)} ${r1(x2 - k)} ${r1(y2)} ${r1(x2)} ${r1(y2)}`
        mid = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 5 }
      }
      const look = edgeLook(e, focus)
      const dash = back || e.change === 'removed' ? ' stroke-dasharray="5 3"' : ''
      const lab = e.label ? text(mid.x, mid.y, e.label, MID, 'm', 10) : ''
      const hover = tip(`${byId.get(e.from)?.label} → ${byId.get(e.to)?.label}${e.label ? ': ' + e.label : ''}${e.change ? ' (' + e.change + ')' : ''}`)
      return `<path class="${look.cls}" d="${d}" fill="none" stroke-width="1.5"${dash} marker-end="url(#${look.arrow})">${hover}</path>${lab}`
    })
    .join('')
  const boxes = nodes
    .map(n => {
      const b = at(n.id)
      const ls = wrap(n.label)
      const ty = b.y + b.h / 2 + 4 - (ls.length - 1) * 7
      const label = ls.map((s, i) => `<text class="t" x="${r1(b.x + b.w / 2)}" y="${r1(ty + i * 14)}" font-size="12"${MID}>${esc(s)}</text>`).join('')
      const extra = [n.note, n.change, loop.has(n.id) ? 'on a cycle' : undefined, n.inside ? 'zoom in for its parts' : undefined].filter(Boolean).join(' · ')
      const look = boxLook(n, focus)
      // A part you can open has a second, inner outline.
      const inner = n.inside ? `<rect class="nd" x="${r1(b.x + 3)}" y="${b.y + 3}" width="${r1(b.w - 6)}" height="${b.h - 6}" rx="5" fill="none" stroke-width="1"/>` : ''
      return `<g class="${look.g}">${tip(n.label + (extra ? ' — ' + extra : ''))}<rect class="${look.rect}" x="${r1(b.x)}" y="${b.y}" width="${r1(b.w)}" height="${b.h}" rx="7"${look.style}/>${inner}${label}</g>`
    })
    .join('')
  return lines + boxes
}

/** What the colours in a picture mean, as one line for the host to draw under it; undefined when nothing needs saying. */
export const legendOf = (c: Component): string | undefined => {
  if (c.type === 'compare') return `+ added  − removed  (against ${c.panels[0]?.label ?? 'the first panel'})`
  if (c.type !== 'graph') return undefined
  const items: string[] = []
  if (c.nodes.some(n => n.heat !== undefined)) items.push(`shade: ${c.heatLabel ?? 'heat'}, low → high`)
  const changes = new Set([...c.nodes.map(n => n.change), ...c.edges.map(e => e.change)].filter(Boolean))
  const marks = { added: '+ added', removed: '− removed', changed: '~ changed' } as const
  const shown = (['added', 'removed', 'changed'] as const).filter(k => changes.has(k)).map(k => marks[k])
  if (shown.length) items.push(shown.join('  '))
  return items.length ? items.join('  ·  ') : undefined
}

export const graph = (c: Extract<Component, { type: 'graph' }>, focus?: Set<string>) => {
  const l = layout(c.nodes, c.edges)
  const y0 = top(c.title) + 6
  return svg(l.w + 2, y0 + l.h + 8, paintGraph(l, c.nodes, c.edges, { focus, dy: y0 }), c.title)
}

export const flowGraph = (c: Extract<Component, { type: 'flow' }>): Extract<Component, { type: 'graph' }> => ({
  type: 'graph',
  title: c.title,
  nodes: c.lanes.flatMap((l, li) => l.map((s, i) => ({ id: `${li}:${i}`, label: s }))),
  edges: c.lanes.flatMap((l, li) => l.slice(1).map((_, i) => ({ from: `${li}:${i}`, to: `${li}:${i + 1}` }))),
})

export const tourStep = (c: { title?: string; nodes: GraphNode[]; edges: Edge[]; steps: TourStep[] }, step: number) => {
  const s = c.steps[step]
  return graph({ type: 'graph', title: c.title, nodes: c.nodes, edges: c.edges }, s ? new Set(s.focus) : undefined)
}

/** Panels on one grid: as many per row as fit 920px at `scale`, at least one. */
const grid = (n: number, w: number, h: number, scale: number) => {
  const perRow = Math.max(1, Math.min(n, Math.floor(920 / (w * scale + 24))))
  return { perRow, at: (i: number) => ({ x: (i % perRow) * (w * scale + 24), y: Math.floor(i / perRow) * (h * scale + 52) }) }
}

/** Every step of a tour at once, small multiples with a numbered caption under each. */
export const storyboard = (c: Extract<Component, { type: 'storyboard' }>) => {
  const l = layout(c.nodes, c.edges)
  const scale = Math.min(1, 440 / l.w)
  const g = grid(c.steps.length, l.w, l.h, scale)
  const y0 = top(c.title) + 4
  const frames = c.steps
    .map((s, i) => {
      const p = g.at(i)
      const caption = wrap(`${i + 1}. ${s.text}`, Math.floor((l.w * scale) / 6))
        .map((line, j) => text(p.x, y0 + p.y + l.h * scale + 16 + j * 13, line, '', j ? 'm' : 't'))
        .join('')
      return `<g transform="translate(${r1(p.x)} ${r1(y0 + p.y)}) scale(${r1(scale * 100) / 100})">${paintGraph(l, c.nodes, c.edges, { focus: new Set(s.focus) })}</g>${caption}`
    })
    .join('')
  const rows = Math.ceil(c.steps.length / g.perRow)
  return svg(Math.min(c.steps.length, g.perRow) * (l.w * scale + 24), y0 + rows * (l.h * scale + 52), frames, c.title)
}

/** One panel's parts marked against the baseline: new ones added; baseline ones it lacks shown as removed ghosts. */
export const diffPanel = (base: Panel, p: Panel): { nodes: GraphNode[]; edges: Edge[] } => {
  if (p === base) return { nodes: p.nodes, edges: p.edges }
  const baseIds = new Set(base.nodes.map(n => n.id))
  const ids = new Set(p.nodes.map(n => n.id))
  const key = (e: Edge) => `${e.from}>${e.to}`
  const baseEdges = new Set(base.edges.map(key))
  const edgeKeys = new Set(p.edges.map(key))
  return {
    nodes: [...p.nodes.map(n => (baseIds.has(n.id) ? n : { ...n, change: 'added' as const })), ...base.nodes.filter(n => !ids.has(n.id)).map(n => ({ ...n, change: 'removed' as const }))],
    edges: [
      ...p.edges.map(e => (baseEdges.has(key(e)) ? e : { ...e, change: 'added' as const })),
      ...base.edges.filter(e => !edgeKeys.has(key(e))).map(e => ({ ...e, change: 'removed' as const })),
    ],
  }
}

/** Before / after, or options: every panel on the union's layout, so only what changes moves. */
export const compare = (c: Extract<Component, { type: 'compare' }>) => {
  const base = c.panels[0] as Panel
  const union = new Map<string, GraphNode>()
  for (const p of c.panels) for (const n of p.nodes) if (!union.has(n.id)) union.set(n.id, n)
  const seen = new Set<string>()
  const allEdges = c.panels.flatMap(p => p.edges).filter(e => !seen.has(`${e.from}>${e.to}`) && seen.add(`${e.from}>${e.to}`))
  const l = layout([...union.values()], allEdges)
  // Full size, stacked when they do not fit side by side; only a panel wider than the slot shrinks.
  const scale = Math.min(1, 900 / l.w)
  const g = grid(c.panels.length, l.w, l.h, scale)
  const y0 = top(c.title) + 4
  const panels = c.panels
    .map((p, i) => {
      const at = g.at(i)
      const d = diffPanel(base, p)
      const head = text(at.x, y0 + at.y + 12, i === 0 ? `${p.label}` : `${p.label}  (vs ${base.label})`, ' font-weight="600"', 't', 12)
      return `${head}<g transform="translate(${r1(at.x)} ${r1(y0 + at.y + 22)}) scale(${r1(scale * 100) / 100})">${paintGraph(l, d.nodes, d.edges)}</g>`
    })
    .join('')
  const rows = Math.ceil(c.panels.length / g.perRow)
  return svg(Math.min(c.panels.length, g.perRow) * (l.w * scale + 24), y0 + rows * (l.h * scale + 52) - 20, panels, c.title)
}

/** The graph at a zoom path ('' is the top; 'api/auth' is inside api, then inside auth), with the labels along the way. */
export const zoomTo = (c: { nodes: GraphNode[]; edges: Edge[] }, path: string): { nodes: GraphNode[]; edges: Edge[]; trail: string[]; path: string } => {
  let cur = { nodes: c.nodes, edges: c.edges }
  const trail: string[] = []
  const ok: string[] = []
  for (const id of path.split('/').filter(Boolean)) {
    const n = cur.nodes.find(x => x.id === id)
    if (!n?.inside) break
    trail.push(n.label)
    ok.push(id)
    cur = n.inside
  }
  return { ...cur, trail, path: ok.join('/') }
}
