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

/** Lines for the card that replaces the raw JSON in the thread; undefined when it is not our result. */
export const cardLines = (output: unknown): string[] | undefined => {
  const o = asObject(output)
  if (!o) return undefined
  if (typeof o.error === 'string') return [`◆ your call: could not ask (${o.error})`]
  if (o.cancelled) return [o.timedOut ? '◆ your call: no answer, timed out' : '◆ your call: skipped']
  if (Array.isArray(o.approved)) {
    const yes = o.approved.length
    const no = Array.isArray(o.rejected) ? o.rejected.length : 0
    const auto = Array.isArray(o.autoApproved) ? o.autoApproved.length : 0
    const note = typeof o.note === 'string' && o.note ? `  (${o.note})` : ''
    return [`◆ plan: approved ${yes}, skipped ${no}${auto ? `, ${auto} auto (lgtm)` : ''}${note}`]
  }
  if (o.deferred) return ['◆ your call: decide later']
  if (o.explain && typeof o.explain === 'object') return [`◆ your call: asked about "${(o.explain as { label?: string }).label ?? '?'}"`]
  if (typeof o.regenerate === 'string') {
    const vetoed = Object.values((o.vetoed as Record<string, string[]> | undefined) ?? {}).flat()
    return ['◆ your call: none of these fit', `  ↻ ${o.regenerate}${vetoed.length ? ` (rejected: ${vetoed.join(', ')})` : ''}`]
  }
  if (!Array.isArray(o.decisions)) return undefined
  const lines = [o.usedDefault ? '◆ your call (no answer: recommended option used)' : '◆ your call']
  for (const d of o.decisions as Decision[]) {
    const picked = (d.labels?.length ? d.labels : d.picks ?? []).join(', ') || '(none)'
    const notes = Object.values(d.notes ?? {}).filter(Boolean)
    const extra = [d.confidence ? `${d.confidence} confidence` : '', ...notes, d.vetoed?.length ? `vetoed ${d.vetoed.length}` : ''].filter(Boolean)
    lines.push(`  ${d.question ?? d.step ?? '?'}  →  ${picked}${extra.length ? `  (${extra.join('; ')})` : ''}`)
  }
  return lines
}
