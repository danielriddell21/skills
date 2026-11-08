import { expect, test } from 'claude-code/testing'

import type { Component } from '../types'

import { diffPanel, zoomTo } from './graphs'
import { normalize, timeOf } from './spec'
import { paletteFor, svgFor } from './svg'
import { textLines } from './text'

const N = (ids: string[]) => ids.map(id => ({ id, label: id.toUpperCase() }))
const SPECS: Record<string, object> = {
  compare: { type: 'compare', panels: [{ label: 'Today', nodes: ['a', 'b', 'c'], edges: [['a', 'b'], ['b', 'c']] }, { label: 'After', nodes: ['a', 'b', 'd'], edges: [['a', 'b'], ['b', 'd']] }] },
  storyboard: { type: 'storyboard', nodes: ['a', 'b'], edges: [['a', 'b']], frames: [{ focus: ['a'], text: 'one' }, { focus: ['b'], text: 'two' }] },
  swimlane: { type: 'swimlane', steps: [['Dev', 'open PR'], ['CI', 'test'], ['Dev', 'merge']] },
  timeline: { type: 'timeline', items: [{ label: 'deploy', start: '09:02' }, { label: 'errors', start: '09:05', end: '09:40', hot: true }] },
  matrix: { type: 'matrix', rows: ['a', 'b'], cols: ['a', 'b'], values: [[0, 3], [1, 0]] },
  sankey: { type: 'sankey', links: [['in', 'x', 3], ['in', 'y', 1]] },
  radar: { type: 'radar', axes: ['speed', 'cost', 'ops'], series: { A: [8, 4, 6], B: [5, 9, 3] } },
  treemap: { type: 'treemap', values: { 'src/a.ts': 300, 'src/b.ts': 100, 'lib/c.ts': 50 }, hot: ['src/a.ts'] },
  replay: { type: 'sequence', animate: true, steps: [['C', 'S', 'get'], ['S', 'C', 'ok']] },
  heat: { type: 'graph', heatLabel: 'churn', nodes: [{ id: 'a', label: 'A', heat: 0.9 }, { id: 'b', label: 'B', heat: 2 }], edges: [['a', 'b']] },
}

test('every new kind normalizes, draws well-formed SVG, and has a terminal form', () => {
  for (const [name, spec] of Object.entries(SPECS)) {
    const c = normalize(spec)
    expect(c === undefined ? name : 'ok').toBe('ok')
    const s = svgFor(c as Component) ?? ''
    expect(s.startsWith('<svg') ? 'ok' : name).toBe('ok')
    for (const tag of s.match(/<[a-z][^>]*>/g) ?? []) {
      const names = [...tag.matchAll(/\s([\w-]+)=/g)].map(m => m[1])
      expect(new Set(names).size).toBe(names.length)
    }
    expect(textLines(c as Component).length > 0 ? 'ok' : name).toBe('ok')
  }
})

test('heat is clamped to 0-1; the replay animates with SMIL and a replay control', () => {
  const g = normalize(SPECS.heat)
  expect(g?.type === 'graph' && g.nodes.map(n => n.heat)).toEqual([0.9, 1])
  const s = svgFor(normalize(SPECS.replay) as Component) ?? ''
  expect(s).toContain('<animate')
  expect(s).toContain('replay.click')
})

test('compare: a later panel is marked against the first', () => {
  const c = normalize(SPECS.compare)
  if (c?.type !== 'compare') throw new Error('not compare')
  const d = diffPanel(c.panels[0]!, c.panels[1]!)
  expect(d.nodes.filter(n => n.change).map(n => `${n.change}:${n.id}`)).toEqual(['added:d', 'removed:c'])
  expect(d.edges.filter(e => e.change).map(e => `${e.change}:${e.from}>${e.to}`)).toEqual(['added:b>d', 'removed:b>c'])
  expect(textLines(c)).toContain('  + d')
  expect(textLines(c)).toContain('  − b ─▶ c')
})

test('zoom: a path opens parts in turn; a bad path stops where it can', () => {
  const g = { nodes: [...N(['web']), { id: 'core', label: 'Core', inside: { nodes: [...N(['http']), { id: 'orders', label: 'Orders', inside: { nodes: N(['svc', 'repo']), edges: [{ from: 'svc', to: 'repo' }] } }], edges: [{ from: 'http', to: 'orders' }] } }], edges: [{ from: 'web', to: 'core' }] }
  expect(zoomTo(g, 'core/orders').trail).toEqual(['Core', 'Orders'])
  expect(zoomTo(g, 'core/nope').path).toBe('core')
  expect(textLines({ type: 'graph', ...g }, -1, '')).toContain('Core ⊕')
})

test('times: numbers, clock times and dates, one clock per timeline', () => {
  expect(timeOf('09:30')).toEqual({ v: 34200, clock: 'time' })
  expect(timeOf(5)).toEqual({ v: 5, clock: 'num' })
  expect(timeOf('2026-03-14')?.clock).toBe('date')
  expect(normalize({ type: 'timeline', items: [{ label: 'a', start: 1 }, { label: 'b', start: '09:00' }] })).toBeUndefined()
})

test('palette: the Claude theme picks colours; colour-blind themes never put green against red; unknown follows the OS', () => {
  expect(paletteFor('dark')?.text).toBe('#ececec')
  expect(paletteFor('light-daltonized')?.add).toBe('#0066cc')
  expect(paletteFor('auto')).toBeUndefined()
  const g = normalize({ type: 'graph', nodes: ['a', 'b'], edges: [['a', 'b']] }) as Component
  expect(svgFor(g, -1, '', paletteFor('dark'))).not.toContain('prefers-color-scheme')
  expect(svgFor(g)).toContain('prefers-color-scheme:dark')
})
