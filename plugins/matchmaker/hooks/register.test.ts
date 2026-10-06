import { expect, test } from 'claude-code/testing'

import { HINT, LABELS, shouldClassify } from './register'

const long = 'find every place where we parse the config file and list them'

test('classifies only real user prompts of enough length', () => {
  expect(shouldClassify(long, false, false)).toBe(true)
  expect(shouldClassify('fix typo', false, false)).toBe(false)
  expect(shouldClassify(long, true, false)).toBe(false)
  expect(shouldClassify(long, false, true)).toBe(false)
  expect(shouldClassify('/clear ' + long, false, false)).toBe(false)
})

test('every label has a hint', () => {
  for (const k of LABELS) expect(HINT[k]).toBeTruthy()
})

test('skill hints name the skill and the confirm tool', () => {
  expect(HINT['destructive-or-ambiguous']).toContain('ask-dont-guess')
  expect(HINT['destructive-or-ambiguous']).toContain('mcp__your-call__ask')
  expect(HINT['compare-or-explain-flow']).toContain('show-dont-tell')
  expect(HINT['second-opinion']).toContain('phone-a-friend')
})

test('minChars option', () => {
  expect(shouldClassify('x'.repeat(20), false, false, 10)).toBe(true)
  expect(shouldClassify('x'.repeat(20), false, false, 30)).toBe(false)
})
