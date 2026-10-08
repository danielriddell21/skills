import { expect, test } from 'claude-code/testing'

import { fmtDuration, fmtUsd, formatSummary, isTestCommand } from './register'

const s = (o: object = {}) => ({ files: ['a.go', 'b.go'], tests: 'pass', tools: 4, ms: 41000, usd: 0.123, reason: 'answer', isOpen: false, ...o }) as never

test('format helpers', () => {
  expect([fmtDuration(900), fmtDuration(41000), fmtDuration(125000)]).toEqual(['1s', '41s', '2m05s'])
  expect([fmtUsd(0.004), fmtUsd(0.123), fmtUsd(12)]).toEqual(['<$0.01', '$0.12', '$12.00'])
})

test('summary line', () => {
  expect(formatSummary(s())).toBe('✓ 2 files · tests pass · 41s · $0.12')
  expect(formatSummary(s({ files: ['a'], tests: 'none', usd: null }))).toBe('✓ 1 file · 41s')
  expect(formatSummary(s({ files: [], tools: 3, tests: 'fail' }))).toBe('✗ 3 tool calls · tests fail · 41s · $0.12')
  expect(formatSummary(s({ reason: 'aborted' }))).toContain('⏹')
  expect(formatSummary(s(), false)).not.toContain('$')
})

test('test command detection', () => {
  for (const c of ['go test ./...', 'pytest -q', 'npm test', 'npm run test', 'make test', 'cargo test']) expect(isTestCommand(c)).toBe(true)
  for (const c of ['go build', 'ls', 'git status']) expect(isTestCommand(c)).toBe(false)
})
