import { createDbWorker } from 'sql.js-httpvfs'
import workerUrl from 'sql.js-httpvfs/dist/sqlite.worker.js?url'
import wasmUrl from 'sql.js-httpvfs/dist/sql-wasm.wasm?url'
import { FOOD_COLS } from './nutrients.js'

/* global __DB_HASH__ */
export const DB_HASH = __DB_HASH__
export const DB_URL = new URL(`foods.sqlite3?v=${DB_HASH}`, document.baseURI).href

let workerP = null
function worker() {
  if (!workerP) {
    workerP = createDbWorker(
      [{ from: 'inline', config: { serverMode: 'full', url: DB_URL, requestChunkSize: 4096 } }],
      new URL(workerUrl, document.baseURI).href,
      new URL(wasmUrl, document.baseURI).href,
    )
  }
  return workerP
}

async function rows(sql, params = []) {
  const w = await worker()
  const res = await w.db.exec(sql, params)
  if (!res.length) return []
  const { columns, values } = res[0]
  return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]])))
}

export async function stats() {
  const w = await worker()
  return w.worker.getStats()
}

let catsP = null
export function categories() {
  if (!catsP) catsP = rows('SELECT id, name FROM categories').then((r) => Object.fromEntries(r.map((c) => [c.id, c.name])))
  return catsP
}

export async function meta() {
  const r = await rows('SELECT key, value FROM meta')
  return Object.fromEntries(r.map((x) => [x.key, x.value]))
}

/** Full-text search. Tokens are prefix-matched; only alphanumerics are passed to FTS5. */
export async function search(q, { onlyAA = true, limit = 25 } = {}) {
  const toks = q.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/g)
  if (!toks || !toks.length) return []
  const terms = toks.map((t) => (t.length >= 2 ? `${t}*` : t)).join(' ')
  const match = `name:(${terms})${onlyAA ? ' AND flags:aa' : ''}`
  const r = await rows(
    'SELECT rowid AS id, name, cat, flags FROM foods_fts WHERE foods_fts MATCH ? ORDER BY rank LIMIT ?',
    [match, limit],
  )
  const cats = await categories()
  return r.map((x) => ({ id: x.id, name: x.name, category: cats[x.cat] || '', hasAA: x.flags === 'aa' }))
}

const cache = new Map()
export async function getFoods(ids) {
  const need = [...new Set(ids)].filter((id) => !cache.has(id))
  if (need.length) {
    const r = await rows(
      `SELECT id, name, cat, src, has_aa, ${FOOD_COLS.join(', ')} FROM foods WHERE id IN (${need.map(() => '?').join(',')})`,
      need,
    )
    const p = await rows(
      `SELECT fdc_id, label, grams FROM portions WHERE fdc_id IN (${need.map(() => '?').join(',')}) ORDER BY fdc_id, seq`,
      need,
    )
    const cats = await categories()
    for (const f of r) {
      f.category = cats[f.cat] || ''
      f.portions = p.filter((x) => x.fdc_id === f.id).map(({ label, grams }) => ({ label, grams }))
      cache.set(f.id, f)
    }
  }
  return Object.fromEntries(ids.filter((id) => cache.has(id)).map((id) => [id, cache.get(id)]))
}
