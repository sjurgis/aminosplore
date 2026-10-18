// Unit check for stacked radar contributions: node tests/unit.mjs
import { readFileSync } from 'node:fs'
import { stackedContributions, axesFor, EAA, WHO_AXES, FOOD_COLS } from '../src/nutrients.js'

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
if (fails) { console.log(fails, 'FAILURES'); process.exit(1) }
console.log('UNIT OK')
