/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
// бот: MCTS с RAVE и лёгкими плейаутами на быстрой доске
'use strict'

if (typeof module != 'undefined' && typeof Go == 'undefined') Object.assign(globalThis, require('./rules.js'))

// быстрая доска: цепочки кольцом, псевдодыхания с суммой и суммой квадратов
class Fast {
  constructor(n) {
    const W = n + 2, S = W * W
    this.n = n
    this.W = W
    this.S = S
    this.col = new Int8Array(S)
    this.head = new Int32Array(S)
    this.nxt = new Int32Array(S)
    this.libs = new Int32Array(S)
    this.ls = new Int32Array(S)
    this.ls2 = new Float64Array(S)
    this.sz = new Int32Array(S)
    this.emp = new Int32Array(S)
    this.ei = new Int32Array(S)
    this.ne = 0
    this.ko = 0
    this.cap = [0, 0, 0]
    this.last = 0
    this.last2 = 0
  }
  load(b) {
    const {W, S} = this
    this.ne = 0
    for (let p = 0; p < S; p++) {
      this.col[p] = b[p] == EDGE ? EDGE : EMPTY
      this.libs[p] = this.ls[p] = this.ls2[p] = this.sz[p] = 0
      // камни ставятся через put, он сам вынет их из списка пустых
      if (b[p] != EDGE) {
        this.ei[p] = this.ne
        this.emp[this.ne++] = p
      }
    }
    for (let p = 0; p < S; p++) if (b[p] == BLACK || b[p] == WHITE) this.put(p, b[p])
    this.ko = 0
  }
  copyFrom(f) {
    this.col.set(f.col)
    this.head.set(f.head)
    this.nxt.set(f.nxt)
    this.libs.set(f.libs)
    this.ls.set(f.ls)
    this.ls2.set(f.ls2)
    this.sz.set(f.sz)
    this.emp.set(f.emp)
    this.ei.set(f.ei)
    this.ne = f.ne
    this.ko = f.ko
    this.cap[1] = f.cap[1]
    this.cap[2] = f.cap[2]
    this.last = f.last
    this.last2 = f.last2
  }
  atari(h) {
    return this.libs[h] > 0 && this.libs[h] * this.ls2[h] == this.ls[h] * this.ls[h]
  }
  // единственное дыхание цепочки в атари
  lib1(h) {
    return this.ls[h] / this.libs[h]
  }
  addLib(h, p) {
    this.libs[h]++
    this.ls[h] += p
    this.ls2[h] += p * p
  }
  subLib(h, p) {
    this.libs[h]--
    this.ls[h] -= p
    this.ls2[h] -= p * p
  }
  delEmpty(p) {
    const i = this.ei[p], q = this.emp[--this.ne]
    this.emp[i] = q
    this.ei[q] = i
  }
  addEmpty(p) {
    this.ei[p] = this.ne
    this.emp[this.ne++] = p
  }
  // ставит камень без проверки, возвращает число снятых
  put(p, c) {
    const {col, head, W} = this
    col[p] = c
    head[p] = p
    this.nxt[p] = p
    this.libs[p] = this.ls[p] = this.ls2[p] = 0
    this.sz[p] = 1
    this.delEmpty(p)
    const D0 = p + 1, D1 = p - 1, D2 = p + W, D3 = p - W
    for (const q of [D0, D1, D2, D3]) {
      const cq = col[q]
      if (cq == EMPTY) this.addLib(p, q)
      else if (cq == BLACK || cq == WHITE) this.subLib(head[q], p)
    }
    for (const q of [D0, D1, D2, D3]) if (col[q] == c && head[q] != head[p]) this.merge(head[p], head[q])
    let capd = 0, capAt = 0
    for (const q of [D0, D1, D2, D3]) {
      if (col[q] == 3 - c && this.libs[head[q]] == 0) {
        capAt = q
        capd += this.remove(head[q])
      }
    }
    this.cap[c] += capd
    const h = head[p]
    this.ko = capd == 1 && this.sz[h] == 1 && this.atari(h) ? capAt : 0
    return capd
  }
  merge(a, b) {
    if (this.sz[a] < this.sz[b]) {
      const t = a
      a = b
      b = t
    }
    const {head, nxt} = this
    let s = b
    do {
      head[s] = a
      s = nxt[s]
    } while (s != b)
    const t = nxt[a]
    nxt[a] = nxt[b]
    nxt[b] = t
    this.sz[a] += this.sz[b]
    this.libs[a] += this.libs[b]
    this.ls[a] += this.ls[b]
    this.ls2[a] += this.ls2[b]
  }
  remove(h) {
    const {col, head, nxt, W} = this
    let s = h, k = 0
    do {
      const nx = nxt[s]
      col[s] = EMPTY
      this.addEmpty(s)
      k++
      for (const q of [s + 1, s - 1, s + W, s - W]) {
        const cq = col[q]
        if ((cq == BLACK || cq == WHITE) && head[q] != h) this.addLib(head[q], s)
      }
      s = nx
    } while (s != h)
    return k
  }
  legal(p, c) {
    if (p == this.ko || this.col[p] != EMPTY) return false
    const {col, head, W} = this
    for (const q of [p + 1, p - 1, p + W, p - W]) {
      const cq = col[q]
      if (cq == EMPTY) return true
      if (cq == c) {
        if (!this.atari(head[q])) return true
      } else if (cq == 3 - c && this.atari(head[q])) return true
    }
    return false
  }
  // своё почти-глазо: соседи свои, на диагоналях не больше одного чужого (на краю ни одного)
  eyeish(p, c) {
    const {col, W} = this
    let edge = 0
    for (const q of [p + 1, p - 1, p + W, p - W]) {
      if (col[q] == EDGE) edge = 1
      else if (col[q] != c) return false
    }
    let bad = 0
    for (const q of [p + W + 1, p + W - 1, p - W + 1, p - W - 1]) if (col[q] == 3 - c) bad++
    return edge ? bad == 0 : bad < 2
  }
  // самоатари цепочки от трёх камней, грубо: после хода одно свободное соседство и не берём
  selfAtari(p, c) {
    const {col, head, W} = this
    let libs = 0, size = 1, lp = -1
    for (const q of [p + 1, p - 1, p + W, p - W]) {
      const cq = col[q]
      if (cq == EMPTY) {
        if (q != lp) {
          libs++
          lp = q
        }
      } else if (cq == 3 - c && this.atari(head[q])) return false
      else if (cq == c) {
        const h = head[q]
        if (!this.atari(h)) return false
        size += this.sz[h]
      }
    }
    return libs <= 1 && size >= 3
  }
  play(p, c) {
    this.last2 = this.last
    this.last = p
    if (p == PASS) {
      this.ko = 0
      return 0
    }
    return this.put(p, c)
  }
  // ход плейаута: взять или спастись у последнего хода, иначе случайный
  policy(c, rnd) {
    const {col, head, W} = this
    const lm = this.last
    if (lm > 0 && col[lm] == 3 - c) {
      const h = head[lm]
      if (this.atari(h)) {
        const q = this.lib1(h)
        if (this.legal(q, c)) return q
      }
      for (const q of [lm + 1, lm - 1, lm + W, lm - W]) {
        if (col[q] != c) continue
        const hq = head[q]
        if (!this.atari(hq)) continue
        // спасение: взять соседа в атари или удлиниться
        let s = hq
        do {
          for (const r of [s + 1, s - 1, s + W, s - W]) {
            if (col[r] == 3 - c && this.atari(head[r])) {
              const l = this.lib1(head[r])
              if (this.legal(l, c)) return l
            }
          }
          s = this.nxt[s]
        } while (s != hq)
        const l = this.lib1(hq)
        if (this.legal(l, c) && !this.selfAtari(l, c)) {
          let fr = 0
          for (const r of [l + 1, l - 1, l + W, l - W]) if (col[r] == EMPTY) fr++
          if (fr >= 2) return l
        }
      }
    }
    const ne = this.ne
    if (!ne) return PASS
    const st = (rnd() * ne) | 0
    for (let i = 0; i < ne; i++) {
      const p = this.emp[(st + i) % ne]
      if (this.legal(p, c) && !this.eyeish(p, c) && !this.selfAtari(p, c)) return p
    }
    return PASS
  }
  // площадь в конце плейаута: на доске остались камни и одиночные глаза
  score(own) {
    const {col, W, S} = this
    let s = 0
    for (let p = 0; p < S; p++) {
      let c = col[p]
      if (c == EMPTY) {
        c = 0
        let ok = 1
        for (const q of [p + 1, p - 1, p + W, p - W]) {
          const cq = col[q]
          if (cq == EDGE) continue
          if (c == 0) c = cq
          else if (cq != c) ok = 0
        }
        if (!ok || c == EMPTY) c = 0
      }
      if (c == BLACK) {
        s++
        if (own) own[p]++
      } else if (c == WHITE) {
        s--
        if (own) own[p]--
      }
    }
    return s
  }
}

function rng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

// узел дерева: v и rv считаются для игрока, сделавшего ход в узел
class Node {
  constructor(move, color, prior) {
    this.move = move
    this.color = color
    // плюс: виртуальные победы, минус: виртуальные поражения
    this.n = Math.abs(prior)
    this.w = prior > 0 ? prior : 0
    this.rn = 0
    this.rw = 0
    this.v = 0
    this.kids = null
  }
}

const LEVELS = [
  {po: 200, temp: 1, time: 600},
  {po: 1500, temp: 2, time: 1500},
  {po: 7000, temp: 0, time: 3500},
  {po: 30000, temp: 0, time: 7000},
]

// o: {go (Go), komi, capN, level, seed, budget}
function think(o) {
  const go = o.go, n = go.n, W = n + 2
  const lv = LEVELS[o.level == null ? 2 : o.level]
  const po = o.budget || lv.po
  const tmax = o.time || lv.time
  const rnd = rng(o.seed || (Date.now() ^ (Math.random() * 1e9)))
  const me = go.turn
  const komi = o.komi || 0
  const capN = o.capN || 0
  const base = new Fast(n)
  base.load(go.b)
  base.cap[1] = go.cap[1]
  base.cap[2] = go.cap[2]
  base.last = go.last == null ? 0 : go.last
  // ко из истории: запрещаем ходы, которые повторяют позицию
  const rootMoves = []
  for (let p = 0; p < go.b.length; p++) {
    if (go.b[p] != EMPTY) continue
    if (!go.tryMove(p)) continue
    if (base.eyeish(p, me) && !capN) continue
    rootMoves.push(p)
  }
  const root = new Node(go.last == null ? 0 : go.last, 3 - me, 0)
  root.kids = rootMoves.map(p => new Node(p, me, prior(base, p, me, n, true)))
  const own = new Float64Array(base.S)
  if (!rootMoves.length) return {move: PASS, wr: 0.5, own, playouts: 0, root}
  const f = new Fast(n)
  const amaf = new Int8Array(base.S)
  const path = []
  const t0 = Date.now()
  let done = 0
  for (; done < po; done++) {
    if ((done & 31) == 0 && Date.now() - t0 > tmax) break
    f.copyFrom(base)
    amaf.fill(0)
    path.length = 0
    let node = root, c = me, over = 0, win = 0
    path.push(node)
    // спуск
    while (node.kids && node.kids.length) {
      node = select(node)
      path.push(node)
      if (!f.legal(node.move, c)) break
      f.play(node.move, c)
      if (!amaf[node.move]) amaf[node.move] = c
      if (capN && f.cap[c] >= capN) {
        over = 1
        win = c
        break
      }
      c = 3 - c
      // раскрываем один узел за спуск, со второго настоящего визита
      if (!node.kids) {
        if (node.v >= 1) expand(node, f, c, n, capN)
        break
      }
    }
    // плейаут
    let passes = 0, mv = 0
    const maxMv = n * n * 2
    while (!over && passes < 2 && mv < maxMv) {
      const p = f.policy(c, rnd)
      if (p == PASS) passes++
      else {
        passes = 0
        f.play(p, c)
        if (!amaf[p]) amaf[p] = c
        if (capN && f.cap[c] >= capN) {
          over = 1
          win = c
        }
      }
      c = 3 - c
      mv++
    }
    if (!over) {
      const s = f.score(own)
      if (capN) win = f.cap[1] > f.cap[2] ? BLACK : f.cap[2] > f.cap[1] ? WHITE : s > 0 ? BLACK : WHITE
      else win = s - komi > 0 ? BLACK : WHITE
    }
    // обратный проход
    for (const nd of path) {
      nd.n++
      nd.v++
      if (nd.color == win) nd.w++
      if (nd.kids) {
        const nc = 3 - nd.color
        for (const k of nd.kids) {
          if (amaf[k.move] == nc) {
            k.rn++
            if (nc == win) k.rw++
          }
        }
      }
    }
  }
  for (let p = 0; p < own.length; p++) own[p] /= Math.max(1, done)
  const kids = root.kids.slice().sort((a, b) => b.v - a.v)
  let pick = kids[0]
  if (lv.temp && o.budget == null) {
    const ws = kids.map(k => Math.pow(Math.max(k.v, 0.01), lv.temp))
    let t = ws.reduce((a, b) => a + b, 0) * rnd()
    for (let i = 0; i < kids.length; i++) {
      t -= ws[i]
      if (t <= 0) {
        pick = kids[i]
        break
      }
    }
  }
  const best = kids[0]
  return {move: pick.move, wr: best.n ? best.w / best.n : 0.5, own, playouts: done, root, top: kids.slice(0, 5).map(k => [k.move, k.v, k.w / Math.max(1, k.n)])}
}

// априорные визиты: ход рядом с последним, третья и четвёртая линии, взятие
function prior(f, p, c, n, root) {
  const W = n + 2
  const x = p % W - 1, y = ((p / W) | 0) - 1
  const d = Math.min(x, y, n - 1 - x, n - 1 - y)
  let v = 0
  if (n >= 9 && d == 0) v -= 3
  if (n >= 13 && (d == 2 || d == 3)) v += 2
  const lm = f.last
  if (lm > 0) {
    const lx = lm % W - 1, ly = ((lm / W) | 0) - 1
    if (Math.abs(lx - x) <= 1 && Math.abs(ly - y) <= 1) v += 3
  }
  for (const q of [p + 1, p - 1, p + W, p - W]) {
    const cq = f.col[q]
    if (cq == 3 - c && f.atari(f.head[q])) v += 12
    if (cq == c && f.atari(f.head[q])) v += 6
  }
  if (f.selfAtari(p, c)) v -= 10
  return v
}

function expand(node, f, c, n, capN) {
  const kids = []
  for (let i = 0; i < f.ne; i++) {
    const p = f.emp[i]
    if (!f.legal(p, c)) continue
    if (!capN && f.eyeish(p, c)) continue
    kids.push(new Node(p, c, prior(f, p, c, n)))
  }
  node.kids = kids
}

const RAVE_B = 0.035
function select(node) {
  let best = null, bv = -1
  const lnN = Math.log(node.n + 1)
  for (const k of node.kids) {
    const q = k.n ? k.w / k.n : 0.5
    const rq = k.rn ? k.rw / k.rn : 0.5
    const beta = k.rn / (k.rn + k.n + k.rn * k.n * RAVE_B + 1e-9)
    const v = (1 - beta) * q + beta * rq + 0.25 * Math.sqrt(lnN / (k.n + 1))
    if (v > bv) {
      bv = v
      best = k
    }
  }
  return best
}

// владение и мёртвые группы чистыми плейаутами
function ownership(go, playouts = 400, seed = 7) {
  const n = go.n
  const base = new Fast(n)
  base.load(go.b)
  base.last = go.last > 0 ? go.last : 0
  const f = new Fast(n)
  const own = new Float64Array(base.S)
  const rnd = rng(seed)
  for (let i = 0; i < playouts; i++) {
    f.copyFrom(base)
    let c = go.turn, passes = 0, mv = 0
    while (passes < 2 && mv < n * n * 2) {
      const p = f.policy(c, rnd)
      if (p == PASS) passes++
      else {
        passes = 0
        f.play(p, c)
      }
      c = 3 - c
      mv++
    }
    f.score(own)
  }
  for (let p = 0; p < own.length; p++) own[p] /= playouts
  return own
}

// мёртвые: камень на точке, которая чаще отходит сопернику; решение целыми цепочками
function deadStones(go, own) {
  const W = go.n + 2, b = go.b
  const dead = new Set(), seen = new Set()
  for (let p = 0; p < b.length; p++) {
    if ((b[p] != BLACK && b[p] != WHITE) || seen.has(p)) continue
    const g = groupOf(b, W, p)
    let s = 0
    for (const q of g.stones) {
      seen.add(q)
      s += own[q]
    }
    s /= g.stones.length
    if ((b[p] == BLACK && s < -0.3) || (b[p] == WHITE && s > 0.3)) for (const q of g.stones) dead.add(q)
  }
  return dead
}

// решение бота о пасе: соперник спасовал и мы впереди, или доска поделена
function shouldPass(go, own, komi, capN) {
  if (capN) return false
  const me = go.turn
  const dead = deadStones(go, own)
  const sc = areaScore(go.b, go.n, dead)
  const lead = (sc.b - sc.w - komi) * (me == BLACK ? 1 : -1)
  let open = 0
  for (let p = 0; p < go.b.length; p++) {
    if (go.b[p] == EDGE) continue
    if (Math.abs(own[p]) < 0.7) open++
  }
  if (go.last == PASS && lead > 0) return true
  return open == 0
}

if (typeof module != 'undefined') module.exports = {Fast, think, ownership, deadStones, shouldPass, LEVELS, rng}
