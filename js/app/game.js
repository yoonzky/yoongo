/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
// партия: ходы, бот, часы, отмена, пас, подсчёт, итог
'use strict'

let G = null
let clockTimer = null

const CLOCKS = [null, {main: 300, byo: 30, per: 3}, {main: 600, byo: 30, per: 3}, {main: 1200, byo: 30, per: 5}, {main: 0, byo: 15, per: 1}]
const HCAPS = [0, 2, 3, 4, 5, 6, 7, 8, 9]
const KOMIS = [0.5, 5.5, 6.5, 7.5]

function newGame(o) {
  const human = o.color == 'r' ? (Math.random() < .5 ? BLACK : WHITE) : o.color == 'w' ? WHITE : BLACK
  const hcap = o.n == 7 ? Math.min(o.hcap, 4) : o.hcap
  const komi = o.goal == 'cap' ? 0 : hcap >= 2 ? 0.5 : o.komi != null ? o.komi : SES.settings.komi
  const ck = CLOCKS[o.clock || 0]
  const rec = {id: uid(), opp: o.opp, n: o.n, goal: o.goal, capN: o.capN, level: o.level, human: o.opp == 'bot' ? human : 0, hcap, komi, clock: ck, moves: [], phase: 'play', t0: Date.now(), upd: Date.now(), undos: 0}
  if (ck) rec.tm = {1: {m: ck.main, p: ck.per, l: ck.byo}, 2: {m: ck.main, p: ck.per, l: ck.byo}}
  SES.games.unshift(rec)
  while (SES.games.filter(g => !g.over).length > MAX_GAMES) {
    const old = SES.games.filter(g => !g.over).pop()
    SES.games.splice(SES.games.indexOf(old), 1)
  }
  writeSes()
  return rec
}

// по китайским правилам белым за каждый камень форы ещё очко
const hcapBonus = g => (g.hcap >= 2 && g.goal != 'cap' ? g.hcap : 0)
const gameKomi = g => g.komi + hcapBonus(g)

function gameTitle(g) {
  if (g.goal == 'cap') return t('capTitle', g.capN)
  return g.opp == 'bot' ? t('withBot') : t('twoPlayers')
}
function gameSub(g, noSize) {
  const parts = noSize ? [] : [t('size', g.n)]
  if (g.opp == 'bot') parts.push(t('lv' + g.level).toLowerCase())
  if (g.hcap >= 2) parts.push(t('hcapN', g.hcap))
  if (g.goal != 'cap') parts.push(t('komiN', fmtNum(g.komi)))
  return parts.join(', ')
}
function gameState(g, go) {
  if (g.over) return t('finished')
  if (g.phase == 'score') return t('scoringState')
  if (g.opp == 'bot') return go.turn == g.human ? t('yourMoveL') : t('botMove')
  return t('moveN', go.moves.length + 1)
}

function openGame(id) {
  const rec = SES.games.find(g => g.id == id) || (G && G.rec.id == id ? G.rec : null)
  if (!rec) {
    location.hash = '#new'
    return
  }
  const go = replay(rec)
  // после "Играть дальше" два паса в записи не считаются, остаются только новые
  if (rec.phase == 'play') go.passes %= 2
  G = {rec, go, think: false, token: 0, own: null, dead: null, score: null, lowWr: 0}
  renderGame()
  if (rec.phase == 'score' && !rec.over) startScoring()
  else maybeBot()
  startClock()
}

function humanTurn() {
  const {rec, go} = G
  if (rec.over || rec.phase != 'play' || G.think || G.paused) return false
  return rec.opp != 'bot' || go.turn == rec.human
}

function renderGame() {
  const {rec, go} = G
  const zoomable = isCol() && rec.n >= 13
  const main = `<div class="zwrap" id="zw"><div class="goban" id="bv"></div></div>${zoomable ? `<div class="minimap hidden" id="mini" aria-hidden="true"></div><button type="button" class="ibtn zoomfab" id="zoomBtn" aria-label="${t('zoom')}">${ic('zoom')}</button>` : ''}`
  const insp = `<div class="ih"><h2>${gameTitle(rec)}<small>${gameSub(rec)}</small></h2><button type="button" class="ibtn" id="gMore" aria-label="${t('more')}">${ic('more')}</button></div>
    <div class="players" id="gPl"></div>
    <div id="gPanel"></div>
    <div class="icap reccap">${t('record')}</div><div class="recwrap" id="gRec"></div>`
  boardPage({sel: 'g' + rec.id, back: '#play', backT: t('games'), title: gameTitle(rec) + ', ' + t('size', rec.n), main, insp, more: true, cls: 'game'})
  G.view = new BoardView($('#bv'), {n: rec.n, b: go.b, last: go.last, turn: go.turn, labels: !isCol(), canPlay: p => humanTurn() && G.go.b[p] == EMPTY, onTap: p => humanPlay(p), onPick: p => scorePick(p)})
  G.view.draw()
  if (zoomable) setupZoom()
  $$('#gMore, #navMore').forEach(b => b.addEventListener('click', () => gameMenu(b)))
  renderSide()
}

// игроки, панель и запись без перерисовки доски
function renderSide() {
  const {rec, go} = G
  const pl = c => {
    const me = rec.opp == 'bot' ? (c == rec.human ? t('you') : t('bot')) : c == BLACK ? t('black') : t('white')
    const capd = go.cap[c]
    const sub = rec.goal == 'cap' ? t('takenOf', capd, rec.capN) : t('taken', capd)
    const on = !rec.over && rec.phase == 'play' && go.turn == c
    const dots = on && G.think && rec.opp == 'bot' && c != rec.human ? '<span class="think"><i></i><i></i><i></i></span>' : ''
    const low = rec.clock && rec.tm[c].m <= 0 && rec.tm[c].l <= 10
    return `<div class="pl ${on ? 'on' : ''}">${st(c)}<span class="tx"><b>${me}${dots}</b><small>${sub}</small></span><span class="clk num ${low ? 'low' : ''}" data-c="${c}">${clockText(c)}</span></div>`
  }
  $('#gPl').innerHTML = pl(BLACK) + pl(WHITE)
  renderPanel()
  renderRecord()
  renderSidebarGames()
}

function clockText(c) {
  const {rec} = G
  if (!rec.clock) return ''
  const s = rec.tm[c]
  const f = x => {
    x = Math.max(0, Math.ceil(x))
    return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0')
  }
  if (s.m > 0) return f(s.m)
  return `${f(s.l)}<small>${s.p}</small>`
}

function renderPanel() {
  const {rec, go} = G
  const el = $('#gPanel')
  // при подсчёте в инспекторе только счёт, как в макете
  const scoring = rec.phase == 'score' && !rec.over
  // на паузе доска закрыта, пока часы снова не пойдут
  const bm = $('.bmain')
  if (bm) bm.classList.toggle('paused', !!G.paused && !rec.over && rec.phase == 'play')
  const insp = $('.insp')
  if (insp) insp.classList.toggle('scoring', scoring)
  const h2 = $('.insp .ih h2')
  if (h2) h2.innerHTML = scoring ? `${t('scoringTitle')}<small>${t('bothPassed', rec.moves.length)}</small>` : `${gameTitle(rec)}<small>${gameSub(rec)}</small>`
  if (rec.over) {
    const o = rec.over
    let head, big, rows = ''
    if (!o.winner) head = t('draw')
    else if (rec.opp == 'bot') head = o.winner == rec.human ? t('youWon') : t('youLost')
    else head = o.winner == BLACK ? t('blackWon') : t('whiteWon')
    if (o.reason == 'score') {
      big = `<span class="r-time num">${!o.winner ? t('even') : (o.winner == BLACK ? t('blackShort') : t('whiteShort')) + '+' + fmtNum(o.margin)}</span>`
      rows = scoreRows(rec, o)
    } else {
      let why = t('end_' + o.reason, rec.capN)
      if (o.reason == 'resign' && rec.opp == 'bot') why = o.winner == rec.human ? t('end_botResigned') : t('end_youResigned')
      big = `<span class="big2">${why}</span>`
    }
    el.innerHTML = `<div class="result"><span class="r-head">${head}</span>${big}${rows}</div><div class="acts2"><button type="button" class="btn" id="gAgain">${t('again')}</button><a class="btn plain a-btn" href="#r/${rec.id}">${t('review')}</a></div>`
    $('#gAgain').onclick = () => {
      const r = newGame({...SES.settings.ng, opp: rec.opp, n: rec.n, goal: rec.goal, capN: rec.capN, level: rec.level, color: rec.human == WHITE ? 'w' : 'b', hcap: rec.hcap, komi: rec.komi, clock: CLOCKS.findIndex(c => JSON.stringify(c) == JSON.stringify(rec.clock))})
      location.hash = '#g/' + r.id
    }
    return
  }
  if (rec.phase == 'score') {
    const s = G.score
    if (!s) {
      el.innerHTML = `<p class="mark-note">${t('counting')}</p>`
      return
    }
    const lead = s.b - s.w - gameKomi(rec)
    el.innerHTML = `<div class="result keep"><span class="r-head">${lead > 0 ? t('blackAhead') : lead < 0 ? t('whiteAhead') : t('even')}</span><span class="r-time num">${lead ? '+' + fmtNum(Math.abs(lead)) : '0'}</span>
      ${scoreRows(rec, s)}</div>
      <p class="mark-note">${t('deadNote')}</p>
      <div class="acts2"><button type="button" class="btn" id="gAccept">${t('accept')}</button><button type="button" class="btn plain" id="gResume">${t('resume')}</button></div>`
    $('#gAccept').onclick = acceptScore
    $('#gResume').onclick = resumePlay
    return
  }
  const canUndo = rec.moves.length > 0 && !G.think && !G.paused && (rec.opp != 'bot' || (SES.settings.undo && rec.moves.some((m, i) => colorAt(i) == rec.human)))
  const pause = G.paused ? `<div class="tstate paused"><span>${t('clockPaused')}</span><button type="button" class="link" id="tRun">${t('resumeClock')}</button></div>` : ''
  el.innerHTML = `${pause}<div class="tools"><button type="button" class="tool" id="tUndo" ${canUndo ? '' : 'disabled'}>${ic('undo')}${t('undo')}</button><button type="button" class="tool" id="tPass" ${humanTurn() ? '' : 'disabled'}>${ic('pass')}${t('pass')}</button><button type="button" class="tool ${G.own ? 'on' : ''}" id="tEst" aria-pressed="${!!G.own}" ${rec.goal == 'cap' || go.moves.length < 2 ? 'disabled' : ''}>${ic('area')}${t('estimate')}</button></div>`
  $('#tUndo').onclick = undo
  $('#tPass').onclick = () => humanPlay(PASS)
  if (G.paused) $('#tRun').onclick = togglePause
  $('#tEst').onclick = toggleEstimate
}

// строки счёта: площадь, коми и очки белым за фору
function scoreRows(rec, s) {
  const row = (k, v) => `<div class="row"><span>${k}</span><b class="num">${v}</b></div>`
  const bonus = hcapBonus(rec)
  return `<div class="rows">${row(t('blackArea'), s.b)}${row(t('whiteArea'), s.w)}${row(t('komi'), fmtNum(rec.komi))}${bonus ? row(t('hcapBonus'), bonus) : ''}</div>`
}

function colorAt(i) {
  const first = G.rec.hcap >= 2 ? WHITE : BLACK
  return i % 2 == 0 ? first : 3 - first
}

function renderRecord() {
  const {rec, go} = G
  const el = $('#gRec')
  if (!el) return
  const lab = m => (m == PASS ? t('passShort') : go.label(m))
  // при форе первым ходят белые, их ход встаёт во второй столбец
  const off = colorAt(0) == WHITE ? 1 : 0
  const rows = []
  const cell = (pos, html) => {
    const r = pos >> 1
    rows[r] = rows[r] || ['', '']
    rows[r][pos & 1] = html
  }
  rec.moves.forEach((m, i) => cell(i + off, lab(m)))
  if (!rec.over && rec.phase == 'play' && rec.opp == 'bot') cell(rec.moves.length + off, `<b class="cur">${go.turn == rec.human ? t('yourMoveRec') : t('botMoveRec')}</b>`)
  el.innerHTML = `<div class="rec">${rows.map((r, i) => `<span class="n">${i + 1}</span><span>${r[0]}</span><span>${r[1]}</span>`).join('')}</div>`
  el.scrollTop = el.scrollHeight
}

function redraw(pop) {
  const {go} = G
  G.view.set({b: go.b, last: go.last, turn: go.turn, own: G.own, dead: G.dead, terr: G.score ? G.score.own : null, pop})
  drawMini()
  renderSide()
}

// крупная доска на телефоне: прокрутка и мини-карта с рамкой видимой части
function setupZoom() {
  const zw = $('#zw'), btn = $('#zoomBtn'), mini = $('#mini')
  const apply = () => {
    $('.bmain').classList.toggle('zoom', !!G.zoom)
    mini.classList.toggle('hidden', !G.zoom)
    btn.innerHTML = ic(G.zoom ? 'unzoom' : 'zoom')
    if (G.zoom && G.go.last >= 0) {
      const [x, y] = xy(G.rec.n, G.go.last)
      const k = zw.scrollWidth / (G.rec.n + 1.3)
      zw.scrollLeft = (x + .65) * k - zw.clientWidth / 2
      zw.scrollTop = (y + .65) * k - zw.clientHeight / 2
    }
    drawMini()
  }
  btn.onclick = () => {
    G.zoom = !G.zoom
    apply()
  }
  zw.addEventListener('scroll', drawMini, {passive: true})
  mini.addEventListener('click', e => {
    const r = mini.getBoundingClientRect()
    zw.scrollLeft = (e.clientX - r.left) / r.width * zw.scrollWidth - zw.clientWidth / 2
    zw.scrollTop = (e.clientY - r.top) / r.height * zw.scrollHeight - zw.clientHeight / 2
  })
  apply()
}
function drawMini() {
  const mini = $('#mini'), zw = $('#zw')
  if (!mini || !G || !G.zoom) return
  const n = G.rec.n, b = G.go.b
  let s = `<svg viewBox="-.5 -.5 ${n} ${n}"><rect x="-.5" y="-.5" width="${n}" height="${n}" class="bg"/>`
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const c = b[pt(n, x, y)]
    if (c == BLACK || c == WHITE) s += `<circle cx="${x}" cy="${y}" r=".45" class="${c == BLACK ? 'b' : 'w'}"/>`
  }
  const fx = zw.scrollLeft / zw.scrollWidth * n - .5, fy = zw.scrollTop / zw.scrollHeight * n - .5
  const fw = zw.clientWidth / zw.scrollWidth * n, fh = zw.clientHeight / zw.scrollHeight * n
  s += `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" class="view"/></svg>`
  mini.innerHTML = s
}

function humanPlay(p) {
  if (!humanTurn()) return
  const {go} = G
  if (p != PASS) {
    if (go.b[p] != EMPTY) return
    if (!go.legal(p)) {
      const r = go.tryMove(p)
      toast(r == null && place(go.b.slice(), go.W, p, go.turn) == null ? t('suicide') : t('koBan'))
      return
    }
  }
  commit(p)
  if (G.rec.over || G.rec.phase != 'play') return
  maybeBot()
}

// ход в партию: доска, запись, часы, конец
function commit(p) {
  const {rec, go} = G
  const c = go.turn
  go.play(p)
  rec.moves.push(p)
  rec.upd = Date.now()
  if (rec.clock) {
    const s = rec.tm[c]
    if (s.m <= 0) s.l = rec.clock.byo
  }
  G.own = null
  if (p != PASS) clack()
  saveSoon()
  if (rec.goal == 'cap' && go.cap[c] >= rec.capN) {
    finish({winner: c, reason: 'cap'})
    return
  }
  if (go.passes >= 2) {
    if (rec.goal == 'cap') {
      const w = go.cap[1] == go.cap[2] ? null : go.cap[1] > go.cap[2] ? BLACK : WHITE
      if (w) finish({winner: w, reason: 'cap'})
      else startScoring()
      return
    }
    startScoring()
    return
  }
  redraw(p != PASS ? p : null)
}

async function maybeBot() {
  const {rec, go} = G
  if (rec.opp != 'bot' || rec.over || rec.phase != 'play' || go.turn == rec.human) {
    renderSide()
    return
  }
  G.think = true
  const token = ++G.token
  renderSide()
  const t0 = Date.now()
  const r = await engine('bot', {n: rec.n, hcap: rec.hcap, moves: rec.moves, komi: gameKomi(rec), goal: rec.goal, capN: rec.capN, level: rec.level})
  // минимальная пауза, чтобы ход бота не выскакивал мгновенно
  const wait = 350 - (Date.now() - t0)
  if (wait > 0) await new Promise(res => setTimeout(res, wait))
  while (G && G.paused && G.token == token) await new Promise(res => setTimeout(res, 200))
  if (!G || G.token != token || G.rec != rec || rec.over) return
  G.think = false
  if (!r || r.error) {
    toast(t('botError'))
    renderSide()
    G.botFail = (G.botFail || 0) + 1
    if (G.botFail < 2) setTimeout(() => G && G.rec == rec && maybeBot(), 1000)
    return
  }
  G.botFail = 0
  // сдаётся, если два хода подряд видит почти верный проигрыш
  if (r.resign) G.lowWr++
  else G.lowWr = 0
  if (G.lowWr >= 2) {
    finish({winner: rec.human, reason: 'resign'})
    toast(t('botResigned'))
    return
  }
  if (r.move == PASS) toast(t('botPassed'))
  if (r.move != PASS && !go.legal(r.move)) r.move = PASS
  commit(r.move)
}

function undo() {
  const {rec} = G
  if (G.think || rec.over || rec.phase != 'play' || !rec.moves.length) return
  if (rec.opp == 'bot') {
    if (!rec.moves.some((m, i) => colorAt(i) == rec.human)) return
    while (rec.moves.length && colorAt(rec.moves.length - 1) != rec.human) rec.moves.pop()
    rec.moves.pop()
  } else rec.moves.pop()
  rec.undos++
  G.go = replay(rec)
  G.own = null
  saveSoon()
  redraw()
}

async function toggleEstimate() {
  const {rec} = G
  if (G.own) {
    G.own = null
    redraw()
    return
  }
  const r = await engine('own', {n: rec.n, hcap: rec.hcap, moves: rec.moves, po: 400})
  if (!G || G.rec != rec || !r) return
  G.own = r.own
  // оценка по владению: каждая точка уходит тому, у кого её чаще забирают
  let lead = 0
  for (let p = 0; p < r.own.length; p++) if (G.go.b[p] != EDGE) lead += r.own[p] > .2 ? 1 : r.own[p] < -.2 ? -1 : 0
  lead -= gameKomi(rec)
  toast(t(lead > 0 ? 'estB' : 'estW', fmtNum(Math.round(Math.abs(lead) * 2) / 2)))
  redraw()
}

async function startScoring() {
  const {rec} = G
  rec.phase = 'score'
  G.score = null
  G.own = null
  saveSoon()
  redraw()
  const r = await engine('own', {n: rec.n, hcap: rec.hcap, moves: rec.moves, po: 900})
  if (!G || G.rec != rec || rec.phase != 'score') return
  G.dead = new Set(r ? r.dead : [])
  recount()
}

function recount() {
  const {rec, go} = G
  const s = areaScore(go.b, rec.n, G.dead)
  G.score = s
  G.view.set({dead: G.dead, terr: s.own})
  renderSide()
}

// касание группы при подсчёте меняет её между живой и мёртвой
function scorePick(p) {
  if (!G || G.rec.phase != 'score' || G.rec.over || !G.score) return false
  const {go} = G
  if (go.b[p] != BLACK && go.b[p] != WHITE) return true
  const g = groupOf(go.b, go.W, p)
  const was = G.dead.has(p)
  for (const s of g.stones) was ? G.dead.delete(s) : G.dead.add(s)
  recount()
  return true
}

function acceptScore() {
  const {rec} = G
  const s = G.score
  const lead = s.b - s.w - gameKomi(rec)
  finish({winner: lead > 0 ? BLACK : lead < 0 ? WHITE : 0, reason: 'score', margin: Math.abs(lead), b: s.b, w: s.w})
}

function resumePlay() {
  const {rec} = G
  rec.phase = 'play'
  G.score = null
  G.dead = null
  G.go.passes = 0
  saveSoon()
  G.view.set({dead: null, terr: null})
  maybeBot()
}

function finish(o) {
  const {rec} = G
  rec.over = o
  rec.phase = 'over'
  stopClock()
  SES.games = SES.games.filter(g => g.id != rec.id)
  // сыгранные партии хранятся для разбора, последние MAX_DONE
  const {tm, ...keep} = rec
  if (rec.moves.length) SES.done = [{...keep, end: Date.now(), dead: o.reason == 'score' && G.dead ? [...G.dead] : null}, ...(SES.done || []).filter(g => g.id != rec.id)].slice(0, MAX_DONE)
  writeSes()
  const win = rec.opp == 'bot' && o.winner ? o.winner == rec.human : null
  LOG.push({t: 'g', opp: rec.opp, n: rec.n, level: rec.level, goal: rec.goal, hcap: rec.hcap, human: rec.human, win, reason: o.reason, margin: o.margin || 0, moves: rec.moves.length, undos: rec.undos, date: Date.now()})
  saveLog()
  if (G.view) G.view.set({b: G.go.b, own: null})
  renderSide()
}

function togglePause() {
  G.paused = !G.paused
  toast(G.paused ? t('clockPaused') : t('clockRuns'))
  renderSide()
}

function resign() {
  const {rec} = G
  const loser = rec.opp == 'bot' ? rec.human : G.go.turn
  finish({winner: 3 - loser, reason: 'resign'})
}

function gameMenu(btn) {
  const {rec} = G
  const items = []
  if (!rec.over && rec.clock && rec.phase == 'play') items.push({t: G.paused ? t('resumeClock') : t('pauseClock'), icon: G.paused ? 'play' : 'pause', fn: togglePause})
  if (!rec.over) {
    items.push({t: rec.opp == 'bot' ? t('resign') : t('resignTurn'), icon: 'flag', fn: () => alertBox(t('resignQ'), '', [{t: t('cancel')}, {t: t('resign'), cls: 'danger', fn: resign}])})
    items.push({t: t('delGame'), icon: 'trash', cls: 'danger', fn: () => alertBox(t('delQ'), t('delText'), [{t: t('cancel')}, {t: t('delete'), cls: 'danger', fn: () => {
      SES.games = SES.games.filter(g => g.id != rec.id)
      writeSes()
      G = null
      location.hash = '#new'
    }}])})
  }
  items.push({t: t('copySgf'), icon: 'copy', fn: () => {
    copySGF(rec)
  }})
  menuAt(btn, items)
}

function copySGF(rec) {
  const ok = () => toast(t('copied'))
  const bad = () => toast(t('copyFail'))
  try {
    navigator.clipboard.writeText(toSGF(rec)).then(ok, bad)
  } catch (e) {
    bad()
  }
}

function toSGF(rec) {
  const d = new Date(rec.t0 || Date.now())
  const dt = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  let s = `(;GM[1]FF[4]CA[UTF-8]AP[Yoongo]SZ[${rec.n}]KM[${rec.komi}]RU[Chinese]DT[${dt}]`
  const o = rec.over
  if (o && !o.winner) s += 'RE[0]'
  else if (o) s += `RE[${o.winner == BLACK ? 'B' : 'W'}+${o.reason == 'score' ? o.margin : o.reason == 'resign' ? 'R' : o.reason == 'time' ? 'T' : ''}]`
  if (rec.hcap >= 2) s += `HA[${rec.hcap}]AB` + handicapPoints(rec.n, rec.hcap).map(p => `[${toSgf(rec.n, p)}]`).join('')
  if (rec.opp == 'bot') s += rec.human == BLACK ? 'PB[You]PW[Yoongo bot]' : 'PB[Yoongo bot]PW[You]'
  rec.moves.forEach((m, i) => {
    s += `;${colorAt(i) == BLACK ? 'B' : 'W'}[${m == PASS ? '' : toSgf(rec.n, m)}]`
  })
  return s + ')'
}

// часы идут только у открытой партии и видимой вкладки
function startClock() {
  stopClock()
  if (!G || !G.rec.clock || G.rec.over) return
  let last = performance.now()
  clockTimer = setInterval(() => {
    const now = performance.now()
    const dt = (now - last) / 1000
    last = now
    if (!G || !G.rec.clock || G.rec.over || G.rec.phase != 'play' || G.paused || document.hidden) return
    const c = G.go.turn
    const s = G.rec.tm[c]
    if (s.m > 0) {
      s.m -= dt
      // перерасход основного времени списывается с бёёми
      if (s.m < 0) {
        s.l += s.m
        s.m = 0
      }
    } else {
      s.l -= dt
      if (s.l <= 0) {
        s.p--
        if (s.p <= 0) {
          s.p = 0
          s.l = 0
          finish({winner: 3 - c, reason: 'time'})
          return
        }
        s.l = G.rec.clock.byo
      }
    }
    const el = $(`.clk[data-c="${c}"]`)
    if (el) {
      el.innerHTML = clockText(c)
      el.classList.toggle('low', s.m <= 0 && s.l <= 10)
    }
    saveSoon()
  }, 250)
}
function stopClock() {
  clearInterval(clockTimer)
  clockTimer = null
}
