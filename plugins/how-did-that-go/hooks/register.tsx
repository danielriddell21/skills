import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Summary, TestState } from '../types'

import { RANK, chipKey, injectChips, isEmpty } from './chips'

const summary = atom({ plugin: 'how-did-that-go', key: 'summary' } as const, null)

const TEST = /\b(go test|pytest|jest|vitest|cargo test|npm (run )?test|pnpm test|yarn test|make test)\b/

export const isTestCommand = (cmd: string): boolean => TEST.test(cmd)

export const fmtDuration = (ms: number): string => {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}

export const fmtUsd = (usd: number): string => (usd < 0.01 ? '<$0.01' : `$${usd.toFixed(2)}`)

/** The one-line band text. */
export const formatSummary = (s: Summary, showCost = true): string => {
  const parts: string[] = []
  parts.push(s.files.length > 0 ? `${s.files.length} file${s.files.length === 1 ? '' : 's'}` : `${s.tools} tool call${s.tools === 1 ? '' : 's'}`)
  if (s.tests !== 'none') parts.push(`tests ${s.tests}`)
  parts.push(fmtDuration(s.ms))
  if (showCost && s.usd !== null && s.usd > 0) parts.push(fmtUsd(s.usd))
  const icon = s.reason !== 'answer' ? '⏹' : s.tests === 'fail' ? '✗' : '✓'
  return `${icon} ${parts.join(' · ')}`
}

export const register: Register = (on, options) => {
  const minTools = typeof options.minTools === 'number' ? options.minTools : 1
  let files = new Set<string>()
  let tests: TestState = 'none'
  let tools = 0
  let costBefore: number | null = null

  on('prompt.submit', async ($, e, next) => {
    files = new Set()
    tests = 'none'
    tools = 0
    const u = await $.session.usage().catch(() => undefined)
    costBefore = u?.cost?.usd ?? null
    await update($, summary, () => null)
    return next(e)
  })

  for (const tool of ['Edit', 'Write'] as const) {
    on('tool.call', { tool }, ($, e, next) => {
      tools += 1
      files.add(e.file_path)
      return next(e)
    })
  }

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    tools += 1
    const ran = await next(e)
    if (isTestCommand(e.command) && ran.deny === undefined) tests = ran.isError ? 'fail' : 'pass'
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    if (tools >= minTools || files.size > 0) {
      const u = await $.session.usage().catch(() => undefined)
      const now = u?.cost?.usd ?? null
      const usd = now !== null && costBefore !== null ? Math.max(0, now - costBefore) : null
      await update($, summary, () => ({ files: [...files], tests, tools, ms: e.durationMs, usd, reason: e.reason, isOpen: false }))
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, summary)

    if (!s || e.props.hasSurvey || e.props.isWorking) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const rest = await next(e)
    const color = s.reason !== 'answer' || s.tests === 'fail' ? 'red' : 'green'
    const names = s.files.slice(0, 8).map(f => f.split('/').slice(-2).join('/'))
    const chip = (
      <Box key={chipKey(RANK.result, 'result')}>
        <Text key="hdtg" color={color}>{formatSummary(s, options.showCost !== false)} </Text>
        {s.files.length > 0 && (
          <Button key="details" label={s.isOpen ? 'Less' : 'Details'} onPress={() => update($, summary, x => (x ? { ...x, isOpen: !x.isOpen } : x))} />
        )}
        <Button key="hide" label="Hide" onPress={() => update($, summary, () => null)} />
      </Box>
    )
    const joined = injectChips(rest, chip)
    const base = joined ?? (isEmpty(rest) ? (
      <Box key="chips" flexWrap="wrap">{chip}</Box>
    ) : (
      <Box flexDirection="column">
        <Box key="chips" flexWrap="wrap">{chip}</Box>
        {rest}
      </Box>
    ))

    if (!s.isOpen) return base as never

    return (
      <Box flexDirection="column">
        {base}
        {names.map(n => (
          <Text key={`f-${n}`} dimColor>
            {'  '}{n}
          </Text>
        ))}
        {s.files.length > names.length && <Text dimColor>{'  '}+{s.files.length - names.length} more</Text>}
      </Box>
    )
  })
}
