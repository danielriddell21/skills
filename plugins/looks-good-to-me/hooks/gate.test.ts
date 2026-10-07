import { expect, test } from 'claude-code/testing'

const props = { hasSurvey: false, isWorking: false, maxRows: 10 } as never
const run = ($: any, args: string) => $.command.run({ command: 'lgtm', args }).then((r: { text: string }) => r.text)
// Tests cannot read plugin state directly, so a stand-in plugin reads the published gate for them.
const reader = {
  name: 'reader',
  register(on: any) {
    on('command.run', { command: 'read-gate' }, async ($: any) => ({
      text: JSON.stringify((await $.state.get({ plugin: 'looks-good-to-me', key: 'gate' })).value ?? null),
    }))
  },
}
const gate = ($: any) => $.command.run({ command: 'read-gate', args: '' }).then((r: { text: string }) => JSON.parse(r.text))

const base = (on: any) => {
  let now = 1000
  on('clock.now', () => ({ value: (now += 10) }) as never)
  on('prompt.submit', (_: unknown, e: { text: string }) => ({ text: e.text }))
  on('turn.complete', (_: unknown, e: { answer: string }) => ({ text: e.answer }))
  on('ui.toast', () => ({ value: undefined }) as never)
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as never)
}
const turn = { answer: 'done', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never

// Stand-ins for the plugins that act on the gate: they record what they approved in their own state.
const callStandIn = {
  name: 'your-call',
  register(on: any) {
    on('command.run', { command: 'your-call-approve' }, async ($: any, e: any) => {
      const cur = (await $.state.get({ plugin: 'your-call', key: 'approvals' })).value ?? []
      await $.state.set({ plugin: 'your-call', key: 'approvals' }, [...cur, { at: await $.clock.now(), kind: e.args.split(' ')[0], detail: e.args }])
      return { text: 'ok' }
    })
  },
}
const askStandIn = {
  name: 'are-you-sure-bro',
  register(on: any) {
    on('command.run', { command: 'are-you-sure-bro-approve' }, async ($: any, e: any) => {
      const cur = (await $.state.get({ plugin: 'are-you-sure-bro', key: 'approvals' })).value ?? []
      await $.state.set({ plugin: 'are-you-sure-bro', key: 'approvals' }, [...cur, { at: await $.clock.now(), kind: e.args.split(' ')[0], detail: e.args }])
      return { text: 'ok' }
    })
  },
}

test('off by default: the published gate allows nothing', { plugins: [reader as never] }, async ($, on) => {
  base(on)
  expect(await gate($)).toBeNull()
})

test('armed is not active: the allow flags appear only once the turn starts', { plugins: [reader as never] }, async ($, on) => {
  base(on)
  expect(await run($, '')).toContain('lgtm safe for the next turn')
  expect(await gate($)).toMatchObject({ mode: 'safe', phase: 'armed', allow: null })
  await $.prompt.submit({ text: 'go' } as never)
  const g = await gate($)
  expect(g).toMatchObject({ mode: 'safe', phase: 'active' })
  expect(g.allow.pick).toBe(true)
  expect(g.allow.danger).toBe(false)
})

test('the gate closes when the turn ends', { plugins: [reader as never] }, async ($, on) => {
  base(on)
  await run($, 'safe')
  await $.prompt.submit({ text: 'go' } as never)
  await $.turn.complete(turn)
  expect(await gate($)).toMatchObject({ mode: null, phase: 'off', allow: null })
  expect(await run($, 'status')).toContain('off')
})

test('a prompt that is not yours (a queued message) does not open the gate', { plugins: [reader as never] }, async ($, on) => {
  base(on)
  await run($, 'safe')
  await $.prompt.submit({ text: 'from a peer', origin: { kind: 'peer' } } as never)
  expect((await gate($)).phase).toBe('armed')
})

test('variants publish different flags; only yolo allows dangerous things', { plugins: [reader as never] }, async ($, on) => {
  base(on)
  const flags: Record<string, unknown> = {}
  for (const v of ['safe', 'decide', 'plan', 'push', 'yolo']) {
    await run($, v)
    await $.prompt.submit({ text: 'go' } as never)
    const a = (await gate($)).allow
    flags[v] = [a.pick, a.plan.medium, a.plan.ship, a.danger]
    await $.turn.complete(turn)
  }
  expect(flags).toEqual({
    safe: [true, true, false, false],
    decide: [true, false, false, false],
    plan: [false, true, false, false],
    push: [true, true, true, false],
    yolo: [true, true, true, true],
  })
})

test('the chip counts what the consumers approved this turn and /lgtm log lists it', { plugins: [reader, callStandIn, askStandIn] as never[] }, async ($, on) => {
  base(on)
  await run($, 'safe')
  await $.prompt.submit({ text: 'go' } as never)
  await $.command.run({ command: 'your-call-approve', args: 'pick Which cache?' } as never)
  await $.command.run({ command: 'are-you-sure-bro-approve', args: 'danger git reset --hard' } as never)
  const m = await $.ui.mount({ plugin: 'looks-good-to-me', surface: 'terminal', component: 'AbovePrompt', props })
  expect(await m.find({ text: /✓ lgtm safe · 2 auto-approved/ } as never)).toBeTruthy()
  const log = await run($, 'log')
  expect(log).toContain('1. pick: pick Which cache?')
  expect(log).toContain('2. danger: danger git reset --hard')
})

test('the chip says it is armed, Off turns it off, yolo gets the warning chip', async ($, on) => {
  base(on)
  await run($, 'decide')
  const m = await $.ui.mount({ plugin: 'looks-good-to-me', surface: 'terminal', component: 'AbovePrompt', props })
  expect(await m.find({ text: /✓ lgtm decide \(next turn\)/ } as never)).toBeTruthy()
  await m.press({ key: 'lgtm-off' } as never)
  expect(await run($, 'status')).toContain('off')
  await run($, 'yolo')
  await m.unmount()
  const m2 = await $.ui.mount({ plugin: 'looks-good-to-me', surface: 'terminal', component: 'AbovePrompt', props })
  expect(await m2.find({ text: /⚠ lgtm yolo/ } as never)).toBeTruthy()
})

test('unknown words say what exists; a bare /lgtm uses defaultVariant', { options: { defaultVariant: 'plan' } }, async ($, on) => {
  base(on)
  expect(await run($, 'banana')).toContain('Variants: safe, decide, plan, push, yolo')
  expect(await run($, '')).toContain('lgtm plan')
})
