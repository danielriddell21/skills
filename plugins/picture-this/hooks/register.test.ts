import { expect, test } from 'claude-code/testing'

import { RULE, TOOL } from './register'

const PLUGIN = 'picture-this'
const base = (on: any) => {
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['plain answer'] }) as never)
  on('tool.call', () => ({ result: 'base' }) as never)
}
const msg = ($: any, text: string, surface = 'terminal') => $.ui.mount({ plugin: PLUGIN, surface, component: 'AssistantMessage', props: { text, isFirstOfReply: true } })
const block = (...lines: object[]) => `Here you go.\n\`\`\`ui\n${lines.map(l => JSON.stringify(l)).join('\n')}\n\`\`\`\nDone.`
const GRAPH = { type: 'graph', title: 'Services', nodes: [{ id: 'api', label: 'API', hot: true }, { id: 'db', label: 'DB' }], edges: [['api', 'db', 'reads']] }

test('the rule gates on complexity, asks first, and points at the host for tables and choices', () => {
  expect(RULE).toContain(TOOL)
  expect(RULE).toContain('AskUserQuestion')
  expect(RULE).toContain('markdown table')
})

test('a message without a block is left to the engine', async ($, on) => {
  base(on)
  const m = await msg($, 'just text')
  expect(await m.find({ text: /plain answer/ } as never)).toBeTruthy()
})

test('terminal: prose and a text diagram; a bad line is counted, not shown raw', async ($, on) => {
  base(on)
  const m = await msg($, block(GRAPH).replace('```\nDone', '{oops\n```\nDone'))
  expect(await m.find({ text: /Here you go/ } as never)).toBeTruthy()
  expect(await m.find({ text: /Services/ } as never)).toBeTruthy()
  expect(await m.find({ text: /● API ─▶ DB \(reads\)/ } as never)).toBeTruthy()
  expect(await m.find({ text: /1 piece could not be drawn/ } as never)).toBeTruthy()
  expect(await m.find({ text: /oops/ } as never)).toBeUndefined()
})

test('streaming: finished lines draw, the rest shows drawing…', async ($, on) => {
  base(on)
  const m = await msg($, 'Look:\n```ui\n{"type":"flow","lanes":[["a","b"]]}\n{"type":"gr')
  expect(await m.find({ text: /a ──▶ b/ } as never)).toBeTruthy()
  expect(await m.find({ text: /drawing…/ } as never)).toBeTruthy()
})

for (const surface of ['desktop', 'mobile', 'vscode'])
  test(`${surface}: diagrams are interactive SVG with an alt that says what they hold`, async ($, on) => {
    base(on)
    const drawn = JSON.stringify(await (await msg($, block(GRAPH, { type: 'sequence', steps: [['C', 'S', 'get']] }), surface)).drawn())
    expect(drawn).toContain('"type":"Svg"')
    expect(drawn).toContain('"isInteractive":true')
    expect(drawn).toContain('Services: 2 parts, 1 links')
  })

test('the show tool keeps what it drew for its result row; nothing drawable is an error for Claude', async ($, on) => {
  base(on)
  const bad = await $.tool.call({ tool: TOOL, tool_use_id: 'b1', components: [{ type: 'calc' }] } as never)
  expect(JSON.stringify(bad)).toContain('nothing drawable')
  const ok = await $.tool.call({ tool: TOOL, tool_use_id: 'u1', title: 'Plan', components: [{ type: 'flow', lanes: [['a', 'b']] }] } as never)
  expect(JSON.stringify(ok)).toContain('"shown":1')
  const r = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'ToolResult', requestId: 'u1', props: { tool: TOOL, tool_use_id: 'u1', output: {}, isErrored: false } } as never)
  expect(await r.find({ text: /a ──▶ b/ } as never)).toBeTruthy()
})

test('no model call per prompt: the classifier is gone', async ($, on) => {
  let calls = 0
  on('model.classify', () => {
    calls++
    return { value: 'chart' } as never
  })
  on('prompt.submit', (_: unknown, e: { text: string }) => ({ text: e.text }))
  await $.prompt.submit({ text: 'explain how the request flows through all of our nine services' } as never)
  expect(calls).toBe(0)
})

const TOUR = {
  type: 'tour',
  title: 'How a request moves',
  nodes: [{ id: 'web', label: 'Web' }, { id: 'api', label: 'API' }, { id: 'db', label: 'DB' }],
  edges: [['web', 'api'], ['api', 'db', 'reads']],
  steps: [{ focus: ['web', 'api'], text: 'Every request enters at the API' }, { focus: ['api', 'db'], text: 'Then it reads the DB' }],
}

test('tour: Next and Back step through, lighting each step; no model call', async ($, on) => {
  base(on)
  on('model.complete', () => {
    throw new Error('no model call expected')
  })
  const text = block(TOUR)
  const k = `${text.trim().length}:${text.trim().slice(0, 60)}#0#0`
  const m = await msg($, text)
  expect(await m.find({ text: /2 steps\. Press Next/ } as never)).toBeTruthy()
  await m.press({ key: `${k}-next` } as never)
  expect(await m.find({ text: /1\/2/ } as never)).toBeTruthy()
  expect(await m.find({ text: /● Web +─▶ API/ } as never)).toBeTruthy()
  await m.press({ key: `${k}-next` } as never)
  expect(await m.find({ text: /Then it reads the DB/ } as never)).toBeTruthy()
  expect(await m.find({ text: /Overview/ } as never)).toBeTruthy()
  await m.press({ key: `${k}-back` } as never)
  expect(await m.find({ text: /1\/2/ } as never)).toBeTruthy()
})

test('tour on desktop: the lit step is SVG with the rest dimmed', async ($, on) => {
  base(on)
  const text = block(TOUR)
  const k = `${text.trim().length}:${text.trim().slice(0, 60)}#0#0`
  const m = await msg($, text, 'desktop')
  await m.press({ key: `${k}-next` } as never)
  const drawn = JSON.stringify(await m.drawn())
  expect(drawn).toContain('"type":"Svg"')
  expect(drawn).toContain('n dm')
  expect(drawn).toContain('a 2-step tour of 3 parts')
})

test('zoom: ⊕ opens a part, the back button returns; local, no model call', async ($, on) => {
  base(on)
  const spec = { type: 'graph', title: 'Shop', nodes: [{ id: 'web', label: 'Web' }, { id: 'core', label: 'Core', inside: { nodes: ['http', 'orders'], edges: [['http', 'orders']] } }], edges: [['web', 'core']] }
  const text = block(spec)
  const k = `${text.trim().length}:${text.trim().slice(0, 60)}#0#0`
  const m = await msg($, text)
  expect(await m.find({ text: /Core ⊕/ } as never)).toBeTruthy()
  await m.press({ key: `${k}-in-core` } as never)
  expect(await m.find({ text: /http +─▶ orders/ } as never)).toBeTruthy()
  await m.press({ key: `${k}-up` } as never)
  expect(await m.find({ text: /Core ⊕/ } as never)).toBeTruthy()
})
