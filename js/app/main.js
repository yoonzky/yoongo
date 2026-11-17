/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
// запуск, тема, язык, переходы по адресу
'use strict'

function applyTheme() {
  const s = SES.settings.theme
  const dark = s == 'dark' || (s == 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  const m = $('#metaTheme')
  if (m) m.content = dark ? '#131417' : '#eceef2'
}

function applyLang() {
  LANG = SES.settings.lang == 'en' ? 'en' : 'ru'
  document.documentElement.lang = LANG
  document.title = 'Yoongo'
}

let lastCol = null
function route() {
  closeMenu()
  const h = location.hash.slice(1) || 'today'
  const [k, a, b] = h.split('/')
  document.body.classList.toggle('col', isCol())
  lastCol = isCol()
  if (k != 'g') {
    stopClock()
    G = null
  }
  if (k != 'p') P = null
  if (k == 'today') pageToday()
  else if (k == 'new') isCol() ? pageNew(true) : pageNew(false)
  else if (k == 'play') isCol() ? pageNew(true) : pageNew(false)
  else if (k == 'tasks') pageTasks(a == null ? null : a, b == null ? 1 : +b)
  else if (k == 'path') pagePath()
  else if (k == 'stats') pageStats()
  else if (k == 'settings') pageSettings()
  else if (k == 'g') openGame(a)
  else if (k == 'p') openProblem(a)
  else pageToday()
  const pg = $('.page')
  if (pg) pg.scrollTop = 0
  scrollTo(0, 0)
}

function boot() {
  loadStore()
  applyTheme()
  applyLang()
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
  addEventListener('hashchange', route)
  // смена ширины между телефоном и компьютером пересобирает экран
  addEventListener('resize', () => {
    if (isCol() == lastCol) return
    document.body.classList.toggle('col', isCol())
    lastCol = isCol()
    if (G) {
      renderGame()
      if (G.rec.phase == 'score' && G.score) recount()
    } else if (P) {
      const id = P.pr.id
      openProblem(id)
    } else route()
  })
  addEventListener('pagehide', writeSes)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) writeSes()
  })
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,textarea')) return
    if (G && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key == 'z' || e.key == 'Z')) undo()
  })
  route()
}

boot()
