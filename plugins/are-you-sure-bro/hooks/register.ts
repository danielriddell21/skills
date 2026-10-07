import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Approval } from '../types'

// Dangerous: loses work or data, or cannot be taken back. Always asks.
const DANGEROUS = new RegExp(
  [
    String.raw`\bgit\s+push\b(?=[^;&|]*(?:--force(?!-with-lease)|--delete|\s-f\b|\s:\S))`,
    String.raw`\bgit\s+reset\s+--hard`,
    String.raw`\bgit\s+clean\s+-[a-z]*f`,
    String.raw`\bgit\s+(?:restore\s+\.|checkout\s+--\s+\.)`,
    String.raw`\b(?:curl|wget)\b[^|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b`,
    String.raw`\bchmod\s+-R\s+0?777\b`,
    String.raw`\bshred\b`,
    String.raw`\bdrop\s+(?:table|database)\b|\btruncate\s+table\b`,
    String.raw`\bdelete\s+from\s+\w+\s*(?:;|$)`,
    String.raw`\bterraform\s+destroy\b|\bkubectl\s+delete\s+(?:ns|namespace|node|pv|--all)\b|\bdocker\s+system\s+prune\b`,
    String.raw`\bnpm\s+publish\b|\bmkfs\b|\bdd\s+if=`,
  ].join('|'),
  'i',
)
// Careful level adds things that are often fine but worth a look.
const CAREFUL = new RegExp(
  [
    String.raw`\bgit\s+push\b(?:\s+\S+)?\s+(?:main|master)\b`,
    String.raw`\bgit\s+stash\s+(?:drop|clear)\b`,
    String.raw`\bfind\b.*(?:\s-delete\b|-exec\s+rm\b)`,
    String.raw`\bxargs\s+(?:-\S+\s+)*rm\b`,
    String.raw`\bsudo\b`,
    String.raw`\bchmod\s+-R\b|\bchown\s+-R\b`,
    String.raw`\btruncate\b`,
    String.raw`\bterraform\s+apply\b|\bkubectl\s+delete\b`,
  ].join('|'),
  'i',
)
const BRANCH_D = /\bgit\s+branch\s+-D\b/

// Even /lgtm yolo never waves these through: wiping the machine, a disk or a database.
const CATASTROPHIC = new RegExp(
  [
    String.raw`\brm\s+(?:-\S+\s+)*(?:-\S*[rR]\S*\s+)(?:-\S+\s+)*(?:'|")?(?:/|/\*|~|~/|\$HOME/?|\$\{HOME\}/?)(?:'|")?(?:\s|$|;|&|\|)`,
    String.raw`\bmkfs\b`,
    String.raw`\bdd\s+[^;&|]*\bof=/dev/`,
    String.raw`\bdrop\s+database\b`,
  ].join('|'),
  'i',
)
export const isCatastrophic = (cmd: string): boolean => CATASTROPHIC.test(cmd)

const stripQuotes = (t: string) => t.replace(/^['"]|['"]$/g, '')

const isDangerTarget = (raw: string): boolean => {
  const t = stripQuotes(raw)
  if (t === '/' || t === '/*' || t === '~' || t.startsWith('~/') || /^\$\{?HOME\}?/.test(t)) return true
  if (t === '.' || t === '..' || t === '*' || t === './*' || t === '../*') return true
  return t.startsWith('/') && !/^\/(?:tmp|var\/tmp)\//.test(t)
}

/** `rm -r…` is dangerous only when it targets /, home, the cwd or a parent, a glob, or an absolute path outside /tmp. */
const dangerousRm = (cmd: string): boolean => {
  for (const m of cmd.matchAll(/\brm\s+([^;&|\n]*)/g)) {
    const tokens = m[1].split(/\s+/).filter(Boolean)
    const flags = tokens.filter(t => t.startsWith('-'))
    const recursive = flags.some(f => f === '--recursive' || /^-[a-zA-Z]*[rR]/.test(f))
    if (recursive && tokens.filter(t => !t.startsWith('-')).some(isDangerTarget)) return true
  }
  return false
}
const NOISY = /^\s*(cat\s|ls\s+-\w*R|find\s+\/|find\s+\.\s*$|git\s+log\s*$|npm\s+(test|run\s+test)|go\s+test\s+\.\.\.|pytest\s*$|docker\s+logs\b|kubectl\s+logs\b|journalctl\b)/
const CAPPED = /\||\bhead\b|\btail\b|\s>\s|\s-n\s?\d|--oneline|-maxdepth|--tail|--since/
const SENSITIVE = new RegExp(
  [
    String.raw`(?:^|\/)(?:\.env(?!\.(?:example|sample|template)$)(?:\.[\w.-]+)?|\.npmrc|\.pypirc|\.netrc|id_(?:rsa|ed25519|ecdsa)(?:\.pub)?|credentials(?:\.json)?)$`,
    String.raw`(?:^|\/)(?:\.aws|\.ssh|\.gnupg)\/`,
    String.raw`(?:^|\/)\.git\/(?:config|hooks\/)`,
    String.raw`^\/etc\/`,
  ].join('|'),
  'i',
)

export type Level = 'dangerous' | 'careful'

export const classify = (cmd: string, extra?: RegExp, level: Level = 'dangerous'): 'risky' | 'noisy' | 'ok' => {
  const risky = DANGEROUS.test(cmd) || BRANCH_D.test(cmd) || dangerousRm(cmd) || (level === 'careful' && CAREFUL.test(cmd)) || extra?.test(cmd)
  return risky ? 'risky' : NOISY.test(cmd) && !CAPPED.test(cmd) ? 'noisy' : 'ok'
}

export const isSensitivePath = (p: string): boolean => SENSITIVE.test(p)

const approvals = atom({ plugin: 'are-you-sure-bro', key: 'approvals' } as const, [])

/**
 * Is this pre-approved by /lgtm (looks-good-to-me)? Reads the gate it publishes, records the approval in this
 * plugin's own state (the gate plugin counts and lists it), and answers false on any doubt so the caller asks.
 */
const gateApproves = async ($: any, kind: 'danger' | 'sensitive', detail: string): Promise<boolean> => {
  try {
    const g = (await $.state.get({ plugin: 'looks-good-to-me', key: 'gate' })).value
    if (!g || g.phase !== 'active' || !g.allow || !g.allow[kind]) return false
    const at = await $.clock.now()
    await update($, approvals, (l: Approval[]) => [...l, { at, kind, detail: detail.replace(/\s+/g, ' ').slice(0, 200) }].slice(-200))
    return true
  } catch {
    return false
  }
}

const safeRegex = (src: unknown): RegExp | undefined => {
  if (typeof src !== 'string' || !src.trim()) return undefined
  try {
    return new RegExp(src, 'i')
  } catch {
    return undefined
  }
}

const ask = async ($: { ui: { ask: (q: string, o: string[]) => Promise<string> } }, q: string, opts: string[]) => {
  try {
    return await $.ui.ask(q, opts)
  } catch {
    return undefined
  }
}

export const register: Register = (on, options) => {
  const extra = safeRegex(options.extraRisky)
  const level: Level = options.level === 'careful' ? 'careful' : 'dangerous'
  const cap = typeof options.capLines === 'number' && options.capLines > 0 ? Math.floor(options.capLines) : 200

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const cmd = e.command
    const kind = classify(cmd, extra, level)

    if (kind === 'risky') {
      if (!isCatastrophic(cmd) && (await gateApproves($, 'danger', cmd))) return next(e)
      const pick = await ask($, `Risky command: ${cmd.slice(0, 120)}. Run?`, ['Run', 'Block'])
      if (pick !== 'Run') return { deny: 'are-you-sure-bro: user blocked this command' }
      return next(e)
    }

    if (kind === 'noisy' && options.capNoisy === true) {
      const pick = await ask($, `Noisy output likely: ${cmd.slice(0, 100)}`, [`Cap at ${cap} lines`, 'Run as is'])
      if (pick?.startsWith('Cap')) return next({ ...e, command: `(${cmd}) 2>&1 | head -${cap}` })
    }

    return next(e)
  })

  for (const tool of ['Write', 'Edit'] as const) {
    on('tool.call', { tool }, async ($, e, next) => {
      if (options.guardWrites === false || !isSensitivePath(e.file_path)) return next(e)
      if (await gateApproves($, 'sensitive', e.file_path)) return next(e)
      const pick = await ask($, `${tool} on a sensitive file: ${e.file_path}. Go ahead?`, ['Go ahead', 'Block'])
      return pick === 'Go ahead' ? next(e) : { deny: 'are-you-sure-bro: user blocked this write' }
    })
  }
}
