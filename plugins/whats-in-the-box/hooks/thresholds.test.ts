import { expect, test } from 'claude-code/testing'

import { nextWarning, showCompact, stepsFor } from './register'

test('warns once per level, escalates, resets below 40', () => {
  expect(nextWarning(30, 0)).toEqual({ warned: 0 })
  expect(nextWarning(55, 0).warned).toBe(50)
  expect(nextWarning(58, 50)).toEqual({ warned: 50 })
  expect(nextWarning(72, 50).text).toContain('70%')
  expect(nextWarning(90, 70).text).toContain('85%')
  expect(nextWarning(20, 85)).toEqual({ warned: 0 })
  expect(nextWarning(60, nextWarning(20, 85).warned).warned).toBe(50)
})

test('custom thresholds', () => {
  const s = stepsFor(30, 60, 90)
  expect(nextWarning(35, 0, s).warned).toBe(30)
  expect(nextWarning(65, 30, s).text).toContain('60%')
  expect(nextWarning(95, 60, s).text).toContain('90%')
  expect(nextWarning(10, 90, s)).toEqual({ warned: 0 })
})

test('compact button only from the urgent level', () => {
  expect(showCompact(84, 85)).toBe(false)
  expect(showCompact(85, 85)).toBe(true)
})

// Same rule as the engine's toast box: word wrap at 40 columns, at most 3 lines.
const wrapCount = (text: string, cols = 40): number =>
  text.split('\n').reduce((n, line) => {
    let rows = 1
    let w = 0
    for (const word of line.split(' ')) {
      if (w === 0) w = word.length
      else if (w + 1 + word.length <= cols) w += 1 + word.length
      else {
        rows += 1
        w = word.length
      }
    }
    return n + rows
  }, 0)

test('every toast, at any threshold, fits the 40-column, 3-line box', () => {
  for (let n = 1; n <= 100; n++) {
    for (const [, text] of stepsFor(n, Math.min(100, n + 1), Math.min(100, n + 2))) {
      expect([text, wrapCount(text) <= 3 && text.length <= 40]).toEqual([text, true])
    }
  }
})
