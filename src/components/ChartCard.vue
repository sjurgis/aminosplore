<script setup>
// One radar chart card: title, optional controls slot, stacked radar, legend and a values table.
// table: { head: [String], rows: [{ label, title, cells: [{ text, kind: 'total'|'extra'|'layer', nd, partial, title }] }], note }
import RadarChart from './RadarChart.vue'
defineProps({
  id: String,
  title: String,
  subtitle: String,
  chart: Object, // { axes, layers, refs, total, totalName, unit, fmt, cap, minMax, noData, partial }
  table: Object,
  empty: String,
})
</script>

<template>
  <article class="card chart-card" :id="id" :data-testid="`chart-${id}`">
    <div class="cc-head">
      <h2>{{ title }}</h2>
      <slot name="controls" />
    </div>
    <p v-if="subtitle" class="muted small hint">{{ subtitle }}</p>
    <RadarChart
      v-if="chart.layers.length"
      :axes="chart.axes" :layers="chart.layers" :refs="chart.refs" :total-name="chart.totalName" :unit="chart.unit"
      :format="chart.fmt" :min-max="chart.minMax" :cap="chart.cap" :no-data="chart.noData" :partial="chart.partial"
    />
    <div v-else class="chart-empty">
      <svg viewBox="0 0 200 200" width="140" aria-hidden="true"><polygon points="100,15 180,70 150,170 50,170 20,70" fill="none" stroke="var(--line)" stroke-width="2" /><polygon points="100,55 140,80 125,135 70,140 55,85" fill="var(--accent)" fill-opacity=".18" stroke="var(--accent)" stroke-width="2" /></svg>
      <p class="muted small">{{ empty }}</p>
    </div>
    <slot name="below" />
    <details v-if="chart.layers.length && table" class="values">
      <summary>Values</summary>
      <div class="table-wrap">
        <table class="aa-table" data-testid="values-table">
          <thead><tr><th></th><th v-for="(h, i) in table.head" :key="i" :title="h">{{ h }}</th></tr></thead>
          <tbody>
            <tr v-for="r in table.rows" :key="r.label">
              <td :title="r.title || r.label">{{ r.label }}</td>
              <td v-for="(c, ci) in r.cells" :key="ci" :class="[c.kind === 'total' ? 'tot' : c.kind === 'extra' ? 'amt' : '']" :data-kind="c.kind" :title="c.title || ''">
                <span v-if="c.nd" class="nd">no data</span><template v-else>{{ c.text }}<sup v-if="c.partial">*</sup></template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="table.note" class="muted small">{{ table.note }}</p>
    </details>
  </article>
</template>
