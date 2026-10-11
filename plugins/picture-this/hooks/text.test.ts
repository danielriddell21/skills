import { expect, test } from 'claude-code/testing'

import type { Component } from '../types'

import { layers, svgFor } from './svg'
import { spark, tableLines, textLines } from './text'

test('text forms of each static component', () => {
  expect(textLines({ type: 'bars', values: { Redis: 8, Mem: 4 }, unit: 'ms' })[0]).toMatch(/^Redis █+░* 8 ms$/)
  expect(textLines({ type: 'pie', values: { a: 3, b: 1 } })[0]).toMatch(/75%$/)
  expect(textLines({ type: 'line', x: ['Jan', 'Mar'], series: { Rev: [1, 3] } })[0]).toContain('1 → 3')
  expect(textLines({ type: 'flow', lanes: [['a', 'b']] })).toEqual(['a ──▶ b'])
  expect(textLines({ type: 'graph', nodes: [{ id: 'a', label: 'API' }, { id: 'b', label: 'DB' }, { id: 'c', label: 'Cache' }], edges: [{ from: 'a', to: 'b', label: 'reads' }] })).toEqual(['API ── reads ▶ DB', 'Cache (alone)'])
  expect(textLines({ type: 'map', stops: [{ label: 'Cork', note: 'day 1' }, { label: 'Kerry' }] })).toEqual(['(1) Cork ──▶ (2) Kerry', '  1. day 1', '  (schematic: no coordinates)'])
  expect(textLines({ type: 'scatter', x: 'e', y: 'i', points: [{ label: 'A', x: 2, y: 8 }], quadrant: true }).some(l => l.includes('A'))).toBe(true)
  expect(spark([1, 2, 3])).toBe('▁▅█')
})

test('tables sort by a column: numbers as numbers, with an arrow on the header', () => {
  const lines = tableLines(['Name', 'Score'], [['a', 10], ['b', 9], ['c', 100]], { col: 1, desc: true })
  expect(lines[0]).toContain('Score ↓')
  expect(lines.slice(2).map(l => l.trim()[0])).toEqual(['c', 'a', 'b'])
})

test('svg for charts, diagrams and maps; text-only kinds give none; labels are escaped', () => {
  const kinds: Component[] = [
    { type: 'bars', values: { '<b>': 1 } },
    { type: 'line', x: ['a', 'b'], series: { s: [1, 2], t: [2, 1] } },
    { type: 'scatter', x: 'x', y: 'y', points: [{ label: 'A', x: 1, y: 1 }] },
    { type: 'pie', values: { a: 1, b: 2 } },
    { type: 'graph', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ from: 'a', to: 'b' }] },
    { type: 'flow', lanes: [['a', 'b', 'c']] },
    { type: 'map', stops: [{ label: 'X', lat: 1, lon: 1 }, { label: 'Y', lat: 2, lon: 3 }] },
  ]
  for (const k of kinds) expect(svgFor(k)?.startsWith('<svg')).toBe(true)
  expect(svgFor(kinds[0] as Component)).toContain('&lt;b&gt;')
  expect(svgFor({ type: 'tree', nodes: [{ label: 'x' }] })).toBeUndefined()
  expect(svgFor({ type: 'card', title: 't' })).toBeUndefined()
})

test('graph layers follow edges and survive cycles', () => {
  const d = layers(['a', 'b', 'c'], [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }])
  expect([...d.values()].every(n => n < 3)).toBe(true)
  expect(layers(['a', 'b'], [{ from: 'a', to: 'b' }]).get('b')).toBe(1)
})
