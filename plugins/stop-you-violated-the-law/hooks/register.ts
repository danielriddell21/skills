import type { Register } from 'claude-code'

const MAX_TOOLS = 2
const MAX_OUTPUT = 400
const COOLDOWN = 5

export const register: Register = on => {
  let tools = 0
  let quiet = 0

  on('prompt.submit', ($, e, next) => {
    tools = 0
    return next(e)
  })

  on('tool.call', ($, e, next) => {
    tools += 1
    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (quiet > 0) quiet -= 1

    const u = e.usage
    const isLight = u !== undefined && tools <= MAX_TOOLS && u.output_tokens <= MAX_OUTPUT

    if (isLight && /opus/i.test(u.model) && quiet === 0) {
      quiet = COOLDOWN
      $.ui.toast('STOP! You violated the law! Opus on a light turn. Pay the fine: sonnet/haiku would do (/model or /who-does-this)')
    }

    return next(e)
  })
}
