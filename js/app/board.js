/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
// доска в svg: камни, метки, территория, наведение и касание
'use strict'

let GID = 0

// o: n, b (Int8Array с рамкой), last, ghost, ghostC, crop, dead (Set), terr (own), labels, hint, marks (Set), own (числа -1..1), pop
function goSVG(o) {
  const n = o.n, W = n + 2
  const id = 'g' + (GID++)
  const [x0, y0, x1, y1] = o.crop || [0, 0, n - 1, n - 1]
  const pad = o.labels ? .95 : .62
  const L = x0 == 0 ? -pad : x0 - .62
  const T = y0 == 0 ? -pad : y0 - .62
  const R = x1 == n - 1 ? n - 1 + pad : x1 + .62
  const D = y1 == n - 1 ? n - 1 + pad : y1 + .62
  const lw = n > 13 ? .028 : .032
  let s = `<svg viewBox="${L} ${T} ${R - L} ${D - T}" xmlns="http://www.w3.org/2000/svg" data-vb="${L} ${T} ${R - L} ${D - T}"><defs>`
  s += `<radialGradient id="${id}b" cx=".36" cy=".3" r=".75"><stop offset="0" style="stop-color:var(--sb-hi)"/><stop offset="1" style="stop-color:var(--sb)"/></radialGradient>`
  s += `<radialGradient id="${id}w" cx=".36" cy=".3" r=".8"><stop offset="0" style="stop-color:var(--sw-hi)"/><stop offset="1" style="stop-color:var(--sw-lo)"/></radialGradient>`
  s += `<filter id="${id}s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy=".06" stdDeviation=".06" style="flood-color:#000;flood-opacity:var(--stone-sh)"/></filter></defs>`
  s += `<rect x="${L}" y="${T}" width="${R - L}" height="${D - T}" style="fill:var(--wood)"/>`
  const hx0 = x0 == 0 ? 0 : L, hx1 = x1 == n - 1 ? n - 1 : R
  const vy0 = y0 == 0 ? 0 : T, vy1 = y1 == n - 1 ? n - 1 : D
  for (let i = y0; i <= y1; i++) {
    const w = i == 0 || i == n - 1 ? lw * 1.5 : lw
    s += `<line x1="${hx0}" y1="${i}" x2="${hx1}" y2="${i}" style="stroke:var(--wood-line)" stroke-width="${w}"/>`
  }
  for (let i = x0; i <= x1; i++) {
    const w = i == 0 || i == n - 1 ? lw * 1.5 : lw
    s += `<line x1="${i}" y1="${vy0}" x2="${i}" y2="${vy1}" style="stroke:var(--wood-line)" stroke-width="${w}"/>`
  }
  for (const [x, y] of stars(n)) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) s += `<circle cx="${x}" cy="${y}" r="${n > 13 ? .1 : .09}" style="fill:var(--wood-star)"/>`
  if (o.labels) {
    const lab = (x, y, t) => `<text x="${x}" y="${y + .1}" font-size="${o.fs || .28}" text-anchor="middle" style="fill:var(--wood-lab)" font-family="system-ui">${t}</text>`
    for (let i = x0; i <= x1; i++) {
      if (y0 == 0) s += lab(i, -.6, COLS[i])
      if (y1 == n - 1) s += lab(i, n - 1 + .6, COLS[i])
    }
    for (let i = y0; i <= y1; i++) {
      if (x0 == 0) s += lab(-.6, i, n - i)
      if (x1 == n - 1) s += lab(n - 1 + .6, i, n - i)
    }
  }
  const b = o.b
  const dead = o.dead || new Set()
  const stone = (x, y, c, op, cls) => `<circle cx="${x}" cy="${y}" r=".47" style="fill:url(#${id}${c == BLACK ? 'b' : 'w'})" opacity="${op}" filter="url(#${id}s)"${cls ? ` class="${cls}"` : ''}/>`
  if (b) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = (y + 1) * W + x + 1
      const c = b[p]
      if (c != BLACK && c != WHITE) continue
      s += stone(x, y, c, dead.has(p) ? .55 : 1, o.pop == p ? 'pop' : '')
    }
  }
  if (o.ghost != null && o.ghost >= 0) {
    const [gx, gy] = xy(n, o.ghost)
    s += stone(gx, gy, o.ghostC || BLACK, .45, 'ghost')
  }
  const sq = (x, y, c, op = 1) => `<rect x="${x - .13}" y="${y - .13}" width=".26" height=".26" rx=".05" style="fill:var(${c == BLACK ? '--sb' : '--sw-hi'});stroke:var(${c == BLACK ? '--sw-lo' : '--wood-line'})" stroke-width="${c == BLACK ? .03 : .02}" opacity="${op}"/>`
  if (o.terr) {
    for (let p = 0; p < o.terr.length; p++) {
      const c = o.terr[p]
      if (c != BLACK && c != WHITE) continue
      if (b[p] == c && !dead.has(p)) continue
      const [x, y] = xy(n, p)
      if (x < x0 || x > x1 || y < y0 || y > y1) continue
      s += sq(x, y, c)
    }
  }
  if (o.own) {
    for (let p = 0; p < o.own.length; p++) {
      const v = o.own[p]
      if (Math.abs(v) < .2 || b[p] == EDGE) continue
      const c = v > 0 ? BLACK : WHITE
      if (b[p] == c) continue
      const [x, y] = xy(n, p)
      s += sq(x, y, c, Math.max(.6, Math.min(1, Math.abs(v) * 1.1)))
    }
  }
  if (o.marks && !o.hideMarks) {
    for (const p of o.marks) {
      // снятый камень метку не оставляет
      if (b[p] != BLACK && b[p] != WHITE) continue
      const [x, y] = xy(n, p)
      const c = b[p] == BLACK ? '--sw-hi' : '--sb'
      s += `<path d="M${x} ${y - .2}L${x + .19} ${y + .13}H${x - .19}Z" fill="none" style="stroke:var(${c})" stroke-width=".06" stroke-linejoin="round"/>`
    }
  }
  if (o.hint != null && o.hint >= 0) {
    const [x, y] = xy(n, o.hint)
    s += `<circle cx="${x}" cy="${y}" r=".38" fill="none" style="stroke:var(--accent)" stroke-width=".07"/>`
  }
  if (o.last != null && o.last >= 0 && b && b[o.last]) {
    const [x, y] = xy(n, o.last)
    s += `<circle cx="${x}" cy="${y}" r=".15" style="fill:var(--last)"/>`
  }
  return s + '</svg>'
}

// живая доска: перерисовка и ввод; onTap(p) возвращает true, если ход принят
class BoardView {
  constructor(el, opts) {
    this.el = el
    this.o = opts
    this.hover = null
    this.pending = null
    this.touch = false
    el.addEventListener('pointermove', e => this.move(e))
    el.addEventListener('pointerleave', () => this.setHover(null))
    el.addEventListener('pointerdown', e => {
      this.touch = e.pointerType != 'mouse'
    })
    el.addEventListener('click', e => this.click(e))
    // с клавиатуры: стрелки ведут призрачный камень, Enter или пробел ставят
    el.tabIndex = 0
    el.setAttribute('role', 'application')
    el.addEventListener('keydown', e => this.key(e))
    el.addEventListener('blur', () => this.setHover(null))
  }
  key(e) {
    const n = this.o.n
    const [x0, y0, x1, y1] = this.o.crop || [0, 0, n - 1, n - 1]
    const d = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key]
    if (d) {
      e.preventDefault()
      let [x, y] = this.hover != null ? xy(n, this.hover) : [Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2)]
      x = Math.max(x0, Math.min(x1, x + d[0]))
      y = Math.max(y0, Math.min(y1, y + d[1]))
      this.hover = pt(n, x, y)
      this.draw()
      this.announce(COLS[x] + (n - y))
      return
    }
    if ((e.key == 'Enter' || e.key == ' ') && this.hover != null) {
      e.preventDefault()
      const p = this.hover
      if (this.o.onPick && this.o.onPick(p)) return
      if (this.o.canPlay && this.o.canPlay(p)) this.o.onTap(p)
    }
  }
  announce(s) {
    let live = document.getElementById('bvLive')
    if (!live) {
      live = document.createElement('div')
      live.id = 'bvLive'
      live.className = 'sr'
      live.setAttribute('aria-live', 'polite')
      document.body.appendChild(live)
    }
    live.textContent = s
  }
  pointAt(e) {
    const svg = this.el.querySelector('svg')
    if (!svg) return null
    const r = svg.getBoundingClientRect()
    const [L, T, Wd, Ht] = svg.dataset.vb.split(' ').map(Number)
    const x = Math.round(L + (e.clientX - r.left) / r.width * Wd)
    const y = Math.round(T + (e.clientY - r.top) / r.height * Ht)
    const n = this.o.n
    const [x0, y0, x1, y1] = this.o.crop || [0, 0, n - 1, n - 1]
    if (x < x0 || y < y0 || x > x1 || y > y1) return null
    return pt(n, x, y)
  }
  move(e) {
    if (e.pointerType != 'mouse') return
    const p = this.pointAt(e)
    this.setHover(p != null && this.o.canPlay && this.o.canPlay(p) ? p : null)
  }
  setHover(p) {
    if (p === this.hover) return
    this.hover = p
    this.draw()
  }
  click(e) {
    const p = this.pointAt(e)
    if (p == null) return
    if (this.o.onPick && this.o.onPick(p)) return
    if (!this.o.canPlay || !this.o.canPlay(p)) {
      this.pending = null
      this.draw()
      return
    }
    // на касании камень ставится вторым нажатием на тот же пункт
    if (this.touch && SES.settings.confirm && this.pending !== p) {
      this.pending = p
      this.draw()
      return
    }
    this.pending = null
    this.hover = null
    this.o.onTap(p)
  }
  set(o) {
    Object.assign(this.o, o)
    this.pending = null
    this.draw()
  }
  draw() {
    const o = this.o
    const ghost = this.pending != null ? this.pending : this.hover
    const w = this.el.clientWidth || 600
    const span = o.crop ? o.crop[2] - o.crop[0] + 1 : o.n
    const labels = o.labels && SES.settings.coords && w / (span + 2) >= 20
    // подписи около 12 px на любой доске: размер в единицах доски из пикселей на пункт
    const unit = w / (span + (labels ? 1.9 : 1.24))
    const fs = Math.max(.18, Math.min(.34, 12.5 / unit))
    // анимация камня только при первой отрисовке после хода, иначе наведение её повторяет
    const pop = o.pop
    o.pop = null
    this.el.innerHTML = goSVG({...o, pop, fs, ghost: ghost == null ? null : ghost, ghostC: o.turn, labels, last: SES.settings.lastMark ? o.last : null})
    this.el.setAttribute('aria-label', t('boardLabel', o.n))
    this.el.style.setProperty('--ar', o.crop ? ((o.crop[2] - o.crop[0] + 1.3) / (o.crop[3] - o.crop[1] + 1.3)).toFixed(3) : 1)
    this.el.style.setProperty('--span', span + 1.3)
  }
}

// стук камня без файлов: короткий шумовой щелчок
let AC = null
function clack() {
  if (!SES.settings.sound) return
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)()
    const len = AC.sampleRate * .05
    const buf = AC.createBuffer(1, len, AC.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6)
    const src = AC.createBufferSource()
    src.buffer = buf
    const f = AC.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 1900
    f.Q.value = 1.2
    const g = AC.createGain()
    g.gain.value = .7
    src.connect(f).connect(g).connect(AC.destination)
    src.start()
  } catch (e) {}
}
