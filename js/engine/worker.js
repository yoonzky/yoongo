/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
// воркер: бот и решатель не держат окно
importScripts('rules.js', 'bot.js', 'ld.js', 'api.js', '../../data/problems.js')
onmessage = e => {
  const {id, cmd, a} = e.data
  let r
  try {
    r = engineCall(cmd, a)
  } catch (err) {
    r = {error: String(err && err.message || err)}
  }
  postMessage({id, r})
}
