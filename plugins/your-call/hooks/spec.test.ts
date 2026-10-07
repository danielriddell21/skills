import { expect, test } from 'claude-code/testing'

import { MAX_OPTIONS, expandShorthand, normalizeSpec } from './spec'

const ok = (r: ReturnType<typeof normalizeSpec>) => {
  if (!r.ok) throw new Error(r.error)
  return r
}

test('rejects garbage with a message the model can act on', () => {
  expect(normalizeSpec(undefined)).toEqual({ ok: false, error: 'steps must be a non-empty array' })
  expect(normalizeSpec({ steps: 'x' })).toEqual({ ok: false, error: 'steps must be a non-empty array' })
  expect(normalizeSpec({ steps: [{ id: 'a', options: [{ label: 'only' }] }] })).toEqual({ ok: false, error: 'step "a" needs at least 2 options' })
})

test('fills ids, kind, title; accepts plain string options', () => {
  const r = ok(normalizeSpec({ steps: [{ question: 'Pick', options: ['Redis', 'In memory'] }] }))
  expect(r.title).toBe('Decision')
  expect(r.steps[0].id).toBe('s1')
  expect(r.steps[0].kind).toBe('one')
  expect(r.steps[0].options.map(o => o.id)).toEqual(['redis', 'in-memory'])
})

test('dedupes option and step ids, drops empty options', () => {
  const r = ok(normalizeSpec({ steps: [
    { id: 'a', options: [{ id: 'x', label: 'One' }, { id: 'x', label: 'Two' }, {}, null] },
    { id: 'a', options: ['A', 'B'] },
  ] }))
  expect(r.steps[0].options.map(o => o.id)).toEqual(['x', 'x-2'])
  expect(r.steps.map(s => s.id)).toEqual(['a', 'a-2'])
})

test('unknown kind falls back to one; long lists are capped with a warning', () => {
  const many = Array.from({ length: 14 }, (_, i) => `Option ${i}`)
  const r = ok(normalizeSpec({ steps: [{ kind: 'nonsense', options: many }] }))
  expect(r.steps[0].kind).toBe('one')
  expect(r.steps[0].options).toHaveLength(MAX_OPTIONS)
  expect(r.warnings[0]).toContain('first 12 of 14')
})

test('sanitizes criteria, pros/cons and viz', () => {
  const r = ok(normalizeSpec({ steps: [{ options: ['A', 'B'], criteria: [{ name: 'cost', scores: { a: 3, b: 'x' } }, { name: 5 }], viz: { type: 'bars', values: {} } }] }))
  expect(r.steps[0].criteria).toEqual([{ name: 'cost', scores: { a: 3 } }])
  expect(r.steps[0].viz?.type).toBe('bars')
  const p = ok(normalizeSpec({ steps: [{ options: [{ label: 'A', pros: ['fast', 3, ''] }, 'B'] }] }))
  expect(p.steps[0].options[0].pros).toEqual(['fast'])
})

test('showIf must name an earlier step; weights are clamped', () => {
  const r = ok(normalizeSpec({ steps: [
    { id: 'a', options: ['A', 'B'], showIf: { step: 'zzz', picked: ['A'] } },
    { id: 'b', options: ['A', 'B'], showIf: { step: 'a', picked: ['a'] }, criteria: [{ name: 'c', scores: { a: 1 }, weight: 99 }] },
    { id: 'c', options: ['A', 'B'], showIf: { step: 'b' } },
  ] }))
  expect(r.steps[0].showIf).toBeUndefined()
  expect(r.steps[1].showIf).toEqual({ step: 'a', picked: ['a'], notPicked: undefined })
  expect(r.steps[1].criteria?.[0].weight).toBe(10)
  expect(r.steps[2].showIf).toBeUndefined()
  expect(r.warnings.join(' ')).toContain('earlier step')
  expect(r.warnings.join(' ')).toContain('picked or notPicked')
})

test('recommended: one wins for single-pick, many keeps all; why, audience, measured pass through', () => {
  const r = ok(normalizeSpec({ steps: [
    { options: [{ label: 'A', recommended: true }, { label: 'B', recommended: true }], why: ' cheapest ', measured: true, audience: { votes: { a: 3, zzz: 2, b: 'x' } } },
    { kind: 'many', options: [{ label: 'A', recommended: true }, { label: 'B', recommended: true }] },
  ] }))
  expect(r.steps[0].options.map(o => !!o.recommended)).toEqual([true, false])
  expect(r.steps[0].why).toBe('cheapest')
  expect(r.steps[0].measured).toBe(true)
  expect(r.steps[0].audience).toEqual({ votes: { a: 3 } })
  expect(r.steps[1].options.map(o => !!o.recommended)).toEqual([true, true])
  expect(r.warnings.join(' ')).toContain('only one option can be recommended')
})

test('recommended options move to the top (not for rank)', () => {
  const r = ok(normalizeSpec({ steps: [
    { options: ['A', 'B', { label: 'C', recommended: true }] },
    { kind: 'many', options: ['A', { label: 'B', recommended: true }, { label: 'C', recommended: true }] },
    { kind: 'rank', options: ['A', { label: 'B', recommended: true }] },
  ] }))
  expect(r.steps[0].options.map(o => o.label)).toEqual(['C', 'A', 'B'])
  expect(r.steps[1].options.map(o => o.label)).toEqual(['B', 'C', 'A'])
  expect(r.steps[2].options.map(o => o.label)).toEqual(['A', 'B'])
})

test('shorthand: question + options, yes/no, recommended, multi', () => {
  const a = ok(normalizeSpec({ question: 'Cache?', options: ['Redis', 'Memory'], recommended: 'memory', why: 'cheap' }))
  expect(a.steps).toHaveLength(1)
  expect(a.steps[0].question).toBe('Cache?')
  expect(a.steps[0].options.map(o => o.label)).toEqual(['Memory', 'Redis'])
  expect(a.steps[0].options[0].recommended).toBe(true)
  expect(a.steps[0].why).toBe('cheap')
  const y = ok(normalizeSpec({ question: 'Run the migration?', yesno: true, recommended: 'no' }))
  expect(y.steps[0].options.map(o => o.id)).toEqual(['no', 'yes'])
  expect(y.steps[0].options[0].recommended).toBe(true)
  const m = ok(normalizeSpec({ question: 'Extras?', options: ['A', 'B'], multi: true }))
  expect(m.steps[0].kind).toBe('many')
})

test('shorthand is ignored when steps are given, and needs options or yesno', () => {
  const raw = { question: 'x', steps: [{ options: ['A', 'B'] }] }
  expect(expandShorthand(raw)).toBe(raw)
  expect(normalizeSpec({ question: 'Cache?' })).toEqual({ ok: false, error: 'step "q" needs at least 2 options' })
})
