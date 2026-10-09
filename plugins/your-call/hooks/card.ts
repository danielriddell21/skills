type Decision = { question?: string; step?: string; labels?: string[]; picks?: string[]; notes?: Record<string, string>; other?: string; leader?: string | null; confidence?: string; vetoed?: string[] }

const asObject = (output: unknown): Record<string, unknown> | undefined => {
  let v = output
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    const r = v as Record<string, unknown>
    if (typeof r.text === 'string') v = r.text
    else if (typeof r.result === 'string') v = r.result
    else if (r.decisions || r.cancelled || r.regenerate || r.error || r.deferred || r.explain || r.approved) return r
  }
  if (typeof v === 'string') {
    try {
      const j = JSON.parse(v)
      return typeof j === 'object' && j !== null ? (j as Record<string, unknown>) : undefined
    } catch {
      return undefined
    }
  }
  return undefined
}

type Raw = Record<string, unknown>
type Card = (o: Raw) => string[] | undefined

const count = (v: unknown): number => (Array.isArray(v) ? v.length : 0)

const errorCard: Card = o => (typeof o.error === 'string' ? [`◆ your call: could not ask (${o.error})`] : undefined)

const cancelledCard: Card = o => (o.cancelled ? [o.timedOut ? '◆ your call: no answer, timed out' : '◆ your call: skipped'] : undefined)

const planCard: Card = o => {
  if (!Array.isArray(o.approved)) return undefined
  const auto = count(o.autoApproved)
  const autoText = auto ? `, ${auto} auto (lgtm)` : ''
  const note = typeof o.note === 'string' && o.note ? `  (${o.note})` : ''
  return [`◆ plan: approved ${o.approved.length}, skipped ${count(o.rejected)}${autoText}${note}`]
}

const deferredCard: Card = o => (o.deferred ? ['◆ your call: decide later'] : undefined)

const explainCard: Card = o =>
  o.explain && typeof o.explain === 'object' ? [`◆ your call: asked about "${(o.explain as { label?: string }).label ?? '?'}"`] : undefined

const regenerateCard: Card = o => {
  if (typeof o.regenerate !== 'string') return undefined
  const vetoed = Object.values((o.vetoed as Record<string, string[]> | undefined) ?? {}).flat()
  const rejected = vetoed.length ? ` (rejected: ${vetoed.join(', ')})` : ''
  return ['◆ your call: none of these fit', `  ↻ ${o.regenerate}${rejected}`]
}

const decisionLine = (d: Decision): string => {
  const picked = (d.labels?.length ? d.labels : (d.picks ?? [])).join(', ') || '(none)'
  const notes = Object.values(d.notes ?? {}).filter(Boolean)
  const extra = [d.confidence ? `${d.confidence} confidence` : '', ...notes, d.vetoed?.length ? `vetoed ${d.vetoed.length}` : ''].filter(Boolean)
  const extraText = extra.length ? `  (${extra.join('; ')})` : ''
  return `  ${d.question ?? d.step ?? '?'}  →  ${picked}${extraText}`
}

const decisionsCard: Card = o => {
  if (!Array.isArray(o.decisions)) return undefined
  const head = o.usedDefault ? '◆ your call (no answer: recommended option used)' : '◆ your call'
  return [head, ...(o.decisions as Decision[]).map(decisionLine)]
}

const CARDS: Card[] = [errorCard, cancelledCard, planCard, deferredCard, explainCard, regenerateCard, decisionsCard]

/** Lines for the card that replaces the raw JSON in the thread; undefined when it is not our result. */
export const cardLines = (output: unknown): string[] | undefined => {
  const o = asObject(output)
  if (!o) return undefined
  for (const card of CARDS) {
    const lines = card(o)
    if (lines) return lines
  }
  return undefined
}
