/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
// задача: ход, ответ соперника, верно или нет, подсказка, автопереход
'use strict'

let P = null
let autoTimer = null

// сборники: название, год, источник
const COLLECTIONS = [
  {src: 'x', key: 'colX', year: 1349},
  {src: 'g', key: 'colG', year: 1660},
]

function goalText(g) {
  return t('goal_' + g)
}

function findProblem(id) {
  if (/^\d+$/.test(String(id))) return PROBLEMS.find(p => p.id == id)
  return CLASSICS.find(p => p.id == id)
}
const isClassic = pr => !!pr.src
// список, внутри которого идут номер, прогресс и следующая задача
const listOf = pr => (isClassic(pr) ? CLASSICS.filter(p => p.src == pr.src) : PROBLEMS.filter(p => p.l == pr.l))

function problemBoard(pr) {
  if (isClassic(pr)) {
    const b = newBoard(19)
    for (const s of pr.b) b[fromSgf(19, s)] = BLACK
    for (const s of pr.w) b[fromSgf(19, s)] = WHITE
    return {n: 19, b, crop: pr.c, marks: null}
  }
  const p = loadProblem(pr)
  return {n: 19, b: p.b, crop: pr.c, marks: pr.g == 'capture' || pr.g == 'save' ? new Set(p.target) : null}
}

// дерево решения из строки: ход двумя буквами, ветки в скобках
function parseTree(s) {
  let i = 0
  function seq() {
    const root = {kids: []}
    let cur = root
    while (i < s.length) {
      if (s[i] == '(') {
        while (s[i] == '(') {
          i++
          const sub = seq()
          cur.kids.push(...sub.kids)
          i++
        }
        break
      }
      if (s[i] == ')') break
      const nd = {q: fromSgf(19, s.slice(i, i + 2)), kids: []}
      i += 2
      cur.kids.push(nd)
      cur = nd
    }
    return root
  }
  return seq()
}

function problemTitle(pr) {
  if (isClassic(pr)) return t('colShort_' + pr.src) + ', ' + pr.k
  return t('problemN', pr.id)
}

function openProblem(id) {
  clearTimeout(autoTimer)
  const pr = findProblem(id)
  if (!pr) {
    location.hash = '#tasks'
    return
  }
  const base = problemBoard(pr)
  P = {pr, moves: [], b: base.b.slice(), path: new Set([hashOf(base.b, 19)]), state: 'move', failed: false, hinted: false, busy: false, hint: null, last: null, logged: false, base}
  if (isClassic(pr)) P.node = parseTree(pr.m)
  SES.seen[pr.id] = 1
  SES.lastPz = pr.id
  saveSoon()
  const list = listOf(pr)
  const idx = list.indexOf(pr)
  const solvedIn = list.filter(p => SES.solved[p.id]).length
  const cap = isClassic(pr) ? t('colShort_' + pr.src) : t('pl' + pr.l)
  const sub = isClassic(pr) ? t('bookLine', Math.ceil(pr.len / 2)) : t('aboutKyu', PZ_KYU[pr.l])
  const main = `<div class="goban" id="bv"></div>`
  const insp = `<div><div class="tcap"><span>${cap}</span><span class="num">${t('nOf', idx + 1, list.length)}</span></div><span class="prog"><i style="width:${(solvedIn / list.length * 100).toFixed(1)}%"></i></span></div>
    <div class="task"><h3>${isClassic(pr) ? t('goal_any') : goalText(pr.g)}</h3><small>${sub}</small></div>
    <div id="pState"></div><div id="pTools"></div>
    <label class="li autonext"><span class="tx">${t('autoNext')}</span><span class="sw"><input type="checkbox" id="pAuto" ${SES.settings.autoNext ? 'checked' : ''}><i></i></span></label>`
  const back = isClassic(pr) ? '#tasks/c' + pr.src : '#tasks/' + pr.l
  boardPage({sel: 2, back, backT: t('tasks'), title: problemTitle(pr), main, insp, crop: true})
  P.view = new BoardView($('#bv'), {n: 19, b: P.b, crop: pr.c, marks: base.marks, turn: BLACK, labels: false, canPlay: p => P.state == 'move' && !P.busy && P.b[p] == EMPTY, onTap: p => problemMove(p)})
  P.view.draw()
  $('#pAuto').onchange = e => {
    SES.settings.autoNext = e.target.checked
    writeSes()
    if (e.target.checked && P.state == 'solved') scheduleNext()
    if (!e.target.checked) clearTimeout(autoTimer)
  }
  renderPState()
}

function renderPState() {
  const s = $('#pState'), tl = $('#pTools')
  if (!s) return
  const pr = P.pr
  if (P.state == 'solved') {
    const note = P.failed ? t('solvedAfter') : P.hinted ? t('solvedHint') : isClassic(pr) ? t('solvedBook') : t('solvedNote_' + pr.g)
    const auto = SES.settings.autoNext ? ` <span class="sm">${t('autoSoon')}</span>` : ''
    s.innerHTML = `<div class="tstate ok"><span><b>${t('correct')}</b> ${note}${auto}</span></div>`
    tl.innerHTML = `<div class="acts2"><button type="button" class="btn" id="pNext">${t('nextTask')}</button><button type="button" class="btn plain" id="pAgain">${t('again2')}</button></div>`
  } else if (P.state == 'wrong') {
    s.innerHTML = `<div class="tstate bad"><span><b>${t('wrong')}</b> ${isClassic(pr) ? t('wrongBook') : t('wrongNote')}</span></div>`
    tl.innerHTML = `<div class="tools"><button type="button" class="tool" id="pHint">${ic('bulb')}${t('hint')}</button><button type="button" class="tool on" id="pAgain">${ic('redo')}${t('retry')}</button><button type="button" class="tool" id="pNext">${ic('next')}${t('nextShort')}</button></div>`
  } else {
    s.innerHTML = `<div class="tstate">${st(BLACK)}<span>${P.busy ? t('thinkingOpp') : P.moves.length ? t('goodContinue') : t('yourMove')}</span></div>`
    tl.innerHTML = `<div class="tools"><button type="button" class="tool" id="pHint" ${P.busy ? 'disabled' : ''}>${ic('bulb')}${t('hint')}</button><button type="button" class="tool" id="pAgain" ${P.moves.length ? '' : 'disabled'}>${ic('redo')}${t('retry')}</button><button type="button" class="tool" id="pNext">${ic('next')}${t('nextShort')}</button></div>`
  }
  const h = $('#pHint'), a = $('#pAgain'), n = $('#pNext')
  if (h) h.onclick = problemHint
  if (a) a.onclick = () => openProblem(P.pr.id)
  if (n) n.onclick = () => (location.hash = '#p/' + nextProblem(P.pr).id)
}

function nextProblem(pr) {
  const list = listOf(pr)
  const i = list.indexOf(pr)
  for (let k = 1; k <= list.length; k++) {
    const q = list[(i + k) % list.length]
    if (!SES.solved[q.id]) return q
  }
  if (!isClassic(pr)) {
    const up = PROBLEMS.find(p => p.l > pr.l && !SES.solved[p.id])
    if (up) return up
  }
  return list[(i + 1) % list.length]
}

function scheduleNext() {
  clearTimeout(autoTimer)
  const pr = P.pr
  autoTimer = setTimeout(() => {
    if (P && P.pr == pr && P.state == 'solved' && SES.settings.autoNext) location.hash = '#p/' + nextProblem(pr).id
  }, 1400)
}

function pPlay(p, c) {
  if (p == PASS) return true
  const nb = P.b.slice()
  const cap = place(nb, 21, p, c)
  if (cap == null) return false
  const h = hashOf(nb, 19)
  if (P.path.has(h)) return false
  P.path.add(h)
  P.b = nb
  return true
}

function markSolved() {
  const pr = P.pr
  P.state = 'solved'
  SES.solved[pr.id] = 1
  writeSes()
  logProblem(!P.failed && !P.hinted)
  const list = listOf(pr)
  const bar = $('.insp .prog i')
  if (bar) bar.style.width = (list.filter(p => SES.solved[p.id]).length / list.length * 100).toFixed(1) + '%'
  if (SES.settings.autoNext) scheduleNext()
}

async function problemMove(p) {
  if (P.state != 'move' || P.busy) return
  if (!pPlay(p, BLACK)) {
    toast(t('illegal'))
    return
  }
  P.moves.push(p)
  P.last = p
  P.hint = null
  clack()
  if (isClassic(P.pr)) return classicMove(p)
  P.busy = true
  P.view.set({b: P.b, last: p, hint: null, pop: p})
  renderPState()
  const pr = P.pr
  const r = await engine('pmove', {id: pr.id, moves: P.moves})
  await new Promise(res => setTimeout(res, 260))
  if (!P || P.pr != pr) return
  P.busy = false
  if (!r || r.error) {
    toast(t('botError'))
    renderPState()
    return
  }
  if (r.reply != null) {
    pPlay(r.reply, WHITE)
    P.moves.push(r.reply)
    if (r.reply != PASS) {
      P.last = r.reply
      clack()
    } else toast(t('oppPassed'))
  }
  if (!r.ok) {
    P.state = 'wrong'
    logProblem(false)
  } else if (r.solved) markSolved()
  P.view.set({b: P.b, last: P.last, pop: r.reply != PASS ? r.reply : null})
  renderPState()
  renderSidebarCount()
}

// задача из книги: ход сверяется с деревом решения, соперник отвечает главной веткой
async function classicMove(p) {
  const pr = P.pr
  const nd = P.node.kids.find(k => k.q == p)
  P.view.set({b: P.b, last: p, hint: null, pop: p})
  if (!nd) {
    P.state = 'wrong'
    logProblem(false)
    renderPState()
    return
  }
  P.node = nd
  if (!nd.kids.length) {
    markSolved()
    renderPState()
    renderSidebarCount()
    return
  }
  P.busy = true
  renderPState()
  await new Promise(res => setTimeout(res, 380))
  if (!P || P.pr != pr) return
  P.busy = false
  const rep = nd.kids[0]
  pPlay(rep.q, WHITE)
  P.moves.push(rep.q)
  P.last = rep.q
  P.node = rep
  clack()
  if (!rep.kids.length) markSolved()
  P.view.set({b: P.b, last: rep.q, pop: rep.q})
  renderPState()
  renderSidebarCount()
}

// первая попытка идёт в журнал один раз
function logProblem(ok) {
  if (!ok) P.failed = true
  if (P.logged || (SES.loggedPz && SES.loggedPz[P.pr.id])) return
  P.logged = true
  SES.loggedPz = SES.loggedPz || {}
  SES.loggedPz[P.pr.id] = 1
  LOG.push({t: 'p', id: P.pr.id, l: isClassic(P.pr) ? 'c' : P.pr.l, g: P.pr.g || 'book', ok, date: Date.now()})
  saveLog()
  writeSes()
}

async function problemHint() {
  if (P.busy) return
  if (P.state == 'wrong') openProblem(P.pr.id)
  P.hinted = true
  const pr = P.pr
  if (isClassic(pr)) {
    P.hint = P.node.kids.length ? P.node.kids[0].q : null
    P.view.set({hint: P.hint})
    return
  }
  const r = await engine('phint', {id: pr.id, moves: P.moves})
  if (!P || P.pr != pr || !r) return
  P.hint = r.q
  P.view.set({hint: r.q})
}
