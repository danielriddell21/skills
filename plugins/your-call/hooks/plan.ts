export type Risk = 'low' | 'medium' | 'high'
export type Action = 'read' | 'edit' | 'ship' | 'delete' | 'other'
export type PlanItem = { id: string; label: string; detail?: string; command?: string; risk: Risk; action: Action }

export const MAX_ITEMS = 12
const RISKS: Risk[] = ['low', 'medium', 'high']
const ACTIONS: Action[] = ['read', 'edit', 'ship', 'delete', 'other']

type Raw = Record<string, unknown>
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max = 200): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

export type NormalizedPlan = { ok: true; title: string; why?: string; items: PlanItem[]; warnings: string[] } | { ok: false; error: string }

const toItem = (r: unknown, i: number, seen: Set<string>): PlanItem | undefined => {
  const o: Raw = isObj(r) ? r : { label: r }
  const label = str(o.label) ?? str(o.command)
  if (!label) return undefined
  let id = str(o.id, 40) ?? `i${i + 1}`
  if (seen.has(id)) id = `${id}-${i + 1}`
  seen.add(id)
  return {
    id,
    label,
    detail: str(o.detail, 300),
    command: str(o.command, 300),
    risk: (RISKS as unknown[]).includes(o.risk) ? (o.risk as Risk) : 'medium',
    action: (ACTIONS as unknown[]).includes(o.action) ? (o.action as Action) : 'other',
  }
}

/** Clean up an approve-plan request so the pane never throws. */
export const normalizePlan = (raw: unknown): NormalizedPlan => {
  const spec: Raw = isObj(raw) ? raw : {}
  const rawItems = Array.isArray(spec.items) ? spec.items : []
  if (rawItems.length === 0) return { ok: false, error: 'items must be a non-empty array' }

  const warnings: string[] = []
  const seen = new Set<string>()
  const items = rawItems.flatMap((r, i) => toItem(r, i, seen) ?? [])
  if (items.length === 0) return { ok: false, error: 'every item needs a label' }
  if (items.length > MAX_ITEMS) {
    warnings.push(`showing the first ${MAX_ITEMS} of ${items.length} items`)
    items.length = MAX_ITEMS
  }
  return { ok: true, title: str(spec.title, 80) ?? 'Plan', why: str(spec.why, 200), items, warnings }
}

/** Ticked by default: low and medium risk, nothing that deletes. The rest you opt into. */
export const defaultTicks = (items: PlanItem[]): string[] =>
  items.filter(i => i.risk !== 'high' && i.action !== 'delete').map(i => i.id)

/** The gate's published flags (looks-good-to-me); the same rule as its `permits` for plan items. */
export type Flags = { plan: { medium: boolean; high: boolean; ship: boolean; delete: boolean } }
export const gatePermitsItem = (flags: Flags | null | undefined, item: PlanItem): boolean =>
  !!flags && flags.plan.medium && (item.risk !== 'high' || flags.plan.high) && (item.action !== 'ship' || flags.plan.ship) && (item.action !== 'delete' || flags.plan.delete)
