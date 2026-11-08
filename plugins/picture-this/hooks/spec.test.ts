import { expect, test } from 'claude-code/testing'

import { normalize, parseBody, splitBlocks } from './spec'

test('JSON Lines: one component per line, bad lines and dropped kinds counted as skipped', () => {
  const r = parseBody('{"type":"bars","values":{"A":1,"B":2}}\nnot json\n{"type":"calc"}\n{"type":"flow","lanes":[["a","b"]]}\n', false)
  expect(r.components.map(c => c.type)).toEqual(['bars', 'flow'])
  expect(r.skipped).toBe(2)
})

test('a whole JSON object or array also works (older ```viz blocks)', () => {
  expect(parseBody('{\n "type": "flow",\n "lanes": [["a","b"]]\n}', false).components[0]?.type).toBe('flow')
  expect(parseBody('[{"type":"tree","nodes":["x"]},{"type":"bars","values":{"a":1}}]', false).components.length).toBe(2)
})

test('blocks split from prose; an unfinished block draws its finished lines and is pending', () => {
  const f = '{"type":"flow","lanes":[["a","b"]]}'
  const s = splitBlocks(`Intro\n\`\`\`ui\n${f}\n\`\`\`\nmid\n\`\`\`ui\n${f}\n{"type":"gr`)
  expect(s.map(x => x.kind)).toEqual(['text', 'block', 'text', 'block'])
  const last = s[3]
  expect(last?.kind === 'block' && last.block.pending && last.block.components.length === 1).toBe(true)
  expect(splitBlocks('```viz\n{"type":"bars","values":{"x":1}}\n```')[0]?.kind).toBe('block')
})

test('graph: edges need both ends, duplicates go, hot and note kept', () => {
  expect(normalize({ type: 'graph', nodes: ['a', 'b'], edges: [['a', 'zzz']] })).toBeUndefined()
  const g = normalize({ type: 'graph', nodes: [{ id: 'a', label: 'API', hot: true, note: 'hub' }, 'b', 'b'], edges: [{ from: 'a', to: 'b', label: 'calls' }] })
  expect(g).toEqual({ type: 'graph', nodes: [{ id: 'a', label: 'API', note: 'hub', hot: true }, { id: 'b', label: 'b' }], edges: [{ from: 'a', to: 'b', label: 'calls' }] })
})

test('sequence: actors come from the steps when not listed; one actor is not a sequence', () => {
  const s = normalize({ type: 'sequence', steps: [['Client', 'API', 'login'], ['API', 'DB'], ['API', 'Client', '200']] })
  expect(s?.type === 'sequence' && s.actors).toEqual(['Client', 'API', 'DB'])
  expect(s?.type === 'sequence' && s.steps.length).toBe(3)
  expect(normalize({ type: 'sequence', steps: [['A', 'A', 'tick']] })).toBeUndefined()
})

test('normalizers drop what cannot be drawn honestly', () => {
  expect(normalize({ type: 'bars', values: { a: -1 } })).toBeUndefined()
  for (const gone of ['table', 'calc', 'choice', 'send', 'map', 'pie', 'line', 'card', 'stat']) expect(normalize({ type: gone, values: { a: 1 } })).toBeUndefined()
  expect(normalize({ type: 'quadrant', x: 'e', y: 'i', points: [{ label: 'A', x: 1, y: 2 }] })).toEqual({ type: 'scatter', x: 'e', y: 'i', points: [{ label: 'A', x: 1, y: 2 }], quadrant: true })
})

test('tour: needs a graph and 2+ steps; focus ids not in the graph are dropped', () => {
  const t = normalize({ type: 'walkthrough', nodes: ['a', 'b'], edges: [['a', 'b']], steps: [{ focus: ['a', 'zz'], text: 'one' }, { focus: ['b'], text: 'two' }] })
  expect(t?.type === 'tour' && t.steps).toEqual([{ focus: ['a'], text: 'one' }, { focus: ['b'], text: 'two' }])
  expect(normalize({ type: 'tour', nodes: ['a', 'b'], edges: [['a', 'b']], steps: [{ focus: ['a'], text: 'only' }] })).toBeUndefined()
})
