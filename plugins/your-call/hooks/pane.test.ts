import { expect, test } from 'claude-code/testing'

const TOOL = 'mcp__your-call__ask'

const base = (on: any) => {
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.close', () => ({ value: undefined }) as never)
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as never)
}

const spec = {
  title: 'Cache',
  steps: [
    {
      id: 'c',
      question: 'Which cache?',
      kind: 'one',
      options: [
        { id: 'redis', label: 'Redis', detail: 'shared, TTLs', pros: ['fast'], cons: ['extra service'] },
        { id: 'mem', label: 'In-memory' },
      ],
    },
  ],
}

test('pane: pick an option, confirm, model gets the pick', async ($, on) => {
  base(on)
  const call = $.tool.call({ tool: TOOL, tool_use_id: 't1', ...spec } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  await m.press({ key: 'p-redis' } as never)
  await m.press({ key: 'next' } as never)
  const out = JSON.parse((await call).result)
  expect(out.decisions[0].picks).toEqual(['redis'])
})

test('pane: none-fit box returns a regenerate request', async ($, on) => {
  base(on)
  const call = $.tool.call({ tool: TOOL, tool_use_id: 't2', ...spec } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  await m.input({ key: 'regen', text: 'something serverless' } as never)
  const out = JSON.parse((await call).result)
  expect(out.regenerate).toBe('something serverless')
})

test('pane: skip cancels', async ($, on) => {
  base(on)
  const call = $.tool.call({ tool: TOOL, tool_use_id: 't3', ...spec } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  await m.press({ key: 'skip' } as never)
  expect(JSON.parse((await call).result)).toEqual({ cancelled: true })
})

const wizard = {
  title: 'Plan',
  steps: [
    { id: 'a', question: 'Cache?', kind: 'one', options: [{ id: 'r', label: 'Redis', detail: 'd' }, { id: 'm', label: 'Mem' }] },
    { id: 'b', question: 'Extras?', kind: 'many', options: [{ id: 'x', label: 'Metrics', detail: 'd' }, { id: 'y', label: 'Tracing' }] },
  ],
}

test('wizard: two steps, multi-select, review, confirm', async ($, on) => {
  base(on)
  const call = $.tool.call({ tool: TOOL, tool_use_id: 't4', ...wizard } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  await m.press({ key: 'p-r' } as never)
  await m.press({ key: 'next' } as never)
  await m.press({ key: 'p-x' } as never)
  await m.press({ key: 'p-y' } as never)
  await m.press({ key: 'next' } as never)
  await m.press({ key: 'confirm' } as never)
  const out = JSON.parse((await call).result)
  expect(out.decisions.map((d: { picks: string[] }) => d.picks)).toEqual([['r'], ['x', 'y']])
})

test('wizard: Next without a pick does nothing, Back returns', async ($, on) => {
  base(on)
  const call = $.tool.call({ tool: TOOL, tool_use_id: 't5', ...wizard } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  await m.press({ key: 'next' } as never)
  expect(await m.find({ key: 'prev' } as never)).toBeUndefined()
  await m.press({ key: 'p-m' } as never)
  await m.press({ key: 'next' } as never)
  expect(await m.find({ key: 'prev' } as never)).toBeTruthy()
  await m.press({ key: 'skip' } as never)
  await call
})

test('in-thread: a viz block mounts on terminal and desktop', async ($, on) => {
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as never)
  const text = 'before\n```viz\n{"type":"bars","values":{"A":3,"B":1}}\n```\nafter'
  for (const surface of ['terminal', 'desktop'] as const) {
    const m = await $.ui.mount({ plugin: 'your-call', surface, component: 'AssistantMessage', props: { text, isFirstOfReply: true } as never })
    expect(m).toBeTruthy()
  }
})
