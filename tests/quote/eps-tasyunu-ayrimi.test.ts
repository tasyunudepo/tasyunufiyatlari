import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

import { buildAccessorySet, type AccessoryRow, type AccessoryTypeRow } from '@/lib/quote/buildAccessorySet'
import { buildManualPdfData } from '@/lib/quote/buildManualPdfData'

// 29 Temmuz 2026 · TE-2026-000143 (Muammer Erdal, Optimix Karbonlu 8 cm)
//
// Teklif EPS levhayla kuruldu ama toz grubu TAŞYÜNÜ sarfiyatıyla hesaplandı:
//   · yapıştırıcı/sıva 6 kg/m² (doğrusu 4) → 72 paket yerine 48 olmalıydı
//   · dübel olarak çelik çivili TAŞYÜNÜ dübeli seçildi (doğrusu plastik dübel)
// Sonuç: 300 m²'lik teklif 14.229,93 ₺ (KDV hariç) fazla çıktı.
//
// Kök neden ekranın `materialType === 'eps' ? 'eps' : 'tasyunu'` satırıydı:
// Malzeme kutusu varsayılan "Karma"da kalınca EPS sessizce taşyünü sayıldı.

const TIPLER: AccessoryTypeRow[] = [
  { id: 1, name: 'Yapıştırıcı', sort_order: 1, consumption_rate_tasyunu: 6, consumption_rate_eps: 4 },
  { id: 2, name: 'Sıva', sort_order: 2, consumption_rate_tasyunu: 6, consumption_rate_eps: 4 },
  { id: 3, name: 'Dübel', sort_order: 3, consumption_rate_tasyunu: 6, consumption_rate_eps: 6 },
]

function acc(
  id: number,
  typeId: number,
  name: string,
  unitContent: number,
  forEps: boolean,
  forTasyunu = !forEps,
): AccessoryRow {
  return {
    id,
    name,
    short_name: null,
    brand_id: 9,
    accessory_type_id: typeId,
    base_price: 500,
    discount_1: 0,
    discount_2: 0,
    is_kdv_included: false,
    unit: 'PKT',
    unit_content: unitContent,
    is_for_eps: forEps,
    is_for_tasyunu: forTasyunu,
    is_active: true,
  }
}

// Üretimdeki Fawori Optimix satırlarının sadeleştirilmiş hâli.
// Yapıştırıcı ve sıva HER İKİ malzemede de kullanılır (üretimde
// is_for_eps=true VE is_for_tasyunu=true); ayrışan yalnız dübeldir.
// Fark oradan değil, SARFİYAT ORANINDAN doğar: 4 kg/m² ↔ 6 kg/m².
const OPTIMIX: AccessoryRow[] = [
  acc(1, 1, 'Fawori Optimix Isı Yalıtım Yapıştırma Harcı 25kg', 25, true, true),
  acc(2, 2, 'Fawori Optimix Isı Yalıtım Sıva Harcı 25kg', 25, true, true),
  acc(3, 3, 'Fawori Optimix Plastik Dübel 9,5cm 600 adet', 600, true),
  acc(4, 3, 'Fawori Optimix Taşyünü Dübeli Çelik Çivili 11,5cm 200 adet', 200, false),
]

const ALAN = 300

function set(materialType: 'eps' | 'tasyunu') {
  return buildAccessorySet({
    accessoryTypes: TIPLER,
    accessories: OPTIMIX,
    accessoryBrandId: 9,
    accessoryBrandName: 'Fawori Optimix',
    materialType,
    areaM2: ALAN,
    marginPct: 5,
    city: null,
  })
}

describe('EPS / taşyünü ayrımı — TE-2026-000143 regresyonu', () => {
  it('EPS seçilince yapıştırıcı ve sıva 4 kg/m² ile 48 paket çıkar', () => {
    const s = set('eps')
    const miktarlar = Object.fromEntries(s.items.map((i) => [i.accessoryTypeName, i.quantity]))
    expect(miktarlar['Yapıştırıcı']).toBe(48)
    expect(miktarlar['Sıva']).toBe(48)
  })

  it('EPS seçilince PLASTİK dübel seçilir, çelik çivili taşyünü dübeli DEĞİL', () => {
    const adlar = set('eps').items.map((i) => i.description)
    expect(adlar).toContain('Fawori Optimix Plastik Dübel 9,5cm 600 adet')
    expect(adlar.some((a) => a.includes('Taşyünü Dübeli'))).toBe(false)
    // 300 × 6 ÷ 600 = 3 kutu
    expect(set('eps').items.find((i) => i.accessoryTypeName === 'Dübel')?.quantity).toBe(3)
  })

  it('taşyünü seçilince 6 kg/m² ile 72 paket ve çelik çivili dübel çıkar', () => {
    const s = set('tasyunu')
    const miktarlar = Object.fromEntries(s.items.map((i) => [i.accessoryTypeName, i.quantity]))
    expect(miktarlar['Yapıştırıcı']).toBe(72)
    expect(miktarlar['Sıva']).toBe(72)
    expect(s.items.map((i) => i.description).some((a) => a.includes('Taşyünü Dübeli'))).toBe(true)
  })

  it('iki malzeme AYNI seti üretemez — karıştırılırsa fark paraya yansır', () => {
    const eps = set('eps')
    const tw = set('tasyunu')
    expect(eps.totalCost).not.toBe(tw.totalCost)
    expect(tw.totalCost).toBeGreaterThan(eps.totalCost)
  })

  // Ekran tarafı: "karma" ASLA sessizce taşyünü sayılmamalı.
  it('QuoteBuilder malzemeyi levhadan türetir, karma sessizce taşyünü olmaz', () => {
    // Yorumlar elenir: hatanın NE olduğunu anlatan açıklama eski satırı
    // alıntılamak zorunda ve testi kendi belgesine takmamalı.
    const kaynak = readFileSync('app/ofis/tabs/quotes/QuoteBuilder.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/\/\/.*$/gmu, '')
    expect(kaynak).not.toMatch(/materialType === "eps" \? "eps" : "tasyunu"/u)
    expect(kaynak).toContain('plateMaterialSlug')
    // Malzeme çözülemeden toz grubu sorgusu çalışmaz (fail-closed).
    expect(kaynak).toMatch(/enabled:.*tozMalzeme != null/u)
  })
})

describe('nakliye sunumu operatörün seçimidir', () => {
  const temel = {
    quoteCode: 'TE-TEST',
    customerName: 'Test',
    customerPhone: '05550000000',
    cityName: 'İstanbul',
    materialType: 'eps' as const,
    areaM2: 300,
    validityDays: 7,
    lines: [{ description: 'Levha', quantity: 300, unit: 'm²', unitPrice: 100, isPlate: true }],
    discountPct: 0,
    totals: {
      linesNet: 30000,
      discountAmount: 0,
      priceWithoutVat: 30000,
      vatAmount: 6000,
      totalPrice: 36000,
    },
  }

  it('nakliye 0 ve "hariç" seçilirse belge DAHİL demez', () => {
    const pdf = buildManualPdfData({
      ...temel,
      shippingCharge: 0,
      shippingMode: 'buyer_pays',
    })
    expect(pdf.isShippingIncluded).toBe(false)
    expect(pdf.shippingMode).toBe('buyer_pays')
  })

  it('varsayılan dahildir — eski davranış korunur', () => {
    const pdf = buildManualPdfData({ ...temel, shippingCharge: 0 })
    expect(pdf.isShippingIncluded).toBe(true)
    expect(pdf.shippingMode).toBe('included_in_sale_price')
  })

  it('nakliye ayrı kalem olarak eklendiyse dahil denemez', () => {
    const pdf = buildManualPdfData({
      ...temel,
      shippingCharge: 5000,
      shippingMode: 'included_in_sale_price',
    })
    expect(pdf.isShippingIncluded).toBe(false)
    expect(pdf.shippingMode).toBe('buyer_pays')
  })
})
