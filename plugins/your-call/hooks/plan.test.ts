import { expect, test } from 'claude-code/testing'

import { MAX_ITEMS, defaultTicks, gatePermitsItem, normalizePlan } from './plan'
import type { PlanItem } from './plan'

const ok = (r: ReturnType<typeof normalizePlan>) => {
  if (!r.ok) throw new Error(r.error)
  return r
}

test('rejects an empty or label-less plan with a clear error', () => {
  expect(normalizePlan(undefined)).toEqual({ ok: false, error: 'items must be a non-empty array' })
  expect(normalizePlan({ items: [{}, null] })).toEqual({ ok: false, error: 'every item needs a label' })
})

test('fills ids, risk and action; accepts plain strings; dedupes ids', () => {
  const r = ok(normalizePlan({ items: ['edit config', { id: 'a', label: 'run tests', risk: 'low', action: 'read' }, { id: 'a', label: 'push', risk: 'bogus', action: 'ship' }] }))
  expect(r.title).toBe('Plan')
  expect(r.items.map(i => [i.id, i.risk, i.action])).toEqual([['i1', 'medium', 'other'], ['a', 'low', 'read'], ['a-3', 'medium', 'ship']])
})

test('a command can stand in for the label; long plans are capped', () => {
  expect(ok(normalizePlan({ items: [{ command: 'rm -rf build' }] })).items[0].label).toBe('rm -rf build')
  const r = ok(normalizePlan({ items: Array.from({ length: 15 }, (_, i) => `step ${i}`) }))
  expect(r.items).toHaveLength(MAX_ITEMS)
  expect(r.warnings[0]).toContain('first 12 of 15')
})

test('ticked by default: low and medium, never high-risk or deletes', () => {
  const items = [
    { id: 'a', label: 'a', risk: 'low', action: 'edit' },
    { id: 'b', label: 'b', risk: 'high', action: 'edit' },
    { id: 'c', label: 'c', risk: 'low', action: 'delete' },
    { id: 'd', label: 'd', risk: 'medium', action: 'ship' },
  ] as PlanItem[]
  expect(defaultTicks(items)).toEqual(['a', 'd'])
})

test('the gate permits an item only when every flag it needs is on', () => {
  const safe = { plan: { medium: true, high: false, ship: false, delete: false } }
  const yolo = { plan: { medium: true, high: true, ship: true, delete: true } }
  const item = (risk: PlanItem['risk'], action: PlanItem['action']) => ({ id: 'x', label: 'x', risk, action }) as PlanItem
  expect(gatePermitsItem(safe, item('low', 'edit'))).toBe(true)
  expect(gatePermitsItem(safe, item('high', 'edit'))).toBe(false)
  expect(gatePermitsItem(safe, item('low', 'ship'))).toBe(false)
  expect(gatePermitsItem(safe, item('low', 'delete'))).toBe(false)
  expect(gatePermitsItem(yolo, item('high', 'delete'))).toBe(true)
  expect(gatePermitsItem(null, item('low', 'read'))).toBe(false)
})
