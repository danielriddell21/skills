// What the engine does with a plugin toast (read from its toast layout code, build 2.1.29x):
// - the box is at most 44 columns wide; with its round frame the text gets 40 columns, word-wrapped
// - at most 3 lines are kept; everything after line 2 is joined into line 3 and cut off if it is wider
// - where the transcript goes to scrollback it is one line on the notification bar
// So: three lines, each at most 40 columns, the first one carrying the point.
export const TOAST_COLS = 40
export const TOAST_LINES = 3

/** Terminal columns a string takes: wide (CJK, emoji) characters count 2. */
export const colWidth = (s: string): number => {
  let w = 0
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    w += c >= 0x1100 && (c <= 0x115f || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0x1f300 && c <= 0x1faff)) ? 2 : 1
  }
  return w
}

/** Cut a line to `cols` columns, ending in an ellipsis when something was removed. */
export const clip = (line: string, cols = TOAST_COLS): string => {
  if (colWidth(line) <= cols) return line
  let out = ''
  for (const ch of line) {
    if (colWidth(out + ch) > cols - 1) break
    out += ch
  }
  return `${out.trimEnd()}…`
}

/** Text that shows whole in a toast: at most three lines of 40 columns, blank lines dropped. */
export const fitToast = (text: string): string => {
  const lines = text
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const kept = lines.slice(0, TOAST_LINES).map(l => clip(l))
  if (lines.length > TOAST_LINES) kept[TOAST_LINES - 1] = clip(`${kept[TOAST_LINES - 1].replace(/…$/, '')} …`)
  return kept.join('\n')
}

/** How many lines the engine would show for `text`: explicit newlines, then greedy word wrap at 40 columns. */
export const wrapCount = (text: string, cols = TOAST_COLS): number =>
  text.split('\n').reduce((n, line) => {
    let rows = 1
    let w = 0
    for (const word of line.split(' ')) {
      const ww = colWidth(word)
      if (w === 0) w = ww
      else if (w + 1 + ww <= cols) w += 1 + ww
      else {
        rows += 1
        w = ww
      }
      while (w > cols) {
        rows += 1
        w -= cols
      }
    }
    return n + rows
  }, 0)
