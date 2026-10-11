import type { Option, TreeNode, Viz } from '../types'

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

/** Lines with a key that stays unique when a line repeats; for React keys without using an array index. */
export const keyedLines = (lines: string[]): { key: string; line: string }[] => {
  const seen = new Map<string, number>()
  return lines.map(line => {
    const n = (seen.get(line) ?? 0) + 1
    seen.set(line, n)
    return { key: `${line}#${n}`, line }
  })
}
