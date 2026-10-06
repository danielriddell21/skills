import type { Register } from 'claude-code'

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

  on('session.measure', ($, e, next) => {
    const pct = e.context.percent

    if (pct === undefined) return next(e)

    $.ui.status(`ctx ${Math.round(pct)}%`)

    const w = nextWarning(pct, warned, steps)
    warned = w.warned
    if (w.text) $.ui.toast(w.text)

    return next(e)
  })
}
