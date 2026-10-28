// 只缓存展示快照，打开后仍请求最新共享数据，写入继续使用版本检查。
export function readSnapshot(key,validate,storage) {
  try { storage ??= globalThis.localStorage; const item = JSON.parse(storage?.getItem(key) || 'null'); return item && Date.now()-item.time < 7*86400000 ? validate(item.data) : null; } catch { return null; }
}
export function writeSnapshot(key,data,storage) {
  try { storage ??= globalThis.localStorage; storage?.setItem(key,JSON.stringify({time:Date.now(),data})); } catch { /* 缓存不可用时继续正常联网。 */ }
}
