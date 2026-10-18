# Aminosplore

Explore the **essential amino acid profile** and macros of foods and recipes, on a radar ("spiderweb") chart.

Live: https://sjurgis.github.io/aminosplore/

- Search ~8,300 USDA foods (5,073 with a full essential amino acid profile)
- Add several foods with gram quantities (or USDA household portions)
- Stacked radar: each food is a coloured band on top of the previous ones (input order, first food innermost); the outer edge is the meal total
- Chart modes: amount in your portions · per 100 g · mg per g protein vs the WHO adult scoring pattern · % of the WHO adult daily requirement for your body weight
- Amino acid score (limiting amino acid) per food and for the combination
- Macros per food and total: energy, protein, fat, carbs, fiber, sugars, water
- Recipes: name a list of ingredients; everything lives in the URL so links are shareable

## How it works (no backend)

The whole USDA dataset is a single SQLite file (`public/foods.sqlite3.zip`, ~3.2 MB) served as a static file by GitHub Pages.
The browser opens it with [sql.js-httpvfs](https://github.com/phiresky/sql.js-httpvfs), which reads only the 4 KB pages
a query touches using HTTP `Range` requests — a search or loading a shared link typically downloads a few tens of KB.

- Search uses an FTS5 table that holds everything a result row needs, so no lookups into the main table.
- The DB URL carries a content hash (`foods.sqlite3.zip?v=<sha256>`), so a rebuilt DB is never mixed with cached pages of the old one.
- The DB must be served **uncompressed with working Range requests**. GitHub Pages gzips `application/octet-stream`
  on the fly (ranges then point into the compressed stream), so the file is named `.zip` — it is a plain SQLite
  database, the extension just makes Pages serve it raw (`application/x-zip-compressed`, no `Content-Encoding`). A proxy that recompresses
  the file (e.g. Cloudflare orange-cloud in front of Pages) breaks it — use DNS-only for a custom domain.

### URL format

```
#f=<fdcId>:<grams>,<fdcId>:<grams>&r=<recipe name>&m=<amount|per100|protein|who>&w=<body kg>
```

e.g. `#f=172421:200,168878:150&r=Dal+%26+rice&m=protein`. IDs are USDA FoodData Central `fdc_id`s.

## Development

```sh
npm ci
npm run dev                 # http://localhost:5173
npm run build && npx vite preview
node tests/unit.mjs                              # stacked-contribution sums
node tests/e2e.mjs http://localhost:4173/ /tmp   # Playwright end-to-end test (npx playwright install chromium)
```

### Deploying

`npm run deploy` builds and force-pushes `dist/` to the `gh-pages` branch, which GitHub Pages serves.
A ready-made GitHub Actions workflow is in [`ci/deploy-pages.yml`](ci/deploy-pages.yml); to switch to it, move it to
`.github/workflows/` (pushing workflow files needs a token with the `workflow` scope) and set Pages → Source to "GitHub Actions".

### Rebuilding the database

```sh
python3 scripts/build_db.py   # downloads the USDA zips into .fdc-cache/ if needed, writes public/foods.sqlite3.zip
```

The Actions workflow can also rebuild it (`workflow_dispatch` → `rebuild_db`). Layout: `page_size=4096`,
FTS5 (`unicode61`, prefix indexes), `WITHOUT ROWID` portions table clustered by food id, `VACUUM`ed.

Nutrients are mapped by USDA nutrient number (never by position): 501 Trp, 502 Thr, 503 Ile, 504 Leu, 505 Lys,
506 Met, 507 Cys, 508 Phe, 509 Tyr, 510 Val, 512 His; 208 energy (Foundation Foods fall back to Atwater 958/957),
203 protein, 204 fat, 205 carbs, 291 fiber, 269 sugars, 255 water.

## Data & references

- **USDA, Agricultural Research Service. FoodData Central** — SR Legacy (April 2018) and Foundation Foods (April 2026).
  https://fdc.nal.usda.gov/ — public domain (CC0). Values are per 100 g edible portion.
- **WHO/FAO/UNU (2007).** *Protein and amino acid requirements in human nutrition.* WHO Technical Report Series 935.
  Adult requirements (mg/kg/day): His 10, Ile 20, Leu 39, Lys 30, Met+Cys 15, Phe+Tyr 25, Thr 15, Trp 4, Val 26.
  Adult scoring pattern (mg/g protein): His 15, Ile 30, Leu 59, Lys 45, Met+Cys 22, Phe+Tyr 38, Thr 23, Trp 6, Val 39.

Amino acid scores here are not corrected for digestibility (not PDCAAS/DIAAS). Not medical advice.
