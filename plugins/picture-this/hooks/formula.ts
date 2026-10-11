// A small arithmetic evaluator for calc outputs: numbers, input ids, + - * / % ^, parentheses and a few
// functions. No eval, no property access: anything else is an error, shown as "—" instead of NaN.

const FUNCS: Record<string, (...a: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d,
  floor: Math.floor,
  ceil: Math.ceil,
  sqrt: Math.sqrt,
  pow: Math.pow,
  log: Math.log,
  log10: Math.log10,
  exp: Math.exp,
}

type Tok = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string }

const MAX_LEN = 300

export const tokenize = (src: string): Tok[] | undefined => {
  if (src.length > MAX_LEN) return undefined
  const out: Tok[] = []
  const re = /\s*(?:(\d+(?:\.\d+)?(?:e[+-]?\d+)?)|([A-Za-z_]\w*)|([-+*/%^(),]))/y
  let at = 0
  while (at < src.length) {
    if (/^\s+$/.test(src.slice(at))) break
    re.lastIndex = at
    const m = re.exec(src)
    if (!m) return undefined
    if (m[1] !== undefined) out.push({ k: 'num', v: Number(m[1]) })
    else if (m[2] !== undefined) out.push({ k: 'id', v: m[2] })
    else out.push({ k: 'op', v: m[3] ?? '' })
    at = re.lastIndex
  }
  return out
}

/** The formula's value with `vars` bound; undefined when it does not parse, names an unknown id, or is not finite. */
export const evaluate = (src: string, vars: Record<string, number>): number | undefined => {
  const toks = tokenize(src)
  if (!toks || toks.length === 0) return undefined
  let i = 0
  const peek = () => toks[i]
  const isOp = (v: string) => peek()?.k === 'op' && peek()?.v === v
  const fail = (): never => {
    throw new Error('bad formula')
  }

  const primary = (): number => {
    const t = toks[i++] ?? fail()
    if (t.k === 'num') return t.v
    if (t.k === 'op' && t.v === '(') {
      const v = expr()
      if (!isOp(')')) fail()
      i++
      return v
    }
    if (t.k === 'op' && (t.v === '-' || t.v === '+')) {
      const v = power()
      return t.v === '-' ? -v : v
    }
    if (t.k === 'id') {
      if (isOp('(')) {
        const fn = (Object.hasOwn(FUNCS, t.v) ? FUNCS[t.v] : undefined) ?? fail()
        i++
        const args: number[] = []
        if (!isOp(')')) {
          args.push(expr())
          while (isOp(',')) {
            i++
            args.push(expr())
          }
        }
        if (!isOp(')')) fail()
        i++
        return fn(...args)
      }
      return (Object.hasOwn(vars, t.v) ? vars[t.v] : undefined) ?? fail()
    }
    return fail()
  }

  const power = (): number => {
    const base = primary()
    if (isOp('^')) {
      i++
      return base ** power()
    }
    return base
  }

  const term = (): number => {
    let v = power()
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = toks[i++]?.v
      const r = power()
      if (op === '*') v *= r
      else if (op === '/') v /= r
      else v %= r
    }
    return v
  }

  const expr = (): number => {
    let v = term()
    while (isOp('+') || isOp('-')) {
      const op = toks[i++]?.v
      const r = term()
      v = op === '+' ? v + r : v - r
    }
    return v
  }

  try {
    const v = expr()
    return i === toks.length && Number.isFinite(v) ? v : undefined
  } catch {
    return undefined
  }
}

/** A number for display: grouped thousands, `digits` decimals (default: up to 2). */
export const fmtNum = (n: number, digits?: number): string => {
  const d = digits ?? (Number.isInteger(n) ? 0 : 2)
  const fixed = Math.abs(n).toFixed(Math.max(0, Math.min(6, d)))
  const [whole, frac] = fixed.split('.')
  const grouped = (whole ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${n < 0 ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`
}
