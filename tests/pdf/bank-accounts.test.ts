import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { SELLER_BANK_ACCOUNTS } from '@/lib/pdf/orderProcess'

// Teklif PDF'i ve Sipariş Onay Formu'ndaki banka hesapları (15 Ekim 2026).
//
// Vakıfbank IBAN'ı tek hanesi yanlış yazılmıştı: `…5800 7223 2324 14`.
// Bu numara sağlama basamağını (ISO 13616, mod-97) geçmez; banka havaleyi
// reddeder. Doğrusu `…5800 7323 2324 14` (şirket banka tablosu; alçı
// deposunda 2 Ekim 2026'da aynı düzeltme yapıldı:
// alcifiyatlari/docs/verification/iban-kapisi-2026-10-02.md).

function ibanValid(iban: string): boolean {
  const s = iban.replace(/\s/g, '').toUpperCase()
  if (!/^TR\d{24}$/.test(s)) return false
  const r = s.slice(4) + s.slice(0, 4)
  // Basamak basamak mod-97: sayı JavaScript tamsayı sınırını aşmaz.
  const digits = [...r].map((c) => parseInt(c, 36)).join('')
  let rest = 0
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97
  return rest === 1
}

// İkinci göz: hesaplar burada ayrıca, hane hane yazılıdır.
const EXPECTED = [
  { bank: 'KUVEYTTÜRK', code: '00205', iban: 'TR22 0020 5000 0947 0027 8000 01' },
  { bank: 'VAKIFBANK', code: '00015', iban: 'TR54 0001 5001 5800 7323 2324 14' },
]

describe('banka hesapları', () => {
  it('teklifte yazılan hesaplar şirket tablosuyla hane hane aynıdır', () => {
    expect(SELLER_BANK_ACCOUNTS.map((a) => ({ bank: a.bank, iban: a.iban }))).toEqual(
      EXPECTED.map(({ bank, iban }) => ({ bank, iban })),
    )
  })

  it('her IBAN sağlama basamağını (mod-97) geçer ve banka kodu banka adıyla uyuşur', () => {
    for (const [i, account] of SELLER_BANK_ACCOUNTS.entries()) {
      expect(ibanValid(account.iban), account.bank).toBe(true)
      expect(account.iban.replace(/\s/g, '').slice(4, 9), account.bank).toBe(EXPECTED[i].code)
    }
  })

  it('eski yanlış Vakıfbank numarası sağlamadan geçmez ve kaynakta kalmamıştır', () => {
    expect(ibanValid('TR54 0001 5001 5800 7223 2324 14')).toBe(false)
    for (const file of ['lib/pdf/orderProcess.ts', 'scripts/generate-blank-quote-template.js']) {
      expect(readFileSync(resolve(process.cwd(), file), 'utf8'), file).not.toMatch(/5800 ?7223/)
    }
  })
})
