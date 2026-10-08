import { expect, test } from 'claude-code/testing'

const props = { hasSurvey: false, isWorking: false, maxRows: 10 } as never

const base = (on: any) => {
  on('session.usage', () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 1000 }, cost: { usd: 1 } } }) as never)
  on('prompt.submit', (_: unknown, e: { text: string }) => ({ text: e.text }))
  on('tool.call', () => ({ result: 'ok' }) as never)
  on('turn.complete', (_: unknown, e: { answer: string }) => ({ text: e.answer }))
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as never)
}

const turn = { answer: 'done', durationMs: 5000, isAborted: false, turnId: 't', reason: 'answer' } as never

test('band appears after a turn that edited a file, can expand and hide', async ($, on) => {
  base(on)
  await $.prompt.submit({ text: 'fix it' } as never)
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: '/repo/src/a.go', old_string: 'a', new_string: 'b' } as never)
  await $.turn.complete(turn)
  const m = await $.ui.mount({ plugin: 'tell-me-the-damage', surface: 'terminal', component: 'AbovePrompt', props })
  expect(await m.find({ key: 'details' } as never)).toBeTruthy()
  expect(await m.find({ text: /src\/a\.go/ } as never)).toBeUndefined()
  await m.press({ key: 'details' } as never)
  expect(await m.find({ text: /src\/a\.go/ } as never)).toBeTruthy()
  await m.press({ key: 'hide' } as never)
  expect(await m.find({ key: 'hide' } as never)).toBeUndefined()
})

test('no band for a turn with no tool calls', async ($, on) => {
  base(on)
  await $.prompt.submit({ text: 'hello' } as never)
  await $.turn.complete(turn)
  const m = await $.ui.mount({ plugin: 'tell-me-the-damage', surface: 'terminal', component: 'AbovePrompt', props })
  expect(await m.find({ key: 'hide' } as never)).toBeUndefined()
})
