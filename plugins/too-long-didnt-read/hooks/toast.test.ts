import { expect, test } from 'claude-code/testing'

import { toastFrom } from './register'
import { TOAST_COLS, TOAST_LINES, clip, colWidth, fitToast, wrapCount } from './toast'

const fits = (t: string) => wrapCount(t) <= TOAST_LINES && t.split('\n').every(l => colWidth(l) <= TOAST_COLS)

test('limits are the engine\'s: 40 columns, 3 lines', () => {
  expect([TOAST_COLS, TOAST_LINES]).toEqual([40, 3])
})

test('colWidth counts wide characters as two columns', () => {
  expect([colWidth('abc'), colWidth('日本'), colWidth('ok ✓')]).toEqual([3, 4, 4])
})

test('clip cuts to the width with an ellipsis, leaves short lines alone', () => {
  expect(clip('short')).toBe('short')
  const c = clip('x'.repeat(60))
  expect(colWidth(c)).toBeLessThanOrEqual(40)
  expect(c.endsWith('…')).toBe(true)
  expect(colWidth(clip('日'.repeat(30)))).toBeLessThanOrEqual(40)
})

test('fitToast: normalizes whitespace, caps lines, always fits', () => {
  expect(fitToast('  a   b  \n\n  c  ')).toBe('a b\nc')
  const long = ['one '.repeat(30), 'two '.repeat(30), 'three', 'four', 'five'].join('\n')
  const f = fitToast(long)
  expect(f.split('\n')).toHaveLength(3)
  expect(fits(f)).toBe(true)
  expect(f.endsWith('…')).toBe(true)
})

test('wrapCount mirrors the engine: newlines then word wrap at 40', () => {
  expect(wrapCount('short')).toBe(1)
  expect(wrapCount('a\nb\nc')).toBe(3)
  expect(wrapCount('word '.repeat(20).trim())).toBe(3)
  expect(wrapCount('x'.repeat(100))).toBe(3)
})

test('toastFrom: summary becomes a toast that fits, verdict first with the TL;DR prefix', () => {
  const t = toastFrom('1. Use Redis\n- shared across instances and TTL friendly\n* run the migration and redeploy it today please')
  expect(t.split('\n')[0]).toBe('TL;DR Use Redis')
  expect(fits(t)).toBe(true)
  const rambling = toastFrom('x'.repeat(200) + '\n' + 'y'.repeat(200) + '\n' + 'z'.repeat(200) + '\nextra line')
  expect(fits(rambling)).toBe(true)
  expect(toastFrom('')).toBe('')
})
