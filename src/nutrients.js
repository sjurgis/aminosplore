// All food values in the DB are per 100 g edible portion: grams (kcal for energy).
export const MACROS = [
  { key: 'kcal', label: 'Energy', unit: 'kcal', digits: 0 },
  { key: 'protein', label: 'Protein', unit: 'g', digits: 1 },
  { key: 'fat', label: 'Fat', unit: 'g', digits: 1 },
  { key: 'carbs', label: 'Carbs', unit: 'g', digits: 1 },
  { key: 'fiber', label: 'Fiber', unit: 'g', digits: 1 },
  { key: 'sugars', label: 'Sugars', unit: 'g', digits: 1 },
  { key: 'water', label: 'Water', unit: 'g', digits: 0 },
]
export const FAT_DETAIL = [
  { key: 'satfat', label: 'Sat. fat', unit: 'g', digits: 1 },
  { key: 'mufa', label: 'Mono', unit: 'g', digits: 1 },
  { key: 'pufa', label: 'Poly', unit: 'g', digits: 1 },
]
export const AA_KEYS = ['trp', 'thr', 'ile', 'leu', 'lys', 'met', 'cys', 'phe', 'tyr', 'val', 'his']

// % Daily Value charts. DVs: U.S. FDA Daily Values for adults and children >= 4 y
// (21 CFR 101.9(c), 2016 Nutrition Facts rule), as listed at
// https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels
// Energy uses the 2,000 kcal reference diet. `limit: true` = DV is an amount not to exceed.
export const MACRO_AXES = [
  { key: 'kcal', label: 'Energy', short: 'Energy', unit: 'kcal', dv: 2000, note: '2,000 kcal reference diet' },
  { key: 'protein', label: 'Protein', short: 'Protein', unit: 'g', dv: 50 },
  { key: 'carbs', label: 'Carbohydrate', short: 'Carbs', unit: 'g', dv: 275 },
  { key: 'fiber', label: 'Dietary fiber', short: 'Fiber', unit: 'g', dv: 28 },
  { key: 'sugars', label: 'Sugars (total; vs added-sugars DV)', short: 'Sugars', unit: 'g', dv: 50, limit: true, note: 'USDA reports total sugars; the 50 g DV is for added sugars' },
  { key: 'fat', label: 'Total fat', short: 'Fat', unit: 'g', dv: 78 },
  { key: 'satfat', label: 'Saturated fat', short: 'Sat fat', unit: 'g', dv: 20, limit: true },
]
export const VIT_AXES = [
  { key: 'vita', label: 'Vitamin A (RAE)', short: 'A', unit: 'µg', dv: 900 },
  { key: 'vitc', label: 'Vitamin C', short: 'C', unit: 'mg', dv: 90 },
  { key: 'vitd', label: 'Vitamin D (D2 + D3)', short: 'D', unit: 'µg', dv: 20 },
  { key: 'vite', label: 'Vitamin E (α-tocopherol)', short: 'E', unit: 'mg', dv: 15 },
  { key: 'vitk', label: 'Vitamin K (phylloquinone)', short: 'K', unit: 'µg', dv: 120 },
  { key: 'b1', label: 'Thiamin (B1)', short: 'B1', unit: 'mg', dv: 1.2 },
  { key: 'b2', label: 'Riboflavin (B2)', short: 'B2', unit: 'mg', dv: 1.3 },
  { key: 'b3', label: 'Niacin (B3)', short: 'B3', unit: 'mg', dv: 16, note: 'USDA value is preformed niacin; the DV is in niacin equivalents' },
  { key: 'b6', label: 'Vitamin B6', short: 'B6', unit: 'mg', dv: 1.7 },
  { key: 'folate', label: 'Folate (DFE)', short: 'B9', unit: 'µg', dv: 400 },
  { key: 'b12', label: 'Vitamin B12', short: 'B12', unit: 'µg', dv: 2.4 },
]
export const MIN_AXES = [
  { key: 'ca', label: 'Calcium', short: 'Ca', unit: 'mg', dv: 1300 },
  { key: 'fe', label: 'Iron', short: 'Fe', unit: 'mg', dv: 18 },
  { key: 'mg', label: 'Magnesium', short: 'Mg', unit: 'mg', dv: 420 },
  { key: 'p', label: 'Phosphorus', short: 'P', unit: 'mg', dv: 1250 },
  { key: 'k', label: 'Potassium', short: 'K', unit: 'mg', dv: 4700 },
  { key: 'na', label: 'Sodium', short: 'Na', unit: 'mg', dv: 2300, limit: true },
  { key: 'zn', label: 'Zinc', short: 'Zn', unit: 'mg', dv: 11 },
  { key: 'cu', label: 'Copper', short: 'Cu', unit: 'mg', dv: 0.9 },
  { key: 'mn', label: 'Manganese', short: 'Mn', unit: 'mg', dv: 2.3 },
  { key: 'se', label: 'Selenium', short: 'Se', unit: 'µg', dv: 55 },
]
export const FOOD_COLS = [...new Set([...MACROS.map((m) => m.key), ...FAT_DETAIL.map((m) => m.key), ...AA_KEYS,
  ...MACRO_AXES.map((a) => a.key), ...VIT_AXES.map((a) => a.key), ...MIN_AXES.map((a) => a.key)])]

// The nine essential amino acids, individually (USDA nutrient numbers 501–512).
export const EAA = [
  { key: 'his', label: 'Histidine', short: 'His' },
  { key: 'ile', label: 'Isoleucine', short: 'Ile' },
  { key: 'leu', label: 'Leucine', short: 'Leu' },
  { key: 'lys', label: 'Lysine', short: 'Lys' },
  { key: 'met', label: 'Methionine', short: 'Met' },
  { key: 'phe', label: 'Phenylalanine', short: 'Phe' },
  { key: 'thr', label: 'Threonine', short: 'Thr' },
  { key: 'trp', label: 'Tryptophan', short: 'Trp' },
  { key: 'val', label: 'Valine', short: 'Val' },
]

// WHO/FAO/UNU (2007) Protein and amino acid requirements in human nutrition, WHO TRS 935.
// Adult (>18 y) requirement in mg/kg body weight/day and adult maintenance scoring pattern
// in mg/g protein (also FAO 2013 "Dietary protein quality evaluation", Table 3).
// Methionine and phenylalanine are assessed together with cysteine/tyrosine (SAA, AAA).
export const WHO_AXES = [
  { key: 'his', label: 'Histidine', short: 'His', parts: ['his'], mgPerKg: 10, mgPerGProtein: 15 },
  { key: 'ile', label: 'Isoleucine', short: 'Ile', parts: ['ile'], mgPerKg: 20, mgPerGProtein: 30 },
  { key: 'leu', label: 'Leucine', short: 'Leu', parts: ['leu'], mgPerKg: 39, mgPerGProtein: 59 },
  { key: 'lys', label: 'Lysine', short: 'Lys', parts: ['lys'], mgPerKg: 30, mgPerGProtein: 45 },
  { key: 'saa', label: 'Methionine + Cysteine', short: 'Met+Cys', parts: ['met', 'cys'], mgPerKg: 15, mgPerGProtein: 22 },
  { key: 'aaa', label: 'Phenylalanine + Tyrosine', short: 'Phe+Tyr', parts: ['phe', 'tyr'], mgPerKg: 25, mgPerGProtein: 38 },
  { key: 'thr', label: 'Threonine', short: 'Thr', parts: ['thr'], mgPerKg: 15, mgPerGProtein: 23 },
  { key: 'trp', label: 'Tryptophan', short: 'Trp', parts: ['trp'], mgPerKg: 4, mgPerGProtein: 6 },
  { key: 'val', label: 'Valine', short: 'Val', parts: ['val'], mgPerKg: 26, mgPerGProtein: 39 },
]

export const PALETTE = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444', '#84cc16', '#a855f7', '#f97316', '#14b8a6']

/** Sum nutrients (absolute amounts) over items [{food, grams}] -> totals in g (kcal). */
export function sumItems(items) {
  const t = Object.fromEntries(FOOD_COLS.map((k) => [k, 0]))
  const missing = Object.fromEntries(FOOD_COLS.map((k) => [k, 0]))
  let grams = 0
  for (const { food, grams: g } of items) {
    if (!food) continue
    grams += g
    for (const k of FOOD_COLS) {
      if (food[k] == null) missing[k]++
      else t[k] += (food[k] * g) / 100
    }
  }
  return { totals: t, missing, grams }
}

/** Amino acid score (AAS) vs WHO adult pattern: limiting amino acid ratio. */
export function aminoScore(abs) {
  if (!(abs.protein > 0)) return null
  let min = Infinity, lim = null
  for (const a of WHO_AXES) {
    const mg = a.parts.reduce((s, p) => s + (abs[p] || 0), 0) * 1000
    const r = mg / abs.protein / a.mgPerGProtein
    if (r < min) { min = r; lim = a }
  }
  return { score: min * 100, limiting: lim }
}

export function fmt(v, digits = 1) {
  if (v == null || Number.isNaN(v)) return '—'
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString()
  return v.toFixed(digits)
}

// ---------------------------------------------------------------------------
// Group-based stacking (a group = one band: a single food, or a whole meal).
// groups: [{ items: [{ food, grams }] }], food values per 100 g (null = no data).
// basis: 'amount' (the quantities eaten) | 'per100' (per 100 g of everything shown).
// Layers always sum exactly to the total, so the outer edge of the stack is the total.
// ---------------------------------------------------------------------------
const sumGrams = (groups) => groups.reduce((s, g) => s + g.items.reduce((t, it) => t + it.grams, 0), 0)

/** Amino acids on WHO axes (Met+Cys, Phe+Tyr). unit: 'g' | 'who' (% of WHO 2007 adult need for kg) | 'protein' (mg/g protein of everything shown). */
export function stackAA(groups, { basis = 'amount', unit = 'g', kg = 70 } = {}) {
  const mass = sumGrams(groups)
  const protein = groups.reduce((s, g) => s + g.items.reduce((t, it) => t + ((it.food.protein ?? 0) * it.grams) / 100, 0), 0)
  const f = unit !== 'protein' && basis === 'per100' ? (mass > 0 ? 100 / mass : 0) : 1
  const grams = groups.map((g) => WHO_AXES.map((a) => g.items.reduce((s, it) => s + (a.parts.reduce((t, p) => t + (it.food[p] ?? 0), 0) * it.grams) / 100, 0)))
  const layers = grams.map((l) => l.map((v, i) => {
    if (unit === 'protein') return protein > 0 ? (v * 1000) / protein : 0
    if (unit === 'who') return ((v * f * 1000) / (WHO_AXES[i].mgPerKg * kg)) * 100
    return v * f
  }))
  const total = WHO_AXES.map((_, i) => layers.reduce((s, l) => s + l[i], 0))
  return { layers, total, mass, protein }
}

/** WHO reference outline for the amino acid chart, or null where no reference applies. */
export function aaReference({ basis = 'amount', unit = 'g', kg = 70 } = {}) {
  if (unit === 'protein') return { name: 'WHO adult pattern (mg/g protein)', values: WHO_AXES.map((a) => a.mgPerGProtein) }
  if (basis !== 'amount') return null
  if (unit === 'who') return { name: '100% WHO daily need', values: WHO_AXES.map(() => 100) }
  return { name: `WHO daily need (${kg} kg)`, values: WHO_AXES.map((a) => (a.mgPerKg * kg) / 1000) }
}

/** % Daily Value. missing[gi][i]: '' (all items have data) | 'some' | 'all'. nMissing[i] counts foods without data. */
export function stackDV(axes, groups, { basis = 'amount' } = {}) {
  const mass = sumGrams(groups)
  const f = basis === 'per100' ? (mass > 0 ? 100 / mass : 0) : 1
  const amounts = groups.map((g) => axes.map((a) => g.items.reduce((s, it) => s + ((it.food[a.key] ?? 0) * it.grams) / 100, 0) * f))
  const layers = amounts.map((l) => l.map((v, i) => (v / axes[i].dv) * 100))
  const missing = groups.map((g) => axes.map((a) => {
    const n = g.items.filter((it) => it.food[a.key] == null).length
    return n === 0 ? '' : n === g.items.length ? 'all' : 'some'
  }))
  const nFoods = groups.reduce((s, g) => s + g.items.length, 0)
  const nMissing = axes.map((a) => groups.reduce((s, g) => s + g.items.filter((it) => it.food[a.key] == null).length, 0))
  return {
    layers,
    missing,
    total: axes.map((_, i) => layers.reduce((s, l) => s + l[i], 0)),
    amount: axes.map((_, i) => amounts.reduce((s, l) => s + l[i], 0)),
    nMissing,
    allMissing: nMissing.map((n) => nFoods > 0 && n === nFoods),
    mass,
  }
}
