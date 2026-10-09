import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CrewRun } from '../types'

import { RANK, chipKey, injectChips, isEmpty } from './chips'
import { chipText, costOf, ctxOf, ctxPct, fmtCost, fmtTime, fmtTokens, memberOf, rowSvg, rowText, tokensOf, totals, windowOf } from './crew'

const PANE = 'crew'
const TONE = { running: 'yellow', done: 'green', failed: 'red' } as const
const agents = atom({ plugin: 'who-wants-the-job', key: 'agents' } as const, [] as CrewRun[])
const now = atom({ plugin: 'who-wants-the-job', key: 'now' } as const, 0)

// Opens the crew pane, or closes it when it is up; true when it ends up open.
async function toggle($: EngineInterface): Promise<boolean> {
  if ((await $.ui.panes()).some(p => p.id === PANE)) {
    await $.ui.close({ id: PANE })
    return false
  }
  await update($, now, () => 0)
  await $.ui.open({ id: PANE, title: 'Crew' })
  return true
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.tool.register({
      name: 'step',
      description:
        'For crew agents: report progress on your own task to the /crew pane. Right after reading the brief call it with `total` (your plan in 3-8 steps) and `done: 0`; ' +
        'call it again as each step finishes. Cheap and silent: it only draws a bar.',
      inputSchema: {
        type: 'object',
        properties: {
          done: { type: 'integer', minimum: 0, description: 'Steps finished so far.' },
          total: { type: 'integer', minimum: 1, description: 'Steps planned; may change.' },
          note: { type: 'string', description: 'The step in progress, a few words.' },
        },
        required: ['done'],
      },
    })
    await $.command.register({ name: 'crew', description: 'Show or hide the live panel of subagents: model, progress, context, cost and time' })
    // Ticks the clocks of running agents; quiet when nothing runs.
    $.clock.every(1000, () => {
      void (async () => {
        if (!(await read($, agents)).some(a => a.status === 'running')) return
        const at = await $.clock.now()
        await update($, now, () => at)
      })()
    })
    return started
  })

  on('command.run', { command: 'crew' }, async $ => ({ text: (await toggle($)) ? 'Crew pane opened' : 'Crew pane closed' }))

  // A worker's own progress: the call runs in the worker's loop, so agentId names it.
  on('tool.call', { tool: 'mcp__who-wants-the-job__step' }, async ($, e) => {
    const input = e as unknown as { done?: number; total?: number; note?: string }
    if (!e.agentId) return { result: 'ignored: only subagents report steps' }
    await update($, agents, list =>
      list.map(a => {
        if (a.agentId !== e.agentId) return a
        const total = Math.max(0, Math.round(input.total ?? a.stepTotal ?? 0))
        const done = Math.max(0, Math.round(input.done ?? a.stepDone ?? 0))
        return { ...a, stepTotal: total, stepDone: total ? Math.min(total, done) : done, stepNote: input.note?.trim() || undefined }
      }),
    )
    return { result: 'ok' }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny === undefined) {
      const at = await $.clock.now()
      const run: CrewRun = {
        id: started.agentId ?? e.tool_use_id,
        agentId: started.agentId,
        type: e.subagentType,
        description: e.description,
        model: started.model,
        status: 'running',
        startedAt: at,
        ctxTokens: 0,
        ctxMax: windowOf(started.model),
        tokens: 0,
        costUsd: 0,
        steps: 0,
      }
      await update($, agents, list => [...list.filter(a => a.id !== run.id), run].slice(-60))
      await update($, now, () => at)
      const isCrew = memberOf(e.subagentType).name !== 'agent'
      if (options.autoOpen !== false && isCrew && !(await $.ui.panes()).some(p => p.id === PANE)) void $.ui.open({ id: PANE, title: 'Crew' })
    }
    return started
  })

  // Each model request of a subagent: live context, tokens and cost.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const usage = result.usage
    if (e.agentId && usage) {
      const model = usage.model || e.model
      await update($, agents, list =>
        list.map(a =>
          a.agentId === e.agentId
            ? { ...a, model, status: 'running', endedAt: undefined, ctxTokens: ctxOf(usage), ctxMax: windowOf(model), tokens: a.tokens + tokensOf(usage), costUsd: a.costUsd + costOf(model, usage), steps: a.steps + 1 }
            : a,
        ),
      )
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) {
      const at = await $.clock.now()
      await update($, agents, list =>
        list.map(a => {
          if (a.agentId !== e.agentId) return a
          // A run whose steps went unseen still gets the turn's own sum.
          const fill = a.steps === 0 && e.usage ? { model: e.usage.model || a.model, tokens: tokensOf(e.usage), costUsd: costOf(e.usage.model || a.model, e.usage) } : {}
          return { ...a, ...fill, status: e.reason === 'answer' ? 'done' : 'failed', endedAt: at }
        }),
      )
      await update($, now, () => at)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, agents)
    if (e.props.hasSurvey || list.length === 0) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const rest = await next(e)
    const at = Math.max(await read($, now), ...list.map(a => a.startedAt))
    const running = list.some(a => a.status === 'running')
    const chip = (
      <Box key={chipKey(RANK.crew, 'crew')}>
        <Text key="crew" color={running ? 'yellow' : 'green'}>{`${chipText(list, at)} `}</Text>
        <Button key="open" label="Crew" onPress={() => void toggle($)} />
      </Box>
    )
    const joined = injectChips(rest, chip)
    if (joined) return joined as never
    if (isEmpty(rest)) return <Box key="chips" flexWrap="wrap">{chip}</Box>
    return (
      <Box flexDirection="column">
        <Box key="chips" flexWrap="wrap">{chip}</Box>
        {rest}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const list = await read($, agents)
    if (list.length === 0) return <Text dimColor>No subagents yet. Scout, engineer, spy and sniper show up here when they start.</Text>

    const at = Math.max(await read($, now), ...list.map(a => a.startedAt), ...list.map(a => a.endedAt ?? 0))
    const t = totals(list, at)
    const order = [...list.filter(a => a.status === 'running'), ...list.filter(a => a.status !== 'running').reverse()]
    const svg = e.surface !== 'terminal' && Svg

    return (
      <Box flexDirection="column">
        <Text bold>{`♟ Crew  ${t.running} running · ${t.count} total · ≈${fmtCost(t.cost)} · ${fmtTokens(t.tokens)} tokens · ${fmtTime(t.time)}`}</Text>
        <Text dimColor>{'─'.repeat(40)}</Text>
        {order.map(a =>
          svg ? (
            <Svg key={`run:${a.id}`} source={rowSvg(a, at)} alt={`${memberOf(a.type).label}: ${a.description}`} />
          ) : (
            <Box key={`run:${a.id}`} flexDirection="column">
              <Text color={TONE[a.status]}>{`${memberOf(a.type).glyph} ${rowText(a, at)}`}</Text>
              <Text dimColor>{`   ${a.description || '(no description)'} · ctx ${ctxPct(a)}% of ${fmtTokens(a.ctxMax)} · ${a.steps} requests`}</Text>
            </Box>
          ),
        )}
        <Text dimColor>{'─'.repeat(40)}</Text>
        <Button key="clear" label="Clear finished" onPress={() => void update($, agents, l => l.filter(a => a.status === 'running'))} />
      </Box>
    )
  })
}
