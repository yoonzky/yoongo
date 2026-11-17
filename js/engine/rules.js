/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
// правила го: доска с рамкой, взятие, самоубийство, позиционное суперко
'use strict'

const EMPTY = 0, BLACK = 1, WHITE = 2, EDGE = 3
const PASS = -1
const COLS = 'ABCDEFGHJKLMNOPQRST'

// хэш Зобриста на сиде, одинаковый в окне и в воркере
const ZOB = (() => {
  let s = 0x9e3779b9
  const rnd = () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return s >>> 0
  }
  const z = new Uint32Array(21 * 21 * 3 * 2)
  for (let i = 0; i < z.length; i++) z[i] = rnd()
  return z
})()

function geom(n) {
  const W = n + 2
  return {n, W, size: W * W, D: [1, -1, W, -W]}
}

function newBoard(n) {
  const {W, size} = geom(n)
  const b = new Int8Array(size)
  for (let i = 0; i < size; i++) {
    const x = i % W, y = (i / W) | 0
    if (x == 0 || y == 0 || x == W - 1 || y == W - 1) b[i] = EDGE
  }
  return b
}

const pt = (n, x, y) => (y + 1) * (n + 2) + x + 1
const xy = (n, p) => [p % (n + 2) - 1, ((p / (n + 2)) | 0) - 1]

// цепочка и её дыхания
function groupOf(b, W, p) {
  const c = b[p]
  const stones = [p], libs = new Set(), seen = new Set([p])
  for (let i = 0; i < stones.length; i++) {
    const s = stones[i]
    for (const d of [1, -1, W, -W]) {
      const q = s + d
      if (b[q] == EMPTY) libs.add(q)
      else if (b[q] == c && !seen.has(q)) {
        seen.add(q)
        stones.push(q)
      }
    }
  }
  return {stones, libs}
}

function libCount(b, W, p) {
  return groupOf(b, W, p).libs.size
}

// ставит камень, снимает мёртвых; -1 если самоубийство, иначе список снятых
function place(b, W, p, c) {
  if (b[p] != EMPTY) return null
  b[p] = c
  const o = 3 - c
  let cap = []
  for (const d of [1, -1, W, -W]) {
    const q = p + d
    if (b[q] == o) {
      const g = groupOf(b, W, q)
      if (g.libs.size == 0) {
        for (const s of g.stones) b[s] = EMPTY
        cap = cap.concat(g.stones)
      }
    }
  }
  if (!cap.length && groupOf(b, W, p).libs.size == 0) {
    b[p] = EMPTY
    return null
  }
  return cap
}

// хэш одним числом до 2^47, чтобы ключи таблиц с флагами не теряли точность
function hashOf(b, n) {
  let h1 = 0, h2 = 0
  for (let i = 0; i < b.length; i++) {
    const c = b[i]
    if (c == BLACK || c == WHITE) {
      const k = (i * 2 + c - 1) * 2
      h1 ^= ZOB[k]
      h2 ^= ZOB[k + 1]
    }
  }
  return (h1 >>> 0) * 32768 + (h2 >>> 17)
}

function stars(n) {
  if (n == 19) return [3, 9, 15].flatMap(y => [3, 9, 15].map(x => [x, y]))
  if (n == 13) return [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]]
  if (n == 9) return [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]]
  return [[(n - 1) / 2, (n - 1) / 2]]
}

// фора на звёздные пункты по обычному порядку
function handicapPoints(n, k) {
  if (k < 2) return []
  const e = n < 13 ? 2 : 3, m = (n - 1) / 2, f = n - 1 - e
  const pts = [[f, e], [e, f], [f, f], [e, e], [m, m], [e, m], [f, m], [m, e], [m, f]]
  let use
  if (k <= 4) use = pts.slice(0, k)
  else if (k == 5) use = [...pts.slice(0, 4), pts[4]]
  else if (k == 6) use = [...pts.slice(0, 4), pts[5], pts[6]]
  else if (k == 7) use = [...pts.slice(0, 4), pts[4], pts[5], pts[6]]
  else if (k == 8) use = [...pts.slice(0, 4), ...pts.slice(5, 9)]
  else use = pts
  if (n == 7) use = use.slice(0, Math.min(k, 4))
  return use.map(([x, y]) => pt(n, x, y))
}

// партия: доска, чей ход, взятые, история позиций для суперко
class Go {
  constructor(n, setup = [], first = BLACK) {
    const g = geom(n)
    this.n = n
    this.W = g.W
    this.b = newBoard(n)
    for (const [p, c] of setup) this.b[p] = c
    this.turn = first
    this.cap = [0, 0, 0]
    this.passes = 0
    this.last = null
    this.moves = []
    this.hist = new Set([hashOf(this.b, n)])
  }
  clone() {
    const g = Object.create(Go.prototype)
    Object.assign(g, this)
    g.b = this.b.slice()
    g.cap = this.cap.slice()
    g.moves = this.moves.slice()
    g.hist = new Set(this.hist)
    return g
  }
  // ход без изменения позиции: null если нельзя, иначе {b, cap}
  tryMove(p, c = this.turn) {
    const b = this.b.slice()
    const cap = place(b, this.W, p, c)
    if (cap == null) return null
    if (this.hist.has(hashOf(b, this.n))) return null
    return {b, cap}
  }
  legal(p, c = this.turn) {
    return p == PASS || (this.b[p] == EMPTY && this.tryMove(p, c) != null)
  }
  play(p) {
    const c = this.turn
    if (p == PASS) {
      this.passes++
      this.last = PASS
      this.moves.push(PASS)
      this.turn = 3 - c
      return []
    }
    const r = this.b[p] == EMPTY ? this.tryMove(p, c) : null
    if (!r) return null
    this.b = r.b
    this.cap[c] += r.cap.length
    this.passes = 0
    this.last = p
    this.moves.push(p)
    this.turn = 3 - c
    this.hist.add(hashOf(this.b, this.n))
    return r.cap
  }
  legalMoves() {
    const out = []
    for (let p = 0; p < this.b.length; p++) if (this.b[p] == EMPTY && this.tryMove(p)) out.push(p)
    return out
  }
  label(p) {
    if (p == PASS) return 'pass'
    const [x, y] = xy(this.n, p)
    return COLS[x] + (this.n - y)
  }
}

// счёт по площади: живые камни плюс пустые области, которые касаются одного цвета
function areaScore(b, n, dead = new Set()) {
  const W = n + 2
  const g = b.slice()
  for (const p of dead) g[p] = EMPTY
  const own = new Int8Array(b.length)
  const seen = new Uint8Array(b.length)
  let sb = 0, sw = 0
  for (let p = 0; p < g.length; p++) {
    if (g[p] == BLACK) {
      sb++
      own[p] = BLACK
    } else if (g[p] == WHITE) {
      sw++
      own[p] = WHITE
    }
  }
  for (let p = 0; p < g.length; p++) {
    if (g[p] != EMPTY || seen[p]) continue
    const reg = [p]
    seen[p] = 1
    let touch = 0
    for (let i = 0; i < reg.length; i++) {
      for (const d of [1, -1, W, -W]) {
        const q = reg[i] + d
        if (g[q] == EMPTY) {
          if (!seen[q]) {
            seen[q] = 1
            reg.push(q)
          }
        } else if (g[q] != EDGE) touch |= g[q]
      }
    }
    if (touch == BLACK || touch == WHITE) for (const q of reg) own[q] = touch
  }
  let tb = 0, tw = 0
  for (let p = 0; p < g.length; p++) {
    if (g[p] == EMPTY && own[p] == BLACK) tb++
    if (g[p] == EMPTY && own[p] == WHITE) tw++
  }
  return {b: sb + tb, w: sw + tw, sb, sw, tb, tw, own}
}

// переводит точку в sgf и обратно, aa = левый верхний угол
const toSgf = (n, p) => {
  const [x, y] = xy(n, p)
  return String.fromCharCode(97 + x) + String.fromCharCode(97 + y)
}
const fromSgf = (n, s) => pt(n, s.charCodeAt(0) - 97, s.charCodeAt(1) - 97)

if (typeof module != 'undefined') module.exports = {EMPTY, BLACK, WHITE, EDGE, PASS, COLS, ZOB, geom, newBoard, pt, xy, groupOf, libCount, place, hashOf, stars, handicapPoints, Go, areaScore, toSgf, fromSgf}
