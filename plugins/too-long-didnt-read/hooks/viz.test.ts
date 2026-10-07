import { expect, test } from 'claude-code/testing'

import { normalizeViz, parseJsonLoose, treeFromSummary } from './viz'

test('normalizeViz keeps good charts, cleans bad ones, rejects nonsense', () => {
  expect(normalizeViz({ type: 'bars', values: { A: 3, B: 'x', C: -1, D: 2 } })).toEqual({ type: 'bars', title: undefined, values: { A: 3, D: 2 } })
  expect(normalizeViz({ type: 'bars', values: { A: 3 } })).toBeUndefined()
  expect(normalizeViz({ type: 'flow', lanes: [['one', 'two'], ['solo'], 'nope'] })).toEqual({ type: 'flow', title: undefined, lanes: [['one', 'two']] })
  expect(normalizeViz({ type: 'flow', lanes: [['only']] })).toBeUndefined()
  expect(normalizeViz({ type: 'tree', nodes: [{ label: 'Verdict: yes' }, { label: 'Why', children: [{ label: 'a' }, {}, 'b'] }] })).toEqual({
    type: 'tree',
    title: undefined,
    nodes: [{ label: 'Verdict: yes' }, { label: 'Why', children: [{ label: 'a' }, { label: 'b' }] }],
  })
  expect(normalizeViz({ type: 'pie' })).toBeUndefined()
  expect(normalizeViz('x')).toBeUndefined()
  expect(normalizeViz({ type: 'tree', nodes: [] })).toBeUndefined()
})

test('labels are clipped so a chart line stays inside the pane', () => {
  const v = normalizeViz({ type: 'tree', nodes: [{ label: 'x'.repeat(80) }] })
  expect(v && v.type === 'tree' && v.nodes[0].label.length).toBeLessThanOrEqual(36)
})

test('lists are capped at 6 items', () => {
  const v = normalizeViz({ type: 'flow', lanes: [Array.from({ length: 10 }, (_, i) => `s${i}`)] })
  expect(v && v.type === 'flow' && v.lanes[0]).toHaveLength(6)
})

test('parseJsonLoose finds the JSON in a fenced or chatty reply', () => {
  expect(parseJsonLoose('```json\n{"type":"tree"}\n```')).toEqual({ type: 'tree' })
  expect(parseJsonLoose('Here you go: {"a":1} hope that helps')).toEqual({ a: 1 })
  expect(parseJsonLoose('no json here')).toBeUndefined()
  expect(parseJsonLoose('{broken')).toBeUndefined()
})

test('treeFromSummary builds Verdict / Why / Next from three plain lines', () => {
  expect(treeFromSummary('1. Use Redis\n- shared and TTLs\n* run the migration')).toEqual({
    type: 'tree',
    title: 'TL;DR',
    nodes: [{ label: 'Verdict: Use Redis' }, { label: 'Why: shared and TTLs' }, { label: 'Next: run the migration' }],
  })
  expect(treeFromSummary('Verdict: ship it')?.type).toBe('tree')
  expect(treeFromSummary('')).toBeUndefined()
})
