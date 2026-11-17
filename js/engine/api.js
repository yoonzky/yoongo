/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
// команды движка: одни и те же в воркере и в окне
'use strict'

// партия из записи: фора, первый ход, ходы
function replay(g) {
  const setup = handicapPoints(g.n, g.hcap || 0).map(p => [p, BLACK])
  const go = new Go(g.n, setup, g.hcap >= 2 ? WHITE : BLACK)
  for (const m of g.moves) if (go.play(m) == null) go.play(PASS)
  return go
}

// задача после ходов: доска, путь позиций для суперко
function problemState(pr, moves) {
  const p = loadProblem(pr)
  const ld = new LD(p, {limit: 4e6})
  let b = p.b, c = BLACK
  for (const m of moves) {
    if (m != PASS) {
      const a = ld.apply(b, m, c)
      if (!a) return null
      ld.path.add(a.h)
      b = a.nb
    }
    c = 3 - c
  }
  return {ld, b, c, userAtk: p.atk == BLACK}
}

function engineCall(cmd, a) {
  if (cmd == 'bot') {
    const go = replay(a)
    const t = think({go, komi: a.komi, capN: a.goal == 'cap' ? a.capN : 0, level: a.level})
    const own = Array.from(t.own)
    let move = t.move, resign = false
    if (go.moves.length > 1 && shouldPass(go, t.own, a.komi, a.goal == 'cap' ? a.capN : 0)) move = PASS
    if (a.level >= 2 && t.wr < .03 && go.moves.length > go.n * go.n / 2) resign = true
    return {move, resign, wr: t.wr, playouts: t.playouts}
  }
  if (cmd == 'own') {
    const go = replay(a)
    const own = ownership(go, a.po || 500)
    const dead = deadStones(go, own)
    return {own: Array.from(own), dead: [...dead]}
  }
  // ход в задаче: верно ли, ответ соперника, решена ли
  if (cmd == 'pmove') {
    const pr = PROBLEMS.find(p => p.id == a.id)
    const st = problemState(pr, a.moves)
    if (!st) return {error: 'illegal'}
    const {ld, b, userAtk} = st
    const userWins = s => (s > 0) == userAtk
    const s0 = ld.status(b)
    if (s0) return {ok: userWins(s0), solved: userWins(s0), reply: null}
    const r = ld.solve(b, WHITE)
    if (!r) return {ok: false, reply: PASS}
    const ok = r.atk == userAtk
    const rep = bestReply(ld, b, WHITE)
    let b2 = b
    if (rep.q != PASS) {
      const ap = ld.apply(b, rep.q, WHITE)
      b2 = ap.nb
      ld.path.add(ap.h)
    }
    let solved = false
    if (ok) {
      const s1 = ld.status(b2)
      if (s1 && userWins(s1)) solved = true
      else {
        // итог держится, даже если соперник сходит ещё раз
        const r2 = ld.solve(b2, WHITE, rep.q == PASS ? 1 : 0)
        solved = !!r2 && r2.atk == userAtk
      }
    }
    return {ok, reply: rep.q, solved}
  }
  // подсказка: верный ход чёрных в текущей позиции
  if (cmd == 'phint') {
    const pr = PROBLEMS.find(p => p.id == a.id)
    if (!a.moves.length) return {q: fromSgf(19, pr.s)}
    const st = problemState(pr, a.moves)
    if (!st) return {q: null}
    const good = st.ld.analyse(st.b, BLACK, true).filter(r => r.win && r.q != PASS).sort((x, y) => x.depth - y.depth)
    return {q: good.length ? good[0].q : null}
  }
  return {error: 'unknown ' + cmd}
}

if (typeof module != 'undefined') module.exports = {replay, engineCall, problemState}
