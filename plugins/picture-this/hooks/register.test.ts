import { expect, test } from 'claude-code/testing'

import { HINT, LABELS, RULE, TOOL, fillPrompt, nextSort, varsOf } from './register'

const PLUGIN = 'picture-this'
const base = (on: any) => {
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['plain answer'] }) as never)
  on('tool.call', () => ({ result: 'base' }) as never)
}
const msg = ($: any, text: string, surface = 'terminal') => $.ui.mount({ plugin: PLUGIN, surface, component: 'AssistantMessage', props: { text, isFirstOfReply: true } })
const block = (...lines: object[]) => `Here you go.\n\`\`\`ui\n${lines.map(l => JSON.stringify(l)).join('\n')}\n\`\`\`\nDone.`

const CALC = {
  type: 'calc',
  title: 'Savings',
  inputs: [{ id: 'rate', label: 'Rate', value: 5, min: 0, max: 10, step: 1, unit: '%' }],
  outputs: [{ id: 'total', label: 'Total', formula: '100 * (1 + rate / 100)', digits: 0 }],
}

test('every classifier label but prose has a hint naming a component', () => {
  for (const k of LABELS) if (k !== 'prose') expect(HINT[k]).toContain('```ui')
  expect(RULE).toContain(TOOL)
})

test('a message without a block is left to the engine', async ($, on) => {
  base(on)
  const m = await msg($, 'just text')
  expect(await m.find({ text: /plain answer/ } as never)).toBeTruthy()
})

test('a ```ui block draws prose and components; a bad line is counted, not shown raw', async ($, on) => {
  base(on)
  const m = await msg($, `${block({ type: 'bars', title: 'Latency', values: { Redis: 8, Mem: 4 }, unit: 'ms' }, { type: 'stat', label: 'p95', value: '120 ms', delta: '-8%' })}`.replace('```\nDone', '{oops\n```\nDone'))
  expect(await m.find({ text: /Here you go/ } as never)).toBeTruthy()
  expect(await m.find({ text: /Latency/ } as never)).toBeTruthy()
  expect(await m.find({ text: /Redis █+░* 8 ms/ } as never)).toBeTruthy()
  expect(await m.find({ text: /120 ms/ } as never)).toBeTruthy()
  expect(await m.find({ text: /1 piece could not be drawn/ } as never)).toBeTruthy()
  expect(await m.find({ text: /oops/ } as never)).toBeUndefined()
})

test('streaming: finished lines draw, the rest shows drawing…', async ($, on) => {
  base(on)
  const m = await msg($, 'Look:\n```ui\n{"type":"stat","label":"Users","value":"42"}\n{"type":"ba')
  expect(await m.find({ text: /42/ } as never)).toBeTruthy()
  expect(await m.find({ text: /drawing…/ } as never)).toBeTruthy()
})

test('desktop draws charts as SVG; tables as markdown', async ($, on) => {
  base(on)
  const m = await msg($, block({ type: 'line', x: ['a', 'b'], series: { s: [1, 2] } }, { type: 'table', columns: ['A', 'B'], rows: [['x', 1], ['y', 2]] }), 'desktop')
  const drawn = JSON.stringify(await m.drawn())
  expect(drawn).toContain('"type":"Svg"')
  expect(drawn).toContain('| A | B |')
})

test('calc: + moves the input and the output follows, with no model call; Reset puts it back', async ($, on) => {
  base(on)
  on('model.complete', () => {
    throw new Error('no model call expected')
  })
  const m = await msg($, block(CALC), 'vscode')
  expect(await m.find({ text: /Total: / } as never)).toBeTruthy()
  expect(JSON.stringify(await m.drawn())).toContain('105')
  await m.press({ key: 'up-rate' } as never)
  await m.press({ key: 'up-rate' } as never)
  expect(JSON.stringify(await m.drawn())).toContain('107')
  await m.press({ key: 'reset' } as never)
  expect(JSON.stringify(await m.drawn())).toContain('105')
})

test('no Client on VS Code: a text bar with − and + instead; the terminal gets the slider', async ($, on) => {
  base(on)
  const v = JSON.stringify(await (await msg($, block(CALC), 'vscode')).drawn())
  expect(v).not.toContain('"type":"Client"')
  expect(v).toContain('░')
  const t = JSON.stringify(await (await msg($, block(CALC), 'terminal')).drawn())
  expect(t).toContain('"type":"Client"')
  expect(t).toContain('slider.tsx')
})

test('choice + send: the button puts the filled prompt in the input box, never submits', async ($, on) => {
  const filled: string[] = []
  let submitted = 0
  base(on)
  on('prompt.fill', (_: unknown, e: { text: string }) => {
    filled.push(e.text)
    return { isFilled: true } as never
  })
  on('prompt.submit', (_: unknown, e: { text: string }) => {
    submitted++
    return { text: e.text }
  })
  on('ui.toast', () => ({ value: {} }) as never)
  const m = await msg($, block(CALC, { type: 'choice', id: 'plan', label: 'Plan', options: ['Basic', 'Pro'] }, { type: 'send', label: 'Use these', prompt: 'Go with {plan} at {rate}% for {total} ({nope})' }), 'mobile')
  await m.press({ key: 'o-Pro' } as never)
  await m.press({ key: 'up-rate' } as never)
  await m.press({ key: 'send' } as never)
  expect(filled).toEqual(['Go with Pro at 6% for 106 ({nope})'])
  expect(submitted).toBe(0)
})

test('table sort buttons cycle ascending, descending, off', async ($, on) => {
  base(on)
  const m = await msg($, block({ type: 'table', columns: ['Name', 'Score'], rows: [['a', 2], ['b', 10], ['c', 1]] }))
  await m.press({ key: 'sort-Score' } as never)
  expect(await m.find({ text: /Score ↑/ } as never)).toBeTruthy()
  await m.press({ key: 'sort-Score' } as never)
  expect(await m.find({ text: /Score ↓/ } as never)).toBeTruthy()
  expect(nextSort({ col: 1, desc: true }, 1)).toBeUndefined()
})

test('the show tool keeps what it drew for its result row; nothing drawable is an error for Claude', async ($, on) => {
  base(on)
  const bad = await $.tool.call({ tool: TOOL, tool_use_id: 'b1', components: [{ type: 'nope' }] } as never)
  expect(JSON.stringify(bad)).toContain('nothing drawable')
  const ok = await $.tool.call({ tool: TOOL, tool_use_id: 'u1', title: 'Plan', components: [{ type: 'flow', lanes: [['a', 'b']] }] } as never)
  expect(JSON.stringify(ok)).toContain('"shown":1')
  const r = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'ToolResult', requestId: 'u1', props: { tool: TOOL, tool_use_id: 'u1', output: {}, isErrored: false } } as never)
  expect(await r.find({ text: /a ──▶ b/ } as never)).toBeTruthy()
})

// Stand-in for matchmaker, switched on: it classifies every prompt itself.
const matchmaker = {
  name: 'matchmaker',
  register(on: any) {
    on('command.run', { command: 'mm-on' }, async ($: any) => {
      await $.state.set({ plugin: 'matchmaker', key: 'isOff' }, false)
      return { text: 'ok' }
    })
  },
}

test('while matchmaker is on, picture-this does not classify (one call per prompt)', { plugins: [matchmaker] as never[] }, async ($, on) => {
  let calls = 0
  on('model.classify', () => {
    calls++
    return { value: 'chart' } as never
  })
  on('prompt.submit', (_: unknown, e: { text: string }) => ({ text: e.text }))
  await $.command.run({ command: 'mm-on', args: '' } as never)
  await $.prompt.submit({ text: 'how much would I save at different interest rates over ten years' } as never)
  expect(calls).toBe(0)
})

test('the classifier hints a component', async ($, on) => {
  const seen: (readonly string[] | undefined)[] = []
  on('model.classify', () => ({ value: 'calculator' }) as never)
  on('prompt.submit', (_: unknown, e: { text: string; context?: readonly string[] }) => {
    seen.push(e.context)
    return { text: e.text }
  })
  await $.prompt.submit({ text: 'how much would I save at different interest rates over ten years' } as never)
  expect((seen[0] ?? []).join()).toContain('calc')
})

test('pure helpers: vars and prompt filling', () => {
  const vars = varsOf([CALC as never], 's', { 's/rate': 10 })
  expect(vars).toEqual({ rate: 10, total: 110 })
  expect(fillPrompt('{rate} and {x}', { rate: 1234.5 })).toBe('1,234.50 and {x}')
})
