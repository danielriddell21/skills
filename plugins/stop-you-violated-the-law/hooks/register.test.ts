import { expect, test } from 'claude-code/testing'

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
    return null
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
