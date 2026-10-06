import type { Register } from 'claude-code'

const RISKY = new RegExp(
  [
    String.raw`\brm\s+(?:-\S+\s+)*-(?:[a-z]*r[a-z]*|-recursive)\b`,
    String.raw`\bgit\s+push\b.*(?:--force|--delete|-f\b|\s:\S)`,
    String.raw`\bgit\s+push\b(?:\s+\S+)?\s+(?:main|master)\b`,
    String.raw`\bgit\s+reset\s+--hard`,
    String.raw`\bgit\s+clean\s+-[a-z]*f`,
    String.raw`\bgit\s+(?:restore\s+\.|checkout\s+--\s+\.)`,
    String.raw`\bgit\s+stash\s+(?:drop|clear)\b`,
    String.raw`\bfind\b.*(?:\s-delete\b|-exec\s+rm\b)`,
    String.raw`\bxargs\s+(?:-\S+\s+)*rm\b`,
    String.raw`\b(?:curl|wget)\b[^|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b`,
    String.raw`\bsudo\b`,
    String.raw`\bchmod\s+-R\b|\bchown\s+-R\b`,
    String.raw`\b(?:truncate|shred)\b`,
    String.raw`\bdrop\s+(?:table|database)\b|\btruncate\s+table\b`,
    String.raw`\bdelete\s+from\s+\w+\s*(?:;|$)`,
    String.raw`\bterraform\s+(?:destroy|apply)\b|\bkubectl\s+delete\b|\bdocker\s+system\s+prune\b`,
    String.raw`\bnpm\s+publish\b|\bmkfs\b|\bdd\s+if=`,
  ].join('|'),
  'i',
)
const BRANCH_D = /\bgit\s+branch\s+-D\b/
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

export const classify = (cmd: string, extra?: RegExp): 'risky' | 'noisy' | 'ok' =>
  RISKY.test(cmd) || BRANCH_D.test(cmd) || extra?.test(cmd) ? 'risky' : NOISY.test(cmd) && !CAPPED.test(cmd) ? 'noisy' : 'ok'

export const isSensitivePath = (p: string): boolean => SENSITIVE.test(p)

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
  const cap = typeof options.capLines === 'number' && options.capLines > 0 ? Math.floor(options.capLines) : 200

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const cmd = e.command
    const kind = classify(cmd, extra)

    if (kind === 'risky') {
      const pick = await ask($, `Risky command: ${cmd.slice(0, 120)}. Run?`, ['Run', 'Block'])
      if (pick !== 'Run') return { deny: 'are-you-sure-bro: user blocked this command' }
      return next(e)
    }

    if (kind === 'noisy') {
      const pick = await ask($, `Noisy output likely: ${cmd.slice(0, 100)}`, [`Cap at ${cap} lines`, 'Run as is'])
      if (pick?.startsWith('Cap')) return next({ ...e, command: `(${cmd}) 2>&1 | head -${cap}` })
    }

    return next(e)
  })

  for (const tool of ['Write', 'Edit'] as const) {
    on('tool.call', { tool }, async ($, e, next) => {
      if (options.guardWrites === false || !isSensitivePath(e.file_path)) return next(e)
      const pick = await ask($, `${tool} on a sensitive file: ${e.file_path}. Go ahead?`, ['Go ahead', 'Block'])
      return pick === 'Go ahead' ? next(e) : { deny: 'are-you-sure-bro: user blocked this write' }
    })
  }
}
