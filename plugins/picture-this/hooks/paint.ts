// The SVG toolkit every renderer shares. The host isolates the markup (an image, or a script-less frame when
// interactive), so nothing here can reach the page.

// Colours are CSS variables, set from the person's Claude theme (/config `theme`), so a picture matches the
// app around it. Values approximate Claude Code's own theme colours (the host gives no way to resolve a theme
// key to a colour inside an SVG); a theme we do not know falls back to the OS light/dark preference.
export type Palette = {
  text: string // body text
  mute: string // `inactive`: secondary text
  line: string // `subtle`: lines, borders, arrows
  faint: string // grid, lifelines, lane bands
  node: string // box fill
  claude: string // the accent: hot, focus, the lit path
  add: string // `diffAdded` / `success`
  del: string // `diffRemoved` / `error`
  chg: string // `warning`
  series: [string, string, string, string] // claude, suggestion, success, planMode
}

const LIGHT: Palette = {
  text: '#1f1f1f', mute: '#666666', line: '#a8a8a8', faint: '#e6e3dd', node: '#faf9f5', claude: '#d77757',
  add: '#2c7a39', del: '#ab2b3f', chg: '#966c1e', series: ['#d77757', '#5769f7', '#2c7a39', '#006666'],
}
const DARK: Palette = {
  text: '#ececec', mute: '#999999', line: '#6b6b6b', faint: '#333333', node: '#262624', claude: '#d77757',
  add: '#4eba65', del: '#ff6b80', chg: '#ffc107', series: ['#d77757', '#b1b9f9', '#4eba65', '#48968c'],
}
// Colour-blind themes: added and removed as blue and orange, never green against red.
const LIGHT_CB: Palette = { ...LIGHT, add: '#0066cc', del: '#c25e00', series: ['#d77757', '#5769f7', '#0066cc', '#7a5195'] }
const DARK_CB: Palette = { ...DARK, add: '#66aaff', del: '#ff9f4a', series: ['#d77757', '#b1b9f9', '#66aaff', '#bc8cff'] }

/** The palette for a Claude theme name (`dark`, `light-daltonized`, `dark-ansi`…); undefined when unknown. */
export const paletteFor = (theme: string | undefined): Palette | undefined => {
  const t = (theme ?? '').toLowerCase()
  const cb = t.includes('dalton') || t.includes('colorblind')
  if (t.startsWith('dark')) return cb ? DARK_CB : DARK
  if (t.startsWith('light')) return cb ? LIGHT_CB : LIGHT
  return undefined
}

const vars = (p: Palette) =>
  `--tx:${p.text};--mu:${p.mute};--ln:${p.line};--fa:${p.faint};--nd:${p.node};--cl:${p.claude};--add:${p.add};--del:${p.del};--chg:${p.chg};` +
  p.series.map((c, i) => `--s${i}:${c}`).join(';')

// Colour references for markup: always `style="fill:…"`, never a presentation attribute.
export const SERIES = ['var(--s0)', 'var(--s1)', 'var(--s2)', 'var(--s3)']
export const CLAUDE = 'var(--cl)'
export const MAX_SVG = 131072

const RULES =
  '.t{fill:var(--tx)}.m{fill:var(--mu)}.ln{stroke:var(--ln)}.ah{fill:var(--ln)}.nd{fill:var(--nd);stroke:var(--ln)}' +
  '.hot{fill:color-mix(in srgb,var(--cl) 16%,var(--nd));stroke:var(--cl)}.lf{stroke:var(--fa)}.bg{fill:var(--fa);fill-opacity:.5}.gr{stroke:var(--fa)}' +
  'g.n:hover rect{stroke-width:2.5}.dm{opacity:.28}.on{stroke:var(--cl);stroke-width:2.2}.onh{fill:var(--cl)}' +
  '.add{stroke:var(--add)}.del{stroke:var(--del)}.chg{stroke:var(--chg)}.addh{fill:var(--add)}.delh{fill:var(--del)}.gone text{text-decoration:line-through}'

// Set per drawing by svgFor; module state is fine, drawing is synchronous.
let palette: Palette | undefined
export const usePalette = (p: Palette | undefined) => {
  palette = p
}
const style = () => {
  const root = palette ? `:root{${vars(palette)}}` : `:root{${vars(LIGHT)}}@media (prefers-color-scheme:dark){:root{${vars(DARK)}}}`
  return `<style>${root}${RULES}</style>`
}
const FONT = 'font-family="system-ui,-apple-system,Segoe UI,sans-serif"'

const marker = (id: string, cls: string) =>
  `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="${cls}" d="M0 0L10 5L0 10z"/></marker>`
/** Arrowheads: plain, lit (a tour step), added, removed. */
export const DEFS = `<defs>${marker('pt-a', 'ah')}${marker('pt-on', 'onh')}${marker('pt-add', 'addh')}${marker('pt-del', 'delh')}</defs>`

export const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
export const r1 = (n: number) => Math.round(n * 10) / 10
/** The SVG document. The title is drawn by the host as Text (selectable, in the reply's own type), never in here. */
export const svg = (w: number, h: number, body: string, _title?: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${FONT} viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}" width="${Math.ceil(w)}">${style()}${DEFS}${body}</svg>`
export const text = (x: number, y: number, s: string, extra = '', cls = 'm', size = 11) => `<text class="${cls}" x="${r1(x)}" y="${r1(y)}" font-size="${size}"${extra}>${esc(s)}</text>`
export const tip = (s: string) => '<title>' + esc(s) + '</title>'
// Room above the drawing; titles are host Text now, so no title band.
export const top = (_title?: string) => 4
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
