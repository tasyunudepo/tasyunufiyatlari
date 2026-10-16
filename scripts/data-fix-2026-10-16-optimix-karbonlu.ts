// Optimix Karbonlu kaydını diğer levhalarla aynı düzene alır ve eski
// tekliflerde saklı "Optimix Optimix" tekrarlarını temizler (Emrah, 16 Ekim 2026).
//
// Ürün 42 diğer 32 levhadan farklıydı: short_name'e marka da yazılmıştı.
//   short_name  "Optimix Karbonlu"          → "Karbonlu"
//   name        "Optimix Optimix Karbonlu"  → "Optimix Karbonlu"
//   slug        optimix-optimix-karbonlu-eps → optimix-karbonlu-eps
//   image_cover .../optimix-optimix-karbonlu-eps.webp → .../optimix-karbonlu-eps.webp
// Eski adres ürün sayfasında yeni adrese kalıcı yönlenir (RENAMED_PRODUCT_SLUGS,
// lib/catalog/slug.ts). Görselin yeni adlı kopyası storage'da hazır; eskisi silinmez.
//
// Kuru çalıştırma (varsayılan) yalnız ne değişeceğini yazar:
//   npx tsx --env-file=.env.local scripts/data-fix-2026-10-16-optimix-karbonlu.ts
// Uygulamak için:
//   npx tsx --env-file=.env.local scripts/data-fix-2026-10-16-optimix-karbonlu.ts --uygula
//
// Geri alma: önce alınan yedekler reports/optimix-tekrar-2026-10-16/ altında
// (yedek-plate-42.json, yedek-teklifler-14.json); aynı alanlar geri yazılır.

import { collapseRepeatedWords } from '../lib/catalog/productLabel'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli (.env.local)')

const apply = process.argv.includes('--uygula')
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

const PLATE_ID = 42
const PLATE_FIX = {
  name: 'Optimix Karbonlu',
  short_name: 'Karbonlu',
  slug: 'optimix-karbonlu-eps',
  image_cover: `${url}/storage/v1/object/public/product-images/optimix-karbonlu-eps.webp`,
}

const QUOTE_TEXT_FIELDS = ['model_name', 'package_name', 'package_description', 'plate_brand_name'] as const
const REPEAT = /(optimix|expert|tekno|bonus|fawori|dalmaçyalı)\s+\1/i

function cleanDeep(value: unknown): unknown {
  if (typeof value === 'string') return collapseRepeatedWords(value)
  if (Array.isArray(value)) return value.map(cleanDeep)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanDeep(v)]))
  }
  return value
}

async function main() {
  console.log(apply ? '== UYGULAMA ==' : '== KURU ÇALIŞTIRMA (yazma yok; uygulamak için --uygula) ==')

  // 1) Ürün 42
  const [plate] = await rest<Array<Record<string, unknown>>>(`plates?select=id,name,short_name,slug,image_cover&id=eq.${PLATE_ID}`)
  const imageOk = (await fetch(PLATE_FIX.image_cover, { method: 'HEAD' })).ok
  if (!imageOk) throw new Error(`Yeni görsel yok: ${PLATE_FIX.image_cover}`)
  for (const [field, next] of Object.entries(PLATE_FIX)) {
    console.log(`ürün ${PLATE_ID} ${field}: ${JSON.stringify(plate[field])} → ${JSON.stringify(next)}`)
  }
  if (apply) {
    await rest(`plates?id=eq.${PLATE_ID}`, { method: 'PATCH', body: JSON.stringify(PLATE_FIX), headers: { Prefer: 'return=minimal' } }).catch(async (e) => {
      // return=minimal boş gövde döner; json() hatası başarıdır.
      if (!String(e).includes('JSON')) throw e
    })
  }

  // 2) Eski teklifler
  const quotes = await rest<Array<Record<string, unknown>>>(
    `quotes?select=id,${QUOTE_TEXT_FIELDS.join(',')},package_items&order=id`,
  )
  let changed = 0
  for (const q of quotes) {
    const patch: Record<string, unknown> = {}
    for (const field of QUOTE_TEXT_FIELDS) {
      const before = q[field]
      if (typeof before === 'string' && REPEAT.test(before)) patch[field] = collapseRepeatedWords(before)
    }
    if (q.package_items != null && REPEAT.test(JSON.stringify(q.package_items))) {
      patch.package_items = cleanDeep(q.package_items)
    }
    if (Object.keys(patch).length === 0) continue
    changed++
    for (const [field, next] of Object.entries(patch)) {
      const show = (v: unknown) => (field === 'package_items' ? '(kalem listesi)' : JSON.stringify(v))
      console.log(`teklif ${q.id} ${field}: ${show(q[field])} → ${show(next)}`)
    }
    if (apply) {
      const res = await fetch(`${url}/rest/v1/quotes?id=eq.${q.id}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(`teklif ${q.id}: ${res.status} ${await res.text()}`)
    }
  }
  console.log(`${changed} teklif ${apply ? 'güncellendi' : 'güncellenecek'}.`)

  if (apply) {
    const [after] = await rest<Array<Record<string, unknown>>>(`plates?select=name,short_name,slug,image_cover&id=eq.${PLATE_ID}`)
    console.log('ürün 42 şimdi:', after)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
