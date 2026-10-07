import { expect, test } from 'claude-code/testing'

import { TOAST } from './register'

const turn = (model: string, out: number) =>
  ({
    answer: 'ok',
    durationMs: 1,
    isAborted: false,
    turnId: 't',
    reason: 'answer',
    usage: { model, output_tokens: out, input_tokens: 10 },
  }) as never

const setup = (on: any) => {
  const toasts: string[] = []
  on('turn.complete', (_: unknown, e: { answer: string }) => ({ text: e.answer }))
  on('ui.toast', (_: unknown, e: { text: string }) => {
    toasts.push(e.text)
    return { value: undefined } as never
  })
  return toasts
}

test('toasts on a light opus turn, once per cooldown', async ($, on) => {
  const toasts = setup(on)
  await $.turn.complete(turn('claude-opus-5-5', 50))
  await $.turn.complete(turn('claude-opus-5-5', 50))
  expect(toasts.length).toBe(1)
})

test('silent on sonnet', async ($, on) => {
  const toasts = setup(on)
  await $.turn.complete(turn('claude-sonnet-5-5', 50))
  expect(toasts.length).toBe(0)
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

test('the toast fits the 40-column, 3-line box', () => {
  expect(wrapCount(TOAST)).toBeLessThanOrEqual(3)
  expect(TOAST.split('\n').every(l => l.length <= 40)).toBe(true)
})
