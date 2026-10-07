import { expect, test } from 'claude-code/testing'

import { clampWeight, dependents, isVisible, nextVisible, prevVisible, resetDependents, visibleIdx, weightOf, weightedTotals } from './flow'

const o = (...ids: string[]) => ids.map(id => ({ id, label: id }))
const steps = [
  { id: 'cache', question: 'q', kind: 'one', options: o('redis', 'mem') },
  { id: 'ttl', question: 'q', kind: 'one', options: o('short', 'long'), showIf: { step: 'cache', picked: ['redis'] } },
  { id: 'evict', question: 'q', kind: 'one', options: o('lru', 'lfu'), showIf: { step: 'ttl', picked: ['long'] } },
  { id: 'obs', question: 'q', kind: 'many', options: o('metrics', 'traces'), showIf: { step: 'cache', notPicked: ['mem'] } },
  { id: 'end', question: 'q', kind: 'rank', options: o('a', 'b') },
] as never[] as Parameters<typeof visibleIdx>[0]

test('visibility follows picked / notPicked', () => {
  expect(visibleIdx(steps, {})).toEqual([0, 3, 4])
  expect(visibleIdx(steps, { cache: ['redis'] })).toEqual([0, 1, 3, 4])
  expect(visibleIdx(steps, { cache: ['mem'] })).toEqual([0, 4])
  expect(visibleIdx(steps, { cache: ['redis'], ttl: ['long'] })).toEqual([0, 1, 2, 3, 4])
  expect(isVisible(steps[1], { cache: [] })).toBe(false)
})

test('next and previous skip hidden steps', () => {
  const p = { cache: ['mem'] }
  expect(nextVisible(steps, p, 0)).toBe(4)
  expect(prevVisible(steps, p, 4)).toBe(0)
  expect(nextVisible(steps, p, 4)).toBeUndefined()
  expect(prevVisible(steps, p, 0)).toBeUndefined()
})

test('dependents are transitive', () => {
  expect([...dependents(steps, 'cache')].sort()).toEqual(['evict', 'obs', 'ttl'])
  expect([...dependents(steps, 'ttl')]).toEqual(['evict'])
  expect(dependents(steps, 'end').size).toBe(0)
})

test('changing an answer resets what depended on it, and their notes', () => {
  const picks = { cache: ['redis'], ttl: ['long'], evict: ['lru'], obs: ['metrics'], end: ['b', 'a'] }
  const notes = { 'ttl:long': 'n1', 'evict:lru': 'n2', 'cache:redis': 'keep' }
  const r = resetDependents(steps, { ...picks, cache: ['mem'] }, notes, 'cache')
  expect(r.picks.ttl).toEqual([])
  expect(r.picks.evict).toEqual([])
  expect(r.picks.obs).toEqual([])
  expect(r.picks.end).toEqual(['b', 'a'])
  expect(r.picks.cache).toEqual(['mem'])
  expect(r.notes).toEqual({ 'cache:redis': 'keep' })
  expect(resetDependents(steps, picks, notes, 'end').picks).toBe(picks)
})

const cmp = {
  id: 'c',
  question: 'q',
  kind: 'compare',
  options: o('a', 'b'),
  criteria: [
    { name: 'cost', scores: { a: 5, b: 2 } },
    { name: 'speed', scores: { a: 1, b: 5 }, weight: 8 },
  ],
} as never as Parameters<typeof weightedTotals>[0]

test('weights: default 5, Claude weight, live override, clamp', () => {
  expect(weightOf('c', cmp.criteria![0], {})).toBe(5)
  expect(weightOf('c', cmp.criteria![1], {})).toBe(8)
  expect(weightOf('c', cmp.criteria![1], { 'c:speed': 2 })).toBe(2)
  expect([clampWeight(-3), clampWeight(14), clampWeight(4.6)]).toEqual([0, 10, 5])
})

test('weighted totals pick a leader that moves with the weights', () => {
  const t = weightedTotals(cmp, {})
  expect(t.totals).toEqual({ a: 5 * 5 + 1 * 8, b: 2 * 5 + 5 * 8 })
  expect(t.leader).toBe('b')
  expect(weightedTotals(cmp, { 'c:speed': 0 }).leader).toBe('a')
  expect(weightedTotals(cmp, { 'c:speed': 0, 'c:cost': 0 }).leader).toBeNull()
})

test('a tie has no leader', () => {
  const tie = { ...cmp, criteria: [{ name: 'x', scores: { a: 3, b: 3 } }] } as typeof cmp
  expect(weightedTotals(tie, {}).leader).toBeNull()
})

import { OTHER, initialPicks, lastKey } from './flow'

test('initialPicks preselects recommended, rank keeps order', () => {
  const st = [
    { id: 'a', question: 'q', kind: 'one', options: [{ id: 'x', label: 'x' }, { id: 'y', label: 'y', recommended: true }] },
    { id: 'b', question: 'q', kind: 'many', options: [{ id: 'x', label: 'x', recommended: true }, { id: 'y', label: 'y', recommended: true }] },
    { id: 'c', question: 'q', kind: 'rank', options: [{ id: 'p', label: 'p' }, { id: 'q', label: 'q' }] },
    { id: 'd', question: 'q', kind: 'one', options: [{ id: 'x', label: 'x' }, { id: 'y', label: 'y' }] },
  ] as never as Parameters<typeof initialPicks>[0]
  expect(initialPicks(st)).toEqual({ a: ['y'], b: ['x', 'y'], c: ['p', 'q'], d: [] })
  expect(OTHER).toBe('__other')
  expect(lastKey('Which cache?  (prod)')).toBe('which cache prod')
})

import { redoOf, recommendedFor, resumeFrom, snapOf, toggleVeto, undoOf, withUndo } from './flow'

const blank = (o: object = {}) =>
  ({ title: 't', steps: [], idx: 0, picks: { a: ['x'] }, notes: {}, phase: 'step', regen: '', weights: {}, fromReview: false, others: {}, last: {}, vetoed: {}, confidence: {}, undo: [], redo: [], showAll: {}, ...o }) as never as Parameters<typeof snapOf>[0]

test('undo and redo walk back and forth; a new change clears redo', () => {
  const v0 = blank()
  const v1 = withUndo(v0, { ...v0, picks: { a: ['y'] } })
  const v2 = withUndo(v1, { ...v1, picks: { a: ['z'] } })
  expect(v2.picks.a).toEqual(['z'])
  const u1 = undoOf(v2)
  expect(u1.picks.a).toEqual(['y'])
  const u0 = undoOf(u1)
  expect(u0.picks.a).toEqual(['x'])
  expect(undoOf(u0)).toBe(u0)
  expect(redoOf(u0).picks.a).toEqual(['y'])
  const branched = withUndo(u1, { ...u1, picks: { a: ['w'] } })
  expect(branched.redo).toEqual([])
})

test('undo history is capped', () => {
  let v = blank()
  for (let i = 0; i < 30; i++) v = withUndo(v, { ...v, idx: i })
  expect(v.undo).toHaveLength(20)
})

test('veto removes the option from the picks and can be restored', () => {
  const v = toggleVeto(blank({ picks: { a: ['x', 'y'] } }), 'a', 'x')
  expect(v.vetoed.a).toEqual(['x'])
  expect(v.picks.a).toEqual(['y'])
  const back = toggleVeto(v, 'a', 'x')
  expect(back.vetoed.a).toEqual([])
})

test('resumeFrom keeps only what still matches the new steps', () => {
  const st = [{ id: 'a', question: 'q', kind: 'one', options: [{ id: 'x', label: 'x' }, { id: 'y', label: 'y' }] }] as never as Parameters<typeof resumeFrom>[1]
  const r = resumeFrom({
    picks: { a: ['x', 'gone'], zzz: ['x'] },
    vetoed: { a: ['y', 'nope'] },
    notes: { 'a:x': 'hi', 'zzz:x': 'bye' },
    weights: { 'a:cost': 99 },
    confidence: { a: 'high', zzz: 'low' },
    others: { a: 'mine' },
  }, st)
  expect(r.picks).toEqual({ a: ['x'] })
  expect(r.vetoed).toEqual({ a: ['y'] })
  expect(r.notes).toEqual({ 'a:x': 'hi' })
  expect(r.weights).toEqual({ 'a:cost': 10 })
  expect(r.confidence).toEqual({ a: 'high' })
  expect(r.others).toEqual({ a: 'mine' })
  expect(resumeFrom('junk', st)).toEqual({})
})

test('recommendedFor needs a recommendation on every visible non-rank step', () => {
  const mk = (rec: boolean) => [{ id: 'a', question: 'q', kind: 'one', options: [{ id: 'x', label: 'x', recommended: rec || undefined }, { id: 'y', label: 'y' }] }] as never as Parameters<typeof recommendedFor>[0]
  expect(recommendedFor(mk(true))).toEqual({ a: ['x'] })
  expect(recommendedFor(mk(false))).toBeUndefined()
})
