import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Approval, PlanRow, PlanView, Step, View } from '../types'

import { cardLines } from './card'
import { defaultTicks, gatePermitsItem, normalizePlan } from './plan'
import type { PlanItem } from './plan'
import { CONFIDENCE, OTHER, initialPicks, isComplete, lastKey, nextVisible, prevVisible, recommendedFor, redoOf, resetDependents, resumeFrom, toggleVeto, undoOf, visibleIdx, weightKey, weightOf, weightedTotals, withUndo } from './flow'
import { normalizeSpec } from './spec'
import { answerKey, splitViz, svgFor, textLines } from './viz'

const PANE = 'your-call'
const TOOL = 'mcp__your-call__ask'
const view = atom({ plugin: 'your-call', key: 'view' } as const, null)
const plan = atom({ plugin: 'your-call', key: 'plan' } as const, null)
const approvals = atom({ plugin: 'your-call', key: 'approvals' } as const, [])
const ready = atom({ plugin: 'your-call', key: 'ready' } as const, false)
const PLAN_PANE = 'your-call-plan'
const APPROVE = 'mcp__your-call__approve'

const RULE = `When a request is ambiguous, has several viable approaches, or needs the user's preference on a non-trivial choice, do NOT guess: call the \`${TOOL}\` tool (use it instead of the built-in AskUserQuestion, never both). For one simple question send just {question, options: ["A","B"], recommended: "A", why} or {question, yesno: true}; use steps for anything richer. Give 2-6 options with short labels, a one-line detail, and pros/cons when they differ. Use kind "many" for multi-select, "rank" to prioritise, "compare" with criteria (scores 1-5) for tradeoffs; use several steps for a dependent multi-part problem, and showIf ({step, picked?, notPicked?}, naming an earlier step) to ask a step only when an earlier answer calls for it. In compare steps give each criterion an optional weight 0-10 (default 5); the user can change weights live and the result returns the final weights and the leader. The answer returns the user's picks, per-option notes, or {regenerate: guidance} meaning propose different options. Add a \`viz\` (bars, quadrant, tree, flow) to a step only when a picture clarifies a complex tradeoff or structure, never as decoration. Mark the option you would pick with recommended: true and give the step a one-line why. If you polled ask-the-audience, pass its tally as audience: {votes: {optionId: count}}. Set measured: true on a compare step only when its scores are real measurements, not your estimates. The user may also type their own answer (returned as other). Other results: {explain: {step, option, label}, state} means explain that option in a sentence or two, then call this tool again with the same steps plus resume: <the state you got>; {deferred: true, state} means carry on with a safe, reversible default, say what you assumed, and re-ask later; {regenerate, vetoed} means propose new options and never offer a vetoed one again; decisions may carry confidence (low/medium/high) and vetoed. Before doing several things the user has not seen (commands to run, files to change, a push), call \`${APPROVE}\` with items [{label, command?, detail?, risk: low|medium|high, action: read|edit|ship|delete|other}] and do only what comes back in approved. Skip the tools for trivial or clearly-specified work.`

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    question: { type: 'string', description: 'Shorthand for one question: use with options (strings), or yesno: true' },
    options: { type: 'array', items: { type: 'string' }, description: 'Shorthand: the choices for `question`' },
    yesno: { type: 'boolean', description: 'Shorthand: a Yes/No question' },
    multi: { type: 'boolean', description: 'Shorthand: allow several answers' },
    recommended: { type: 'string', description: 'Shorthand: the option you would pick (label)' },
    why: { type: 'string', description: 'Shorthand: one line on why the recommended option' },
    resume: { type: 'object', description: 'The state from a previous explain/defer/regenerate result, to continue where the user left off' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'question', 'options'],
        properties: {
          id: { type: 'string' },
          question: { type: 'string' },
          kind: { type: 'string', enum: ['one', 'many', 'rank', 'compare'] },
          options: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'label'],
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                detail: { type: 'string' },
                pros: { type: 'array', items: { type: 'string' } },
                cons: { type: 'array', items: { type: 'string' } },
                recommended: { type: 'boolean', description: 'The option you would pick; it starts selected' },
              },
            },
          },
          viz: {
            type: 'object',
            description:
              'Optional chart, only when a picture clarifies a complex tradeoff or structure. {type:"bars",values:{optId:n}} | {type:"quadrant",x,y,points:[{id,x:0-10,y:0-10}]} | {type:"tree",nodes:[{label,children}]} | {type:"flow",lanes:[[stepA,stepB],...]}',
          },
          why: { type: 'string', description: 'One line: why the recommended option' },
          measured: { type: 'boolean', description: 'true only if compare scores are measurements, not estimates' },
          audience: {
            type: 'object',
            description: 'Tally from ask-the-audience: {votes: {optionId: count}}',
            properties: { votes: { type: 'object' } },
          },
          showIf: {
            type: 'object',
            description: 'Show this step only if an earlier step (by id) had one of `picked` options chosen, or none of `notPicked`.',
            properties: {
              step: { type: 'string' },
              picked: { type: 'array', items: { type: 'string' } },
              notPicked: { type: 'array', items: { type: 'string' } },
            },
          },
          criteria: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'scores'],
              properties: { name: { type: 'string' }, scores: { type: 'object' }, weight: { type: 'number', description: '0-10, default 5' } },
            },
          },
        },
      },
    },
  },
}

const APPROVE_SCHEMA = {
  type: 'object',
  required: ['items'],
  properties: {
    title: { type: 'string' },
    why: { type: 'string', description: 'One line: why this plan' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['label'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string', description: 'What will happen, in a few words' },
          command: { type: 'string', description: 'The exact command, if there is one' },
          detail: { type: 'string' },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] },
          action: { type: 'string', enum: ['read', 'edit', 'ship', 'delete', 'other'] },
        },
      },
    },
  },
}

type Spec = { title?: string; steps?: Step[] }
type State = Pick<View, 'picks' | 'notes' | 'weights' | 'vetoed' | 'others' | 'confidence'>
type Outcome =
  | { decisions: unknown[]; usedDefault?: boolean; autoApproved?: boolean }
  | { regenerate: string; vetoed?: Record<string, string[]>; state?: State }
  | { cancelled: true; timedOut?: boolean }
  | { deferred: true; state: State }
  | { explain: { step: string; option: string; label: string }; state: State }

export const stateOf = (v: View): State => ({
  picks: v.picks,
  notes: v.notes,
  weights: v.weights,
  vetoed: v.vetoed,
  others: v.others,
  confidence: v.confidence,
})

type Logged = { title: string; at: number; steps: Step[]; decisions: unknown[]; state: State }

const isSimple = (s: Step[]) =>
  s.length === 1 &&
  s[0].kind === 'one' &&
  s[0].options.length <= 4 &&
  !s[0].criteria &&
  !s[0].viz &&
  !s[0].why &&
  !s[0].audience &&
  s[0].options.every(o => !o.detail && !o.pros?.length && !o.cons?.length)

const REC = ' (Recommended)'

const labelsFor = (s: Step, picks: string[], others: Record<string, string>): string[] =>
  picks.map(id => (id === OTHER ? `Other: ${others[s.id] ?? ''}` : (s.options.find(o => o.id === id)?.label ?? id)))

/** What the model gets back: the visible steps with picks, labels, notes, other text, weights and leader. */
export const buildDecisions = (v: View, picks: Record<string, string[]> = v.picks) =>
  visibleIdx(v.steps, picks).map(i => {
    const s = v.steps[i]
    const p = picks[s.id] ?? []
    const base = {
      step: s.id,
      question: s.question,
      picks: p,
      labels: labelsFor(s, p, v.others),
      notes: Object.fromEntries(
        Object.entries(v.notes).filter(([k]) => k.startsWith(`${s.id}:`)).map(([k, t]) => [k.slice(s.id.length + 1), t]),
      ),
      other: p.includes(OTHER) ? v.others[s.id] : undefined,
      vetoed: v.vetoed[s.id]?.length ? v.vetoed[s.id] : undefined,
      confidence: v.confidence[s.id],
    }
    if (s.kind !== 'compare' || !s.criteria) return base
    return {
      ...base,
      weights: Object.fromEntries(s.criteria.map(c => [c.name, weightOf(s.id, c, v.weights)])),
      leader: weightedTotals(s, v.weights).leader,
    }
  })

const RULE_LINE = '─'.repeat(40)
// Toasts show 3 lines of 40 columns (see too-long-didnt-read/hooks/toast.ts).
export const TOASTS = { idle: 'your-call: still waiting on your answer', unplaced: 'your-call: widen the terminal or reopen to answer' }

/** A fresh view of a spec: nothing resumed, recommended options preselected. */
const blankView = (title: string, steps: Step[], picks: Record<string, string[]>): View => ({
  title,
  steps,
  idx: 0,
  picks,
  notes: {},
  phase: 'step',
  regen: '',
  weights: {},
  fromReview: false,
  others: {},
  last: {},
  vetoed: {},
  confidence: {},
  undo: [],
  redo: [],
  showAll: {},
})

const short = (q: string, n = 16) => (q.length > n ? `${q.slice(0, n - 1)}…` : q)
const num = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 ? v : d)

export const register: Register = (on, options) => {
  let finish: ((o: Outcome) => void) | null = null
  let planFinish: ((o: object) => void) | null = null
  const idleMs = num(options.idleMinutes, 5) * 60000
  const giveUpMs = num(options.giveUpMinutes, 30) * 60000
  const autoConfirm = options.autoConfirm !== false
  const remember = options.rememberPicks !== false
  const askConfidence = options.confidence !== false
  const timeoutPick = options.timeoutPick === true
  const history: Logged[] = []

  on('session.start', async ($, e, next) => {
    // Plugins that depend on this one (too-long-didnt-read) read this to know the charts will be drawn.
    await update($, ready, () => true)
    await $.tool.register({
      name: 'ask',
      description:
        'Ask the user to choose or refine via rich UI (select, multi, rank, compare matrix, multi-step wizard). Blocks until answered.',
      inputSchema: SCHEMA,
    })
    await $.tool.register({
      name: 'approve',
      description:
        'Show the user a list of things you are about to do (commands, file changes, a push) and let them approve some or all. Blocks until answered; do only what comes back in approved.',
      inputSchema: APPROVE_SCHEMA,
    })
    await $.command.register({ name: 'decisions', description: 'List this session\'s decisions; /decisions <n> reopens one' })
    return next(e)
  })

  on('command.run', { command: 'decisions' }, async ($, e) => {
    const arg = e.args.trim()
    if (history.length === 0) return { text: 'No decisions yet this session.' }
    if (!arg) {
      return {
        text: history
          .map((h, i) => {
            const picks = (h.decisions as { question?: string; labels?: string[] }[]).map(d => `${d.question ?? '?'} → ${(d.labels ?? []).join(', ') || '-'}`).join('; ')
            return `${i + 1}. ${h.title}: ${picks}`
          })
          .join('\n'),
      }
    }
    const h = history[Number(arg) - 1]
    if (!h) return { text: `No decision ${arg}. Use /decisions to list them.` }
    await $.prompt.fill({
      text: `Reopen my earlier decision "${h.title}": call ${TOOL} again with these steps and resume state so I can change my answers.\nsteps: ${JSON.stringify(h.steps)}\nresume: ${JSON.stringify(h.state)}`,
    })
    return { text: `Decision ${arg} is in the prompt box: press Enter to reopen it.` }
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    return { sections: [...r.sections, { id: 'your-call:rule', text: RULE, scope: 'session' as const }] }
  })

  // The tool only asks the user a question, so it needs no extra permission prompt on top of its own pane.
  on('tool.check', { tool: TOOL }, () => ({ decision: 'allow' as const, reason: 'your-call only asks you a question' }))
  on('tool.check', { tool: APPROVE }, () => ({ decision: 'allow' as const, reason: 'your-call only asks you to approve' }))

  let chain: Promise<unknown> = Promise.resolve()

  // Calls run one at a time: a second ask waits for the first pane to finish instead of hanging.
  on('tool.call', { tool: TOOL }, ($, e) => {
    const run = chain.then(async () => {
      const norm = normalizeSpec(e)

      if (!norm.ok) return { result: JSON.stringify({ error: norm.error }) }

      const { steps, title, warnings } = norm
      const reply = (out: Outcome) => ({ result: JSON.stringify(warnings.length ? { ...out, warnings } : out) })
      const saved = remember ? (((await $.store.get('last')) as Record<string, string[]> | undefined) ?? {}) : {}
      const remembered = (out: Outcome) => {
        if (!remember || !('decisions' in out)) return
        const next_ = { ...saved }
        for (const d of out.decisions as { question: string; picks: string[] }[]) {
          const p = d.picks.filter(x => x !== OTHER)
          if (p.length) next_[lastKey(d.question)] = p
        }
        return $.store.set('last', next_)
      }

      // /lgtm: pre-approved by the gate, so take the recommended option(s) without asking.
      const gate = ((await $.state.get({ plugin: 'looks-good-to-me', key: 'gate' })).value ?? null) as { phase?: string; mode?: string; allow?: { pick?: boolean } | null } | null
      if (gate?.phase === 'active' && gate.allow?.pick) {
        const rec = recommendedFor(steps)
        if (rec) {
          const decisions = buildDecisions(blankView(title, steps, rec), rec)
          const at = await $.clock.now()
          await update($, approvals, (l: Approval[]) => [...l, ...decisions.map(d => ({ at, kind: 'pick', detail: d.question }))].slice(-200))
          history.push({ title, at, steps, decisions, state: stateOf(blankView(title, steps, rec)) })
          return reply({ decisions, autoApproved: true })
        }
      }

      if (isSimple(steps)) {
        const s = steps[0]
        try {
          const label = await $.ui.ask(s.question, s.options.map(o => (o.recommended ? `${o.label}${REC}` : o.label)))
          const hit = s.options.find(o => o.label === label || `${o.label}${REC}` === label)
          const out: Outcome = {
            decisions: [{ step: s.id, question: s.question, picks: [hit?.id ?? OTHER], labels: [hit?.label ?? `Other: ${label}`], other: hit ? undefined : label }],
          }
          await remembered(out)
          return reply(out)
        } catch {
          return reply({ cancelled: true })
        }
      }

      const resumed = resumeFrom((e as unknown as { resume?: unknown }).resume, steps)
      const v: View = {
        title,
        steps,
        idx: 0,
        picks: { ...initialPicks(steps), ...resumed.picks },
        notes: resumed.notes ?? {},
        phase: 'step',
        regen: '',
        weights: resumed.weights ?? {},
        fromReview: false,
        others: resumed.others ?? {},
        last: Object.fromEntries(steps.map(s => [s.id, saved[lastKey(s.question)] ?? []])),
        vetoed: resumed.vetoed ?? {},
        confidence: resumed.confidence ?? {},
        undo: [],
        redo: [],
        showAll: {},
      }
      await update($, view, () => v)

      const outcome = new Promise<Outcome>(resolve => {
        finish = resolve
      })
      const timers = [
        idleMs > 0 ? $.clock.after(idleMs, () => $.ui.toast(TOASTS.idle)) : undefined,
        giveUpMs > 0
          ? $.clock.after(giveUpMs, async () => {
              const cur = await read($, view)
              const rec = timeoutPick && cur ? recommendedFor(cur.steps) : undefined
              finish?.(cur && rec ? { decisions: buildDecisions(cur, rec), usedDefault: true } : { cancelled: true, timedOut: true })
            })
          : undefined,
      ]
      const opened = await $.ui.open({ id: PANE, title: v.title, focus: true, closeOnEscape: true, rows: 20 })

      if (!opened.isPlaced) {
        finish?.({ cancelled: true })
        $.ui.toast(TOASTS.unplaced)
      }

      const out = await outcome
      const fin = await read($, view)
      for (const t of timers) t?.cancel()
      finish = null
      await update($, view, () => null)
      await $.ui.close({ id: PANE })
      await remembered(out)
      if ('decisions' in out && !('usedDefault' in out && out.usedDefault)) {
        history.push({ title: v.title, at: await $.clock.now(), steps, decisions: out.decisions, state: stateOf(fin ?? v) })
      }
      return reply(out)
    })
    chain = run.then(() => undefined, () => undefined)
    return run
  })

  // Approve-plan: the user ticks which of the things Claude is about to do may go ahead.
  on('tool.call', { tool: APPROVE }, ($, e) => {
    const run = chain.then(async () => {
      const norm = normalizePlan(e)

      if (!norm.ok) return { result: JSON.stringify({ error: norm.error }) }

      const { items, title, why, warnings } = norm
      const reply = (out: object) => ({ result: JSON.stringify(warnings.length ? { ...out, warnings } : out) })
      const g = ((await $.state.get({ plugin: 'looks-good-to-me', key: 'gate' })).value ?? null) as { phase?: string; allow?: { plan: { medium: boolean; high: boolean; ship: boolean; delete: boolean } } | null } | null
      const flags = g?.phase === 'active' ? g.allow : null
      const auto = items.filter(i => gatePermitsItem(flags, i))
      const rest = items.filter(i => !auto.includes(i))

      const logAuto = async () => {
        if (auto.length === 0) return
        const at = await $.clock.now()
        await update($, approvals, (l: Approval[]) => [...l, ...auto.map(i => ({ at, kind: 'plan', detail: i.label }))].slice(-200))
      }

      if (rest.length === 0) {
        await logAuto()
        return reply({ approved: items.map(i => i.id), rejected: [], autoApproved: auto.map(i => i.id) })
      }

      const rows: PlanRow[] = items.map(i => ({ ...i, auto: auto.includes(i) }))
      await update($, plan, () => ({ title, why, rows, ticked: defaultTicks(rest), note: '' }))
      const outcome = new Promise<object>(resolve => {
        planFinish = resolve
      })
      const opened = await $.ui.open({ id: PLAN_PANE, title, focus: true, closeOnEscape: true, rows: 20 })

      if (!opened.isPlaced) {
        planFinish?.({ cancelled: true })
        $.ui.toast(TOASTS.unplaced)
      }

      const out = await outcome
      planFinish = null
      await update($, plan, () => null)
      await $.ui.close({ id: PLAN_PANE })
      if ('approved' in out) await logAuto()
      return reply(out)
    })
    chain = run.then(() => undefined, () => undefined)
    return run
  })

  on('ui.close', ($, e, next) => {
    if (e.origin === 'person') {
      finish?.({ cancelled: true })
      planFinish?.({ cancelled: true })
    }
    return next(e)
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== TOOL && e.props.tool !== APPROVE) return next(e)
    const { Text } = $.ui.resolve(e)
    const title = (e.props.input as { title?: string } | undefined)?.title
    return (
      <Text dimColor>
        ◆ {e.props.tool === APPROVE ? 'plan' : 'your call'}: {title ?? (e.props.tool === APPROVE ? 'for approval' : 'a decision')}
        {e.props.isRunning ? ' (waiting for you)' : ''}
      </Text>
    )
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.props.tool !== TOOL && e.props.tool !== APPROVE) return next(e)
    const lines = cardLines(e.props.output)
    if (!lines) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {lines.map((l, i) => (
          <Text key={`c-${i}`} color={i === 0 ? 'cyan' : undefined} bold={i === 0}>
            {l}
          </Text>
        ))}
      </Box>
    )
  })

  // Charts in answers (```viz blocks), and the summary chart too-long-didnt-read published for this very answer.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const text = e.props.text
    const key = answerKey(text)
    const card = ((await $.state.get({ plugin: 'too-long-didnt-read', key: 'cards' })).value ?? []).filter(c => c.key === key).at(-1)
    if (!text.includes('```viz') && !card) return next(e)

    const { Box, Text, Markdown, Svg } = $.ui.resolve(e)
    const hasSvg = e.surface !== 'terminal'
    const chart = (viz: Parameters<typeof svgFor>[0], k: string) => {
      const svg = hasSvg ? svgFor(viz) : undefined
      if (svg && Svg) return <Svg key={`v${k}`} source={svg} alt={viz.title ?? 'chart'} />
      return (
        <Box key={`v${k}`} flexDirection="column">
          {textLines(viz).map((l, j) => (
            <Text key={`l${k}-${j}`}>{l}</Text>
          ))}
        </Box>
      )
    }
    const body = text.includes('```viz') ? (
      <Box flexDirection="column">
        {splitViz(text).map((s, i) => {
          if (s.kind === 'text') return <Markdown key={`t${i}`} text={s.text} />
          if (s.kind === 'pending') return <Text key={`p${i}`} dimColor>drawing chart…</Text>
          return chart(s.viz, String(i))
        })}
      </Box>
    ) : (
      await next(e)
    )

    return (
      <Box flexDirection="column">
        {body}
        {card && (
          <Box key="tldr-card" flexDirection="column">
            <Text bold color="cyan">≡ TL;DR</Text>
            {chart(card.viz, 'card')}
          </Box>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PLAN_PANE }, async ($, e) => {
    const { Box, Text, Button, Input: InputEl } = $.ui.resolve(e)
    // Mobile has no text inputs; they resolve to something that draws nothing there.
    const Input = e.surface === 'mobile' ? undefined : InputEl
    const pv = await read($, plan)

    if (!pv) return <Text dimColor>No plan pending.</Text>

    const setPlan = (fn: (x: PlanView) => PlanView) => update($, plan, x => (x ? fn(x) : x))
    const pending = pv.rows.filter(r => !r.auto)
    const autoIds = pv.rows.filter(r => r.auto).map(r => r.id)
    const ticked = pv.ticked.filter(t => pending.some(r => r.id === t))
    const done = (ids: string[]) =>
      planFinish?.({ approved: ids, rejected: pv.rows.map(r => r.id).filter(id => !ids.includes(id)), autoApproved: autoIds.length ? autoIds : undefined, note: pv.note || undefined })
    const toggle = (id: string) => setPlan(x => ({ ...x, ticked: x.ticked.includes(id) ? x.ticked.filter(t => t !== id) : [...x.ticked, id] }))
    const tone = (r: PlanRow['risk']) => (r === 'high' ? 'red' : r === 'medium' ? 'yellow' : 'green')

    return (
      <Box flexDirection="column">
        <Text bold color="cyan">◆ {pv.title}</Text>
        <Text dimColor>{RULE_LINE}</Text>
        {pv.why && <Text> {pv.why}</Text>}
        {pv.rows.map((r, i) => (
          <Box key={`pr-${r.id}`} flexDirection="column">
            {i > 0 && <Text> </Text>}
            {r.auto ? (
              <Box>
                <Text color="green">✓ {r.label}  </Text>
                <Text dimColor>auto-approved (lgtm)</Text>
              </Box>
            ) : (
              <Box>
                <Button key={`t-${r.id}`} label={`${pv.ticked.includes(r.id) ? '☑' : '☐'} ${r.label}`} onPress={() => toggle(r.id)} />
                <Text color={tone(r.risk)}>  {r.risk}</Text>
                <Text dimColor> · {r.action}</Text>
              </Box>
            )}
            {r.command && <Text dimColor>    $ {r.command}</Text>}
            {r.detail && <Text dimColor>    {r.detail}</Text>}
          </Box>
        ))}
        <Text> </Text>
        {Input && (
          <Input
            key="plan-note"
            label="note for Claude:"
            placeholder="optional"
            value={pv.note}
            submitLabel="save"
            onInput={t => setPlan(x => ({ ...x, note: t }))}
            onSubmit={() => undefined}
          />
        )}
        <Text dimColor>{RULE_LINE}</Text>
        <Box>
          <Button key="ok" label={`Approve selected (${ticked.length + autoIds.length}/${pv.rows.length})`} onPress={() => done([...autoIds, ...ticked])} />
          <Button key="all" label="Approve all" onPress={() => done(pv.rows.map(r => r.id))} />
          <Button key="none" label="Reject all" onPress={() => done(autoIds)} />
          <Button key="skip" label="Skip" onPress={() => planFinish?.({ cancelled: true })} />
        </Box>
        <Text dimColor>Esc skips · nothing runs that is not ticked</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input: InputEl } = $.ui.resolve(e)
    // Mobile has no text inputs; they resolve to something that draws nothing there.
    const Input = e.surface === 'mobile' ? undefined : InputEl
    const v = await read($, view)

    if (!v) return <Text dimColor>No decision pending.</Text>

    const set = (fn: (x: View) => View) => update($, view, x => (x ? fn(x) : x))
    // A change you may want to take back: remembered for Undo, and it clears Redo.
    const commit = (fn: (x: View) => View) => update($, view, x => (x ? withUndo(x, fn(x)) : x))
    const step = v.steps[v.idx]
    const picks = v.picks[step.id] ?? []
    const vis = visibleIdx(v.steps, v.picks)
    const auto = autoConfirm && v.steps.length === 1 && step.kind === 'one'

    const setPicks = (stepId: string, next_: string[]) =>
      commit(x => {
        const reset = resetDependents(x.steps, { ...x.picks, [stepId]: next_ }, x.notes, stepId)
        return { ...x, picks: reset.picks, notes: reset.notes }
      })

    const toggle = (id: string) => {
      if ((v.vetoed[step.id] ?? []).includes(id)) return
      if (auto) return finish?.({ decisions: buildDecisions(v, { ...v.picks, [step.id]: [id] }) })
      const cur = v.picks[step.id] ?? []
      return setPicks(step.id, step.kind === 'many' ? (cur.includes(id) ? cur.filter(c => c !== id) : [...cur, id]) : [id])
    }

    const move = (id: string, d: number) => {
      const o = [...(v.picks[step.id] ?? [])]
      const i = o.indexOf(id)
      const j = i + d
      if (j < 0 || j >= o.length) return
      ;[o[i], o[j]] = [o[j], o[i]]
      return setPicks(step.id, o)
    }

    const bump = (stepId: string, name: string, current: number, d: number) =>
      commit(x => ({ ...x, weights: { ...x.weights, [weightKey(stepId, name)]: Math.max(0, Math.min(10, current + d)) } }))

    const typeOwn = (text: string) => {
      const t = text.trim()
      if (!t) return
      const others = { ...v.others, [step.id]: t }
      const cur = v.picks[step.id] ?? []
      const next_ = step.kind === 'many' ? [...cur.filter(c => c !== OTHER), OTHER] : [OTHER]
      if (auto) return finish?.({ decisions: buildDecisions({ ...v, others }, { ...v.picks, [step.id]: next_ }) })
      return commit(x => {
        const reset = resetDependents(x.steps, { ...x.picks, [step.id]: next_ }, x.notes, step.id)
        return { ...x, others, picks: reset.picks, notes: reset.notes }
      })
    }

    const veto = (id: string) => commit(x => toggleVeto(x, step.id, id))
    const explain = (o: { id: string; label: string }) => finish?.({ explain: { step: step.id, option: o.id, label: o.label }, state: stateOf(v) })
    const defer = () => finish?.({ deferred: true, state: stateOf(v) })
    const vetoedHere = v.vetoed[step.id] ?? []
    const anyVeto = Object.values(v.vetoed).some(a => a.length > 0)
    const proposeOthers = () =>
      finish?.({ regenerate: 'propose different options', vetoed: Object.fromEntries(Object.entries(v.vetoed).filter(([, a]) => a.length)), state: stateOf(v) })

    if (v.phase === 'review') {
      const open = vis.filter(i => !isComplete(v.steps[i], v.picks))
      return (
        <Box flexDirection="column">
          <Text bold color="cyan">◆ {v.title}: review</Text>
          <Text dimColor>{RULE_LINE}</Text>
          {vis.map(i => {
            const s = v.steps[i]
            const done = isComplete(s, v.picks)
            const label = labelsFor(s, v.picks[s.id] ?? [], v.others).join(', ')
            return (
              <Box key={`rl-${s.id}`}>
                <Text color={done ? 'green' : 'yellow'}>{done ? '✓ ' : '○ '}</Text>
                <Button
                  key={`rev-${s.id}`}
                  label={`${s.question} -> ${label || '(unanswered)'}`}
                  onPress={() => set(x => ({ ...x, idx: i, phase: 'step', fromReview: true }))}
                />
              </Box>
            )
          })}
          <Text dimColor>{open.length > 0 ? `${open.length} unanswered: click one to answer it.` : 'Click a line to change it.'}</Text>
          <Box>
            <Button key="back" label="Back" onPress={() => set(x => ({ ...x, phase: 'step', idx: vis[vis.length - 1] ?? x.idx, fromReview: false }))} />
            <Button key="confirm" label="Confirm" onPress={() => (open.length === 0 ? finish?.({ decisions: buildDecisions(v) }) : undefined)} />
          </Box>
          <Text dimColor>Esc skips</Text>
        </Box>
      )
    }

    const ready = isComplete(step, v.picks)
    const nxt = nextVisible(v.steps, v.picks, v.idx)
    const prv = prevVisible(v.steps, v.picks, v.idx)
    const isLast = nxt === undefined
    const wt = step.kind === 'compare' && step.criteria ? weightedTotals(step, v.weights) : undefined
    const many = vis.length > 1
    const last = v.last[step.id] ?? []
    const recommended = step.options.find(o => o.recommended)
    const LIMIT = 6
    const shown = v.showAll[step.id] || step.options.length <= LIMIT + 1 ? step.options : step.options.filter((o, i) => i < LIMIT || picks.includes(o.id))
    const hiddenCount = step.options.length - shown.length

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold color="cyan">◆ {v.title}{'  '}</Text>
          {many &&
            vis.map(i => {
              const s = v.steps[i]
              const here = i === v.idx
              const done = isComplete(s, v.picks)
              return (
                <Text key={`pg-${s.id}`} color={here ? 'cyan' : done ? 'green' : undefined} bold={here} dimColor={!here && !done}>
                  {here ? '● ' : done ? '● ' : '○ '}
                  {short(s.question)}
                  {'  '}
                </Text>
              )
            })}
        </Box>
        <Text dimColor>{RULE_LINE}</Text>

        <Text bold> {step.question}</Text>
        <Text> </Text>
        {step.why && recommended && <Text color="green">★ {step.why}</Text>}

        {step.audience && (
          <Box flexDirection="column">
            {textLines({ type: 'bars', title: 'The audience says', values: step.audience.votes }, step.options, picks).map((l, i) => (
              <Text key={`au-${i}`} dimColor>{l}</Text>
            ))}
          </Box>
        )}

        {step.viz && (
          <Box flexDirection="column">
            {textLines(step.viz, step.options, picks).map((l, i) => (
              <Text key={`v-${i}`} dimColor>{l}</Text>
            ))}
          </Box>
        )}

        {step.kind === 'compare' && step.criteria && wt && (
          <Box flexDirection="column">
            {step.criteria.map((c, ci) => {
              const w = weightOf(step.id, c, v.weights)
              return (
                <Box key={`c-${c.name}`}>
                  <Text>{c.name} </Text>
                  <Button key={`wm-${ci}`} label="-" onPress={() => bump(step.id, c.name, w, -1)} />
                  <Text> weight {w} </Text>
                  <Button key={`wp-${ci}`} label="+" onPress={() => bump(step.id, c.name, w, 1)} />
                  <Text dimColor> {step.options.map(o => `${o.label} ${c.scores[o.id] ?? '-'}`).join(' | ')}</Text>
                </Box>
              )
            })}
            <Text color="yellow">
              weighted: {step.options.map(o => `${o.id === wt.leader ? '★ ' : ''}${o.label} ${wt.totals[o.id]}`).join(' | ')}
            </Text>
            {!step.measured && <Text dimColor>scores are Claude's estimates, not measurements</Text>}
          </Box>
        )}

        {step.kind === 'rank'
          ? picks.map((id, i) => {
              const o = step.options.find(x => x.id === id)
              return (
                <Box key={`k-${id}`}>
                  <Text>
                    {i + 1}. {o?.label ?? id}{' '}
                  </Text>
                  <Button key={`u-${id}`} label="Up" onPress={() => move(id, -1)} />
                  <Button key={`d-${id}`} label="Down" onPress={() => move(id, 1)} />
                  {o?.recommended && <Text color="green"> ★ recommended</Text>}
                </Box>
              )
            })
          : shown.map((o, oi) => {
              const on_ = picks.includes(o.id)
              const mark = step.kind === 'many' ? (on_ ? '☑' : '☐') : on_ ? '◉' : '○'
              const isVetoed = vetoedHere.includes(o.id)
              return (
                <Box key={`o-${o.id}`} flexDirection="column">
                  {oi > 0 && <Text> </Text>}
                  {isVetoed ? (
                    <Box>
                      <Text dimColor>✕ {o.label}  (vetoed) </Text>
                      <Button key={`x-${o.id}`} label="restore" onPress={() => veto(o.id)} />
                    </Box>
                  ) : (
                    <Box>
                      <Button key={`p-${o.id}`} label={`${mark} ${o.label}${wt?.leader === o.id ? ' ★' : ''}`} onPress={() => toggle(o.id)} />
                      {o.recommended && <Text color="green"> ★ recommended</Text>}
                      {last.includes(o.id) && <Text dimColor> last time</Text>}
                      <Text> </Text>
                      <Button key={`q-${o.id}`} label="?" onPress={() => explain(o)} />
                      <Button key={`x-${o.id}`} label="✕" onPress={() => veto(o.id)} />
                    </Box>
                  )}
                  {!isVetoed && o.detail && <Text dimColor>    {o.detail}</Text>}
                  {!isVetoed && o.pros?.map(p => <Text key={`+${o.id}${p}`} color="green">    + {p}</Text>)}
                  {!isVetoed && o.cons?.map(c => <Text key={`-${o.id}${c}`} color="red">    - {c}</Text>)}
                  {on_ && !auto && Input && (
                    <Input
                      key={`n-${step.id}-${o.id}`}
                      label="    tweak:"
                      placeholder="optional note"
                      value={v.notes[`${step.id}:${o.id}`] ?? ''}
                      submitLabel="save"
                      onInput={t => set(x => ({ ...x, notes: { ...x.notes, [`${step.id}:${o.id}`]: t } }))}
                      onSubmit={() => undefined}
                    />
                  )}
                </Box>
              )
            })}
        {step.kind !== 'rank' && step.options.length > LIMIT + 1 && (
          <Button
            key={`more-${step.id}`}
            label={v.showAll[step.id] ? 'Show fewer' : `Show ${hiddenCount} more`}
            onPress={() => set(x => ({ ...x, showAll: { ...x.showAll, [step.id]: !x.showAll[step.id] } }))}
          />
        )}

        {(step.kind === 'one' || step.kind === 'many') && Input && (
          <Input
            key={`other-${step.id}`}
            label="or type your own:"
            placeholder="your answer, then Enter"
            value={v.others[step.id] ?? ''}
            submitLabel="use this"
            onInput={t => set(x => ({ ...x, others: { ...x.others, [step.id]: t } }))}
            onSubmit={t => typeOwn(t)}
          />
        )}

        {askConfidence && !auto && step.kind !== 'rank' && (
          <Box>
            <Text dimColor>how sure? </Text>
            {CONFIDENCE.map(c => (
              <Button
                key={`cf-${c}`}
                label={v.confidence[step.id] === c ? `● ${c}` : c}
                onPress={() =>
                  commit(x => {
                    const { [step.id]: _drop, ...rest } = x.confidence
                    return { ...x, confidence: x.confidence[step.id] === c ? rest : { ...x.confidence, [step.id]: c } }
                  })
                }
              />
            ))}
          </Box>
        )}

        {Input ? (
          <Input
          key="regen"
          label="none fit? say what you want instead:"
          placeholder="then Enter to regenerate"
          value={v.regen}
          submitLabel="regenerate"
          onInput={t => set(x => ({ ...x, regen: t }))}
          onSubmit={t => finish?.({ regenerate: t.trim() || 'propose different options' })}
        />
        ) : (
          <Button key="regen" label="None fit" onPress={() => finish?.({ regenerate: 'propose different options' })} />
        )}

        {!ready && <Text color="yellow">{step.kind === 'many' ? 'Pick at least one to continue.' : 'Pick an option to continue.'}</Text>}

        <Text dimColor>{RULE_LINE}</Text>
        <Box>
          {prv !== undefined && <Button key="prev" label="Back" onPress={() => set(x => ({ ...x, idx: prv }))} />}
          <Button
            key="next"
            label={isLast || v.fromReview ? (many ? 'Review' : 'Confirm') : 'Next'}
            onPress={() => {
              if (!ready) return
              if (v.fromReview) return set(x => ({ ...x, phase: 'review', fromReview: false }))
              if (nxt !== undefined) return set(x => ({ ...x, idx: nxt }))
              if (many) return set(x => ({ ...x, phase: 'review' }))
              finish?.({ decisions: buildDecisions(v) })
            }}
          />
          <Button key="skip" label="Skip" onPress={() => finish?.({ cancelled: true })} />
        </Box>
        <Box>
          {v.undo.length > 0 && <Button key="undo" label="Undo" onPress={() => set(undoOf)} />}
          {v.redo.length > 0 && <Button key="redo" label="Redo" onPress={() => set(redoOf)} />}
          <Button key="defer" label="Decide later" onPress={defer} />
          {anyVeto && <Button key="others" label="Propose others" onPress={proposeOthers} />}
        </Box>
        <Text dimColor>Esc skips · Enter in a field saves it{auto ? ' · picking an option confirms it' : ''}</Text>
      </Box>
    )
  })
}
