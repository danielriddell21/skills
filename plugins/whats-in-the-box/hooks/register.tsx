import { atom, read, update } from 'claude-code'
import type { Hook, Register } from 'claude-code'

import type { Snapshot } from '../types'

const PANE = 'whats-in-the-box'
const snapshot = atom({ plugin: 'whats-in-the-box', key: 'snapshot' } as const, null)

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

export const fmtTokens = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))

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
    if (e.changed.includes('context')) await refresh($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, snapshot)
    const min = typeof options.minPercent === 'number' ? options.minPercent : 0

    if (options.band === false || e.props.hasSurvey || !s || s.percent < min) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const cells = barCells(s.rows, s.max, BAR_WIDTH)
    const used = cells.reduce((n, c) => n + c.cells, 0)
    const color = (name: string) => PALETTE[Math.max(0, s.rows.findIndex(r => r.name === name)) % PALETTE.length]
    const shown = s.rows.slice(0, LEGEND_MAX)
    const hidden = s.rows.length - shown.length

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>ctx </Text>
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
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const s = await read($, snapshot)

    if (!s) return <Text dimColor>No data yet.</Text>

    return (
      <Box flexDirection="column">
        <Text>
          {s.total} / {s.max} tokens ({Math.round(s.percent)}%)
        </Text>
        {s.rows.map(r => (
          <Text key={r.name} dimColor={r.tokens < s.total * 0.05}>
            {String(r.tokens).padStart(8)}  {r.name}
          </Text>
        ))}
      </Box>
    )
  })
}
