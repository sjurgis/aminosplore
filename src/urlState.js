// URL hash state: #f=<fdcId>:<grams>,<fdcId>:<grams>&r=<recipe name>&m=<mode>&w=<body kg>
// Hash (not query) so GitHub Pages never sees it and links stay shareable.
export function parseHash(hash = location.hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  const items = (p.get('f') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [id, g] = s.split(':')
      return { id: parseInt(id, 10), grams: g === undefined || g === '' ? 100 : Math.max(0, parseFloat(g)) }
    })
    .filter((x) => Number.isFinite(x.id) && x.id > 0 && Number.isFinite(x.grams))
  return {
    items,
    recipe: p.get('r') || '',
    mode: p.get('m') || 'amount',
    weight: parseFloat(p.get('w')) || 70,
  }
}

const num = (g) => String(Math.round(g * 10) / 10)

export function buildHash({ items, recipe, mode, weight }) {
  const parts = []
  if (items.length) parts.push('f=' + items.map((i) => `${i.id}:${num(i.grams)}`).join(','))
  if (recipe) parts.push('r=' + encodeURIComponent(recipe).replace(/%20/g, '+'))
  if (mode && mode !== 'amount') parts.push('m=' + mode)
  if (weight && weight !== 70) parts.push('w=' + num(weight))
  return parts.length ? '#' + parts.join('&') : ''
}
