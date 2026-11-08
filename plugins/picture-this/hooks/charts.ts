// Everything that is not node-and-link: bars, scatter, radar for tradeoffs; sequence, swimlane, timeline for order;
// matrix, sankey, treemap for size and volume.
import type { Component, Span } from '../types'

import { columns, fmtNum } from './layout'
import { END, MID, SERIES, esc, r1, svg, text, textW, tip, top, wrap } from './paint'

type Of<T extends Component['type']> = Extract<Component, { type: T }>

export const bars = (c: Of<'bars'>) => {
  const rows = Object.entries(c.values)
  const max = c.max ?? Math.max(1, ...rows.map(r => r[1]))
  const lw = Math.min(160, 10 + Math.max(...rows.map(r => textW(r[0], 11))))
  const y0 = top(c.title)
  const body = rows
    .map(([k, n], i) => {
      const y = y0 + i * 26
      const w = Math.max(2, Math.round((n / max) * 220))
      const value = fmtNum(n) + (c.unit ? ' ' + c.unit : '')
      return `${text(0, y + 12, k)}<rect x="${r1(lw)}" y="${y}" width="${w}" height="16" rx="4" style="fill:${SERIES[0]}">${tip(k + ': ' + value)}</rect>${text(lw + w + 6, y + 12, value, '', 't')}`
    })
    .join('')
  return svg(lw + 300, y0 + rows.length * 26 + 4, body, c.title)
}

export const scatter = (c: Of<'scatter'>) => {
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
      return `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="6" style="fill:${SERIES[0]}">${tip(p.label + ': ' + fmtNum(p.x) + ', ' + fmtNum(p.y))}</circle>${text(left ? cx - 10 : cx + 10, cy + 4, p.label, left ? END : '', 't')}`
    })
    .join('')
  const axes = `<rect class="ln" x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none"/>${text(x0 + w / 2, y0 + h + 18, c.x + ' →', MID)}${text(12, y0 + h / 2, c.y + ' →', MID + ' transform="rotate(-90 12 ' + r1(y0 + h / 2) + ')"')}`
  return svg(x0 + w + 10, y0 + h + 26, `${axes}${mid}${dots}`, c.title)
}

export const radar = (c: Of<'radar'>) => {
  const n = c.axes.length
  const [R, y0] = [100, top(c.title) + 20]
  const [cx, cy] = [160, y0 + R + 10]
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    const r = (Math.max(0, Math.min(c.max, v)) / c.max) * R
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
  }
  const rings = [1 / 3, 2 / 3, 1].map(f => `<polygon class="gr" fill="none" points="${c.axes.map((_, i) => pt(i, f * c.max).map(r1).join(',')).join(' ')}"/>`).join('')
  const spokes = c.axes
    .map((a, i) => {
      const [x, y] = pt(i, c.max)
      const [lx, ly] = pt(i, c.max * 1.14)
      const anchor = Math.abs(lx - cx) < 8 ? MID : lx < cx ? END : ''
      return `<line class="gr" x1="${cx}" y1="${cy}" x2="${r1(x)}" y2="${r1(y)}"/>${text(lx, ly + 4, a, anchor)}`
    })
    .join('')
  const names = Object.keys(c.series)
  const shapes = names
    .map((k, s) => {
      const vs = c.series[k] ?? []
      const color = SERIES[s % SERIES.length]
      const pts = vs.map((v, i) => pt(i, v).map(r1).join(',')).join(' ')
      return `<polygon points="${pts}" style="fill:${color};fill-opacity:.14;stroke:${color}" stroke-width="2">${tip(k + ': ' + c.axes.map((a, i) => `${a} ${fmtNum(vs[i] ?? 0)}`).join(', '))}</polygon>`
    })
    .join('')
  const legend = names.map((k, s) => `<rect x="${330}" y="${y0 + s * 20}" width="10" height="10" rx="2" style="fill:${SERIES[s % SERIES.length]}"/>${text(346, y0 + 9 + s * 20, k, '', 't')}`).join('')
  return svg(330 + Math.max(...names.map(k => textW(k, 11))) + 24, cy + R + 30, rings + spokes + shapes + legend, c.title)
}

const NODE_H = 32

const head = (x: number, y: number, w: number, label: string) =>
  `<g class="n">${tip(label)}<rect class="nd" x="${r1(x)}" y="${y}" width="${r1(w)}" height="${NODE_H}" rx="7" stroke-width="1.5"/><text class="t" x="${r1(x + w / 2)}" y="${y + 20}" font-size="12"${MID}>${esc(label)}</text></g>`

/** Who calls whom, in order; `animate` replays the messages one by one (SMIL: no script), and the drawing is whole without it. */
export const sequence = (c: Of<'sequence'>) => {
  const colW = Math.max(110, Math.min(170, Math.max(...c.actors.map(a => textW(a) + 28)), Math.max(...c.steps.map(s => textW(s.label ?? '', 10) + 20))))
  const y0 = top(c.title) + 4
  const cx = (a: string) => colW / 2 + c.actors.indexOf(a) * colW
  const rowH = 30
  const first = y0 + NODE_H + 22
  const end = first + c.steps.length * rowH
  const heads = c.actors.map(a => `${head(cx(a) - colW / 2 + 8, y0, colW - 16, a)}<line class="lf" x1="${r1(cx(a))}" y1="${y0 + NODE_H}" x2="${r1(cx(a))}" y2="${end}" stroke-dasharray="4 4"/>`).join('')
  const BEAT = 0.9
  const total = c.steps.length * BEAT + 1.5
  const msgs = c.steps
    .map((s, i) => {
      const y = first + i * rowH
      const [x1, x2] = [cx(s.from), cx(s.to)]
      const n = `${i + 1}. ${s.label ?? ''}`.trim()
      const hover = tip(`${i + 1}. ${s.from} → ${s.to}${s.label ? ': ' + s.label : ''}`)
      let shape: string
      if (s.from === s.to) shape = `<path class="ln" d="M${r1(x1)} ${y - 6} h26 v12 h-24" fill="none" stroke-width="1.5" marker-end="url(#pt-a)">${hover}</path>${text(x1 + 32, y + 4, n)}`
      else {
        const back = x2 < x1
        shape = `<line class="ln" x1="${r1(x1)}" y1="${y}" x2="${r1(back ? x2 + 2 : x2 - 2)}" y2="${y}" stroke-width="1.5"${back ? ' stroke-dasharray="5 3"' : ''} marker-end="url(#pt-a)">${hover}</line>${text((x1 + x2) / 2, y - 5, n, MID, 'm', 10)}`
      }
      if (!c.animate) return shape
      // Hidden until its beat, then fades in with a dot travelling the line; a click on ↻ replays.
      const at = r1(i * BEAT)
      const k = `0;${r1((i * BEAT) / total)};${r1((i * BEAT + 0.3) / total)};1`
      const fade = `<animate attributeName="opacity" values="0;0;1;1" keyTimes="${k}" dur="${r1(total)}s" begin="0s;replay.click" fill="freeze"/>`
      const dot = s.from === s.to ? '' : `<circle r="4" style="fill:${SERIES[0]}" opacity="0"><animate attributeName="cx" from="${r1(x1)}" to="${r1(x2)}" begin="${at}s;replay.click+${at}s" dur="${BEAT * 0.8}s"/><animate attributeName="opacity" values="1;1;0" begin="${at}s;replay.click+${at}s" dur="${BEAT * 0.8}s"/><set attributeName="cy" to="${y}"/></circle>`
      return `<g>${fade}${shape}${dot}</g>`
    })
    .join('')
  const replay = c.animate ? `<g id="replay" style="cursor:pointer">${text(c.actors.length * colW - 4, y0 - 6, '↻ replay', END, 'm', 11)}</g>` : ''
  return svg(c.actors.length * colW, end + 8, `${heads}${msgs}${replay}`, c.title)
}

/** Steps in order across, each in its owner's lane; consecutive steps joined. */
export const swimlane = (c: Of<'swimlane'>) => {
  const LANE_H = 52
  const lw = Math.min(120, 16 + Math.max(...c.lanes.map(l => textW(l, 11))))
  const stepW = Math.max(96, Math.min(150, 20 + Math.max(...c.steps.map(s => Math.max(...wrap(s.label, 16).map(x => textW(x, 11)))))))
  const y0 = top(c.title) + 4
  const W = lw + c.steps.length * (stepW + 18) + 8
  const bands = c.lanes.map((l, i) => `${i % 2 ? '' : `<rect class="bg" x="0" y="${y0 + i * LANE_H}" width="${r1(W)}" height="${LANE_H}"/>`}${text(8, y0 + i * LANE_H + LANE_H / 2 + 4, l, ' font-weight="600"', 't')}`).join('')
  const box = (i: number) => {
    const s = c.steps[i] ?? { lane: '', label: '' }
    return { x: lw + i * (stepW + 18), y: y0 + c.lanes.indexOf(s.lane) * LANE_H + 9, w: stepW, h: LANE_H - 18 }
  }
  const links = c.steps
    .slice(1)
    .map((_, i) => {
      const [a, b] = [box(i), box(i + 1)]
      const [x1, y1, x2, y2] = [a.x + a.w, a.y + a.h / 2, b.x - 2, b.y + b.h / 2]
      return `<path class="ln" d="M${r1(x1)} ${r1(y1)} C${r1(x1 + 12)} ${r1(y1)} ${r1(x2 - 12)} ${r1(y2)} ${r1(x2)} ${r1(y2)}" fill="none" stroke-width="1.5" marker-end="url(#pt-a)"/>`
    })
    .join('')
  const steps = c.steps
    .map((s, i) => {
      const b = box(i)
      const ls = wrap(`${i + 1}. ${s.label}`, 16)
      const ty = b.y + b.h / 2 + 4 - (ls.length - 1) * 6
      return `<g class="n">${tip(`${i + 1}. ${s.label} (${s.lane})`)}<rect class="nd" x="${r1(b.x)}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" stroke-width="1.5"/>${ls.map((l, j) => text(b.x + b.w / 2, ty + j * 12, l, MID, 't', 11)).join('')}</g>`
    })
    .join('')
  return svg(W, y0 + c.lanes.length * LANE_H + 4, bands + links + steps, c.title)
}

const two = (n: number) => String(n).padStart(2, '0')
/** A time on the timeline's own clock: seconds of the day as HH:MM, ms as a date, else a number. */
export const tickLabel = (v: number, clock: Of<'timeline'>['clock'], unit?: string): string => {
  if (clock === 'time') return `${two(Math.floor(v / 3600) % 24)}:${two(Math.floor(v / 60) % 60)}`
  if (clock === 'date') {
    const d = new Date(v)
    return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`
  }
  return fmtNum(v) + (unit ? ' ' + unit : '')
}

/** Spans as bars and moments as diamonds on one axis; rows grouped by lane when given. */
export const timeline = (c: Of<'timeline'>) => {
  const lo = Math.min(...c.items.map(i => i.start))
  const hi = Math.max(...c.items.map(i => i.end ?? i.start))
  const lw = Math.min(170, 14 + Math.max(...c.items.map(i => textW(i.label, 11))))
  const [y0, W, rowH] = [top(c.title) + 20, 380, 24]
  const sx = (v: number) => lw + ((v - lo) / (hi - lo || 1)) * W
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const v = lo + f * (hi - lo)
    return `<line class="gr" x1="${r1(sx(v))}" y1="${y0 - 6}" x2="${r1(sx(v))}" y2="${y0 + c.items.length * rowH}"/>${text(sx(v), y0 - 10, tickLabel(v, c.clock, c.unit), MID, 'm', 10)}`
  })
  const rows = c.items
    .map((it: Span, i) => {
      const y = y0 + i * rowH
      const color = it.hot ? SERIES[0] : SERIES[1]
      const when = tickLabel(it.start, c.clock, c.unit) + (it.end === undefined ? '' : ' → ' + tickLabel(it.end, c.clock, c.unit))
      const label = text(lw - 8, y + 15, it.label, END, it.hot ? 't' : 'm')
      if (it.end === undefined) {
        const [x, m] = [sx(it.start), y + 11]
        return `${label}<path d="M${r1(x)} ${m - 7} L${r1(x + 7)} ${m} L${r1(x)} ${m + 7} L${r1(x - 7)} ${m} Z" style="fill:${color}">${tip(it.label + ': ' + when)}</path>`
      }
      return `${label}<rect x="${r1(sx(it.start))}" y="${y + 4}" width="${r1(Math.max(3, sx(it.end) - sx(it.start)))}" height="15" rx="4" style="fill:${color}">${tip(it.label + ': ' + when)}</rect>`
    })
    .join('')
  return svg(lw + W + 30, y0 + c.items.length * rowH + 6, ticks.join('') + rows, c.title)
}

/** Rows by columns, each cell shaded by its value: dependency strength, coupling, overlap. */
export const matrix = (c: Of<'matrix'>) => {
  const max = c.max ?? Math.max(1, ...c.values.flat())
  const lw = Math.min(150, 14 + Math.max(...c.rows.map(r => textW(r, 11))))
  const ch = Math.min(110, 10 + Math.max(...c.cols.map(k => textW(k, 11) * 0.72)))
  const cell = 30
  const y0 = top(c.title) + ch
  const heads = c.cols.map((k, j) => text(lw + j * cell + cell / 2, y0 - 6, k, ` transform="rotate(-45 ${r1(lw + j * cell + cell / 2)} ${y0 - 6})"`)).join('')
  const body = c.rows
    .map((r, i) => {
      const y = y0 + i * cell
      const cells = c.cols
        .map((k, j) => {
          const v = c.values[i]?.[j] ?? 0
          const x = lw + j * cell
          const label = v ? text(x + cell / 2, y + cell / 2 + 4, fmtNum(v), MID, v / max > 0.55 ? 't' : 'm', 10) : ''
          return `<rect class="gr" x="${x}" y="${y}" width="${cell}" height="${cell}" style="fill:${SERIES[0]};fill-opacity:${r1((v / max) * 0.85)}">${tip(`${r} × ${k}: ${fmtNum(v)}`)}</rect>${label}`
        })
        .join('')
      return text(lw - 8, y + cell / 2 + 4, r, END, 't') + cells
    })
    .join('')
  return svg(lw + c.cols.length * cell + 30, y0 + c.rows.length * cell + 6, heads + body, c.title)
}

/** Volume through a flow: nodes in columns, each as tall as what passes it, bands as wide as the flow. */
export const sankey = (c: Of<'sankey'>) => {
  const ids = [...new Set(c.links.flatMap(l => [l.from, l.to]))]
  const edges = c.links.map(l => ({ from: l.from, to: l.to }))
  const cols = columns(ids, edges)
  const thru = (id: string) =>
    Math.max(
      c.links.filter(l => l.from === id).reduce((a, l) => a + l.value, 0),
      c.links.filter(l => l.to === id).reduce((a, l) => a + l.value, 0),
    )
  const [H, GAP, NW] = [240, 14, 12]
  const y0 = top(c.title) + 6
  const k = Math.min(...cols.map(col => (H - GAP * (col.length - 1)) / col.reduce((a, id) => a + thru(id), 0)))
  const lw = Math.max(...ids.map(id => textW(id, 11))) + 12
  const colX = (ci: number) => ci * (lw + 90)
  const pos = new Map<string, { x: number; y: number; h: number; ci: number; out: number; in: number }>()
  cols.forEach((col, ci) => {
    let y = y0
    for (const id of col) {
      pos.set(id, { x: colX(ci), y, h: Math.max(2, thru(id) * k), ci, out: 0, in: 0 })
      y += Math.max(2, thru(id) * k) + GAP
    }
  })
  const bands = [...c.links]
    .sort((a, b) => (pos.get(a.to)?.y ?? 0) - (pos.get(b.to)?.y ?? 0))
    .map(l => {
      const a = pos.get(l.from)
      const b = pos.get(l.to)
      if (!a || !b) return ''
      const w = l.value * k
      const [ya, yb] = [a.y + a.out + w / 2, b.y + b.in + w / 2]
      a.out += w
      b.in += w
      const [x1, x2] = [a.x + NW, b.x]
      const color = SERIES[a.ci % SERIES.length]
      return `<path d="M${r1(x1)} ${r1(ya)} C${r1((x1 + x2) / 2)} ${r1(ya)} ${r1((x1 + x2) / 2)} ${r1(yb)} ${r1(x2)} ${r1(yb)}" fill="none" style="stroke:${color};stroke-opacity:.32" stroke-width="${r1(Math.max(1, w))}">${tip(`${l.from} → ${l.to}: ${fmtNum(l.value)}${c.unit ? ' ' + c.unit : ''}`)}</path>`
    })
    .join('')
  const last = cols.length - 1
  const nodes = [...pos.entries()]
    .map(([id, p]) => {
      const label = text(p.x + NW + 6, p.y + p.h / 2 + 4, `${id} ${fmtNum(thru(id))}`, '', 't')
      return `<rect x="${r1(p.x)}" y="${r1(p.y)}" width="${NW}" height="${r1(p.h)}" rx="2" style="fill:${SERIES[p.ci % SERIES.length]}">${tip(`${id}: ${fmtNum(thru(id))}`)}</rect>${label}`
    })
    .join('')
  return svg(colX(last) + NW + lw + 30, y0 + H + 10, bands + nodes, c.title)
}

/** Files (or any path-keyed sizes) as boxes sized by value, grouped by their top folder; hot ones in the accent. */
export const treemap = (c: Of<'treemap'>) => {
  const groups = new Map<string, [string, number][]>()
  for (const [path, v] of Object.entries(c.values)) {
    const [head, ...rest] = path.split('/')
    const g = rest.length ? (head ?? path) : '.'
    groups.set(g, [...(groups.get(g) ?? []), [path, v]])
  }
  const total = [...groups.values()].flat().reduce((a, [, v]) => a + v, 0) || 1
  const [W, H, y0] = [520, 260, top(c.title) + 4]
  const hot = new Set(c.hot ?? [])
  let x = 0
  const body = [...groups.entries()]
    .sort((a, b) => b[1].reduce((s, [, v]) => s + v, 0) - a[1].reduce((s, [, v]) => s + v, 0))
    .map(([g, files]) => {
      const gv = files.reduce((s, [, v]) => s + v, 0)
      const gw = (gv / total) * W
      let y = y0 + 16
      const boxes = files
        .sort((a, b) => b[1] - a[1])
        .map(([path, v]) => {
          const h = (v / gv) * (H - 16)
          const name = path.split('/').pop() ?? path
          const fits = gw > textW(name, 10) + 8 && h > 15
          const fill = hot.has(path) ? SERIES[0] : SERIES[1]
          const r = `<rect class="gr" x="${r1(x + 1)}" y="${r1(y + 1)}" width="${r1(Math.max(1, gw - 2))}" height="${r1(Math.max(1, h - 2))}" rx="3" style="fill:${fill};fill-opacity:${hot.has(path) ? '.75' : '.22'}">${tip(`${path}: ${fmtNum(v)}${c.unit ? ' ' + c.unit : ''}`)}</rect>${fits ? text(x + 6, y + 14, name, '', 't', 10) : ''}`
          y += h
          return r
        })
        .join('')
      const label = gw > textW(g, 11) + 4 ? text(x + 2, y0 + 11, g, ' font-weight="600"', 't') : ''
      x += gw
      return label + boxes
    })
    .join('')
  return svg(W + 2, y0 + H + 6, body, c.title)
}
