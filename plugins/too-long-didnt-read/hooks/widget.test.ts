import { expect, test } from 'claude-code/testing'

const long = 'word '.repeat(300)
const turn = (answer: string) => ({ answer, durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' }) as never
const reply = (text: string) => ({ value: { isAnswered: true, text, usage: { input_tokens: 1, output_tokens: 1 } } })

// Stand-in for your-call (the dependency): owns the `ready` flag the summaries check.
const yourCall = {
  name: 'your-call',
  register(on: any) {
    on('command.run', { command: 'ready' }, async ($: any) => {
      await $.state.set({ plugin: 'your-call', key: 'ready' }, true)
      return { text: 'ok' }
    })
  },
}
// Reads the published card back for the test.
const reader = {
  name: 'reader',
  register(on: any) {
    on('command.run', { command: 'read-card' }, async ($: any) => ({
      text: JSON.stringify((await $.state.get({ plugin: 'too-long-didnt-read', key: 'card' })).value ?? null),
    }))
  },
}
const plugins = [yourCall, reader] as never[]
const card = async ($: any) => JSON.parse(((await $.command.run({ command: 'read-card', args: '' } as never)) as { text: string }).text)

const base = (on: any, replies: string[], toasts: string[] = []) => {
  on('model.complete', () => reply(replies.shift() ?? '') as never)
  on('turn.complete', (_: unknown, e: { answer: string }) => ({ text: e.answer }))
  on('prompt.submit', (_: unknown, e: { text: string }) => ({ text: e.text }))
  on('tool.call', () => ({ result: 'ok' }) as never)
  on('ui.toast', (_: unknown, e: { text: string }) => {
    toasts.push(e.text)
    return { value: undefined } as never
  })
  on('ui.status', () => ({ value: undefined }) as never)
  on('store.get', () => ({ value: undefined }) as never)
}
const ready = ($: any) => $.command.run({ command: 'ready', args: '' } as never)

test('with your-call: a big answer publishes a chart chosen by the model for it to draw', { plugins }, async ($, on) => {
  base(on, ['{"type":"bars","title":"Options","values":{"Redis":8,"Mem":4}}'])
  await ready($)
  await $.turn.complete(turn(long))
  const c = await card($)
  expect(c.viz).toEqual({ type: 'bars', values: { Redis: 8, Mem: 4 }, title: 'Options' })
  expect(typeof c.id).toBe('number')
})

test('flow charts publish too', { plugins }, async ($, on) => {
  base(on, ['{"type":"flow","lanes":[["plan","build","ship"]]}'])
  await ready($)
  await $.turn.complete(turn(long))
  expect((await card($)).viz.lanes).toEqual([['plan', 'build', 'ship']])
})

test('unusable chart JSON falls back to a tree from the plain summary', { plugins }, async ($, on) => {
  base(on, ['sorry, no json', 'Use Redis\nshared and TTLs\nrun the migration'])
  await ready($)
  await $.turn.complete(turn(long))
  const nodes = (await card($)).viz.nodes.map((n: { label: string }) => n.label)
  expect(nodes).toEqual(['Verdict: Use Redis', 'Why: shared and TTLs', 'Next: run the migration'])
})

test('the chart clears when you send your next prompt', { plugins }, async ($, on) => {
  base(on, ['{"type":"flow","lanes":[["a","b"]]}'])
  await ready($)
  await $.turn.complete(turn(long))
  expect(await card($)).not.toBeNull()
  await $.prompt.submit({ text: 'next' } as never)
  expect(await card($)).toBeNull()
})

test('without your-call: says so once, then falls back to the toast', { plugins }, async ($, on) => {
  const toasts: string[] = []
  base(on, ['Use Redis\nshared and TTLs\nrun the migration', 'Use Redis\nshared and TTLs\nrun the migration'], toasts)
  await $.turn.complete(turn(long))
  await $.turn.complete(turn(long))
  expect(toasts[0]).toBe('TL;DR charts need the\nyour-call plugin. Showing text.')
  expect(toasts.filter(t => t.includes('need the')).length).toBe(1)
  expect(toasts.filter(t => t.startsWith('TL;DR Use Redis')).length).toBe(2)
  expect(await card($)).toBeNull()
})

test('widget: false keeps the old toast and never mentions your-call', { plugins, options: { widget: false } }, async ($, on) => {
  const toasts: string[] = []
  base(on, ['Use Redis\nshared and TTLs\nrun the migration'], toasts)
  await ready($)
  await $.turn.complete(turn(long))
  expect(toasts).toHaveLength(1)
  expect(toasts[0].split('\n')[0]).toBe('TL;DR Use Redis')
  expect(await card($)).toBeNull()
})

test('short answers in smart mode get nothing', { plugins }, async ($, on) => {
  const toasts: string[] = []
  base(on, ['{"type":"flow","lanes":[["a","b"]]}'], toasts)
  await ready($)
  await $.turn.complete(turn('ok done'))
  expect(await card($)).toBeNull()
  expect(toasts).toEqual([])
})
