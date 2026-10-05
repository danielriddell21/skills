import { expect, test } from 'claude-code/testing'

import { HINT, shouldClassify } from './register'

const long = 'find every place where we parse the config file and list them'

test('classifies only real user prompts of enough length', () => {
  expect(shouldClassify(long, false, false)).toBe(true)
  expect(shouldClassify('fix typo', false, false)).toBe(false)
  expect(shouldClassify(long, true, false)).toBe(false)
  expect(shouldClassify(long, false, true)).toBe(false)
  expect(shouldClassify('/clear ' + long, false, false)).toBe(false)
})

test('every label has a hint pointing at the routing skill or inline', () => {
  for (const k of ['search', 'implement', 'design', 'review', 'trivial']) expect(HINT[k]).toBeTruthy()
})
