<script>
import { ref } from 'vue'
// Shared across all instances: only one dropdown may be open at a time.
const openId = ref(null)
let uid = 0
</script>

<script setup>
import { computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { search as dbSearch } from '../db.js'

const props = defineProps({
  onlyAA: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Add food…' },
  label: { type: String, default: 'Search foods' },
  autofocus: { type: Boolean, default: false },
})
const emit = defineEmits(['add', 'update:onlyAA', 'searched', 'error'])

const id = ++uid
const query = ref('')
const results = ref([])
const searching = ref(false)
const active = ref(0)
const input = ref(null)
const isOpen = computed(() => openId.value === id)
const listId = `food-results-${id}`

let seq = 0, timer = null
watch([query, () => props.onlyAA], () => {
  clearTimeout(timer)
  const q = query.value.trim()
  if (q.length < 2) { results.value = []; return }
  timer = setTimeout(async () => {
    const my = ++seq
    searching.value = true
    try {
      const r = await dbSearch(q, { onlyAA: props.onlyAA })
      if (my === seq) { results.value = r; active.value = 0; openId.value = id }
    } catch (e) { console.error(e); emit('error', e) } finally { if (my === seq) searching.value = false; emit('searched') }
  }, 160)
})
function pick(r) {
  emit('add', r)
  query.value = ''
  results.value = []
  nextTick(() => input.value?.focus())
}
function onKey(e) {
  if (e.key === 'Escape') { openId.value = null; return }
  if (!results.value.length) return
  if (!isOpen.value) openId.value = id
  if (e.key === 'ArrowDown') { active.value = (active.value + 1) % results.value.length; e.preventDefault() }
  else if (e.key === 'ArrowUp') { active.value = (active.value - 1 + results.value.length) % results.value.length; e.preventDefault() }
  else if (e.key === 'Enter') { pick(results.value[active.value]); e.preventDefault() }
}
function onFocus() {
  openId.value = id
  // phones: lift the box to the top so the dropdown is not hidden behind the on-screen keyboard
  if (window.matchMedia('(max-width: 760px)').matches) setTimeout(() => input.value?.closest('.food-search')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250)
}
function onBlur() { setTimeout(() => { if (openId.value === id && document.activeElement !== input.value) openId.value = null }, 150) }
function focus() { input.value?.focus() }
defineExpose({ focus })
if (props.autofocus) nextTick(() => input.value?.focus({ preventScroll: true }))
onBeforeUnmount(() => { if (openId.value === id) openId.value = null })
</script>

<template>
  <div class="food-search" :class="{ open: isOpen && (results.length || query.trim().length >= 2) }" data-testid="food-search">
    <label class="search sm" :class="{ busy: searching }">
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" d="M12 5v14M5 12h14" /></svg>
      <input
        ref="input" v-model="query" type="search" :placeholder="placeholder" autocomplete="off" :aria-label="label"
        role="combobox" :aria-expanded="isOpen && results.length > 0" :aria-controls="listId"
        :aria-activedescendant="isOpen && results.length ? `${listId}-${active}` : undefined"
        data-testid="search" @keydown="onKey" @focus="onFocus" @blur="onBlur"
      />
    </label>
    <div v-if="isOpen && (results.length || (query.trim().length >= 2 && !searching))" class="results" data-testid="results-pop">
      <ul v-if="results.length" :id="listId" role="listbox" data-testid="results">
        <li v-for="(r, i) in results" :id="`${listId}-${i}`" :key="r.id" role="option" :aria-selected="i === active" :class="{ active: i === active }" @mousedown.prevent="pick(r)" @mouseenter="active = i">
          <span class="r-name">{{ r.name }}</span>
          <span class="r-meta">{{ r.category }}<span v-if="!r.hasAA" class="pill warn">no AA data</span></span>
        </li>
      </ul>
      <p v-else class="muted small no-match">No matches.</p>
      <label class="check aa-filter" @mousedown.prevent>
        <input type="checkbox" :checked="onlyAA" @change="(e) => emit('update:onlyAA', e.target.checked)" data-testid="aa-filter" />
        Only foods with amino acid data
      </label>
    </div>
  </div>
</template>
