<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import RadarChart from './components/RadarChart.vue'
import { search as dbSearch, getFoods, meta as dbMeta, stats as dbStats, DB_HASH } from './db.js'
import { parseHash, buildHash, defaultMode } from './urlState.js'
import { MACROS, FAT_DETAIL, CHARTS, DV_MODES, stackedDV, MODES, PALETTE, WHO_AXES, axesFor, stackedContributions, sumItems, aminoScore, fmt, FOOD_COLS } from './nutrients.js'

/* global __DB_SIZE__ */
const DB_SIZE = __DB_SIZE__

// ---------- state (mirrors the URL hash) ----------
const init = parseHash()
const items = ref(init.items) // [{ id, grams }]
const recipe = ref(init.recipe)
const chartType = ref(CHARTS.some((c) => c.key === init.chart) ? init.chart : 'aa')
const modesFor = (c) => (c === 'aa' ? MODES : DV_MODES)
const resolveMode = (c, m) => (modesFor(c).some((x) => x.key === m) ? m : m === 'per100' ? 'per100' : defaultMode(c))
const mode = ref(resolveMode(chartType.value, init.mode))
const modes = computed(() => modesFor(chartType.value))
watch(chartType, (c) => (mode.value = resolveMode(c, mode.value)))
const weight = ref(init.weight)

const foods = reactive({}) // id -> food row
const dbState = ref('loading')
const dbInfo = ref(null)
const netStats = ref(null)

async function loadFoods() {
  const ids = items.value.map((i) => i.id).filter((id) => !foods[id])
  if (!ids.length) return
  try {
    Object.assign(foods, await getFoods(ids))
    dbState.value = 'ready'
  } catch (e) {
    console.error(e)
    dbState.value = 'error'
  }
  refreshStats()
}
async function refreshStats() {
  try { netStats.value = await dbStats() } catch { /* ignore */ }
}

watch(items, loadFoods, { deep: true, immediate: true })

const hash = computed(() => buildHash({ items: items.value, recipe: recipe.value.trim(), chart: chartType.value, mode: mode.value, weight: weight.value }))
watch(hash, (h) => {
  if (h !== location.hash && !(h === '' && location.hash === '')) {
    history.replaceState(null, '', h || location.pathname + location.search)
  }
})
function onHashChange() {
  const s = parseHash()
  items.value = s.items
  recipe.value = s.recipe
  chartType.value = CHARTS.some((c) => c.key === s.chart) ? s.chart : 'aa'
  mode.value = resolveMode(chartType.value, s.mode)
  weight.value = s.weight
}

// ---------- search ----------
const query = ref('')
const onlyAA = ref(true)
const results = ref([])
const searching = ref(false)
const active = ref(0)
const open = ref(false)
let seq = 0, timer = null
watch([query, onlyAA], () => {
  clearTimeout(timer)
  const q = query.value.trim()
  if (q.length < 2) { results.value = []; return }
  timer = setTimeout(async () => {
    const my = ++seq
    searching.value = true
    try {
      const r = await dbSearch(q, { onlyAA: onlyAA.value })
      if (my === seq) { results.value = r; active.value = 0; open.value = true; dbState.value = 'ready' }
    } catch (e) {
      console.error(e)
      if (my === seq) dbState.value = 'error'
    } finally {
      if (my === seq) searching.value = false
      refreshStats()
    }
  }, 160)
})
const searchInput = ref(null)
function add(r) {
  const existing = items.value.find((i) => i.id === r.id)
  if (existing) existing.grams += 100
  else items.value.push({ id: r.id, grams: 100 })
  query.value = ''
  results.value = []
  open.value = false
  nextTick(() => searchInput.value?.focus())
}
function onKey(e) {
  if (!results.value.length) return
  if (e.key === 'ArrowDown') { active.value = (active.value + 1) % results.value.length; e.preventDefault() }
  else if (e.key === 'ArrowUp') { active.value = (active.value - 1 + results.value.length) % results.value.length; e.preventDefault() }
  else if (e.key === 'Enter') { add(results.value[active.value]); e.preventDefault() }
  else if (e.key === 'Escape') { open.value = false }
}
function onBlur() { setTimeout(() => (open.value = false), 150) }
function remove(idx) { items.value.splice(idx, 1) }
function clearAll() { items.value = []; recipe.value = '' }

// ---------- derived ----------
const colorOf = (idx) => PALETTE[idx % PALETTE.length]
const rows = computed(() => items.value.map((it, idx) => ({ ...it, idx, food: foods[it.id], color: colorOf(idx) })))
const loaded = computed(() => rows.value.filter((r) => r.food))
const withAA = computed(() => loaded.value.filter((r) => r.food.has_aa))
const withoutAA = computed(() => loaded.value.filter((r) => !r.food.has_aa))

const absOf = (r) => Object.fromEntries(FOOD_COLS.map((k) => [k, ((r.food[k] || 0) * r.grams) / 100]))
const totalAll = computed(() => sumItems(loaded.value))
const totalAA = computed(() => sumItems(withAA.value))

const axes = computed(() => axesFor(mode.value))
const unit = computed(() => ({ amount: 'g', per100: 'g per 100 g of meal', protein: 'mg per g protein of meal', who: '% of daily need' })[mode.value])
const chartFmt = computed(() => (mode.value === 'amount' || mode.value === 'per100'
  ? (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2))
  : (v) => v.toFixed(0)))

const chart = computed(() => {
  const kg = weight.value > 0 ? weight.value : 70
  const absList = withAA.value.map((r) => ({ ...absOf(r), __grams: r.grams }))
  const { layers, total } = stackedContributions(mode.value, absList, kg)
  const refs = []
  if (layers.length && mode.value === 'protein') refs.push({ name: 'WHO adult pattern', values: WHO_AXES.map((a) => a.mgPerGProtein) })
  if (layers.length && mode.value === 'who') refs.push({ name: '100% daily need', values: WHO_AXES.map(() => 100) })
  return {
    layers: withAA.value.map((r, i) => ({ name: shortName(r.food.name), color: r.color, values: layers[i] })),
    total,
    refs,
    totalName: recipe.value.trim() || (mode.value === 'per100' || mode.value === 'protein' ? 'Whole meal' : 'Total'),
  }
})
const pctFmt = (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1))
const amtFmt = (v) => (v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3))
const dvChart = computed(() => {
  const c = CHARTS.find((x) => x.key === chartType.value)
  const list = loaded.value
  const r = stackedDV(c.axes, list, mode.value)
  return {
    axes: c.axes,
    layers: list.map((x, i) => ({ name: shortName(x.food.name), color: x.color, values: r.layers[i], missing: r.missing[i] })),
    total: r.total, amount: r.amount, nMissing: r.nMissing, allMissing: r.allMissing,
    refs: list.length && mode.value === 'dv' ? [{ name: '100% Daily Value', values: c.axes.map(() => 100) }] : [],
    totalName: recipe.value.trim() || (mode.value === 'per100' ? 'Whole meal' : 'Total'),
  }
})
const isAA = computed(() => chartType.value === 'aa')
const view = computed(() => (isAA.value
  ? { ...chart.value, axes: axes.value, unit: unit.value, fmt: chartFmt.value, minMax: mode.value === 'who' ? 100 : 0, cap: 0, noData: [], partial: [] }
  : { ...dvChart.value, unit: mode.value === 'per100' ? '% Daily Value per 100 g of meal' : '% Daily Value', fmt: pctFmt, minMax: mode.value === 'dv' ? 100 : 0, cap: 300, noData: dvChart.value.allMissing, partial: dvChart.value.nMissing }))
const hasLimit = computed(() => !isAA.value && view.value.axes.some((a) => a.limit))
const axisNotes = computed(() => (isAA.value ? [] : view.value.axes.filter((a) => a.note)))

const scores = computed(() => {
  const s = withAA.value.map((r) => ({ name: r.food.name, color: r.color, ...aminoScore(r.food) }))
  if (withAA.value.length > 1) s.push({ name: recipe.value.trim() || 'Combined', color: 'var(--total)', total: true, ...aminoScore(totalAA.value.totals) })
  return s.filter((x) => x.limiting)
})

const energySplit = computed(() => {
  const t = totalAll.value.totals
  const p = t.protein * 4, c = t.carbs * 4, f = t.fat * 9
  const sum = p + c + f
  if (!sum) return null
  return [
    { k: 'Protein', v: (p / sum) * 100, cls: 'p' },
    { k: 'Carbs', v: (c / sum) * 100, cls: 'c' },
    { k: 'Fat', v: (f / sum) * 100, cls: 'f' },
  ]
})

function shortName(n) { return n.length > 38 ? n.slice(0, 36) + '…' : n }
const fdcLink = (id) => `https://fdc.nal.usda.gov/food-details/${id}/nutrients`

// ---------- share & saved recipes ----------
const copied = ref(false)
async function copyLink() {
  try { await navigator.clipboard.writeText(location.href) } catch { prompt('Copy this link', location.href) }
  copied.value = true
  setTimeout(() => (copied.value = false), 1600)
}
const saved = ref(JSON.parse(localStorage.getItem('aminosplore.recipes') || '[]'))
function saveRecipe() {
  const name = recipe.value.trim() || 'Untitled recipe'
  recipe.value = name
  const h = buildHash({ items: items.value, recipe: name, mode: 'amount', weight: 70 })
  saved.value = [{ name, hash: h }, ...saved.value.filter((s) => s.name !== name)].slice(0, 30)
  localStorage.setItem('aminosplore.recipes', JSON.stringify(saved.value))
}
function deleteSaved(i) {
  saved.value.splice(i, 1)
  localStorage.setItem('aminosplore.recipes', JSON.stringify(saved.value))
}
const examples = [
  { name: 'Rice & black beans', hash: '#f=168878:180,173735:130&r=Rice+%26+black+beans' },
  { name: 'Lentil dal with rice', hash: '#f=172421:200,168878:150&r=Lentil+dal+with+rice' },
  { name: 'Egg vs tofu', hash: '#f=171287:100,172475:100&m=per100' },
  { name: 'Chicken breast', hash: '#f=171477:150&m=who' },
]

// ---------- theme ----------
const theme = ref(localStorage.getItem('aminosplore.theme') || 'auto')
watch(theme, (t) => {
  localStorage.setItem('aminosplore.theme', t)
  if (t === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
}, { immediate: true })
const cycleTheme = () => (theme.value = { auto: 'light', light: 'dark', dark: 'auto' }[theme.value])

onMounted(async () => {
  window.addEventListener('hashchange', onHashChange)
  try { dbInfo.value = await dbMeta(); dbState.value = 'ready' } catch (e) { console.error(e); dbState.value = 'error' }
  refreshStats()
})
onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange))
const kb = (b) => (b / 1024).toFixed(b < 10240 ? 1 : 0) + ' KB'
</script>

<template>
  <header class="top">
    <div class="brand">
      <svg viewBox="0 0 100 100" width="28" height="28" aria-hidden="true"><polygon points="50,6 92,36 76,88 24,88 8,36" fill="var(--accent)" fill-opacity=".9" /><polygon points="50,30 70,44 62,68 38,68 30,44" fill="var(--bg)" fill-opacity=".85" /></svg>
      <div>
        <h1>Aminosplore</h1>
        <p class="tag">Essential amino acids &amp; macros of foods and recipes</p>
      </div>
    </div>
    <div class="top-actions">
      <button class="ghost" @click="cycleTheme" :title="`Theme: ${theme}`" data-testid="theme">{{ theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐' }} <span class="hide-sm">{{ theme }}</span></button>
    </div>
  </header>

  <main class="layout">
    <section class="col-left">
      <div class="card search-card o-search">
        <label class="search" :class="{ busy: searching }">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.3-2.2L21 21" /></svg>
          <input
            ref="searchInput"
            v-model="query"
            type="search"
            placeholder="Search 8,000+ USDA foods… e.g. lentils cooked"
            autocomplete="off"
            aria-label="Search foods"
            data-testid="search"
            @keydown="onKey"
            @focus="open = true"
            @blur="onBlur"
          />
        </label>
        <label class="check"><input type="checkbox" v-model="onlyAA" /> Only foods with amino acid data</label>
        <ul v-if="open && results.length" class="results" role="listbox" data-testid="results">
          <li
            v-for="(r, i) in results"
            :key="r.id"
            role="option"
            :aria-selected="i === active"
            :class="{ active: i === active }"
            @mousedown.prevent="add(r)"
            @mouseenter="active = i"
          >
            <span class="r-name">{{ r.name }}</span>
            <span class="r-meta">{{ r.category }}<span v-if="!r.hasAA" class="pill warn">no AA data</span></span>
          </li>
        </ul>
        <p v-else-if="query.trim().length >= 2 && !searching && open" class="muted small">No matches.</p>
      </div>

      <div class="card o-items">
        <div class="card-head">
          <input class="recipe-name" v-model="recipe" placeholder="Name this recipe (optional)" aria-label="Recipe name" data-testid="recipe-name" />
        </div>
        <ul v-if="rows.length" class="items" data-testid="items">
          <li v-for="r in rows" :key="r.id" class="item">
            <span class="dot" :style="{ background: r.food?.has_aa ? r.color : 'transparent', borderColor: r.color }"></span>
            <div class="item-main">
              <a v-if="r.food" :href="fdcLink(r.id)" target="_blank" rel="noopener" class="item-name">{{ r.food.name }}</a>
              <span v-else class="item-name muted">Loading #{{ r.id }}…</span>
              <span class="item-meta" v-if="r.food">
                {{ r.food.category }}
                <span v-if="!r.food.has_aa" class="pill warn" title="USDA has no full amino acid profile for this food; it counts toward macros only">macros only</span>
              </span>
            </div>
            <div class="qty">
              <input type="number" min="0" step="5" v-model.number="items[r.idx].grams" :aria-label="`Grams of ${r.food?.name || r.id}`" data-testid="grams" />
              <span class="unit">g</span>
              <select v-if="r.food?.portions?.length" @change="(e) => { if (e.target.value) { items[r.idx].grams = +e.target.value; e.target.value = '' } }" aria-label="Portion size">
                <option value="">portion…</option>
                <option v-for="p in r.food.portions" :key="p.label" :value="p.grams">{{ p.label }} ({{ fmt(p.grams, 0) }} g)</option>
              </select>
            </div>
            <button class="icon" @click="remove(r.idx)" :aria-label="`Remove ${r.food?.name || r.id}`">✕</button>
          </li>
        </ul>
        <div v-else class="empty">
          <p>Search for a food above, or try one of these:</p>
          <div class="chips">
            <a v-for="e in examples" :key="e.name" :href="e.hash" class="chip">{{ e.name }}</a>
          </div>
        </div>
        <div class="row-actions" v-if="rows.length">
          <span class="muted small">{{ fmt(totalAll.grams, 0) }} g total</span>
          <span class="spacer"></span>
          <button class="ghost" @click="clearAll">Clear</button>
          <button class="ghost" @click="saveRecipe" data-testid="save">Save</button>
          <button class="primary" @click="copyLink" data-testid="share">{{ copied ? 'Link copied ✓' : 'Copy link' }}</button>
        </div>
        <div v-if="saved.length" class="saved">
          <h3>My recipes <span class="muted small">(this browser)</span></h3>
          <div class="chips">
            <span v-for="(s, i) in saved" :key="s.name" class="chip">
              <a :href="s.hash">{{ s.name }}</a><button class="x" @click="deleteSaved(i)" :aria-label="`Delete ${s.name}`">✕</button>
            </span>
          </div>
        </div>
      </div>

      <div class="card o-macros" v-if="loaded.length">
        <h2>Macros</h2>
        <div class="table-wrap">
          <table class="macros" data-testid="macros">
            <thead>
              <tr><th>Food</th><th>g</th><th v-for="m in [...MACROS, ...FAT_DETAIL]" :key="m.key">{{ m.label }}<small>{{ m.unit }}</small></th></tr>
            </thead>
            <tbody>
              <tr v-for="r in loaded" :key="r.id">
                <td class="fname"><span class="dot sm" :style="{ background: r.color }"></span>{{ shortName(r.food.name) }}</td>
                <td>{{ fmt(r.grams, 0) }}</td>
                <td v-for="m in [...MACROS, ...FAT_DETAIL]" :key="m.key"><span v-if="r.food[m.key] == null" class="nd" title="no data">n/a</span><template v-else>{{ fmt((r.food[m.key] * r.grams) / 100, m.digits) }}</template></td>
              </tr>
            </tbody>
            <tfoot v-if="loaded.length > 1">
              <tr><td>Total</td><td>{{ fmt(totalAll.grams, 0) }}</td><td v-for="m in [...MACROS, ...FAT_DETAIL]" :key="m.key">{{ fmt(totalAll.totals[m.key], m.digits) }}<sup v-if="totalAll.missing[m.key]" title="Some foods have no value for this nutrient">*</sup></td></tr>
            </tfoot>
          </table>
        </div>
        <div v-if="energySplit" class="split" aria-label="Energy from macronutrients">
          <div v-for="s in energySplit" :key="s.k" :class="['seg', s.cls]" :style="{ width: s.v + '%' }" :title="`${s.k} ${s.v.toFixed(0)}% of energy`"></div>
        </div>
        <div v-if="energySplit" class="split-legend small">
          <span v-for="s in energySplit" :key="s.k"><i :class="s.cls"></i>{{ s.k }} {{ s.v.toFixed(0) }}%</span>
          <span class="muted">of energy (4/4/9 kcal per g)</span>
        </div>
      </div>
    </section>

    <section class="col-right">
      <div class="card chart-card o-chart">
        <div class="card-head wrap">
          <h2>{{ recipe.trim() || (isAA ? 'Essential amino acids' : CHARTS.find((c) => c.key === chartType).label) }}</h2>
          <div class="seg-ctl" role="tablist" data-testid="modes">
            <button v-for="m in modes" :key="m.key" role="tab" :aria-selected="mode === m.key" :class="{ on: mode === m.key }" :title="m.hint" @click="mode = m.key">{{ m.label }}</button>
          </div>
        </div>
        <div class="chart-tabs" role="tablist" aria-label="Chart" data-testid="charts">
          <button v-for="c in CHARTS" :key="c.key" role="tab" :aria-selected="chartType === c.key" :class="{ on: chartType === c.key }" @click="chartType = c.key">{{ c.label }}</button>
        </div>
        <p class="muted small hint">{{ (modes.find((m) => m.key === mode) || modes[0]).hint }}.</p>
        <div class="chart-opts" v-if="isAA && withAA.length && mode === 'who'">
          <label class="check" v-if="mode === 'who'">Body weight <input class="kg" type="number" min="10" max="250" v-model.number="weight" /> kg</label>
        </div>
        <RadarChart v-if="view.layers.length" :axes="view.axes" :layers="view.layers" :refs="view.refs" :total-name="view.totalName" :unit="view.unit" :format="view.fmt" :min-max="view.minMax" :cap="view.cap" :no-data="view.noData" :partial="view.partial" />
        <div v-else class="chart-empty">
          <svg viewBox="0 0 200 200" width="180" aria-hidden="true"><polygon points="100,15 180,70 150,170 50,170 20,70" fill="none" stroke="var(--line)" stroke-width="2" /><polygon points="100,55 140,80 125,135 70,140 55,85" fill="var(--accent)" fill-opacity=".18" stroke="var(--accent)" stroke-width="2" /></svg>
          <p class="muted">{{ dbState === 'error' ? 'Could not load the food database.' : loaded.length ? 'None of these foods has a full amino acid profile in USDA data.' : 'Add foods to see their nutrient profile.' }}</p>
        </div>
        <p v-if="isAA && withoutAA.length && withAA.length" class="muted small">{{ withoutAA.length }} food{{ withoutAA.length > 1 ? 's' : '' }} without amino acid data excluded from the chart.</p>

        <div v-if="isAA && chart.layers.length" class="table-wrap">
          <table class="aa-table" data-testid="aa-table">
            <thead><tr>
              <th></th>
              <th v-for="(l, li) in chart.layers" :key="li"><span class="dot sm" :style="{ background: l.color, borderColor: l.color }"></span>{{ l.name }}</th>
              <th v-if="chart.layers.length > 1" class="tot">{{ chart.totalName }}</th>
              <th v-for="r in chart.refs" :key="r.name">{{ r.name }}</th>
            </tr></thead>
            <tbody>
              <tr v-for="(a, i) in axes" :key="a.key">
                <td :title="a.label">{{ a.label }}</td>
                <td v-for="(l, li) in chart.layers" :key="li">{{ chartFmt(l.values[i]) }}</td>
                <td v-if="chart.layers.length > 1" class="tot" data-testid="aa-total">{{ chartFmt(chart.total[i]) }}</td>
                <td v-for="r in chart.refs" :key="r.name" class="muted">{{ chartFmt(r.values[i]) }}</td>
              </tr>
            </tbody>
          </table>
          <p class="muted small">Unit: {{ unit }}<template v-if="chart.layers.length > 1"> · food columns are each food's contribution and add up to “{{ chart.totalName }}”<template v-if="mode === 'per100' || mode === 'protein'">, the value {{ mode === 'per100' ? 'per 100 g' : 'per g protein' }} of the whole meal ({{ fmt(totalAA.grams, 0) }} g, {{ fmt(totalAA.totals.protein, 1) }} g protein)</template></template></p>
        </div>

        <div v-if="!isAA && view.layers.length" class="table-wrap">
          <table class="aa-table dv-table" data-testid="aa-table">
            <thead><tr>
              <th></th>
              <th class="tot">{{ view.layers.length > 1 ? view.totalName : '% DV' }}</th>
              <th>Amount</th>
              <th>DV</th>
              <th v-for="(l, li) in view.layers" :key="li" class="fcol" :title="l.name"><span class="dot sm" :style="{ background: l.color, borderColor: l.color }"></span>{{ l.name }}</th>
            </tr></thead>
            <tbody>
              <tr v-for="(a, i) in view.axes" :key="a.key">
                <td :title="a.note || a.label">{{ a.label }}<span v-if="a.limit" title="Daily Value is an upper limit">†</span></td>
                <td class="tot" data-testid="aa-total"><span v-if="view.allMissing[i]" class="nd">no data</span><template v-else>{{ pctFmt(view.total[i]) }}<sup v-if="view.nMissing[i]" :title="`${view.nMissing[i]} food(s) have no data; total is a lower bound`">*</sup></template></td>
                <td class="amt"><span v-if="view.allMissing[i]" class="nd">—</span><template v-else>{{ amtFmt(view.amount[i]) }} {{ a.unit }}</template></td>
                <td class="amt">{{ a.dv.toLocaleString() }} {{ a.unit }}</td>
                <td v-for="(l, li) in view.layers" :key="li" class="fcol"><span v-if="l.missing[i]" class="nd" title="USDA has no value for this food">no data</span><template v-else>{{ pctFmt(l.values[i]) }}</template></td>
              </tr>
            </tbody>
          </table>
          <p class="muted small">
            Unit: {{ view.unit }}; food columns are each food's share of the total<template v-if="mode === 'per100'"> (meal: {{ fmt(totalAll.grams, 0) }} g)</template>.
            “no data” = USDA has no value for that food (not zero); <sup>*</sup> = total is a lower bound because some foods have no data.
            <template v-if="hasLimit"> † = Daily Value is a maximum, not a target.</template>
            <template v-for="a in axisNotes" :key="a.key"> {{ a.label }}: {{ a.note }}.</template>
            Daily Values: U.S. FDA (21 CFR 101.9).
          </p>
        </div>

        <div v-if="isAA && scores.length" class="scores">
          <h3>Amino acid score <span class="muted small">vs WHO/FAO/UNU 2007 adult pattern</span></h3>
          <ul>
            <li v-for="s in scores" :key="s.name" :class="{ total: s.total }">
              <span class="dot sm" :style="{ background: s.color }"></span>
              <span class="s-name">{{ s.name }}</span>
              <span class="bar"><span :style="{ width: Math.min(100, s.score) + '%', background: s.color }"></span></span>
              <b>{{ Math.min(999, s.score).toFixed(0) }}</b>
              <span class="muted small">{{ s.score < 100 ? `limited by ${s.limiting.short}` : 'complete' }}</span>
            </li>
          </ul>
          <p class="muted small">Score = lowest ratio of (mg amino acid / g protein) to the reference pattern. Not adjusted for digestibility (not PDCAAS/DIAAS).</p>
        </div>
      </div>
    </section>
  </main>

  <footer class="foot">
    <p>
      Data: <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener">USDA FoodData Central</a> (public domain) —
      {{ dbInfo?.source?.replace(/^.*?:\s*/, '') || 'SR Legacy 2018-04; Foundation Foods 2026-04-30' }}.
      Values per 100 g edible portion.
      Daily Values: U.S. FDA <a href="https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels" target="_blank" rel="noopener">Daily Value reference guide</a> (21 CFR 101.9, adults &amp; children ≥4 y; 2,000 kcal reference diet).
      Amino acid requirements: WHO/FAO/UNU (2007) <a href="https://iris.who.int/handle/10665/43411" target="_blank" rel="noopener"><i>Protein and amino acid requirements in human nutrition</i></a>, WHO TRS 935 (adult).
      Not medical advice.
    </p>
    <p class="muted small" data-testid="dbstats">
      Database {{ kb(DB_SIZE) }} · build {{ DB_HASH }}
      <template v-if="netStats"> · fetched {{ kb(netStats.totalFetchedBytes) }} in {{ netStats.totalRequests }} range requests</template>
      · <a href="https://github.com/sjurgis/aminosplore" target="_blank" rel="noopener">source</a>
    </p>
  </footer>
</template>
