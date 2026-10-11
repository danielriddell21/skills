// Surface module for a calc input (terminal and desktop): drag the bar or use ←/→ (PgUp/PgDn ×10, Home/End)
// after a click. It moves at once, locally, and posts the value; the hooks module recomputes the outputs.
type Props = { value: number; min: number; max: number; step: number }
type State = { value: number; seen: number; dragging: boolean }
type Surface = {
  elements: { Box: any; Text: any }
  state: State | undefined
  setState: (s: State) => void
  columns: number
  onPointer: (fn: (e: { type: string; x: number; button?: string }) => void) => () => void
  onKey: (fn: (e: { key: string }) => void) => () => void
  post: (data: unknown) => void
}

const latest = new WeakMap<object, Props>()

const snap = (p: Props, v: number) => {
  const n = Math.round((v - p.min) / p.step) * p.step + p.min
  return Math.min(p.max, Math.max(p.min, Number(n.toFixed(6))))
}

const widthOf = (s: Surface) => Math.max(8, (s.columns || 18) - 2)

export default function Slider(props: Props, s: Surface) {
  const { Box, Text } = s.elements
  latest.set(s, props)
  const current = (): number => (s.state && s.state.seen === latest.get(s)?.value ? s.state.value : (latest.get(s)?.value ?? props.value))
  const move = (v: number, dragging = s.state?.dragging ?? false) => {
    const p = latest.get(s) ?? props
    const next = snap(p, v)
    const prev = current()
    s.setState({ value: next, seen: p.value, dragging })
    if (next !== prev) s.post({ value: next })
  }

  if (s.state === undefined) {
    s.onKey(e => {
      const p = latest.get(s) ?? props
      const big = p.step * 10
      const by: Record<string, number> = { left: -p.step, right: p.step, h: -p.step, l: p.step, down: -p.step, up: p.step, pagedown: -big, pageup: big }
      if (e.key === 'home') move(p.min)
      else if (e.key === 'end') move(p.max)
      else if (by[e.key] !== undefined) move(current() + (by[e.key] ?? 0))
    })
    s.onPointer(e => {
      const p = latest.get(s) ?? props
      const at = (x: number) => p.min + ((x - 1) / (widthOf(s) - 1)) * (p.max - p.min)
      if (e.type === 'down') move(at(e.x), true)
      else if (e.type === 'move' && s.state?.dragging && e.button) move(at(e.x), true)
      else if (e.type === 'up' && s.state) s.setState({ ...s.state, dragging: false })
    })
  }

  const p = latest.get(s) ?? props
  const v = current()
  const w = widthOf(s)
  const f = Math.max(0, Math.min(w, Math.round(((v - p.min) / (p.max - p.min || 1)) * w)))
  return (
    <Box>
      <Text color="cyan">{`[${'█'.repeat(f)}${'░'.repeat(w - f)}]`}</Text>
    </Box>
  )
}
