// End-to-end test: node tests/e2e.mjs [baseUrl] [screenshotDir]
import { chromium } from 'playwright'
const base = process.argv[2] || 'http://localhost:4173/'
const shots = process.argv[3] || '/tmp'
const log = (...a) => console.log('•', ...a)
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); log('ok:', m) }
const url = (h) => base + h

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] })
const errors = [], ranges = [], badResp = []
function watch(p) {
  p.on('pageerror', (e) => errors.push(String(e)))
  p.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /Vue warn/.test(m.text()))) errors.push(m.text()) })
  p.on('request', (r) => { if (r.url().includes('foods.sqlite3')) ranges.push(r.method() + ' ' + (r.headers()['range'] || 'no-range')) })
  p.on('response', async (r) => {
    if (!r.url().includes('foods.sqlite3') || r.request().method() !== 'GET') return
    const h = await r.allHeaders()
    if (r.status() !== 206 || h['content-encoding']) badResp.push(`${r.status()} ${h['content-encoding'] || ''}`)
  })
  return p
}
const page = watch(await ctx.newPage())
const hash = (p = page) => p.evaluate(() => location.hash)
const bands = (p, id) => p.locator(`[data-testid=chart-${id}] path.band`).count()
const waitBands = (p, id, n) => p.waitForFunction(([id, n]) => document.querySelectorAll(`[data-testid=chart-${id}] path.band`).length === n, [id, n], { timeout: 20000 })
const CHARTS = ['aa', 'macro', 'vit', 'min']

async function addFood(mi, q, pick) {
  const meal = page.getByTestId('meal-' + mi)
  await meal.getByTestId('search').fill(q)
  await meal.getByTestId('results').waitFor({ timeout: 20000 })
  const list = meal.getByTestId('results')
  const opt = pick ? list.getByRole('option', { name: pick }).first() : list.getByRole('option').first()
  const name = (await opt.locator('.r-name').textContent()).trim()
  await opt.dispatchEvent('mousedown')
  log('added', name)
  return name
}
// every values table: band columns add up to the total (within display rounding); "no data" counts as 0
async function tablesStack(p, label) {
  for (const id of CHARTS) {
    const card = p.getByTestId('chart-' + id)
    if (!(await card.locator('details.values').count())) continue
    await card.locator('details.values').evaluate((d) => (d.open = true))
    const rows = await card.locator('[data-testid=values-table] tbody tr').evaluateAll((trs) => trs.map((tr) => ({
      label: tr.cells[0].textContent.trim(),
      total: tr.querySelector('[data-kind=total]').textContent.trim(),
      layers: [...tr.querySelectorAll('[data-kind=layer]')].map((td) => td.textContent.trim()),
    })))
    const half = (t) => (t.includes('no data') ? 0 : 0.5 * 10 ** -((t.replace('*', '').split('.')[1] || '').length))
    const val = (t) => (t.includes('no data') ? 0 : Number(t.replace('*', '')))
    for (const r of rows) {
      if (r.total.includes('no data')) continue
      const sum = r.layers.reduce((s, t) => s + val(t), 0)
      const tol = [...r.layers, r.total].reduce((s, t) => s + half(t), 0) + 1e-9
      if (Math.abs(sum - val(r.total)) > tol) throw new Error(`${label} ${id}: ${r.label} ${r.layers.join('+')} != ${r.total}`)
    }
    await card.locator('details.values').evaluate((d) => (d.open = false))
  }
  log('ok:', label, '- all 4 value tables: bands add up to the total')
}

// ---- build a day from scratch ----
await page.goto(base, { waitUntil: 'networkidle' })
for (const id of CHARTS) assert(await page.getByTestId('chart-' + id).isVisible(), `chart ${id} visible on the page`)
assert((await page.getByTestId('meal-name').count()) === 1, 'empty start: one default meal')
assert(await page.evaluate(() => document.activeElement?.dataset.testid === 'search' && !!document.activeElement.closest('[data-testid=meal-0]')), 'default meal search is focused and ready')
await addFood(0, 'lentils cooked boiled', /Lentils, mature seeds, cooked, boiled, without salt/)
await page.getByTestId('meal-0').getByTestId('meal-name').fill('Lunch')
await page.getByTestId('add-meal').click()
assert((await page.getByTestId('meal-1').getByTestId('meal-name').inputValue()) === 'Breakfast', 'Add meal creates "Breakfast"')
assert(await page.evaluate(() => !!document.activeElement.closest('[data-testid=meal-1]') && document.activeElement.dataset.testid === 'search'), "new meal's search box gets focus")
await addFood(1, 'oats regular quick cooked water', /Cereals, oats, regular and quick, unenriched, cooked with water/)
// keyboard: ArrowDown/ArrowUp/Enter picks the highlighted result into this meal
{
  const s1 = page.getByTestId('meal-1').getByTestId('search')
  await s1.fill('rice white long grain cooked')
  await page.getByTestId('meal-1').getByTestId('results').waitFor()
  const opts = await page.getByTestId('meal-1').getByTestId('results').getByRole('option').locator('.r-name').allTextContents()
  await s1.press('ArrowDown'); await s1.press('ArrowDown'); await s1.press('ArrowUp')
  assert((await page.getByTestId('meal-1').getByRole('option', { selected: true }).locator('.r-name').textContent()) === opts[1], 'arrow keys move the highlight')
  await s1.press('ArrowUp'); await s1.press('Enter')
  await page.waitForTimeout(200)
  const names = await page.getByTestId('meal-1').locator('.item-name').allTextContents()
  assert(names.at(-1) === opts[0] && /^Rice, white, long-grain, regular, enriched, cooked/.test(opts[0]), `Enter adds highlighted result to Breakfast: ${opts[0]}`)
  assert((await s1.inputValue()) === '' && (await page.getByTestId('results-pop').count()) === 0, 'search box clears and dropdown closes after adding')
}
await page.getByTestId('add-meal').click()
await page.getByTestId('meal-2').getByTestId('meal-name').fill('Dinner')
await addFood(2, 'chicken broilers breast meat only roasted', /Chicken, broilers or fryers, breast, meat only, cooked, roasted/)
// only one dropdown at a time
{
  const s0 = page.getByTestId('meal-0').getByTestId('search'), s2 = page.getByTestId('meal-2').getByTestId('search')
  await s0.fill('tomatoes grape')
  await page.getByTestId('meal-0').getByTestId('results').waitFor()
  await s2.fill('broccoli raw')
  await page.getByTestId('meal-2').getByTestId('results').waitFor()
  await page.waitForTimeout(250)
  assert((await page.getByTestId('results-pop').count()) === 1 && (await page.getByTestId('meal-2').getByTestId('results-pop').count()) === 1, 'only one search dropdown open at a time')
  // amino-acid filter inside the dropdown is the shared setting
  await page.getByTestId('meal-2').getByTestId('aa-filter').check()
  await page.waitForTimeout(400)
  assert(await page.getByTestId('aa-filter-global').isChecked(), 'dropdown AA filter toggles the global setting')
  assert(await page.getByTestId('meal-2').getByTestId('results').getByText('no AA data').count() === 0, 'filtered results all have AA data')
  await page.getByTestId('aa-filter-global').uncheck()
  await s2.fill(''); await s0.fill('')
}
await addFood(2, 'broccoli raw', /^Broccoli, raw/)
await addFood(0, 'tomatoes grape raw', /Tomatoes, grape, raw/) // no AA data, vitamin gaps
await page.getByTestId('meal-1').getByTestId('grams').nth(0).fill('240')
await page.getByTestId('meal-2').getByTestId('grams').nth(0).fill('150')
await page.waitForTimeout(300)
let h = await hash()
assert(/^#d=Lunch~172421:100,\d+:100;Breakfast~173905:240,168878:100;Dinner~171477:150,170379:100$/.test(h), `URL encodes 3 meals: ${h}`)

// move rice from Breakfast to Lunch
await page.getByTestId('meal-1').getByTestId('move').nth(1).selectOption({ label: 'Lunch' })
await page.waitForTimeout(200)
h = await hash()
assert(/Lunch~172421:100,321360:100,168878:100;Breakfast~173905:240;/.test(h), `rice moved to Lunch: ${h}`)

// ---- day view: bands = meals; no outer total outline; dotted reference ----
await waitBands(page, 'macro', 3)
assert(await bands(page, 'aa') === 3 && await bands(page, 'vit') === 3 && await bands(page, 'min') === 3, 'day view: 3 bands (one per meal) in all 4 charts')
assert(await page.locator('.total-line').count() === 0, 'no outer "total" outline drawn')
assert(await page.locator('[data-testid=ref-line]').count() === 4, 'dotted daily reference on all 4 charts (default on)')
const legend = await page.getByTestId('chart-vit').locator('.legend li').allTextContents()
assert(legend.join('|') === 'Lunch|Breakfast|Dinner|100% Daily Value', `vitamins legend by meal: ${legend.join(', ')}`)
assert((await page.getByTestId('chart-aa').locator('.legend').textContent()).includes('WHO daily need (70 kg)'), 'AA reference = WHO need for body weight')
await tablesStack(page, 'day view')
await page.screenshot({ path: `${shots}/aminosplore-day.png`, fullPage: true })

await page.getByTestId('ref-toggle').uncheck()
await page.waitForTimeout(150)
assert(await page.locator('[data-testid=ref-line]').count() === 0 && (await hash()).includes('ref=0'), 'reference toggle off: no dotted lines, ref=0 in URL')
await page.getByTestId('ref-toggle').check()
await page.waitForTimeout(150)
assert(await page.locator('[data-testid=ref-line]').count() === 4 && !(await hash()).includes('ref='), 'reference toggle back on')

// AA unit + basis
await page.getByTestId('aa-unit').getByRole('tab', { name: 'per g protein' }).click()
await page.waitForTimeout(150)
assert((await hash()).includes('a=protein') && (await page.getByTestId('chart-aa').locator('.legend').textContent()).includes('WHO adult pattern'), 'AA per g protein: WHO pattern reference, a=protein')
await page.getByTestId('basis').getByRole('tab', { name: 'Per 100 g' }).click()
await page.waitForTimeout(150)
assert((await hash()).includes('m=per100'), 'basis per 100 g in URL')
assert(await page.locator('[data-testid=ref-line]').count() === 1, 'per 100 g: only the AA pattern reference remains (DVs are per day)')
await tablesStack(page, 'day per 100 g')
await page.getByTestId('basis').getByRole('tab', { name: 'Your portions' }).click()
await page.getByTestId('aa-unit').getByRole('tab', { name: 'g', exact: true }).click()

// ---- single meal view: bands = foods ----
await page.getByTestId('views').getByRole('tab', { name: 'Lunch' }).click()
await waitBands(page, 'vit', 3)
assert(await bands(page, 'aa') === 2 && (await hash()).includes('v=0'), 'Lunch view: bands = foods (3 in vitamins, 2 with AA data), v=0 in URL')
assert((await page.getByTestId('chart-macro').locator('[data-kind=total]').count()) > 0 && (await page.locator('[data-testid=macros] tfoot td').first().textContent()) === 'Lunch', 'meal view macros total row is the meal')
await tablesStack(page, 'Lunch view')
await page.screenshot({ path: `${shots}/aminosplore-meal.png`, fullPage: true })

// ---- reload restores everything ----
const before = await hash()
await page.reload({ waitUntil: 'networkidle' })
await waitBands(page, 'vit', 3)
assert((await hash()) === before, 'reload keeps URL')
const names = await page.getByTestId('meal-name').evaluateAll((els) => els.map((e) => e.value))
assert(names.join() === 'Lunch,Breakfast,Dinner', 'reload restores meal names')
assert(await page.getByTestId('views').getByRole('tab', { name: 'Lunch' }).getAttribute('aria-selected') === 'true', 'reload restores the meal view')

// ---- share links ----
await page.getByTestId('share-meal-2').click()
const mealLink = await page.evaluate(() => navigator.clipboard.readText())
assert(/#d=Dinner~171477:150,170379:100$/.test(mealLink), `single-meal link: ${mealLink}`)
await page.getByTestId('share').click()
const dayLink = await page.evaluate(() => navigator.clipboard.readText())
assert(dayLink.includes('d=Lunch~') && !dayLink.includes('v='), `day link: ${dayLink}`)
const p2 = watch(await ctx.newPage())
await p2.goto(mealLink, { waitUntil: 'networkidle' })
await waitBands(p2, 'aa', 2)
assert((await p2.getByTestId('meal-name').count()) === 1 && (await p2.getByTestId('meal-name').inputValue()) === 'Dinner', 'meal link opens just that meal (bands = its foods)')
await p2.goto(dayLink, { waitUntil: 'networkidle' })
await p2.reload({ waitUntil: 'networkidle' })
await waitBands(p2, 'macro', 3)
assert((await p2.getByTestId('meal-name').count()) === 3 && (await p2.getByTestId('views').getByRole('tab', { name: 'Day total' }).getAttribute('aria-selected')) === 'true', 'day link opens all 3 meals in day view')

// ---- legacy link ----
await p2.goto(url('#f=172421:200,168878:150&r=Dal+%26+rice&m=who&c=vit'), { waitUntil: 'networkidle' })
await p2.reload({ waitUntil: 'networkidle' })
await waitBands(p2, 'aa', 2)
h = await hash(p2)
assert(h === '#d=Dal+%26+rice~172421:200,168878:150&a=who', `legacy #f=&r=&m=who link migrated: ${h}`)
assert((await p2.getByTestId('meal-name').inputValue()) === 'Dal & rice' && await p2.getByTestId('aa-unit').getByRole('tab', { name: '% need' }).getAttribute('aria-selected') === 'true', 'legacy recipe name + amino mode kept')

// ---- long state is lz-compressed ----
const ids = [169961, 171477, 172421, 168878, 321360, 173905, 173944, 171265, 175168, 170093, 170379, 168462]
const longHash = '#d=' + Array.from({ length: 14 }, (_, i) => `Meal+${i + 1}~` + ids.map((id, j) => `${id}:${10 + i + j}`).join(',')).join(';')
await p2.goto(url(longHash), { waitUntil: 'networkidle' })
await p2.reload({ waitUntil: 'networkidle' })
await waitBands(p2, 'macro', 14)
const z = await hash(p2)
assert(z.startsWith('#z=') && z.length < longHash.length, `long day (${longHash.length} chars) compressed to ${z.length} chars`)
await p2.reload({ waitUntil: 'networkidle' })
await waitBands(p2, 'macro', 14)
assert((await p2.getByTestId('meal-name').count()) === 14, 'compressed link restores 14 meals')

// ---- mobile + dark ----
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 })
const mp = watch(await m.newPage())
await mp.goto(dayLink, { waitUntil: 'networkidle' })
await waitBands(mp, 'macro', 3)
assert(!(await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'no horizontal overflow on mobile')
const xs = await mp.locator('.chart-card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)))
assert(new Set(xs).size === 1, 'mobile: charts stacked in one column')
await mp.screenshot({ path: `${shots}/aminosplore-mobile-dark.png`, fullPage: true })
{
  const ms = mp.getByTestId('meal-1').getByTestId('search')
  await ms.fill('greek yogurt plain')
  await mp.getByTestId('meal-1').getByTestId('results').waitFor({ timeout: 20000 })
  const box = await mp.getByTestId('meal-1').getByTestId('results-pop').boundingBox()
  assert(box.x >= 0 && box.x + box.width <= 390 + 1 && box.height > 100, `mobile: dropdown fits the screen (${Math.round(box.width)}x${Math.round(box.height)} px)`)
  await mp.getByTestId('meal-1').getByTestId('results').getByRole('option').first().tap().catch(() => mp.getByTestId('meal-1').getByTestId('results').getByRole('option').first().dispatchEvent('mousedown'))
  await mp.waitForTimeout(300)
  assert((await mp.getByTestId('meal-1').locator('.item').count()) === 2, 'mobile: picking a result adds it to that meal')
  await ms.fill('banana')
  await mp.getByTestId('meal-1').getByTestId('results').waitFor({ timeout: 20000 })
  await ms.blur(); await ms.focus(); await mp.waitForTimeout(900)
  const top = await mp.getByTestId('meal-1').getByTestId('food-search').evaluate((e) => e.getBoundingClientRect().top)
  assert(top >= 0 && top < 60, `mobile: focused search scrolls to the top of the screen (top ${Math.round(top)} px)`)
  await mp.screenshot({ path: `${shots}/aminosplore-mobile-search.png` })
}
const dk = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' })
const dp = watch(await dk.newPage())
await dp.goto(dayLink, { waitUntil: 'networkidle' })
await waitBands(dp, 'macro', 3)
await dp.locator('.charts').screenshot({ path: `${shots}/aminosplore-charts-dark.png` })
await page.goto(dayLink, { waitUntil: 'networkidle' })
await page.reload({ waitUntil: 'networkidle' })
await waitBands(page, 'macro', 3)
await page.getByTestId('meal-2').getByTestId('search').fill('salmon atlantic')
await page.getByTestId('meal-2').getByTestId('results').waitFor()
await page.screenshot({ path: `${shots}/aminosplore-day-search.png`, fullPage: true })

log('db stats:', (await page.getByTestId('dbstats').textContent()).replace(/\s+/g, ' ').trim())
assert(badResp.length === 0, 'all DB responses are 206 without Content-Encoding ' + badResp.join('; '))
assert(ranges.length > 0 && ranges.every((r) => !r.startsWith('GET no-range')), `no full-file GET of the DB (${ranges.length} requests)`)
assert(errors.length === 0, 'no page errors / Vue warnings ' + errors.join('\n'))
await browser.close()
console.log('ALL PASSED')
