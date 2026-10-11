// SVG for the components that read better as pictures; desktop, VS Code and mobile draw these (no Svg in a terminal).
import type { Component } from '../types'

import { fmtNum } from './formula'

// Categorical slots 1-4 of the reference palette, in fixed order; mid steps that hold up on light and dark.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#6250d6']
const INK = '#7d7d7d'
const FONT = 'font-family="system-ui,-apple-system,Segoe UI,sans-serif"'
export const MAX_SVG = 131072

export const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const r1 = (n: number) => Math.round(n * 10) / 10
const svg = (w: number, h: number, body: string, title?: string) => {
  const head = title ? `<text x="0" y="14" font-size="13" font-weight="600" fill="${INK}">${esc(title)}</text>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" ${FONT} viewBox="0 0 ${w} ${h}">${head}${body}</svg>`
}
const label = (x: number, y: number, s: string, extra = '') => `<text x="${r1(x)}" y="${r1(y)}" font-size="11" fill="${INK}"${extra}>${esc(s)}</text>`
const tip = (text: string) => '<title>' + esc(text) + '</title>'
const unitText = (n: number, unit?: string) => (unit ? fmtNum(n) + ' ' + unit : fmtNum(n))
const endAnchor = (left: boolean) => (left ? ' text-anchor="end"' : '')
const top = (title?: string) => (title ? 26 : 4)

const bars = (c: Extract<Component, { type: 'bars' }>) => {
  const rows = Object.entries(c.values)
  const max = c.max ?? Math.max(1, ...rows.map(r => r[1]))
  const lw = Math.min(140, 8 + 7 * Math.max(...rows.map(r => r[0].length)))
  const y0 = top(c.title)
  const body = rows
    .map(([k, n], i) => {
      const y = y0 + i * 26
      const w = Math.max(2, Math.round((n / max) * 200))
      const value = unitText(n, c.unit)
      return `${label(0, y + 12, k)}<rect x="${lw}" y="${y}" width="${w}" height="16" rx="4" fill="${SERIES[0]}">${tip(k + ': ' + value)}</rect>${label(lw + w + 6, y + 12, value)}`
    })
    .join('')
  return svg(lw + 290, y0 + rows.length * 26 + 4, body, c.title)
}

const line = (c: Extract<Component, { type: 'line' }>) => {
  const all = Object.values(c.series).flat()
  const lo = Math.min(0, ...all)
  const hi = Math.max(...all)
  const [x0, y0, w, h] = [44, top(c.title) + 6, 300, 140]
  const sx = (i: number) => x0 + (i / (c.x.length - 1)) * w
  const sy = (v: number) => y0 + h - ((v - lo) / (hi - lo || 1)) * h
  const grid = [lo, (lo + hi) / 2, hi]
    .map(v => `<line x1="${x0}" x2="${x0 + w}" y1="${r1(sy(v))}" y2="${r1(sy(v))}" stroke="${INK}" opacity=".2"/>${label(x0 - 6, sy(v) + 4, fmtNum(v), ' text-anchor="end"')}`)
    .join('')
  const names = Object.keys(c.series)
  const paths = names
    .map((k, s) => {
      const ys = c.series[k] ?? []
      const d = ys.map((v, i) => `${i ? 'L' : 'M'}${r1(sx(i))} ${r1(sy(v))}`).join(' ')
      const dots = ys.map((v, i) => `<circle cx="${r1(sx(i))}" cy="${r1(sy(v))}" r="4" fill="${SERIES[s]}">${tip(k + ', ' + (c.x[i] ?? '') + ': ' + fmtNum(v))}</circle>`).join('')
      return `<path d="${d}" fill="none" stroke="${SERIES[s]}" stroke-width="2"/>${dots}`
    })
    .join('')
  const xl = `${label(x0, y0 + h + 16, c.x[0] ?? '')}${label(x0 + w, y0 + h + 16, c.x.at(-1) ?? '', ' text-anchor="end"')}`
  const legend = names.length > 1 ? names.map((k, s) => `<rect x="${x0 + s * 90}" y="${y0 + h + 26}" width="10" height="10" rx="2" fill="${SERIES[s]}"/>${label(x0 + s * 90 + 14, y0 + h + 35, k)}`).join('') : ''
  return svg(x0 + w + 16, y0 + h + (names.length > 1 ? 44 : 24), `${grid}${paths}${xl}${legend}`, c.title)
}

const scatter = (c: Extract<Component, { type: 'scatter' }>) => {
  const xs = c.points.map(p => p.x)
  const ys = c.points.map(p => p.y)
  const [xa, xb] = c.quadrant ? [0, 10] : [Math.min(...xs), Math.max(...xs)]
  const [ya, yb] = c.quadrant ? [0, 10] : [Math.min(...ys), Math.max(...ys)]
  const [x0, y0, w, h] = [40, top(c.title), 260, 150]
  const sx = (v: number) => x0 + 10 + ((v - xa) / (xb - xa || 1)) * (w - 20)
  const sy = (v: number) => y0 + h - 10 - ((v - ya) / (yb - ya || 1)) * (h - 20)
  const mid = c.quadrant
    ? `<line x1="${x0 + w / 2}" y1="${y0}" x2="${x0 + w / 2}" y2="${y0 + h}" stroke="${INK}" opacity=".25"/><line x1="${x0}" y1="${y0 + h / 2}" x2="${x0 + w}" y2="${y0 + h / 2}" stroke="${INK}" opacity=".25"/>`
    : ''
  const dots = c.points
    .map(p => {
      const cx = sx(p.x)
      const cy = sy(p.y)
      const left = cx > x0 + w * 0.65
      const lx = left ? cx - 10 : cx + 10
      return `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="6" fill="${SERIES[0]}">${tip(p.label + ': ' + fmtNum(p.x) + ', ' + fmtNum(p.y))}</circle>${label(lx, cy + 4, p.label, endAnchor(left))}`
    })
    .join('')
  const rotate = ' text-anchor="middle" transform="rotate(-90 12 ' + r1(y0 + h / 2) + ')"'
  const xAxis = label(x0 + w / 2, y0 + h + 18, c.x + ' →', ' text-anchor="middle"')
  const yAxis = label(12, y0 + h / 2, c.y + ' →', rotate)
  const axes = `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" stroke="${INK}" opacity=".5"/>${xAxis}${yAxis}`
  return svg(x0 + w + 10, y0 + h + 26, `${axes}${mid}${dots}`, c.title)
}

const pie = (c: Extract<Component, { type: 'pie' }>) => {
  const rows = Object.entries(c.values)
  const total = rows.reduce((a, [, v]) => a + v, 0) || 1
  const [cx, cy, r, ri] = [80, top(c.title) + 74, 70, 42]
  let a = -Math.PI / 2
  const pt = (ang: number, rad: number) => `${r1(cx + rad * Math.cos(ang))} ${r1(cy + rad * Math.sin(ang))}`
  const slices = rows
    .map(([k, v], i) => {
      const b = a + (v / total) * Math.PI * 2
      const big = b - a > Math.PI ? 1 : 0
      const d = v >= total ? `M${pt(0, r)} A${r} ${r} 0 1 1 ${pt(Math.PI - 0.0001, r)} A${r} ${r} 0 1 1 ${pt(0, r)} Z` : `M${pt(a, r)} A${r} ${r} 0 ${big} 1 ${pt(b, r)} L${pt(b, ri)} A${ri} ${ri} 0 ${big} 0 ${pt(a, ri)} Z`
      a = b
      const color = SERIES[i % SERIES.length]
      const pct = Math.round((v / total) * 100)
      const share = pct + '%'
      return `<path d="${d}" fill="${color}" stroke="none">${tip(k + ': ' + fmtNum(v) + ' (' + share + ')')}</path><rect x="170" y="${top(c.title) + 14 + i * 22}" width="10" height="10" rx="2" fill="${color}"/>${label(186, top(c.title) + 23 + i * 22, k + ' ' + share)}`
    })
    .join('')
  return svg(330, top(c.title) + 152, slices, c.title)
}

const NODE_W = 100
const NODE_H = 30
const GAP_X = 44
const GAP_Y = 22

/** Columns by longest path from a source; cycles fall back to the order given. */
export const layers = (ids: string[], edges: { from: string; to: string }[]): Map<string, number> => {
  const depth = new Map(ids.map(id => [id, 0]))
  for (const _ of ids) {
    let moved = false
    for (const e of edges) {
      const d = (depth.get(e.from) ?? 0) + 1
      if (e.from !== e.to && d > (depth.get(e.to) ?? 0) && d < ids.length) {
        depth.set(e.to, d)
        moved = true
      }
    }
    if (!moved) break
  }
  return depth
}

const graph = (c: Extract<Component, { type: 'graph' }>) => {
  const depth = layers(
    c.nodes.map(n => n.id),
    c.edges,
  )
  const rows = new Map<number, number>()
  const pos = new Map<string, { x: number; y: number; col: number }>()
  const y0 = top(c.title) + 4
  for (const n of c.nodes) {
    const col = depth.get(n.id) ?? 0
    const row = rows.get(col) ?? 0
    rows.set(col, row + 1)
    pos.set(n.id, { x: col * (NODE_W + GAP_X), y: y0 + row * (NODE_H + GAP_Y), col })
  }
  const lines = c.edges
    .map(e => {
      const a = pos.get(e.from) ?? { x: 0, y: 0, col: 0 }
      const b = pos.get(e.to) ?? { x: 0, y: 0, col: 0 }
      const span = b.col - a.col
      let d: string
      let mid: { x: number; y: number }
      if (span <= 0) {
        // Back or same-column edge: out of the bottom, into the bottom, looping under.
        const [x1, y1, x2, y2] = [a.x + NODE_W / 2, a.y + NODE_H, b.x + NODE_W / 2, b.y + NODE_H]
        const dip = Math.max(y1, y2) + GAP_Y
        d = `M${x1} ${y1} C${x1} ${dip} ${x2} ${dip} ${x2} ${y2 + 2}`
        mid = { x: (x1 + x2) / 2, y: dip - 2 }
      } else {
        // Forward: right side to left side; an edge that skips a column bends below the row it passes.
        const [x1, y1, x2, y2] = [a.x + NODE_W, a.y + NODE_H / 2, b.x - 2, b.y + NODE_H / 2]
        const off = span > 1 ? NODE_H / 2 + GAP_Y / 2 : 0
        const k = GAP_X * 0.8
        d = span > 1 ? `M${x1} ${y1} C${x1 + k} ${y1 + off} ${x1 + k} ${y1 + off} ${x1 + GAP_X} ${y1 + off} L${x2 - GAP_X} ${y2 + off} C${x2 - k} ${y2 + off} ${x2 - k} ${y2} ${x2} ${y2}` : `M${x1} ${y1} C${x1 + k} ${y1} ${x2 - k} ${y2} ${x2} ${y2}`
        mid = span > 1 ? { x: (x1 + x2) / 2, y: (y1 + y2) / 2 + off - 4 } : { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 5 }
      }
      const lab = e.label ? label(mid.x, mid.y, e.label, ' text-anchor="middle" font-size="10"') : ''
      return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.5" marker-end="url(#pt-arrow)"/>${lab}`
    })
    .join('')
  const boxes = c.nodes
    .map(n => {
      const p = pos.get(n.id) ?? { x: 0, y: 0 }
      const text = n.label.length > 14 ? `${n.label.slice(0, 13)}…` : n.label
      return `<rect x="${p.x}" y="${p.y}" width="${NODE_W}" height="${NODE_H}" rx="6" fill="none" stroke="${SERIES[0]}" stroke-width="1.5"><title>${esc(n.label)}</title></rect><text x="${p.x + NODE_W / 2}" y="${p.y + 19}" font-size="12" text-anchor="middle" fill="${INK}">${esc(text)}</text>`
    })
    .join('')
  const cols = Math.max(...depth.values()) + 1
  const maxRows = Math.max(...rows.values())
  const defs = `<defs><marker id="pt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${INK}"/></marker></defs>`
  return svg(cols * (NODE_W + GAP_X) - GAP_X + 2, y0 + maxRows * (NODE_H + GAP_Y) + GAP_Y, `${defs}${lines}${boxes}`, c.title)
}

const flow = (c: Extract<Component, { type: 'flow' }>) =>
  graph({
    type: 'graph',
    title: c.title,
    nodes: c.lanes.flatMap((l, li) => l.map((s, i) => ({ id: `${li}:${i}`, label: s }))),
    edges: c.lanes.flatMap((l, li) => l.slice(1).map((_, i) => ({ from: `${li}:${i}`, to: `${li}:${i + 1}` }))),
  })

const map = (c: Extract<Component, { type: 'map' }>) => {
  const [w, h, m] = [340, 200, 24]
  const y0 = top(c.title)
  const geo = c.stops.every(s => s.lat !== undefined && s.lon !== undefined)
  const lats = c.stops.map(s => s.lat ?? 0)
  const lons = c.stops.map(s => s.lon ?? 0)
  const [la, lb, oa, ob] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)]
  // Equirectangular with the longitude squeezed by cos(latitude), one scale on both axes, centred.
  const kx = Math.cos((((la + lb) / 2) * Math.PI) / 180)
  const spanX = (ob - oa) * kx || 1
  const spanY = lb - la || 1
  const scale = Math.min((w - 2 * m - 60) / spanX, (h - 2 * m - 14) / spanY)
  const ox = (w - spanX * scale) / 2
  const oy = y0 + m + (h - 2 * m - 14 - spanY * scale) / 2
  const at = (i: number) => {
    if (!geo) return { x: m + (i / Math.max(1, c.stops.length - 1)) * (w - 2 * m), y: y0 + h / 2 + (i % 2 ? 30 : -30) }
    return { x: ox + ((lons[i] ?? 0) - oa) * kx * scale, y: oy + (lb - (lats[i] ?? 0)) * scale }
  }
  const pts = c.stops.map((_, i) => at(i))
  const routeD = pts.map((p, i) => (i ? 'L' : 'M') + r1(p.x) + ' ' + r1(p.y)).join(' ')
  const route = pts.length > 1 ? `<path d="${routeD}" fill="none" stroke="${SERIES[0]}" stroke-width="2" stroke-dasharray="5 4"/>` : ''
  const dots = c.stops
    .map((s, i) => {
      const p = pts[i] ?? { x: 0, y: 0 }
      const left = p.x > w * 0.7
      const lx = left ? p.x - 13 : p.x + 13
      const note = s.note ? s.label + ': ' + s.note : s.label
      return `<circle cx="${r1(p.x)}" cy="${r1(p.y)}" r="9" fill="${SERIES[1]}">${tip(note)}</circle><text x="${r1(p.x)}" y="${r1(p.y + 4)}" font-size="10" font-weight="700" text-anchor="middle" fill="#ffffff">${i + 1}</text>${label(lx, p.y + 4, s.label, endAnchor(left))}`
    })
    .join('')
  const frame = `<rect x="0" y="${y0}" width="${w}" height="${h}" rx="8" fill="none" stroke="${INK}" opacity=".35"/>${label(w - 6, y0 + h - 6, geo ? 'schematic, not to scale' : 'schematic: no coordinates', ' text-anchor="end" opacity=".7"')}`
  return svg(w, y0 + h + 2, `${frame}${route}${dots}`, c.title)
}

/** The component as SVG, or undefined when it reads better as text (tree, card, table, stat) or is a control. */
export const svgFor = (c: Component): string | undefined => {
  let out: string | undefined
  if (c.type === 'bars') out = bars(c)
  else if (c.type === 'line') out = line(c)
  else if (c.type === 'scatter') out = scatter(c)
  else if (c.type === 'pie') out = pie(c)
  else if (c.type === 'graph') out = graph(c)
  else if (c.type === 'flow') out = flow(c)
  else if (c.type === 'map') out = map(c)
  return out && out.length <= MAX_SVG ? out : undefined
}
