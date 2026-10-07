import type { Matrix } from '../types'

// What each /lgtm variant is allowed to approve on your behalf. Pure, so it can be tested to death.
export type Variant = 'safe' | 'decide' | 'plan' | 'push' | 'yolo'
export const VARIANTS: Variant[] = ['safe', 'decide', 'plan', 'push', 'yolo']

/** Other ways to say the same variant. `fuck it` and `fuckit` are yolo; `ship` was the old name of push. */
export const ALIASES: Record<string, Variant> = { ship: 'push', fuckit: 'yolo', 'fuck it': 'yolo' }

export type Kind = 'pick' | 'plan' | 'danger' | 'sensitive'
export type Risk = 'low' | 'medium' | 'high'
export type Action = 'read' | 'edit' | 'ship' | 'delete' | 'other'
export type Info = { risk?: Risk; action?: Action; recommended?: boolean }

export const DESCRIPTIONS: Record<Variant, string> = {
  safe: 'picks the recommended option; approves low/medium-risk plan items (no commit/push, no delete)',
  decide: 'picks the recommended option on your-call questions, nothing else',
  plan: 'approves low/medium-risk plan items, nothing else',
  push: 'safe, plus commit/push plan items',
  yolo: 'approves everything, dangerous commands included (only catastrophic ones still ask); also /lgtm fuck it',
}

export const allow = (mode: Variant | null | undefined, kind: Kind, info: Info = {}): boolean => {
  if (!mode) return false
  // With nothing recommended there is nothing to pick for you, whatever the variant.
  if (kind === 'pick') return mode !== 'plan' && info.recommended === true
  if (mode === 'yolo') return true
  if (kind === 'danger' || kind === 'sensitive') return false
  // plan item
  if (mode === 'decide') return false
  const risk = info.risk ?? 'medium'
  const action = info.action ?? 'other'
  if (risk === 'high' || action === 'delete') return false
  if (action === 'ship') return mode === 'push'
  return true
}

export const matrixFor = (mode: Variant | null | undefined): Matrix => ({
  pick: allow(mode, 'pick', { recommended: true }),
  plan: {
    medium: allow(mode, 'plan', { risk: 'medium', action: 'edit' }),
    high: allow(mode, 'plan', { risk: 'high', action: 'edit' }),
    ship: allow(mode, 'plan', { risk: 'low', action: 'ship' }),
    delete: allow(mode, 'plan', { risk: 'low', action: 'delete' }),
  },
  danger: allow(mode, 'danger'),
  sensitive: allow(mode, 'sensitive'),
})

/**
 * The same decision as `allow`, from the published flags. Consumers (your-call, are-you-sure-bro)
 * keep a copy of this function; the tests here pin them to `allow` for every variant and input.
 */
export const permits = (m: Matrix | null | undefined, kind: Kind, info: Info = {}): boolean => {
  if (!m) return false
  if (kind === 'danger') return m.danger
  if (kind === 'sensitive') return m.sensitive
  if (kind === 'pick') return m.pick && info.recommended === true
  const risk = info.risk ?? 'medium'
  const action = info.action ?? 'other'
  return m.plan.medium && (risk !== 'high' || m.plan.high) && (action !== 'ship' || m.plan.ship) && (action !== 'delete' || m.plan.delete)
}

export type Parsed =
  | { cmd: 'arm'; mode: Variant | undefined }
  | { cmd: 'off' }
  | { cmd: 'status' }
  | { cmd: 'log' }
  | { cmd: 'unknown'; word: string }

/** `/lgtm` (safe), `/lgtm push`, `/lgtm fuck it`, `/lgtm off`, `/lgtm log`, `/lgtm status`. */
export const parse = (args: string): Parsed => {
  const words = args.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const w = words[0] ?? ''
  if (!w) return { cmd: 'arm', mode: undefined }
  const phrase = words.join(' ')
  if (ALIASES[phrase]) return { cmd: 'arm', mode: ALIASES[phrase] }
  if ((VARIANTS as string[]).includes(w)) return { cmd: 'arm', mode: w as Variant }
  if (ALIASES[w]) return { cmd: 'arm', mode: ALIASES[w] }
  if (w === 'off' || w === 'stop') return { cmd: 'off' }
  if (w === 'status') return { cmd: 'status' }
  if (w === 'log') return { cmd: 'log' }
  return { cmd: 'unknown', word: w }
}
