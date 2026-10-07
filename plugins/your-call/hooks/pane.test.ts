import { expect, test } from 'claude-code/testing'

const TOOL = 'mcp__your-call__ask'

const mem = new Map<string, unknown>()

const base = (on: any) => {
  mem.clear()
  on('clock.now', () => ({ value: 1000 }) as never)
  on('store.get', (_: unknown, e: { key: string }) => ({ value: mem.get(e.key) }) as never)
  on('store.set', (_: unknown, e: { key: string; value: unknown }) => {
    mem.set(e.key, e.value)
    return { value: undefined } as never
  })
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

test('pane: single step confirms on pick; model gets picks, labels and question', async ($, on) => {
  base(on)
  const call = $.tool.call({ tool: TOOL, tool_use_id: 't1', ...spec } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  await m.press({ key: 'p-redis' } as never)
  const d = JSON.parse((await call).result).decisions[0]
  expect(d.picks).toEqual(['redis'])
  expect(d.labels).toEqual(['Redis'])
  expect(d.question).toBe('Which cache?')
})

test('pane: autoConfirm off, pick then Next confirms', { options: { autoConfirm: false } }, async ($, on) => {
  base(on)
  const call = $.tool.call({ tool: TOOL, tool_use_id: 't1b', ...spec } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  await m.press({ key: 'p-redis' } as never)
  await m.press({ key: 'next' } as never)
  expect(JSON.parse((await call).result).decisions[0].picks).toEqual(['redis'])
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

test('bad spec: the model gets a clear error, nothing opens', async ($, on) => {
  base(on)
  const r = (await $.tool.call({ tool: TOOL, tool_use_id: 'b1', steps: [{ id: 'a', options: [{ label: 'only one' }] }] } as never)) as { result: string }
  expect(JSON.parse(r.result)).toEqual({ error: 'step "a" needs at least 2 options' })
  const r2 = (await $.tool.call({ tool: TOOL, tool_use_id: 'b2' } as never)) as { result: string }
  expect(JSON.parse(r2.result).error).toContain('steps')
})

test('sloppy spec (string options, no ids) still works and reports a cap warning', async ($, on) => {
  base(on)
  const options = Array.from({ length: 14 }, (_, i) => `Choice ${i + 1}`)
  const call = $.tool.call({ tool: TOOL, tool_use_id: 'b3', steps: [{ question: 'Pick', options, kind: 'many' }] } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  await m.press({ key: 'p-choice-1' } as never)
  await m.press({ key: 'next' } as never)
  const out = JSON.parse((await call).result)
  expect(out.decisions[0].picks).toEqual(['choice-1'])
  expect(out.warnings[0]).toContain('first 12 of 14')
})

test('two asks at once: the second waits, then gets its own pane', async ($, on) => {
  base(on)
  const a = $.tool.call({ tool: TOOL, tool_use_id: 'q1', ...spec } as never) as Promise<{ result: string }>
  const b = $.tool.call({ tool: TOOL, tool_use_id: 'q2', ...spec } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  await m.press({ key: 'p-redis' } as never)
  await m.press({ key: 'next' } as never)
  expect(JSON.parse((await a).result).decisions[0].picks).toEqual(['redis'])
  await (m as unknown as { unmount: () => Promise<void> }).unmount()
  await new Promise(r => setTimeout(r, 50))
  const m2 = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  await m2.press({ key: 'skip' } as never)
  expect(JSON.parse((await b).result)).toEqual({ cancelled: true })
})

test('hint shows until something is picked', { options: { autoConfirm: false } }, async ($, on) => {
  base(on)
  const call = $.tool.call({ tool: TOOL, tool_use_id: 'h1', ...spec } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  expect(await m.find({ text: /Pick an option to continue/ } as never)).toBeTruthy()
  await m.press({ key: 'p-mem' } as never)
  expect(await m.find({ text: /Pick an option to continue/ } as never)).toBeUndefined()
  await m.press({ key: 'skip' } as never)
  await call
})

const branching = {
  title: 'Setup',
  steps: [
    { id: 'cache', question: 'Cache?', kind: 'one', options: [{ id: 'redis', label: 'Redis', detail: 'd' }, { id: 'mem', label: 'Mem' }] },
    { id: 'ttl', question: 'TTL?', kind: 'one', options: ['short', 'long'], showIf: { step: 'cache', picked: ['redis'] } },
    { id: 'end', question: 'Ship?', kind: 'one', options: ['yes', 'no'] },
  ],
}

const open = async ($: any, on: any, spec: object, id: string) => {
  base(on)
  const call = $.tool.call({ tool: TOOL, tool_use_id: id, ...spec } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  return { call, m }
}

test('branch: conditional step is skipped when its condition fails', { timeoutMs: 40000 }, async ($, on) => {
  const { call, m } = await open($, on, branching, 'br1')
  await m.press({ key: 'p-mem' } as never)
  await m.press({ key: 'next' } as never)
  expect(await m.find({ text: /Ship\?/ } as never)).toBeTruthy()
  await m.press({ key: 'p-yes' } as never)
  await m.press({ key: 'next' } as never)
  await m.press({ key: 'confirm' } as never)
  const out = JSON.parse((await call).result)
  expect(out.decisions.map((d: { step: string }) => d.step)).toEqual(['cache', 'end'])
})

test('branch: condition met shows the step; review jump changes an answer and resets dependents', { timeoutMs: 40000 }, async ($, on) => {
  const { call, m } = await open($, on, branching, 'br2')
  await m.press({ key: 'p-redis' } as never)
  await m.press({ key: 'next' } as never)
  expect(await m.find({ text: /TTL\?/ } as never)).toBeTruthy()
  await m.press({ key: 'p-long' } as never)
  await m.press({ key: 'next' } as never)
  await m.press({ key: 'p-no' } as never)
  await m.press({ key: 'next' } as never)
  expect(await m.find({ key: 'rev-ttl' } as never)).toBeTruthy()
  await m.press({ key: 'rev-cache' } as never)
  await m.press({ key: 'p-mem' } as never)
  await m.press({ key: 'next' } as never)
  expect(await m.find({ key: 'rev-ttl' } as never)).toBeUndefined()
  await m.press({ key: 'confirm' } as never)
  const out = JSON.parse((await call).result)
  expect(out.decisions.map((d: { step: string; picks: string[] }) => [d.step, d.picks])).toEqual([['cache', ['mem']], ['end', ['no']]])
})

test('review: Confirm is blocked while a visible step is unanswered', { timeoutMs: 40000 }, async ($, on) => {
  const { call, m } = await open($, on, branching, 'br3')
  await m.press({ key: 'p-redis' } as never)
  await m.press({ key: 'next' } as never)
  await m.press({ key: 'p-short' } as never)
  await m.press({ key: 'next' } as never)
  await m.press({ key: 'p-yes' } as never)
  await m.press({ key: 'next' } as never)
  await m.press({ key: 'rev-cache' } as never)
  await m.press({ key: 'p-mem' } as never)
  await m.press({ key: 'p-redis' } as never)
  await m.press({ key: 'next' } as never)
  expect(await m.find({ text: /unanswered/ } as never)).toBeTruthy()
  await m.press({ key: 'confirm' } as never)
  await m.press({ key: 'skip' } as never).catch(() => undefined)
  await m.press({ key: 'back' } as never)
  await m.press({ key: 'skip' } as never)
  await call
})

const weighted = {
  title: 'Pick',
  steps: [{
    id: 'c',
    question: 'Which?',
    kind: 'compare',
    options: ['A', 'B'],
    criteria: [{ name: 'cost', scores: { a: 5, b: 2 } }, { name: 'speed', scores: { a: 1, b: 5 }, weight: 8 }],
  }],
}

test('compare: leader star moves when you change a weight; result carries weights and leader', { timeoutMs: 40000 }, async ($, on) => {
  const { call, m } = await open($, on, weighted, 'w1')
  expect(await m.find({ text: /★ B 50/ } as never)).toBeTruthy()
  for (let i = 0; i < 8; i++) await m.press({ key: 'wm-1' } as never)
  expect(await m.find({ text: /★ A 25/ } as never)).toBeTruthy()
  await m.press({ key: 'p-a' } as never)
  await m.press({ key: 'next' } as never)
  const d = JSON.parse((await call).result).decisions[0]
  expect(d.weights).toEqual({ cost: 5, speed: 0 })
  expect(d.leader).toBe('a')
  expect(d.picks).toEqual(['a'])
})

const rec = {
  title: 'Cache',
  steps: [{
    id: 'c',
    question: 'Which cache?',
    why: 'cheapest to run',
    options: [{ id: 'redis', label: 'Redis', detail: 'shared' }, { id: 'mem', label: 'Mem', recommended: true, pros: ['simple'] }],
  }],
}

test('recommended: preselected, starred, with the why; Next accepts it', { options: { autoConfirm: false } }, async ($, on) => {
  const { call, m } = await open($, on, rec, 'rc1')
  expect(await m.find({ text: /★ recommended/ } as never)).toBeTruthy()
  expect(await m.find({ text: /cheapest to run/ } as never)).toBeTruthy()
  expect(await m.find({ text: /Pick an option/ } as never)).toBeUndefined()
  await m.press({ key: 'next' } as never)
  expect(JSON.parse((await call).result).decisions[0].picks).toEqual(['mem'])
})

test('type your own answer (single step confirms with other text)', async ($, on) => {
  const { call, m } = await open($, on, rec, 'ot1')
  await m.input({ key: 'other-c', text: 'dragonfly' } as never)
  const d = JSON.parse((await call).result).decisions[0]
  expect(d.picks).toEqual(['__other'])
  expect(d.labels).toEqual(['Other: dragonfly'])
  expect(d.other).toBe('dragonfly')
})

test('last time: the pick is remembered for the same question', { options: { autoConfirm: false } }, async ($, on) => {
  const first = await open($, on, rec, 'lt1')
  await first.m.press({ key: 'p-redis' } as never)
  await first.m.press({ key: 'next' } as never)
  await first.call
  await first.m.unmount()
  const call2 = $.tool.call({ tool: TOOL, tool_use_id: 'lt2', ...rec } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m2 = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  expect(await m2.find({ text: /last time/ } as never)).toBeTruthy()
  await m2.press({ key: 'skip' } as never)
  await call2
})

test('audience tally and estimates note show in a compare step', async ($, on) => {
  const spec2 = {
    title: 'T',
    steps: [{
      id: 'c',
      question: 'Which?',
      kind: 'compare',
      options: ['A', 'B'],
      audience: { votes: { a: 3, b: 1 } },
      criteria: [{ name: 'cost', scores: { a: 3, b: 4 } }],
    }],
  }
  const { call, m } = await open($, on, spec2, 'au1')
  expect(await m.find({ text: /The audience says/ } as never)).toBeTruthy()
  expect(await m.find({ text: /Claude's estimates/ } as never)).toBeTruthy()
  await m.press({ key: 'skip' } as never)
  await call
})

test('wizard shows a progress strip', async ($, on) => {
  const { call, m } = await open($, on, branching, 'pg1')
  expect(await m.find({ text: /●.*Cache\?/ } as never)).toBeTruthy()
  await m.press({ key: 'skip' } as never)
  await call
})

test('thread: the ask row and the result card are drawn compactly', async ($, on) => {
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as never)
  const use = await $.ui.mount({
    plugin: 'your-call', surface: 'terminal', component: 'ToolUse',
    props: { tool_use_id: 'x', tool: TOOL, input: { title: 'Cache' }, isRunning: true, isErrored: false, isInterrupted: false } as never,
  })
  expect(await use.find({ text: /your call: Cache/ } as never)).toBeTruthy()
  expect(await use.find({ text: /waiting for you/ } as never)).toBeTruthy()
  await use.unmount()
  const out = JSON.stringify({ decisions: [{ step: 'c', question: 'Which cache?', picks: ['redis'], labels: ['Redis'], notes: {} }] })
  const res = await $.ui.mount({
    plugin: 'your-call', surface: 'terminal', component: 'ToolResult',
    props: { tool_use_id: 'x', tool: TOOL, output: out, isErrored: false } as never,
  })
  expect(await res.find({ text: /Which cache\?.*Redis/ } as never)).toBeTruthy()
})

test('permission: the ask tool is allowed without the default prompt', async ($, on) => {
  on('tool.check', () => ({ decision: 'ask' }) as never)
  const r = await $.tool.check({ tool: TOOL, input: { steps: [] } } as never)
  expect((r as { decision: string }).decision).toBe('allow')
})

const two = {
  title: 'Cache',
  steps: [{ id: 'c', question: 'Which cache?', options: [{ id: 'redis', label: 'Redis', detail: 'd' }, { id: 'mem', label: 'Mem' }, { id: 'cdn', label: 'CDN' }] }],
}
const manual = { options: { autoConfirm: false } }

test('veto + Propose others: Claude gets the rejected options and the state', manual, async ($, on) => {
  const { call, m } = await open($, on, two, 'vt1')
  await m.press({ key: 'x-redis' } as never)
  await m.press({ key: 'x-cdn' } as never)
  await m.press({ key: 'others' } as never)
  const out = JSON.parse((await call).result)
  expect(out.regenerate).toBeTruthy()
  expect(out.vetoed).toEqual({ c: ['redis', 'cdn'] })
  expect(out.state.vetoed).toEqual({ c: ['redis', 'cdn'] })
})

test('a vetoed option cannot be picked until restored', manual, async ($, on) => {
  const { call, m } = await open($, on, two, 'vt2')
  await m.press({ key: 'x-redis' } as never)
  expect(await m.find({ key: 'p-redis' } as never)).toBeUndefined()
  await m.press({ key: 'x-redis' } as never)
  expect(await m.find({ key: 'p-redis' } as never)).toBeTruthy()
  await m.press({ key: 'skip' } as never)
  await call
})

test('explain: the model gets the option and state, and a re-ask resumes it', manual, async ($, on) => {
  const first = await open($, on, two, 'ex1')
  await first.m.press({ key: 'p-mem' } as never)
  await first.m.press({ key: 'q-redis' } as never)
  const out = JSON.parse((await first.call).result)
  expect(out.explain).toEqual({ step: 'c', option: 'redis', label: 'Redis' })
  expect(out.state.picks.c).toEqual(['mem'])
  await first.m.unmount()
  const call2 = $.tool.call({ tool: TOOL, tool_use_id: 'ex2', ...two, resume: out.state } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m2 = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  expect(await m2.find({ text: /◉ Mem/ } as never)).toBeTruthy()
  await m2.press({ key: 'next' } as never)
  expect(JSON.parse((await call2).result).decisions[0].picks).toEqual(['mem'])
})

test('decide later returns deferred with state', manual, async ($, on) => {
  const { call, m } = await open($, on, two, 'df1')
  await m.press({ key: 'p-cdn' } as never)
  await m.press({ key: 'defer' } as never)
  const out = JSON.parse((await call).result)
  expect(out.deferred).toBe(true)
  expect(out.state.picks.c).toEqual(['cdn'])
})

test('undo and redo inside the pane', manual, async ($, on) => {
  const { call, m } = await open($, on, two, 'un1')
  expect(await m.find({ key: 'undo' } as never)).toBeUndefined()
  await m.press({ key: 'p-redis' } as never)
  await m.press({ key: 'p-mem' } as never)
  expect(await m.find({ text: /◉ Mem/ } as never)).toBeTruthy()
  await m.press({ key: 'undo' } as never)
  expect(await m.find({ text: /◉ Redis/ } as never)).toBeTruthy()
  await m.press({ key: 'redo' } as never)
  expect(await m.find({ text: /◉ Mem/ } as never)).toBeTruthy()
  await m.press({ key: 'skip' } as never)
  await call
})

test('confidence is returned with the pick and toggles off', manual, async ($, on) => {
  const { call, m } = await open($, on, two, 'cf1')
  await m.press({ key: 'p-mem' } as never)
  await m.press({ key: 'cf-high' } as never)
  await m.press({ key: 'cf-high' } as never)
  await m.press({ key: 'cf-medium' } as never)
  await m.press({ key: 'next' } as never)
  expect(JSON.parse((await call).result).decisions[0].confidence).toBe('medium')
})

test('more than 6 options: first 6 shown, the rest behind Show more', manual, async ($, on) => {
  const many = { title: 'M', steps: [{ id: 'c', question: 'Pick', options: Array.from({ length: 10 }, (_, i) => `Opt ${i + 1}`) }] }
  const { call, m } = await open($, on, many, 'mo1')
  expect(await m.find({ key: 'p-opt-6' } as never)).toBeTruthy()
  expect(await m.find({ key: 'p-opt-7' } as never)).toBeUndefined()
  await m.press({ key: 'more-c' } as never)
  expect(await m.find({ key: 'p-opt-10' } as never)).toBeTruthy()
  await m.press({ key: 'skip' } as never)
  await call
})

test('/decisions lists this session and /decisions 1 reopens', manual, async ($, on) => {
  let filled = ''
  on('prompt.fill', (_: unknown, e: { text: string }) => {
    filled = e.text
    return { isFilled: true } as never
  })
  on('command.run', () => ({ text: 'x' }) as never)
  const { call, m } = await open($, on, two, 'lg1')
  expect(((await $.command.run({ command: 'decisions', args: '' } as never)) as { text: string }).text).toContain('No decisions')
  await m.press({ key: 'p-mem' } as never)
  await m.press({ key: 'next' } as never)
  await call
  const list = ((await $.command.run({ command: 'decisions', args: '' } as never)) as { text: string }).text
  expect(list).toContain('1. Cache: Which cache? → Mem')
  expect(((await $.command.run({ command: 'decisions', args: '1' } as never)) as { text: string }).text).toContain('press Enter to reopen')
  expect(filled).toContain('resume:')
  expect(filled).toContain('"mem"')
  expect(((await $.command.run({ command: 'decisions', args: '9' } as never)) as { text: string }).text).toContain('No decision 9')
})
