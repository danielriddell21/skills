import { expect, test } from 'claude-code/testing'

const usage = (percent: number) =>
  ({
    startedAt: 0,
    rateLimits: [],
    context: {
      window: 1000,
      tokens: percent * 10,
      percent,
      breakdown: {
        categories: [
          { name: 'Messages', tokens: 400, kind: 'used', color: 'x' },
          { name: 'MCP tools', tokens: 180, kind: 'used', color: 'x' },
          { name: 'Free space', tokens: 400, kind: 'free', color: 'x' },
        ],
        totalTokens: 580,
        maxTokens: 1000,
        rawMaxTokens: 1000,
        percentage: 58,
        gridRows: [],
        model: 'm',
        autocompactSource: 'default',
      },
    },
  }) as never

const base = (on: any) => {
  on('session.usage', () => ({ value: usage(58) }))
  on('session.measure', (_: unknown, e: { changed: string[] }) => ({ changed: e.changed }))
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as never)
}

const props = { hasSurvey: false, isWorking: false, maxRows: 10 } as never

test('band draws after a measure, with a Details button', async ($, on) => {
  base(on)
  await $.session.measure({ context: (usage(58) as { context: never }).context, rateLimits: [], changed: ['context'] } as never)
  const m = await $.ui.mount({ plugin: 'whats-in-the-box', surface: 'terminal', component: 'AbovePrompt', props })
  expect(await m.find({ key: 'details' })).toBeTruthy()
})

test('band stays hidden before any data', async ($, on) => {
  base(on)
  const m = await $.ui.mount({ plugin: 'whats-in-the-box', surface: 'terminal', component: 'AbovePrompt', props })
  expect(await m.find({ key: 'details' })).toBeUndefined()
})

test('band respects band:false', { options: { band: false } }, async ($, on) => {
  base(on)
  await $.session.measure({ context: (usage(58) as { context: never }).context, rateLimits: [], changed: ['context'] } as never)
  const m = await $.ui.mount({ plugin: 'whats-in-the-box', surface: 'terminal', component: 'AbovePrompt', props })
  expect(await m.find({ key: 'details' })).toBeUndefined()
})
