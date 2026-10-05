import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Step, View } from '../types'

import { splitViz, svgFor, textLines } from './viz'

const PANE = 'your-call'
const TOOL = 'mcp__your-call__ask'
const view = atom({ plugin: 'your-call', key: 'view' } as const, null)

const RULE = `When a request is ambiguous, has several viable approaches, or needs the user's preference on a non-trivial choice, do NOT guess: call the \`${TOOL}\` tool. Give 2-6 options with short labels, a one-line detail, and pros/cons when they differ. Use kind "many" for multi-select, "rank" to prioritise, "compare" with criteria (scores 1-5) for tradeoffs; use several steps for a dependent multi-part problem. The answer returns the user's picks, per-option notes, or {regenerate: guidance} meaning propose different options. Add a \`viz\` (bars, quadrant, tree, flow) to a step only when a picture clarifies a complex tradeoff or structure, never as decoration. Skip the tool for trivial or clearly-specified work.`

const SCHEMA = {
  type: 'object',
  required: ['title', 'steps'],
  properties: {
    title: { type: 'string' },
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
              },
            },
          },
          viz: {
            type: 'object',
            description:
              'Optional chart, only when a picture clarifies a complex tradeoff or structure. {type:"bars",values:{optId:n}} | {type:"quadrant",x,y,points:[{id,x:0-10,y:0-10}]} | {type:"tree",nodes:[{label,children}]} | {type:"flow",lanes:[[stepA,stepB],...]}',
          },
          criteria: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'scores'],
              properties: { name: { type: 'string' }, scores: { type: 'object' } },
            },
          },
        },
      },
    },
  },
}

type Spec = { title?: string; steps?: Step[] }
type Outcome = { decisions: unknown[] } | { regenerate: string } | { cancelled: true }


const isSimple = (s: Step[]) =>
  s.length === 1 &&
  (s[0].kind ?? 'one') === 'one' &&
  s[0].options.length <= 4 &&
  !s[0].criteria &&
  s[0].options.every(o => !o.detail && !o.pros?.length && !o.cons?.length)

export const register: Register = on => {
  let finish: ((o: Outcome) => void) | null = null

  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'ask',
      description:
        'Ask the user to choose or refine via rich UI (select, multi, rank, compare matrix, multi-step wizard). Blocks until answered.',
      inputSchema: SCHEMA,
    })
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    return { sections: [...r.sections, { id: 'your-call:rule', text: RULE, scope: 'session' as const }] }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const spec = e as unknown as Spec
    const steps = (spec.steps ?? []).map(s => ({ ...s, kind: s.kind ?? 'one' }))

    if (steps.length === 0) return { result: JSON.stringify({ error: 'no steps' }) }

    if (isSimple(steps)) {
      const s = steps[0]
      try {
        const label = await $.ui.ask(s.question, s.options.map(o => o.label))
        const hit = s.options.find(o => o.label === label)
        return { result: JSON.stringify({ decisions: [{ step: s.id, picks: [hit?.id ?? label], other: hit ? undefined : label }] }) }
      } catch {
        return { result: JSON.stringify({ cancelled: true }) }
      }
    }

    const v: View = {
      title: spec.title ?? 'Decision',
      steps,
      idx: 0,
      picks: Object.fromEntries(steps.map(s => [s.id, s.kind === 'rank' ? s.options.map(o => o.id) : []])),
      notes: {},
      phase: 'step',
      regen: '',
    }
    await update($, view, () => v)

    const outcome = new Promise<Outcome>(resolve => {
      finish = resolve
    })
    const opened = await $.ui.open({ id: PANE, title: v.title, focus: true, closeOnEscape: true, rows: 18 })

    if (!opened.isPlaced) {
      finish?.({ cancelled: true })
      $.ui.toast('your-call: widen the terminal or reopen to answer')
    }

    const out = await outcome
    finish = null
    await update($, view, () => null)
    await $.ui.close({ id: PANE })
    return { result: JSON.stringify(out) }
  })

  on('ui.close', ($, e, next) => {
    if (e.origin === 'person') finish?.({ cancelled: true })
    return next(e)
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const text = e.props.text
    if (!text.includes('```viz')) return next(e)

    const { Box, Text, Markdown, Svg } = $.ui.resolve(e)
    const hasSvg = e.surface !== 'terminal'

    return (
      <Box flexDirection="column">
        {splitViz(text).map((s, i) => {
          if (s.kind === 'text') return <Markdown key={`t${i}`} text={s.text} />
          if (s.kind === 'pending') return <Text key={`p${i}`} dimColor>drawing chart…</Text>
          const svg = hasSvg ? svgFor(s.viz) : undefined
          if (svg && Svg) return <Svg key={`v${i}`} source={svg} alt={s.viz.title ?? 'chart'} />
          return (
            <Box key={`v${i}`} flexDirection="column">
              {textLines(s.viz).map((l, j) => (
                <Text key={`l${i}-${j}`}>{l}</Text>
              ))}
            </Box>
          )
        })}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const v = await read($, view)

    if (!v) return <Text dimColor>No decision pending.</Text>

    const set = (fn: (x: View) => View) => update($, view, x => (x ? fn(x) : x))
    const step = v.steps[v.idx]
    const picks = v.picks[step.id] ?? []

    const toggle = (id: string) =>
      set(x => {
        const cur = x.picks[step.id] ?? []
        const next_ =
          step.kind === 'many' ? (cur.includes(id) ? cur.filter(c => c !== id) : [...cur, id]) : [id]
        return { ...x, picks: { ...x.picks, [step.id]: next_ } }
      })

    const move = (id: string, d: number) =>
      set(x => {
        const o = [...(x.picks[step.id] ?? [])]
        const i = o.indexOf(id)
        const j = i + d
        if (j < 0 || j >= o.length) return x
        ;[o[i], o[j]] = [o[j], o[i]]
        return { ...x, picks: { ...x.picks, [step.id]: o } }
      })

    const decisions = () =>
      v.steps.map(s => ({
        step: s.id,
        picks: v.picks[s.id],
        notes: Object.fromEntries(
          Object.entries(v.notes).filter(([k]) => k.startsWith(`${s.id}:`)).map(([k, t]) => [k.slice(s.id.length + 1), t]),
        ),
      }))

    if (v.phase === 'review') {
      return (
        <Box flexDirection="column">
          <Text>{v.title}: review</Text>
          {v.steps.map(s => (
            <Text key={`r-${s.id}`}>
              {s.question} {'->'} {(v.picks[s.id] ?? []).map(id => s.options.find(o => o.id === id)?.label ?? id).join(', ') || '(none)'}
            </Text>
          ))}
          <Box>
            <Button key="back" label="Back" onPress={() => set(x => ({ ...x, phase: 'step' }))} />
            <Button key="confirm" label="Confirm" onPress={() => finish?.({ decisions: decisions() })} />
          </Box>
        </Box>
      )
    }

    const ready = step.kind === 'rank' || picks.length > 0
    const isLast = v.idx === v.steps.length - 1
    const total = (id: string) => (step.criteria ?? []).reduce((a, c) => a + (c.scores[id] ?? 0), 0)

    return (
      <Box flexDirection="column">
        <Text>
          {v.title} {v.steps.length > 1 ? `(${v.idx + 1}/${v.steps.length})` : ''}
        </Text>
        <Text>{step.question}</Text>

        {step.viz && (
          <Box flexDirection="column">
            {textLines(step.viz, step.options, picks).map((l, i) => (
              <Text key={`v-${i}`} dimColor>{l}</Text>
            ))}
          </Box>
        )}

        {step.kind === 'compare' && step.criteria && (
          <Box flexDirection="column">
            {step.criteria.map(c => (
              <Text key={`c-${c.name}`} dimColor>
                {c.name}: {step.options.map(o => `${o.label} ${c.scores[o.id] ?? '-'}`).join(' | ')}
              </Text>
            ))}
            <Text dimColor>total: {step.options.map(o => `${o.label} ${total(o.id)}`).join(' | ')}</Text>
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
                </Box>
              )
            })
          : step.options.map(o => {
              const on_ = picks.includes(o.id)
              const mark = step.kind === 'many' ? (on_ ? '[x]' : '[ ]') : on_ ? '(*)' : '( )'
              return (
                <Box key={`o-${o.id}`} flexDirection="column">
                  <Button key={`p-${o.id}`} label={`${mark} ${o.label}`} onPress={() => toggle(o.id)} />
                  {o.detail && <Text dimColor>    {o.detail}</Text>}
                  {o.pros?.map(p => <Text key={`+${o.id}${p}`} dimColor>    + {p}</Text>)}
                  {o.cons?.map(c => <Text key={`-${o.id}${c}`} dimColor>    - {c}</Text>)}
                  {on_ && (
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

        <Input
          key="regen"
          label="none fit? say what you want instead:"
          placeholder="then Enter to regenerate"
          value={v.regen}
          submitLabel="regenerate"
          onInput={t => set(x => ({ ...x, regen: t }))}
          onSubmit={t => finish?.({ regenerate: t.trim() || 'propose different options' })}
        />

        <Box>
          {v.idx > 0 && <Button key="prev" label="Back" onPress={() => set(x => ({ ...x, idx: x.idx - 1 }))} />}
          <Button
            key="next"
            label={isLast ? (v.steps.length > 1 ? 'Review' : 'Confirm') : 'Next'}
            onPress={() => {
              if (!ready) return
              if (!isLast) return set(x => ({ ...x, idx: x.idx + 1 }))
              if (v.steps.length > 1) return set(x => ({ ...x, phase: 'review' }))
              finish?.({ decisions: decisions() })
            }}
          />
          <Button key="skip" label="Skip" onPress={() => finish?.({ cancelled: true })} />
        </Box>
      </Box>
    )
  })
}
