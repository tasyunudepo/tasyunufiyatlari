import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { SITE_QUOTE_VALIDITY_DAYS, formatValidUntil, offerValidUntil } from '@/lib/quote/validity'
import { getOfferValidityDate } from '@/lib/utils/packageHelpers'

// Teklif geçerliliği (Emrah kararı, 13 Ekim 2026): site teklifleri 3 gün
// geçerlidir. Bundan önce sihirbaz ve ürün sayfası "geçerlilik" alanına
// teklifin üretildiği anı yazıyordu; gerçek süre yalnız ofis teklifinde vardı.

describe('teklif geçerliliği', () => {
  it('site teklifleri 3 gün geçerlidir', () => {
    expect(SITE_QUOTE_VALIDITY_DAYS).toBe(3)
  })

  it('son gün, düzenleme gününden 3 gün sonradır', () => {
    // 6 Ekim 2026 17:51 (TSİ) → 9 Ekim 2026
    const issued = new Date('2026-10-06T17:51:00+03:00')
    expect(formatValidUntil(offerValidUntil(issued))).toBe('09.10.2026')
  })

  it('ay ve yıl sonunu doğru geçer', () => {
    expect(formatValidUntil(offerValidUntil(new Date('2026-10-30T10:00:00+03:00')))).toBe('02.11.2026')
    expect(formatValidUntil(offerValidUntil(new Date('2026-12-30T10:00:00+03:00')))).toBe('02.01.2027')
  })

  it('gece yarısına yakın düzenlenen teklifte gün Türkiye saatine göre sayılır', () => {
    // 6 Ekim 23:30 TSİ = 20:30 UTC; son gün 9 Ekim olmalı.
    expect(formatValidUntil(offerValidUntil(new Date('2026-10-06T20:30:00Z')))).toBe('09.10.2026')
    // 7 Ekim 00:30 TSİ = 6 Ekim 21:30 UTC; son gün 10 Ekim olmalı.
    expect(formatValidUntil(offerValidUntil(new Date('2026-10-06T21:30:00Z')))).toBe('10.10.2026')
  })

  it('ofis teklifi kendi gün sayısını verir', () => {
    expect(formatValidUntil(offerValidUntil(new Date('2026-10-06T12:00:00+03:00'), 7))).toBe('13.10.2026')
  })

  it('eski yardımcı artık üretim anını değil son geçerlilik gününü döndürür', () => {
    const today = formatValidUntil(new Date())
    expect(getOfferValidityDate()).toMatch(/^\d{2}\.\d{2}\.\d{4}$/)
    expect(getOfferValidityDate()).not.toBe(today)
  })

  it('üç akış da aynı kaynağı kullanır', () => {
    const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')
    expect(read('components/catalog/SingleProductQuoteButton.tsx')).not.toContain(
      "validityDate:       new Date().toLocaleString('tr-TR')",
    )
    expect(read('components/catalog/SingleProductQuoteButton.tsx')).toContain('validityDate:       getOfferValidityDate()')
    expect(read('lib/quote/buildManualPdfData.ts')).toContain("from '@/lib/quote/validity'")
  })
})
