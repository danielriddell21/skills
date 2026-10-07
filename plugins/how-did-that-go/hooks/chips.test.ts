import { expect, test } from 'claude-code/testing'

import { CHIPS_KEY, GAP, RANK, arrange, chipKey, injectChips, isEmpty } from './chips'

const chip = (rank: number, name: string) => ({ type: 'Box', props: { key: chipKey(rank, name) }, children: [name] })
const row = (...kids: unknown[]) => ({ type: 'Box', props: { key: CHIPS_KEY, flexWrap: 'wrap' }, children: kids })

test('chip keys sort by rank, not by name or draw order', () => {
  expect(chipKey(RANK.route, 'x') < chipKey(RANK.result, 'a')).toBe(true)
  expect(chipKey(RANK.context, 'z') < chipKey(RANK.route, 'a')).toBe(true)
  const out = arrange([chip(30, 'result'), chip(10, 'ctx'), chip(20, 'route')])
  expect(out).toEqual([chip(10, 'ctx'), GAP, chip(20, 'route'), GAP, chip(30, 'result')])
})

test('joining puts the chip where its rank says, whichever plugin drew first', () => {
  const a = injectChips(row(chip(30, 'result')), chip(20, 'route'))
  expect(a?.children).toEqual([chip(20, 'route'), GAP, chip(30, 'result')])
  const b = injectChips(a, chip(10, 'ctx'))
  expect(b?.children).toEqual([chip(10, 'ctx'), GAP, chip(20, 'route'), GAP, chip(30, 'result')])
  const c = injectChips(row(chip(10, 'ctx')), chip(30, 'result'))
  expect(c?.children).toEqual([chip(10, 'ctx'), GAP, chip(30, 'result')])
})

test('finds the chips row inside a column, last child first, leaving the rest alone', () => {
  const bar = { type: 'Box', props: {}, children: ['bar'] }
  const col = { type: 'Box', props: { flexDirection: 'column' }, children: [bar, row(chip(30, 'b'))] }
  expect(injectChips(col, chip(20, 'a'))).toEqual({ ...col, children: [bar, row(chip(20, 'a'), GAP, chip(30, 'b'))] })
})

test('nothing to join: undefined, so the caller stacks its own row', () => {
  expect(injectChips(undefined, chip(20, 'a'))).toBeUndefined()
  expect(injectChips({ type: 'Box', children: ['x'] }, chip(20, 'a'))).toBeUndefined()
})

test('empty detection', () => {
  expect(isEmpty(undefined)).toBe(true)
  expect(isEmpty({ type: 'Box', children: [] })).toBe(true)
  expect(isEmpty({ type: 'Box', children: ['x'] })).toBe(false)
})
