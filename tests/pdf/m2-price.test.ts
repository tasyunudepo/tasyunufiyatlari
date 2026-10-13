import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveNetM2Price } from '@/lib/pdf/m2Price'

// Gizli hata (13 Ekim 2026, iki bağımsız incelemede doğrulandı):
// m² fiyatı boş gelirse şablon yedek olarak `grandTotal / metraj` alıyordu.
// `grandTotal` KDV DÂHİL olduğu için bu değer "KDV hariç" diye basılıyor,
// "KDV dâhil" satırında da üstüne bir kez daha %20 ekleniyordu.
//
// Rakamlar gerçek bir tekliften: TE-2026-000238, 1.040 m²,
// ara toplam 470.877,08 ₺, genel toplam 565.052,50 ₺.
const AREA = 1040
const NET = 470877.08
const GROSS = 565052.5

describe('PDF m² fiyatı (KDV hariç taban)', () => {
  it('veride m² fiyatı varsa onu kullanır', () => {
    expect(resolveNetM2Price({ pricePerM2: 452.77, priceWithoutVat: NET, grandTotal: GROSS }, AREA)).toBe(452.77)
  })

  it('m² fiyatı boşsa KDV HARİÇ ara toplamdan hesaplar', () => {
    const price = resolveNetM2Price({ pricePerM2: 0, priceWithoutVat: NET, grandTotal: GROSS }, AREA)
    expect(price).toBeCloseTo(452.77, 2)
    // Eski hatalı sonuç: 565.052,50 / 1.040 = 543,32 (KDV dâhil değer "hariç" diye basılırdı).
    expect(price).not.toBeCloseTo(543.32, 2)
    // "KDV dâhil" satırı bu tabanın 1,2 katıdır: 543,32 olmalı, 651,98 değil.
    expect(price * 1.2).toBeCloseTo(543.32, 1)
  })

  it('ara toplam da yoksa genel toplamdan KDV\'yi ayırır', () => {
    const price = resolveNetM2Price({ pricePerM2: 0, priceWithoutVat: 0, grandTotal: GROSS }, AREA)
    expect(price).toBeCloseTo(452.77, 2)
  })

  it('metraj yoksa sıfır döner', () => {
    expect(resolveNetM2Price({ pricePerM2: 0, priceWithoutVat: NET, grandTotal: GROSS }, 0)).toBe(0)
  })

  it('şablon yedek hesabı bu fonksiyondan alır', () => {
    const pdfSource = readFileSync(resolve(process.cwd(), 'lib/pdfGenerator.ts'), 'utf8')
    expect(pdfSource).toContain('const calculatedM2Price = resolveNetM2Price(data, metrajValue)')
    expect(pdfSource).not.toContain('data.grandTotal / metrajValue')
  })
})
