import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'

const dbPath = new URL('./public/foods.sqlite3.zip', import.meta.url)
const dbHash = createHash('sha256').update(readFileSync(dbPath)).digest('hex').slice(0, 12)

export default defineConfig({
  base: './',
  plugins: [vue()],
  define: {
    __DB_HASH__: JSON.stringify(dbHash),
    __DB_SIZE__: statSync(dbPath).size,
  },
  build: { target: 'es2020' },
})
