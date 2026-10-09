import { expect, test } from 'claude-code/testing'

const props = { hasSurvey: false, isWorking: false, maxRows: 10 } as never
const PLUGIN = 'who-wants-the-job'
const usage = { model: 'claude-haiku-4-5', input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

let at = 1000
const base = (on: any) => {
  on('clock.now', () => ({ value: at }) as never)
  on('agent.spawn', () => ({ model: 'claude-haiku-4-5', agentId: 'ag1' }) as never)
  on('turn.complete', (_: unknown, e: { answer: string }) => ({ text: e.answer }))
  on('tool.call', () => ({ result: 'base' }) as never)
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as never)
}

const spawn = ($: any, subagentType = 'scout') => $.agent.spawn({ prompt: 'find auth', description: 'find auth', subagentType, tool_use_id: 't1' })
const done = (reason = 'answer') => ({ answer: 'ok', durationMs: 4000, isAborted: false, turnId: 'x', agentId: 'ag1', reason, usage }) as never
const chip = ($: any) => $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props })
const pane = ($: any, surface = 'terminal') => $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: 'crew', props })

test('no chip before any agent runs', async ($, on) => {
  base(on)
  expect(await (await chip($)).find({ text: /crew/ } as never)).toBeUndefined()
})

test('a spawned agent shows a running chip; completing it flips to done with cost', async ($, on) => {
  base(on)
  await spawn($)
  expect(await (await chip($)).find({ text: /crew 1\/1 running/ } as never)).toBeTruthy()
  at = 5000
  await $.turn.complete(done())
  const m = await chip($)
  expect(await m.find({ text: /crew 1 done · ≈<\$0\.01/ } as never)).toBeTruthy()
})

test('a failed turn is marked failed in the pane', async ($, on) => {
  base(on)
  await spawn($, 'sniper')
  await $.turn.complete(done('error'))
  const m = await pane($)
  expect(await m.find({ text: /✗ Sniper/ } as never)).toBeTruthy()
})

test('worker step tool draws a progress bar in the pane; main-loop calls are ignored', async ($, on) => {
  base(on)
  await spawn($, 'engineer')
  const ignored = await $.tool.call({ tool: 'mcp__who-wants-the-job__step', tool_use_id: 's0', done: 1, total: 4 } as never)
  expect(JSON.stringify(ignored)).toContain('ignored')
  await $.tool.call({ tool: 'mcp__who-wants-the-job__step', tool_use_id: 's1', agentId: 'ag1', done: 1, total: 4, note: 'grep' } as never)
  const m = await pane($)
  expect(await m.find({ text: /Engineer · haiku · .* 1\/4/ } as never)).toBeTruthy()
})

test('pane: animated svg on desktop, glyph beside each row in the terminal; Clear finished empties it', async ($, on) => {
  base(on)
  await spawn($, 'spy')
  await $.turn.complete(done())
  const t = await pane($)
  expect(await t.find({ text: /◐ ✓ Spy/ } as never)).toBeTruthy()
  const d = await pane($, 'desktop')
  expect(JSON.stringify(await d.drawn())).toContain('<svg')
  await t.press({ key: 'clear' } as never)
  expect(await t.find({ text: /No subagents yet/ } as never)).toBeTruthy()
})

test('the pane opens by itself for a crew agent, not for other agents, and not when autoOpen is off', async ($, on) => {
  const opened: string[] = []
  base(on)
  on('ui.panes', () => ({ value: [] }) as never)
  on('ui.open', (_: unknown, e: { id: string }) => {
    opened.push(e.id)
    return { value: { isPlaced: true } } as never
  })
  await spawn($, 'Explore')
  expect(opened).toEqual([])
  await spawn($, 'who-wants-the-job:scout')
  expect(opened).toEqual(['crew'])
})

test('autoOpen: false keeps the pane closed', { options: { autoOpen: false } }, async ($, on) => {
  const opened: string[] = []
  base(on)
  on('ui.panes', () => ({ value: [] }) as never)
  on('ui.open', (_: unknown, e: { id: string }) => {
    opened.push(e.id)
    return { value: { isPlaced: true } } as never
  })
  await spawn($, 'scout')
  expect(opened).toEqual([])
})
