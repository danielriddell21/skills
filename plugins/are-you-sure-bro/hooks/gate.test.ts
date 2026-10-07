import { expect, test } from 'claude-code/testing'

const bash = ($: any, command: string) => $.tool.call({ tool: 'Bash', tool_use_id: command, command } as never) as Promise<{ deny?: string; result?: unknown }>

// Stand-in for looks-good-to-me: the owner of the gate state, set from a test command.
const gateOwner = {
  name: 'looks-good-to-me',
  register(on: any) {
    on('command.run', { command: 'set-gate' }, async ($: any, e: any) => {
      const [phase, ...flags] = e.args.split(' ')
      const allow = { pick: true, plan: { medium: true, high: false, ship: false, delete: false }, danger: flags.includes('danger'), sensitive: flags.includes('sensitive') }
      await $.state.set({ plugin: 'looks-good-to-me', key: 'gate' }, { mode: 'safe', phase, since: 0, allow })
      return { text: 'ok' }
    })
  },
}
// Reads this plugin's recorded approvals back for the test.
const reader = {
  name: 'reader',
  register(on: any) {
    on('command.run', { command: 'read-approvals' }, async ($: any) => ({
      text: JSON.stringify((await $.state.get({ plugin: 'are-you-sure-bro', key: 'approvals' })).value ?? []),
    }))
  },
}
const plugins = [gateOwner, reader] as never[]

const base = (on: any) => {
  on('clock.now', () => ({ value: 5000 }) as never)
  on('tool.call', () => ({ result: 'ran' }) as never)
}
const setGate = ($: any, args: string) => $.command.run({ command: 'set-gate', args } as never)
const approvals = async ($: any) => JSON.parse(((await $.command.run({ command: 'read-approvals', args: '' } as never)) as { text: string }).text)

test('no gate published: a dangerous command asks (blocked with nobody to answer)', { plugins }, async ($, on) => {
  base(on)
  expect((await bash($, 'git reset --hard HEAD~1')).deny).toContain('blocked')
  expect(await approvals($)).toEqual([])
})

test('gate armed but not active: still asks', { plugins }, async ($, on) => {
  base(on)
  await setGate($, 'armed danger')
  expect((await bash($, 'git reset --hard')).deny).toContain('blocked')
})

test('gate active but dangerous not allowed (safe variant): asks', { plugins }, async ($, on) => {
  base(on)
  await setGate($, 'active')
  expect((await bash($, 'git reset --hard')).deny).toContain('blocked')
})

test('gate active and dangerous allowed (yolo): runs, and the approval is recorded', { plugins }, async ($, on) => {
  base(on)
  await setGate($, 'active danger')
  const r = await bash($, 'git reset --hard HEAD~1')
  expect(r.deny).toBeUndefined()
  expect(await approvals($)).toEqual([{ at: 5000, kind: 'danger', detail: 'git reset --hard HEAD~1' }])
})

test('catastrophic commands ignore even a yolo gate', { plugins }, async ($, on) => {
  base(on)
  await setGate($, 'active danger sensitive')
  expect((await bash($, 'rm -rf ~')).deny).toContain('blocked')
  expect((await bash($, 'dd if=/dev/zero of=/dev/sda')).deny).toContain('blocked')
  expect(await approvals($)).toEqual([])
})

test('ordinary commands never touch the gate', { plugins }, async ($, on) => {
  base(on)
  await setGate($, 'active danger')
  expect((await bash($, 'git merge v4')).deny).toBeUndefined()
  expect(await approvals($)).toEqual([])
})

test('sensitive writes follow the sensitive flag', { plugins }, async ($, on) => {
  base(on)
  await setGate($, 'active danger')
  const w = () => $.tool.call({ tool: 'Write', tool_use_id: 'w', file_path: '/app/.env', content: 'x' } as never) as Promise<{ deny?: string }>
  expect((await w()).deny).toContain('blocked')
  await setGate($, 'active sensitive')
  expect((await w()).deny).toBeUndefined()
  expect((await approvals($))[0]).toMatchObject({ kind: 'sensitive', detail: '/app/.env' })
})
