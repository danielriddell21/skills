// The SVG toolkit every renderer shares. Colours come from a <style> with a prefers-color-scheme override,
// so one drawing reads on light and dark; the host isolates the markup (an image, or a script-less frame
// when interactive), so nothing here can reach the page.

// Categorical slots of the reference palette; mid steps that hold up on light and dark.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#6250d6']
export const ADD = '#1baf7a'
export const DEL = '#d64545'
export const CHG = '#d99a1e'
export const MAX_SVG = 131072

const STYLE =
  '<style>' +
  '.t{fill:#3f3f46}.m{fill:#71717a}.ln{stroke:#a1a1aa}.ah{fill:#a1a1aa}.nd{fill:#f4f4f5;stroke:#2a78d6}.hot{fill:#fde7dc;stroke:#eb6834}.lf{stroke:#d4d4d8}.bg{fill:#f4f4f5}.gr{stroke:#e4e4e7}' +
  '@media (prefers-color-scheme:dark){.t{fill:#e4e4e7}.m{fill:#a1a1aa}.ln{stroke:#71717a}.ah{fill:#71717a}.nd{fill:#1f2937;stroke:#5b9be6}.hot{fill:#43251a;stroke:#f08a5d}.lf{stroke:#3f3f46}.bg{fill:#232326}.gr{stroke:#3f3f46}}' +
  'g.n:hover rect{stroke-width:2.5}.dm{opacity:.28}.on{stroke:#2a78d6;stroke-width:2.2}' +
  `.add{stroke:${ADD}}.del{stroke:${DEL}}.chg{stroke:${CHG}}.gone text{text-decoration:line-through}` +
  '</style>'
const FONT = 'font-family="system-ui,-apple-system,Segoe UI,sans-serif"'

const marker = (id: string, fill: string) =>
  `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path ${fill} d="M0 0L10 5L0 10z"/></marker>`
/** Arrowheads: plain, lit (a tour step), added, removed. */
export const DEFS = `<defs>${marker('pt-a', 'class="ah"')}${marker('pt-on', `fill="${SERIES[0]}"`)}${marker('pt-add', `fill="${ADD}"`)}${marker('pt-del', `fill="${DEL}"`)}</defs>`

export const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
export const r1 = (n: number) => Math.round(n * 10) / 10
export const svg = (w: number, h: number, body: string, title?: string) => {
  const head = title ? `<text class="t" x="0" y="14" font-size="13" font-weight="600">${esc(title)}</text>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" ${FONT} viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}" width="${Math.ceil(w)}">${STYLE}${DEFS}${head}${body}</svg>`
}
export const text = (x: number, y: number, s: string, extra = '', cls = 'm', size = 11) => `<text class="${cls}" x="${r1(x)}" y="${r1(y)}" font-size="${size}"${extra}>${esc(s)}</text>`
export const tip = (s: string) => '<title>' + esc(s) + '</title>'
export const top = (title?: string) => (title ? 26 : 4)
export const MID = ' text-anchor="middle"'
export const END = ' text-anchor="end"'

// Rough width of system-ui text; enough to size boxes without measuring.
export const textW = (s: string, size = 12) => s.length * size * 0.56
/** A label in at most two lines of `max` characters, breaking at a space where it can. */
export const wrap = (s: string, max = 18): string[] => {
  if (s.length <= max) return [s]
  const cut = s.lastIndexOf(' ', max)
  const at = cut > max / 3 ? cut : max
  const rest = s.slice(at).trim()
  return [s.slice(0, at).trim(), rest.length > max ? rest.slice(0, max - 1) + '…' : rest]
}
