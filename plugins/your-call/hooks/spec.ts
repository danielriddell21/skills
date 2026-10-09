import type { Criterion, Option, ShowIf, Step, Viz } from '../types'

import { OTHER, clampWeight } from './flow'

export const MAX_OPTIONS = 12
export const MAX_STEPS = 6
const KINDS = ['one', 'many', 'rank', 'compare'] as const

type Raw = Record<string, unknown>

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max = 200): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
const strs = (v: unknown, n = 4): string[] | undefined => {
  const a = Array.isArray(v) ? v.map(x => str(x, 120)).filter((x): x is string => !!x).slice(0, n) : []
  return a.length ? a : undefined
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'x'

const normOptions = (raw: unknown): Option[] => {
  const seen = new Set<string>()
  const out: Option[] = []
  for (const [i, r] of (Array.isArray(raw) ? raw : []).entries()) {
    const o: Raw = isObj(r) ? r : { label: r }
    const label = str(o.label) ?? str(o.id)
    if (!label) continue
    let id = str(o.id, 40) ?? slug(label)
    if (seen.has(id)) id = `${id}-${i + 1}`
    seen.add(id)
    out.push({ id: id === OTHER ? `${id}-${i + 1}` : id, label, detail: str(o.detail, 300), pros: strs(o.pros), cons: strs(o.cons), recommended: o.recommended === true ? true : undefined })
  }
  return out
}

const normCriteria = (raw: unknown): Criterion[] | undefined => {
  const out: Criterion[] = []
  for (const c of Array.isArray(raw) ? raw : []) {
    if (!isObj(c) || !str(c.name) || !isObj(c.scores)) continue
    const scores: Record<string, number> = {}
    for (const [k, v] of Object.entries(c.scores)) if (typeof v === 'number' && Number.isFinite(v)) scores[k] = v
    out.push({ name: str(c.name) as string, scores, weight: typeof c.weight === 'number' && Number.isFinite(c.weight) ? clampWeight(c.weight) : undefined })
  }
  return out.length ? out : undefined
}

const normAudience = (raw: unknown, options: Option[]): { votes: Record<string, number> } | undefined => {
  if (!isObj(raw) || !isObj(raw.votes)) return undefined
  const ids = new Set(options.map(o => o.id))
  const votes: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw.votes)) if (ids.has(k) && typeof v === 'number' && v > 0 && Number.isFinite(v)) votes[k] = Math.round(v)
  return Object.keys(votes).length ? { votes } : undefined
}

const normShowIf = (raw: unknown, earlier: string[], id: string, warnings: string[]): ShowIf | undefined => {
  if (!isObj(raw)) return undefined
  const step = str(raw.step, 40)
  if (!step || !earlier.includes(step)) {
    warnings.push(`step "${id}": showIf must name an earlier step; ignored`)
    return undefined
  }
  const picked = strs(raw.picked, 8)
  const notPicked = strs(raw.notPicked, 8)
  if (!picked && !notPicked) {
    warnings.push(`step "${id}": showIf needs picked or notPicked; ignored`)
    return undefined
  }
  return { step, picked, notPicked }
}

/** Shorthand for simple asks: {question, options?, recommended?, why?, multi?, yesno?} becomes a one-step spec. */
export const expandShorthand = (raw: unknown): unknown => {
  if (!isObj(raw) || Array.isArray(raw.steps) || !str(raw.question)) return raw
  const options = raw.yesno === true ? ['Yes', 'No'] : raw.options
  const rec = str(raw.recommended, 80)?.toLowerCase()
  const marked = (Array.isArray(options) ? options : []).map(o => {
    const base: Raw = isObj(o) ? { ...o } : { label: o }
    const label = str(base.label)?.toLowerCase()
    const id = str(base.id)?.toLowerCase()
    return rec && (label === rec || id === rec) ? { ...base, recommended: true } : base
  })
  return {
    title: raw.title,
    steps: [{ id: 'q', question: raw.question, kind: raw.multi === true ? 'many' : 'one', options: marked, why: raw.why, viz: raw.viz }],
  }
}

export type Normalized = { ok: true; title: string; steps: Step[]; warnings: string[] } | { ok: false; error: string }

/** Cap, de-duplicate the recommendation of, and reorder one step's options (recommended first, except for rank). */
const tidyOptions = (list: Option[], id: string, kind: Step['kind'], warnings: string[]): Option[] => {
  let options = list
  if (options.length > MAX_OPTIONS) {
    warnings.push(`step "${id}": showing the first ${MAX_OPTIONS} of ${options.length} options`)
    options = options.slice(0, MAX_OPTIONS)
  }
  const seenRec = options.filter(o => o.recommended)
  if (seenRec.length > 1 && kind !== 'many') {
    options = options.map(o => (o === seenRec[0] ? o : { ...o, recommended: undefined }))
    warnings.push(`step "${id}": only one option can be recommended; kept "${seenRec[0].label}"`)
  }
  if (kind !== 'rank' && options.some(o => o.recommended)) options = [...options.filter(o => o.recommended), ...options.filter(o => !o.recommended)]
  return options
}

/** One step, cleaned up; the error text when it cannot be used. */
const normStep = (r: unknown, i: number, ids: Set<string>, before: Step[], warnings: string[]): Step | string => {
  const s: Raw = isObj(r) ? r : {}
  let id = str(s.id, 40) ?? `s${i + 1}`
  if (ids.has(id)) id = `${id}-${i + 1}`
  ids.add(id)

  const question = str(s.question, 300) ?? `Question ${i + 1}`
  const kind = (KINDS as readonly unknown[]).includes(s.kind) ? (s.kind as Step['kind']) : 'one'
  const parsed = normOptions(s.options)
  if (parsed.length < 2) return `step "${id}" needs at least 2 options`

  const options = tidyOptions(parsed, id, kind, warnings)
  const audience = normAudience(s.audience, options)
  const showIf = normShowIf(s.showIf, before.map(p => p.id), id, warnings)
  const viz = isObj(s.viz) && typeof s.viz.type === 'string' ? (s.viz as unknown as Viz) : undefined
  return { id, question, kind, options, criteria: normCriteria(s.criteria), viz, showIf, why: str(s.why, 200), audience, measured: s.measured === true ? true : undefined }
}

/** Clean up whatever the model sent so the pane never throws; say what is wrong when it cannot. */
export const normalizeSpec = (input: unknown): Normalized => {
  const raw = expandShorthand(input)
  const spec: Raw = isObj(raw) ? raw : {}
  const rawSteps = Array.isArray(spec.steps) ? spec.steps : []
  if (rawSteps.length === 0) return { ok: false, error: 'steps must be a non-empty array' }

  const warnings: string[] = []
  const steps: Step[] = []
  const ids = new Set<string>()

  for (const [i, r] of rawSteps.slice(0, MAX_STEPS).entries()) {
    const step = normStep(r, i, ids, steps, warnings)
    if (typeof step === 'string') return { ok: false, error: step }
    steps.push(step)
  }

  if (rawSteps.length > MAX_STEPS) warnings.push(`only the first ${MAX_STEPS} steps are shown`)

  return { ok: true, title: str(spec.title, 80) ?? 'Decision', steps, warnings }
}
