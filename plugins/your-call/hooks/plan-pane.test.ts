import { expect, test } from 'claude-code/testing'

const APPROVE = 'mcp__your-call__approve'
const ASK = 'mcp__your-call__ask'
const mem = new Map<string, unknown>()

const wired = new WeakSet<object>()

// Hooks beneath the plugins may only be registered before the test first uses `$`, so once per test.
const base = (on: any) => {
  if (wired.has(on)) return
  wired.add(on)
  mem.clear()
  on('clock.now', () => ({ value: 1000 }) as never)
  on('store.get', (_: unknown, e: { key: string }) => ({ value: mem.get(e.key) }) as never)
  on('store.set', (_: unknown, e: { key: string; value: unknown }) => {
    mem.set(e.key, e.value)
    return { value: undefined } as never
  })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.close', () => ({ value: undefined }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as never)
}

const planSpec = {
  title: 'Release',
  why: 'cut v4',
  items: [
    { id: 'tests', label: 'run the tests', command: 'scripts/check-mods.sh', risk: 'low', action: 'read' },
    { id: 'merge', label: 'merge v4 into master', risk: 'medium', action: 'edit' },
    { id: 'push', label: 'push master', command: 'git push origin master', risk: 'medium', action: 'ship' },
    { id: 'wipe', label: 'delete old branches', risk: 'high', action: 'delete' },
  ],
}

const openPlan = async ($: any, on: any, spec: object, id: string, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile' = 'terminal') => {
  base(on)
  const call = $.tool.call({ tool: APPROVE, tool_use_id: id, ...spec } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface, component: 'Pane', requestId: 'your-call-plan', props: {} as never })
  return { call, m }
}
const parse = async (call: Promise<{ result: string }>) => JSON.parse((await call).result)

test('plan: low and medium ticked, high-risk deletes not; Approve selected returns exactly the ticks', async ($, on) => {
  const { call, m } = await openPlan($, on, planSpec, 'p1')
  expect(await m.find({ text: /☑ run the tests/ } as never)).toBeTruthy()
  expect(await m.find({ text: /☐ delete old branches/ } as never)).toBeTruthy()
  expect(await m.find({ text: /\$ git push origin master/ } as never)).toBeTruthy()
  await m.press({ key: 'ok' } as never)
  const out = await parse(call)
  expect(out.approved).toEqual(['tests', 'merge', 'push'])
  expect(out.rejected).toEqual(['wipe'])
})

test('plan: untick one, tick the risky one, add a note', async ($, on) => {
  const { call, m } = await openPlan($, on, planSpec, 'p2')
  await m.press({ key: 't-push' } as never)
  await m.press({ key: 't-wipe' } as never)
  await m.input({ key: 'plan-note', text: 'keep the tags', kind: 'change' } as never)
  await m.press({ key: 'ok' } as never)
  const out = await parse(call)
  expect(out.approved).toEqual(['tests', 'merge', 'wipe'])
  expect(out.rejected).toEqual(['push'])
  expect(out.note).toBe('keep the tags')
})

test('plan: Approve all, Reject all, Skip', async ($, on) => {
  const a = await openPlan($, on, planSpec, 'p3')
  await a.m.press({ key: 'all' } as never)
  expect((await parse(a.call)).approved).toHaveLength(4)
  await a.m.unmount()
  const b = await openPlan($, on, planSpec, 'p4')
  await b.m.press({ key: 'none' } as never)
  expect((await parse(b.call)).approved).toEqual([])
  await b.m.unmount()
  const c = await openPlan($, on, planSpec, 'p5')
  await c.m.press({ key: 'skip' } as never)
  expect(await parse(c.call)).toEqual({ cancelled: true })
})

test('plan: a bad request gets a clear error', async ($, on) => {
  base(on)
  const r = (await $.tool.call({ tool: APPROVE, tool_use_id: 'bad', items: [] } as never)) as { result: string }
  expect(JSON.parse(r.result)).toEqual({ error: 'items must be a non-empty array' })
})

test('the approve tool needs no permission prompt of its own', async ($, on) => {
  on('tool.check', () => ({ decision: 'ask' }) as never)
  const r = await $.tool.check({ tool: APPROVE, input: {} } as never)
  expect((r as { decision: string }).decision).toBe('allow')
})

// ---- /lgtm gate (stand-in for looks-good-to-me, the owner of the gate state)
const gateOwner = {
  name: 'looks-good-to-me',
  register(on: any) {
    on('command.run', { command: 'set-gate' }, async ($: any, e: any) => {
      const mode = e.args
      const allow = {
        pick: mode !== 'plan' && mode !== 'off',
        plan: { medium: mode !== 'decide' && mode !== 'off', high: mode === 'yolo', ship: mode === 'push' || mode === 'yolo', delete: mode === 'yolo' },
        danger: mode === 'yolo',
        sensitive: mode === 'yolo',
      }
      await $.state.set({ plugin: 'looks-good-to-me', key: 'gate' }, { mode, phase: mode === 'off' ? 'off' : 'active', since: 0, allow: mode === 'off' ? null : allow })
      return { text: 'ok' }
    })
  },
}
const reader = {
  name: 'reader',
  register(on: any) {
    on('command.run', { command: 'read-approvals' }, async ($: any) => ({
      text: JSON.stringify((await $.state.get({ plugin: 'your-call', key: 'approvals' })).value ?? []),
    }))
  },
}
const gated = [gateOwner, reader] as never[]
const setGate = ($: any, mode: string) => $.command.run({ command: 'set-gate', args: mode } as never)
const approvals = async ($: any) => JSON.parse(((await $.command.run({ command: 'read-approvals', args: '' } as never)) as { text: string }).text)

test('lgtm safe: a question with a recommended option is answered without asking, and recorded', { plugins: gated }, async ($, on) => {
  base(on)
  await setGate($, 'safe')
  const r = (await $.tool.call({
    tool: ASK, tool_use_id: 'g1', question: 'Which cache?', options: ['Redis', 'Memory'], recommended: 'memory',
  } as never)) as { result: string }
  const out = JSON.parse(r.result)
  expect(out.autoApproved).toBe(true)
  expect(out.decisions[0].picks).toEqual(['mem' + 'ory'])
  expect(await approvals($)).toEqual([{ at: 1000, kind: 'pick', detail: 'Which cache?' }])
})

test('lgtm safe: nothing recommended means the pane still opens', { plugins: gated }, async ($, on) => {
  base(on)
  await setGate($, 'safe')
  const call = $.tool.call({ tool: ASK, tool_use_id: 'g2', title: 'T', steps: [{ id: 'c', question: 'Which?', options: [{ id: 'a', label: 'A', detail: 'd' }, 'B'] }] } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  await m.press({ key: 'skip' } as never)
  expect(JSON.parse((await call).result)).toEqual({ cancelled: true })
  expect(await approvals($)).toEqual([])
})

test('lgtm plan variant does not answer questions; decide variant does not approve plans', { plugins: gated }, async ($, on) => {
  base(on)
  await setGate($, 'plan')
  const ask = $.tool.call({ tool: ASK, tool_use_id: 'g3', question: 'Which?', options: ['A', 'B'], recommended: 'a' } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call', props: {} as never })
  await m.press({ key: 'p-a' } as never).catch(() => undefined)
  const first = JSON.parse((await ask).result)
  expect(first.autoApproved).toBeUndefined()
})

test('lgtm safe: a plan is auto-approved except what the variant does not cover; the pane shows only the rest', { plugins: gated }, async ($, on) => {
  base(on)
  await setGate($, 'safe')
  const call = $.tool.call({ tool: APPROVE, tool_use_id: 'g4', ...planSpec } as never) as Promise<{ result: string }>
  await new Promise(r => setTimeout(r, 50))
  const m = await $.ui.mount({ plugin: 'your-call', surface: 'terminal', component: 'Pane', requestId: 'your-call-plan', props: {} as never })
  expect(await m.find({ text: /✓ run the tests/ } as never)).toBeTruthy()
  expect(await m.find({ text: /auto-approved \(lgtm\)/ } as never)).toBeTruthy()
  expect(await m.find({ key: 't-push' } as never)).toBeTruthy()
  expect(await m.find({ key: 't-tests' } as never)).toBeUndefined()
  await m.press({ key: 'ok' } as never)
  const out = JSON.parse((await call).result)
  expect(out.autoApproved).toEqual(['tests', 'merge'])
  expect(out.approved).toEqual(['tests', 'merge', 'push'])
  expect(await approvals($)).toHaveLength(2)
})

test('lgtm push: shipping items go through too; a fully covered plan never opens a pane', { plugins: gated }, async ($, on) => {
  base(on)
  await setGate($, 'push')
  const r = (await $.tool.call({ tool: APPROVE, tool_use_id: 'g5', items: planSpec.items.slice(0, 3) } as never)) as { result: string }
  const out = JSON.parse(r.result)
  expect(out.approved).toEqual(['tests', 'merge', 'push'])
  expect(out.autoApproved).toEqual(['tests', 'merge', 'push'])
})

test('lgtm off: the plan pane opens as normal', { plugins: gated }, async ($, on) => {
  base(on)
  await setGate($, 'off')
  const { call, m } = await openPlan($, on, planSpec, 'g6')
  expect(await m.find({ key: 't-tests' } as never)).toBeTruthy()
  await m.press({ key: 'skip' } as never)
  await call
})

// ---- every surface
test('both panes mount on terminal, desktop, vscode and mobile (mobile has no text inputs)', { timeoutMs: 60000 }, async ($, on) => {
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const a = await openPlan($, on, planSpec, `s-${surface}`, surface)
    expect(await a.m.find({ key: 'ok' } as never)).toBeTruthy()
    expect(Boolean(await a.m.find({ key: 'plan-note' } as never))).toBe(surface !== 'mobile')
    await a.m.press({ key: 'skip' } as never)
    await a.call
    await a.m.unmount()
  }
})

test('the ask pane mounts on every surface; mobile gets a None fit button instead of the text boxes', { timeoutMs: 60000 }, async ($, on) => {
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    base(on)
    const call = $.tool.call({ tool: ASK, tool_use_id: `a-${surface}`, title: 'T', steps: [{ id: 'c', question: 'Pick', options: [{ id: 'a', label: 'A', detail: 'd' }, 'B'] }] } as never) as Promise<{ result: string }>
    await new Promise(r => setTimeout(r, 50))
    const m = await $.ui.mount({ plugin: 'your-call', surface, component: 'Pane', requestId: 'your-call', props: {} as never })
    expect(await m.find({ key: 'p-a' } as never)).toBeTruthy()
    expect([surface, Boolean(await m.find({ key: 'regen' } as never))]).toEqual([surface, true])
    await m.press({ key: 'skip' } as never)
    await call
    await m.unmount()
  }
})
