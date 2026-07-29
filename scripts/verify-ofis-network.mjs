// /ofis ağ davranışı ölçümü — audit AC-05 ve AC-08.
//
// Öncesi (26 Temmuz 2026): DashboardTab, QuotesTab ve ExperimentsTab üçü de
// /api/admin/quotes'u bağımsız çekiyordu; dört sekmelik gezintide 7 çağrı,
// her biri ~114 KB ve tam müşteri PII'si.
//
// Kullanım:  node scripts/verify-ofis-network.mjs [taban-url]
// Varsayılan taban: http://localhost:3000 (dev sunucusu açık olmalı)
// Kimlik .env.local'den okunur.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pw from '@playwright/test'

const { chromium } = pw

const BASE = process.argv[2] ?? 'http://localhost:3000'
const LIMIT_QUOTES = 2
const envPath = resolve(process.cwd(), '.env.local')

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

if (!env.ADMIN_PASSWORD) {
  console.error('.env.local içinde ADMIN_PASSWORD yok.')
  process.exit(1)
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  httpCredentials: { username: env.ADMIN_USER || 'admin', password: env.ADMIN_PASSWORD },
})
const page = await context.newPage()

const istekler = []
const konsolUyarilari = []

page.on('request', (r) => {
  const url = r.url()
  if (url.includes('/api/admin/')) istekler.push(url.replace(BASE, '').split('?')[0])
})
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') {
    konsolUyarilari.push(`${m.type()}: ${m.text().slice(0, 120).replace(/\s+/g, ' ')}`)
  }
})

await page.goto(`${BASE}/ofis`, { waitUntil: 'networkidle' })

// Gerçek bir operatör gezintisi: sekmeler arasında gidip gel.
for (const sekme of ['Teklifler', 'Satış Deneyleri', 'Genel Bakış', 'Teklifler', 'Analiz']) {
  await page.getByRole('button', { name: sekme }).first().click()
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1000)
}

const sayim = {}
for (const u of istekler) sayim[u] = (sayim[u] || 0) + 1

const quotesCagri = sayim['/api/admin/quotes'] ?? 0
const benzersizUyari = [...new Set(konsolUyarilari)]

console.log('\n=== /ofis ağ ölçümü ===')
console.log(`Taban: ${BASE}`)
for (const [u, n] of Object.entries(sayim).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(2)} × ${u}`)
}
console.log(`\nToplam admin isteği: ${istekler.length}`)
console.log(`Konsol hata/uyarı (benzersiz): ${benzersizUyari.length}`)
for (const u of benzersizUyari) console.log(`  - ${u}`)

await browser.close()

let hata = false
if (quotesCagri > LIMIT_QUOTES) {
  console.error(`\n✗ AC-05 BAŞARISIZ: /api/admin/quotes ${quotesCagri} kez çağrıldı (sınır ${LIMIT_QUOTES}).`)
  hata = true
} else {
  console.log(`\n✓ AC-05: /api/admin/quotes ${quotesCagri} çağrı (sınır ${LIMIT_QUOTES}).`)
}

if (benzersizUyari.length > 0) {
  console.error(`✗ AC-08 BAŞARISIZ: ${benzersizUyari.length} konsol hata/uyarısı var.`)
  hata = true
} else {
  console.log('✓ AC-08: konsol temiz.')
}

process.exit(hata ? 1 : 0)
