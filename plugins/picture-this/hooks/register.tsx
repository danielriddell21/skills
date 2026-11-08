import { atom, read, update } from 'claude-code'
import type { Hook, Register } from 'claude-code'

import type { Component } from '../types'

import { answerKey, hasBlock, normalize, splitBlocks } from './spec'
import { legendOf, zoomTo } from './graphs'
import { paletteFor, svgFor } from './svg'
import type { Palette } from './svg'
import { notesOf, summaryOf, textLines } from './text'

const shown = atom({ plugin: 'picture-this', key: 'shown' } as const, {} as Record<string, Component[]>)
const steps = atom({ plugin: 'picture-this', key: 'steps' } as const, {} as Record<string, number>)
const paths = atom({ plugin: 'picture-this', key: 'paths' } as const, {} as Record<string, string>)
// The person's Claude theme (the /config `theme` row), so pictures match the app, not the OS.
const theme = atom({ plugin: 'picture-this', key: 'theme' } as const, '')
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

type Ctx = { el: Record<string, any>; terminal: boolean; steps: Record<string, number>; paths: Record<string, string>; palette?: Palette }

/** The theme's name from /config, or '' when it cannot be read. */
async function themeName($: Engine): Promise<string> {
  const row = await $.config
    .list()
    .then(rows => rows.find(r => r.key === 'theme'))
    .catch(() => undefined)
  return typeof row?.value === 'string' ? row.value : ''
}

/** A terminal line's colour, by theme key: the same marks mean the same thing as in Claude's own diffs and lists. */
export const lineColor = (line: string): string | undefined => {
  const t = line.trimStart()
  if (t.startsWith('+ ')) return 'success'
  if (t.startsWith('− ')) return 'error'
  if (t.startsWith('~ ')) return 'warning'
  return line.includes('●') ? 'claude' : undefined
}

/** The heading over a picture: its title, and where a zoom has gone. */
const headingOf = (c: Component, path: string): string | undefined => {
  const trail = c.type === 'graph' && path ? zoomTo(c, path).trail : []
  return [c.title, ...trail].filter(Boolean).join(' › ') || undefined
}

/** Next tour step from `cur` by `d`, inside -1 (overview) … n-1. */
export const stepBy = (cur: number, d: number, n: number): number => Math.max(-1, Math.min(n - 1, cur + d))

async function goTo($: Engine, k: string, to: number): Promise<void> {
  await update($, steps, m => trim({ ...Object.fromEntries(Object.entries(m).filter(([kk]) => kk !== k)), [k]: to }, MAX_SHOWN * 4))
}

// Plain host buttons, no accent fill: the terminal draws the label alone, the desktop its own native button.
const nextLabel = (i: number, n: number) => {
  if (i < 0) return 'Start →'
  return i < n - 1 ? 'Next →' : 'Done ↺'
}

/** A guided tour: the diagram with this step's parts lit, its caption, and Back / Next. Runs locally, no model call. */
function drawTour($: Engine, ctx: Ctx, c: Extract<Component, { type: 'tour' }>, k: string) {
  const { Box, Text, Button, Markdown } = ctx.el
  const i = ctx.steps[k] ?? -1
  const n = c.steps.length
  const step = c.steps[i]
  const caption = step ? `**${i + 1}/${n}** · ${step.text}` : `**Tour** · ${n} steps`
  return (
    <Box key={k} flexDirection="column">
      {drawPicture(ctx, c, `${k}-pic`, i)}
      <Markdown key={`${k}-cap`} text={caption} />
      <Box key={`${k}-nav`} flexWrap="wrap" gap={1}>
        {i >= 0 && <Button key={`${k}-back`} label="← Back" plain dimColor onPress={() => goTo($, k, stepBy(i, -1, n))} />}
        <Button key={`${k}-next`} label={nextLabel(i, n)} plain onPress={() => goTo($, k, i < n - 1 ? i + 1 : -1)} />
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
        {up.length > 0 && <Button key={`${k}-up`} label={`↑ ${z.trail.length > 1 ? z.trail.at(-2) : (c.title ?? 'Top')}`} plain dimColor onPress={() => openPath($, k, up.slice(0, -1).join('/'))} />}
        {openable.map(n => (
          <Button key={`${k}-in-${n.id}`} label={`⊕ ${n.label}`} plain onPress={() => openPath($, k, [...up, n.id].join('/'))} />
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

/**
 * One picture as Claude draws its own output: the title and legend as host Text (selectable, in the reply's type),
 * the drawing in a rounded frame on desktop, VS Code and mobile (a card there), theme-key colours in the terminal,
 * and every note in text too, since hover is a bonus.
 */
function drawPicture(ctx: Ctx, c: Component, k: string, step = -1, path = '') {
  const { Box, Text, Svg } = ctx.el
  const heading = headingOf(c, path)
  const alt = `${heading ?? c.type}: ${summaryOf(c)}`
  const legend = legendOf(c)
  const notes = notesOf(c, path)
  // Interactive: hover outlines, <title> tooltips and SMIL replay work on desktop and mobile; VS Code draws an image.
  const svg = !ctx.terminal && Svg ? svgFor(c, step, path, ctx.palette) : undefined
  const lines = svg ? [] : textLines(c, step, path)
  const body = svg ? (
    <Svg key="svg" source={svg} alt={alt} isInteractive />
  ) : (
    <Box key="lines" flexDirection="column">
      {keysFor(lines).map((key, j) => (
        <Text key={key} color={lineColor(lines[j] ?? '')}>
          {lines[j]}
        </Text>
      ))}
    </Box>
  )
  const frame = ctx.terminal ? {} : { borderStyle: 'round', borderColor: 'subtle', paddingX: 1 }
  return (
    <Box key={k} flexDirection="column">
      {heading ? (
        <Text key="h" bold>
          {heading}
        </Text>
      ) : null}
      <Box key="f" flexDirection="column" {...frame}>
        {body}
      </Box>
      {legend ? (
        <Text key="lg" dimColor>
          {legend}
        </Text>
      ) : null}
      {keysFor(notes).map((key, j) => (
        <Text key={`nt-${key}`} dimColor>
          {notes[j]}
        </Text>
      ))}
    </Box>
  )
}

const skippedText = (n: number) => (n === 1 ? '1 picture skipped (invalid JSON or an unknown type)' : `${n} pictures skipped (invalid JSON or an unknown type)`)

/** One block of components; `scope` keeps each block's keys (and tour steps) apart. */
async function drawBlock($: Engine, e: RenderEvent, el: Record<string, any>, scope: string, components: Component[], pending: boolean, skipped: number) {
  const { Box, Text } = el
  const ctx: Ctx = {
    el,
    terminal: e.surface === 'terminal',
    steps: components.some(c => c.type === 'tour') ? await read($, steps) : {},
    paths: components.some(zoomable) ? await read($, paths) : {},
    palette: e.surface === 'terminal' ? undefined : paletteFor(await read($, theme)),
  }
  return (
    <Box key={`blk-${scope}`} flexDirection="column" gap={1}>
      {components.map((c, i) => drawPiece($, ctx, c, `${scope}#${i}`))}
      {pending && (
        <Text key="pending" dimColor>
          Drawing…
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
async function drawMessage($: Engine, e: Extract<RenderEvent, { component: 'AssistantMessage' }>, text: string, next: (e: Extract<RenderEvent, { component: 'AssistantMessage' }>) => Promise<unknown>) {
  const key = answerKey(text)
  const card = ((await $.state.get({ plugin: 'too-long-didnt-read', key: 'cards' })).value ?? []).findLast(c => c.key === key)
  const el = $.ui.resolve(e) as unknown as Record<string, any>
  const { Box, Text } = el

  let body: unknown
  if (hasBlock(text)) {
    // Prose stays Claude's own: each text segment goes back through the host's message drawing (the reply's
    // bullet on the first), and only the blocks are ours.
    const segments = splitBlocks(text)
    const first = segments.findIndex(s => s.kind === 'text' && s.text.trim())
    const keys = keysFor(segments.map(s => (s.kind === 'text' ? `t:${s.text.slice(0, 40)}` : `b:${s.block.index}`)))
    const parts = await Promise.all(
      segments.map(async (s, i) => {
        if (s.kind === 'block') return drawBlock($, e, el, `${key}#${s.block.index}`, s.block.components, s.block.pending, s.block.skipped)
        if (!s.text.trim()) return null
        const prose = await next({ ...e, props: { ...e.props, text: s.text.trim(), isFirstOfReply: e.props.isFirstOfReply && i === first } })
        return <Box key={keys[i]}>{prose}</Box>
      }),
    )
    body = <Box flexDirection="column">{parts}</Box>
  } else body = await next(e)

  if (!card) return body
  const viz = normalize(card.viz)
  return (
    <Box flexDirection="column">
      {body}
      {viz && (
        <Box key="tldr-card" flexDirection="column">
          <Text bold color="claude">
            TL;DR
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
    const name = await themeName($)
    await update($, theme, () => name)
    await update($, ready, () => true)
    return next(e)
  })

  // The person changed theme in /config: redraw pictures in the new one.
  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const r = await next(e)
    const name = await themeName($)
    await update($, theme, () => name)
    return r
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

  // The row stays the host's own (running, error, interrupted, ctrl+o all as Claude draws them); only the input it
  // shows is cut to the title, since the components are drawn as the result.
  on('ui.render', { component: 'ToolUse' }, ($, e, next) => {
    if (e.props.tool !== TOOL) return next(e)
    const title = (e.props.input as { title?: string } | undefined)?.title
    return next({ ...e, props: { ...e.props, input: { title: title ?? 'picture' } } })
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
    return (await drawMessage($, e, text, next)) as never
  })
}
