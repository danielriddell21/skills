import { atom, update } from 'claude-code'
import type { Hook, Register } from 'claude-code'

import type { Card } from '../types'

import { fitToast } from './toast'
import { answerKey, normalizeViz, parseJsonLoose, toastLines, treeFromSummary } from './viz'

const cards = atom({ plugin: 'too-long-didnt-read', key: 'cards' } as const, [] as Card[])
const MAX_CARDS = 20

export const NEEDS_YOUR_CALL = 'TL;DR charts need the\nyour-call plugin. Showing text.'

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

const status = ($: Engine, mode: Mode) => $.ui.status(mode === 'off' ? undefined : `tldr ${mode}`)

export const parseMode = (a: string): Mode | undefined => ((MODES as string[]).includes(a) ? (a as Mode) : undefined)

export const wantSummary = (mode: Mode, answer: string, tools: number): boolean => {
  if (mode === 'auto') return answer.length >= AUTO_MIN
  if (mode !== 'smart') return false
  return answer.length >= SMART_CHARS || answer.split('\n').length >= SMART_LINES || tools >= SMART_TOOLS
}

const FULL = (text: string) =>
  `TL;DR of the message below in the shape:\nVerdict: <one line>\nWhy: <1-3 short bullets>\nNext: <one line or none>\nNo preamble.\n\n${text.slice(0, 10000)}`

// The toast shows three lines of 40 columns, so ask for exactly that instead of cutting a long answer.
const SHORT = (text: string) =>
  `Summarize the message below in exactly 3 lines, no labels, no bullets, no quotes:\nline 1: the answer or outcome (at most 32 characters)\nline 2: the main reason (at most 38 characters)\nline 3: the next step, or "nothing to do" (at most 38 characters)\n\n${text.slice(0, 10000)}`

/** The toast text: a TL;DR header on line 1 is not worth a line, so the verdict leads and carries the prefix. */
export const toastFrom = (summary: string): string => {
  const lines = summary.split('\n').map(l => l.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean)
  if (lines.length === 0) return ''
  return fitToast([`TL;DR ${lines[0]}`, ...lines.slice(1)].join('\n'))
}

// Pick the shape by content: numbers across options -> bars, an ordered plan -> flow, anything else -> tree.
const CHART = (text: string) =>
  `Describe the message below as ONE small chart. Reply with only JSON, no prose. Pick the shape by content:\n- compares options with numbers or scores: {"type":"bars","title":"...","values":{"Option A":8,"Option B":5}} (2-6 options)\n- an ordered procedure or plan: {"type":"flow","title":"...","lanes":[["step 1","step 2","step 3"]]} (2-6 steps)\n- anything else: {"type":"tree","title":"TL;DR","nodes":[{"label":"Verdict: ..."},{"label":"Why","children":[{"label":"..."},{"label":"..."}]},{"label":"Next: ..."}]}\nEvery label at most 36 characters.\n\n${text.slice(0, 10000)}`

const summarize = async ($: Engine, text: string, short = false) => {
  const r = await $.model
    .complete({
      model: 'haiku',
      maxTokens: 150,
      prompt: short ? SHORT(text) : FULL(text),
    })
    .catch(() => undefined)
  return r?.isAnswered ? r.text.trim() : undefined
}

/** A chart for the message, chosen by what it says; a plain tree from the three-line summary if that fails. */
const summarizeViz = async ($: Engine, text: string) => {
  const r = await $.model.complete({ model: 'haiku', maxTokens: 400, prompt: CHART(text) }).catch(() => undefined)
  const viz = r?.isAnswered ? normalizeViz(parseJsonLoose(r.text)) : undefined
  if (viz) return viz
  const plain = await summarize($, text, true)
  return plain ? treeFromSummary(plain) : undefined
}

const isDrawn = async ($: Engine): Promise<boolean> => (await $.state.get({ plugin: 'your-call', key: 'ready' })).value === true

/** A small summary is a toast; anything bigger is a chart under the answer it summarises. False when no chart could be made. */
async function showSummary($: Engine, answer: string): Promise<boolean> {
  const viz = await summarizeViz($, answer)
  if (!viz) return false
  const lines = toastLines(viz)
  if (lines) $.ui.toast(fitToast(lines.join('\n')), { timeoutMs: 20000 })
  else await update($, cards, list => [...list, { id: Date.now(), key: answerKey(answer), viz }].slice(-MAX_CARDS))
  return true
}

async function toastSummary($: Engine, answer: string): Promise<void> {
  const s = await summarize($, answer, true)
  const text = s ? toastFrom(s) : ''
  if (text) $.ui.toast(text, { timeoutMs: 20000 })
}

export const register: Register = (on, options) => {
  let mode: Mode = parseMode(String(options.defaultMode ?? '')) ?? 'smart'
  let last = ''
  let toldAboutYourCall = false
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
      let done = false
      if (options.widget !== false) {
        // The chart is drawn by your-call (a dependency); without it, say so once and fall back to the toast.
        if (await isDrawn($)) done = await showSummary($, e.answer)
        else if (!toldAboutYourCall) {
          toldAboutYourCall = true
          $.ui.toast(NEEDS_YOUR_CALL, { timeoutMs: 8000 })
        }
      }
      // Widget off, or no chart could be made: the old three-line toast.
      if (!done) await toastSummary($, e.answer)
    }

    return next(e)
  })
}
