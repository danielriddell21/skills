import { expect, test } from 'claude-code/testing'

import { toSnapshot } from './register'

test('drops free space and sorts by tokens', () => {
  const s = toSnapshot({
    categories: [
      { name: 'Messages', tokens: 10 },
      { name: 'Free space', tokens: 900, kind: 'free' },
      { name: 'MCP tools', tokens: 50 },
    ],
    totalTokens: 60,
    maxTokens: 1000,
    percentage: 6,
  })
  expect(s.rows.map(r => r.name)).toEqual(['MCP tools', 'Messages'])
  expect([s.total, s.max, s.percent]).toEqual([60, 1000, 6])
})
