import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { RANK, chipKey, injectChips, isEmpty } from './chips'

const route = atom({ plugin: 'matchmaker', key: 'route' } as const, null)
const isOff = atom({ plugin: 'matchmaker', key: 'isOff' } as const, false)

export const LABELS = [
  'search',
  'implement',
  'design',
  'review',
  'trivial',
  'destructive-or-ambiguous',
  'compare-or-explain-flow',
  'second-opinion',
] as const
export const HINT: Record<string, string> = {
  search: 'Route: read/search-heavy. Delegate the sweep to the `scout` agent (haiku); take back a summary. See skill hey-you-do-it.',
  implement: 'Route: clear implementation. Use `engineer` (sonnet) if the change spans several files.',
  design: 'Route: ambiguous/cross-cutting. Plan with `spy` (opus) first, then implement.',
  review: 'Route: review. Use `sniper` (opus) on the diff.',
  trivial: 'Route: trivial. Do it inline; no subagent.',
  'destructive-or-ambiguous':
    'Route: this request may be destructive, irreversible or ambiguous. If the ask-dont-guess skill is available, follow it: list assumptions and confirm with the user (mcp__your-call__ask) before acting.',
  'compare-or-explain-flow':
    'Route: comparison or structure. If the show-dont-tell skill is available, follow it: answer with a chart or diagram (a fenced viz block) rather than prose alone.',
  'second-opinion':
    'Route: the user wants a second opinion. If the phone-a-friend or ask-the-audience skill is available, follow it.',
}

/** Who the hint sends the work to, for the chip. */
export const AGENT: Record<string, string> = {
  search: 'scout',
  implement: 'engineer',
  design: 'spy',
  review: 'sniper',
  trivial: 'inline',
  'destructive-or-ambiguous': 'ask first',
  'compare-or-explain-flow': 'chart it',
  'second-opinion': 'second opinion',
}

export const chipText = (label: string): string => `✦ ${label} → ${AGENT[label] ?? label}`

export const shouldClassify = (text: string, hasOrigin: boolean, isOffNow: boolean, minChars = 40): boolean => {
  const t = text.trim()
  return !hasOrigin && !isOffNow && !t.startsWith('/') && t.length >= minChars
}

export const register: Register = (on, options) => {
  const minChars = typeof options.minChars === 'number' ? options.minChars : 40

  on('session.start', async ($, e, next) => {
    const saved = await $.store.get('isOff')
    await update($, isOff, () => saved === true || options.enabled === false)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const t = e.text.trim()

    if (!shouldClassify(t, e.origin !== undefined, await read($, isOff), minChars)) return next(e)

    const label = await $.model.classify(t, LABELS).catch(() => undefined)

    if (!label) return next(e)

    await update($, route, () => label)
    $.ui.status(`✦ ${label}`)

    return next({ ...e, context: [...(e.context ?? []), HINT[label] ?? ''] })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, route)
    const off = await read($, isOff)

    if (e.props.hasSurvey || (r === null && !off)) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const rest = await next(e)
    const chip = (
      <Box key={chipKey(RANK.route, 'route')}>
        <Text key="mm" color={off ? undefined : 'magenta'} dimColor={off}>
          {off ? '✦ matchmaker off ' : `${chipText(r ?? '')} `}
        </Text>
        <Button
          key="toggle"
          label={off ? 'On' : 'Off'}
          onPress={async () => {
            const v = await update($, isOff, x => !x)
            await $.store.set('isOff', v)
          }}
        />
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
