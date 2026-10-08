// Pure logic for the crew pane and chip: no engine calls, so it is unit-testable.
import type { CrewRun } from '../types'

export type Member = { name: string; label: string; color: string; glyph: string }

export const CREW: Record<string, Member> = {
  scout: { name: 'scout', label: 'Scout', color: '#e0713b', glyph: '»' },
  engineer: { name: 'engineer', label: 'Engineer', color: '#d9a21b', glyph: '⚙' },
  spy: { name: 'spy', label: 'Spy', color: '#8a5fd0', glyph: '◐' },
  sniper: { name: 'sniper', label: 'Sniper', color: '#3f9d6a', glyph: '⌖' },
}

const OTHER: Member = { name: 'agent', label: 'Agent', color: '#7a8594', glyph: '●' }

/** `who-wants-the-job:scout`, `Scout` and `scout` are the same member; anything else is a plain agent. */
export const memberOf = (type: string): Member => CREW[type.split(':').pop()?.trim().toLowerCase() ?? ''] ?? OTHER

// Rough $ per million tokens (input, output). An estimate, not a bill.
const PRICES: [RegExp, number, number][] = [
  [/haiku/i, 1, 5],
  [/sonnet/i, 3, 15],
  [/opus|fable/i, 5, 25],
]

export type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

export const tokensOf = (u: Usage): number =>
  (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)

/** Context in use after a request: everything the request carried plus the reply. */
export const ctxOf = tokensOf

export const costOf = (model: string, u: Usage): number => {
  const [, inp, out] = PRICES.find(([re]) => re.test(model)) ?? [0, 3, 15]
  const perTok = (n: number | undefined, price: number): number => ((n ?? 0) * price) / 1e6
  return (
    perTok(u.input_tokens, inp) +
    perTok(u.output_tokens, out) +
    perTok(u.cache_read_input_tokens, inp * 0.1) +
    perTok(u.cache_creation_input_tokens, inp * 1.25)
  )
}

export const windowOf = (model: string): number => (/1m/i.test(model) ? 1_000_000 : 200_000)

export const fmtTokens = (n: number): string => (n < 1000 ? String(n) : n < 10_000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n / 1000)}k`)

export const fmtCost = (usd: number): string => (usd < 0.01 ? '<$0.01' : `$${usd.toFixed(2)}`)

export const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}

export const shortModel = (model: string): string => model.match(/haiku|sonnet|opus|fable/i)?.[0].toLowerCase() ?? (model || '?')

export const elapsed = (r: CrewRun, at: number): number => Math.max(0, (r.endedAt ?? at) - r.startedAt)

export const ctxPct = (r: CrewRun): number => (r.ctxMax ? Math.min(100, Math.round((r.ctxTokens / r.ctxMax) * 100)) : 0)

export const totals = (runs: readonly CrewRun[], at: number) => ({
  running: runs.filter(r => r.status === 'running').length,
  count: runs.length,
  tokens: runs.reduce((s, r) => s + r.tokens, 0),
  cost: runs.reduce((s, r) => s + r.costUsd, 0),
  time: runs.reduce((m, r) => Math.max(m, elapsed(r, at)), 0),
})

export const bar = (frac: number, width: number): string => {
  const filled = Math.round(Math.max(0, Math.min(1, frac)) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const MARK = { running: '●', done: '✓', failed: '✗' } as const

/** One run as a line of text: status, member, model, steps (or context), cost, time. */
export const rowText = (r: CrewRun, at: number): string => {
  const m = memberOf(r.type)
  const prog = r.stepTotal ? `${bar((r.stepDone ?? 0) / r.stepTotal, 6)} ${r.stepDone ?? 0}/${r.stepTotal}` : `ctx ${ctxPct(r)}%`
  const note = r.stepNote ? ` · ${r.stepNote}` : ''
  return `${MARK[r.status]} ${m.label} · ${shortModel(r.model)} · ${prog} · ${fmtCost(r.costUsd)} · ${fmtTime(elapsed(r, at))}${note}`
}

/** The chip above the prompt. */
export const chipText = (runs: readonly CrewRun[], at: number): string => {
  const t = totals(runs, at)
  return t.running ? `♟ crew ${t.running}/${t.count} running · ≈${fmtCost(t.cost)}` : `♟ crew ${t.count} done · ≈${fmtCost(t.cost)}`
}

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const CELL = 72
const SCALE = 2.2
const CLAY = '#D97757'
const INK = '#1F1E1D'

// A pixel crab on a 30x28 grid, in the Claude mascot's clay colour; the costume says which agent it is.
// `cls` puts a pixel in a named group: `bd` (default) is the body and costume, `la`/`lb` the two leg pairs,
// anything else a prop with its own motion.
type Fill = (x: number, y: number, w: number, h: number, c: string, cls?: string) => void

const body = (f: Fill, raised = false): void => {
  f(7, 10, 16, 12, CLAY)
  f(3, 14, 4, 4, CLAY)
  f(23, raised ? 10 : 14, 4, 4, CLAY)
  f(9, 12, 2, 2, INK)
  f(19, 12, 2, 2, INK)
  f(7, 22, 2, 4, CLAY, 'la')
  f(17, 22, 2, 4, CLAY, 'la')
  f(11, 22, 2, 4, CLAY, 'lb')
  f(21, 22, 2, 4, CLAY, 'lb')
}

const COSTUMES: Record<string, (f: Fill) => void> = {
  // Scout: red cap, swings a bat from the raised claw.
  scout: f => {
    body(f, true)
    f(10, 6, 10, 4, '#C0392B'); f(10, 9, 14, 1, '#8E2A20'); f(14, 7, 2, 1, '#E8E4DC')
    f(24, 2, 2, 12, '#CDA66B', 'it'); f(24, 2, 2, 2, '#A9854F', 'it')
  },
  // Engineer: yellow hard hat, turns a wrench.
  engineer: f => {
    body(f, true)
    f(9, 5, 12, 4, '#F2C230'); f(8, 9, 14, 1, '#C99A1E'); f(14, 5, 2, 4, '#FBE08A')
    f(24, 8, 2, 6, '#9AA4B0', 'it'); f(23, 5, 1, 4, '#9AA4B0', 'it'); f(26, 5, 1, 4, '#9AA4B0', 'it'); f(23, 8, 4, 1, '#9AA4B0', 'it')
  },
  // Spy: fedora and a mask; the eyes glance side to side.
  spy: f => {
    body(f)
    f(8, 11, 14, 4, '#1C1C24')
    f(9, 12, 2, 2, '#fff', 'pk'); f(19, 12, 2, 2, '#fff', 'pk')
    f(11, 5, 8, 4, '#2B2B36'); f(11, 8, 8, 1, '#8A5FD0'); f(7, 9, 16, 1, '#2B2B36')
  },
  // Sniper: slouch hat, rifle across both claws with a glinting muzzle.
  sniper: f => {
    body(f)
    f(11, 6, 8, 3, '#8A6A3C'); f(6, 9, 18, 1, '#6F5430')
    f(4, 15, 23, 2, '#4A4A4A'); f(13, 13, 5, 2, '#333333'); f(27, 15, 2, 2, '#F5C542', 'gl')
  },
}

const CRAB_CSS =
  '.run .la{animation:st .5s steps(1) infinite}.run .lb{animation:st .5s steps(1) infinite -.25s}.run .bd{animation:bob .5s steps(1) infinite -.125s}' +
  '.run g{transform-box:fill-box}.run .it{animation:swing .8s ease-in-out infinite;transform-origin:50% 100%}.c-engineer.run .it{animation:turn 1.2s linear infinite;transform-origin:50% 75%}' +
  '.run .pk{animation:peek 1.6s steps(1) infinite}.run .gl{animation:glint 1.4s steps(1) infinite}.run .live{animation:glint 1s steps(1) infinite}' +
  '@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}@keyframes swing{50%{transform:rotate(40deg)}}' +
  '@keyframes turn{to{transform:rotate(360deg)}}@keyframes peek{25%{transform:translateX(1px)}75%{transform:translateX(-1px)}}@keyframes glint{50%{opacity:.15}}' +
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'

const crab = (name: string, dim: boolean, running: boolean): string => {
  const groups = new Map<string, string[]>([['bd', []]])
  const f: Fill = (x, y, w, h, c, cls = 'bd') => {
    if (!groups.has(cls)) groups.set(cls, [])
    groups.get(cls)?.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`)
  }
  ;(COSTUMES[name] ?? ((g: Fill) => body(g)))(f)
  const group = (cls: string): string => `<g class="${cls}">${(groups.get(cls) ?? []).join('')}</g>`
  const props = [...groups.keys()].filter(k => !['bd', 'la', 'lb'].includes(k))
  const main = `<g class="bd">${(groups.get('bd') ?? []).join('')}${props.map(group).join('')}</g>`
  return `<g class="c-${name}${running ? ' run' : ''}" opacity="${dim ? 0.5 : 1}" shape-rendering="crispEdges" transform="translate(${(CELL - 30 * SCALE) / 2} 4) scale(${SCALE})">${main}${group('la')}${group('lb')}</g>`
}

const character = (r: CrewRun, i: number): string => {
  const m = memberOf(r.type)
  const running = r.status === 'running'
  const badge = r.status === 'failed' ? `<text x="60" y="12" font-size="14" fill="#d04b4b">✗</text>` : r.status === 'done' ? `<text x="60" y="12" font-size="14" fill="#3f9d6a">✓</text>` : `<circle class="live" cx="64" cy="8" r="3" fill="${m.color}"/>`
  return `<g transform="translate(${i * CELL} 0)">${crab(m.name, !running, running)}<text x="${CELL / 2}" y="76" font-size="10" text-anchor="middle" fill="currentColor">${esc(m.label)}</text>${badge}</g>`
}

/** The crew as an animated SVG scene: one crab per run, at most `max`. */
export const sceneSvg = (runs: readonly CrewRun[], max = 8): string => {
  const shown = runs.slice(-max)
  const w = Math.max(1, shown.length) * CELL
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 82" width="${w}" height="82" font-family="system-ui,sans-serif" color="#8b95a3"><style>${CRAB_CSS}</style>${shown.map(character).join('')}</svg>`
}

/** The crew in text for surfaces without SVG: one glyph per run. */
export const sceneText = (runs: readonly CrewRun[], max = 12): string =>
  runs
    .slice(-max)
    .map(r => `${memberOf(r.type).glyph}${r.status === 'running' ? '●' : r.status === 'done' ? '✓' : '✗'}`)
    .join('  ')
