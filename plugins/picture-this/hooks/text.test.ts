import { expect, test } from 'claude-code/testing'

import type { Component } from '../types'

import { columns, cyclic, layers } from './layout'
import { svgFor, wrap } from './svg'
import { summaryOf, textLines } from './text'

const G: Component = {
  type: 'graph',
  nodes: [{ id: 'a', label: 'API', hot: true }, { id: 'b', label: 'DB' }, { id: 'c', label: 'Cache' }, { id: 'd', label: 'Cron' }],
  edges: [{ from: 'a', to: 'b', label: 'reads' }, { from: 'a', to: 'c' }],
}

test('text forms', () => {
  expect(textLines({ type: 'bars', values: { Redis: 8, Mem: 4 }, unit: 'ms' })[0]).toMatch(/^Redis █+░* 8 ms$/)
  expect(textLines({ type: 'flow', lanes: [['a', 'b']] })).toEqual(['a ──▶ b'])
  expect(textLines(G)).toEqual(['● API ─▶ DB (reads), Cache', 'Cron (alone)'])
  expect(textLines({ type: 'sequence', actors: ['C', 'S'], steps: [{ from: 'C', to: 'S', label: 'get' }, { from: 'S', to: 'S' }] })).toEqual(['C  ·  S', '1. C → S: get', '2. S ↻ S'])
  expect(textLines({ type: 'scatter', x: 'e', y: 'i', points: [{ label: 'A', x: 2, y: 8 }], quadrant: true }).some(l => l.includes('A'))).toBe(true)
  expect(summaryOf(G)).toBe('4 parts, 2 links')
})

test('cycles are marked in text and found by layout', () => {
  const ring: Component = { type: 'graph', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }] }
  expect(textLines(ring).join('\n')).toContain('↺')
  expect([...cyclic(['a', 'b', 'c'], [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }])]).toEqual([])
})

test('svg for every kind but tree; themed, labels escaped, long labels wrap instead of cut', () => {
  const kinds: Component[] = [
    { type: 'bars', values: { '<b>': 1 } },
    { type: 'scatter', x: 'x', y: 'y', points: [{ label: 'A', x: 1, y: 1 }] },
    G,
    { type: 'flow', lanes: [['a', 'b', 'c']] },
    { type: 'sequence', actors: ['A', 'B'], steps: [{ from: 'A', to: 'B', label: 'hi' }, { from: 'B', to: 'B' }, { from: 'B', to: 'A' }] },
  ]
  for (const k of kinds) {
    const s = svgFor(k) ?? ''
    expect(s.startsWith('<svg')).toBe(true)
    // A repeated attribute makes the whole picture fail to load.
    for (const tag of s.match(/<[a-z][^>]*>/g) ?? []) {
      const names = [...tag.matchAll(/\s([\w-]+)=/g)].map(m => m[1])
      expect(new Set(names).size).toBe(names.length)
    }
    expect(s).toContain('prefers-color-scheme:dark')
  }
  expect(svgFor(kinds[0] as Component)).toContain('&lt;b&gt;')
  expect(svgFor(G)).toContain('class="hot"')
  expect(svgFor({ type: 'tree', nodes: [{ label: 'x' }] })).toBeUndefined()
  expect(wrap('Authentication service gateway')).toEqual(['Authentication', 'service gateway'])
  expect(svgFor({ type: 'graph', nodes: [{ id: 'a', label: 'Authentication service gateway' }, { id: 'b', label: 'B' }], edges: [{ from: 'a', to: 'b' }] })).toContain('service gateway')
})

test('graph layers follow edges, survive cycles; columns order by parents', () => {
  const d = layers(['a', 'b', 'c'], [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }])
  expect([...d.values()].every(n => n < 3)).toBe(true)
  expect(layers(['a', 'b'], [{ from: 'a', to: 'b' }]).get('b')).toBe(1)
  // x feeds q, y feeds p: column two follows the order of its parents.
  expect(columns(['x', 'y', 'p', 'q'], [{ from: 'x', to: 'q' }, { from: 'y', to: 'p' }])).toEqual([['x', 'y'], ['q', 'p']])
})
