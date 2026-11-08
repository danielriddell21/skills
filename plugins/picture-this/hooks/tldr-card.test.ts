import { expect, test } from 'claude-code/testing'

const text = 'The long answer about caching designs, with plenty of detail.'

// Stand-in for too-long-didnt-read: owns the `cards` state picture-this draws under the answer.
const tldr = {
  name: 'too-long-didnt-read',
  register(on: any) {
    on('command.run', { command: 'publish' }, async ($: any, e: any) => {
      const [id, ...json] = e.args.split(' ')
      const list = (await $.state.get({ plugin: 'too-long-didnt-read', key: 'cards' })).value ?? []
      await $.state.set({ plugin: 'too-long-didnt-read', key: 'cards' }, [...list, { id: Number(id), key: '61:The long answer about caching designs, with plenty of detail', viz: JSON.parse(json.join(' ')) }])
      return { text: 'ok' }
    })
  },
}
const plugins = [tldr] as never[]
const publish = ($: any, id: number, viz: object) => $.command.run({ command: 'publish', args: `${id} ${JSON.stringify(viz)}` } as never)
const base = (on: any) => on('ui.render', () => ({ type: 'Text', props: {}, children: ['the answer'] }) as never)
const mount = ($: any, surface = 'terminal', t = text) => $.ui.mount({ plugin: 'picture-this', surface, component: 'AssistantMessage', props: { text: t, isFirstOfReply: true } })

test('a summary card is drawn under its own answer only', { plugins }, async ($, on) => {
  base(on)
  await publish($, 1, { type: 'bars', title: 'Options', values: { Redis: 8, Mem: 4 } })
  const m = await mount($)
  expect(await m.find({ text: /the answer/ } as never)).toBeTruthy()
  expect(await m.find({ text: /TL;DR/ } as never)).toBeTruthy()
  expect(await m.find({ text: /Redis +█+░* 8/ } as never)).toBeTruthy()
  const other = await mount($, 'terminal', 'A different answer entirely.')
  expect(await other.find({ text: /TL;DR/ } as never)).toBeUndefined()
})

test('tree and flow cards; bars as SVG on desktop', { plugins }, async ($, on) => {
  base(on)
  await publish($, 3, { type: 'tree', title: 'TL;DR', nodes: [{ label: 'Verdict: yes' }, { label: 'Why', children: [{ label: 'cheap' }] }] })
  const t = await mount($)
  expect(await t.find({ text: /├─ Verdict: yes/ } as never)).toBeTruthy()
  await t.unmount()
  await publish($, 4, { type: 'bars', values: { Redis: 8, Mem: 4 } })
  const d = await mount($, 'desktop')
  expect(JSON.stringify(await d.drawn())).toContain('"type":"Svg"')
})
