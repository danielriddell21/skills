import { atom, read, update } from 'claude-code'
import type { Hook, Register } from 'claude-code'

import type { Component, Sort } from '../types'

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

/** The values a block's controls hold now: calc inputs (as moved), choices, then each output with an id. */
export const varsOf = (components: Component[], scope: string, vals: Record<string, number | string>): Record<string, number | string> => {
  const vars: Record<string, number | string> = {}
  for (const c of components) {
    if (c.type === 'calc') for (const i of c.inputs) vars[i.id] = typeof vals[`${scope}/${i.id}`] === 'number' ? (vals[`${scope}/${i.id}`] as number) : i.value
    if (c.type === 'choice') vars[c.id] = vals[`${scope}/${c.id}`] ?? c.value ?? ''
  }
  for (const c of components) {
    if (c.type !== 'calc') continue
    for (const o of c.outputs) {
      const nums = Object.fromEntries(Object.entries(vars).filter((kv): kv is [string, number] => typeof kv[1] === 'number'))
      const v = evaluate(o.formula, nums)
      if (o.id && v !== undefined) vars[o.id] = Number(v.toFixed(o.digits ?? 6))
    }
  }
  return vars
}

/** The send button's prompt with {id}s filled; an id with no value stays as written. */
export const fillPrompt = (template: string, vars: Record<string, number | string>): string =>
  template.replace(/\{(\w+)\}/g, (m, id: string) => {
    const v = vars[id]
    if (v === undefined || v === '') return m
    return typeof v === 'number' ? fmtNum(v) : v
  })

const trim = <T,>(m: Record<string, T>, n: number): Record<string, T> => Object.fromEntries(Object.entries(m).slice(-n))

const mdCell = (c: string | number) => (typeof c === 'number' ? fmtNum(c) : c).replaceAll('|', '\\|')

export const tableMarkdown = (columns: string[], rows: (string | number)[][], sort?: Sort): string => {
  const head = columns.map((c, i) => (sort?.col === i ? `${c} ${sort.desc ? '↓' : '↑'}` : c))
  return [`| ${head.map(mdCell).join(' | ')} |`, `|${columns.map(() => ' --- ').join('|')}|`, ...sortedRows(rows, sort).map(r => `| ${r.map(mdCell).join(' | ')} |`)].join('\n')
}

/** Next sort for a press on column `col`: ascending, then descending, then none. */
export const nextSort = (cur: Sort | undefined, col: number): Sort | undefined => {
  if (cur?.col !== col) return { col, desc: false }
  return cur.desc ? undefined : { col, desc: true }
}

async function setValue($: Engine, key: string, v: number | string): Promise<void> {
  await update($, values, m => trim({ ...m, [key]: v }, MAX_KEYS))
}

/** One block of components, with their live controls; `scope` keeps each block's values apart. */
async function drawBlock($: Engine, e: RenderEvent, scope: string, components: Component[], pending: boolean, skipped: number) {
  const { Box, Text, Button, Markdown, Svg, Client } = $.ui.resolve(e) as unknown as Record<string, any>
  const vals = await read($, values)
  const sortMap = await read($, sorts)
  // Client runs on terminal and desktop only; elsewhere a text bar and the − / + buttons.
  const clientOk = (e.surface === 'terminal' || e.surface === 'desktop') && Client !== undefined && !(await read($, noClient))
  const vars = varsOf(components, scope, vals)
  const terminal = e.surface === 'terminal'

  const lines = (k: string, ls: string[]) => (
    <Box key={k} flexDirection="column">
      {ls.map((l, j) => (
        <Text key={`${k}-${j}`}>{l}</Text>
      ))}
    </Box>
  )

  const piece = (c: Component, i: number) => {
    const k = `${scope}#${i}`
    const title = titleOf(c)
    const head = title ? (
      <Text key={`${k}-h`} bold>
        {title}
      </Text>
    ) : null

    if (c.type === 'table') {
      const sort = sortMap[k]
      const body = terminal ? lines(`${k}-b`, tableLines(c.columns, c.rows, sort)) : <Markdown key={`${k}-b`} text={tableMarkdown(c.columns, c.rows, sort)} />
      return (
        <Box key={k} flexDirection="column">
          {head}
          {body}
          {c.rows.length > 1 && (
            <Box key={`${k}-s`} flexWrap="wrap">
              <Text key="l" dimColor>
                sort:{' '}
              </Text>
              {c.columns.slice(0, 6).map((col, ci) => (
                <Button key={`sort-${ci}`} label={sort?.col === ci ? `${col} ${sort.desc ? '↓' : '↑'}` : col} plain onPress={async () => update($, sorts, m => {
                  const n = nextSort(m[k], ci)
                  const { [k]: _, ...rest } = m
                  return trim(n ? { ...rest, [k]: n } : rest, MAX_KEYS)
                })} />
              ))}
            </Box>
          )}
        </Box>
      )
    }

    if (c.type === 'calc') {
      return (
        <Box key={k} flexDirection="column">
          {head}
          {c.inputs.map(inp => {
            const key = `${scope}/${inp.id}`
            const v = vars[inp.id] as number
            const step = (d: number) => setValue($, key, Math.min(inp.max, Math.max(inp.min, Number((v + d).toFixed(6)))))
            return (
              <Box key={`in-${inp.id}`} flexWrap="wrap">
                <Text key="l">{`${inp.label}: `}</Text>
                <Text key="v" bold>{`${fmtNum(v)}${inp.unit ? ` ${inp.unit}` : ''} `}</Text>
                {clientOk ? (
                  <Client key={`slider:${key}`} module="./slider.tsx" props={{ value: v, min: inp.min, max: inp.max, step: inp.step }} width={20} />
                ) : (
                  <Text key="bar" color="cyan">{sliderBar(v, inp.min, inp.max)}</Text>
                )}
                <Button key={`dn-${inp.id}`} label="−" onPress={async () => step(-inp.step)} />
                <Button key={`up-${inp.id}`} label="+" onPress={async () => step(inp.step)} />
              </Box>
            )
          })}
          {c.outputs.map((o, j) => {
            const nums = Object.fromEntries(Object.entries(vars).filter((kv): kv is [string, number] => typeof kv[1] === 'number'))
            const out = evaluate(o.formula, nums)
            return (
              <Text key={`out-${j}`}>
                {`${o.label}: `}
                <Text key="n" bold color={out === undefined ? 'yellow' : 'green'}>
                  {out === undefined ? '—' : `${fmtNum(out, o.digits)}${o.unit ? ` ${o.unit}` : ''}`}
                </Text>
              </Text>
            )
          })}
          <Box key="reset-row">
            <Button
              key="reset"
              label="Reset"
              plain
              dimColor
              onPress={async () => update($, values, m => Object.fromEntries(Object.entries(m).filter(([kk]) => !c.inputs.some(inp => kk === `${scope}/${inp.id}`))))}
            />
          </Box>
        </Box>
      )
    }

    if (c.type === 'choice') {
      const cur = vars[c.id]
      return (
        <Box key={k} flexDirection="column">
          {head}
          <Box key="opts" flexWrap="wrap">
            {c.options.map(o => (
              <Button key={`o-${o}`} label={`${cur === o ? '●' : '○'} ${o}`} variant={cur === o ? 'primary' : 'secondary'} onPress={async () => setValue($, `${scope}/${c.id}`, o)} />
            ))}
          </Box>
        </Box>
      )
    }

    if (c.type === 'send') {
      const text = fillPrompt(c.prompt, vars)
      return (
        <Box key={k} flexDirection="column">
          <Button
            key="send"
            label={`↩ ${c.label}`}
            variant="primary"
            onPress={async () => {
              await $.prompt.fill({ text })
              $.ui.toast('picture-this: in your prompt; press Enter to send', { timeoutMs: 4000 })
            }}
          />
          <Text key="p" dimColor>
            {text}
          </Text>
        </Box>
      )
    }

    if (c.type === 'stat') {
      return (
        <Box key={k} flexDirection="column">
          <Text key="l" dimColor>
            {c.label}
          </Text>
          <Text key="v" bold>
            {c.value}
            {c.delta ? <Text key="d" color={c.delta.startsWith('-') ? 'red' : 'green'}>{`  ${c.delta}`}</Text> : null}
          </Text>
          {c.note ? <Text key="n" dimColor>{c.note}</Text> : null}
        </Box>
      )
    }

    const svg = !terminal && Svg ? svgFor(c) : undefined
    if (svg) return <Svg key={k} source={svg} alt={title ?? c.type} />
    return (
      <Box key={k} flexDirection="column">
        {head}
        {lines(`${k}-b`, textLines(c, sortMap[k]))}
      </Box>
    )
  }

  return (
    <Box key={`blk-${scope}`} flexDirection="column" gap={1}>
      {components.map(piece)}
      {pending && (
        <Text key="pending" dimColor>
          drawing…
        </Text>
      )}
      {skipped > 0 && !pending && (
        <Text key="skipped" dimColor>
          {`(${skipped} piece${skipped === 1 ? '' : 's'} could not be drawn)`}
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
    const parts = await Promise.all(
      splitBlocks(text).map((s, i) =>
        s.kind === 'text' ? <Markdown key={`t${i}`} text={s.text} /> : drawBlock($, e, `${key}#${s.block.index}`, s.block.components, s.block.pending, s.block.skipped),
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
