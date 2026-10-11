import { expect, test } from 'claude-code/testing'

import { normalize, parseBody, splitBlocks } from './spec'

test('JSON Lines: one component per line, bad lines counted as skipped', () => {
  const r = parseBody('{"type":"bars","values":{"A":1,"B":2}}\nnot json\n{"type":"nope"}\n{"type":"stat","label":"p95","value":"120 ms"}\n', false)
  expect(r.components.map(c => c.type)).toEqual(['bars', 'stat'])
  expect(r.skipped).toBe(2)
})

test('a whole JSON object or array also works (older ```viz blocks)', () => {
  expect(parseBody('{\n "type": "flow",\n "lanes": [["a","b"]]\n}', false).components[0]?.type).toBe('flow')
  expect(parseBody('[{"type":"tree","nodes":["x"]},{"type":"pie","values":{"a":1}}]', false).components.length).toBe(2)
})

test('blocks split from prose; an unfinished block draws its finished lines and is pending', () => {
  const s = splitBlocks('Intro\n```ui\n{"type":"stat","label":"a","value":"1"}\n```\nmid\n```ui\n{"type":"stat","label":"b","value":"2"}\n{"type":"ba')
  expect(s.map(x => x.kind)).toEqual(['text', 'block', 'text', 'block'])
  const last = s[3]
  expect(last?.kind === 'block' && last.block.pending && last.block.components.length === 1).toBe(true)
  expect(splitBlocks('```viz\n{"type":"bars","values":{"x":1}}\n```')[0]?.kind).toBe('block')
})

test('normalizers clamp and drop what cannot be drawn honestly', () => {
  expect(normalize({ type: 'bars', values: { a: -1 } })).toBeUndefined()
  expect(normalize({ type: 'line', x: ['a'], series: { s: [1] } })).toBeUndefined()
  expect(normalize({ type: 'line', x: ['a', 'b'], series: { s: [1, 'x'] } })).toBeUndefined()
  const calc = normalize({ type: 'calc', inputs: [{ id: 'r', value: 500, min: 0, max: 10 }], outputs: [{ label: 'x', formula: 'r*2' }] })
  expect(calc?.type === 'calc' && calc.inputs[0]?.value).toBe(10)
  expect(normalize({ type: 'calc', inputs: [{ id: 'bad id', min: 0, max: 1 }], outputs: [{ formula: '1' }] })).toBeUndefined()
  expect(normalize({ type: 'graph', nodes: ['a', 'b'], edges: [['a', 'zzz']] })).toBeUndefined()
  expect(normalize({ type: 'graph', nodes: ['a', 'b'], edges: [['a', 'b', 'calls']] })?.type).toBe('graph')
  expect(normalize({ type: 'choice', id: 'p', options: ['one'] })).toBeUndefined()
  expect(normalize({ type: 'map', stops: [{ label: 'X', lat: 200, lon: 0 }] })).toEqual({ type: 'map', stops: [{ label: 'X' }] })
  expect(normalize({ type: 'quadrant', x: 'e', y: 'i', points: [{ label: 'A', x: 1, y: 2 }] })).toEqual({ type: 'scatter', x: 'e', y: 'i', points: [{ label: 'A', x: 1, y: 2 }], quadrant: true })
})

test('a pie past four slices keeps the three biggest and folds the rest into Other', () => {
  const p = normalize({ type: 'pie', values: { a: 5, b: 4, c: 3, d: 2, e: 1 } })
  expect(p?.type === 'pie' && p.values).toEqual({ a: 5, b: 4, c: 3, Other: 3 })
})
