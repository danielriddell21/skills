import { atom, read, update } from 'claude-code'
import type { Hook, Register } from 'claude-code'

import type { Snapshot } from '../types'

import { RANK, chipKey, injectChips, isEmpty } from './chips'

const PANE = 'whats-in-the-box'
const snapshot = atom({ plugin: 'whats-in-the-box', key: 'snapshot' } as const, null)
const pctAtom = atom({ plugin: 'whats-in-the-box', key: 'pct' } as const, 0)

const FOCUS =
  'keep the goal, decisions and why, exact error messages, file paths and line ranges touched, open TODOs, current branch and state; drop exploration, file dumps, command output already acted on, abandoned approaches'

export const showCompact = (percent: number, urgent: number): boolean => percent >= urgent

export type Step = [number, string]

// Toasts show three lines of 40 columns, so these stay short.
export const stepsFor = (notice: number, warn: number, urgent: number): Step[] =>
  [
    [urgent, `Context ${urgent}%: /compact or /clear now`],
    [warn, `Context ${warn}%: wrap up, consider /compact`],
    [notice, `Context ${notice}%: keep reads tight`],
  ].sort((a, b) => (b[0] as number) - (a[0] as number)) as Step[]

const STEPS = stepsFor(50, 70, 85)

/** Which warning (if any) fires at `pct`, given the highest already shown. */
export const nextWarning = (pct: number, warned: number, steps: Step[] = STEPS): { warned: number; text?: string } => {
  const lowest = steps.at(-1)?.[0] ?? 0
  const base = pct < lowest - 10 ? 0 : warned
  const hit = steps.find(([t]) => pct >= t)
  return hit && hit[0] > base ? { warned: hit[0], text: hit[1] } : { warned: base }
}

type Engine = Parameters<Hook<'session.start'>>[0]

type Breakdown = { categories: { name: string; tokens: number; kind?: string }[]; totalTokens: number; maxTokens: number; percentage: number }

export const toSnapshot = (b: Breakdown): Snapshot => ({
  rows: b.categories
    .filter(c => c.kind !== 'free')
    .map(c => ({ name: c.name, tokens: c.tokens }))
    .sort((a, z) => z.tokens - a.tokens),
  total: b.totalTokens,
  max: b.maxTokens,
  percent: b.percentage,
})

const PALETTE = ['cyan', 'magenta', 'yellow', 'green', 'blue', 'red', 'white']
const BAR_WIDTH = 36
const LEGEND_MAX = 4

export const fmtTokens = (n: number): string => {
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
}

const levelColor = (percent: number): string => {
  if (percent >= 85) return 'red'
  return percent >= 70 ? 'yellow' : 'cyan'
}

/** Cells per category for a bar `width` wide over `max` tokens; never more than `width` in total. */
export const barCells = (rows: { name: string; tokens: number }[], max: number, width: number): { name: string; cells: number }[] => {
  let left = width
  return rows
    .filter(r => r.tokens > 0 && max > 0)
    .map(r => {
      const cells = Math.min(left, Math.max(1, Math.round((r.tokens / max) * width)))
      left -= cells
      return { name: r.name, cells }
    })
    .filter(c => c.cells > 0)
}

const refresh = async ($: Engine) => {
  const { context } = await $.session.usage({ breakdown: 'summary' })
  const b = context.breakdown
  if (!b) return
  const snap = toSnapshot(b)
  await update($, snapshot, () => snap)
}

export const register: Register = (on, options) => {
  const num = (v: unknown, d: number) => (typeof v === 'number' && v > 0 && v <= 100 ? v : d)
  const steps = stepsFor(num(options.notice, 50), num(options.warn, 70), num(options.urgent, 85))
  let warned = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'whats-in-the-box', description: 'Show context breakdown in a pane' })
    return next(e)
  })

  on('command.run', { command: 'whats-in-the-box' }, async $ => {
    await refresh($)
    await $.ui.open({ id: PANE, title: 'Context' })
    return { text: 'Context pane opened.' }
  })

  on('session.measure', async ($, e, next) => {
    const pct = e.context.percent

    if (pct !== undefined) {
      $.ui.status(`■ ctx ${Math.round(pct)}%`)
      await update($, pctAtom, () => pct)
      const w = nextWarning(pct, warned, steps)
      warned = w.warned
      if (w.text) $.ui.toast(w.text)
    }

    if (e.changed.includes('context')) await refresh($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, snapshot)
    const p = await read($, pctAtom)
    const min = typeof options.minPercent === 'number' ? options.minPercent : 0
    const showBar = options.band !== false && !!s && s.percent >= min
    const compact = options.compactButton !== false && showCompact(p, steps[0][0])

    if (e.props.hasSurvey || (!showBar && !compact)) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const rest = await next(e)

    // The Compact chip joins the shared chip row (route, turn result) under the bar.
    const chip = (
      <Box key={chipKey(RANK.context, 'compact')}>
        <Text key="ctx-urgent" color="red" bold>■ context {Math.round(p)}% </Text>
        <Button key="compact" label="Compact" onPress={() => $.command.run({ command: 'compact', args: FOCUS })} />
      </Box>
    )
    let below: unknown = rest
    if (compact) {
      below = injectChips(rest, chip)
      if (!below && isEmpty(rest)) below = <Box key="chips" flexWrap="wrap">{chip}</Box>
      else if (!below)
        below = (
          <Box flexDirection="column">
            <Box key="chips" flexWrap="wrap">{chip}</Box>
            {rest}
          </Box>
        )
    }

    if (!showBar || !s) return below as never

    const cells = barCells(s.rows, s.max, BAR_WIDTH)
    const used = cells.reduce((n, c) => n + c.cells, 0)
    const color = (name: string) => PALETTE[Math.max(0, s.rows.findIndex(r => r.name === name)) % PALETTE.length]
    const shown = s.rows.slice(0, LEGEND_MAX)
    const hidden = s.rows.length - shown.length

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>■ ctx </Text>
          {cells.map(c => (
            <Text key={`b-${c.name}`} color={color(c.name)}>{'█'.repeat(c.cells)}</Text>
          ))}
          <Text dimColor>{'░'.repeat(Math.max(0, BAR_WIDTH - used))}</Text>
          <Text> {Math.round(s.percent)}% </Text>
          <Text dimColor>
            {fmtTokens(s.total)}/{fmtTokens(s.max)}{' '}
          </Text>
          <Button key="details" label="Details" onPress={() => $.ui.open({ id: PANE, title: 'Context' })} />
        </Box>
        <Box>
          {shown.map(r => (
            <Text key={`l-${r.name}`} color={color(r.name)}>
              ■ {r.name} {fmtTokens(r.tokens)}{'  '}
            </Text>
          ))}
          {hidden > 0 && <Text dimColor>+{hidden} more</Text>}
        </Box>
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const s = await read($, snapshot)

    if (!s) return <Text dimColor>No data yet. It fills in after the first reply.</Text>

    const nameW = Math.max(...s.rows.map(r => r.name.length), 4)
    const color = (name: string) => PALETTE[Math.max(0, s.rows.findIndex(r => r.name === name)) % PALETTE.length]
    const free = Math.max(0, s.max - s.total)

    return (
      <Box flexDirection="column">
        <Text bold color={levelColor(s.percent)}>
          ■ Context  {Math.round(s.percent)}%  {fmtTokens(s.total)}/{fmtTokens(s.max)}
        </Text>
        <Text dimColor>{'─'.repeat(40)}</Text>
        {s.rows.map(r => {
          const n = Math.max(r.tokens > 0 ? 1 : 0, Math.round((r.tokens / Math.max(1, s.max)) * 20))
          return (
            <Box key={`r-${r.name}`}>
              <Text color={color(r.name)}>■ </Text>
              <Text>{r.name.padEnd(nameW)} </Text>
              <Text color={color(r.name)}>{'█'.repeat(n)}</Text>
              <Text dimColor>{'░'.repeat(Math.max(0, 20 - n))}</Text>
              <Text>
                {' '}
                {fmtTokens(r.tokens).padStart(6)} {String(Math.round((r.tokens / Math.max(1, s.max)) * 100)).padStart(3)}%
              </Text>
            </Box>
          )
        })}
        <Text dimColor>
          □ {'free'.padEnd(nameW)} {'░'.repeat(20)} {fmtTokens(free).padStart(6)}
        </Text>
      </Box>
    )
  })
}
