// SVG for desktop, VS Code and mobile (no Svg in a terminal). Colours come from a <style> with a
// prefers-color-scheme override, so one drawing reads on light and dark; the host isolates the markup
// (an image, or a script-less frame when interactive), so nothing here can reach the page.
import type { Component, GraphNode } from '../types'

import { columns, cyclic, fmtNum } from './layout'

// Categorical slots of the reference palette; mid steps that hold up on light and dark.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#6250d6']
export const MAX_SVG = 131072

const STYLE =
  '<style>' +
  '.t{fill:#3f3f46}.m{fill:#71717a}.ln{stroke:#a1a1aa}.ah{fill:#a1a1aa}.nd{fill:#f4f4f5;stroke:#2a78d6}.hot{fill:#fde7dc;stroke:#eb6834}.lf{stroke:#d4d4d8}' +
  '@media (prefers-color-scheme:dark){.t{fill:#e4e4e7}.m{fill:#a1a1aa}.ln{stroke:#71717a}.ah{fill:#71717a}.nd{fill:#1f2937;stroke:#5b9be6}.hot{fill:#43251a;stroke:#f08a5d}.lf{stroke:#3f3f46}}' +
  'g.n:hover rect{stroke-width:2.5}.dm{opacity:.3}.on{stroke:#2a78d6!important;stroke-width:2.2}' +
  '</style>'
const FONT = 'font-family="system-ui,-apple-system,Segoe UI,sans-serif"'

export const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const r1 = (n: number) => Math.round(n * 10) / 10
const svg = (w: number, h: number, body: string, title?: string) => {
  const head = title ? `<text class="t" x="0" y="14" font-size="13" font-weight="600">${esc(title)}</text>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" ${FONT} viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}" width="${Math.ceil(w)}">${STYLE}${head}${body}</svg>`
}
const text = (x: number, y: number, s: string, extra = '', cls = 'm', size = 11) => `<text class="${cls}" x="${r1(x)}" y="${r1(y)}" font-size="${size}"${extra}>${esc(s)}</text>`
const tip = (s: string) => '<title>' + esc(s) + '</title>'
const top = (title?: string) => (title ? 26 : 4)
const MID = ' text-anchor="middle"'

// Rough width of 12px system-ui text; enough to size boxes without measuring.
const textW = (s: string, size = 12) => s.length * size * 0.56
/** A label in at most two lines of `max` characters, breaking at a space where it can. */
export const wrap = (s: string, max = 18): string[] => {
  if (s.length <= max) return [s]
  const cut = s.lastIndexOf(' ', max)
  const at = cut > max / 3 ? cut : max
  const rest = s.slice(at).trim()
  return [s.slice(0, at).trim(), rest.length > max ? rest.slice(0, max - 1) + '…' : rest]
}

const bars = (c: Extract<Component, { type: 'bars' }>) => {
  const rows = Object.entries(c.values)
  const max = c.max ?? Math.max(1, ...rows.map(r => r[1]))
  const lw = Math.min(160, 10 + Math.max(...rows.map(r => textW(r[0], 11))))
  const y0 = top(c.title)
  const body = rows
    .map(([k, n], i) => {
      const y = y0 + i * 26
      const w = Math.max(2, Math.round((n / max) * 220))
      const value = fmtNum(n) + (c.unit ? ' ' + c.unit : '')
      return `${text(0, y + 12, k)}<rect x="${r1(lw)}" y="${y}" width="${w}" height="16" rx="4" fill="${SERIES[0]}">${tip(k + ': ' + value)}</rect>${text(lw + w + 6, y + 12, value, '', 't')}`
    })
    .join('')
  return svg(lw + 300, y0 + rows.length * 26 + 4, body, c.title)
}

const scatter = (c: Extract<Component, { type: 'scatter' }>) => {
  const xs = c.points.map(p => p.x)
  const ys = c.points.map(p => p.y)
  const [xa, xb] = c.quadrant ? [0, 10] : [Math.min(...xs), Math.max(...xs)]
  const [ya, yb] = c.quadrant ? [0, 10] : [Math.min(...ys), Math.max(...ys)]
  const [x0, y0, w, h] = [40, top(c.title), 300, 180]
  const sx = (v: number) => x0 + 10 + ((v - xa) / (xb - xa || 1)) * (w - 20)
  const sy = (v: number) => y0 + h - 10 - ((v - ya) / (yb - ya || 1)) * (h - 20)
  const mid = c.quadrant ? `<line class="ln" x1="${x0 + w / 2}" y1="${y0}" x2="${x0 + w / 2}" y2="${y0 + h}" stroke-dasharray="3 3"/><line class="ln" x1="${x0}" y1="${y0 + h / 2}" x2="${x0 + w}" y2="${y0 + h / 2}" stroke-dasharray="3 3"/>` : ''
  const dots = c.points
    .map(p => {
      const cx = sx(p.x)
      const cy = sy(p.y)
      const left = cx > x0 + w * 0.65
      return `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="6" fill="${SERIES[0]}">${tip(p.label + ': ' + fmtNum(p.x) + ', ' + fmtNum(p.y))}</circle>${text(left ? cx - 10 : cx + 10, cy + 4, p.label, left ? ' text-anchor="end"' : '', 't')}`
    })
    .join('')
  const axes = `<rect class="ln" x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none"/>${text(x0 + w / 2, y0 + h + 18, c.x + ' →', MID)}${text(12, y0 + h / 2, c.y + ' →', MID + ' transform="rotate(-90 12 ' + r1(y0 + h / 2) + ')"')}`
  return svg(x0 + w + 10, y0 + h + 26, `${axes}${mid}${dots}`, c.title)
}

const NODE_H = 32
const GAP_X = 56
const GAP_Y = 22

const nodeW = (n: GraphNode) => Math.max(76, Math.min(160, Math.max(...wrap(n.label).map(l => textW(l))) + 24))
const nodeH = (n: GraphNode) => (wrap(n.label).length > 1 ? NODE_H + 14 : NODE_H)

/** `focus`, when given, lights those parts and the links between them and dims the rest (a tour step). */
export const graph = (c: Extract<Component, { type: 'graph' }>, focus?: Set<string>) => {
  const ids = c.nodes.map(n => n.id)
  const byId = new Map(c.nodes.map(n => [n.id, n]))
  const cols = columns(ids, c.edges)
  const loop = cyclic(ids, c.edges)
  const y0 = top(c.title) + 6
  const pos = new Map<string, { x: number; y: number; w: number; h: number; col: number }>()
  let x = 0
  let bottom = y0
  cols.forEach((col, ci) => {
    const cw = Math.max(...col.map(id => nodeW(byId.get(id) as GraphNode)))
    let y = y0
    for (const id of col) {
      const n = byId.get(id) as GraphNode
      const h = nodeH(n)
      pos.set(id, { x: x + (cw - nodeW(n)) / 2, y, w: nodeW(n), h, col: ci })
      y += h + GAP_Y
    }
    bottom = Math.max(bottom, y)
    x += cw + GAP_X
  })
  const none = { x: 0, y: 0, w: 0, h: 0, col: 0 }
  const floor = bottom - GAP_Y
  let backs = 0
  const lines = c.edges
    .map(e => {
      const a = pos.get(e.from) ?? none
      const b = pos.get(e.to) ?? none
      let d: string
      let mid: { x: number; y: number }
      if (b.col <= a.col) {
        // Back edge (closes a cycle): down from its start, along a lane under every box, up into its end; dashed.
        const [x1, y1, x2, y2] = [a.x + a.w / 2 + 6, a.y + a.h, b.x + b.w / 2 - 6, b.y + b.h + 2]
        const lane = floor + 14 + backs++ * 14
        d = `M${r1(x1)} ${y1} V${lane - 6} Q${r1(x1)} ${lane} ${r1(x1 - 6)} ${lane} H${r1(x2 + 6)} Q${r1(x2)} ${lane} ${r1(x2)} ${lane - 6} V${y2}`
        mid = { x: (x1 + x2) / 2, y: lane - 3 }
        bottom = Math.max(bottom, lane + 10)
      } else {
        const [x1, y1, x2, y2] = [a.x + a.w, a.y + a.h / 2, b.x - 2, b.y + b.h / 2]
        const k = (x2 - x1) * 0.45
        d = `M${r1(x1)} ${r1(y1)} C${r1(x1 + k)} ${r1(y1)} ${r1(x2 - k)} ${r1(y2)} ${r1(x2)} ${r1(y2)}`
        mid = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 5 }
      }
      const lab = e.label ? text(mid.x, mid.y, e.label, MID, 'm', 10) : ''
      const hover = tip(`${byId.get(e.from)?.label} → ${byId.get(e.to)?.label}${e.label ? ': ' + e.label : ''}`)
      const dash = b.col <= a.col ? ' stroke-dasharray="5 3"' : ''
      const lit = focus?.has(e.from) && focus.has(e.to)
      const edgeCls = focus ? (lit ? 'ln on' : 'ln dm') : 'ln'
      return `<path class="${edgeCls}" d="${d}" fill="none" stroke-width="1.5"${dash} marker-end="url(#pt-arrow)">${hover}</path>${lab}`
    })
    .join('')
  const boxes = c.nodes
    .map(n => {
      const p = pos.get(n.id) ?? none
      const ls = wrap(n.label)
      const ty = p.y + p.h / 2 + 4 - (ls.length - 1) * 7
      const label = ls.map((l, i) => `<text class="t" x="${r1(p.x + p.w / 2)}" y="${r1(ty + i * 14)}" font-size="12"${MID}>${esc(l)}</text>`).join('')
      const extra = [n.note, loop.has(n.id) ? 'on a cycle' : undefined].filter(Boolean).join(' · ')
      const on = focus ? focus.has(n.id) : n.hot
      return `<g class="n${focus && !on ? ' dm' : ''}">${tip(n.label + (extra ? ' — ' + extra : ''))}<rect class="${on ? 'hot' : 'nd'}" x="${r1(p.x)}" y="${p.y}" width="${r1(p.w)}" height="${p.h}" rx="7" stroke-width="1.5"/>${label}</g>`
    })
    .join('')
  const defs = `<defs><marker id="pt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="ah" d="M0 0L10 5L0 10z"/></marker></defs>`
  return svg(Math.max(x - GAP_X + 2, 120), bottom + 4, `${defs}${lines}${boxes}`, c.title)
}

const flow = (c: Extract<Component, { type: 'flow' }>) =>
  graph({
    type: 'graph',
    title: c.title,
    nodes: c.lanes.flatMap((l, li) => l.map((s, i) => ({ id: `${li}:${i}`, label: s }))),
    edges: c.lanes.flatMap((l, li) => l.slice(1).map((_, i) => ({ from: `${li}:${i}`, to: `${li}:${i + 1}` }))),
  })

const sequence = (c: Extract<Component, { type: 'sequence' }>) => {
  const colW = Math.max(110, Math.min(170, Math.max(...c.actors.map(a => textW(a) + 28)), Math.max(...c.steps.map(s => textW(s.label ?? '', 10) + 20))))
  const y0 = top(c.title) + 4
  const cx = (a: string) => colW / 2 + c.actors.indexOf(a) * colW
  const rowH = 30
  const first = y0 + NODE_H + 22
  const end = first + c.steps.length * rowH
  const heads = c.actors
    .map(a => `<g class="n">${tip(a)}<rect class="nd" x="${r1(cx(a) - colW / 2 + 8)}" y="${y0}" width="${r1(colW - 16)}" height="${NODE_H}" rx="7" stroke-width="1.5"/><text class="t" x="${r1(cx(a))}" y="${y0 + 20}" font-size="12"${MID}>${esc(a)}</text></g><line class="lf" x1="${r1(cx(a))}" y1="${y0 + NODE_H}" x2="${r1(cx(a))}" y2="${end}" stroke-dasharray="4 4"/>`)
    .join('')
  const msgs = c.steps
    .map((s, i) => {
      const y = first + i * rowH
      const [x1, x2] = [cx(s.from), cx(s.to)]
      const n = `${i + 1}. ${s.label ?? ''}`.trim()
      const hover = tip(`${i + 1}. ${s.from} → ${s.to}${s.label ? ': ' + s.label : ''}`)
      if (s.from === s.to) {
        const d = `M${r1(x1)} ${y - 6} h26 v12 h-24`
        return `<path class="ln" d="${d}" fill="none" stroke-width="1.5" marker-end="url(#pt-arrow)">${hover}</path>${text(x1 + 32, y + 4, n)}`
      }
      const back = x2 < x1
      return `<line class="ln" x1="${r1(x1)}" y1="${y}" x2="${r1(back ? x2 + 2 : x2 - 2)}" y2="${y}" stroke-width="1.5"${back ? ' stroke-dasharray="5 3"' : ''} marker-end="url(#pt-arrow)">${hover}</line>${text((x1 + x2) / 2, y - 5, n, MID, 'm', 10)}`
    })
    .join('')
  const defs = `<defs><marker id="pt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="ah" d="M0 0L10 5L0 10z"/></marker></defs>`
  return svg(c.actors.length * colW, end + 8, `${defs}${heads}${msgs}`, c.title)
}

/** The component as SVG, or undefined when it reads better as text (a tree) or is too big to send. `step` picks a tour's stop. */
export const svgFor = (c: Component, step = -1): string | undefined => {
  let out: string | undefined
  if (c.type === 'tour') {
    const s = c.steps[step]
    out = graph({ type: 'graph', title: c.title, nodes: c.nodes, edges: c.edges }, s ? new Set(s.focus) : undefined)
  }
  if (c.type === 'bars') out = bars(c)
  else if (c.type === 'scatter') out = scatter(c)
  else if (c.type === 'graph') out = graph(c)
  else if (c.type === 'flow') out = flow(c)
  else if (c.type === 'sequence') out = sequence(c)
  return out && out.length <= MAX_SVG ? out : undefined
}
