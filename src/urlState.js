// URL hash state (hash, so GitHub Pages never sees it and links stay shareable):
//   #d=<Meal>~<fdcId>:<grams>,<fdcId>:<grams>;<Meal 2>~...   meals (names percent-encoded, space = '+')
//    &v=<day|0..n-1>   view: day total or a single meal (index)
//    &m=per100         basis (default: amounts eaten)
//    &a=who|protein    amino acid unit (default grams)
//    &w=<kg>           body weight for WHO needs (default 70)
//    &ref=0            hide the dotted daily-reference outline (default shown)
//    &c=aa|macro|vit|min   (legacy) chart to scroll to
// Long states are compressed into #z=<lz-string> (compressToEncodedURIComponent of the plain hash).
// Legacy links #f=<id>:<g>,...&r=<name>&m=amount|per100|protein|who|dv are migrated to one meal.
import LZString from 'lz-string'

export const MAX_PLAIN = 1500
const enc = (s) => encodeURIComponent(s).replace(/[~!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()).replace(/%20/g, '+')
const dec = (s) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')) } catch { return s } }
const num = (g) => String(Math.round(g * 10) / 10)

function parseItems(s) {
  return (s || '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
    const [id, g] = x.split(':')
    return { id: parseInt(id, 10), grams: g === undefined || g === '' ? 100 : Math.max(0, parseFloat(g)) }
  }).filter((x) => Number.isFinite(x.id) && x.id > 0 && Number.isFinite(x.grams))
}

function rawParams(hash) {
  const out = {}
  for (const part of hash.replace(/^#/, '').split('&')) {
    if (!part) continue
    const i = part.indexOf('=')
    const k = i < 0 ? part : part.slice(0, i)
    out[dec(k)] = i < 0 ? '' : part.slice(i + 1)
  }
  return out
}

export function parseHash(hash = location.hash) {
  let p = rawParams(hash)
  if (p.z) {
    const inner = LZString.decompressFromEncodedURIComponent(p.z)
    if (inner) p = { ...rawParams(inner), ...Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'z')) }
  }
  let meals = []
  if (p.d !== undefined) {
    meals = p.d.split(';').filter((s) => s !== '').map((s, i) => {
      const t = s.indexOf('~')
      const name = dec(t < 0 ? s : s.slice(0, t)).trim() || `Meal ${i + 1}`
      return { name, items: t < 0 ? [] : parseItems(s.slice(t + 1)) }
    })
  } else if (p.f !== undefined) {
    meals = [{ name: dec(p.r || '').trim() || 'Meal 1', items: parseItems(p.f) }] // legacy single recipe
  }
  let m = p.m || ''
  let a = p.a || ''
  if (m === 'protein' || m === 'who') { a = m; m = '' } // legacy amino modes
  if (m !== 'per100') m = 'amount'
  if (a !== 'who' && a !== 'protein') a = 'g'
  let view = 'day'
  if (p.v !== undefined && p.v !== 'day' && /^\d+$/.test(p.v)) view = Math.min(parseInt(p.v, 10), Math.max(0, meals.length - 1))
  if (p.v === undefined && p.f !== undefined && p.d === undefined) view = 'day'
  return {
    meals,
    view,
    basis: m,
    aaUnit: a,
    weight: parseFloat(p.w) > 0 ? parseFloat(p.w) : 70,
    showRef: p.ref !== '0',
    chart: ['aa', 'macro', 'vit', 'min'].includes(p.c) ? p.c : '',
  }
}

export function buildHash({ meals, view = 'day', basis = 'amount', aaUnit = 'g', weight = 70, showRef = true }, { compress = true } = {}) {
  const parts = []
  const nonEmpty = meals.some((m) => m.items.length) || meals.length > 1 || (meals[0] && meals[0].name !== 'Meal 1')
  if (meals.length && nonEmpty) parts.push('d=' + meals.map((m) => enc(m.name) + '~' + m.items.map((i) => `${i.id}:${num(i.grams)}`).join(',')).join(';'))
  if (view !== 'day' && meals.length > 1) parts.push('v=' + view)
  if (basis === 'per100') parts.push('m=per100')
  if (aaUnit !== 'g') parts.push('a=' + aaUnit)
  if (weight && weight !== 70) parts.push('w=' + num(weight))
  if (!showRef) parts.push('ref=0')
  const plain = parts.join('&')
  if (compress && plain.length > MAX_PLAIN) return '#z=' + LZString.compressToEncodedURIComponent(plain)
  return plain ? '#' + plain : ''
}
