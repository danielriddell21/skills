import { expect, test } from 'claude-code/testing'

import type { CrewRun } from '../types'

import { chipText, costOf, ctxPct, fmtCost, fmtTime, fmtTokens, memberOf, rowText, rowSvg, shortModel, totals, windowOf } from './crew'

const run = (o: Partial<CrewRun> = {}): CrewRun => ({
  id: 'a',
  type: 'scout',
  description: 'find auth',
  model: 'claude-haiku-4-5',
  status: 'running',
  startedAt: 1000,
  ctxTokens: 20_000,
  ctxMax: 200_000,
  tokens: 30_000,
  costUsd: 0.034,
  steps: 3,
  ...o,
})

test('memberOf: plain, plugin-prefixed and unknown types', () => {
  expect(memberOf('scout').name).toBe('scout')
  expect(memberOf('who-wants-the-job:Sniper').name).toBe('sniper')
  expect(memberOf('Explore').name).toBe('agent')
})

test('costOf uses the model price and discounts cache reads', () => {
  expect(Math.round(costOf('claude-haiku-4-5', { input_tokens: 1_000_000 }) * 1e6) / 1e6).toBe(1)
  expect(Math.round(costOf('claude-opus-4', { output_tokens: 1_000_000 }) * 1e6) / 1e6).toBe(25)
  expect(Math.round(costOf('claude-sonnet-5', { cache_read_input_tokens: 1_000_000 }) * 1e6) / 1e6).toBe(0.3)
  expect(Math.round(costOf('mystery', { input_tokens: 1_000_000 }) * 1e6) / 1e6).toBe(3)
})

test('formatters', () => {
  expect([fmtTokens(950), fmtTokens(1234), fmtTokens(18_000)]).toEqual(['950', '1.2k', '18k'])
  expect([fmtCost(0.004), fmtCost(1.236)]).toEqual(['<$0.01', '$1.24'])
  expect([fmtTime(4000), fmtTime(125_000)]).toEqual(['4s', '2m05s'])
  expect([shortModel('claude-sonnet-5-5'), windowOf('x[1m]'), windowOf('x')]).toEqual(['sonnet', 1_000_000, 200_000])
})

test('rowText shows steps when reported, else context', () => {
  expect(rowText(run(), 6000)).toBe('● Scout · haiku · ctx 10% · $0.03 · 5s')
  expect(rowText(run({ stepDone: 2, stepTotal: 4, stepNote: 'grep' }), 6000)).toContain('███░░░ 2/4')
  expect(rowText(run({ status: 'failed', endedAt: 3000 }), 9000)).toContain('✗ Scout')
  expect(rowText(run({ status: 'done', endedAt: 3000 }), 9000)).toContain('2s')
})

test('ctxPct is capped; totals and chip count running agents', () => {
  expect(ctxPct(run({ ctxTokens: 999_999 }))).toBe(100)
  const list = [run(), run({ id: 'b', status: 'done', endedAt: 2000, costUsd: 0.1 })]
  expect(totals(list, 5000)).toMatchObject({ running: 1, count: 2 })
  expect(chipText(list, 5000)).toBe('♟ crew 1/2 running · ≈$0.13')
  expect(chipText([list[1]], 5000)).toBe('♟ crew 1 done · ≈$0.10')
})

test('rowSvg: crab on the left, label and stats beside it, animated only while running, escaped', () => {
  const running = rowSvg(run({ description: 'find <auth> & more', stepDone: 2, stepTotal: 4 }), 6000)
  expect(running.startsWith('<svg')).toBe(true)
  expect(running).toContain('c-scout run')
  expect(running).toContain('translate(2 4) scale(1.65)')
  expect(running).toContain('find &lt;auth&gt; &amp; more')
  expect(running).toContain('haiku · 2/4 steps · $0.03 · 5s')
  expect(running).toContain('prefers-reduced-motion')
  const done = rowSvg(run({ type: 'sniper', status: 'done', endedAt: 3000 }), 9000)
  expect(done).toContain('c-sniper"')
  expect(done).not.toContain('c-sniper run')
  expect(done).toContain('✓')
  expect(rowSvg(run({ type: 'engineer', status: 'failed' }), 0)).toContain('✗')
  for (const w of ['swing', 'turn', 'peek', 'glint']) expect(running).toContain(w)
  expect(rowSvg(run({ description: 'x'.repeat(100) }), 0)).toContain('…')
})
