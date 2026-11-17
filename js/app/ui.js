/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
// мелочи интерфейса: значки, всплывашки, меню, вызов движка
'use strict'

const I = {
  back: '<path d="m15 18-6-6 6-6"/>',
  more: '<circle cx="6" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18" cy="12" r="1.1"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  pass: '<path d="M5 12h12"/><path d="m13 7 5 5-5 5"/><path d="M20 5v14"/>',
  area: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 12h8V4"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"/>',
  redo: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/>',
  next: '<path d="m7 5.5 7 6.5-7 6.5"/><path d="M17 5v14"/>',
  stats: '<rect x="4.5" y="12" width="4" height="7.5" rx="1.2"/><rect x="10" y="4.5" width="4" height="15" rx="1.2"/><rect x="15.5" y="8.5" width="4" height="11" rx="1.2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  plus: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
  grid: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16M4 15h16M10 4v16M15 4v16"/>',
  path: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5"/>',
  play: '<circle cx="12" cy="12" r="8.5"/><path d="m10 8.5 5 3.5-5 3.5Z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  zoom: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4M8.5 11h5M11 8.5v5"/>',
  unzoom: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4M8.5 11h5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
}
const ic = (k, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`
const CH = '<svg class="icon chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5.5 6.5 6.5-6.5 6.5"/></svg>'
const LOGO = '<span class="logo"><span class="lt">yoon</span>go</span>'
const st = c => `<span class="st ${c == BLACK || c == 'b' ? 'b' : 'w'}"></span>`
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]))
const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const isCol = () => innerWidth < 720
const fmtNum = x => (LANG == 'ru' ? String(x).replace('.', ',') : String(x))

let toastTimer = null
function toast(msg) {
  const t = $('#toast')
  t.textContent = msg
  t.classList.add('on')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.remove('on'), 2400)
}

// окно с вопросом; acts: [{t, cls, fn}]
function alertBox(title, text, acts) {
  const bg = document.createElement('div')
  bg.className = 'alert-bg'
  bg.innerHTML = `<div class="alert" role="alertdialog" tabindex="-1">${title ? `<b${text ? '' : ' class="solo"'}>${esc(title)}</b>` : ''}${text ? `<p>${esc(text)}</p>` : ''}<div class="acts">${acts.map((a, i) => `<button type="button" class="${a.cls || ''}" data-i="${i}">${esc(a.t)}</button>`).join('')}</div></div>`
  document.body.appendChild(bg)
  requestAnimationFrame(() => bg.classList.add('on'))
  const close = () => {
    bg.classList.remove('on')
    setTimeout(() => bg.remove(), 180)
    removeEventListener('keydown', key)
  }
  const key = e => {
    if (e.key == 'Escape') close()
  }
  addEventListener('keydown', key)
  bg.addEventListener('click', e => {
    const b = e.target.closest('button')
    if (b) {
      close()
      const a = acts[+b.dataset.i]
      if (a.fn) a.fn()
    } else if (e.target == bg) close()
  })
  $('.alert', bg).focus()
}

// меню у кнопки; items: [{t, icon, on, cls, fn}]
let openMenu = null
function menuAt(btn, items) {
  closeMenu()
  const m = document.createElement('div')
  m.className = 'menu'
  m.setAttribute('role', 'menu')
  m.innerHTML = items.map((it, i) => `<button type="button" role="menuitem" class="${it.cls || ''} ${it.on ? 'on' : ''}" data-i="${i}">${it.icon ? ic(it.icon) : ''}${esc(it.t)}${it.on ? ic('check', 'icon ck') : ''}</button>`).join('')
  document.body.appendChild(m)
  const r = btn.getBoundingClientRect()
  const mw = m.offsetWidth, mh = m.offsetHeight
  let x = Math.min(r.right - mw, innerWidth - mw - 8)
  if (x < 8) x = 8
  let y = r.bottom + 6
  if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 6)
  m.style.left = x + 'px'
  m.style.top = y + 'px'
  m.addEventListener('click', e => {
    const b = e.target.closest('button')
    if (!b) return
    closeMenu()
    items[+b.dataset.i].fn()
  })
  openMenu = m
  setTimeout(() => addEventListener('pointerdown', outside), 0)
}
function outside(e) {
  if (openMenu && !openMenu.contains(e.target)) closeMenu()
}
function closeMenu() {
  if (openMenu) openMenu.remove()
  openMenu = null
  removeEventListener('pointerdown', outside)
}

// движок в воркере; с file:// воркер не стартует, тогда в окне
let WK = null, wkSeq = 0
const wkWait = new Map()
try {
  WK = new Worker('js/engine/worker.js')
  WK.onmessage = e => {
    const f = wkWait.get(e.data.id)
    if (f) {
      wkWait.delete(e.data.id)
      f(e.data.r)
    }
  }
  WK.onerror = () => {
    WK = null
    for (const [id, f] of wkWait) f(null)
    wkWait.clear()
  }
} catch (e) {
  WK = null
}
function engine(cmd, a) {
  if (!WK) return new Promise(res => setTimeout(() => res(engineCall(cmd, a)), 30))
  return new Promise(res => {
    const id = ++wkSeq
    wkWait.set(id, r => res(r || engineCall(cmd, a)))
    WK.postMessage({id, cmd, a})
  })
}
