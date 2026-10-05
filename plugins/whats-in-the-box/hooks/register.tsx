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

const refresh = async ($: Engine) => {
  const { context } = await $.session.usage({ breakdown: 'summary' })
  const b = context.breakdown
  if (!b) return
  const snap = toSnapshot(b)
  await update($, snapshot, () => snap)
}

export const register: Register = on => {
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
