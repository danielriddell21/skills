import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const pctAtom = atom({ plugin: 'are-we-there-yet', key: 'pct' } as const, 0)

const FOCUS =
  'keep the goal, decisions and why, exact error messages, file paths and line ranges touched, open TODOs, current branch and state; drop exploration, file dumps, command output already acted on, abandoned approaches'

export const showCompact = (percent: number, urgent: number): boolean => percent >= urgent

export type Step = [number, string]

export const stepsFor = (notice: number, warn: number, urgent: number): Step[] =>
  [
    [urgent, `Context ${urgent}%: /compact or /clear now`],
    [warn, `Context ${warn}%: wrap up, consider /compact`],
    [notice, `Context ${notice}%: keep reads tight`],
  ].sort((a, b) => (b[0] as number) - (a[0] as number)) as Step[]

const STEPS = stepsFor(50, 70, 85)

/** Which warning (if any) fires at `pct`, given the highest already shown. */
export const nextWarning = (pct: number, warned: number, steps: Step[] = STEPS): { warned: number; text?: string } => {
  const lowest = steps[steps.length - 1][0]
  const base = pct < lowest - 10 ? 0 : warned
  const hit = steps.find(([t]) => pct >= t)
  return hit && hit[0] > base ? { warned: hit[0], text: hit[1] } : { warned: base }
}

export const register: Register = (on, options) => {
  const num = (v: unknown, d: number) => (typeof v === 'number' && v > 0 && v <= 100 ? v : d)
  const steps = stepsFor(num(options.notice, 50), num(options.warn, 70), num(options.urgent, 85))
  let warned = 0

  on('session.measure', async ($, e, next) => {
    const pct = e.context.percent

    if (pct === undefined) return next(e)

    $.ui.status(`ctx ${Math.round(pct)}%`)
    await update($, pctAtom, () => pct)

    const w = nextWarning(pct, warned, steps)
    warned = w.warned
    if (w.text) $.ui.toast(w.text)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const p = await read($, pctAtom)
    const urgent = steps[0][0]

    if (options.compactButton === false || e.props.hasSurvey || !showCompact(p, urgent)) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const rest = await next(e)

    return (
      <Box flexDirection="column">
        <Box>
          <Text color="red" bold>Context {Math.round(p)}% </Text>
          <Button key="compact" label="Compact" onPress={() => $.command.run({ command: 'compact', args: FOCUS })} />
        </Box>
        {rest}
      </Box>
    )
  })
}
