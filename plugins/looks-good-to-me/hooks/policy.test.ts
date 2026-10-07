import { expect, test } from 'claude-code/testing'

import { allow, matrixFor, parse, permits, VARIANTS } from './policy'
import type { Action, Kind, Risk } from './policy'

test('nothing is approved without a variant', () => {
  for (const kind of ['pick', 'plan', 'danger', 'sensitive'] as const) {
    expect(allow(null, kind, { recommended: true, risk: 'low' })).toBe(false)
    expect(allow(undefined, kind)).toBe(false)
  }
})

test('picks need a recommended option, and not in plan-only mode', () => {
  for (const v of ['safe', 'decide', 'push'] as const) {
    expect([v, allow(v, 'pick', { recommended: true })]).toEqual([v, true])
    expect([v, allow(v, 'pick', { recommended: false })]).toEqual([v, false])
  }
  expect(allow('plan', 'pick', { recommended: true })).toBe(false)
})

test('plan items: low/medium only, no delete, ship actions only in push, none in decide', () => {
  expect(allow('safe', 'plan', { risk: 'low', action: 'edit' })).toBe(true)
  expect(allow('plan', 'plan', { risk: 'medium', action: 'read' })).toBe(true)
  expect(allow('safe', 'plan', {})).toBe(true)
  expect(allow('safe', 'plan', { risk: 'high', action: 'edit' })).toBe(false)
  expect(allow('safe', 'plan', { risk: 'low', action: 'delete' })).toBe(false)
  expect(allow('safe', 'plan', { risk: 'low', action: 'ship' })).toBe(false)
  expect(allow('plan', 'plan', { risk: 'low', action: 'ship' })).toBe(false)
  expect(allow('push', 'plan', { risk: 'low', action: 'ship' })).toBe(true)
  expect(allow('push', 'plan', { risk: 'high', action: 'ship' })).toBe(false)
  expect(allow('decide', 'plan', { risk: 'low', action: 'edit' })).toBe(false)
})

test('dangerous commands and sensitive writes are only ever approved by yolo', () => {
  for (const v of VARIANTS) {
    expect([v, allow(v, 'danger'), allow(v, 'sensitive')]).toEqual([v, v === 'yolo', v === 'yolo'])
  }
  expect(allow('yolo', 'plan', { risk: 'high', action: 'delete' })).toBe(true)
})

test('parse: variants, off, status, log', () => {
  expect(parse('')).toEqual({ cmd: 'arm', mode: undefined })
  expect(parse(' Push ')).toEqual({ cmd: 'arm', mode: 'push' })
  expect(parse('ship')).toEqual({ cmd: 'arm', mode: 'push' })
  expect(parse('yolo')).toEqual({ cmd: 'arm', mode: 'yolo' })
  expect(parse('fuckit')).toEqual({ cmd: 'arm', mode: 'yolo' })
  expect(parse('Fuck  it')).toEqual({ cmd: 'arm', mode: 'yolo' })
  expect(parse('fuck')).toEqual({ cmd: 'unknown', word: 'fuck' })
  expect(parse('off')).toEqual({ cmd: 'off' })
  expect(parse('stop')).toEqual({ cmd: 'off' })
  expect(parse('status')).toEqual({ cmd: 'status' })
  expect(parse('log')).toEqual({ cmd: 'log' })
  expect(parse('banana')).toEqual({ cmd: 'unknown', word: 'banana' })
})

test('the published flags give exactly the same answer as the policy, for every variant and input', () => {
  const risks: (Risk | undefined)[] = [undefined, 'low', 'medium', 'high']
  const actions: (Action | undefined)[] = [undefined, 'read', 'edit', 'ship', 'delete', 'other']
  for (const mode of [null, ...VARIANTS]) {
    const m = matrixFor(mode)
    for (const kind of ['danger', 'sensitive'] as Kind[]) expect([mode, kind, permits(m, kind)]).toEqual([mode, kind, allow(mode, kind)])
    for (const recommended of [true, false]) expect([mode, recommended, permits(m, 'pick', { recommended })]).toEqual([mode, recommended, allow(mode, 'pick', { recommended })])
    for (const risk of risks) for (const action of actions) {
      expect([mode, risk, action, permits(m, 'plan', { risk, action })]).toEqual([mode, risk, action, allow(mode, 'plan', { risk, action })])
    }
  }
  expect(permits(null, 'pick', { recommended: true })).toBe(false)
})
