// Chip row: small status chips from different plugins share one row above the prompt.
// - The row is a Box with props.key === 'chips' (wrapping, so a narrow terminal gets a second line
//   instead of cut-off buttons).
// - Each chip is a Box keyed `chip:<rank>:<name>`; chips sort by rank so the order is the same
//   whichever plugin happens to draw first: gate 5, context 10, route 20, crew 25, result 30.
// Plain data in, plain data out, so it works on whatever `next(e)` returns.
export type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }

export const CHIPS_KEY = 'chips'
export const GAP = '   '
export const RANK = { gate: 5, context: 10, route: 20, crew: 25, result: 30 } as const

export const chipKey = (rank: number, name: string): string => `chip:${String(rank).padStart(3, '0')}:${name}`

const isNode = (n: unknown): n is Node => typeof n === 'object' && n !== null

const keyOf = (n: unknown): string => (isNode(n) && typeof n.props?.key === 'string' ? n.props.key : '')

/** Chips in rank order with a gap between each. */
export const arrange = (chips: unknown[]): unknown[] =>
  [...chips]
    .sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
    .flatMap((c, i) => (i === 0 ? [c] : [GAP, c]))

/** Add `chip` to the chips row inside `node`; undefined when there is none. */
export const injectChips = (node: unknown, chip: unknown): Node | undefined => {
  if (!isNode(node)) return undefined
  if (node.props?.key === CHIPS_KEY) {
    const existing = (node.children ?? []).filter(c => c !== GAP)
    return { ...node, children: arrange([...existing, chip]) }
  }
  const kids = node.children ?? []
  for (let i = kids.length - 1; i >= 0; i--) {
    const hit = injectChips(kids[i], chip)
    if (hit) return { ...node, children: kids.map((c, j) => (j === i ? hit : c)) }
  }
  return undefined
}

/** True when the band beneath drew nothing. */
export const isEmpty = (node: unknown): boolean => node == null || (isNode(node) && (node.children ?? []).length === 0)
