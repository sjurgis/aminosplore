<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import ChartCard from './components/ChartCard.vue'
import FoodSearch from './components/FoodSearch.vue'
import { getFoods, meta as dbMeta, stats as dbStats, DB_HASH } from './db.js'
import { parseHash, buildHash } from './urlState.js'
import {
  MACROS, FAT_DETAIL, PALETTE, WHO_AXES, MACRO_AXES, VIT_AXES, MIN_AXES,
  stackAA, aaReference, stackDV, sumItems, aminoScore, fmt,
} from './nutrients.js'

/* global __DB_SIZE__ */
const DB_SIZE = __DB_SIZE__
const MEAL_PALETTE = ['#f59e0b', '#6366f1', '#10b981', '#ec4899', '#06b6d4', '#ef4444', '#84cc16', '#a855f7']
const MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

// ---------- state (mirrors the URL hash) ----------
const init = parseHash()
const meals = ref(init.meals.length ? init.meals : [{ name: 'Meal 1', items: [] }])
const view = ref(init.view) // 'day' | meal index
const basis = ref(init.basis) // 'amount' | 'per100'
const aaUnit = ref(init.aaUnit) // 'g' | 'who' | 'protein'
const weight = ref(init.weight)
const showRef = ref(init.showRef)
const legacyChart = init.chart

const foods = reactive({})
const dbState = ref('loading')
const dbInfo = ref(null)
const netStats = ref(null)

const allIds = computed(() => meals.value.flatMap((m) => m.items.map((i) => i.id)))
async function loadFoods() {
  const ids = allIds.value.filter((id) => !foods[id])
  if (!ids.length) return
  try { Object.assign(foods, await getFoods(ids)); dbState.value = 'ready' } catch (e) { console.error(e); dbState.value = 'error' }
  refreshStats()
}
async function refreshStats() { try { netStats.value = await dbStats() } catch { /* ignore */ } }
watch(allIds, loadFoods, { immediate: true })

const state = () => ({ meals: meals.value.map((m) => ({ name: m.name.trim() || 'Meal', items: m.items })), view: view.value, basis: basis.value, aaUnit: aaUnit.value, weight: weight.value, showRef: showRef.value })
const hash = computed(() => buildHash(state()))
watch(hash, (h) => {
  if (h !== location.hash && !(h === '' && location.hash === '')) history.replaceState(null, '', h || location.pathname + location.search)
}, { immediate: true }) // immediate: normalise legacy / long links on load
function onHashChange() {
  const s = parseHash()
  meals.value = s.meals.length ? s.meals : [{ name: 'Meal 1', items: [] }]
  view.value = s.view; basis.value = s.basis; aaUnit.value = s.aaUnit; weight.value = s.weight; showRef.value = s.showRef
  if (s.chart) scrollToChart(s.chart)
}
watch(() => meals.value.length, (n) => {
  if (typeof view.value === 'number' && view.value >= n) view.value = 'day'
  if (n === 1 && typeof view.value === 'number') view.value = 'day'
})

// ---------- meals ----------
function addMeal() {
  const used = new Set(meals.value.map((m) => m.name))
  const name = MEAL_NAMES.find((n) => !used.has(n)) || `Meal ${meals.value.length + 1}`
  meals.value.push({ name, items: [] })
  const mi = meals.value.length - 1
  nextTick(() => mealSearch[mi]?.focus())
}
function removeMeal(mi) {
  if (meals.value.length === 1) { meals.value[0].items = []; return }
  meals.value.splice(mi, 1)
  if (typeof view.value === 'number') view.value = view.value === mi ? 'day' : view.value > mi ? view.value - 1 : view.value
}
function moveItem(mi, ii, to) {
  const [it] = meals.value[mi].items.splice(ii, 1)
  const dest = meals.value[to]
  const ex = dest.items.find((x) => x.id === it.id)
  if (ex) ex.grams += it.grams
  else dest.items.push(it)
}
function removeItem(mi, ii) { meals.value[mi].items.splice(ii, 1) }
function clearAll() { meals.value = [{ name: 'Meal 1', items: [] }]; view.value = 'day' }
function selectView(v) { view.value = v }

// ---------- search (one box per meal) ----------
const onlyAA = ref(localStorage.getItem('aminosplore.onlyAA') === '1')
watch(onlyAA, (v) => localStorage.setItem('aminosplore.onlyAA', v ? '1' : '0'))
function addTo(mi, r) {
  const m = meals.value[mi]
  const ex = m.items.find((i) => i.id === r.id)
  if (ex) ex.grams += 100
  else m.items.push({ id: r.id, grams: 100 })
  dbState.value = 'ready'
}
const mealSearch = [] // FoodSearch instances by meal index (not reactive)
const setSearchRef = (mi, el) => { mealSearch[mi] = el }

// ---------- derived: groups = bands ----------
const shortName = (n) => (n.length > 34 ? n.slice(0, 32) + '…' : n)
const mealColor = (mi) => MEAL_PALETTE[mi % MEAL_PALETTE.length]
const foodColor = (ii) => PALETTE[ii % PALETTE.length]
const loadedItems = (m) => m.items.filter((i) => foods[i.id]).map((i) => ({ ...i, food: foods[i.id] }))
const isDay = computed(() => view.value === 'day')
const currentMeal = computed(() => (isDay.value ? null : meals.value[view.value]))
const viewName = computed(() => (isDay.value ? (meals.value.length > 1 ? 'Day total' : meals.value[0].name) : currentMeal.value.name))

// day view: one band per meal; meal view (or a single-meal day): one band per food
const groups = computed(() => {
  if (isDay.value && meals.value.length > 1) {
    return meals.value.map((m, mi) => ({ name: m.name || `Meal ${mi + 1}`, color: mealColor(mi), items: loadedItems(m) })).filter((g) => g.items.length)
  }
  const m = currentMeal.value || meals.value[0]
  return loadedItems(m).map((it, ii) => ({ name: shortName(it.food.name), fullName: it.food.name, color: foodColor(ii), items: [it] }))
})
const allItems = computed(() => groups.value.flatMap((g) => g.items))
const aaGroups = computed(() => groups.value.map((g) => ({ ...g, items: g.items.filter((it) => it.food.has_aa) })).filter((g) => g.items.length))
const noAAcount = computed(() => allItems.value.filter((it) => !it.food.has_aa).length)
const totals = computed(() => sumItems(allItems.value))
const kg = computed(() => (weight.value > 0 ? weight.value : 70))

// ---------- charts ----------
const pctFmt = (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1))
const amtFmt = (v) => (v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3))
const gFmt = (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2))
const basisText = computed(() => (basis.value === 'per100' ? `per 100 g of ${isDay.value && meals.value.length > 1 ? 'the day\'s food' : 'this meal'}` : 'in the quantities entered'))

const aaChart = computed(() => {
  const opts = { basis: basis.value, unit: aaUnit.value, kg: kg.value }
  const r = stackAA(aaGroups.value, opts)
  const ref0 = aaReference(opts)
  const unit = { g: 'g', who: '% of WHO daily need', protein: 'mg / g protein' }[aaUnit.value] + (aaUnit.value !== 'protein' && basis.value === 'per100' ? ' per 100 g' : '')
  const f = aaUnit.value === 'g' ? gFmt : (v) => v.toFixed(0)
  const refs = showRef.value && ref0 && r.layers.length ? [ref0] : []
  return {
    axes: WHO_AXES, layers: aaGroups.value.map((g, i) => ({ name: g.name, color: g.color, values: r.layers[i] })),
    refs, total: r.total, totalName: viewName.value, unit, fmt: f, cap: 0, minMax: 0, noData: [], partial: [],
    table: {
      head: [viewName.value, ...(ref0 ? ['WHO ref.'] : []), ...aaGroups.value.map((g) => g.name)],
      rows: WHO_AXES.map((a, i) => ({ label: a.label, cells: [
        { kind: 'total', text: f(r.total[i]) },
        ...(ref0 ? [{ kind: 'extra', text: f(ref0.values[i]) }] : []),
        ...r.layers.map((l) => ({ kind: 'layer', text: f(l[i]) })),
      ] })),
      note: `Unit: ${unit}. Band columns add up to the total.` + (aaUnit.value === 'protein' ? ` Whole selection: ${fmt(r.protein, 1)} g protein.` : ''),
    },
  }
})

function dvChart(axes) {
  const r = stackDV(axes, groups.value, { basis: basis.value })
  const refs = showRef.value && basis.value === 'amount' && r.layers.length ? [{ name: '100% Daily Value', values: axes.map(() => 100) }] : []
  const notes = axes.filter((a) => a.note).map((a) => `${a.label}: ${a.note}.`)
  return {
    axes, layers: groups.value.map((g, i) => ({ name: g.name, color: g.color, values: r.layers[i], missing: r.missing[i] })),
    refs, total: r.total, totalName: viewName.value, unit: '% DV' + (basis.value === 'per100' ? ' per 100 g' : ''), fmt: pctFmt,
    cap: 300, minMax: 0, noData: r.allMissing, partial: r.nMissing,
    table: {
      head: [viewName.value + ' %DV', 'Amount', 'DV', ...groups.value.map((g) => g.name)],
      rows: axes.map((a, i) => ({ label: a.label + (a.limit ? '†' : ''), title: a.note || a.label, cells: [
        { kind: 'total', text: pctFmt(r.total[i]), nd: r.allMissing[i], partial: r.nMissing[i] > 0, title: r.nMissing[i] ? `${r.nMissing[i]} food(s) have no data; lower bound` : '' },
        { kind: 'extra', text: r.allMissing[i] ? '—' : `${amtFmt(r.amount[i])} ${a.unit}` },
        { kind: 'extra', text: `${a.dv.toLocaleString()} ${a.unit}` },
        ...r.layers.map((l, gi) => ({ kind: 'layer', text: pctFmt(l[i]), nd: r.missing[gi][i] === 'all', partial: r.missing[gi][i] === 'some' })),
      ] })),
      note: `Unit: % of FDA Daily Value${basis.value === 'per100' ? ' per 100 g' : ''}. “no data” = USDA has no value (not zero); * = some foods have no data, so the value is a lower bound.` +
        (axes.some((a) => a.limit) ? ' † = Daily Value is a maximum, not a target.' : '') + (notes.length ? ' ' + notes.join(' ') : ''),
    },
  }
}
const macroChart = computed(() => dvChart(MACRO_AXES))
const vitChart = computed(() => dvChart(VIT_AXES))
const minChart = computed(() => dvChart(MIN_AXES))

const scores = computed(() => {
  const s = aaGroups.value.map((g) => ({ name: g.name, color: g.color, ...aminoScore(sumItems(g.items).totals) }))
  if (aaGroups.value.length > 1) s.push({ name: viewName.value, color: 'var(--text)', total: true, ...aminoScore(sumItems(aaGroups.value.flatMap((g) => g.items)).totals) })
  return s.filter((x) => x.limiting)
})
const energySplit = computed(() => {
  const t = totals.value.totals
  const p = t.protein * 4, c = t.carbs * 4, f = t.fat * 9, sum = p + c + f
  if (!sum) return null
  return [{ k: 'Protein', v: (p / sum) * 100, cls: 'p' }, { k: 'Carbs', v: (c / sum) * 100, cls: 'c' }, { k: 'Fat', v: (f / sum) * 100, cls: 'f' }]
})
const MACRO_COLS = [...MACROS, ...FAT_DETAIL]
const mealSummary = (m) => { const t = sumItems(loadedItems(m)); return `${fmt(t.grams, 0)} g · ${fmt(t.totals.kcal, 0)} kcal · ${fmt(t.totals.protein, 1)} g protein` }
const fdcLink = (id) => `https://fdc.nal.usda.gov/food-details/${id}/nutrients`

// ---------- share & saved ----------
const copied = ref('')
const urlFor = (h) => location.origin + location.pathname + location.search + h
async function copy(text, tag) {
  try { await navigator.clipboard.writeText(text) } catch { prompt('Copy this link', text) }
  copied.value = tag
  setTimeout(() => (copied.value = ''), 1600)
}
const copyDay = () => copy(urlFor(buildHash({ ...state(), view: 'day' })), 'day')
const copyMeal = (mi) => copy(urlFor(buildHash({ ...state(), meals: [state().meals[mi]], view: 'day' })), 'meal' + mi)
const saved = ref(JSON.parse(localStorage.getItem('aminosplore.recipes') || '[]'))
function saveDay() {
  const name = meals.value.map((m) => m.name).join(' + ').slice(0, 60)
  saved.value = [{ name, hash: buildHash({ ...state(), view: 'day' }) }, ...saved.value.filter((s) => s.name !== name)].slice(0, 30)
  localStorage.setItem('aminosplore.recipes', JSON.stringify(saved.value))
}
function deleteSaved(i) { saved.value.splice(i, 1); localStorage.setItem('aminosplore.recipes', JSON.stringify(saved.value)) }
const examples = [
  { name: 'A day: breakfast, lunch, dinner', hash: '#d=Breakfast~173905:240,173944:118,171265:200;Lunch~172421:200,168878:150,168462:60;Dinner~175168:150,170093:200,170379:120' },
  { name: 'Rice & black beans', hash: '#d=Rice+%26+black+beans~168878:180,173735:130' },
  { name: 'Egg vs tofu (per 100 g)', hash: '#d=Egg+vs+tofu~171287:100,172475:100&m=per100' },
]

// ---------- theme ----------
const theme = ref(localStorage.getItem('aminosplore.theme') || 'auto')
watch(theme, (t) => {
  localStorage.setItem('aminosplore.theme', t)
  if (t === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
}, { immediate: true })
const cycleTheme = () => (theme.value = { auto: 'light', light: 'dark', dark: 'auto' }[theme.value])

function scrollToChart(c) { nextTick(() => document.getElementById(c)?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }
onMounted(async () => {
  window.addEventListener('hashchange', onHashChange)
  try { dbInfo.value = await dbMeta(); dbState.value = 'ready' } catch (e) { console.error(e); dbState.value = 'error' }
  refreshStats()
  if (legacyChart) setTimeout(() => scrollToChart(legacyChart), 300)
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
        <p class="tag">Amino acids, macros, vitamins &amp; minerals of your meals</p>
      </div>
    </div>
    <button class="ghost" @click="cycleTheme" :title="`Theme: ${theme}`" data-testid="theme">{{ theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐' }} <span class="hide-sm">{{ theme }}</span></button>
  </header>

  <main class="layout">
    <section class="col-left">
      <div class="meals-head">
        <h2>Meals</h2>
        <label class="check" title="Search results: only foods with a full essential amino acid profile"><input type="checkbox" v-model="onlyAA" data-testid="aa-filter-global" /> AA data only</label>
      </div>
      <div v-for="(m, mi) in meals" :key="mi" class="card meal" :data-testid="`meal-${mi}`">
        <div class="meal-head">
          <span class="meal-dot" :style="{ background: meals.length > 1 ? mealColor(mi) : 'var(--accent)' }"></span>
          <input class="meal-name" v-model="m.name" :aria-label="`Meal ${mi + 1} name`" placeholder="Meal name" data-testid="meal-name" />
          <button class="icon sm" :title="`Share ${m.name}`" @click.stop="copyMeal(mi)" :data-testid="`share-meal-${mi}`">{{ copied === 'meal' + mi ? '✓' : '🔗' }}</button>
          <button class="icon sm" :title="meals.length > 1 ? `Remove ${m.name}` : 'Clear foods'" @click.stop="removeMeal(mi)" data-testid="remove-meal">🗑</button>
        </div>
        <ul v-if="m.items.length" class="items">
          <li v-for="(it, ii) in m.items" :key="it.id" class="item">
            <span class="dot" :style="{ background: foods[it.id]?.has_aa ? foodColor(ii) : 'transparent', borderColor: foodColor(ii) }"></span>
            <div class="item-main">
              <a v-if="foods[it.id]" :href="fdcLink(it.id)" target="_blank" rel="noopener" class="item-name">{{ foods[it.id].name }}</a>
              <span v-else class="item-name muted">Loading #{{ it.id }}…</span>
              <span class="item-meta" v-if="foods[it.id]">{{ foods[it.id].category }}<span v-if="!foods[it.id].has_aa" class="pill warn" title="No full amino acid profile in USDA data">no AA data</span></span>
            </div>
            <div class="qty">
              <input type="number" min="0" step="5" v-model.number="it.grams" :aria-label="`Grams of ${foods[it.id]?.name || it.id}`" data-testid="grams" />
              <span class="unit">g</span>
              <select v-if="foods[it.id]?.portions?.length" @change="(e) => { if (e.target.value) { it.grams = +e.target.value; e.target.value = '' } }" aria-label="Portion size">
                <option value="">portion…</option>
                <option v-for="p in foods[it.id].portions" :key="p.label" :value="p.grams">{{ p.label }} ({{ fmt(p.grams, 0) }} g)</option>
              </select>
              <select v-if="meals.length > 1" class="move" @change="(e) => { if (e.target.value !== '') moveItem(mi, ii, +e.target.value); e.target.value = '' }" aria-label="Move to meal" data-testid="move">
                <option value="">move…</option>
                <option v-for="(o, oi) in meals" v-show="oi !== mi" :key="oi" :value="oi" :disabled="oi === mi">{{ o.name }}</option>
              </select>
            </div>
            <button class="icon" @click.stop="removeItem(mi, ii)" :aria-label="`Remove ${foods[it.id]?.name || it.id}`">✕</button>
          </li>
        </ul>
        <FoodSearch
          :ref="(el) => setSearchRef(mi, el)"
          v-model:only-a-a="onlyAA"
          :placeholder="m.items.length ? `Add food to ${m.name || 'this meal'}…` : 'Search 8,000+ USDA foods…'"
          :label="`Add food to ${m.name || 'meal ' + (mi + 1)}`"
          :autofocus="!allIds.length && mi === 0"
          @add="(r) => addTo(mi, r)" @searched="refreshStats" @error="dbState = 'error'"
        />
        <p v-if="m.items.length" class="muted small meal-sum">{{ mealSummary(m) }}</p>
      </div>

      <div class="row-actions">
        <button class="ghost" @click="addMeal" data-testid="add-meal">+ Add meal</button>
        <span class="spacer"></span>
        <button class="ghost" @click="clearAll">Clear</button>
        <button class="ghost" @click="saveDay" data-testid="save">Save</button>
        <button class="primary" @click="copyDay" data-testid="share">{{ copied === 'day' ? 'Link copied ✓' : 'Copy link' }}</button>
      </div>
      <div v-if="!allIds.length" class="card empty">
        <p class="small">Try an example:</p>
        <div class="chips"><a v-for="e in examples" :key="e.name" :href="e.hash" class="chip">{{ e.name }}</a></div>
      </div>
      <div v-if="saved.length" class="card saved">
        <h3>Saved <span class="muted small">(this browser)</span></h3>
        <div class="chips">
          <span v-for="(s, i) in saved" :key="s.name" class="chip"><a :href="s.hash">{{ s.name }}</a><button class="x" @click="deleteSaved(i)" :aria-label="`Delete ${s.name}`">✕</button></span>
        </div>
      </div>
    </section>

    <section class="col-right">
      <div class="card controls">
        <div class="view-tabs" role="tablist" aria-label="View" data-testid="views" v-if="meals.length > 1">
          <button role="tab" :aria-selected="isDay" :class="{ on: isDay }" @click="selectView('day')">Day total</button>
          <button v-for="(m, mi) in meals" :key="mi" role="tab" :aria-selected="view === mi" :class="{ on: view === mi }" @click="selectView(mi)">
            <span class="meal-dot sm" :style="{ background: mealColor(mi) }"></span>{{ m.name || `Meal ${mi + 1}` }}
          </button>
        </div>
        <div class="ctl-row">
          <div class="seg-ctl" role="tablist" aria-label="Basis" data-testid="basis">
            <button role="tab" :aria-selected="basis === 'amount'" :class="{ on: basis === 'amount' }" @click="basis = 'amount'">Your portions</button>
            <button role="tab" :aria-selected="basis === 'per100'" :class="{ on: basis === 'per100' }" @click="basis = 'per100'">Per 100 g</button>
          </div>
          <label class="check"><input type="checkbox" v-model="showRef" data-testid="ref-toggle" /> <span class="dotted-swatch"></span> Daily reference</label>
          <label class="check">Body weight <input class="kg" type="number" min="10" max="250" v-model.number="weight" aria-label="Body weight in kg" /> kg</label>
        </div>
        <p class="muted small hint">
          <b>{{ viewName }}</b>: {{ isDay && meals.length > 1 ? 'each band is a meal' : 'each band is a food' }}; the outer edge of the stack is the total, {{ basisText }}.
          Dotted line: {{ basis === 'amount' ? 'WHO 2007 adult need (amino acids) and 100% FDA Daily Value (others)' : 'WHO adult pattern when amino acids are shown per g protein' }}.
        </p>
      </div>

      <div class="charts">
        <ChartCard id="aa" title="Essential amino acids" :chart="aaChart" :table="aaChart.table"
          :subtitle="noAAcount ? `${noAAcount} food${noAAcount > 1 ? 's' : ''} without amino acid data excluded.` : ''"
          :empty="dbState === 'error' ? 'Could not load the food database.' : allItems.length ? 'No food here has a full amino acid profile.' : 'Add foods to see their profile.'">
          <template #controls>
            <div class="seg-ctl sm" role="tablist" aria-label="Amino acid unit" data-testid="aa-unit">
              <button role="tab" :aria-selected="aaUnit === 'g'" :class="{ on: aaUnit === 'g' }" @click="aaUnit = 'g'" title="Grams">g</button>
              <button role="tab" :aria-selected="aaUnit === 'who'" :class="{ on: aaUnit === 'who' }" @click="aaUnit = 'who'" title="% of WHO/FAO/UNU 2007 adult daily need for your body weight">% need</button>
              <button role="tab" :aria-selected="aaUnit === 'protein'" :class="{ on: aaUnit === 'protein' }" @click="aaUnit = 'protein'" title="mg per g protein, vs WHO adult scoring pattern">per g protein</button>
            </div>
          </template>
          <template #below>
            <details v-if="scores.length" class="scores">
              <summary>Amino acid score <span class="muted small">vs WHO/FAO/UNU 2007 adult pattern</span></summary>
              <ul>
                <li v-for="s in scores" :key="s.name" :class="{ total: s.total }">
                  <span class="dot sm" :style="{ background: s.color }"></span><span class="s-name">{{ s.name }}</span>
                  <span class="bar"><span :style="{ width: Math.min(100, s.score) + '%', background: s.color }"></span></span>
                  <b>{{ Math.min(999, s.score).toFixed(0) }}</b>
                  <span class="muted small">{{ s.score < 100 ? `limited by ${s.limiting.short}` : 'complete' }}</span>
                </li>
              </ul>
              <p class="muted small">Lowest ratio of (mg amino acid / g protein) to the reference pattern; not adjusted for digestibility.</p>
            </details>
          </template>
        </ChartCard>
        <ChartCard id="macro" title="Macros" :chart="macroChart" :table="macroChart.table" empty="Add foods to see macros." />
        <ChartCard id="vit" title="Vitamins" :chart="vitChart" :table="vitChart.table" empty="Add foods to see vitamins." />
        <ChartCard id="min" title="Minerals" :chart="minChart" :table="minChart.table" empty="Add foods to see minerals." />
      </div>

      <div class="card" v-if="groups.length">
        <h2>Macros — {{ viewName }}</h2>
        <div class="table-wrap">
          <table class="macros" data-testid="macros">
            <thead><tr><th>{{ isDay && meals.length > 1 ? 'Meal' : 'Food' }}</th><th>g</th><th v-for="c in MACRO_COLS" :key="c.key">{{ c.label }}<small>{{ c.unit }}</small></th></tr></thead>
            <tbody>
              <tr v-for="g in groups" :key="g.name + g.color">
                <td class="fname"><span class="dot sm" :style="{ background: g.color, borderColor: g.color }"></span>{{ g.name }}</td>
                <td>{{ fmt(sumItems(g.items).grams, 0) }}</td>
                <td v-for="c in MACRO_COLS" :key="c.key">
                  <span v-if="sumItems(g.items).missing[c.key] === g.items.length" class="nd">n/a</span>
                  <template v-else>{{ fmt(sumItems(g.items).totals[c.key], c.digits) }}<sup v-if="sumItems(g.items).missing[c.key]">*</sup></template>
                </td>
              </tr>
            </tbody>
            <tfoot v-if="groups.length > 1">
              <tr><td>{{ viewName }}</td><td>{{ fmt(totals.grams, 0) }}</td><td v-for="c in MACRO_COLS" :key="c.key">{{ fmt(totals.totals[c.key], c.digits) }}<sup v-if="totals.missing[c.key]" title="Some foods have no value">*</sup></td></tr>
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
  </main>

  <footer class="foot">
    <p>
      Data: <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener">USDA FoodData Central</a> (public domain) —
      {{ dbInfo?.source?.replace(/^.*?:\s*/, '') || 'SR Legacy 2018-04; Foundation Foods 2026-04-30' }}. Values per 100 g edible portion.
      Daily Values: U.S. FDA <a href="https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels" target="_blank" rel="noopener">Daily Value reference guide</a> (21 CFR 101.9, adults &amp; children ≥4 y; 2,000 kcal reference diet).
      Amino acid requirements: WHO/FAO/UNU (2007) <a href="https://iris.who.int/handle/10665/43411" target="_blank" rel="noopener"><i>Protein and amino acid requirements in human nutrition</i></a>, WHO TRS 935 (adult).
      Not medical advice.
    </p>
    <p class="muted small" data-testid="dbstats">
      Database {{ kb(DB_SIZE) }} · build {{ DB_HASH }}<template v-if="netStats"> · fetched {{ kb(netStats.totalFetchedBytes) }} in {{ netStats.totalRequests }} range requests</template>
      · <a href="https://github.com/sjurgis/aminosplore" target="_blank" rel="noopener">source</a>
    </p>
  </footer>
</template>
