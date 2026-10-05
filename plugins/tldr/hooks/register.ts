import type { Hook, Register } from 'claude-code'

export type Mode = 'off' | 'on' | 'auto' | 'smart'
const MODES: Mode[] = ['off', 'on', 'auto', 'smart']
type Engine = Parameters<Hook<'session.start'>>[0]

const SHAPE = `Answer shape:
**Verdict:** one line, the answer or outcome.
**Why:** 1-3 bullets, only what the reader needs.
**Next:** the single best next step (or "none").
No preamble, no recap of the question, no code dumps (reference file:line instead).`

const SECTION: Partial<Record<Mode, string>> = {
  on: `${SHAPE}\nUse exactly this shape for every answer, max 6 lines. Detail only when the user says "expand".`,
  smart: `${SHAPE}\nUse this shape for substantive answers; trivial replies can be one line.`,
}

export const AUTO_MIN = 400
const SMART_CHARS = 1200
const SMART_LINES = 15
const SMART_TOOLS = 5

const status = ($: Engine, mode: Mode) => $.ui.status(mode === 'off' ? undefined : `tldr:${mode}`)

export const parseMode = (a: string): Mode | undefined => ((MODES as string[]).includes(a) ? (a as Mode) : undefined)

export const wantSummary = (mode: Mode, answer: string, tools: number): boolean => {
  if (mode === 'auto') return answer.length >= AUTO_MIN
  if (mode !== 'smart') return false
  return answer.length >= SMART_CHARS || answer.split('\n').length >= SMART_LINES || tools >= SMART_TOOLS
}

const summarize = async ($: Engine, text: string) => {
  const r = await $.model
    .complete({
      model: 'haiku',
      maxTokens: 150,
      prompt: `TL;DR of the message below in the shape:\nVerdict: <one line>\nWhy: <1-3 short bullets>\nNext: <one line or none>\nNo preamble.\n\n${text.slice(0, 10000)}`,
    })
    .catch(() => undefined)
  return r?.isAnswered ? r.text.trim() : undefined
}

export const register: Register = on => {
  let mode: Mode = 'smart'
  let last = ''
  let tools = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tldr',
      description: '/tldr = TL;DR of last answer; /tldr off|on|auto|smart sets mode',
    })
    const saved = await $.store.get('mode')
    if (typeof saved === 'string' && (MODES as string[]).includes(saved)) mode = saved as Mode
    status($, mode)
    return next(e)
  })

  on('command.run', { command: 'tldr' }, async ($, e) => {
    const a = e.args.trim().toLowerCase()

    if (a === '') {
      if (!last) return { text: 'tldr: nothing to summarize yet.' }
      const s = await summarize($, last)
      return { text: s ?? 'tldr: summary failed.' }
    }

    if (parseMode(a)) {
      mode = a as Mode
      await $.store.set('mode', mode)
      status($, mode)
      return { text: `tldr mode: ${mode}${mode === 'on' || mode === 'smart' ? ' (answer shape applies from next prompt)' : ''}` }
    }

    return { text: `tldr mode is ${mode}. Usage: /tldr | /tldr off|on|auto|smart` }
  })

  on('prompt.submit', ($, e, next) => {
    tools = 0
    return next(e)
  })

  on('tool.call', ($, e, next) => {
    tools += 1
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    const text = SECTION[mode]
    return text ? { sections: [...r.sections, { id: 'tldr:shape', text, scope: 'session' as const }] } : r
  })

  on('turn.complete', async ($, e, next) => {
    if (e.reason !== 'answer' || e.answer === '') return next(e)

    last = e.answer

    if (wantSummary(mode, e.answer, tools)) {
      const s = await summarize($, e.answer)
      if (s) $.ui.toast(`TL;DR\n${s}`, { timeoutMs: 20000 })
    }

    return next(e)
  })
}
