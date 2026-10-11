import { atom, read, update } from 'claude-code'
import type { Hook, Register } from 'claude-code'

import type { CalcInput, CalcOutput, Component, Sort } from '../types'

import { evaluate, fmtNum } from './formula'
import { answerKey, hasBlock, normalize, splitBlocks } from './spec'
import { svgFor } from './svg'
import { sliderBar, tableLines, sortedRows, textLines, titleOf } from './text'

const values = atom({ plugin: 'picture-this', key: 'values' } as const, {} as Record<string, number | string>)
const sorts = atom({ plugin: 'picture-this', key: 'sorts' } as const, {} as Record<string, Sort>)
const shown = atom({ plugin: 'picture-this', key: 'shown' } as const, {} as Record<string, Component[]>)
const noClient = atom({ plugin: 'picture-this', key: 'noClient' } as const, false)
const ready = atom({ plugin: 'picture-this', key: 'ready' } as const, false)

export const TOOL = 'mcp__picture-this__show'
const MAX_KEYS = 400
const MAX_SHOWN = 50

type Engine = Parameters<Hook<'session.start'>>[0]
type RenderEvent = Parameters<Hook<'ui.render'>>[1]

export const RULE = `picture-this draws UI natively in the thread. When a picture beats prose (comparisons, trends, shares, structure, flows, itineraries, what-if numbers), put a fenced \`\`\`ui block in the reply with ONE JSON object per line, or call the \`${TOOL}\` tool with {title?, components:[...]}. Components:
{"type":"bars","title":"…","values":{"A":3,"B":5},"unit":"ms"} · {"type":"line","x":["Jan","Feb"],"series":{"Revenue":[1,2]}} · {"type":"scatter","x":"effort","y":"impact","points":[{"label":"A","x":2,"y":8}],"quadrant":true} · {"type":"pie","values":{"A":60,"B":40}}
{"type":"table","columns":["Name","Score"],"rows":[["A",3]]} · {"type":"tree","nodes":[{"label":"x","children":[{"label":"y"}]}]} · {"type":"flow","lanes":[["plan","build","ship"]]} · {"type":"graph","nodes":[{"id":"api","label":"API"},{"id":"db","label":"DB"}],"edges":[["api","db","reads"]]}
{"type":"card","title":"…","body":"…","fields":{"k":"v"},"tags":["t"]} · {"type":"stat","label":"p95","value":"120 ms","delta":"-8%"} · {"type":"map","stops":[{"label":"Cork","lat":51.9,"lon":-8.5,"note":"day 1"}]} (schematic, not a real map)
Live controls (they run locally, no model call): {"type":"calc","title":"…","inputs":[{"id":"rate","label":"Rate","value":5,"min":0,"max":20,"step":0.5,"unit":"%"}],"outputs":[{"id":"total","label":"Total","formula":"1000*(1+rate/100)^years","digits":2}]} (formulas: numbers, input ids, + - * / % ^, min max abs round floor ceil sqrt pow log exp) · {"type":"choice","id":"plan","label":"Plan","options":["A","B"]} · {"type":"send","label":"Use these","prompt":"Go with {plan} at {rate}%"} (a button that puts the prompt, with {id}s filled from the controls in the same block, in the user's input box; it never sends by itself).
Rules: one idea per block, short labels, a line of prose around it; say when numbers are estimates or sample data and never invent live data; every control must change an output; keep a text answer that stands without the picture.`

export const LABELS = ['prose', 'table', 'chart', 'diagram', 'calculator', 'map', 'choice'] as const
export const HINT: Record<string, string> = {
  table: 'picture-this: exact values or records: answer with a ```ui table component.',
  chart: 'picture-this: magnitudes, trends or shares: answer with a ```ui chart (bars, line, scatter or pie).',
  diagram: 'picture-this: structure or steps: answer with a ```ui flow, tree or graph.',
  calculator: 'picture-this: a what-if calculation: answer with a ```ui calc (inputs + formula outputs) and a send button.',
  map: 'picture-this: places or a route: answer with a ```ui map (schematic stops with notes).',
  choice: 'picture-this: the user picks between options: cards for each, a ```ui choice and a send button.',
}

export const shouldClassify = (text: string, hasOrigin: boolean, minChars = 40): boolean => {
  const t = text.trim()
  return !hasOrigin && !t.startsWith('/') && t.length >= minChars
}

type Vars = Record<string, number | string>

const numbersOf = (vars: Vars): Record<string, number> =>
  Object.fromEntries(Object.entries(vars).filter((kv): kv is [string, number] => typeof kv[1] === 'number'))

const inputValue = (raw: number | string | undefined, fallback: number): number => (typeof raw === 'number' ? raw : fallback)

/** The values a block's controls hold now: calc inputs (as moved), choices, then each output with an id. */
export const varsOf = (components: Component[], scope: string, vals: Vars): Vars => {
  const vars: Vars = {}
  const calcs = components.filter((c): c is Extract<Component, { type: 'calc' }> => c.type === 'calc')
  for (const c of calcs) for (const i of c.inputs) vars[i.id] = inputValue(vals[`${scope}/${i.id}`], i.value)
  for (const c of components) if (c.type === 'choice') vars[c.id] = vals[`${scope}/${c.id}`] ?? c.value ?? ''
  const outputs = calcs.flatMap(c => c.outputs).filter(o => o.id)
  for (const o of outputs) {
    const v = evaluate(o.formula, numbersOf(vars))
    if (v !== undefined) vars[o.id as string] = Number(v.toFixed(o.digits ?? 6))
  }
  return vars
}

/** The send button's prompt with {id}s filled; an id with no value stays as written. */
export const fillPrompt = (template: string, vars: Vars): string =>
  template.replaceAll(/\{(\w+)\}/g, (m, id: string) => {
    const v = vars[id]
    if (v === undefined || v === '') return m
    return typeof v === 'number' ? fmtNum(v) : v
  })

const trim = <T,>(m: Record<string, T>, n: number): Record<string, T> => Object.fromEntries(Object.entries(m).slice(-n))

const mdCell = (c: string | number) => (typeof c === 'number' ? fmtNum(c) : c).replaceAll('|', String.raw`\|`)

const arrowOf = (sort: Sort) => (sort.desc ? '↓' : '↑')
const headerOf = (col: string, i: number, sort?: Sort) => (sort?.col === i ? `${col} ${arrowOf(sort)}` : col)
const withUnit = (text: string, unit?: string) => (unit ? `${text} ${unit}` : text)

export const tableMarkdown = (columns: string[], rows: (string | number)[][], sort?: Sort): string => {
  const head = columns.map((c, i) => headerOf(c, i, sort))
  const rule = columns.map(() => ' --- ').join('|')
  const body = sortedRows(rows, sort).map(r => '| ' + r.map(mdCell).join(' | ') + ' |')
  return ['| ' + head.map(mdCell).join(' | ') + ' |', '|' + rule + '|', ...body].join('\n')
}

/** Next sort for a press on column `col`: ascending, then descending, then none. */
export const nextSort = (cur: Sort | undefined, col: number): Sort | undefined => {
  if (cur?.col !== col) return { col, desc: false }
  return cur.desc ? undefined : { col, desc: true }
}

/** React keys from labels that stay unique when a label repeats. */
export const keysFor = (labels: string[]): string[] => {
  const seen = new Map<string, number>()
  return labels.map(l => {
    const n = (seen.get(l) ?? 0) + 1
    seen.set(l, n)
    return n === 1 ? l : `${l}~${n}`
  })
}

async function setValue($: Engine, key: string, v: number | string): Promise<void> {
  await update($, values, m => trim({ ...m, [key]: v }, MAX_KEYS))
}

async function cycleSort($: Engine, k: string, col: number): Promise<void> {
  await update($, sorts, m => {
    const n = nextSort(m[k], col)
    const rest = Object.fromEntries(Object.entries(m).filter(([kk]) => kk !== k))
    return trim(n ? { ...rest, [k]: n } : rest, MAX_KEYS)
  })
}

async function resetInputs($: Engine, keys: string[]): Promise<void> {
  await update($, values, m => Object.fromEntries(Object.entries(m).filter(([kk]) => !keys.includes(kk))))
}

async function sendPrompt($: Engine, text: string): Promise<void> {
  await $.prompt.fill({ text })
  $.ui.toast('picture-this: in your prompt; press Enter to send', { timeoutMs: 4000 })
}

// What every renderer needs besides `$`: the surface's elements and the block's state.
type Ctx = { el: Record<string, any>; scope: string; vars: Vars; sorts: Record<string, Sort>; terminal: boolean; clientOk: boolean }

const linesOf = (ctx: Ctx, k: string, ls: string[]) => {
  const { Box, Text } = ctx.el
  return (
    <Box key={k} flexDirection="column">
      {keysFor(ls).map((key, j) => (
        <Text key={key}>{ls[j]}</Text>
      ))}
    </Box>
  )
}

const headOf = (ctx: Ctx, k: string, c: Component) => {
  const title = titleOf(c)
  return title ? (
    <ctx.el.Text key={`${k}-h`} bold>
      {title}
    </ctx.el.Text>
  ) : null
}

function drawTable($: Engine, ctx: Ctx, k: string, c: Extract<Component, { type: 'table' }>) {
  const { Box, Text, Button, Markdown } = ctx.el
  const sort = ctx.sorts[k]
  const body = ctx.terminal ? linesOf(ctx, `${k}-b`, tableLines(c.columns, c.rows, sort)) : <Markdown key={`${k}-b`} text={tableMarkdown(c.columns, c.rows, sort)} />
  const cols = c.columns.slice(0, 6)
  return (
    <Box key={k} flexDirection="column">
      {headOf(ctx, k, c)}
      {body}
      {c.rows.length > 1 && (
        <Box key={`${k}-s`} flexWrap="wrap">
          <Text key="l" dimColor>
            sort:{' '}
          </Text>
          {keysFor(cols).map((ck, ci) => (
            <Button key={`sort-${ck}`} label={headerOf(cols[ci] ?? ck, ci, sort)} plain onPress={() => cycleSort($, k, ci)} />
          ))}
        </Box>
      )}
    </Box>
  )
}

function drawInput($: Engine, ctx: Ctx, inp: CalcInput) {
  const { Box, Text, Button, Client } = ctx.el
  const key = `${ctx.scope}/${inp.id}`
  const v = ctx.vars[inp.id] as number
  const step = (d: number) => setValue($, key, Math.min(inp.max, Math.max(inp.min, Number((v + d).toFixed(6)))))
  const bar = ctx.clientOk ? (
    <Client key={`slider:${key}`} module="./slider.tsx" props={{ value: v, min: inp.min, max: inp.max, step: inp.step }} width={20} />
  ) : (
    <Text key="bar" color="cyan">
      {sliderBar(v, inp.min, inp.max)}
    </Text>
  )
  return (
    <Box key={`in-${inp.id}`} flexWrap="wrap">
      <Text key="l">{inp.label + ': '}</Text>
      <Text key="v" bold>
        {withUnit(fmtNum(v), inp.unit) + ' '}
      </Text>
      {bar}
      <Button key={`dn-${inp.id}`} label="−" onPress={() => step(-inp.step)} />
      <Button key={`up-${inp.id}`} label="+" onPress={() => step(inp.step)} />
    </Box>
  )
}

function drawOutput(ctx: Ctx, o: CalcOutput, key: string) {
  const { Text } = ctx.el
  const out = evaluate(o.formula, numbersOf(ctx.vars))
  const shown = out === undefined ? '—' : withUnit(fmtNum(out, o.digits), o.unit)
  return (
    <Text key={key}>
      {o.label + ': '}
      <Text key="n" bold color={out === undefined ? 'yellow' : 'green'}>
        {shown}
      </Text>
    </Text>
  )
}

function drawCalc($: Engine, ctx: Ctx, k: string, c: Extract<Component, { type: 'calc' }>) {
  const { Box, Button } = ctx.el
  const inputKeys = c.inputs.map(inp => `${ctx.scope}/${inp.id}`)
  const outKeys = keysFor(c.outputs.map(o => `out-${o.id ?? o.label}`))
  return (
    <Box key={k} flexDirection="column">
      {headOf(ctx, k, c)}
      {c.inputs.map(inp => drawInput($, ctx, inp))}
      {c.outputs.map((o, j) => drawOutput(ctx, o, outKeys[j] ?? o.label))}
      <Box key="reset-row">
        <Button key="reset" label="Reset" plain dimColor onPress={() => resetInputs($, inputKeys)} />
      </Box>
    </Box>
  )
}

function drawChoice($: Engine, ctx: Ctx, k: string, c: Extract<Component, { type: 'choice' }>) {
  const { Box, Button } = ctx.el
  const cur = ctx.vars[c.id]
  return (
    <Box key={k} flexDirection="column">
      {headOf(ctx, k, c)}
      <Box key="opts" flexWrap="wrap">
        {c.options.map(o => (
          <Button key={`o-${o}`} label={`${cur === o ? '●' : '○'} ${o}`} variant={cur === o ? 'primary' : 'secondary'} onPress={() => setValue($, `${ctx.scope}/${c.id}`, o)} />
        ))}
      </Box>
    </Box>
  )
}

function drawSend($: Engine, ctx: Ctx, k: string, c: Extract<Component, { type: 'send' }>) {
  const { Box, Text, Button } = ctx.el
  const text = fillPrompt(c.prompt, ctx.vars)
  return (
    <Box key={k} flexDirection="column">
      <Button key="send" label={`↩ ${c.label}`} variant="primary" onPress={() => sendPrompt($, text)} />
      <Text key="p" dimColor>
        {text}
      </Text>
    </Box>
  )
}

function drawStat(ctx: Ctx, k: string, c: Extract<Component, { type: 'stat' }>) {
  const { Box, Text } = ctx.el
  const delta = c.delta ? (
    <Text key="d" color={c.delta.startsWith('-') ? 'red' : 'green'}>
      {'  ' + c.delta}
    </Text>
  ) : null
  return (
    <Box key={k} flexDirection="column">
      <Text key="l" dimColor>
        {c.label}
      </Text>
      <Text key="v" bold>
        {c.value}
        {delta}
      </Text>
      {c.note ? (
        <Text key="n" dimColor>
          {c.note}
        </Text>
      ) : null}
    </Box>
  )
}

function drawStatic(ctx: Ctx, k: string, c: Component) {
  const { Box, Svg } = ctx.el
  const svg = !ctx.terminal && Svg ? svgFor(c) : undefined
  if (svg) return <Svg key={k} source={svg} alt={titleOf(c) ?? c.type} />
  return (
    <Box key={k} flexDirection="column">
      {headOf(ctx, k, c)}
      {linesOf(ctx, `${k}-b`, textLines(c, ctx.sorts[k]))}
    </Box>
  )
}

function drawPiece($: Engine, ctx: Ctx, c: Component, k: string) {
  switch (c.type) {
    case 'table':
      return drawTable($, ctx, k, c)
    case 'calc':
      return drawCalc($, ctx, k, c)
    case 'choice':
      return drawChoice($, ctx, k, c)
    case 'send':
      return drawSend($, ctx, k, c)
    case 'stat':
      return drawStat(ctx, k, c)
    default:
      return drawStatic(ctx, k, c)
  }
}

const skippedText = (n: number) => (n === 1 ? '(1 piece could not be drawn)' : `(${n} pieces could not be drawn)`)

/** One block of components, with their live controls; `scope` keeps each block's values apart. */
async function drawBlock($: Engine, e: RenderEvent, scope: string, components: Component[], pending: boolean, skipped: number) {
  const el = $.ui.resolve(e) as unknown as Record<string, any>
  const { Box, Text } = el
  // Client runs on terminal and desktop only; elsewhere a text bar and the − / + buttons.
  const clientOk = (e.surface === 'terminal' || e.surface === 'desktop') && el.Client !== undefined && !(await read($, noClient))
  const ctx: Ctx = { el, scope, vars: varsOf(components, scope, await read($, values)), sorts: await read($, sorts), terminal: e.surface === 'terminal', clientOk }
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
  const { Box, Text, Markdown } = $.ui.resolve(e) as unknown as Record<string, any>

  let body: unknown
  if (hasBlock(text)) {
    const segments = splitBlocks(text)
    const keys = keysFor(segments.map(s => (s.kind === 'text' ? `t:${s.text.slice(0, 40)}` : `b:${s.block.index}`)))
    const parts = await Promise.all(
      segments.map((s, i) =>
        s.kind === 'text' ? <Markdown key={keys[i]} text={s.text} /> : drawBlock($, e, `${key}#${s.block.index}`, s.block.components, s.block.pending, s.block.skipped),
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
          {await drawBlock($, e, `tldr:${card.id}`, [viz], false, 0)}
        </Box>
      )}
    </Box>
  )
}

export const register: Register = (on, options) => {
  const classify = options.classify !== false

  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'show',
      description:
        'Draw native UI in the thread: charts, tables, cards, diagrams, schematic maps and live calculators. Same components as a ```ui block; ' +
        'prefer the block inside a prose answer, the tool when the picture is the whole answer.',
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

  // Pick a picture per prompt. matchmaker, when on, already classifies every prompt and hints at this plugin: one call, not two.
  on('prompt.submit', async ($, e, next) => {
    if (!classify || !shouldClassify(e.text, e.origin !== undefined)) return next(e)
    if ((await $.state.get({ plugin: 'matchmaker', key: 'isOff' })).value === false) return next(e)
    const label = await $.model.classify(e.text.trim(), LABELS).catch(() => undefined)
    const hint = label ? HINT[label] : undefined
    return hint ? next({ ...e, context: [...(e.context ?? []), hint] }) : next(e)
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const raw = (e as unknown as { components?: unknown }).components
    const list = Array.isArray(raw) ? raw.slice(0, 24) : []
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
    return (await drawBlock($, e, `tool:${e.props.tool_use_id}`, components, false, 0)) as never
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const text = e.props.text
    if (!hasBlock(text) && !((await $.state.get({ plugin: 'too-long-didnt-read', key: 'cards' })).value ?? []).length) return next(e)
    return (await drawMessage($, e, text, () => next(e))) as never
  })

  // A slider moved: its key is `slider:<scope>/<id>`, the value key it drives.
  on('ui.message', async ($, e, next) => {
    const v = (e.data as { value?: unknown } | null)?.value
    if (e.element.startsWith('slider:') && typeof v === 'number' && Number.isFinite(v)) await setValue($, e.element.slice('slider:'.length), v)
    return next(e)
  })

  // A slider that cannot run here: draw the text bar and buttons from now on.
  on('ui.fault', async ($, e, next) => {
    await update($, noClient, () => true)
    return next(e)
  })
}
