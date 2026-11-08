import { expect, test } from 'claude-code/testing'

import { SKINS_NOTE, skinPalette } from './register'

// Stand-in for the skins mod: publishes the state picture-this reads.
const skins = {
  name: 'skins',
  register(on: any) {
    on('command.run', { command: 'skin' }, async ($: any, e: any) => {
      const [skin, light, tables] = e.args.split(' ')
      await $.state.set({ plugin: 'skins', key: 'prefs' }, { skin, tables: tables ?? 'on' })
      await $.state.set({ plugin: 'skins', key: 'isLight' }, light === 'light')
      await $.state.set({ plugin: 'skins', key: 'custom' }, { mine: { base: 'tokyo-night', palette: { write: '#123456' } } })
      return { text: 'ok' }
    })
  },
}
const plugins = [skins] as never[]
const base = (on: any) => on('ui.render', (_: unknown, e: any) => ({ type: 'Text', props: {}, children: [String(e.props?.text ?? '')] }) as never)
const block = 'Look:\n```ui\n{"type":"graph","nodes":[{"id":"a","label":"A","hot":true},"b"],"edges":[["a","b"]]}\n```'
const svgOf = async ($: any) => JSON.stringify(await (await $.ui.mount({ plugin: 'picture-this', surface: 'desktop', component: 'AssistantMessage', props: { text: block, isFirstOfReply: true } })).drawn())

test('with a skin on, pictures take its colours, dark or light as skins reads it', { plugins }, async ($, on) => {
  base(on)
  await $.command.run({ command: 'skin', args: 'tokyo-night dark' } as never)
  const dark = await svgOf($)
  expect(dark).toContain('--tx:#c0caf5')
  expect(dark).toContain('--cl:#ff9e64')
  expect(dark).not.toContain('prefers-color-scheme')
  await $.command.run({ command: 'skin', args: 'tokyo-night light' } as never)
  expect(await svgOf($)).toContain('--tx:#3760bf')
})

test('a custom skin is its base with its own slots over it', { plugins }, async ($, on) => {
  base(on)
  await $.command.run({ command: 'skin', args: 'mine dark' } as never)
  const s = await svgOf($)
  expect(s).toContain('--cl:#123456')
  expect(s).toContain('--tx:#c0caf5')
})

test('skin off, or no skins mod: Claude theme or the OS, as before', { plugins }, async ($, on) => {
  base(on)
  expect(await svgOf($)).toContain('prefers-color-scheme:dark')
  await $.command.run({ command: 'skin', args: 'off dark' } as never)
  expect(await svgOf($)).toContain('prefers-color-scheme:dark')
})

test('pure: an unknown skin keeps Claude colours; the note sends pictures through the tool', () => {
  expect(skinPalette({ skin: 'nope', custom: {}, isLight: false })).toBeUndefined()
  expect(skinPalette({ skin: 'nord', custom: {}, isLight: false })?.text).toBeTruthy()
  expect(SKINS_NOTE).toContain('mcp__picture-this__show')
})
