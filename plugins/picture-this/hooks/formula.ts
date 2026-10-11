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
const OPS = '+-*/%^(),'

const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9'
const isIdStart = (c: string | undefined) => c !== undefined && /[A-Za-z_]/.test(c)
const isIdChar = (c: string | undefined) => isIdStart(c) || isDigit(c)

/** Where a number starting at `i` ends: digits, an optional fraction, an optional exponent. */
const numberEnd = (src: string, i: number): number => {
  let j = i
  while (isDigit(src[j])) j++
  if (src[j] === '.' && isDigit(src[j + 1])) {
    j++
    while (isDigit(src[j])) j++
  }
  if (src[j] === 'e' || src[j] === 'E') {
    let k = j + 1
    if (src[k] === '+' || src[k] === '-') k++
    if (isDigit(src[k])) {
      while (isDigit(src[k])) k++
      j = k
    }
  }
  return j
}

export const tokenize = (src: string): Tok[] | undefined => {
  if (src.length > MAX_LEN) return undefined
  const out: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i] as string
    if (c.trim() === '') {
      i++
    } else if (isDigit(c)) {
      const j = numberEnd(src, i)
      out.push({ k: 'num', v: Number(src.slice(i, j)) })
      i = j
    } else if (isIdStart(c)) {
      let j = i + 1
      while (isIdChar(src[j])) j++
      out.push({ k: 'id', v: src.slice(i, j) })
      i = j
    } else if (OPS.includes(c)) {
      out.push({ k: 'op', v: c })
      i++
    } else return undefined
  }
  return out
}

class Bad extends Error {}
const fail = (): never => {
  throw new Bad('bad formula')
}

/** Recursive descent over the tokens: expr := term (+|- term)*, term := power (*|/|% power)*, power := unary (^ power)?. */
class Parser {
  private i = 0
  constructor(
    private readonly toks: Tok[],
    private readonly vars: Record<string, number>,
  ) {}

  get done(): boolean {
    return this.i === this.toks.length
  }

  private isOp(v: string): boolean {
    const t = this.toks[this.i]
    return t?.k === 'op' && t.v === v
  }

  private take(v: string): void {
    if (!this.isOp(v)) fail()
    this.i++
  }

  expr(): number {
    let v = this.term()
    while (this.isOp('+') || this.isOp('-')) {
      const plus = this.isOp('+')
      this.i++
      const r = this.term()
      v = plus ? v + r : v - r
    }
    return v
  }

  private term(): number {
    let v = this.power()
    for (let op = this.mulOp(); op; op = this.mulOp()) {
      this.i++
      const r = this.power()
      if (op === '*') v *= r
      else if (op === '/') v /= r
      else v %= r
    }
    return v
  }

  private mulOp(): string | undefined {
    return ['*', '/', '%'].find(o => this.isOp(o))
  }

  private power(): number {
    const base = this.unary()
    if (!this.isOp('^')) return base
    this.i++
    return base ** this.power()
  }

  private unary(): number {
    if (this.isOp('-') || this.isOp('+')) {
      const minus = this.isOp('-')
      this.i++
      const v = this.power()
      return minus ? -v : v
    }
    return this.primary()
  }

  private primary(): number {
    const t = this.toks[this.i++] ?? fail()
    if (t.k === 'num') return t.v
    if (t.k === 'id') return this.isOp('(') ? this.call(t.v) : this.variable(t.v)
    if (t.v !== '(') fail()
    const v = this.expr()
    this.take(')')
    return v
  }

  private variable(name: string): number {
    return (Object.hasOwn(this.vars, name) ? this.vars[name] : undefined) ?? fail()
  }

  private call(name: string): number {
    const fn = (Object.hasOwn(FUNCS, name) ? FUNCS[name] : undefined) ?? fail()
    this.take('(')
    const args: number[] = []
    if (!this.isOp(')')) {
      args.push(this.expr())
      while (this.isOp(',')) {
        this.i++
        args.push(this.expr())
      }
    }
    this.take(')')
    return fn(...args)
  }
}

/** The formula's value with `vars` bound; undefined when it does not parse, names an unknown id, or is not finite. */
export const evaluate = (src: string, vars: Record<string, number>): number | undefined => {
  const toks = tokenize(src)
  if (!toks || toks.length === 0) return undefined
  try {
    const p = new Parser(toks, vars)
    const v = p.expr()
    return p.done && Number.isFinite(v) ? v : undefined
  } catch {
    return undefined
  }
}

const group = (whole: string): string => {
  const parts: string[] = []
  for (let end = whole.length; end > 0; end -= 3) parts.unshift(whole.slice(Math.max(0, end - 3), end))
  return parts.join(',')
}

/** A number for display: grouped thousands, `digits` decimals (default: up to 2). */
export const fmtNum = (n: number, digits?: number): string => {
  const d = digits ?? (Number.isInteger(n) ? 0 : 2)
  const fixed = Math.abs(n).toFixed(Math.max(0, Math.min(6, d)))
  const [whole = '', frac] = fixed.split('.')
  const sign = n < 0 ? '-' : ''
  const tail = frac ? '.' + frac : ''
  return sign + group(whole) + tail
}
