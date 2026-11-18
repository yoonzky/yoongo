/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
// разбор сыгранной партии: ходы вперёд и назад, запись, SGF
'use strict'

let R = null

// итог одной строкой: "Победа, Б+6,5", "Чёрные, сдача"
function resultText(g) {
  const o = g.over
  const head = g.opp == 'bot' ? (o.winner == g.human ? t('youWon') : t('youLost')) : o.winner == BLACK ? t('blackWon') : t('whiteWon')
  const tail = o.reason == 'score' ? (o.winner == BLACK ? t('blackShort') : t('whiteShort')) + '+' + fmtNum(o.margin) : t('by_' + o.reason)
  return head + ', ' + tail
}

function doneList() {
  const list = SES.done || []
  if (!list.length) return `<p class="empty">${t('doneEmpty')}</p>`
  return list.map(g => `<a class="cont" href="#r/${g.id}"><span class="mini" style="width:64px">${miniBoard(g)}</span><span class="info"><b>${gameTitle(g)}, ${t('size', g.n)}</b><small>${resultText(g)}</small><small>${dayStr(g.end || g.upd)}</small></span>${CH}</a>`).join('')
}

function dayStr(ms) {
  return new Date(ms).toLocaleDateString(LANG == 'ru' ? 'ru-RU' : 'en-GB', {day: 'numeric', month: 'long'})
}

function openReview(id) {
  const rec = (SES.done || []).find(g => g.id == id)
  if (!rec) {
    location.hash = '#stats'
    return
  }
  R = {rec, k: rec.moves.length}
  const main = `<div class="goban" id="bv"></div>`
  const insp = `<div class="ih"><h2>${gameTitle(rec)}<small>${gameSub(rec)}, ${dayStr(rec.end || rec.upd)}</small></h2><button type="button" class="ibtn" id="rMore" aria-label="${t('more')}">${ic('more')}</button></div>
    <div class="rres"><span class="r-head">${resultText(rec)}</span></div>
    <div class="rnav"><input type="range" id="rSl" min="0" max="${rec.moves.length}" value="${R.k}" aria-label="${t('moveSlider')}"><span class="sm num" id="rK"></span></div>
    <div class="tools"><button type="button" class="tool" id="rFirst">${ic('first')}${t('rFirst')}</button><button type="button" class="tool" id="rPrev">${ic('back')}${t('lBack')}</button><button type="button" class="tool" id="rNext">${ic('fwd')}${t('lNext')}</button><button type="button" class="tool" id="rLast">${ic('last')}${t('rLast')}</button></div>
    <div class="icap reccap">${t('record')}</div><div class="recwrap" id="rRec"></div>`
  boardPage({sel: 4, back: '#stats', backT: t('stats'), title: gameTitle(rec) + ', ' + t('size', rec.n), main, insp, more: true, cls: 'review'})
  R.view = new BoardView($('#bv'), {n: rec.n, b: newBoard(rec.n), labels: !isCol(), canPlay: () => false, onTap: () => {}})
  $('#rFirst').onclick = () => reviewAt(0)
  $('#rPrev').onclick = () => reviewAt(R.k - 1)
  $('#rNext').onclick = () => reviewAt(R.k + 1)
  $('#rLast').onclick = () => reviewAt(rec.moves.length)
  $('#rSl').oninput = e => reviewAt(+e.target.value)
  $('#rRec').onclick = e => {
    const c = e.target.closest('[data-k]')
    if (c) reviewAt(+c.dataset.k)
  }
  $$('#rMore, #navMore').forEach(b => b.addEventListener('click', () => menuAt(b, [
    {t: t('copySgf'), icon: 'copy', fn: () => copySGF(rec)},
    {t: t('delDone'), icon: 'trash', cls: 'danger', fn: () => {
      SES.done = SES.done.filter(g => g.id != rec.id)
      writeSes()
      location.hash = '#stats'
    }},
  ])))
  renderReviewRec()
  reviewAt(R.k)
}

function renderReviewRec() {
  const {rec} = R
  const go = replay({...rec, moves: []})
  const off = rec.hcap >= 2 ? 1 : 0
  const rows = []
  rec.moves.forEach((m, i) => {
    const pos = i + off
    rows[pos >> 1] = rows[pos >> 1] || ['', '']
    rows[pos >> 1][pos & 1] = `<button type="button" data-k="${i + 1}">${m == PASS ? t('passShort') : go.label(m)}</button>`
  })
  $('#rRec').innerHTML = `<div class="rec">${rows.map((r, i) => `<span class="n">${i + 1}</span><span>${r[0]}</span><span>${r[1]}</span>`).join('')}</div>`
}

function reviewAt(k) {
  const {rec} = R
  k = Math.max(0, Math.min(rec.moves.length, k))
  R.k = k
  const go = replay({...rec, moves: rec.moves.slice(0, k)})
  const end = k == rec.moves.length && rec.over.reason == 'score'
  const terr = end ? areaScore(go.b, rec.n, new Set(rec.dead || [])).own : null
  R.view.set({b: go.b, last: go.last, terr, dead: end && rec.dead ? new Set(rec.dead) : null})
  $('#rSl').value = k
  $('#rK').textContent = k ? t('moveOf', k, rec.moves.length) : t('rStart')
  $('#rFirst').disabled = $('#rPrev').disabled = k == 0
  $('#rNext').disabled = $('#rLast').disabled = k == rec.moves.length
  $$('#rRec [data-k]').forEach(b => b.classList.toggle('on', +b.dataset.k == k))
  const on = $('#rRec .on')
  if (on) on.scrollIntoView({block: 'nearest'})
}
