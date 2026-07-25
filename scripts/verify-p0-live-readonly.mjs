const baseUrl = (process.env.P0_SMOKE_BASE_URL ?? 'https://www.tasyunufiyatlari.com').replace(/\/$/, '')
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error('Supabase URL, anon key ve service-role key bu salt-okunur kontrolde gereklidir.')
  process.exit(2)
}

const failures = []
const passes = []

function pass(message) {
  passes.push(message)
  console.log(`GEÇTİ: ${message}`)
}

function fail(message) {
  failures.push(message)
  console.error(`BAŞARISIZ: ${message}`)
}

async function jsonOrNull(response) {
  return response.json().catch(() => null)
}

function supabaseHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  }
}

async function expectStatus(label, path, init, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    ...init,
  })
  if (response.status === expectedStatus) {
    pass(`${label}: HTTP ${expectedStatus}`)
  } else {
    fail(`${label}: HTTP ${response.status}; beklenen ${expectedStatus}`)
  }
}

async function checkSensitiveTable(table) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/${table}?select=id&limit=1`,
    { headers: supabaseHeaders(anonKey, { Prefer: 'count=exact' }) },
  )
  const rows = await jsonOrNull(response)
  if (response.ok && Array.isArray(rows) && rows.length === 0) {
    pass(`Anon ${table} SELECT sonucu 0 satır`)
  } else {
    fail(`Anon ${table} hassas satır görünürlüğü kapalı değil`)
  }
}

async function findFirstStorageObject(prefix = '', depth = 0) {
  if (depth > 5) return null
  const response = await fetch(`${supabaseUrl}/storage/v1/object/list/quote-pdfs`, {
    method: 'POST',
    headers: supabaseHeaders(serviceKey, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      prefix,
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    }),
  })
  const entries = await jsonOrNull(response)
  if (!response.ok || !Array.isArray(entries)) return null

  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.id) return path
    const nested = await findFirstStorageObject(path, depth + 1)
    if (nested) return nested
  }
  return null
}

console.log(`P0 canlı salt-okunur smoke: ${baseUrl}`)

await expectStatus(
  'Import handler auth',
  '/api/import',
  { method: 'POST', body: new FormData() },
  401,
)
await expectStatus(
  'Bulk insert handler auth',
  '/api/products/bulk-insert',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  },
  401,
)
await expectStatus(
  'PDF capability kapısı',
  '/api/upload-pdf',
  { method: 'POST', body: new FormData() },
  403,
)

await checkSensitiveTable('quotes')
await checkSensitiveTable('quote_funnel_events')

const brandsResponse = await fetch(
  `${supabaseUrl}/rest/v1/brands?select=id&limit=1`,
  { headers: supabaseHeaders(anonKey) },
)
const brands = await jsonOrNull(brandsResponse)
if (brandsResponse.ok && Array.isArray(brands) && brands.length > 0) {
  pass('Anon katalog SELECT açık')
} else {
  fail('Anon katalog SELECT çalışmıyor')
}

const bucketResponse = await fetch(`${supabaseUrl}/storage/v1/bucket/quote-pdfs`, {
  headers: supabaseHeaders(serviceKey),
})
const bucket = await jsonOrNull(bucketResponse)
if (bucketResponse.ok && bucket?.public === false) {
  pass('quote-pdfs bucket private')
} else {
  fail(`quote-pdfs bucket private değil (public=${String(bucket?.public)})`)
}

const objectPath = await findFirstStorageObject()
if (objectPath) {
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/quote-pdfs/${objectPath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
  const publicResponse = await fetch(publicUrl, { method: 'HEAD', redirect: 'manual' })
  if (publicResponse.status !== 200) {
    pass(`Anon public PDF URL kapalı: HTTP ${publicResponse.status}`)
  } else {
    fail('Anon public PDF URL hâlâ HTTP 200')
  }
} else {
  console.log('BİLGİ: Bucket boş veya nesne listelenemedi; public nesne HEAD testi atlandı.')
}

// Tekno fiyat kuralları bekçisi (karar: 2026-07-23).
// Tedarikçi listesi KDV hariçtir; is_kdv_included=true sızarsa motor
// olmayan KDV'yi ayırıp ~%16,7 düşük satar. İskonto zinciri ortak
// kararıyla 40+5'tir. Yanlış import bu kontrolle kırmızıya düşer.
const teknoResponse = await fetch(
  `${supabaseUrl}/rest/v1/accessories?select=slug,is_kdv_included,discount_1,discount_2&brand_id=eq.6&is_active=eq.true`,
  { headers: supabaseHeaders(serviceKey) },
)
const teknoRows = await jsonOrNull(teknoResponse)
if (!teknoResponse.ok || !Array.isArray(teknoRows) || teknoRows.length === 0) {
  fail('Tekno (brand_id=6) aksesuar satırları okunamadı')
} else {
  const bozuk = teknoRows.filter(
    (r) => r.is_kdv_included !== false || r.discount_1 !== 40 || r.discount_2 !== 5,
  )
  if (bozuk.length === 0) {
    pass(`Tekno fiyat kuralları doğru (${teknoRows.length} satır: KDV hariç, iskonto 40+5)`)
  } else {
    fail(`Tekno fiyat kuralı ihlali: ${bozuk.map((r) => r.slug).join(', ')}`)
  }
}

const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/submit_quote_guarded`, {
  method: 'POST',
  headers: supabaseHeaders(serviceKey, { 'Content-Type': 'application/json' }),
  body: JSON.stringify({
    p_quote_payload: null,
    p_idempotency_hash: null,
    p_request_fingerprint: null,
    p_phone_hash: null,
    p_ip_hash: null,
  }),
})
const rpcBody = await jsonOrNull(rpcResponse)
if (rpcResponse.status === 404 || rpcBody?.code === 'PGRST202') {
  fail('submit_quote_guarded RPC canlı şemada yok')
} else if (rpcResponse.status >= 400 && rpcResponse.status < 500) {
  pass('submit_quote_guarded RPC mevcut ve geçersiz girdiyi yan etkisiz reddetti')
} else {
  fail(`submit_quote_guarded beklenmeyen HTTP ${rpcResponse.status}`)
}

console.log(`\nSonuç: ${passes.length} geçti, ${failures.length} başarısız.`)
if (failures.length > 0) process.exit(1)

