import type { Register } from 'claude-code'

const STEPS: [number, string][] = [
  [85, 'Context 85%: /compact or /clear now'],
  [70, 'Context 70%: wrap up, consider /compact'],
  [50, 'Context 50%: keep reads tight'],
]

/** Which warning (if any) fires at `pct`, given the highest already shown. */
export const nextWarning = (pct: number, warned: number): { warned: number; text?: string } => {
  const base = pct < 40 ? 0 : warned
  const hit = STEPS.find(([t]) => pct >= t)
  return hit && hit[0] > base ? { warned: hit[0], text: hit[1] } : { warned: base }
}

export const register: Register = on => {
  let warned = 0

  on('session.measure', ($, e, next) => {
    const pct = e.context.percent

    if (pct === undefined) return next(e)

    $.ui.status(`ctx ${Math.round(pct)}%`)

    const w = nextWarning(pct, warned)
    warned = w.warned
    if (w.text) $.ui.toast(w.text)

    return next(e)
  })
}
