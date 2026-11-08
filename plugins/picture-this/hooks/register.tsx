import { atom, read, update } from 'claude-code'
import type { Hook, Register } from 'claude-code'

import type { Component } from '../types'

import { answerKey, hasBlock, normalize, splitBlocks } from './spec'
import { zoomTo } from './graphs'
import { svgFor } from './svg'
import { summaryOf, textLines } from './text'

const shown = atom({ plugin: 'picture-this', key: 'shown' } as const, {} as Record<string, Component[]>)
const steps = atom({ plugin: 'picture-this', key: 'steps' } as const, {} as Record<string, number>)
const paths = atom({ plugin: 'picture-this', key: 'paths' } as const, {} as Record<string, string>)
const ready = atom({ plugin: 'picture-this', key: 'ready' } as const, false)

export const TOOL = 'mcp__picture-this__show'
const MAX_SHOWN = 50

type Engine = Parameters<Hook<'session.start'>>[0]
type RenderEvent = Parameters<Hook<'ui.render'>>[1]

// What the model is told every session. Kept short: the show-dont-tell skill holds the long form and examples.
export const RULE = `picture-this draws pictures natively in the thread for things too complex, or ideas too big, to hold in prose. Judge first: about 6+ linked parts, a cycle or hub, 5+ steps with branches or 3+ actors, 4+ states, 3+ options on 3+ criteria, a change across 5+ dependent files, or an idea that needs stages. Below that, text. Above it, unless the user asked for a picture: say in one line what makes it complex, offer 2-3 pictures (AskUserQuestion with a small text preview each, plus "text is fine"), draw only the pick.
Three modes, for one idea or several options: static (the shape), before/after (what changes), guided (a tour, step by step).
Draw with a fenced \`\`\`ui block, ONE JSON object per line, in a prose answer that stands without it (or the \`${TOOL}\` tool with {title?, components}):
graph {nodes:[{id,label,hot?,note?,heat?:0-1,change?:"added"|"removed"|"changed",inside?:{nodes,edges}}], edges:[[from,to,label?]], heatLabel?} (structure; hot = where complexity lives; heat shades by churn/bugs/load; inside = zoom in; ≤24 nodes)
compare {panels:[{label:"Today",nodes,edges},{label:"Option A",nodes,edges}]} (before/after or options; first panel is the baseline; same ids across panels)
tour / storyboard {nodes, edges, steps:[{focus:[ids], text}]} (guided: Back/Next, or every step at once; 2-12 steps)
sequence {steps:[[from,to,label]], animate?} · flow {lanes:[[a,b,c]]} · swimlane {steps:[[lane,label]]} · timeline {items:[{label,start,end?,hot?}]} (numbers, "HH:MM" or dates)
tree {nodes:[{label,children}]} · treemap {values:{"src/a.ts":120}, hot?:[paths]} · matrix {rows, cols, values:[[n]]} · sankey {links:[[from,to,value]]}
bars {values:{A:3}} · scatter {x, y, points:[{label,x,y}], quadrant?} · radar {axes:[…3-8], series:{A:[n…]}, max?}
Plain markdown tables for exact values; AskUserQuestion for choices. Short labels, the names used in the text; say when it is your reading or an estimate.`

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

type Ctx = { el: Record<string, any>; terminal: boolean; steps: Record<string, number>; paths: Record<string, string> }

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

async function openPath($: Engine, k: string, to: string): Promise<void> {
  await update($, paths, m => trim({ ...Object.fromEntries(Object.entries(m).filter(([kk]) => kk !== k)), [k]: to }, MAX_SHOWN * 4))
}

/** A graph with parts you can open: the level shown, a trail back up, and a button per part with an inside. */
function drawZoom($: Engine, ctx: Ctx, c: Extract<Component, { type: 'graph' }>, k: string) {
  const { Box, Button } = ctx.el
  const z = zoomTo(c, ctx.paths[k] ?? '')
  const up = z.path.split('/').filter(Boolean)
  const openable = z.nodes.filter(n => n.inside)
  return (
    <Box key={k} flexDirection="column">
      {drawPicture(ctx, c, `${k}-pic`, -1, z.path)}
      <Box key={`${k}-zoom`} flexWrap="wrap" gap={1}>
        {up.length > 0 && <Button key={`${k}-up`} label={`◀ ${z.trail.length > 1 ? z.trail.at(-2) : (c.title ?? 'Top')}`} plain onPress={() => openPath($, k, up.slice(0, -1).join('/'))} />}
        {openable.map(n => (
          <Button key={`${k}-in-${n.id}`} label={`⊕ ${n.label}`} onPress={() => openPath($, k, [...up, n.id].join('/'))} />
        ))}
      </Box>
    </Box>
  )
}

const zoomable = (c: Component): c is Extract<Component, { type: 'graph' }> => c.type === 'graph' && c.nodes.some(n => n.inside)

function drawPiece($: Engine, ctx: Ctx, c: Component, k: string) {
  if (c.type === 'tour') return drawTour($, ctx, c, k)
  return zoomable(c) ? drawZoom($, ctx, c, k) : drawPicture(ctx, c, k)
}

function drawPicture(ctx: Ctx, c: Component, k: string, step = -1, path = '') {
  const { Box, Text, Svg } = ctx.el
  const alt = `${c.title ?? c.type}: ${summaryOf(c)}`
  // Interactive: hover outlines, <title> tooltips and SMIL replay work on desktop and mobile; VS Code draws an image.
  const svg = !ctx.terminal && Svg ? svgFor(c, step, path) : undefined
  if (svg) return <Svg key={k} source={svg} alt={alt} isInteractive />
  const lines = textLines(c, step, path)
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
  const ctx: Ctx = {
    el,
    terminal: e.surface === 'terminal',
    steps: components.some(c => c.type === 'tour') ? await read($, steps) : {},
    paths: components.some(zoomable) ? await read($, paths) : {},
  }
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
        'Draw a picture natively in the thread: graph, compare (before/after, options), tour, storyboard, sequence, flow, swimlane, timeline, tree, treemap, matrix, sankey, bars, scatter, radar. Same components as a ```ui block; ' +
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
