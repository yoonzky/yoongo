/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
// решатель задач на ограниченной области: жизнь и смерть, захват, спасение
'use strict'

if (typeof module != 'undefined' && typeof place == 'undefined') Object.assign(globalThis, require('./rules.js'))

// p: {n, b, region, target, goal, atk}; goal: live, kill, capture, save
// атакующий выигрывает, если снят хоть один камень цели
// защитник выигрывает: живёт безусловно (live, kill), набрал esc дыханий (capture, save), оба спасовали
class LD {
  constructor(p, opt = {}) {
    this.n = p.n
    this.W = p.n + 2
    this.b = p.b.slice()
    this.goal = p.goal
    this.atk = p.atk
    this.def = 3 - p.atk
    this.target = p.target.slice()
    this.region = p.region.slice()
    this.inReg = new Uint8Array(this.b.length)
    for (const q of this.region) this.inReg[q] = 1
    // окно для бенсона: область, цель и их соседи
    this.win = new Uint8Array(this.b.length)
    for (const q of [...this.region, ...this.target]) for (const d of [0, 1, -1, this.W, -this.W]) this.win[q + d] = 1
    this.esc = opt.esc || 3
    this.narrow = p.goal == 'capture' || p.goal == 'save'
    this.tt = new Map()
    this.proof = new Map()
    this.path = new Set()
    this.nodes = 0
    this.limit = opt.limit || 2e6
    this.ko = false
  }
  // 1 атакующий выиграл, -1 защитник, 0 неясно
  status(b) {
    for (const t of this.target) if (b[t] != this.def) return 1
    if (this.narrow) return this.minLibs(b) >= this.esc ? -1 : 0
    return this.benson(b) ? -1 : 0
  }
  minLibs(b) {
    let m = 99
    const seen = new Set()
    for (const t of this.target) {
      if (seen.has(t)) continue
      const g = groupOf(b, this.W, t)
      for (const s of g.stones) seen.add(s)
      m = Math.min(m, g.libs.size)
    }
    return m
  }
  // безусловная жизнь цели по бенсону, области ищутся только внутри окна
  benson(b) {
    const W = this.W, def = this.def
    const chainOf = new Map(), chains = []
    for (let p = 0; p < b.length; p++) {
      if (!this.win[p] || b[p] != def || chainOf.has(p)) continue
      const g = groupOf(b, W, p)
      const id = chains.length
      chains.push({stones: g.stones, libs: g.libs, alive: true, vital: 0})
      for (const s of g.stones) chainOf.set(s, id)
    }
    const regs = [], seen = new Uint8Array(b.length)
    for (let p = 0; p < b.length; p++) {
      if (!this.win[p] || seen[p] || b[p] == def || b[p] == EDGE) continue
      const pts = [p]
      seen[p] = 1
      let open = false
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i]
        if (!this.win[q]) open = true
        for (const d of [1, -1, W, -W]) {
          const r = q + d
          if (seen[r] || b[r] == def || b[r] == EDGE) continue
          seen[r] = 1
          pts.push(r)
        }
      }
      if (open) continue
      const nb = new Set()
      for (const q of pts) for (const d of [1, -1, W, -W]) if (b[q + d] == def) nb.add(chainOf.get(q + d))
      // область жизненно важна цепочке, если все её пустые пункты дыхания этой цепочки
      const vitalTo = []
      for (const id of nb) {
        if (id == null) continue
        const libs = chains[id].libs
        let all = true
        for (const q of pts) if (b[q] == EMPTY && !libs.has(q)) all = false
        if (all) vitalTo.push(id)
      }
      regs.push({nb: [...nb], vitalTo, ok: true})
    }
    let changed = true
    while (changed) {
      changed = false
      for (const c of chains) c.vital = 0
      for (const r of regs) if (r.ok) for (const id of r.vitalTo) chains[id].vital++
      for (const c of chains) {
        if (c.alive && c.vital < 2) {
          c.alive = false
          changed = true
        }
      }
      for (const r of regs) {
        if (r.ok && r.nb.some(id => id == null || !chains[id].alive)) {
          r.ok = false
          changed = true
        }
      }
    }
    for (const t of this.target) {
      const id = chainOf.get(t)
      if (id == null || !chains[id].alive) return false
    }
    return true
  }
  // ходы-кандидаты; в захвате узко: дыхания цели и вторые дыхания, у защитника ещё взятия соседей
  moves(b, c) {
    const W = this.W
    let cand
    if (!this.narrow) cand = this.region.filter(q => b[q] == EMPTY)
    else {
      const set = new Set(), seen = new Set()
      for (const t of this.target) {
        if (seen.has(t) || b[t] != this.def) continue
        const g = groupOf(b, W, t)
        for (const s of g.stones) seen.add(s)
        for (const l of g.libs) {
          set.add(l)
          if (c == this.atk) for (const d of [1, -1, W, -W]) if (b[l + d] == EMPTY) set.add(l + d)
        }
        if (c == this.def) {
          for (const s of g.stones) {
            for (const d of [1, -1, W, -W]) {
              if (b[s + d] != this.atk) continue
              const a = groupOf(b, W, s + d)
              if (a.libs.size == 1) for (const l of a.libs) set.add(l)
            }
          }
        }
      }
      cand = [...set].filter(q => this.inReg[q])
    }
    return cand
  }
  // ход на копии доски; null если нельзя или повтор позиции
  apply(b, q, c) {
    const nb = b.slice()
    const cap = place(nb, this.W, q, c)
    if (cap == null) return null
    const h = hashOf(nb, this.n)
    if (this.path.has(h)) return null
    return {nb, h, cap}
  }
  // true если выигрывает атакующий; mode 0: при исчерпании глубины выигрывает защитник, mode 1: атакующий
  search(b, h, c, depth, passes, mode) {
    this.nodes++
    if (this.nodes > this.limit) throw new Error('limit')
    const st = this.status(b)
    if (st) return st > 0
    if (passes >= 2) return false
    if (depth == 0) return mode == 1
    const key = h * 8 + (c == this.atk ? 4 : 0) + passes * 2
    const pr = this.proof.get(key)
    if (pr != null) return pr
    const tk = key * 2 + mode
    const e = this.tt.get(tk)
    if (e) {
      if (mode == 0 && e.res && e.depth <= depth) return true
      if (mode == 0 && !e.res && e.depth >= depth) return false
      if (mode == 1 && !e.res && e.depth <= depth) return false
      if (mode == 1 && e.res && e.depth >= depth) return true
    }
    const isAtk = c == this.atk
    let res = !isAtk
    const mv = this.order(b, c, this.moves(b, c))
    for (const q of mv) {
      const r = this.apply(b, q, c)
      if (!r) continue
      this.path.add(r.h)
      const v = this.search(r.nb, r.h, 3 - c, depth - 1, 0, mode)
      this.path.delete(r.h)
      if (v == isAtk) {
        res = isAtk
        break
      }
    }
    if (res != isAtk) {
      const v = this.search(b, h, 3 - c, depth - 1, passes + 1, mode)
      if (v == isAtk) res = isAtk
    }
    this.tt.set(tk, {res, depth})
    if (mode == 0 && res) this.proof.set(key, true)
    if (mode == 1 && !res) this.proof.set(key, false)
    return res
  }
  // сначала ходы по дыханиям цели
  order(b, c, mv) {
    const W = this.W
    const sc = q => {
      let s = 0
      for (const d of [1, -1, W, -W]) {
        if (b[q + d] == this.def) s += 2
        if (b[q + d] == EMPTY) s += 1
      }
      return -s
    }
    return mv.map(q => [sc(q), q]).sort((a, b) => a[0] - b[0]).map(x => x[1])
  }
  // итог позиции при ходе c: {atk: кто выиграл, depth: длина доказательства}
  solve(b, c, passes = 0, maxDepth = 40) {
    const h = hashOf(b, this.n)
    for (let d = 1; d <= maxDepth; d++) {
      if (this.search(b, h, c, d, passes, 0)) return {atk: true, depth: d}
      if (!this.search(b, h, c, d, passes, 1)) return {atk: false, depth: d}
    }
    return null
  }
  // разбор каждого хода стороны c: [{q, win, depth}], q = -1 пас
  analyse(b, c, all = false, passes = 0) {
    const out = []
    const cand = all ? this.region.filter(q => b[q] == EMPTY) : this.moves(b, c)
    for (const q of [...cand, PASS]) {
      let r
      if (q == PASS) r = this.solve(b, 3 - c, passes + 1)
      else {
        const a = this.apply(b, q, c)
        if (!a) continue
        this.path.add(a.h)
        r = this.solve(a.nb, 3 - c)
        this.path.delete(a.h)
      }
      if (!r) continue
      out.push({q, win: r.atk == (c == this.atk), depth: r.depth})
    }
    return out
  }
}

// ответ соперника в задаче: проигрывающий тянет дольше, выигрывающий бьёт короче
function bestReply(ld, b, c) {
  const res = ld.analyse(b, c, true)
  const win = res.filter(r => r.win)
  if (win.length) {
    win.sort((x, y) => x.depth - y.depth || (x.q == PASS) - (y.q == PASS))
    return {q: win[0].q, win: true}
  }
  res.sort((x, y) => y.depth - x.depth || (x.q == PASS) - (y.q == PASS))
  return {q: res.length ? res[0].q : PASS, win: false}
}

// задача из файла в позицию для решателя
function loadProblem(pr) {
  const n = pr.n || 19
  const b = newBoard(n)
  for (const s of pr.b) b[fromSgf(n, s)] = BLACK
  for (const s of pr.w) b[fromSgf(n, s)] = WHITE
  const atk = pr.g == 'live' || pr.g == 'save' ? WHITE : BLACK
  return {n, b, goal: pr.g == 'live' ? 'live' : pr.g == 'kill' ? 'kill' : pr.g, atk, target: pr.t.map(s => fromSgf(n, s)), region: pr.r.map(s => fromSgf(n, s))}
}

if (typeof module != 'undefined') module.exports = {LD, bestReply, loadProblem}
