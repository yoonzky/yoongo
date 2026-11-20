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
  const h = location.hash.slice(1) || 'home'
  const [k, a, b] = h.split('/')
  document.body.classList.toggle('col', isCol())
  lastCol = isCol()
  if (k != 'g') {
    stopClock()
    G = null
  }
  if (k != 'p') P = null
  if (k != 'r') R = null
  if (k != 'learn') L = null
  if (k == 'home' || k == 'today') pageHome()
  else if (k == 'new') isCol() ? pageNew(true) : pageNew(false)
  else if (k == 'play') isCol() ? pageNew(true) : pageNew(false)
  else if (k == 'tasks') pageTasks(a == null ? null : a, b == null ? null : +b)
  else if (k == 'path') pagePath()
  else if (k == 'stats') pageStats()
  else if (k == 'settings') pageSettings()
  else if (k == 'g') openGame(a)
  else if (k == 'p') openProblem(a)
  else if (k == 'r') openReview(a)
  else if (k == 'learn') openLesson(a)
  else pageHome()
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
      openProblem(id, true)
    } else if (R) {
      const k = R.k
      openReview(R.rec.id)
      reviewAt(k)
    } else route()
  })
  addEventListener('pagehide', writeSes)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) writeSes()
  })
  addEventListener('keydown', e => {
    if (e.key == 'Escape' && openMenu) closeMenu(true)
    if (openMenu || (e.target.closest && e.target.closest('input,textarea'))) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (G && !e.repeat && (e.key == 'z' || e.key == 'Z' || e.key == 'я' || e.key == 'Я')) undo()
    // в задаче: H подсказка, R заново, N следующая
    if (P && !e.repeat) {
      const k = e.key.toLowerCase()
      const id = {h: '#pHint', 'р': '#pHint', r: '#pAgain', 'к': '#pAgain', n: '#pNext', 'т': '#pNext'}[k]
      const b = id && $(id)
      if (b && !b.disabled) {
        e.preventDefault()
        b.click()
      }
    }
    // в разборе стрелки листают ходы, если доска не в фокусе
    if (R && !e.defaultPrevented && (e.key == 'ArrowLeft' || e.key == 'ArrowRight')) {
      e.preventDefault()
      reviewAt(R.k + (e.key == 'ArrowLeft' ? -1 : 1))
    }
  })
  route()
}

boot()
