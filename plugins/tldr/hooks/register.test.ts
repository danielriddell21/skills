import { expect, test } from 'claude-code/testing'

import { parseMode, wantSummary } from './register'

test('parseMode', () => {
  expect(parseMode('smart')).toBe('smart')
  expect(parseMode('nope')).toBeUndefined()
  expect(parseMode('')).toBeUndefined()
})

test('off never, auto by length, smart by size or tools', () => {
  expect(wantSummary('off', 'x'.repeat(5000), 9)).toBe(false)
  expect(wantSummary('on', 'x'.repeat(5000), 9)).toBe(false)
  expect(wantSummary('auto', 'x'.repeat(399), 0)).toBe(false)
  expect(wantSummary('auto', 'x'.repeat(400), 0)).toBe(true)
  expect(wantSummary('smart', 'short', 0)).toBe(false)
  expect(wantSummary('smart', 'x'.repeat(1200), 0)).toBe(true)
  expect(wantSummary('smart', 'a\n'.repeat(16), 0)).toBe(true)
  expect(wantSummary('smart', 'short', 5)).toBe(true)
})
