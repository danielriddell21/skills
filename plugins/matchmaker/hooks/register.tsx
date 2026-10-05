import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const route = atom({ plugin: 'matchmaker', key: 'route' } as const, null)
const isOff = atom({ plugin: 'matchmaker', key: 'isOff' } as const, false)

const LABELS = ['search', 'implement', 'design', 'review', 'trivial'] as const
export const HINT: Record<string, string> = {
  search: 'Route: read/search-heavy. Delegate the sweep to the `scout` agent (haiku); take back a summary. See skill hey-you-do-it.',
  implement: 'Route: clear implementation. Use `engineer` (sonnet) if the change spans several files.',
  design: 'Route: ambiguous/cross-cutting. Plan with `spy` (opus) first, then implement.',
  review: 'Route: review. Use `sniper` (opus) on the diff.',
  trivial: 'Route: trivial. Do it inline; no subagent.',
}

export const shouldClassify = (text: string, hasOrigin: boolean, isOffNow: boolean): boolean => {
  const t = text.trim()
  return !hasOrigin && !isOffNow && !t.startsWith('/') && t.length >= 40
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    const t = e.text.trim()

    if (!shouldClassify(t, e.origin !== undefined, await read($, isOff))) return next(e)

    const label = await $.model.classify(t, LABELS).catch(() => undefined)

    if (!label) return next(e)

    await update($, route, () => label)
    $.ui.status(`route: ${label}`)

    return next({ ...e, context: [...(e.context ?? []), HINT[label] ?? ''] })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, route)
    const off = await read($, isOff)

    if (e.props.hasSurvey || (r === null && !off)) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)

    return (
      <Box>
        <Text dimColor>{off ? 'matchmaker off ' : `route: ${r} `}</Text>
        <Button key="toggle" label={off ? 'On' : 'Off'} onPress={() => update($, isOff, v => !v)} />
      </Box>
    )
  })
}
