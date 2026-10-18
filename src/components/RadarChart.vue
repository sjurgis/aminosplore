<script setup>
// Stacked radar: layer i is drawn as the band between cumulative(i-1) and cumulative(i),
// so the outer edge is the total and each band is one food's contribution.
import { computed, ref } from 'vue'

const props = defineProps({
  axes: { type: Array, required: true }, // [{ key, short, label }]
  layers: { type: Array, required: true }, // [{ name, color, values }] contributions, innermost first
  totalName: { type: String, default: 'Total' },
  refs: { type: Array, default: () => [] }, // [{ name, values }] dashed reference outlines
  unit: { type: String, default: '' },
  format: { type: Function, default: (v) => v.toFixed(1) },
  minMax: { type: Number, default: 0 },
  cap: { type: Number, default: 0 }, // if set, radial scale never exceeds this; larger values are clipped and labelled
  noData: { type: Array, default: () => [] }, // per axis: true = no food has data for it
  partial: { type: Array, default: () => [] }, // per axis: number of foods missing data
})

const size = 420
const c = size / 2
const R = 150
const hover = ref(null)

function niceMax(v) {
  if (!(v > 0)) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v - 1e-12) return m * p
  return 10 * p
}

const cumulative = computed(() => {
  const acc = props.axes.map(() => 0)
  return props.layers.map((l) => {
    const inner = acc.slice()
    l.values.forEach((v, i) => (acc[i] += v))
    return { inner, outer: acc.slice() }
  })
})
const total = computed(() => (cumulative.value.length ? cumulative.value.at(-1).outer : props.axes.map(() => 0)))

const max = computed(() => {
  const m = niceMax(Math.max(props.minMax, ...total.value, ...props.refs.flatMap((r) => r.values), 0))
  return props.cap ? Math.min(m, props.cap) : m
})
const limitR = computed(() => (props.cap ? 1.04 : 1.15))
const n = computed(() => props.axes.length)
const angle = (i) => (Math.PI * 2 * i) / n.value - Math.PI / 2
const pt = (i, r) => [c + Math.cos(angle(i)) * r, c + Math.sin(angle(i)) * r]
const scaled = (vals) => vals.map((v, i) => pt(i, (R * Math.min(v, max.value * limitR.value)) / max.value))
const ring = (pts) => 'M' + pts.map((p) => p.map((x) => x.toFixed(2)).join(',')).join('L') + 'Z'

const rings = computed(() => [0.25, 0.5, 0.75, 1].map((f) => ({
  f,
  value: max.value * f,
  points: props.axes.map((_, i) => pt(i, R * f).join(',')).join(' '),
})))

const bands = computed(() => props.layers.map((l, li) => {
  const { inner, outer } = cumulative.value[li]
  return { ...l, li, d: ring(scaled(outer)) + ring(scaled(inner)), outer, mid: scaled(outer) }
}))
const totalPts = computed(() => scaled(total.value))
const clipped = computed(() => total.value.map((v, i) => ({ v, i })).filter((x) => x.v > max.value * limitR.value)
  .map((x) => ({ ...x, pos: pt(x.i, R * limitR.value - 18) })))
const refPolys = computed(() => props.refs.map((r) => ({ ...r, points: scaled(r.values).map((p) => p.join(',')).join(' ') })))

const labels = computed(() => props.axes.map((a, i) => {
  const [x, y] = pt(i, R + 26)
  const cos = Math.cos(angle(i))
  const nd = !!props.noData[i], part = !nd && props.partial[i] > 0
  const text = a.short + (a.limit ? '†' : '') + (part ? '*' : '')
  const title = a.label + (props.layers.length ? ` — ${props.totalName}: ${nd ? 'no data' : props.format(total.value[i]) + ' ' + props.unit}` : '') + (a.limit ? ' — Daily Value is an upper limit' : '') + (nd ? ' — no data' : part ? ` — ${props.partial[i]} food(s) have no data` : '')
  return { ...a, x, y, nd, text, title, anchor: Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end' }
}))
const pct = (v, t) => (t > 0 ? ` (${((v / t) * 100).toFixed(0)}%)` : '')
</script>

<template>
  <div class="radar">
    <svg :viewBox="`0 0 ${size} ${size}`" role="img" :aria-label="`Stacked radar chart of ${axes.map((a) => a.label).join(', ')}`" data-testid="radar">
      <g class="grid">
        <polygon v-for="r in rings" :key="r.f" :points="r.points" />
        <line v-for="(a, i) in axes" :key="a.key" :x1="c" :y1="c" :x2="pt(i, R)[0]" :y2="pt(i, R)[1]" />
      </g>
      <g class="ring-labels">
        <text v-for="r in rings" :key="r.f" :x="c + 4" :y="c - R * r.f + 11">{{ format(r.value) }}</text>
      </g>
      <path
        v-for="b in bands"
        :key="b.li"
        class="band"
        :class="{ dim: hover !== null && hover !== b.li }"
        :d="b.d"
        fill-rule="evenodd"
        :fill="b.color"
        :stroke="b.color"
        :data-layer="b.li"
        @mouseenter="hover = b.li"
        @mouseleave="hover = null"
      >
        <title>{{ b.name }} ({{ unit }}): {{ axes.map((a, i) => `${a.short} ${b.missing?.[i] === 'all' || b.missing?.[i] === true ? 'no data' : format(b.values[i]) + pct(b.values[i], total[i]) + (b.missing?.[i] === 'some' ? ' (partial data)' : '')}`).join(', ') }}&#10;{{ totalName }}: {{ axes.map((a, i) => `${a.short} ${format(total[i])}`).join(', ') }}</title>
      </path>
      <polygon v-for="r in refPolys" :key="r.name" class="ref" :points="r.points" data-testid="ref-line" />

      <g class="clip-labels">
        <text v-for="c in clipped" :key="c.i" :x="c.pos[0]" :y="c.pos[1]" text-anchor="middle" dominant-baseline="middle">{{ format(c.v) }}↑</text>
      </g>
      <g class="axis-labels">
        <text v-for="l in labels" :key="l.key" :x="l.x" :y="l.y" :text-anchor="l.anchor" dominant-baseline="middle" :class="{ nodata: l.nd }">
          <title>{{ l.title }}</title>{{ l.text }}<tspan v-if="l.nd" class="nd-tag" :x="l.x" dy="13">no data</tspan>
        </text>
      </g>
    </svg>
    <ul class="legend">
      <li v-for="b in bands" :key="b.li" @mouseenter="hover = b.li" @mouseleave="hover = null">
        <span class="swatch" :style="{ background: b.color, borderColor: b.color }"></span>{{ b.name }}
      </li>
      <li v-for="r in refs" :key="r.name" class="dashed" data-testid="ref-legend"><span class="swatch"></span>{{ r.name }}</li>
    </ul>
  </div>
</template>
