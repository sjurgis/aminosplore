// End-to-end smoke test: node tests/e2e.mjs [baseUrl] [screenshotDir]
import { chromium } from 'playwright'
const base = process.argv[2] || 'http://localhost:4173/'
const shots = process.argv[3] || '/tmp'
const log = (...a) => console.log('•', ...a)
const assert = (c, m) => { if (!c) { throw new Error('ASSERT: ' + m) } log('ok:', m) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
const ranges = [], badResp = []
page.on('response', async (r) => {
  if (!r.url().includes('foods.sqlite3') || r.request().method() !== 'GET') return
  const h = await r.allHeaders()
  if (r.status() !== 206 || h['content-encoding']) badResp.push(`${r.status()} ${h['content-encoding'] || ''} ${h['content-range'] || ''}`)
})
page.on('request', (r) => { if (r.url().includes('foods.sqlite3')) ranges.push(r.method() + ' ' + (r.headers()['range'] || 'no-range')) })

await page.goto(base, { waitUntil: 'networkidle' })
const search = page.getByTestId('search')

async function addFood(q, pick) {
  await search.fill(q)
  await page.getByTestId('results').waitFor({ timeout: 20000 })
  const opt = pick ? page.getByRole('option', { name: pick }).first() : page.getByRole('option').first()
  const name = (await opt.locator('.r-name').textContent()).trim()
  await opt.dispatchEvent('mousedown')
  log('added', name)
  return name
}
const t0 = Date.now()
const a = await addFood('lentils cooked boiled', /Lentils, mature seeds, cooked, boiled, without salt/)
log('search+add took', Date.now() - t0, 'ms')
const b = await addFood('rice white long grain cooked')
await page.waitForFunction(() => document.querySelectorAll('[data-testid=items] li').length === 2)
assert(true, '2 foods in list')
const grams = page.getByTestId('grams')
await grams.nth(0).fill('200')
await grams.nth(1).fill('150')
await page.waitForTimeout(300)
let hash = await page.evaluate(() => location.hash)
assert(/^#f=\d+:200,\d+:150$/.test(hash), `URL hash updated: ${hash}`)
const bands = await page.locator('[data-testid=radar] path.band').count()
assert(bands === 2, `stacked radar has 2 bands: ${bands}`)
assert(await page.locator('[data-testid=radar] .total-line polygon').count() === 1, 'outer total outline drawn')
const axes = await page.locator('[data-testid=radar] .axis-labels text').allTextContents()
assert(axes.length === 9 && axes.some((t) => t.includes('Trp')), `9 axes incl. tryptophan: ${axes.join(',')}`)
const macroTotal = await page.locator('[data-testid=macros] tfoot td').allTextContents()
assert(macroTotal.length === 9, `macros total row: ${macroTotal.join(' | ')}`)
await page.screenshot({ path: `${shots}/aminosplore-2foods.png`, fullPage: true })

// stacked sums: in every mode each food column <= total and columns add up to the total
async function tableCheck(p, label) {
  const rows = await p.locator('[data-testid=aa-table] tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())))
  const nFoods = await p.locator('[data-testid=radar] path.band').count()
  for (const r of rows) {
    const foods = r.slice(1, 1 + nFoods).map(Number), total = Number(r[1 + nFoods])
    const sum = foods.reduce((a, b) => a + b, 0)
    const half = (t) => 0.5 * 10 ** -((t.split('.')[1] || '').length) // display rounding of one cell
    const tol = r.slice(1, 2 + nFoods).reduce((a, t) => a + half(t), 0) + 1e-9
    if (!(foods.every((v, i) => v <= total + half(r[1 + i]) + half(r[1 + nFoods])) && Math.abs(sum - total) <= tol)) throw new Error(`${label}: row ${r.join(' | ')} does not stack`)
  }
  log('ok:', label, 'stacked columns add up,', rows[2].join(' | '))
}
for (const m of ['Amount', 'Per 100 g', 'Per g protein', '% daily need']) {
  await page.getByTestId('modes').getByRole('tab', { name: m }).click()
  await page.waitForTimeout(150)
  await tableCheck(page, m)
}
await page.getByTestId('modes').getByRole('tab', { name: 'Amount' }).click()

// mode switch
await page.getByTestId('modes').getByRole('tab', { name: '% daily need' }).click()
await page.waitForTimeout(200)
hash = await page.evaluate(() => location.hash)
assert(hash.includes('m=who'), `mode in hash: ${hash}`)
const whoAxes = await page.locator('[data-testid=radar] .axis-labels text').allTextContents()
assert(whoAxes.some((t) => t.includes('Met+Cys')), 'WHO mode uses Met+Cys / Phe+Tyr')

// reload restores state
await page.reload({ waitUntil: 'networkidle' })
await page.waitForFunction(() => document.querySelectorAll('[data-testid=items] .item-name:not(.muted)').length === 2, null, { timeout: 20000 })
const names = await page.locator('[data-testid=items] .item-name').allTextContents()
assert(names[0] === a && names[1] === b, `reload restored foods: ${names.join(' / ')}`)
assert((await grams.nth(0).inputValue()) === '200', 'reload restored grams')
assert(await page.getByRole('tab', { name: '% daily need' }).getAttribute('aria-selected') === 'true', 'reload restored mode')

// recipe: name it, copy link, open in fresh page
await page.getByTestId('recipe-name').fill('Dal & rice')
await page.waitForTimeout(200)
hash = await page.evaluate(() => location.hash)
assert(hash.includes('r=Dal+%26+rice'), `recipe name in hash: ${hash}`)
await page.getByTestId('share').click()
const link = await page.evaluate(() => navigator.clipboard.readText())
assert(link.endsWith(hash), `copied link = current URL: ${link}`)
await page.getByTestId('save').click()
const p2 = await ctx.newPage()
p2.on('pageerror', (e) => errors.push(String(e)))
await p2.goto(link, { waitUntil: 'networkidle' })
await p2.waitForFunction(() => document.querySelectorAll('[data-testid=items] .item-name:not(.muted)').length === 2, null, { timeout: 20000 })
assert((await p2.locator('.chart-card h2').textContent()) === 'Dal & rice', 'recipe link shows recipe name as title')
assert((await p2.getByTestId('recipe-name').inputValue()) === 'Dal & rice', 'recipe name field restored')
assert(await p2.locator('.legend li', { hasText: 'Dal & rice' }).count() === 1, 'combined series named after recipe')
await p2.getByRole('tab', { name: 'Per g protein' }).click()
await p2.waitForTimeout(200)
assert(await p2.locator('.legend li', { hasText: 'WHO adult pattern' }).count() === 1, 'per-g-protein shows WHO reference')
const score = await p2.locator('.scores li.total').textContent()
log('combined score row:', score.replace(/\s+/g, ' '))
await p2.screenshot({ path: `${shots}/aminosplore-recipe.png`, fullPage: true })

// mobile + dark
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 })
const mp = await m.newPage()
await mp.goto(link.replace(/m=\w+/, 'm=amount'), { waitUntil: 'networkidle' })
await mp.waitForFunction(() => document.querySelectorAll('[data-testid=items] .item-name:not(.muted)').length === 2, null, { timeout: 20000 })
await mp.screenshot({ path: `${shots}/aminosplore-mobile-dark.png`, fullPage: true })
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
assert(!overflow, 'no horizontal overflow on mobile')

// user-reported case: green beans + chicken; total must be >= chicken alone in absolute modes
const gc = await ctx.newPage()
await gc.goto(base + '#f=169961:150,171477:120', { waitUntil: 'networkidle' })
await gc.waitForFunction(() => document.querySelectorAll('[data-testid=radar] path.band').length === 2, null, { timeout: 20000 })
for (const m of ['Amount', 'Per 100 g', 'Per g protein', '% daily need']) {
  await gc.getByTestId('modes').getByRole('tab', { name: m }).click()
  await gc.waitForTimeout(150)
  await tableCheck(gc, 'beans+chicken ' + m)
  if (m === 'Amount') await gc.screenshot({ path: `${shots}/aminosplore-stacked-amount.png`, fullPage: true })
}
await gc.getByTestId('modes').getByRole('tab', { name: 'Per g protein' }).click()
await gc.locator('.chart-card').screenshot({ path: `${shots}/aminosplore-stacked-protein.png` })
const dk = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: 'dark' })
const dp = await dk.newPage()
await dp.goto(base + '#f=169961:150,171477:120', { waitUntil: 'networkidle' })
await dp.waitForFunction(() => document.querySelectorAll('[data-testid=radar] path.band').length === 2, null, { timeout: 20000 })
await dp.locator('.chart-card').screenshot({ path: `${shots}/aminosplore-stacked-dark.png` })

const st = await page.getByTestId('dbstats').textContent()
log('db stats:', st.replace(/\s+/g, ' ').trim())
log('sqlite requests (first page):', ranges.length, ranges.slice(0, 6).join('; '))
assert(badResp.length === 0, 'all DB responses are 206 without Content-Encoding ' + badResp.join('; '))
assert(ranges.every((r) => !r.startsWith('GET no-range')), 'no full-file GET of the DB')
assert(errors.length === 0, 'no page errors ' + errors.join('\n'))
await browser.close()
console.log('ALL PASSED')
