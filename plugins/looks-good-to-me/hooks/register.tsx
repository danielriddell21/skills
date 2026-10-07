import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Approval } from '../types'

import { RANK, chipKey, injectChips, isEmpty } from './chips'
import { DESCRIPTIONS, VARIANTS, matrixFor, parse } from './policy'
import type { Variant } from './policy'

const gate = atom({ plugin: 'looks-good-to-me', key: 'gate' } as const, { mode: null, phase: 'off', since: 0, allow: null })

// The plugins that act on the gate record what they approved in their own state; this one reads it.
const askApprovals = { plugin: 'are-you-sure-bro', key: 'approvals' } as const
const callApprovals = { plugin: 'your-call', key: 'approvals' } as const

export const countSince = (lists: Approval[][], since: number): number => lists.reduce((n, l) => n + l.filter(a => a.at >= since).length, 0)

export const logText = (items: Approval[]): string =>
  items.length === 0
    ? 'No auto-approvals this turn or last.'
    : [...items]
        .sort((a, b) => a.at - b.at)
        .map((a, i) => `${i + 1}. ${a.kind}: ${a.detail.slice(0, 80)}`)
        .join('\n')

const readAll = async ($: any): Promise<Approval[]> => {
  const a = (await $.state.get(askApprovals)).value ?? []
  const c = (await $.state.get(callApprovals)).value ?? []
  return [...a, ...c]
}

export const register: Register = (on, options) => {
  const dflt: Variant = (VARIANTS as string[]).includes(String(options.defaultVariant)) ? (options.defaultVariant as Variant) : 'safe'
  let last: Approval[] = []

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'lgtm',
      description: 'Auto-approval gate for the next turn: /lgtm [safe|decide|plan|push|yolo|off|log]',
    })
    return next(e)
  })

  on('command.run', { command: 'lgtm' }, async ($, e) => {
    const p = parse(e.args)

    if (p.cmd === 'log') {
      const g = await read($, gate)
      const mine = (await readAll($)).filter(a => a.at >= g.since)
      return { text: logText(mine.length ? mine : last) }
    }
    if (p.cmd === 'off') {
      await update($, gate, g => ({ mode: null, phase: 'off', since: g.since, allow: null }))
      return { text: 'lgtm off.' }
    }
    if (p.cmd === 'status') {
      const g = await read($, gate)
      return { text: g.mode ? `lgtm ${g.mode} (${g.phase}): ${DESCRIPTIONS[g.mode]}` : `lgtm is off. Variants: ${VARIANTS.join(', ')}.` }
    }
    if (p.cmd === 'unknown') return { text: `Unknown "${p.word}". Variants: ${VARIANTS.join(', ')}, or off, log, status.` }
    if (p.cmd !== 'arm') return { text: 'Usage: /lgtm [safe|decide|plan|push|yolo|off|log]' }

    const mode = p.mode ?? dflt
    // Armed: it opens when the next turn starts. Nothing is approved before that.
    await update($, gate, g => ({ mode, phase: 'armed', since: g.since, allow: null }))
    return { text: `lgtm ${mode} for the next turn: ${DESCRIPTIONS[mode]}.` }
  })

  // The gate opens when the turn starts and closes when it ends: "this turn only".
  on('prompt.submit', async ($, e, next) => {
    const g = await read($, gate)
    if (g.phase === 'armed' && g.mode && e.origin === undefined) {
      const now = await $.clock.now()
      await update($, gate, () => ({ mode: g.mode, phase: 'active', since: now, allow: matrixFor(g.mode) }))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const g = await read($, gate)
    if (g.phase === 'active') {
      const mine = (await readAll($)).filter(a => a.at >= g.since)
      last = mine
      if (mine.length > 0) $.ui.toast(`lgtm ${g.mode}: ${mine.length} auto-approved.\n/lgtm log lists them`)
      await update($, gate, () => ({ mode: null, phase: 'off', since: g.since, allow: null }))
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const g = await read($, gate)

    if (!g.mode || e.props.hasSurvey) return next(e)

    const a = (await $.state.get(askApprovals)).value ?? []
    const c = (await $.state.get(callApprovals)).value ?? []
    const count = g.phase === 'active' ? countSince([a, c], g.since) : 0
    const { Box, Text, Button } = $.ui.resolve(e)
    const rest = await next(e)
    const hot = g.mode === 'yolo'
    const chip = (
      <Box key={chipKey(RANK.gate, 'lgtm')}>
        <Text key="lgtm" color={hot ? 'red' : 'green'} bold>
          {hot ? '⚠' : '✓'} lgtm {g.mode}
          {g.phase === 'armed' ? ' (next turn)' : count > 0 ? ` · ${count} auto-approved` : ''}{' '}
        </Text>
        <Button key="lgtm-off" label="Off" onPress={() => update($, gate, x => ({ mode: null, phase: 'off', since: x.since, allow: null }))} />
      </Box>
    )
    const joined = injectChips(rest, chip)

    if (joined) return joined as never
    if (isEmpty(rest)) return <Box key="chips" flexWrap="wrap">{chip}</Box>

    return (
      <Box flexDirection="column">
        <Box key="chips" flexWrap="wrap">{chip}</Box>
        {rest}
      </Box>
    )
  })
}
