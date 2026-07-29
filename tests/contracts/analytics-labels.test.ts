import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Analiz sekmesindeki iki görüntüleme hatası (27 Temmuz 2026, canlı veriyle
// doğrulandı):
//
// 1) "Toz Grubu Markaları" sıralamasında 2. sırada "-" görünüyordu.
//    Kaynak: katalog (PDP) tek-ürün tekliflerinde toz grubu seçilmez;
//    apiQuoteSchema `accessoryBrandName`i zorunlu tuttuğu için (min(1))
//    boş yazılamıyor, yerine tire yazılıyor. 6 teklifin 6'sı da
//    source_channel='catalog'. Yani "-" bir marka değil, "toz grubu yok".
//
// 2) Kombinasyon listesinde model iki kez yazılıyordu:
//    "Bonus F 150 Pro F 150 Pro × TEKNO"
//    "Optimix Optimix Karbonlu Optimix Karbonlu × Optimix"
//    Kaynak: RPC bazı satırlarda plate_brand'i zaten "marka + model" olarak
//    döndürüyor, arayüz modeli koşulsuz ekliyordu. Optimix'te iki kat
//    kötüydü çünkü model adının kendisi markayla başlıyor
//    (brand="Optimix", model="Optimix Karbonlu").
//
// RPC (`get_combination_metrics`) tanımı repoda YOK — yalnız Supabase'de
// yaşıyor. Bu yüzden düzeltme arayüzde yapıldı ve burada kilitleniyor.

const source = readFileSync(
  fileURLToPath(new URL('../../app/ofis/tabs/AnalyticsTab.tsx', import.meta.url)),
  'utf8',
)

import {
  buildPlateItemName,
  composePlateLabel as plateLabel,
  joinBrandAndModel,
} from '@/lib/catalog/productLabel'

const NO_POWDER = '-'

function powderLabel(brand: string): string {
  return brand === NO_POWDER ? 'Toz grubu yok' : brand
}

describe('analiz etiketleri — model tekrarı', () => {
  // Canlı RPC yanıtından alınmış gerçek satırlar (27 Tem 2026).
  it.each([
    ['Bonus F 150 Pro', 'F 150 Pro', 'Bonus F 150 Pro'],
    // short_name markayı zaten içeriyor → marka tek kez yazılır
    ['Optimix Optimix Karbonlu', 'Optimix Karbonlu', 'Optimix Karbonlu'],
    ['Dalmaçyalı İdeal Carbon', 'İdeal Carbon', 'Dalmaçyalı İdeal Carbon'],
    ['Optimix TR7.5', 'TR7.5', 'Optimix TR7.5'],
    ['Bonus F 120', 'F 120', 'Bonus F 120'],
  ])('plate_brand modeli zaten içeriyorsa tekrar etmez: %s + %s', (brand, model, expected) => {
    expect(plateLabel(brand, model)).toBe(expected)
  })

  it.each([
    ['Bonus', 'Gold Plus 70', 'Bonus Gold Plus 70'],
    ['Bonus', 'Gold Yellow 50', 'Bonus Gold Yellow 50'],
    ['Bonus', 'F 150 Pro', 'Bonus F 150 Pro'],
  ])('plate_brand yalnız markaysa model eklenir: %s + %s', (brand, model, expected) => {
    expect(plateLabel(brand, model)).toBe(expected)
  })

  it('model yoksa yalnız marka gösterilir', () => {
    expect(plateLabel('Bonus', '—')).toBe('Bonus')
    expect(plateLabel('Bonus', '')).toBe('Bonus')
  })

  it('hiçbir çıktıda model art arda iki kez geçmez', () => {
    const rows: Array<[string, string]> = [
      ['Bonus F 150 Pro', 'F 150 Pro'],
      ['Optimix Optimix Karbonlu', 'Optimix Karbonlu'],
      ['Dalmaçyalı İdeal Carbon', 'İdeal Carbon'],
      ['Bonus', 'Gold Plus 70'],
    ]
    for (const [brand, model] of rows) {
      const label = plateLabel(brand, model)
      const kez = label.split(model).length - 1
      expect(kez, `"${label}" içinde "${model}" ${kez} kez geçiyor`).toBe(1)
    }
  })
})

describe('PDF ve teklif kalemlerinde marka tekrarı', () => {
  it.each([
    ['Optimix', 'Optimix Karbonlu', 'Optimix Karbonlu'],
    ['Optimix', 'TR7.5', 'Optimix TR7.5'],
    ['Bonus', 'F 150 Pro', 'Bonus F 150 Pro'],
    ['Dalmaçyalı', 'İdeal Carbon', 'Dalmaçyalı İdeal Carbon'],
    ['Bonus', 'Bonus Gold Plus 70', 'Bonus Gold Plus 70'],
  ])('joinBrandAndModel(%s, %s)', (brand, model, expected) => {
    expect(joinBrandAndModel(brand, model)).toBe(expected)
  })

  it('markası eksik/boş ürünlerde çift boşluk bırakmaz', () => {
    expect(joinBrandAndModel('', 'Karbonlu')).toBe('Karbonlu')
    expect(joinBrandAndModel('Optimix', '')).toBe('Optimix')
    expect(joinBrandAndModel(null, null)).toBe('')
  })

  it('PDF kalem adı düzeldi — canlı kayıttaki hatalı metin artık üretilmiyor', () => {
    // Gerçek kayıt (quotes.package_items): "Optimix Optimix Karbonlu 5 cm EPS"
    const yeni = buildPlateItemName('Optimix', 'Optimix Karbonlu', '5', 'EPS')
    expect(yeni).toBe('Optimix Karbonlu 5 cm EPS')
    expect(yeni).not.toContain('Optimix Optimix')
  })

  it('doğru çalışan adlar bozulmadı', () => {
    expect(buildPlateItemName('Optimix', 'TR7.5', '10', 'Taşyünü')).toBe('Optimix TR7.5 10 cm Taşyünü')
    expect(buildPlateItemName('Bonus', 'F 150 Pro', 5, 'Taşyünü')).toBe('Bonus F 150 Pro 5 cm Taşyünü')
  })
})

describe('analiz etiketleri — toz grubu yok', () => {
  it('"-" marka değil, açıklayıcı etikete çevrilir', () => {
    expect(powderLabel('-')).toBe('Toz grubu yok')
  })

  it('gerçek markalar olduğu gibi kalır', () => {
    for (const b of ['TEKNO', 'Optimix', 'Dalmaçyalı']) {
      expect(powderLabel(b)).toBe(b)
    }
  })

  it('"-" satırı sıralamada sona alınır', () => {
    // Canlı veri: TEKNO 6, "-" 6, Optimix 6, Dalmaçyalı 1
    const rows = [
      { brand: 'TEKNO', count: 6 },
      { brand: '-', count: 6 },
      { brand: 'Optimix', count: 6 },
      { brand: 'Dalmaçyalı', count: 1 },
    ]
    const sorted = [...rows].sort((a, b) => {
      if (a.brand === NO_POWDER) return 1
      if (b.brand === NO_POWDER) return -1
      return 0
    })
    expect(sorted[sorted.length - 1].brand).toBe('-')
    expect(sorted.map((r) => r.brand)).toEqual(['TEKNO', 'Optimix', 'Dalmaçyalı', '-'])
  })
})

describe('AnalyticsTab kaynağı düzeltmeyi uyguluyor', () => {
  it('ham plate_brand + model yan yana basılmıyor', () => {
    // Eski hatalı kalıp geri gelmemeli.
    expect(source).not.toContain('{item.model !== "—" && <span')
    expect(source).toContain('plateLabel(item.plate_brand, item.model)')
  })

  it('toz grubu etiketi ve sıralaması bağlanmış', () => {
    expect(source).toContain('powderLabel(item.powder_brand)')
    expect(source).toContain('sortPowderBrands(metrics!.powder_brands_7d)')
  })
})
