// accessories.short_name içindeki bozuk Türkçe karakterleri onarır.
//
// SORUN (27 Temmuz 2026): 134 aksesuarın 18'inde `short_name` bozuk:
//   "?elik D?bel 11.5"   →  olması gereken "Çelik Dübel 11.5"
//   "Plastik D?bel 17.5" →  "Plastik Dübel 17.5"
//   "D?bel Pulu"         →  "Dübel Pulu"
//
// Bu adlar /ofis teklif ekranında ve MÜŞTERİYE GİDEN PDF'te görünüyor.
//
// Neden tahmin değil: aynı satırın `name` kolonu SAĞLAM
// ("Dalmaçyalı Taşyünü Dübeli Çelik Çivili 11,5cm 200 adet"). Yani doğru
// harfler yan sütunda duruyor; script her düzeltmeyi `name` ile doğrular ve
// doğrulayamadığı satıra DOKUNMAZ.
//
// Kullanım:
//   node scripts/fix-accessory-mojibake.mjs           → kuru çalışma (yazmaz)
//   node scripts/fix-accessory-mojibake.mjs --uygula  → veritabanına yazar

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

const UYGULA = process.argv.includes('--uygula')

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY
if (!url || !key) {
  console.error('.env.local içinde NEXT_PUBLIC_SUPABASE_URL ve service role anahtarı gerekli.')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

/**
 * Bozuk kalıp → doğru karşılık.
 * Sıra önemli: uzun kalıplar önce.
 */
const DUZELTMELER = [
  [/\?elik/g, 'Çelik'],
  [/\?ELİK/g, 'ÇELİK'],
  [/D\?bel/g, 'Dübel'],
  [/D\?BEL/g, 'DÜBEL'],
]

function onar(metin) {
  let sonuc = metin
  for (const [kalip, karsilik] of DUZELTMELER) sonuc = sonuc.replace(kalip, karsilik)
  return sonuc
}

/**
 * Onarılan metnin doğruluğunu `name` kolonundan doğrular.
 * short_name'deki her kelime (sayılar ve noktalama hariç) name içinde
 * geçmelidir — geçmiyorsa düzeltme şüphelidir, satır atlanır.
 */
function dogrula(onarilmis, name) {
  if (!name) return false
  const normalize = (s) => s.toLocaleLowerCase('tr-TR').replace(/[^\p{L}]/gu, '')
  const hedef = normalize(name)
  const kelimeler = onarilmis
    .split(/\s+/)
    .map((k) => normalize(k))
    .filter((k) => k.length >= 3)
  return kelimeler.every((k) => hedef.includes(k))
}

const { data: rows, error } = await sb
  .from('accessories')
  .select('id, name, short_name')

if (error) {
  console.error('Aksesuarlar okunamadı:', error.message)
  process.exit(1)
}

const bozuklar = rows.filter((r) => /\?/.test(r.short_name ?? ''))

console.log(`Toplam aksesuar: ${rows.length}`)
console.log(`Bozuk short_name: ${bozuklar.length}`)
console.log(UYGULA ? '\nMOD: UYGULA (veritabanına yazılacak)\n' : '\nMOD: kuru çalışma (yazılmayacak)\n')

const uygulanacak = []
const atlananlar = []

for (const r of bozuklar) {
  const yeni = onar(r.short_name)
  if (yeni === r.short_name) {
    atlananlar.push({ ...r, sebep: 'bilinen kalıba uymuyor' })
    continue
  }
  if (/\?/.test(yeni)) {
    atlananlar.push({ ...r, sebep: `onarımdan sonra hâlâ "?" var: ${yeni}` })
    continue
  }
  if (!dogrula(yeni, r.name)) {
    atlananlar.push({ ...r, sebep: `name kolonuyla doğrulanamadı (name: ${r.name})` })
    continue
  }
  uygulanacak.push({ id: r.id, eski: r.short_name, yeni, name: r.name })
}

console.log(`=== DOĞRULANAN DÜZELTMELER (${uygulanacak.length}) ===`)
for (const d of uygulanacak) {
  console.log(`  #${String(d.id).padStart(3)}  ${JSON.stringify(d.eski).padEnd(26)} → ${JSON.stringify(d.yeni)}`)
}

if (atlananlar.length > 0) {
  console.log(`\n=== ATLANANLAR (${atlananlar.length}) — elle bakılmalı ===`)
  for (const a of atlananlar) {
    console.log(`  #${a.id} ${JSON.stringify(a.short_name)} — ${a.sebep}`)
  }
}

if (!UYGULA) {
  console.log('\nYazmak için: node scripts/fix-accessory-mojibake.mjs --uygula')
  process.exit(0)
}

let basarili = 0
for (const d of uygulanacak) {
  const { error: upErr } = await sb
    .from('accessories')
    .update({ short_name: d.yeni })
    .eq('id', d.id)
  if (upErr) {
    console.error(`  ✗ #${d.id} yazılamadı: ${upErr.message}`)
    continue
  }
  basarili += 1
}

console.log(`\n✓ ${basarili}/${uygulanacak.length} kayıt güncellendi.`)

// Doğrulama turu
const { data: kontrol } = await sb.from('accessories').select('id, short_name')
const kalan = (kontrol ?? []).filter((r) => /\?/.test(r.short_name ?? ''))
console.log(`Kalan bozuk kayıt: ${kalan.length}`)
for (const k of kalan) console.log(`  #${k.id} ${JSON.stringify(k.short_name)}`)
process.exit(kalan.length > 0 && atlananlar.length === 0 ? 1 : 0)
