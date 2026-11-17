/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
// хранилище: настройки, незаконченные партии, журнал партий и задач
'use strict'

const LS_SES = 'yoongo-ses', LS_LOG = 'yoongo-log'
const MAX_GAMES = 8

const SYS_LANG = (() => {
  try {
    const l = (navigator.languages || [navigator.language || 'en'])[0]
    return String(l).slice(0, 2).toLowerCase() == 'ru' ? 'ru' : 'en'
  } catch (e) {
    return 'en'
  }
})()

const DEF_NEW = {opp: 'bot', n: 9, goal: 'area', capN: 3, level: 1, color: 'b', hcap: 0, komi: null, clock: 0}
const DEF_SETTINGS = {theme: 'auto', lang: SYS_LANG, coords: true, lastMark: true, confirm: true, sound: false, komi: 7.5, undo: true, autoNext: false, ng: DEF_NEW}

let SES = {settings: {...DEF_SETTINGS}, games: [], solved: {}, seen: {}}
let LOG = []

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

let saveTimer = null
function writeSes() {
  clearTimeout(saveTimer)
  saveTimer = null
  try {
    localStorage.setItem(LS_SES, JSON.stringify(SES))
  } catch (e) {}
}
function saveSoon() {
  if (!saveTimer) saveTimer = setTimeout(writeSes, 400)
}
function saveLog() {
  try {
    localStorage.setItem(LS_LOG, JSON.stringify(LOG))
  } catch (e) {}
}

function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_SES))
    if (s && s.settings) {
      SES = {...SES, ...s}
      SES.settings = {...DEF_SETTINGS, ...s.settings}
      SES.settings.ng = {...DEF_NEW, ...(s.settings.ng || {})}
      if (!Array.isArray(SES.games)) SES.games = []
      SES.solved = SES.solved || {}
      SES.seen = SES.seen || {}
    }
  } catch (e) {}
  try {
    const l = JSON.parse(localStorage.getItem(LS_LOG))
    if (Array.isArray(l)) LOG = l
  } catch (e) {}
  SES.games = SES.games.filter(g => g && g.id && Array.isArray(g.moves))
}

// уровни бота и задач: слово и примерная сила; кю бота даны по 9 на 9
const BOT_KYU = [30, 25, 20, 15]
const PZ_KYU = [30, 25, 20, 15]

// оценка силы по журналу: партии с ботом и задачи с первой попытки
function rankEstimate(log = LOG) {
  const ests = []
  const byLv = [0, 1, 2, 3].map(() => ({w: 0, n: 0}))
  for (const e of log) {
    if (e.t != 'g' || e.opp != 'bot' || e.win == null || e.hcap || e.goal == 'cap') continue
    const k = byLv[e.level]
    k.n++
    if (e.win) k.w++
  }
  let bot = null
  for (let lv = 0; lv < 4; lv++) {
    const k = byLv[lv]
    if (k.n < 2) continue
    const r = k.w / k.n
    // ровная игра с уровнем значит его силу, каждые 10 процентов сверху минус кю
    const est = BOT_KYU[lv] - (r - .5) * 10
    if (bot == null || est < bot) bot = est
  }
  if (bot != null) ests.push(bot)
  const pz = [0, 1, 2, 3].map(() => ({ok: 0, n: 0}))
  for (const e of log) {
    if (e.t != 'p' || !pz[e.l]) continue
    pz[e.l].n++
    if (e.ok) pz[e.l].ok++
  }
  let pr = null
  for (let lv = 0; lv < 4; lv++) {
    const k = pz[lv]
    if (k.n < 5) continue
    const r = k.ok / k.n
    if (r >= .6) pr = PZ_KYU[lv] - (r - .6) * 10
  }
  if (pr != null) ests.push(pr)
  if (!ests.length) return null
  const v = ests.reduce((a, b) => a + b, 0) / ests.length
  return Math.max(1, Math.min(30, Math.round(v)))
}

function solvedCount(level) {
  let k = 0
  for (const p of PROBLEMS) if ((level == null || p.l == level) && SES.solved[p.id]) k++
  if (level == null) for (const p of CLASSICS) if (SES.solved[p.id]) k++
  return k
}
const totalProblems = () => PROBLEMS.length + CLASSICS.length

function botStats(level, n) {
  const s = {w: 0, n: 0}
  for (const e of LOG) {
    if (e.t != 'g' || e.opp != 'bot' || e.win == null) continue
    if (level != null && e.level != level) continue
    if (n && e.n != n) continue
    s.n++
    if (e.win) s.w++
  }
  return s
}
