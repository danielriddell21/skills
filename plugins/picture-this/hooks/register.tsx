import { atom, read, update } from 'claude-code'
import type { Hook, Register } from 'claude-code'

import type { Component } from '../types'

import { answerKey, hasBlock, normalize, splitBlocks } from './spec'
import { svgFor } from './svg'
import { summaryOf, textLines } from './text'

const shown = atom({ plugin: 'picture-this', key: 'shown' } as const, {} as Record<string, Component[]>)
const steps = atom({ plugin: 'picture-this', key: 'steps' } as const, {} as Record<string, number>)
const ready = atom({ plugin: 'picture-this', key: 'ready' } as const, false)

export const TOOL = 'mcp__picture-this__show'
const MAX_SHOWN = 50

type Engine = Parameters<Hook<'session.start'>>[0]
type RenderEvent = Parameters<Hook<'ui.render'>>[1]

// What the model is told every session. Kept short: the show-dont-tell skill holds the long form.
export const RULE = `picture-this draws diagrams natively in the thread, for things too complex to hold in prose. Before drawing, judge complexity: about 6+ parts with links between them, a cycle or fan-out, 5+ steps with branches or several actors talking, or 3+ options across 3+ criteria. Below that, answer in text. Above it, and unless the user already asked for a picture, say in one line what makes it complex and offer 2-3 picture options (AskUserQuestion when available, each with a small text preview, plus "text is fine"); draw only the one they pick.
Draw with a fenced \`\`\`ui block, ONE JSON object per line, inside a prose answer that stands without it (or the \`${TOOL}\` tool with {title?, components:[...]} when the picture is the whole answer):
{"type":"graph","title":"…","nodes":[{"id":"api","label":"API","hot":true,"note":"3 callers"},{"id":"db","label":"DB"}],"edges":[["api","db","reads"]]} (parts and how they connect; hot marks where the complexity lives; ≤24 nodes)
{"type":"sequence","actors":["Client","API","DB"],"steps":[["Client","API","POST /login"],["API","DB","lookup"],["API","Client","200"]]} (who calls whom, in order)
{"type":"tour","title":"…","nodes":[…],"edges":[…],"steps":[{"focus":["api"],"text":"Every request enters here"},{"focus":["api","db"],"text":"…"}]} (a guided walkthrough of a graph or a big idea: Back/Next light up each step's parts; 2-12 steps)
{"type":"flow","lanes":[["plan","build","ship"]]} · {"type":"tree","nodes":[{"label":"x","children":[{"label":"y"}]}]} · {"type":"bars","values":{"A":3,"B":5},"unit":"ms"} · {"type":"scatter","x":"effort","y":"impact","points":[{"label":"A","x":2,"y":8}],"quadrant":true}
Use the host's own forms for the rest: a markdown table for an options-by-criteria matrix, AskUserQuestion for a choice. Short labels, the names used in the text; say when numbers are estimates.`

/** React keys from labels that stay unique when a label repeats. */
export const keysFor = (labels: string[]): string[] => {
  const seen = new Map<string, number>()
  return labels.map(l => {
    const n = (seen.get(l) ?? 0) + 1
    seen.set(l, n)
    return n === 1 ? l : `${l}~${n}`
  })
}

const trim = <T,>(m: Record<string, T>, n: number): Record<string, T> => Object.fromEntries(Object.entries(m).slice(-n))

type Ctx = { el: Record<string, any>; terminal: boolean; steps: Record<string, number> }

const titleOf = (c: Component) => c.title

/** Next tour step from `cur` by `d`, inside -1 (overview) … n-1. */
export const stepBy = (cur: number, d: number, n: number): number => Math.max(-1, Math.min(n - 1, cur + d))

async function goTo($: Engine, k: string, to: number): Promise<void> {
  await update($, steps, m => trim({ ...Object.fromEntries(Object.entries(m).filter(([kk]) => kk !== k)), [k]: to }, MAX_SHOWN * 4))
}

/** A guided tour: the diagram with this step's parts lit, its caption, and Back / Next. Runs locally, no model call. */
function drawTour($: Engine, ctx: Ctx, c: Extract<Component, { type: 'tour' }>, k: string) {
  const { Box, Text, Button, Markdown } = ctx.el
  const i = ctx.steps[k] ?? -1
  const n = c.steps.length
  const step = c.steps[i]
  const caption = step ? `**${i + 1}/${n}** · ${step.text}` : `**Tour** · ${n} steps. Press Next to start.`
  return (
    <Box key={k} flexDirection="column">
      {drawPicture(ctx, c, `${k}-pic`, i)}
      <Markdown key={`${k}-cap`} text={caption} />
      <Box key={`${k}-nav`} flexWrap="wrap" gap={1}>
        <Button key={`${k}-back`} label="◀ Back" plain dimColor={i < 0} onPress={() => goTo($, k, stepBy(i, -1, n))} />
        <Button key={`${k}-next`} label={i < n - 1 ? 'Next ▶' : 'Overview ↺'} variant="primary" onPress={() => goTo($, k, i < n - 1 ? i + 1 : -1)} />
        <Text key={`${k}-dots`} dimColor>
          {c.steps.map((_, j) => (j === i ? '●' : '○')).join('')}
        </Text>
      </Box>
    </Box>
  )
}

function drawPiece($: Engine, ctx: Ctx, c: Component, k: string) {
  return c.type === 'tour' ? drawTour($, ctx, c, k) : drawPicture(ctx, c, k)
}

function drawPicture(ctx: Ctx, c: Component, k: string, step = -1) {
  const { Box, Text, Svg } = ctx.el
  const alt = `${c.title ?? c.type}: ${summaryOf(c)}`
  // Interactive: hover outlines and <title> tooltips work on desktop and mobile; VS Code draws it as an image.
  const svg = !ctx.terminal && Svg ? svgFor(c, step) : undefined
  if (svg) return <Svg key={k} source={svg} alt={alt} isInteractive />
  const lines = textLines(c, step)
  return (
    <Box key={k} flexDirection="column">
      {titleOf(c) ? (
        <Text key="h" bold>
          {titleOf(c)}
        </Text>
      ) : null}
      {keysFor(lines).map((key, j) => (
        <Text key={key} color={lines[j]?.includes('●') ? 'yellow' : undefined}>
          {lines[j]}
        </Text>
      ))}
    </Box>
  )
}

const skippedText = (n: number) => (n === 1 ? '(1 piece could not be drawn)' : `(${n} pieces could not be drawn)`)

/** One block of components; `scope` keeps each block's keys (and tour steps) apart. */
async function drawBlock($: Engine, e: RenderEvent, el: Record<string, any>, scope: string, components: Component[], pending: boolean, skipped: number) {
  const { Box, Text } = el
  const ctx: Ctx = { el, terminal: e.surface === 'terminal', steps: components.some(c => c.type === 'tour') ? await read($, steps) : {} }
  return (
    <Box key={`blk-${scope}`} flexDirection="column" gap={1}>
      {components.map((c, i) => drawPiece($, ctx, c, `${scope}#${i}`))}
      {pending && (
        <Text key="pending" dimColor>
          drawing…
        </Text>
      )}
      {skipped > 0 && !pending && (
        <Text key="skipped" dimColor>
          {skippedText(skipped)}
        </Text>
      )}
    </Box>
  )
}

/** A ```ui or ```viz answer drawn as prose and pictures, with any too-long-didnt-read card for it underneath. */
async function drawMessage($: Engine, e: RenderEvent, text: string, next: () => Promise<unknown>) {
  const key = answerKey(text)
  const card = ((await $.state.get({ plugin: 'too-long-didnt-read', key: 'cards' })).value ?? []).findLast(c => c.key === key)
  const el = $.ui.resolve(e) as unknown as Record<string, any>
  const { Box, Text, Markdown } = el

  let body: unknown
  if (hasBlock(text)) {
    const segments = splitBlocks(text)
    const keys = keysFor(segments.map(s => (s.kind === 'text' ? `t:${s.text.slice(0, 40)}` : `b:${s.block.index}`)))
    const parts = await Promise.all(
      segments.map((s, i) =>
        s.kind === 'text' ? <Markdown key={keys[i]} text={s.text} /> : drawBlock($, e, el, `${key}#${s.block.index}`, s.block.components, s.block.pending, s.block.skipped),
      ),
    )
    body = <Box flexDirection="column">{parts}</Box>
  } else body = await next()

  if (!card) return body
  const viz = normalize(card.viz)
  return (
    <Box flexDirection="column">
      {body}
      {viz && (
        <Box key="tldr-card" flexDirection="column">
          <Text bold color="cyan">
            ≡ TL;DR
          </Text>
          {await drawBlock($, e, el, `tldr:${card.id}`, [viz], false, 0)}
        </Box>
      )}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'show',
      description:
        'Draw a diagram natively in the thread: graph, tour (guided walkthrough), sequence, flow, tree, bars or scatter. Same components as a ```ui block; ' +
        'prefer the block inside a prose answer, the tool when the picture is the whole answer. Only after the user agreed to a picture, or asked for one.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'A few words naming what is shown.' },
          components: { type: 'array', items: { type: 'object' }, description: 'Component objects, as in a ```ui block.' },
        },
        required: ['components'],
      },
    })
    await update($, ready, () => true)
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    return { sections: [...r.sections, { id: 'picture-this:rule', text: RULE, scope: 'session' as const }] }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const raw = (e as unknown as { components?: unknown }).components
    const list = Array.isArray(raw) ? raw.slice(0, 8) : []
    const components = list.flatMap(c => normalize(c) ?? [])
    if (!components.length) return { result: { shown: 0, error: 'nothing drawable: check each component against the picture-this rule' } }
    const id = e.tool_use_id ?? `t${Date.now()}`
    await update($, shown, m => trim({ ...m, [id]: components }, MAX_SHOWN))
    return { result: { shown: components.length, types: components.map(c => c.type), skipped: list.length - components.length } }
  })

  on('ui.render', { component: 'ToolUse' }, ($, e, next) => {
    if (e.props.tool !== TOOL) return next(e)
    const { Text } = $.ui.resolve(e)
    const title = (e.props.input as { title?: string } | undefined)?.title
    return <Text dimColor>▣ picture: {title ?? 'drawing'}</Text>
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.props.tool !== TOOL) return next(e)
    const components = (await read($, shown))[e.props.tool_use_id]
    if (!components?.length) return next(e)
    return (await drawBlock($, e, $.ui.resolve(e) as unknown as Record<string, any>, `tool:${e.props.tool_use_id}`, components, false, 0)) as never
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const text = e.props.text
    if (!hasBlock(text) && !((await $.state.get({ plugin: 'too-long-didnt-read', key: 'cards' })).value ?? []).length) return next(e)
    return (await drawMessage($, e, text, () => next(e))) as never
  })
}
