import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

import {
  buildAccessorySet,
  type AccessoryRow,
  type AccessoryTypeRow,
} from '@/lib/quote/buildAccessorySet'
import { unitPriceAtMargin } from '@/lib/quote/quoteIndicators'

// AC-01 — TY7002193 paritesi.
//
// 27 Temmuz 2026'da ofis teklif ekranı, wizard'ın ürettiğinden BAŞKA ürünler
// seçti: CHELFIX yapıştırıcı/sıva ve 155 mm dübel. Doğrusu TEKNOİZOFİX,
// TEKNOİZOSIVA ve 115 mm dübel. Kök neden fiyat değil SIRA idi:
//
//   Paket motoru her aksesuar tipinde İLK eşleşen ürünü seçer. Wizard
//   `accessories` tablosunu `.order('id')` ile çeker (WizardCalculator.tsx:521),
//   böylece orijinal set ürünleri (id 77–91) sonradan eklenenlerin (id 165+)
//   önüne geçer. Ofis rotası sırasız çekiyordu; Postgres sırayı garanti
//   etmediği için CHELFIX öne geçti.
//
// Bu testteki satırlar üretim verisinin birebir kopyasıdır (27 Tem 2026,
// brand_id=6 TEKNO). Beklenen birim fiyatlar müşteriye gönderilmiş
// TY7002193 numaralı teklifin kâğıt üzerindeki rakamlarıdır.

const TIPLER: AccessoryTypeRow[] = [
  { id: 1, name: 'Yapıştırıcı', sort_order: 1, consumption_rate_tasyunu: 6, consumption_rate_eps: 4 },
  { id: 2, name: 'Sıva', sort_order: 2, consumption_rate_tasyunu: 6, consumption_rate_eps: 4 },
  { id: 3, name: 'Dübel', sort_order: 3, consumption_rate_tasyunu: 6, consumption_rate_eps: 6 },
  { id: 4, name: 'File', sort_order: 4, consumption_rate_tasyunu: 1.1, consumption_rate_eps: 1.1 },
  { id: 5, name: 'Fileli Köşe', sort_order: 5, consumption_rate_tasyunu: 0.5, consumption_rate_eps: 0.5 },
  { id: 6, name: 'Astar', sort_order: 6, consumption_rate_tasyunu: 0.2, consumption_rate_eps: 0.2 },
  { id: 7, name: 'Kaplama', sort_order: 7, consumption_rate_tasyunu: 2.5, consumption_rate_eps: 2.5 },
]

function acc(
  id: number,
  accessory_type_id: number,
  name: string,
  base_price: number,
  unit: string,
  unit_content: number,
  is_for_tasyunu: boolean,
): AccessoryRow {
  return {
    id,
    name,
    short_name: null,
    brand_id: 6,
    accessory_type_id,
    base_price,
    discount_1: 40,
    discount_2: 5,
    is_kdv_included: false,
    unit,
    unit_content,
    is_for_eps: !is_for_tasyunu,
    is_for_tasyunu,
    is_active: true,
  }
}

/** Üretimdeki TEKNO aksesuarları — `id` sırasında, wizard'ın gördüğü gibi. */
const TEKNO_ID_SIRASINDA: AccessoryRow[] = [
  acc(77, 1, 'TEKNOİZOFİX', 247.17, 'PKT', 25, true),
  acc(78, 2, 'TEKNOİZOSIVA', 272.45, 'PKT', 25, true),
  acc(79, 7, 'TEKNODEKO İNCE (1,2 MM)', 342.67, 'PKT', 25, true),
  acc(80, 7, 'TEKNODEKO KALIN (2 MM)', 342.67, 'PKT', 25, true),
  acc(81, 7, 'TEKNODEKO ÇİZGİLİ', 393.23, 'PKT', 25, true),
  acc(82, 2, 'TEKNOİZOSIVA MAKİNE SIVASI', 179.76, 'PKT', 25, true),
  acc(83, 4, 'FİLE 4X4 - 160 GR', 1680, 'RULO', 50, true),
  acc(84, 5, 'FİLELİ PVC KÖŞE PROFİLİ', 2156.25, 'PKT', 125, true),
  acc(85, 3, 'Çelik Çivili Dübel 115 mm (11,5 cm)', 2497.5, 'PKT', 500, true),
  acc(86, 3, 'Çelik Çivili Dübel 155 mm (15,5 cm)', 2886, 'PKT', 500, true),
  acc(87, 3, 'Plastik Çivili Dübel 10 cm', 1165.5, 'PKT', 500, false),
  acc(88, 3, 'Plastik Çivili Dübel 12 cm', 1332, 'PKT', 500, false),
  acc(89, 7, 'CHELFIX DEKORATİF SIVA', 298.85, 'PKT', 25, true),
  acc(90, 7, 'CHELFIX DEKORATİF SIVA İNCE', 298.85, 'PKT', 25, true),
  acc(91, 6, 'TEKNOLATEX 400', 1592.63, 'KOVA', 25, true),
  acc(165, 2, 'CHELFIX ISI YALITIM LEVHA SIVASI', 247.17, 'PKT', 25, true),
  acc(166, 1, 'CHELFIX ISI YALITIM LEVHA YAPIŞTIRICI', 233.69, 'PKT', 25, true),
  acc(169, 2, 'TEKNOREP 100 GRİ', 267.33, 'PKT', 20, true),
  acc(170, 2, 'TEKNOREP 100 FLEX BEYAZ', 417.04, 'PKT', 20, true),
  acc(191, 2, 'TEKNOREP 110', 1162.5, 'KOVA', 25, true),
  acc(192, 7, 'TEKNO GRENLİ BOYA BEYAZ', 2538.9, 'KOVA', 20, true),
]

const ALAN_M2 = 6652.8
const MARJ_PCT = 3

function tekonSeti(accessories: AccessoryRow[], accessoryTypes = TIPLER) {
  return buildAccessorySet({
    accessoryTypes,
    accessories,
    accessoryBrandId: 6,
    accessoryBrandName: 'TEKNO',
    materialType: 'tasyunu',
    areaM2: ALAN_M2,
    marginPct: MARJ_PCT,
    city: null,
  })
}

describe('AC-01 · toz grubu seti TY7002193 ile birebir', () => {
  it('TEKNO / taşyünü / 6652,8 m² / %3 marj → gönderilen teklifin 7 kalemi', () => {
    const set = tekonSeti(TEKNO_ID_SIRASINDA)

    expect(set.complete).toBe(true)
    expect(set.missingTypes).toEqual([])

    // Ürün adı · miktar · birim · birim fiyat — hepsi müşteriye gitmiş belgeden.
    expect(
      set.items.map((i) => [i.description, i.quantity, i.unit, i.unitPrice]),
    ).toEqual([
      ['TEKNOİZOFİX', 1597, 'PKT', 145.11],
      ['TEKNOİZOSIVA', 1597, 'PKT', 159.96],
      ['Çelik Çivili Dübel 115 mm (11,5 cm)', 80, 'PKT', 1466.28],
      ['FİLE 4X4 - 160 GR', 147, 'RULO', 986.33],
      ['FİLELİ PVC KÖŞE PROFİLİ', 27, 'PKT', 1265.93],
      ['TEKNOLATEX 400', 54, 'KOVA', 935.03],
      ['TEKNODEKO İNCE (1,2 MM)', 666, 'PKT', 201.18],
    ])
  })

  it('netCost YUVARLANMADAN taşınır — marj kadranı fiyatı 1 kuruş kaydırmamalı', () => {
    const set = tekonSeti(TEKNO_ID_SIRASINDA)
    const yapistirici = set.items[0]

    // Kuruşa yuvarlanmış maliyetten (140,89) marj bindirilirse 145,12 çıkar;
    // doğrusu tam maliyetten (140,8869) 145,11'dir. Set doğru kurulup
    // "Fiyatlara uygula"ya basılınca fiyatın sessizce değişmesi bu yüzden
    // olmuştu (27 Tem 2026 canlı doğrulama).
    expect(unitPriceAtMargin(yapistirici, 3)).toBe(yapistirici.unitPrice)
    expect(unitPriceAtMargin(yapistirici, 3)).toBe(145.11)

    for (const kalem of set.items) {
      expect(unitPriceAtMargin(kalem, 3)).toBe(kalem.unitPrice)
    }
  })

  it('27 Tem 2026 regresyonu: CHELFIX ve 155 mm dübel sete GİRMEZ', () => {
    const set = tekonSeti(TEKNO_ID_SIRASINDA)
    const adlar = set.items.map((i) => i.description)

    expect(adlar.some((a) => a.includes('CHELFIX'))).toBe(false)
    expect(adlar.some((a) => a.includes('155 mm'))).toBe(false)
  })

  it('sıra bozulursa BAŞKA ürün seçilir — bu yüzden çağıran .order("id") yapmak zorunda', () => {
    // Sonradan eklenenler öne alınmış hâli: rotanın 27 Temmuz'daki hatası.
    const tersSira = [...TEKNO_ID_SIRASINDA].sort((a, b) => b.id - a.id)
    const set = tekonSeti(tersSira)

    const adlar = set.items.map((i) => i.description)
    expect(adlar).toContain('CHELFIX ISI YALITIM LEVHA YAPIŞTIRICI')
    expect(adlar).toContain('Çelik Çivili Dübel 155 mm (15,5 cm)')
  })

  it('kurucu tip sırasını KENDİ BAŞINA düzeltmez — çağıranın sırasını korur', () => {
    const karisikTipler = [...TIPLER].reverse()
    const set = tekonSeti(TEKNO_ID_SIRASINDA, karisikTipler)

    expect(set.items.map((i) => i.accessoryTypeName)).toEqual([
      'Kaplama',
      'Astar',
      'Fileli Köşe',
      'File',
      'Dübel',
      'Sıva',
      'Yapıştırıcı',
    ])
  })

  // Birim test kurucunun sırayı KORUDUĞUNU ispatlar; sırayı KURAN taraf
  // rotadır. Rota `.order('id')`'yi kaybederse yukarıdaki testler yine geçer
  // ama üretimde yanlış ürün seçilir — 27 Temmuz'da tam olarak bu oldu.
  it('rota aksesuarları id, tipleri sort_order sırasında çeker', () => {
    const kaynak = readFileSync('app/api/admin/accessory-sets/route.ts', 'utf8')

    expect(kaynak).toMatch(
      /from\('accessories'\)[\s\S]{0,80}?\.order\('id'\)/,
    )
    expect(kaynak).toMatch(
      /from\('accessory_types'\)[\s\S]{0,80}?\.order\('sort_order'\)/,
    )
    // Pasif ürün sete girmemeli (wizard `.eq('is_active', true)` uyguluyor).
    expect(kaynak).toMatch(
      /from\('accessories'\)[\s\S]{0,80}?\.eq\('is_active', true\)/,
    )
  })

  it('miktarlar metrajla birlikte yeniden hesaplanır (7002 m² → 6652,8 m²)', () => {
    const buyuk = buildAccessorySet({
      accessoryTypes: TIPLER,
      accessories: TEKNO_ID_SIRASINDA,
      accessoryBrandId: 6,
      accessoryBrandName: 'TEKNO',
      materialType: 'tasyunu',
      areaM2: 7002,
      marginPct: MARJ_PCT,
      city: null,
    })

    // 7002 × 6 ÷ 25 = 1680,48 → 1681 paket
    expect(buyuk.items[0].quantity).toBe(1681)
    // Birim fiyat metrajdan bağımsız — yalnız miktar değişir.
    expect(buyuk.items[0].unitPrice).toBe(145.11)
  })
})
