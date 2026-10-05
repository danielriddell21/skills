import type { Register } from 'claude-code'

const RISKY = /\brm\s+(?:-\S+\s+)*-(?:[a-z]*r[a-z]*|-recursive)\b|\bgit\s+push\b.*(--force|-f\b)|\bgit\s+reset\s+--hard|\bgit\s+clean\s+-[a-z]*f|\bdrop\s+(table|database)\b|\bmkfs\b|\bdd\s+if=/i
const NOISY = /^\s*(cat\s|ls\s+-\w*R|find\s+\/|find\s+\.\s*$|git\s+log\s*$|npm\s+(test|run\s+test)|go\s+test\s+\.\.\.|pytest\s*$)/
const CAPPED = /\||\bhead\b|\btail\b|\s>\s|\s-n\s?\d|--oneline|-maxdepth/

export const classify = (cmd: string): 'risky' | 'noisy' | 'ok' =>
  RISKY.test(cmd) ? 'risky' : NOISY.test(cmd) && !CAPPED.test(cmd) ? 'noisy' : 'ok'

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const cmd = e.command

    if (classify(cmd) === 'risky') {
      const pick = await $.ui.ask(`Risky command: ${cmd.slice(0, 120)}. Run?`, ['Run', 'Block'])
      if (pick !== 'Run') return { deny: 'are-you-sure-bro: user blocked this command' }
      return next(e)
    }

    if (classify(cmd) === 'noisy') {
      const pick = await $.ui.ask(`Noisy output likely: ${cmd.slice(0, 100)}`, ['Cap at 200 lines', 'Run as is'])
      if (pick.startsWith('Cap')) return next({ ...e, command: `(${cmd}) 2>&1 | head -200` })
    }

    return next(e)
  })
}
