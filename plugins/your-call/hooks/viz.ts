import type { Option, TreeNode, Viz } from '../types'

export type Segment = { kind: 'text'; text: string } | { kind: 'viz'; viz: Viz } | { kind: 'pending' }

const FENCE = /```viz[ \t]*\n([\s\S]*?)```/g
const BAR = 10
const W = 21
const H = 9

const labelOf = (opts: Option[], id: string) => opts.find(o => o.id === id)?.label ?? id

const pointLabel = (opts: Option[], p: { id?: string; label?: string }) => p.label ?? labelOf(opts, p.id ?? '?')

const treeLines = (nodes: TreeNode[], prefix = ''): string[] =>
  nodes.flatMap((n, i) => {
    const last = i === nodes.length - 1
    return [`${prefix}${last ? '└─ ' : '├─ '}${n.label}`, ...treeLines(n.children ?? [], prefix + (last ? '   ' : '│  '))]
  })

export const splitViz = (text: string): Segment[] => {
  const out: Segment[] = []
  let at = 0
  for (const m of text.matchAll(FENCE)) {
    const i = m.index ?? 0
    if (i > at) out.push({ kind: 'text', text: text.slice(at, i) })
    try {
      out.push({ kind: 'viz', viz: JSON.parse(m[1]) as Viz })
    } catch {
      out.push({ kind: 'text', text: m[0] })
    }
    at = i + m[0].length
  }
  const rest = text.slice(at)
  const open = rest.search(/```viz[ \t]*\n?/)
  if (open >= 0) {
    if (open > 0) out.push({ kind: 'text', text: rest.slice(0, open) })
    out.push({ kind: 'pending' })
  } else if (rest) out.push({ kind: 'text', text: rest })
  return out
}

/** Text chart. `opts` resolves option ids to labels; `picked` (your-call pane) marks chosen ids with `*`. */
export const textLines = (v: Viz, opts: Option[] = [], picked?: string[]): string[] => {
  const head = v.title ? [v.title] : []
  const mark = (id: string): string => {
    if (picked === undefined) return ''
    return picked.includes(id) ? '* ' : '  '
  }

  if (v.type === 'bars') {
    const max = v.max ?? Math.max(1, ...Object.values(v.values))
    const w = Math.max(...Object.keys(v.values).map(k => labelOf(opts, k).length))
    return [
      ...head,
      ...Object.entries(v.values).map(([k, n]) => {
        const f = Math.max(0, Math.min(BAR, Math.round((n / max) * BAR)))
        return `${mark(k)}${labelOf(opts, k).padEnd(w)} ${'█'.repeat(f)}${'░'.repeat(BAR - f)} ${n}`
      }),
    ]
  }

  if (v.type === 'quadrant') {
    const grid = Array.from({ length: H }, () => new Array<string>(W).fill(' '))
    v.points.forEach((p, i) => {
      const c = Math.max(0, Math.min(W - 1, Math.round((p.x / 10) * (W - 1))))
      const r = H - 1 - Math.max(0, Math.min(H - 1, Math.round((p.y / 10) * (H - 1))))
      grid[r][c] = String.fromCodePoint(65 + i)
    })
    return [
      ...head,
      `${v.y} ↑`,
      ...grid.map(row => `│${row.join('')}`),
      `└${'─'.repeat(W)}→ ${v.x}`,
      v.points
        .map((p, i) => `${String.fromCodePoint(65 + i)}=${pointLabel(opts, p)}${picked?.includes(p.id ?? '') ? '*' : ''}`)
        .join('  '),
    ]
  }

  if (v.type === 'tree') return [...head, ...treeLines(v.nodes)]

  return [...head, ...v.lanes.map(l => l.join(' ──▶ '))]
}

const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** SVG for bars and quadrant; undefined for types that stay text. */
export const svgFor = (v: Viz, opts: Option[] = []): string | undefined => {
  const ink = '#7d7d7d'
  const font = 'font-family="system-ui,-apple-system,Segoe UI,sans-serif"'

  if (v.type === 'bars') {
    const rows = Object.entries(v.values)
    const max = v.max ?? Math.max(1, ...rows.map(r => r[1]))
    const body = rows
      .map(([k, n], i) => {
        const y = 28 + i * 26
        const w = Math.max(2, Math.round((n / max) * 180))
        return `<text x="0" y="${y + 12}" font-size="12" fill="${ink}">${esc(labelOf(opts, k))}</text><rect x="110" y="${y}" width="${w}" height="16" rx="4" fill="#4a90d9"/><text x="${116 + w}" y="${y + 12}" font-size="12" fill="${ink}">${n}</text>`
      })
      .join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" ${font} viewBox="0 0 340 ${40 + rows.length * 26}"><text x="0" y="14" font-size="13" font-weight="600" fill="${ink}">${esc(v.title ?? '')}</text>${body}</svg>`
  }

  if (v.type === 'quadrant') {
    const dots = v.points
      .map(p => {
        const cx = 40 + (p.x / 10) * 240
        const cy = 150 - (p.y / 10) * 130
        const left = cx > 200
        return `<circle cx="${cx}" cy="${cy}" r="7" fill="#4a90d9"/><text x="${left ? cx - 11 : cx + 11}" y="${cy + 4}" ${left ? 'text-anchor="end" ' : ''}font-size="12" fill="${ink}">${esc(pointLabel(opts, p))}</text>`
      })
      .join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" ${font} viewBox="0 0 320 190"><text x="0" y="12" font-size="13" font-weight="600" fill="${ink}">${esc(v.title ?? '')}</text><rect x="40" y="20" width="240" height="130" fill="none" stroke="${ink}" opacity=".5"/><line x1="160" y1="20" x2="160" y2="150" stroke="${ink}" opacity=".25"/><line x1="40" y1="85" x2="280" y2="85" stroke="${ink}" opacity=".25"/>${dots}<text x="160" y="176" font-size="11" text-anchor="middle" fill="${ink}">${esc(v.x)} →</text><text x="10" y="85" font-size="11" text-anchor="middle" fill="${ink}" transform="rotate(-90 10 85)">${esc(v.y)} →</text></svg>`
  }

  return undefined
}

/** Identifies an answer's text for matching a summary chart to its message; the same function is in too-long-didnt-read. */
export const answerKey = (text: string): string => {
  const t = text.trim()
  return `${t.length}:${t.slice(0, 60)}`
}

/** Lines with a key that stays unique when a line repeats; for React keys without using an array index. */
export const keyedLines = (lines: string[]): { key: string; line: string }[] => {
  const seen = new Map<string, number>()
  return lines.map(line => {
    const n = (seen.get(line) ?? 0) + 1
    seen.set(line, n)
    return { key: `${line}#${n}`, line }
  })
}
