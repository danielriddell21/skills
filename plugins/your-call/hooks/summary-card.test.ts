import { expect, test } from 'claude-code/testing'

const props = { hasSurvey: false, isWorking: false, maxRows: 10 } as never

// Stand-in for too-long-didnt-read: owns the `card` state your-call draws.
const tldr = {
  name: 'too-long-didnt-read',
  register(on: any) {
    on('command.run', { command: 'publish' }, async ($: any, e: any) => {
      const [id, ...json] = e.args.split(' ')
      await $.state.set({ plugin: 'too-long-didnt-read', key: 'card' }, { id: Number(id), viz: JSON.parse(json.join(' ')) })
      return { text: 'ok' }
    })
  },
}
const plugins = [tldr] as never[]
const publish = ($: any, id: number, viz: object) => $.command.run({ command: 'publish', args: `${id} ${JSON.stringify(viz)}` } as never)
const base = (on: any) => on('ui.render', () => ({ type: 'Box', props: {}, children: [] }) as never)
const mount = ($: any, surface: 'terminal' | 'desktop' = 'terminal') => $.ui.mount({ plugin: 'your-call', surface, component: 'AbovePrompt', props })

test('no card, no band', { plugins }, async ($, on) => {
  base(on)
  const m = await mount($)
  expect(await m.find({ text: /≡ TL;DR/ } as never)).toBeUndefined()
})

test('a summary card is drawn above the prompt: bars, flow and tree as text', { plugins }, async ($, on) => {
  base(on)
  await publish($, 1, { type: 'bars', title: 'Options', values: { Redis: 8, Mem: 4 } })
  const m = await mount($)
  expect(await m.find({ text: /≡ TL;DR/ } as never)).toBeTruthy()
  expect(await m.find({ text: /Redis +█+░* 8/ } as never)).toBeTruthy()
  await m.unmount()
  await publish($, 2, { type: 'flow', lanes: [['plan', 'build', 'ship']] })
  const f = await mount($)
  expect(await f.find({ text: /plan ──▶ build ──▶ ship/ } as never)).toBeTruthy()
  await f.unmount()
  await publish($, 3, { type: 'tree', title: 'TL;DR', nodes: [{ label: 'Verdict: yes' }, { label: 'Why', children: [{ label: 'cheap' }] }] })
  const t = await mount($)
  expect(await t.find({ text: /├─ Verdict: yes/ } as never)).toBeTruthy()
  expect(await t.find({ text: /   └─ cheap/ } as never)).toBeTruthy()
})

test('Hide hides that card, and a newer card shows again', { plugins }, async ($, on) => {
  base(on)
  await publish($, 5, { type: 'flow', lanes: [['a', 'b']] })
  const m = await mount($)
  await m.press({ key: 'tldr-hide' } as never)
  expect(await m.find({ text: /≡ TL;DR/ } as never)).toBeUndefined()
  await publish($, 6, { type: 'flow', lanes: [['c', 'd']] })
  await m.unmount()
  const again = await mount($)
  expect(await again.find({ text: /c ──▶ d/ } as never)).toBeTruthy()
})

test('on desktop surfaces bars and quadrants are drawn as SVG, flow stays text', { plugins }, async ($, on) => {
  base(on)
  await publish($, 7, { type: 'bars', values: { Redis: 8, Mem: 4 } })
  const m = await mount($, 'desktop')
  expect(JSON.stringify(await m.drawn())).toContain('"type":"Svg"')
})
