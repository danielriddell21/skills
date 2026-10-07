import { expect, test } from 'claude-code/testing'

import { cardLines } from './card'
import { TOASTS } from './register'

const ok = JSON.stringify({ decisions: [
  { step: 'c', question: 'Cache?', picks: ['redis'], labels: ['Redis'], notes: { redis: 'cluster' } },
  { step: 'x', question: 'Ship?', picks: ['__other'], labels: ['Other: tomorrow'] },
] })

test('card for decisions, from a string or an object with text', () => {
  const want = ['◆ your call', '  Cache?  →  Redis  (cluster)', '  Ship?  →  Other: tomorrow']
  expect(cardLines(ok)).toEqual(want)
  expect(cardLines({ text: ok })).toEqual(want)
})

test('card for skip, timeout, regenerate, error', () => {
  expect(cardLines('{"cancelled":true}')).toEqual(['◆ your call: skipped'])
  expect(cardLines('{"cancelled":true,"timedOut":true}')).toEqual(['◆ your call: no answer, timed out'])
  expect(cardLines('{"regenerate":"cheaper"}')).toEqual(['◆ your call: none of these fit', '  ↻ cheaper'])
  expect(cardLines('{"error":"steps must be a non-empty array"}')?.[0]).toContain('could not ask')
})

test('not ours: undefined', () => {
  expect(cardLines('plain text')).toBeUndefined()
  expect(cardLines('{"a":1}')).toBeUndefined()
  expect(cardLines(undefined)).toBeUndefined()
})

test('card for new outcomes and extras', () => {
  expect(cardLines('{"deferred":true,"state":{}}')).toEqual(['◆ your call: decide later'])
  expect(cardLines('{"explain":{"step":"c","option":"r","label":"Redis"},"state":{}}')).toEqual(['◆ your call: asked about "Redis"'])
  expect(cardLines('{"regenerate":"x","vetoed":{"c":["a","b"]}}')?.[1]).toContain('rejected: a, b')
  const d = cardLines(JSON.stringify({ usedDefault: true, decisions: [{ question: 'Q?', labels: ['A'], confidence: 'high', vetoed: ['b'], notes: {} }] }))
  expect(d).toEqual(['◆ your call (no answer: recommended option used)', '  Q?  →  A  (high confidence; vetoed 1)'])
})

// Same rule as the engine's toast box: word wrap at 40 columns, at most 3 lines.
const wrapCount = (text: string, cols = 40): number =>
  text.split('\n').reduce((n, line) => {
    let rows = 1
    let w = 0
    for (const word of line.split(' ')) {
      if (w === 0) w = word.length
      else if (w + 1 + word.length <= cols) w += 1 + word.length
      else {
        rows += 1
        w = word.length
      }
    }
    return n + rows
  }, 0)

test('toasts fit the 40-column, 3-line box', () => {
  for (const text of Object.values(TOASTS)) expect([text, wrapCount(text) <= 3]).toEqual([text, true])
})

test('card for plan approvals', () => {
  expect(cardLines('{"approved":["a","b","c"],"rejected":["d"]}')).toEqual(['◆ plan: approved 3, skipped 1'])
  expect(cardLines('{"approved":["a"],"rejected":[],"autoApproved":["a"],"note":"go slow"}')).toEqual(['◆ plan: approved 1, skipped 0, 1 auto (lgtm)  (go slow)'])
})
