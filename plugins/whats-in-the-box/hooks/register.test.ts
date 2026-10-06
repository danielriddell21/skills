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

import { barCells, fmtTokens } from './register'

test('fmtTokens', () => {
  expect([fmtTokens(950), fmtTokens(1234), fmtTokens(18000)]).toEqual(['950', '1.2k', '18k'])
})

test('barCells: proportional, min 1 cell, never exceeds width', () => {
  const rows = [
    { name: 'Messages', tokens: 600 },
    { name: 'MCP', tokens: 300 },
    { name: 'Tiny', tokens: 1 },
    { name: 'Zero', tokens: 0 },
  ]
  const c = barCells(rows, 1000, 10)
  expect(c.map(x => x.name)).toEqual(['Messages', 'MCP', 'Tiny'])
  expect(c.map(x => x.cells)).toEqual([6, 3, 1])
  expect(c.reduce((n, x) => n + x.cells, 0)).toBeLessThanOrEqual(10)
  expect(barCells([{ name: 'A', tokens: 5000 }], 1000, 10)[0].cells).toBe(10)
  expect(barCells(rows, 0, 10)).toEqual([])
})
