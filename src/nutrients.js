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
export const CHARTS = [
  { key: 'aa', label: 'Amino acids' },
  { key: 'macro', label: 'Macros', axes: MACRO_AXES },
  { key: 'vit', label: 'Vitamins', axes: VIT_AXES },
  { key: 'min', label: 'Minerals', axes: MIN_AXES },
]
export const DV_MODES = [
  { key: 'dv', label: '% Daily Value', hint: '% of the FDA Daily Value in the quantities you entered; each band is one food, the outer edge is the total' },
  { key: 'per100', label: 'Per 100 g', hint: '% Daily Value per 100 g of the whole meal; each band is that food\'s share, the outer edge is the mixture value' },
]
export const FOOD_COLS = [...new Set([...MACROS.map((m) => m.key), ...FAT_DETAIL.map((m) => m.key), ...AA_KEYS,
  ...MACRO_AXES.map((a) => a.key), ...VIT_AXES.map((a) => a.key), ...MIN_AXES.map((a) => a.key)])]

/**
 * Stacked %DV layers. items: [{ food (values per 100 g, null = no data), grams }].
 *   dv:     amount_i / DV * 100                       (sum = % DV of the whole meal)
 *   per100: amount_i * 100 / meal mass / DV * 100     (sum = % DV per 100 g of the whole meal)
 * Missing values (null) contribute 0 but are flagged: missing[li][i] = true.
 * Returns { layers, missing, total, amount (absolute total in axis unit), nMissing[i], allMissing[i] }.
 */
export function stackedDV(axes, items, mode) {
  const mass = items.reduce((s, r) => s + r.grams, 0)
  const missing = items.map((r) => axes.map((a) => r.food[a.key] == null))
  const absLayers = items.map((r) => axes.map((a) => ((r.food[a.key] ?? 0) * r.grams) / 100))
  const layers = absLayers.map((l) => l.map((v, i) => {
    const amt = mode === 'per100' ? (mass > 0 ? (v * 100) / mass : 0) : v
    return (amt / axes[i].dv) * 100
  }))
  const total = axes.map((_, i) => layers.reduce((s, l) => s + l[i], 0))
  const amount = axes.map((_, i) => absLayers.reduce((s, l) => s + l[i], 0) * (mode === 'per100' ? (mass > 0 ? 100 / mass : 0) : 1))
  const nMissing = axes.map((_, i) => missing.filter((m) => m[i]).length)
  const allMissing = nMissing.map((n) => items.length > 0 && n === items.length)
  return { layers, missing, total, amount, nMissing, allMissing }
}

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

export const MODES = [
  { key: 'amount', label: 'Amount', hint: 'Grams of each amino acid in the quantities you entered; each band is one food, the outer edge is the total' },
  { key: 'per100', label: 'Per 100 g', hint: 'Grams of amino acid per 100 g of the whole meal; each band is that food\'s share, the outer edge is the mixture value' },
  { key: 'protein', label: 'Per g protein', hint: 'mg of amino acid per g of protein of the whole meal; each band is that food\'s share, against the WHO/FAO/UNU 2007 adult scoring pattern (dashed)' },
  { key: 'who', label: '% daily need', hint: '% of the WHO/FAO/UNU 2007 adult daily requirement for your body weight; each band is one food, the outer edge is the total' },
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

/**
 * Chart values for one "series" of absolute amounts.
 * abs: { key: grams } of nutrients actually eaten, grams: total food mass.
 * Returns { axes, values, reference? } where values align with axes.
 */
export function series(mode, abs, grams, bodyKg) {
  if (mode === 'amount' || mode === 'per100') {
    const f = mode === 'per100' ? (grams > 0 ? 100 / grams : 0) : 1
    return EAA.map((a) => (abs[a.key] || 0) * f)
  }
  return WHO_AXES.map((a) => {
    const mg = a.parts.reduce((s, p) => s + (abs[p] || 0), 0) * 1000
    if (mode === 'protein') return abs.protein > 0 ? mg / abs.protein : 0
    return (mg / (a.mgPerKg * bodyKg)) * 100 // who
  })
}

/** Raw axis amounts (grams of each axis amino acid) for absolute nutrient amounts. */
function axisGrams(mode, abs) {
  if (mode === 'amount' || mode === 'per100') return EAA.map((a) => abs[a.key] || 0)
  return WHO_AXES.map((a) => a.parts.reduce((s, p) => s + (abs[p] || 0), 0))
}

/**
 * Stacked radar layers. absList: absolute amounts eaten per food (g; only foods with AA data).
 * Each layer is that food's contribution to the meal value, so layers sum exactly to the meal:
 *   amount:  g_i                         (sum = total grams of AA)
 *   per100:  g_i / meal mass * 100       (sum = g AA per 100 g of the whole meal)
 *   protein: mg_i / meal protein (g)     (sum = mg AA per g protein of the whole meal)
 *   who:     mg_i / (req mg/kg * kg)*100 (sum = % of daily requirement)
 * Returns { layers: number[][], total: number[] }.
 */
export function stackedContributions(mode, absList, bodyKg) {
  const mass = absList.reduce((s, a) => s + a.__grams, 0)
  const protein = absList.reduce((s, a) => s + (a.protein || 0), 0)
  const layers = absList.map((abs) => {
    const g = axisGrams(mode, abs)
    if (mode === 'amount') return g
    if (mode === 'per100') return g.map((v) => (mass > 0 ? (v * 100) / mass : 0))
    if (mode === 'protein') return g.map((v) => (protein > 0 ? (v * 1000) / protein : 0))
    return g.map((v, i) => ((v * 1000) / (WHO_AXES[i].mgPerKg * bodyKg)) * 100)
  })
  const n = axesFor(mode).length
  const total = Array.from({ length: n }, (_, i) => layers.reduce((s, l) => s + l[i], 0))
  return { layers, total }
}

export function axesFor(mode) {
  return mode === 'amount' || mode === 'per100' ? EAA : WHO_AXES
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
