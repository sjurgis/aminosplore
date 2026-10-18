<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  axes: { type: Array, required: true }, // [{ short, label }]
  series: { type: Array, required: true }, // [{ name, color, values, dashed, total }]
  unit: { type: String, default: '' },
  format: { type: Function, default: (v) => v.toFixed(1) },
  minMax: { type: Number, default: 0 },
})

const size = 420
const c = size / 2
const R = 150
const hover = ref(null)

function niceMax(v) {
  if (!(v > 0)) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p
  return 10 * p
}

const max = computed(() => {
  const all = props.series.flatMap((s) => s.values)
  return niceMax(Math.max(props.minMax, ...all, 0))
})
const n = computed(() => props.axes.length)
const angle = (i) => (Math.PI * 2 * i) / n.value - Math.PI / 2
const pt = (i, r) => [c + Math.cos(angle(i)) * r, c + Math.sin(angle(i)) * r]

const rings = computed(() => [0.25, 0.5, 0.75, 1].map((f) => ({
  f,
  value: max.value * f,
  points: props.axes.map((_, i) => pt(i, R * f).join(',')).join(' '),
})))

const polys = computed(() => props.series.map((s) => {
  const pts = s.values.map((v, i) => pt(i, (R * Math.min(v, max.value * 1.15)) / max.value))
  return { ...s, pts, points: pts.map((p) => p.join(',')).join(' ') }
}))

const labels = computed(() => props.axes.map((a, i) => {
  const [x, y] = pt(i, R + 26)
  const cos = Math.cos(angle(i))
  return { ...a, x, y, anchor: Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end' }
}))
</script>

<template>
  <div class="radar">
    <svg :viewBox="`0 0 ${size} ${size}`" role="img" :aria-label="`Radar chart of ${axes.map((a) => a.label).join(', ')}`" data-testid="radar">
      <g class="grid">
        <polygon v-for="r in rings" :key="r.f" :points="r.points" />
        <line v-for="(a, i) in axes" :key="a.key" :x1="c" :y1="c" :x2="pt(i, R)[0]" :y2="pt(i, R)[1]" />
      </g>
      <g class="ring-labels">
        <text v-for="r in rings" :key="r.f" :x="c + 4" :y="c - R * r.f + 11">{{ format(r.value) }}</text>
      </g>
      <g
        v-for="(p, si) in polys"
        :key="p.name + si"
        class="series"
        :class="{ dim: hover !== null && hover !== si, total: p.total, dashed: p.dashed }"
        @mouseenter="hover = si"
        @mouseleave="hover = null"
      >
        <polygon :points="p.points" :stroke="p.color" :fill="p.dashed ? 'none' : p.color" />
        <template v-if="!p.dashed">
          <circle v-for="(q, i) in p.pts" :key="i" :cx="q[0]" :cy="q[1]" r="3.2" :fill="p.color">
            <title>{{ p.name }} — {{ axes[i].label }}: {{ format(p.values[i]) }} {{ unit }}</title>
          </circle>
        </template>
      </g>
      <g class="axis-labels">
        <text v-for="l in labels" :key="l.key" :x="l.x" :y="l.y" :text-anchor="l.anchor" dominant-baseline="middle">
          <title>{{ l.label }}</title>{{ l.short }}
        </text>
      </g>
    </svg>
    <ul class="legend">
      <li v-for="(p, si) in polys" :key="p.name + si" @mouseenter="hover = si" @mouseleave="hover = null" :class="{ dashed: p.dashed }">
        <span class="swatch" :style="{ background: p.dashed ? 'transparent' : p.color, borderColor: p.color }"></span>{{ p.name }}
      </li>
    </ul>
  </div>
</template>
