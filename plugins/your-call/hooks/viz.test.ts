import { expect, test } from 'claude-code/testing'

import { splitViz, svgFor, textLines } from './viz'

const opts = [
  { id: 'a', label: 'Redis' },
  { id: 'b', label: 'Memory' },
]
const fence = (j: string) => '```viz\n' + j + '\n```'

test('pane bars scale and mark picked', () => {
  const l = textLines({ type: 'bars', values: { a: 8, b: 4 }, max: 8 }, opts, ['a'])
  expect(l[0]).toBe('* Redis  ██████████ 8')
  expect(l[1]).toBe('  Memory █████░░░░░ 4')
})

test('inline bars use labels as keys, no marker column', () => {
  expect(textLines({ type: 'bars', values: { Redis: 8, Mem: 4 }, max: 8 })).toEqual(['Redis ██████████ 8', 'Mem   █████░░░░░ 4'])
})

test('tree and flow', () => {
  expect(textLines({ type: 'tree', nodes: [{ label: 'x', children: [{ label: 'y' }] }, { label: 'z' }] })).toEqual(['├─ x', '│  └─ y', '└─ z'])
  expect(textLines({ type: 'flow', lanes: [['a', 'b', 'c']] })).toEqual(['a ──▶ b ──▶ c'])
})

test('quadrant by id (pane) and by label (inline)', () => {
  const byId = textLines({ type: 'quadrant', x: 'effort', y: 'impact', points: [{ id: 'a', x: 10, y: 10 }] }, opts, ['a'])
  expect(byId[byId.length - 1]).toBe('A=Redis*')
  expect(byId[1].endsWith('A')).toBe(true)
  const byLabel = textLines({ type: 'quadrant', x: 'e', y: 'i', points: [{ label: 'Redis', x: 0, y: 0 }] })
  expect(byLabel[byLabel.length - 1]).toBe('A=Redis')
})

test('splitViz: text, viz, pending, bad json', () => {
  expect(splitViz(`before\n${fence('{"type":"flow","lanes":[["a","b"]]}')}\nafter`).map(x => x.kind)).toEqual(['text', 'viz', 'text'])
  expect(splitViz('hi\n```viz\n{"type":"bars"').map(x => x.kind)).toEqual(['text', 'pending'])
  expect(splitViz(fence('{nope')).map(x => x.kind)).toEqual(['text'])
})

test('svg only for bars and quadrant, escaped', () => {
  expect(svgFor({ type: 'flow', lanes: [] })).toBeUndefined()
  expect(svgFor({ type: 'bars', values: { 'a<b': 1 } })).toContain('a&lt;b')
})
