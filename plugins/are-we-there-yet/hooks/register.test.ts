import { expect, test } from 'claude-code/testing'

import { nextWarning, stepsFor } from './register'

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
