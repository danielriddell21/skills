import { expect, test } from 'claude-code/testing'

import { evaluate, fmtNum } from './formula'

test('arithmetic, precedence, powers and functions', () => {
  expect(evaluate('1 + 2 * 3', {})).toBe(7)
  expect(evaluate('(1 + 2) * 3', {})).toBe(9)
  expect(evaluate('2 ^ 3 ^ 2', {})).toBe(512)
  expect(evaluate('-2 ^ 2', {})).toBe(-4)
  expect(evaluate('10 % 4', {})).toBe(2)
  expect(evaluate('max(1, rate, 3)', { rate: 7 })).toBe(7)
  expect(evaluate('round(2.345, 2)', {})).toBe(2.35)
  expect(Math.round(evaluate('1000 * (1 + rate / 100) ^ years', { rate: 5, years: 2 }) ?? 0)).toBe(1103)
})

test('anything unsafe or broken is undefined, never NaN', () => {
  expect(evaluate('1 / 0', {})).toBeUndefined()
  expect(evaluate('unknown + 1', {})).toBeUndefined()
  expect(evaluate('constructor', {})).toBeUndefined()
  expect(evaluate('toString(1)', {})).toBeUndefined()
  expect(evaluate('alert("x")', {})).toBeUndefined()
  expect(evaluate('a.b', { a: 1 })).toBeUndefined()
  expect(evaluate('1 +', {})).toBeUndefined()
  expect(evaluate('(1', {})).toBeUndefined()
  expect(evaluate('', {})).toBeUndefined()
  expect(evaluate('sqrt(-1)', {})).toBeUndefined()
})

test('numbers format with grouping and digits', () => {
  expect(fmtNum(1234567)).toBe('1,234,567')
  expect(fmtNum(-1234.5)).toBe('-1,234.50')
  expect(fmtNum(3.14159, 3)).toBe('3.142')
})
