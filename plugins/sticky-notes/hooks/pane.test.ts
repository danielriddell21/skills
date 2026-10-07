import { expect, test } from 'claude-code/testing'

const TOOL = 'mcp__sticky-notes__tasks'

test('tool adds notes, pane shows a Done button, pressing it ticks the note', async ($, on) => {
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as never)
  const add = (await $.tool.call({ tool: TOOL, tool_use_id: 't1', action: 'add', text: 'write tests' } as never)) as { result: string }
  expect(add.result).toBe('[ ] 1 write tests')
  const m = await $.ui.mount({ plugin: 'sticky-notes', surface: 'terminal', component: 'Pane', requestId: 'sticky', props: {} as never })
  expect(await m.find({ key: 'd1' } as never)).toBeTruthy()
  await m.press({ key: 'd1' } as never)
  const list = (await $.tool.call({ tool: TOOL, tool_use_id: 't2', action: 'list' } as never)) as { result: string }
  expect(list.result).toBe('[x] 1 write tests')
})

test('add a note from the pane, tick it, then clear the done ones', async ($, on) => {
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as never)
  const m = await $.ui.mount({ plugin: 'sticky-notes', surface: 'terminal', component: 'Pane', requestId: 'sticky', props: {} as never })
  expect(await m.find({ text: /Nothing yet/ } as never)).toBeTruthy()
  await m.input({ key: 'add', text: 'buy milk' } as never)
  expect(await m.find({ text: /☐ buy milk/ } as never)).toBeTruthy()
  expect(await m.find({ text: /0\/1 done/ } as never)).toBeTruthy()
  await m.press({ key: 'd1' } as never)
  expect(await m.find({ text: /☑ buy milk/ } as never)).toBeTruthy()
  expect(await m.find({ text: /1\/1 done/ } as never)).toBeTruthy()
  await m.press({ key: 'clear' } as never)
  expect(await m.find({ text: /Nothing yet/ } as never)).toBeTruthy()
})
