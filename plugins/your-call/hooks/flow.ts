import type { Criterion, Snap, Step, View } from '../types'

export const DEFAULT_WEIGHT = 5
export const MAX_WEIGHT = 10

type Picks = Record<string, string[]>

export const isComplete = (step: Step, picks: Picks): boolean => step.kind === 'rank' || (picks[step.id] ?? []).length > 0

/** A step is shown when its showIf holds against the picks so far (no showIf: always). */
export const isVisible = (step: Step, picks: Picks): boolean => {
  const c = step.showIf
  if (!c) return true
  const chosen = picks[c.step] ?? []
  const yes = !c.picked || c.picked.some(id => chosen.includes(id))
  const no = !c.notPicked || !c.notPicked.some(id => chosen.includes(id))
  return yes && no && (chosen.length > 0 || !!c.notPicked)
}

export const visibleIdx = (steps: Step[], picks: Picks): number[] =>
  steps.flatMap((s, i) => (isVisible(s, picks) ? [i] : []))

export const nextVisible = (steps: Step[], picks: Picks, from: number): number | undefined =>
  visibleIdx(steps, picks).find(i => i > from)

export const prevVisible = (steps: Step[], picks: Picks, from: number): number | undefined =>
  [...visibleIdx(steps, picks)].reverse().find(i => i < from)

/** Steps whose visibility depends, directly or through others, on `id`. */
export const dependents = (steps: Step[], id: string): Set<string> => {
  const out = new Set<string>()
  let grew = true
  while (grew) {
    grew = false
    for (const s of steps) {
      const on = s.showIf?.step
      if (on && (on === id || out.has(on)) && !out.has(s.id)) {
        out.add(s.id)
        grew = true
      }
    }
  }
  return out
}

/** After the answer to `changed` moves, forget the answers of everything that depended on it. */
export const resetDependents = (
  steps: Step[],
  picks: Picks,
  notes: Record<string, string>,
  changed: string,
): { picks: Picks; notes: Record<string, string> } => {
  const dep = dependents(steps, changed)
  if (dep.size === 0) return { picks, notes }
  const nextPicks = { ...picks }
  for (const s of steps) if (dep.has(s.id)) nextPicks[s.id] = s.kind === 'rank' ? s.options.map(o => o.id) : []
  const nextNotes = Object.fromEntries(Object.entries(notes).filter(([k]) => ![...dep].some(id => k.startsWith(`${id}:`))))
  return { picks: nextPicks, notes: nextNotes }
}

export const weightKey = (stepId: string, name: string): string => `${stepId}:${name}`

export const clampWeight = (n: number): number => Math.max(0, Math.min(MAX_WEIGHT, Math.round(n)))

export const weightOf = (stepId: string, c: Criterion, weights: Record<string, number>): number =>
  clampWeight(weights[weightKey(stepId, c.name)] ?? c.weight ?? DEFAULT_WEIGHT)

/** Weighted totals per option, and the leader (null when nothing scores or the top is tied). */
export const weightedTotals = (step: Step, weights: Record<string, number>): { totals: Record<string, number>; leader: string | null } => {
  const totals: Record<string, number> = {}
  for (const o of step.options) {
    totals[o.id] = (step.criteria ?? []).reduce((sum, c) => sum + (c.scores[o.id] ?? 0) * weightOf(step.id, c, weights), 0)
  }
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1])
  const leader = sorted.length > 0 && sorted[0][1] > 0 && (sorted.length === 1 || sorted[0][1] > sorted[1][1]) ? sorted[0][0] : null
  return { totals, leader }
}

export const OTHER = '__other'

/** Starting picks: recommended options preselected (one/compare: the first; many: all), rank in given order. */
export const initialPicks = (steps: Step[]): Picks =>
  Object.fromEntries(
    steps.map(s => {
      if (s.kind === 'rank') return [s.id, s.options.map(o => o.id)]
      const rec = s.options.filter(o => o.recommended).map(o => o.id)
      return [s.id, s.kind === 'many' ? rec : rec.slice(0, 1)]
    }),
  )

export const lastKey = (question: string): string => question.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60)

export const UNDO_LIMIT = 20
export const CONFIDENCE = ['low', 'medium', 'high'] as const

export const snapOf = (v: View): Snap => ({
  picks: v.picks,
  notes: v.notes,
  others: v.others,
  weights: v.weights,
  vetoed: v.vetoed,
  confidence: v.confidence,
  idx: v.idx,
  phase: v.phase,
})

/** Record the state before a user change so Undo can return to it; a new change clears Redo. */
export const withUndo = (before: View, after: View): View => ({
  ...after,
  undo: [...before.undo, snapOf(before)].slice(-UNDO_LIMIT),
  redo: [],
})

export const undoOf = (v: View): View => {
  const prev = v.undo[v.undo.length - 1]
  return prev ? { ...v, ...prev, undo: v.undo.slice(0, -1), redo: [...v.redo, snapOf(v)] } : v
}

export const redoOf = (v: View): View => {
  const next = v.redo[v.redo.length - 1]
  return next ? { ...v, ...next, redo: v.redo.slice(0, -1), undo: [...v.undo, snapOf(v)] } : v
}

/** Toggle an option as vetoed; a vetoed option can no longer be picked, so it leaves the picks. */
export const toggleVeto = (v: View, stepId: string, optionId: string): View => {
  const cur = v.vetoed[stepId] ?? []
  const on = cur.includes(optionId)
  const vetoed = { ...v.vetoed, [stepId]: on ? cur.filter(x => x !== optionId) : [...cur, optionId] }
  const picks = on ? v.picks : { ...v.picks, [stepId]: (v.picks[stepId] ?? []).filter(x => x !== optionId) }
  return { ...v, vetoed, picks }
}

/** Starting state for a re-ask: only keys that still match the new steps and options survive. */
export const resumeFrom = (raw: unknown, steps: Step[]): Partial<Pick<View, 'picks' | 'notes' | 'weights' | 'vetoed' | 'others' | 'confidence'>> => {
  if (typeof raw !== 'object' || raw === null) return {}
  const r = raw as Record<string, unknown>
  const byId = new Map(steps.map(s => [s.id, s]))
  const keep = (m: unknown, fn: (s: Step, v: unknown) => unknown): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    if (typeof m !== 'object' || m === null) return out
    for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
      const s = byId.get(k.split(':')[0])
      const val = s ? fn(s, v) : undefined
      if (val !== undefined) out[k] = val
    }
    return out
  }
  const ids = (s: Step, v: unknown) => {
    const a = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && (x === OTHER || s.options.some(o => o.id === x))) : []
    return a.length ? a : undefined
  }
  return {
    picks: keep(r.picks, ids) as Record<string, string[]>,
    vetoed: keep(r.vetoed, (s, v) => (Array.isArray(v) ? v.filter((x): x is string => s.options.some(o => o.id === x)) : undefined)) as Record<string, string[]>,
    notes: keep(r.notes, (_s, v) => (typeof v === 'string' ? v.slice(0, 300) : undefined)) as Record<string, string>,
    others: keep(r.others, (_s, v) => (typeof v === 'string' ? v.slice(0, 300) : undefined)) as Record<string, string>,
    weights: keep(r.weights, (_s, v) => (typeof v === 'number' ? clampWeight(v) : undefined)) as Record<string, number>,
    confidence: keep(r.confidence, (_s, v) => ((CONFIDENCE as readonly unknown[]).includes(v) ? v : undefined)) as Record<string, string>,
  }
}

/** The recommended pick per visible step, or undefined when any visible step has none (so a timeout cannot guess). */
export const recommendedFor = (steps: Step[]): Picks | undefined => {
  const picks = initialPicks(steps)
  return visibleIdx(steps, picks).every(i => steps[i].kind === 'rank' || picks[steps[i].id].length > 0) ? picks : undefined
}
