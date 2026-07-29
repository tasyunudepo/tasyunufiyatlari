import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { normalizePhoneForGuard } from '@/lib/security/quoteSubmissionGuard'

// v24 müşteri kütüğünün doğal anahtarı normalize edilmiş telefondur.
// Aynı normalizasyon İKİ yerde yaşıyor:
//   - TS: lib/security/quoteSubmissionGuard.ts  → normalizePhoneForGuard()
//   - SQL: scripts/migration-v24-musteri-varligi.sql → normalize_phone_tr()
//
// İkisi ayrışırsa aynı müşteri iki kayda bölünür (ya da hiç bağlanmaz).
// Bu test TS tarafını fixture'larla kilitler ve SQL tarafının aynı dalları
// içerdiğini doğrular. Gerçek çalıştırma paritesi migration'ın kendi DO
// bloğundaki dört assertion ile üretimde de kontrol edilir.

const migration = readFileSync(
  fileURLToPath(new URL('../../scripts/migration-v24-musteri-varligi.sql', import.meta.url)),
  'utf8',
)

/** [girdi, beklenen] — geçersizler ayrı testte. */
const GECERLI: Array<[string, string]> = [
  ['0532 123 45 67', '905321234567'],
  ['05321234567', '905321234567'],
  ['5321234567', '905321234567'],
  ['532 123 45 67', '905321234567'],
  ['+90 532 123 45 67', '905321234567'],
  ['+905321234567', '905321234567'],
  ['00905321234567', '905321234567'],
  ['0090 532 123 45 67', '905321234567'],
  ['(0532) 123-45-67', '905321234567'],
  ['0546 653 34 21', '905466533421'],
  ['  05321234567  ', '905321234567'],
  ['+7 900 123 45 67', '79001234567'],
]

const GECERSIZ = ['', '123', '05321', 'abc', '+', '00', '1234567890123456']

describe('telefon normalizasyonu — TS ↔ SQL paritesi', () => {
  it.each(GECERLI)('%s → %s', (input, expected) => {
    expect(normalizePhoneForGuard(input)).toBe(expected)
  })

  it.each(GECERSIZ)('geçersiz girdi reddedilir: %s', (input) => {
    // TS tarafı fırlatır; SQL tarafı NULL döner (trigger'ı düşürmemek için).
    // İkisi de "bu numara müşteri anahtarı olamaz" demektir.
    expect(() => normalizePhoneForGuard(input)).toThrow()
  })

  it('SQL fonksiyonu TS ile aynı dalları içerir', () => {
    // 00 öneki kırpılır
    expect(migration).toContain("left(v_digits, 2) = '00'")
    // Uluslararası önek algısı (+ veya 00)
    expect(migration).toContain("left(v_raw, 1) = '+' OR left(v_raw, 2) = '00'")
    // 11 haneli 0-önekli → 90 + kalan
    expect(migration).toContain("length(v_digits) = 11 AND left(v_digits, 1) = '0'")
    // 10 haneli → 90 + tamamı
    expect(migration).toContain('length(v_digits) = 10')
    // 10..15 hane sınırı
    expect(migration).toContain('length(v_digits) < 10 OR length(v_digits) > 15')
    // Geçersizde NULL (fırlatmaz — trigger'ı düşürmemeli)
    expect(migration).toMatch(/length\(v_digits\) < 10[\s\S]{0,80}RETURN NULL/)
  })

  it('SQL fonksiyonu IMMUTABLE — indeks ve generated kolonlarda güvenli', () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.normalize_phone_tr[\s\S]{0,200}IMMUTABLE/)
  })
})

describe('v24 migration güvenlik sözleşmesi', () => {
  it('quotes tablosuna eklenen kolonların hiçbiri NOT NULL değil', () => {
    const alterBlok = migration.slice(
      migration.indexOf('ALTER TABLE public.quotes'),
      migration.indexOf('CREATE INDEX IF NOT EXISTS idx_quotes_customer_id'),
    )
    expect(alterBlok.length).toBeGreaterThan(0)
    // v17 RPC açık kolon listesiyle INSERT ediyor; NOT NULL + DEFAULT'suz
    // bir kolon eklenirse ciro yolu düşer.
    expect(alterBlok).not.toMatch(/NOT NULL/)
  })

  it('müşteri bağlama trigger’ı hatayı yutar (ciro yolu düşmez)', () => {
    const fn = migration.slice(
      migration.indexOf('FUNCTION public.quotes_link_customer'),
      migration.indexOf('DROP TRIGGER IF EXISTS trg_quotes_link_customer'),
    )
    expect(fn).toContain('EXCEPTION WHEN OTHERS THEN')
    expect(fn).toMatch(/customer_link_status := 'failed'[\s\S]{0,60}RETURN NEW/)
  })

  it('yeni tablolarda RLS + FORCE açık ve anon yetkisi geri alınmış', () => {
    for (const table of ['customers', 'customer_interactions']) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(migration).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`)
      expect(migration).toContain(`REVOKE ALL ON public.${table} FROM PUBLIC, anon, authenticated`)
    }
    // Policy açılmamalı — v14 kalıbı: yalnız service role.
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]{0,80}customers/)
  })

  it('KVKK: elle/telefon kaynaklı kayıtta açık rıza uydurulmaz', () => {
    // Rıza yoksa dayanak sözleşme hazırlığıdır; kvkk_consent varsayılanı false.
    expect(migration).toContain('kvkk_consent        BOOLEAN NOT NULL DEFAULT false')
    expect(migration).toContain("'sozlesme_hazirligi'")
    // Otomatik silme kurulmaz (saklama kararı ertelendi).
    expect(migration).not.toContain('purge_expired_customer_data')
    expect(migration).not.toMatch(/DELETE FROM public\.customers/)
  })
})
