// Unit check for stacked radar contributions: node tests/unit.mjs
import { readFileSync } from 'node:fs'
import { stackedContributions, stackedDV, axesFor, EAA, WHO_AXES, FOOD_COLS, MACRO_AXES, VIT_AXES, MIN_AXES } from '../src/nutrients.js'

const F = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url)))
const abs = (id, grams) => ({ ...Object.fromEntries(FOOD_COLS.map((k) => [k, ((F[id][k] || 0) * grams) / 100])), __grams: grams })
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
let fails = 0
const check = (c, m) => { if (!c) { fails++; console.log('FAIL', m) } }

const meals = {
  'green beans 150 g + chicken breast 120 g': [abs(169961, 150), abs(171477, 120)],
  'lentils 200 g + rice 150 g': [abs(172421, 200), abs(168878, 150)],
  'chicken 100 g alone': [abs(171477, 100)],
}
for (const [meal, list] of Object.entries(meals)) {
  const mass = list.reduce((s, a) => s + a.__grams, 0)
  const prot = list.reduce((s, a) => s + a.protein, 0)
  for (const mode of ['amount', 'per100', 'protein', 'who']) {
    const { layers, total } = stackedContributions(mode, list, 70)
    const axes = axesFor(mode)
    axes.forEach((ax, i) => {
      const parts = ax.parts || [ax.key]
      const g = list.reduce((s, a) => s + parts.reduce((t, p) => t + a[p], 0), 0) // total grams of this AA in meal
      const expected = { amount: g, per100: (g * 100) / mass, protein: (g * 1000) / prot, who: (g * 1000 * 100) / (ax.mgPerKg * 70) }[mode]
      const sum = layers.reduce((s, l) => s + l[i], 0)
      check(close(sum, total[i]), `${meal} ${mode} ${ax.short}: layers sum ${sum} != total ${total[i]}`)
      check(close(total[i], expected), `${meal} ${mode} ${ax.short}: total ${total[i]} != independent ${expected}`)
      layers.forEach((l, li) => check(l[i] >= 0 && l[i] <= total[i] + 1e-12, `${meal} ${mode} ${ax.short}: layer ${li} ${l[i]} outside [0, total ${total[i]}]`))
    })
    console.log(`ok  ${meal.padEnd(42)} ${mode.padEnd(8)} total ${axes.map((a, i) => `${a.short}=${total[i].toFixed(2)}`).join(' ')}`)
  }
}
// regression: in absolute modes the meal total is never below the largest single food
for (const mode of ['amount', 'who']) {
  const { total } = stackedContributions(mode, meals['green beans 150 g + chicken breast 120 g'], 70)
  const alone = stackedContributions(mode, [abs(171477, 120)], 70).total
  check(total.every((v, i) => v >= alone[i]), `${mode}: total below chicken alone`)
}
check(EAA.length === 9 && WHO_AXES.length === 9, '9 axes')

// ---- %DV charts (macros / vitamins / minerals) ----
const it = (id, grams) => ({ food: F[id], grams })
const dvMeals = {
  'green beans 150 g + chicken 120 g + grape tomatoes 80 g': [it(169961, 150), it(171477, 120), it(321360, 80)],
  'lentils 200 g + rice 150 g': [it(172421, 200), it(168878, 150)],
}
for (const [meal, list] of Object.entries(dvMeals)) {
  const mass = list.reduce((s, r) => s + r.grams, 0)
  for (const [cname, axes] of [['macro', MACRO_AXES], ['vit', VIT_AXES], ['min', MIN_AXES]]) {
    for (const mode of ['dv', 'per100']) {
      const r = stackedDV(axes, list, mode)
      axes.forEach((ax, i) => {
        const amt = list.reduce((s, x) => s + ((x.food[ax.key] ?? 0) * x.grams) / 100, 0) * (mode === 'per100' ? 100 / mass : 1)
        const expected = (amt / ax.dv) * 100
        const sum = r.layers.reduce((s, l) => s + l[i], 0)
        check(close(sum, r.total[i]), `${meal} ${cname}/${mode} ${ax.short}: layers ${sum} != total ${r.total[i]}`)
        check(close(r.total[i], expected), `${meal} ${cname}/${mode} ${ax.short}: total ${r.total[i]} != independent ${expected}`)
        check(close(r.amount[i], amt), `${meal} ${cname}/${mode} ${ax.short}: amount ${r.amount[i]} != ${amt}`)
        r.layers.forEach((l, li) => check(l[i] !== undefined && l[i] >= 0 && l[i] <= r.total[i] + 1e-12, `${meal} ${cname}/${mode} ${ax.short} layer ${li} out of range`))
        const nm = list.filter((x) => x.food[ax.key] == null).length
        check(r.nMissing[i] === nm && r.allMissing[i] === (nm === list.length), `${meal} ${cname} ${ax.short}: missing count`)
        r.missing.forEach((m, li) => check(m[i] === (list[li].food[ax.key] == null), `${meal} ${ax.short}: missing flag food ${li}`))
      })
      console.log(`ok  ${meal.slice(0, 42).padEnd(42)} ${(cname + '/' + mode).padEnd(12)} ${axes.map((a, i) => `${a.short}=${r.allMissing[i] ? 'n/a' : r.total[i].toFixed(1) + (r.nMissing[i] ? '*' : '')}`).join(' ')}`)
    }
  }
}
// missing vs zero: green beans vitamin D is a measured 0, grape tomato vitamin D is missing
{
  const i = VIT_AXES.findIndex((a) => a.key === 'vitd')
  const r = stackedDV(VIT_AXES, [it(169961, 100), it(321360, 100)], 'dv')
  check(F[169961].vitd === 0 && F[321360].vitd === null, 'fixture: beans vitD = 0, tomato vitD = null')
  check(r.missing[0][i] === false && r.layers[0][i] === 0, 'measured zero is not flagged as missing')
  check(r.missing[1][i] === true && r.nMissing[i] === 1 && !r.allMissing[i], 'null is flagged as missing (partial)')
  const r2 = stackedDV(VIT_AXES, [it(321360, 100)], 'dv')
  check(r2.allMissing[i] === true, 'single food with null -> allMissing')
}
// reference values spot-check (FDA DVs)
const dv = Object.fromEntries([...MACRO_AXES, ...VIT_AXES, ...MIN_AXES].map((a) => [a.key, a.dv]))
check(dv.vita === 900 && dv.vitc === 90 && dv.vitd === 20 && dv.vite === 15 && dv.vitk === 120 && dv.folate === 400 && dv.b12 === 2.4, 'FDA vitamin DVs')
check(dv.ca === 1300 && dv.fe === 18 && dv.k === 4700 && dv.na === 2300 && dv.cu === 0.9 && dv.se === 55 && dv.mn === 2.3, 'FDA mineral DVs')
check(dv.fat === 78 && dv.satfat === 20 && dv.carbs === 275 && dv.fiber === 28 && dv.protein === 50 && dv.sugars === 50, 'FDA macro DVs')
if (fails) { console.log(fails, 'FAILURES'); process.exit(1) }
console.log('UNIT OK')
