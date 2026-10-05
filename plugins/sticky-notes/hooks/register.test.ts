import { expect, test } from 'claude-code/testing'

import { applyTask, renderTasks } from './register'

test('add assigns increasing ids and trims', () => {
  const a = applyTask([], { action: 'add', text: '  one ' })
  const b = applyTask(a, { action: 'add', text: 'two' })
  expect(b.map(t => t.id)).toEqual([1, 2])
  expect(b[0].text).toBe('one')
})

test('empty add and unknown actions change nothing', () => {
  expect(applyTask([], { action: 'add', text: '   ' })).toEqual([])
  expect(applyTask([{ id: 1, text: 'x', isDone: false }], { action: 'list' })).toHaveLength(1)
})

test('done marks only that id', () => {
  const l = applyTask(applyTask(applyTask([], { action: 'add', text: 'a' }), { action: 'add', text: 'b' }), { action: 'done', id: 2 })
  expect(renderTasks(l)).toBe('[ ] 1 a\n[x] 2 b')
  expect(renderTasks([])).toBe('(empty)')
})
