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

test('prompt.submit attaches the hint for the classified label', async ($, on) => {
  let ctx: readonly string[] | undefined
  on('model.classify', () => ({ value: 'destructive-or-ambiguous' }) as never)
  on('prompt.submit', (_: unknown, e: { text: string; context?: readonly string[] }) => {
    ctx = e.context
    return { text: e.text }
  })
  await $.prompt.submit({ text: 'clean up the old branches in this repository please' } as never)
  expect((ctx ?? []).join('\n')).toContain('ask-dont-guess')
})

test('short prompts and slash commands get no hint', async ($, on) => {
  let ctx: readonly string[] | undefined = ['unset']
  on('model.classify', () => ({ value: 'search' }) as never)
  on('prompt.submit', (_: unknown, e: { text: string; context?: readonly string[] }) => {
    ctx = e.context
    return { text: e.text }
  })
  await $.prompt.submit({ text: 'fix typo' } as never)
  expect(ctx).toBeUndefined()
})
