/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
// урок правил: ход, дыхания, группа, спасение, ко, два глаза, счёт
'use strict'

let L = null

// доска 7 на 7, камни в sgf; need: any, capture, save, point, info
const LESSON = [
  {key: 'l1', need: 'any', b: [], w: []},
  {key: 'l2', need: 'capture', b: ['cd', 'ed', 'dc'], w: ['dd'], t: ['dd']},
  {key: 'l3', need: 'capture', b: ['cd', 'dc', 'ec', 'fd', 'ee'], w: ['dd', 'ed'], t: ['dd', 'ed']},
  {key: 'l4', need: 'save', b: ['dd'], w: ['cd', 'dc', 'ed'], t: ['dd']},
  {key: 'l5', need: 'capture', b: ['cd', 'dc', 'de'], w: ['dd', 'ec', 'ee', 'fd'], t: ['dd']},
  {key: 'l6', need: 'point', b: ['af', 'bf', 'cf', 'df', 'dg'], w: ['ae', 'be', 'ce', 'de', 'ee', 'ef', 'eg'], pts: ['bg']},
  {key: 'l7', need: 'info', b: ['da', 'db', 'dc', 'dd', 'de', 'df', 'dg'], w: ['ea', 'eb', 'ec', 'ed', 'ee', 'ef', 'eg']},
  {key: 'l8', need: 'end', b: [], w: []},
]
const LN = 7

function lessonBoard(s) {
  const b = newBoard(LN)
  for (const v of s.b) b[fromSgf(LN, v)] = BLACK
  for (const v of s.w) b[fromSgf(LN, v)] = WHITE
  return b
}

function openLesson(i) {
  i = Math.max(0, Math.min(LESSON.length - 1, +i || 0))
  const s = LESSON[i]
  L = {i, s, b: lessonBoard(s), state: s.need == 'info' || s.need == 'end' ? 'ok' : 'move', last: null}
  const main = `<div class="goban" id="bv"></div>`
  const insp = `<div><div class="tcap"><span>${t('learn')}</span><span class="num">${t('nOf', i + 1, LESSON.length)}</span></div><span class="prog"><i style="width:${((i + 1) / LESSON.length * 100).toFixed(1)}%"></i></span></div>
    <div class="task"><h3>${t(s.key)}</h3></div><p class="ltext">${t(s.key + 't')}</p>
    <div id="lState"></div><div id="lTools"></div>`
  boardPage({sel: 3, back: '#path', backT: t('path'), title: t('learn'), main, insp, cls: 'lesson'})
  const terr = s.need == 'info' ? areaScore(L.b, LN).own : null
  const marks = s.t ? new Set(s.t.map(v => fromSgf(LN, v))) : null
  L.view = new BoardView($('#bv'), {n: LN, b: L.b, terr, marks, turn: BLACK, labels: false, canPlay: p => L.state == 'move' && L.b[p] == EMPTY, onTap: p => lessonMove(p)})
  L.view.draw()
  renderLesson()
}

function lessonMove(p) {
  const s = L.s
  const nb = L.b.slice()
  const cap = place(nb, LN + 2, p, BLACK)
  if (cap == null) {
    toast(t('suicide'))
    return
  }
  L.b = nb
  L.last = p
  clack()
  let ok = false
  const tg = (s.t || []).map(v => fromSgf(LN, v))
  if (s.need == 'any') ok = true
  else if (s.need == 'capture') ok = tg.every(q => nb[q] == EMPTY)
  else if (s.need == 'save') ok = groupOf(nb, LN + 2, tg[0]).libs.size >= 2
  else if (s.need == 'point') ok = s.pts.some(v => fromSgf(LN, v) == p)
  L.state = ok ? 'ok' : 'bad'
  L.view.set({b: nb, last: p, pop: p, hideMarks: ok})
  renderLesson()
}

function renderLesson() {
  const s = L.s, el = $('#lState'), tl = $('#lTools')
  if (!el) return
  const last = L.i == LESSON.length - 1
  if (s.need == 'end') {
    el.innerHTML = ''
    tl.innerHTML = `<div class="acts2"><button type="button" class="btn" id="lCap">${t('lCap1')}</button><button type="button" class="btn soft" id="l9">${t('l9')}</button><a class="btn plain a-btn" href="#tasks/0">${t('lPz')}</a></div>`
    $('#lCap').onclick = () => {
      const r = newGame({...SES.settings.ng, opp: 'bot', n: 9, goal: 'cap', capN: 1, level: 0, color: 'b', hcap: 0, komi: null, clock: 0})
      location.hash = '#g/' + r.id
    }
    $('#l9').onclick = () => {
      const r = newGame({...SES.settings.ng, opp: 'bot', n: 9, goal: 'area', level: 0, color: 'b', hcap: 0, komi: null, clock: 0})
      location.hash = '#g/' + r.id
    }
    SES.learned = 1
    saveSoon()
    return
  }
  if (L.state == 'ok' && s.need != 'info') el.innerHTML = `<div class="tstate ok"><span><b>${t('correct')}</b> ${t(s.key + 'ok')}</span></div>`
  else if (L.state == 'bad') el.innerHTML = `<div class="tstate bad"><span><b>${t('wrong')}</b> ${t(s.key + 'no')}</span></div>`
  else if (L.state == 'move') el.innerHTML = `<div class="tstate">${st(BLACK)}<span>${t('yourMove')}</span></div>`
  else el.innerHTML = ''
  tl.innerHTML = `<div class="tools"><button type="button" class="tool" id="lPrev" ${L.i ? '' : 'disabled'}>${ic('back')}${t('lBack')}</button><button type="button" class="tool ${L.state == 'bad' ? 'on' : ''}" id="lAgain" ${L.last == null ? 'disabled' : ''}>${ic('redo')}${t('retry')}</button><button type="button" class="tool ${L.state == 'ok' ? 'on' : ''}" id="lNext" ${L.state == 'ok' && !last ? '' : 'disabled'}>${ic('fwd')}${t('lNext')}</button></div>`
  $('#lPrev').onclick = () => (location.hash = '#learn/' + (L.i - 1))
  $('#lAgain').onclick = () => openLesson(L.i)
  $('#lNext').onclick = () => (location.hash = '#learn/' + (L.i + 1))
}
