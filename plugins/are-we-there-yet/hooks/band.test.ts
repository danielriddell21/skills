import { expect, test } from 'claude-code/testing'

const ctx = (percent: number) => ({ window: 1000, tokens: percent * 10, percent })
const props = { hasSurvey: false, isWorking: false, maxRows: 10 } as never

const base = (on: any, submitted: string[] = []) => {
  on('session.measure', (_: unknown, e: { changed: string[] }) => ({ changed: e.changed }))
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('ui.status', () => ({ value: undefined }) as never)
  on('command.run', (_: unknown, e: { command: string; args: string }) => {
    submitted.push(`/${e.command} ${e.args}`)
    return { text: '' }
  })
}

test('no Compact button below the urgent level', async ($, on) => {
  base(on)
  await $.session.measure({ context: ctx(60), rateLimits: [], changed: ['context'] } as never)
  const m = await $.ui.mount({ plugin: 'are-we-there-yet', surface: 'terminal', component: 'AbovePrompt', props })
  expect(await m.find({ key: 'compact' } as never)).toBeUndefined()
})

test('Compact button at 90% submits a focused /compact', async ($, on) => {
  const submitted: string[] = []
  base(on, submitted)
  await $.session.measure({ context: ctx(90), rateLimits: [], changed: ['context'] } as never)
  const m = await $.ui.mount({ plugin: 'are-we-there-yet', surface: 'terminal', component: 'AbovePrompt', props })
  await m.press({ key: 'compact' } as never)
  expect(submitted[0].startsWith('/compact keep the goal')).toBe(true)
})

test('compactButton: false hides it', { options: { compactButton: false } }, async ($, on) => {
  base(on)
  await $.session.measure({ context: ctx(90), rateLimits: [], changed: ['context'] } as never)
  const m = await $.ui.mount({ plugin: 'are-we-there-yet', surface: 'terminal', component: 'AbovePrompt', props })
  expect(await m.find({ key: 'compact' } as never)).toBeUndefined()
})
