// Unit checks: node tests/unit.mjs
import { readFileSync } from 'node:fs'
import { stackAA, aaReference, stackDV, WHO_AXES, MACRO_AXES, VIT_AXES, MIN_AXES } from '../src/nutrients.js'

globalThis.location = { hash: '' } // urlState default arg
const { parseHash, buildHash, MAX_PLAIN } = await import('../src/urlState.js')

const F = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url)))
const it = (id, grams) => ({ food: F[id], grams })
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
let fails = 0, n = 0
const check = (c, m) => { n++; if (!c) { fails++; console.log('FAIL', m) } }

// a day of meals; each meal is one band in the day view, each food one band in a meal view
const day = {
  Breakfast: [it(169961, 150), it(171477, 120)],
  Lunch: [it(172421, 200), it(168878, 150)],
  Snack: [it(321360, 80)], // grape tomatoes: no AA data, gaps in vitamins
}
const dayGroups = Object.values(day).map((items) => ({ items }))
const mealGroups = day.Breakfast.map((x) => ({ items: [x] }))
const flat = (groups) => groups.flatMap((g) => g.items)

for (const [label, groups] of [['day (bands = meals)', dayGroups], ['Breakfast (bands = foods)', mealGroups]]) {
  const aaGroups = groups.map((g) => ({ items: g.items.filter((x) => x.food.has_aa) })).filter((g) => g.items.length)
  const items = flat(aaGroups)
  const mass = items.reduce((s, x) => s + x.grams, 0), prot = items.reduce((s, x) => s + (x.food.protein * x.grams) / 100, 0)
  for (const basis of ['amount', 'per100']) for (const unit of ['g', 'who', 'protein']) {
    const r = stackAA(aaGroups, { basis, unit, kg: 70 })
    WHO_AXES.forEach((a, i) => {
      const g = items.reduce((s, x) => s + (a.parts.reduce((t, p) => t + (x.food[p] ?? 0), 0) * x.grams) / 100, 0)
      const f = unit !== 'protein' && basis === 'per100' ? 100 / mass : 1
      const exp = unit === 'g' ? g * f : unit === 'who' ? ((g * f * 1000) / (a.mgPerKg * 70)) * 100 : (g * 1000) / prot
      const sum = r.layers.reduce((s, l) => s + l[i], 0)
      check(close(sum, r.total[i]) && close(r.total[i], exp), `${label} AA ${basis}/${unit} ${a.short}: sum ${sum} total ${r.total[i]} expected ${exp}`)
      r.layers.forEach((l) => check(l[i] >= 0 && l[i] <= r.total[i] + 1e-12, `${label} AA ${basis}/${unit} ${a.short}: layer out of range`))
    })
    console.log(`ok  ${label.padEnd(26)} AA ${basis}/${unit}`.padEnd(52), WHO_AXES.map((a, i) => `${a.short}=${r.total[i].toFixed(2)}`).join(' '))
  }
  for (const [cname, axes] of [['macro', MACRO_AXES], ['vit', VIT_AXES], ['min', MIN_AXES]]) for (const basis of ['amount', 'per100']) {
    const r = stackDV(axes, groups, { basis })
    const items = flat(groups), mass = items.reduce((s, x) => s + x.grams, 0)
    axes.forEach((a, i) => {
      const amt = items.reduce((s, x) => s + ((x.food[a.key] ?? 0) * x.grams) / 100, 0) * (basis === 'per100' ? 100 / mass : 1)
      const sum = r.layers.reduce((s, l) => s + l[i], 0)
      check(close(sum, r.total[i]) && close(r.total[i], (amt / a.dv) * 100) && close(r.amount[i], amt), `${label} ${cname}/${basis} ${a.short}: sum/total/amount mismatch`)
      const nm = items.filter((x) => x.food[a.key] == null).length
      check(r.nMissing[i] === nm && r.allMissing[i] === (nm === items.length), `${label} ${cname} ${a.short}: missing count`)
      groups.forEach((g, gi) => {
        const k = g.items.filter((x) => x.food[a.key] == null).length
        check(r.missing[gi][i] === (k === 0 ? '' : k === g.items.length ? 'all' : 'some'), `${label} ${cname} ${a.short}: group ${gi} missing flag`)
      })
    })
    console.log(`ok  ${label.padEnd(26)} ${cname}/${basis}`.padEnd(52), axes.map((a, i) => `${a.short}=${r.allMissing[i] ? 'n/a' : r.total[i].toFixed(1) + (r.nMissing[i] ? '*' : '')}`).join(' '))
  }
}
// day total == sum of the meal views
{
  const d = stackDV(VIT_AXES, dayGroups, {}).total
  const parts = Object.values(day).map((items) => stackDV(VIT_AXES, items.map((x) => ({ items: [x] })), {}).total)
  check(d.every((v, i) => close(v, parts.reduce((s, p) => s + p[i], 0))), 'day %DV total = sum of meal totals')
}
// measured zero vs missing
{
  const i = VIT_AXES.findIndex((a) => a.key === 'vitd')
  const r = stackDV(VIT_AXES, [{ items: [it(169961, 100)] }, { items: [it(321360, 100)] }], {})
  check(F[169961].vitd === 0 && F[321360].vitd === null, 'fixture: beans vitD = 0, tomato vitD = null')
  check(r.missing[0][i] === '' && r.missing[1][i] === 'all' && r.nMissing[i] === 1 && !r.allMissing[i], 'zero is data, null is no data')
}
// references
check(aaReference({ unit: 'who' }).values.every((v) => v === 100), 'AA % need reference = 100')
check(aaReference({ unit: 'protein' }).values.join() === '15,30,59,45,22,38,23,6,39', 'WHO adult scoring pattern mg/g protein')
check(close(aaReference({ unit: 'g', kg: 70 }).values[2], 2.73), 'Leu need 39 mg/kg x 70 kg = 2.73 g')
check(aaReference({ unit: 'g', basis: 'per100' }) === null, 'no reference per 100 g in grams')
const dv = Object.fromEntries([...MACRO_AXES, ...VIT_AXES, ...MIN_AXES].map((a) => [a.key, a.dv]))
check(dv.vita === 900 && dv.vitc === 90 && dv.vitd === 20 && dv.vite === 15 && dv.vitk === 120 && dv.folate === 400 && dv.b12 === 2.4, 'FDA vitamin DVs')
check(dv.ca === 1300 && dv.fe === 18 && dv.k === 4700 && dv.na === 2300 && dv.cu === 0.9 && dv.se === 55 && dv.mn === 2.3, 'FDA mineral DVs')
check(dv.fat === 78 && dv.satfat === 20 && dv.carbs === 275 && dv.fiber === 28 && dv.protein === 50 && dv.sugars === 50, 'FDA macro DVs')

// ---- URL state ----
const st = {
  meals: [{ name: 'Breakfast', items: [{ id: 171287, grams: 100 }] }, { name: 'Lunch & stuff ~50%; a,b:c=+', items: [{ id: 172421, grams: 200 }, { id: 168878, grams: 150.5 }] }, { name: 'Empty', items: [] }],
  view: 1, basis: 'per100', aaUnit: 'who', weight: 82.5, showRef: false,
}
const h = buildHash(st)
const back = parseHash(h)
check(JSON.stringify(back.meals) === JSON.stringify(st.meals) && back.view === 1 && back.basis === 'per100' && back.aaUnit === 'who' && back.weight === 82.5 && back.showRef === false, `round trip ${h}`)
check(buildHash({ ...st, showRef: true }).indexOf('ref=') < 0 && parseHash(buildHash({ ...st, showRef: true })).showRef === true, 'ref default on, omitted from URL')
const big = { ...st, meals: Array.from({ length: 6 }, (_, i) => ({ name: `Meal ${i}`, items: Array.from({ length: 30 }, (_, j) => ({ id: 170000 + i * 100 + j, grams: 50 + j })) })) }
const hb = buildHash(big)
check(hb.startsWith('#z=') && hb.length < buildHash(big, { compress: false }).length && JSON.stringify(parseHash(hb).meals) === JSON.stringify(big.meals), `long state lz-compressed (${buildHash(big, { compress: false }).length} -> ${hb.length} chars) and restored`)
check(buildHash(st, { compress: false }).length < MAX_PLAIN && !h.startsWith('#z='), 'short state stays readable')
const legacy = parseHash('#f=172421:200,168878:150&r=Dal+%26+rice&m=who')
check(legacy.meals.length === 1 && legacy.meals[0].name === 'Dal & rice' && legacy.meals[0].items.length === 2 && legacy.aaUnit === 'who' && legacy.basis === 'amount', 'legacy #f=&r=&m=who migrates to one meal')
check(parseHash('#f=171477:150&c=vit&m=dv').chart === 'vit' && parseHash('#f=171477:150&c=vit&m=dv').basis === 'amount', 'legacy c= and m=dv accepted')
check(parseHash('#f=172421:200&m=per100').basis === 'per100' && parseHash('#f=172421:200').meals[0].name === 'Meal 1', 'legacy per100 / unnamed')
check(parseHash('#d=A~1:10;B~2:20&v=9').view === 1, 'out-of-range view clamps')

if (fails) { console.log(fails, 'FAILURES of', n); process.exit(1) }
console.log(`UNIT OK (${n} checks)`)
