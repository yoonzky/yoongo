/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
// разделы: каркас, сегодня, новая партия, задачи, путь, статистика, настройки
'use strict'

const NAV = [['home', 'home', '#home'], ['plus', 'newGame', '#new'], ['grid', 'tasks', '#tasks'], ['path', 'path', '#path'], ['stats', 'stats', '#stats']]
const TABS = [['home', 'home', '#home'], ['play', 'play', '#play'], ['grid', 'tasks', '#tasks'], ['path', 'path', '#path']]
const root = () => $('#root')

const miniBoardSvg = g => goSVG({n: g.n, b: replay(g).b})
const miniBoard = g => `<div class="goban">${miniBoardSvg(g)}</div>`

function sidebar(sel) {
  const games = SES.games.filter(g => !g.over)
  return `<aside class="sb"><a href="#home" class="home" aria-label="${t('home')}">${LOGO}${MARK}</a>
    ${NAV.map(([i, k, h], n) => n == 0 ? '' : `<a href="${h}" title="${t(k)}" class="${n === sel ? 'on' : ''}"${n === sel ? ' aria-current="page"' : ''}>${ic(i)}${t(k)}${n == 2 ? `<span class="cnt" id="sbCnt">${t('nOf', solvedCount(), totalProblems())}</span>` : ''}</a>`).join('')}
    <div id="sbGames">${sideGames(games, sel)}</div>
    <div class="spacer"></div>
    <a href="#settings" title="${t('settings')}" class="foot ${sel == 's' ? 'on' : ''}">${ic('gear')}${t('settings')}</a></aside>`
}
function sideGames(games, sel) {
  if (!games.length) return ''
  return `<div class="cap">${t('games')}</div>` + games.map(g => {
    const go = replay(g)
    return `<a href="#g/${g.id}" title="${gameTitle(g)}, ${t('size', g.n)}" class="gm ${sel == 'g' + g.id ? 'on' : ''}">${miniBoard(g)}<span>${gameTitle(g)}, ${t('size', g.n)}<small>${gameState(g, go)}</small></span></a>`
  }).join('')
}
function renderSidebarGames() {
  const el = $('#sbGames')
  if (!el) return
  const sel = $('.sb a.on') ? ($('.sb a.on').getAttribute('href') || '').replace('#g/', 'g') : null
  el.innerHTML = sideGames(SES.games.filter(g => !g.over), sel)
}
function renderSidebarCount() {
  const el = $('#sbCnt')
  if (el) el.textContent = t('nOf', solvedCount(), totalProblems())
}
function tabbar(on) {
  return `<nav class="tabbar">${TABS.map(([i, k, h], n) => `<a href="${h}" class="${n == on ? 'on' : ''}"${n == on ? ' aria-current="page"' : ''}>${ic(i)}${t(k)}</a>`).join('')}</nav>`
}
function navb(back, backT, title, right = '') {
  return `<div class="navb"><a class="bk" href="${back}">${ic('back')}${esc(backT)}</a><h1>${esc(title)}</h1><div class="gr">${right}</div></div>`
}

// страница раздела: на компьютере колонка слева, на телефоне вкладки снизу
function tabPage(sel, tab, body) {
  root().innerHTML = isCol() ? `<div class="app"><main class="page">${body}</main>${tabbar(tab)}</div>` : `<div class="app">${sidebar(sel)}<main class="page"><div class="in">${body}</div></main></div>`
}
// вложенная страница: на телефоне с кнопкой назад
function pushedPage(sel, back, backT, title, body) {
  root().innerHTML = isCol() ? `<div class="app">${navb(back, backT, title)}<main class="page pushed">${body}</main></div>` : `<div class="app">${sidebar(sel)}<main class="page"><div class="in"><h1 class="big">${esc(title)}</h1>${body}</div></main></div>`
}
// экран с доской и инспектором
function boardPage(o) {
  const more = o.more ? `<button type="button" class="ibtn" id="navMore" aria-label="${t('more')}">${ic('more')}</button>` : ''
  root().innerHTML = isCol()
    ? `<div class="app ins ${o.cls || ''}">${navb(o.back, o.backT, o.title, more)}<main class="bmain ${o.crop ? 'crop' : ''}">${o.main}</main><aside class="insp">${o.insp}</aside></div>`
    : `<div class="app ins">${sidebar(o.sel)}<main class="bmain ${o.crop ? 'crop' : ''}">${o.main}</main><aside class="insp">${o.insp}</aside></div>`
}

function dateStr() {
  return new Date().toLocaleDateString(LANG == 'ru' ? 'ru-RU' : 'en-GB', {day: 'numeric', month: 'long'})
}

// задача дня: по дате среди нерешённых на уровне игрока
function dailyProblem() {
  const est = rankEstimate()
  let lv = 0
  if (est != null) lv = est <= 15 ? 3 : est <= 20 ? 2 : est <= 25 ? 1 : 0
  const d = new Date()
  const day = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5) + d.getFullYear() * 400
  if (est != null && est <= 12) {
    const cl = CLASSICS.filter(p => !SES.solved[p.id] && p.len <= 15)
    if (cl.length) return cl[day % cl.length]
  }
  for (let l = lv; l < 4; l++) {
    const list = PROBLEMS.filter(p => p.l == l && !SES.solved[p.id])
    if (list.length) return list[day % list.length]
  }
  return PROBLEMS[day % PROBLEMS.length]
}

const QUICK = [
  {k: 'q9', o: {opp: 'bot', n: 9, goal: 'area'}},
  {k: 'q13', o: {opp: 'bot', n: 13, goal: 'area'}},
  {k: 'q19', o: {opp: 'bot', n: 19, goal: 'area'}},
  {k: 'twoPlayers', o: {opp: 'two', n: 9, goal: 'area'}, st: [['ee', BLACK], ['fd', WHITE]]},
  {k: 'capture', o: {opp: 'bot', n: 9, goal: 'cap'}, st: [['ee', WHITE], ['de', BLACK], ['ed', BLACK], ['fe', BLACK]]},
]

// значок быстрого старта: размер доски числом на дереве, у вдвоём и захвата камни
function quickGlyph(q) {
  const n = q.o.n
  if (!q.st) return `<span class="goban qn num" aria-hidden="true">${n}</span>`
  const b = newBoard(n)
  for (const [v, c] of q.st || []) b[fromSgf(n, v)] = c
  return `<span class="goban">${goSVG({n, b})}</span>`
}

// главная: одно главное дело крупно, ниже быстрый старт и сводка
function pageHome() {
  const pr = dailyProblem()
  const g = SES.games.filter(x => !x.over).sort((a, b) => b.upd - a.upd)[0]
  const newbie = !g && !SES.learned && !LOG.some(e => e.t == 'g')
  const est = rankEstimate()
  const prGoal = isClassic(pr) ? t('goal_any') : goalText(pr.g)
  const prSub = isClassic(pr) ? t('colShort_' + pr.src) + ', ' + pr.k : t('pl' + pr.l) + ', ' + t('aboutKyu', PZ_KYU[pr.l])
  const prSvg = goSVG({...problemBoard(pr), crop: tileCrop(pr)})
  let hero
  if (g) {
    const go = replay(g)
    hero = {href: '#g/' + g.id, svg: goSVG({n: g.n, b: go.b, last: go.last}), cap: t('gameOn'), title: `${gameTitle(g)}, ${t('size', g.n)}`, sub: `${gameSub(g, true)}, ${gameState(g, go)}`, main: `<a class="btn a-btn" href="#g/${g.id}">${t('continue')}</a>`, alt: `<a class="btn plain a-btn" href="#new">${t('newGame')}</a>`}
  } else if (newbie) {
    hero = {href: '#learn', svg: goSVG({n: LN, b: lessonBoard(LESSON[5])}), cap: t('learnHead'), title: t('learnTitle'), sub: t('learnText'), main: `<a class="btn a-btn" href="#learn">${t('learnBtn')}</a>`, alt: `<button type="button" class="btn plain" id="hPlay">${t('playNow')}</button>`}
  } else {
    hero = {href: '#p/' + pr.id, svg: prSvg, cap: `${t('daily')}, ${dateStr()}`, title: prGoal, sub: prSub, main: `<a class="btn a-btn" href="#p/${pr.id}">${t('solve')}</a>`, alt: `<a class="btn plain a-btn" href="#new">${t('newGame')}</a>`}
  }
  // первая карточка сводки: задача дня, если она не в главном блоке, иначе прогресс задач
  let c1
  if (g || newbie) c1 = `<a class="card hc hpz" href="#p/${pr.id}"><span class="goban">${prSvg}</span><span class="tx"><b class="h">${t('daily')}</b><b>${prGoal}</b><small class="sm">${prSub}</small></span></a>`
  else {
    const n = solvedCount(), all = totalProblems()
    c1 = `<a class="card hc" href="#tasks"><b class="h">${t('tasks')}</b><span class="big2 num">${t('nOf', n, all)}</span><span class="prog"><i style="width:${(n / all * 100).toFixed(1)}%"></i></span><small class="sm">${t('pzMix')}</small></a>`
  }
  const c2 = `<a class="card hc" href="#path"><b class="h">${t('yourRank')}</b><span class="big2">${est == null ? t('noRank') : t('aboutKyu', est)}</span><small class="sm">${est == null ? t('noRankHint') : t('nextMark', nextMark(est))}</small></a>`
  const d = SES.done && SES.done[0]
  const c3 = d ? `<a class="card hc hpz" href="#r/${d.id}"><span class="goban">${miniBoardSvg(d)}</span><span class="tx"><b class="h">${t('lastGame')}</b><b>${resultText(d)}</b><small class="sm">${gameTitle(d)}, ${t('size', d.n)}</small></span></a>` : ''
  const lv = t('botLv', t('lv' + SES.settings.ng.level).toLowerCase())
  const gear = isCol() ? `<a class="ibtn" href="#settings" aria-label="${t('settings')}">${ic('gear')}</a>` : ''
  tabPage(0, 0, `<h1 class="sr">Yoongo</h1>${isCol() ? `<div class="hhead">${LOGO}${gear}</div>` : ''}
  <section class="card hero"><a class="goban" href="${hero.href}" tabindex="-1" aria-hidden="true">${hero.svg}</a><div class="tx"><b class="h">${hero.cap}</b><h2>${hero.title}</h2><p class="sm">${hero.sub}</p><div class="acts">${hero.main}${hero.alt}</div></div></section>
  <div class="hcap"><b>${t('playCap')}</b><a class="link" href="#new">${lv}, ${t('tune')}</a></div>
  <div class="qtiles">${QUICK.map((q, i) => `<button type="button" class="qt" data-q="${i}">${quickGlyph(q)}<span class="tx"><b>${t(q.k)}</b><small>${t(q.k + 'Sub')}</small></span></button>`).join('')}</div>
  <div class="hcards ${c3 ? 'three' : ''}">${c1}${c2}${c3}</div>`)
  $$('.qt').forEach(b => b.onclick = () => {
    const q = QUICK[+b.dataset.q].o
    const r = newGame({...SES.settings.ng, ...q, capN: 3, hcap: 0, komi: null, clock: 0})
    location.hash = '#g/' + r.id
  })
  const hp = $('#hPlay')
  if (hp) hp.onclick = () => {
    const r = newGame({...SES.settings.ng, opp: 'bot', n: 9, goal: 'area', level: 0, color: 'b', hcap: 0, komi: null, clock: 0})
    location.hash = '#g/' + r.id
  }
}

function nextMark(est) {
  const m = [25, 20, 15, 10, 5, 1].find(k => k < est)
  return m == null ? 1 : m
}

// новая партия; на телефоне вкладка "Играть" с начатыми партиями сверху
function pageNew(tab) {
  const o = SES.settings.ng
  const games = SES.games.filter(g => !g.over).sort((a, b) => b.upd - a.upd)
  const list = tab && games.length ? `<div class="glist"><div class="lcap">${t('games')}</div><div class="card games">${games.map(g => `<a class="cont" href="#g/${g.id}"><span class="mini" style="width:64px">${miniBoard(g)}</span><span class="info"><b>${gameTitle(g)}, ${t('size', g.n)}</b><small>${gameState(g, replay(g))}</small></span>${CH}</a>`).join('')}</div></div>` : ''
  const done = tab && SES.done && SES.done.length ? `<div class="list donelist"><a class="li" href="#stats"><span class="tx">${t('doneHead')}</span><span class="meta">${SES.done.length}</span>${CH}</a></div>` : ''
  const seg = (k, vals, labels) => `<div class="seg" data-k="${k}">${vals.map((v, i) => `<button type="button" data-v="${v}" class="${String(o[k]) == String(v) ? 'on' : ''}" aria-pressed="${String(o[k]) == String(v)}">${labels[i]}</button>`).join('')}</div>`
  const bot = o.opp == 'bot'
  const komi = o.goal == 'cap' ? t('noKomi') : o.hcap >= 2 ? fmtNum(0.5) : fmtNum(o.komi != null ? o.komi : SES.settings.komi)
  const body = `${tab ? `<h1 class="big">${t('play')}</h1>` : ''}${list}
  ${done}<div class="ng"><div class="prev" id="ngPrev"></div>
  <div class="form">
    <div class="opt"><span>${t('opponent')}</span>${seg('opp', ['bot', 'two'], [t('bot'), t('twoPlayers')])}</div>
    <div class="opt"><span>${t('board')}</span>${seg('n', [7, 9, 13, 19], ['7', '9', '13', '19'])}</div>
    <div class="opt"><span>${t('goal')}</span>${seg('goal', ['area', 'cap'], [t('territory'), t('capture')])}</div>
    ${o.goal == 'cap' ? `<div class="opt"><span>${t('capWho')}</span>${seg('capN', [1, 3, 5], ['1', '3', '5'])}</div>` : ''}
    ${bot ? `<div class="opt"><span>${t('botLevel')}</span><div class="lvl">${[0, 1, 2, 3].map(l => `<button type="button" data-l="${l}" class="${o.level == l ? 'on' : ''}" aria-pressed="${o.level == l}">${t('lv' + l)}<small>${t('kyuShort', BOT_KYU[l])}</small></button>`).join('')}</div></div>
    ${o.n > 9 ? `<p class="sm optnote">${t('kyuNote')}</p>` : ''}
    <div class="opt"><span>${t('color')}</span>${seg('color', ['b', 'r', 'w'], [t('black'), t('random'), t('white')])}</div>` : ''}
    <div class="list">
      <button type="button" class="li" id="ngHcap" ${o.goal == 'cap' ? 'disabled' : ''}>${t('handicap')}<span class="meta">${o.hcap >= 2 && o.goal != 'cap' ? t('stonesN', o.hcap) : t('none')}</span>${CH}</button>
      <button type="button" class="li" id="ngKomi" ${o.goal == 'cap' || o.hcap >= 2 ? 'disabled' : ''}>${t('komi')}<span class="meta">${komi}</span>${CH}</button>
      <button type="button" class="li" id="ngClock">${t('clock')}<span class="meta">${clockLabel(o.clock)}</span>${CH}</button>
    </div>
    <button type="button" class="btn" id="ngGo">${t('playBtn')}</button>
  </div></div>`
  if (tab) tabPage(1, 1, body)
  else pushedPage(1, '#home', t('home'), t('newGame'), body)
  const hc = o.goal == 'cap' ? 0 : o.n == 7 ? Math.min(o.hcap, 4) : o.hcap
  const prevB = newBoard(o.n)
  for (const p of handicapPoints(o.n, hc)) prevB[p] = BLACK
  $('#ngPrev').innerHTML = `<div class="goban">${goSVG({n: o.n, b: prevB})}</div><small class="sm">${t('size', o.n)}${bot ? ', ' + (o.color == 'b' ? t('youBlack') : o.color == 'w' ? t('youWhite') : t('colorRandom')) : ''}</small>`
  const rerender = () => keepFocus(() => pageNew(tab))
  $$('.seg[data-k]').forEach(s => s.addEventListener('click', e => {
    const b = e.target.closest('button')
    if (!b) return
    const k = s.dataset.k
    o[k] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v
    writeSes()
    rerender()
  }))
  $$('.lvl button').forEach(b => b.onclick = () => {
    o.level = +b.dataset.l
    writeSes()
    rerender()
  })
  $('#ngHcap').onclick = e => menuAt(e.currentTarget, HCAPS.filter(h => o.n > 7 || h <= 4).map(h => ({t: h ? t('stonesN', h) : t('none'), on: o.hcap == h, fn: () => {
    o.hcap = h
    writeSes()
    rerender()
  }})))
  $('#ngKomi').onclick = e => menuAt(e.currentTarget, KOMIS.map(k => ({t: fmtNum(k), on: (o.komi != null ? o.komi : SES.settings.komi) == k, fn: () => {
    o.komi = k
    writeSes()
    rerender()
  }})))
  $('#ngClock').onclick = e => menuAt(e.currentTarget, CLOCKS.map((c, i) => ({t: clockLabel(i), on: o.clock == i, fn: () => {
    o.clock = i
    writeSes()
    rerender()
  }})))
  $('#ngGo').onclick = () => {
    const r = newGame(o)
    location.hash = '#g/' + r.id
  }
}

function clockLabel(i) {
  const c = CLOCKS[i || 0]
  if (!c) return t('noClock')
  if (!c.main) return t('byoOnly', c.byo)
  return t('clockFmt', c.main / 60, c.per, c.byo)
}

const PAGE = 60
// сборники первыми, потом свои уровни
function lvlChips(on) {
  const col = `<button type="button" data-l="c" class="${String(on)[0] == 'c' ? 'on' : ''}" aria-pressed="${String(on)[0] == 'c'}">${t('collections')}<small>${CLASSICS.length}</small></button>`
  return `<div class="lvls">${col}${[0, 1, 2, 3].map(l => `<button type="button" data-l="${l}" class="${String(l) == String(on) ? 'on' : ''}" aria-pressed="${String(l) == String(on)}">${t('pl' + l)}<small>${t('kyuShort', PZ_KYU[l])}</small></button>`).join('')}</div>`
}
function tile(p, i, cur) {
  const done = SES.solved[p.id]
  const cls = (done ? 'done' : p == cur ? 'cur' : '') + (done || SES.seen[p.id] ? '' : ' fresh')
  const note = done ? t('solvedW') : SES.seen[p.id] ? t('startedW') : p.g ? t('goalShort_' + p.g) : ''
  return `<a href="#p/${p.id}" class="pz ${cls}"><div class="goban">${goSVG({...problemBoard(p), crop: tileCrop(p)})}</div><span class="n">${p.k || i + 1}<small>${note}</small></span></a>`
}

// без номера страницы открывается та, где первая нерешённая
function pageTasks(lv, page) {
  if (lv == null) {
    const last = SES.lastPz && findProblem(SES.lastPz)
    lv = last ? (isClassic(last) ? 'c' + last.src : last.l) : 'c'
  }
  const head = `<h1 class="big">${t('tasks')}</h1><p class="sub">${t('solvedOf', solvedCount(), totalProblems())}</p>`
  if (lv == 'c') {
    const cards = COLLECTIONS.map(c => {
      const list = CLASSICS.filter(p => p.src == c.src)
      const done = list.filter(p => SES.solved[p.id]).length
      const first = list.find(p => !SES.solved[p.id]) || list[0]
      return `<a class="card colc" href="#tasks/c${c.src}"><div class="goban">${goSVG({...problemBoard(first), crop: tileCrop(first)})}</div><div class="tx"><b>${t(c.key)}</b><small class="sm">${t('colSrc_' + c.src)}</small><span class="prog"><i style="width:${(done / list.length * 100).toFixed(1)}%"></i></span><small class="sm">${t('solvedOf', done, list.length)}</small></div></a>`
    }).join('')
    tabPage(2, 2, `${head}${lvlChips('c')}<div class="cols">${cards}</div><p class="sm colnote">${t('colNote')}</p>`)
  } else if (String(lv)[0] == 'c') {
    const src = String(lv)[1]
    const col = COLLECTIONS.find(c => c.src == src) || COLLECTIONS[0]
    const list = CLASSICS.filter(p => p.src == col.src)
    const pages = Math.ceil(list.length / PAGE)
    const solvedLv = list.filter(p => SES.solved[p.id]).length
    const cur = list.find(p => !SES.solved[p.id])
    if (page == null) page = cur ? Math.floor(list.indexOf(cur) / PAGE) + 1 : 1
    page = Math.max(1, Math.min(pages, page))
    const part = list.slice((page - 1) * PAGE, page * PAGE)
    const pager = pages > 1 ? `<div class="pager">${Array.from({length: pages}, (_, i) => `<a href="#tasks/c${col.src}/${i + 1}" class="${i + 1 == page ? 'on' : ''}">${i * PAGE + 1}-${Math.min(list.length, (i + 1) * PAGE)}</a>`).join('')}</div>` : ''
    tabPage(2, 2, `${head}${lvlChips('c')}
    <div class="thead"><a class="link" href="#tasks/c">${t('collections')}</a><b class="colh">${t(col.key)}</b><span class="sm">${t('solvedOf', solvedLv, list.length)}</span><span class="prog"><i style="width:${(solvedLv / list.length * 100).toFixed(1)}%"></i></span></div>
    ${pager}<div class="pgrid">${part.map((p, i) => tile(p, i, cur)).join('')}</div>${page < pages ? `<a class="btn plain a-btn morebtn" href="#tasks/c${col.src}/${page + 1}">${t('nextPage', page * PAGE + 1, Math.min(list.length, (page + 1) * PAGE))}</a>` : ''}`)
  } else {
    lv = +lv
    const list = PROBLEMS.filter(p => p.l == lv)
    const solvedLv = list.filter(p => SES.solved[p.id]).length
    const cur = list.find(p => !SES.solved[p.id])
    const pages = Math.ceil(list.length / PAGE)
    if (page == null) page = cur ? Math.floor(list.indexOf(cur) / PAGE) + 1 : 1
    page = Math.max(1, Math.min(pages, page))
    const part = list.slice((page - 1) * PAGE, page * PAGE)
    const pager = pages > 1 ? `<div class="pager">${Array.from({length: pages}, (_, i) => `<a href="#tasks/${lv}/${i + 1}" class="${i + 1 == page ? 'on' : ''}">${i * PAGE + 1}-${Math.min(list.length, (i + 1) * PAGE)}</a>`).join('')}</div>` : ''
    tabPage(2, 2, `${head}${lvlChips(lv)}
    <div class="thead"><span class="sm">${t('solvedOf', solvedLv, list.length)}</span><span class="prog"><i style="width:${(solvedLv / list.length * 100).toFixed(1)}%"></i></span></div>
    ${pager}<div class="pgrid">${part.map((p, i) => tile(p, (page - 1) * PAGE + i, cur)).join('')}</div>${page < pages ? `<a class="btn plain a-btn morebtn" href="#tasks/${lv}/${page + 1}">${t('nextPage', page * PAGE + 1, Math.min(list.length, (page + 1) * PAGE))}</a>` : ''}`)
  }
  $$('.lvls button').forEach(b => b.onclick = () => (location.hash = '#tasks/' + b.dataset.l))
}

// плитка задачи квадратная: рамка камней плюс линия, не меньше 6 линий
function tileCrop(p) {
  let x0 = 18, y0 = 18, x1 = 0, y1 = 0
  for (const v of [...p.b, ...p.w]) {
    const x = v.charCodeAt(0) - 97, y = v.charCodeAt(1) - 97
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  x0 = x0 <= 1 ? 0 : x0 - 1
  y0 = y0 <= 1 ? 0 : y0 - 1
  x1 = x1 >= 17 ? 18 : x1 + 1
  y1 = y1 >= 17 ? 18 : y1 + 1
  const side = Math.max(5, x1 - x0, y1 - y0)
  while (x1 - x0 < side) x0 > 0 && (x1 == 18 || x0 > 18 - x1) ? x0-- : x1++
  while (y1 - y0 < side) y0 > 0 && (y1 == 18 || y0 > 18 - y1) ? y0-- : y1++
  return [x0, y0, x1, y1]
}

// вырез задачи не уже 0,6 по любой стороне: узкую полосу расширяем к центру
function fitCrop(c) {
  let [x0, y0, x1, y1] = c
  while ((x1 - x0 + 1) < .6 * (y1 - y0 + 1)) x0 > 18 - x1 ? x0-- : x1++
  while ((y1 - y0 + 1) < .6 * (x1 - x0 + 1)) y0 > 18 - y1 ? y0-- : y1++
  return [x0, y0, x1, y1]
}

// этапы пути: какие задачи и какой бот к ним
const STAGES = [
  {k: 30, key: 'st0', pz: p => p.l == 0, bot: 0},
  {k: 25, key: 'st1', pz: p => p.l == 1 && p.g == 'capture', bot: 0},
  {k: 20, key: 'st2', pz: p => p.l == 1 && p.g != 'capture', bot: 1},
  {k: 15, key: 'st3', pz: p => p.l == 2, bot: 2},
  {k: 10, key: 'st4', pz: p => p.l == 3, bot: 3},
  {k: 5, key: 'st5'},
  {k: 1, key: 'st6'},
  {k: 0, key: 'st7'},
]

function stageIndex(est) {
  if (est == null) return 0
  // последний этап, чей рубеж не сильнее игрока
  let c = 0
  for (let i = 0; i < 5; i++) if (STAGES[i].k >= est) c = i
  return c
}

function pageStats() {
  const games = LOG.filter(e => e.t == 'g' && e.opp == 'bot' && e.win != null)
  const wins = games.filter(e => e.win).length
  const est = rankEstimate()
  const pts = rankPoints()
  const rowsBot = [0, 1, 2, 3].map(l => {
    const s = botStats(l)
    return s.n ? `<div class="row"><span>${t('lv' + l)}</span><span class="num">${s.w}</span><span class="num">${s.n}</span></div>` : ''
  }).join('')
  const rowsPz = COLLECTIONS.map(c => {
    const list = CLASSICS.filter(p => p.src == c.src)
    return `<div class="row"><span>${t(c.key)}</span><span class="num">${list.filter(p => SES.solved[p.id]).length}</span><span class="num">${list.length}</span></div>`
  }).join('') + [0, 1, 2, 3].map(l => `<div class="row"><span>${t('pl' + l)}</span><span class="num">${solvedCount(l)}</span><span class="num">${PROBLEMS.filter(p => p.l == l).length}</span></div>`).join('')
  const twoGames = LOG.filter(e => e.t == 'g' && e.opp == 'two').length
  pushedPage(4, '#path', t('path'), t('stats'), `
  <div class="tiles"><div class="tile2"><b class="num">${games.length}</b><span>${t('gamesWithBotN', games.length)}</span></div><div class="tile2"><b class="num">${games.length ? Math.round(wins / games.length * 100) + '%' : t('noneShort')}</b><span>${t('wins')}</span></div><div class="tile2"><b class="num">${solvedCount()}</b><span>${t('tasksSolvedN', solvedCount())}</span></div><div class="tile2"><b class="num">${est == null ? t('noneShort') : t('kyuShort', est)}</b><span>${t('approxRank')}</span></div></div>
  <div class="card chart"><b class="h">${t('rankByWeek')}</b>${pts ? '<div class="rchart" id="rChart" role="img" tabindex="0"></div>' : `<p class="empty" style="margin-top:8px">${t('chartEmpty')}</p>`}</div>
  <div class="two"><div class="card tbl"><b class="h">${t('vsBot')}</b>${rowsBot ? `<div class="row hd"><span>${t('level')}</span><span>${t('winsCol')}</span><span>${t('gamesCol')}</span></div>${rowsBot}` : `<p class="empty" style="padding-top:8px">${t('noBotGames')}</p>`}${twoGames ? `<p class="sm twon">${t('twoGamesN', twoGames)}</p>` : ''}</div>
    <div class="card tbl"><b class="h">${t('tasks')}</b><div class="row hd"><span>${t('level')}</span><span>${t('solvedCol')}</span><span>${t('totalCol')}</span></div>${rowsPz}</div></div>
  <div class="lcap donecap">${t('doneHead')}</div><div class="card games">${doneList()}</div>`)
  if (pts) drawRankChart(pts)
}

// сила по неделям: оценка по журналу на конец каждой недели
function rankPoints() {
  const wk = 7 * 864e5
  const end = Date.now()
  const pts = []
  for (let i = 9; i >= 0; i--) {
    const cut = end - i * wk
    const k = rankEstimate(LOG.filter(e => e.date <= cut))
    if (k != null) pts.push({k, d: cut})
  }
  return pts.length < 2 ? null : pts
}

// svg в пикселях блока, подписи и точка не растягиваются
function drawRankChart(pts) {
  const box = $('#rChart')
  if (!box) return
  const w = Math.max(240, box.clientWidth), h = 180
  const L = 44, R = 12, T = 12, B = 28
  const lo = Math.min(...pts.map(p => p.k)) - 2, hi = Math.max(...pts.map(p => p.k)) + 2
  const x = i => L + i * (w - L - R) / (pts.length - 1)
  // меньше кю выше
  const y = k => T + (k - lo) / (hi - lo) * (h - T - B)
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`
  for (let k = Math.ceil(lo / 5) * 5; k <= hi; k += 5) s += `<line x1="${L}" x2="${w - R}" y1="${y(k)}" y2="${y(k)}" style="stroke:var(--sep)" stroke-width="1"/><text x="${L - 8}" y="${y(k) + 4}" text-anchor="end" font-size="11" style="fill:var(--text-2)">${t('kyuShort', k)}</text>`
  const dl = i => `<text x="${x(i)}" y="${h - 8}" text-anchor="${i ? 'end' : 'start'}" font-size="11" style="fill:var(--text-2)">${dayStr(pts[i].d)}</text>`
  s += dl(0) + dl(pts.length - 1)
  s += `<line class="xh" y1="${T}" y2="${h - B}" style="stroke:var(--rule)" stroke-width="1" visibility="hidden"/>`
  s += `<polyline points="${pts.map((p, i) => x(i) + ',' + y(p.k)).join(' ')}" fill="none" style="stroke:var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
  const last = pts.length - 1
  s += `<circle class="dot" cx="${x(last)}" cy="${y(pts[last].k)}" r="4" style="fill:var(--accent);stroke:var(--surface)" stroke-width="2"/>`
  box.innerHTML = s + `</svg><div class="tip" hidden></div>`
  box.setAttribute('aria-label', t('rankChartLabel', pts[0].k, pts[last].k, pts.length))
  const svg = $('svg', box), xh = $('.xh', box), dot = $('.dot', box), tip = $('.tip', box)
  const show = i => {
    i = Math.max(0, Math.min(last, i))
    box.dataset.i = i
    xh.setAttribute('x1', x(i))
    xh.setAttribute('x2', x(i))
    xh.setAttribute('visibility', 'visible')
    dot.setAttribute('cx', x(i))
    dot.setAttribute('cy', y(pts[i].k))
    tip.hidden = false
    tip.innerHTML = `<span class="sm">${t('weekTo', dayStr(pts[i].d))}</span><b>${t('aboutKyu', pts[i].k)}</b>`
    const r = svg.getBoundingClientRect(), k = r.width / w
    tip.style.left = Math.min(r.width - tip.offsetWidth, Math.max(0, x(i) * k - tip.offsetWidth / 2)) + 'px'
  }
  const hide = () => {
    xh.setAttribute('visibility', 'hidden')
    dot.setAttribute('cx', x(last))
    dot.setAttribute('cy', y(pts[last].k))
    tip.hidden = true
    delete box.dataset.i
  }
  // перекрестие ищет ближайшую неделю по x
  svg.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect()
    show(Math.round(((e.clientX - r.left) / r.width * w - L) / (w - L - R) * last))
  })
  svg.addEventListener('pointerleave', hide)
  box.addEventListener('blur', hide)
  box.addEventListener('keydown', e => {
    if (e.key != 'ArrowLeft' && e.key != 'ArrowRight') return
    e.preventDefault()
    const i = box.dataset.i == null ? last : +box.dataset.i
    show(i + (e.key == 'ArrowLeft' ? -1 : 1))
  })
}

function pagePath() {
  const est = rankEstimate()
  const cur = stageIndex(est)
  // в основе оценки только партии на 9 на 9 без форы и задачи своих уровней
  const games = LOG.filter(e => e.t == 'g' && e.opp == 'bot' && e.win != null && e.n == 9 && !e.hcap && e.goal != 'cap').length
  const pz = LOG.filter(e => e.t == 'p' && e.l != 'c').length
  const statsLink = isCol() ? `<a class="link" href="#stats">${t('stats')}</a>` : ''
  tabPage(3, 3, `<div class="phead"><h1 class="big">${t('path')}</h1>${statsLink}</div>
  <div class="rankhead ${est == null ? 'none' : ''}"><span class="big2">${est == null ? t('noRank') : t('aboutKyu', est)}</span><span class="sm">${est == null ? t('noRankHint') : t('rankBasis', games, pz)}</span></div>
  <div class="ladder">${STAGES.map((s, i) => {
    const cls = i < cur ? 'past' : i == cur ? 'cur' : 'fut'
    const mark = i < cur ? st(BLACK) : i == cur ? '<span class="st b cur"></span>' : '<span class="p"></span>'
    let card = ''
    if (i == cur && s.pz) {
      const list = PROBLEMS.filter(s.pz)
      const done = list.filter(p => SES.solved[p.id]).length
      const bs = botStats(s.bot, 9)
      const first = list.find(p => !SES.solved[p.id]) || list[0]
      card = `<div class="card"><div><b class="h">${t('stageTasks')}</b><span class="prog"><i style="width:${(done / list.length * 100).toFixed(1)}%"></i></span><span class="sm">${t('nOf', done, list.length)}</span></div><div><b class="h">${t('stageBot', t('lv' + s.bot).toLowerCase())}</b><span class="prog"><i style="width:${bs.n ? (bs.w / bs.n * 100).toFixed(1) : 0}%"></i></span><span class="sm">${bs.n ? t('winsOf', bs.w, bs.n) : t('noGamesYet')}</span></div><div class="acts">${i == 0 ? `<a class="btn a-btn" href="#learn">${t('learnBtn')}</a>` : ''}<a class="btn ${i == 0 ? 'soft' : ''} a-btn" href="#p/${first.id}">${t('stageTasksBtn')}</a><button type="button" class="btn soft" id="stBot">${t('stageBotBtn')}</button></div></div>`
    }
    const later = !s.pz ? ` <span class="k">${t('later')}</span>` : ''
    return `<div class="stg ${cls}"><div class="rail">${mark}</div><div class="body"><div class="t"><b>${t(s.key)}</b><span class="k">${s.k ? t('kyuShort', s.k) : t('dan1')}</span>${later}</div><p>${t(s.key + 'd')}</p>${card}</div></div>`
  }).join('')}</div>`)
  const b = $('#stBot')
  if (b) b.onclick = () => {
    const r = newGame({...SES.settings.ng, opp: 'bot', n: 9, goal: 'area', level: STAGES[cur].bot, color: 'b', hcap: 0, komi: null})
    location.hash = '#g/' + r.id
  }
}

function pageSettings() {
  const s = SES.settings
  const sw = (k, on) => `<label class="sw"><input type="checkbox" data-k="${k}" aria-label="${t(k == 'undo' ? 'undoBot' : k)}" ${on ? 'checked' : ''}><i></i></label>`
  const seg = (k, vals, labels) => `<div class="seg" data-k="${k}">${vals.map((v, i) => `<button type="button" data-v="${v}" class="${String(s[k]) == String(v) ? 'on' : ''}" aria-pressed="${String(s[k]) == String(v)}">${labels[i]}</button>`).join('')}</div>`
  pushedPage('s', '#home', t('home'), t('settings'), `<div class="set">
  <div class="lcap">${t('look')}</div><div class="list">
    <div class="li">${t('theme')}${seg('theme', ['auto', 'light', 'dark'], [t('themeAuto'), t('themeLight'), t('themeDark')])}</div>
    <div class="li">${t('language')}${seg('lang', ['ru', 'en'], ['Русский', 'English'])}</div></div>
  <div class="lcap">${t('board')}</div><div class="list">
    <div class="li">${t('coords')}${sw('coords', s.coords)}</div>
    <div class="li">${t('lastMark')}${sw('lastMark', s.lastMark)}</div>
    <div class="li"><span class="tx">${t('confirm')}<small>${t('confirmNote')}</small></span>${sw('confirm', s.confirm)}</div>
    <div class="li">${t('sound')}${sw('sound', s.sound)}</div></div>
  <div class="lcap">${t('tasks')}</div><div class="list">
    <div class="li"><span class="tx">${t('autoNext')}<small>${t('autoNextNote')}</small></span>${sw('autoNext', s.autoNext)}</div></div>
  <div class="lcap">${t('gameCap')}</div><div class="list">
    <div class="li"><span class="tx">${t('scoring')}<small>${t('scoringNote')}</small></span><span class="meta">${t('byArea')}</span></div>
    <button type="button" class="li" id="setKomi">${t('komiDefault')}<span class="meta">${fmtNum(s.komi)}</span>${CH}</button>
    <div class="li">${t('undoBot')}${sw('undo', s.undo)}</div></div>
  <div class="lcap">${t('about')}</div><div class="list">
    <a class="li" href="https://yoonzky.github.io/links/" target="_blank" rel="noopener"><span class="tx">${t('author')}</span><span class="meta">yoonzky</span>${CH}</a><a class="li" href="https://github.com/yoonzky/yoongo" target="_blank" rel="noopener"><span class="tx">${t('srcCode')}</span><span class="meta">GitHub</span>${CH}</a><a class="li" href="https://github.com/yoonzky/yoongo/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener"><span class="tx">${t('sources')}</span><span class="meta"></span>${CH}</a><a class="li" href="privacy.html"><span class="tx">${t('privacy')}</span><span class="meta"></span>${CH}</a></div>
  </div>`)
  $$('.set .seg').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('button')
    if (!b) return
    s[g.dataset.k] = b.dataset.v
    writeSes()
    applyTheme()
    applyLang()
    keepFocus(pageSettings)
  }))
  $$('.set input[type=checkbox]').forEach(i => i.onchange = () => {
    s[i.dataset.k] = i.checked
    writeSes()
  })
  $('#setKomi').onclick = e => menuAt(e.currentTarget, KOMIS.map(k => ({t: fmtNum(k), on: s.komi == k, fn: () => {
    s.komi = k
    SES.settings.ng.komi = null
    writeSes()
    keepFocus(pageSettings)
  }})))
}
