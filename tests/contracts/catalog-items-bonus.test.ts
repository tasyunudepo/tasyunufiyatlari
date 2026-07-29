import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Elle teklif ekranının ürün kaynağı (/api/admin/catalog-items) Bonus'u
// GÖREMİYORDU: katalogda 251 üründen 0'ı Bonus'tu (27 Tem 2026, canlıda ölçüldü).
//
// Kök neden: Bonus levhalarının `base_price`'ı NULL ve `plate_prices`
// tablosunda HİÇ satırı yok (27 levha ailesi, 0 fiyat satırı). Bonus fiyatı
// bölge bazlı listede yaşıyor (lib/pricing/bonus/bonus-region-prices.json) ve
// yalnız `computeBonusUnitSale()` ile hesaplanabiliyor. Genel hesap yolu
// `basePrice <= 0` kontrolünde onları atlıyordu.
//
// Bu test Bonus'un ayrı yoldan geçtiğini ve fail-closed kaldığını kilitler.

const source = readFileSync(
  fileURLToPath(new URL('../../app/api/admin/catalog-items/route.ts', import.meta.url)),
  'utf8',
)

describe('catalog-items — Bonus fiyat yolu', () => {
  it('Bonus için ayrı hesap dalı var ve bonus modülünü kullanır', () => {
    expect(source).toContain("import { computeBonusUnitSale }")
    expect(source).toContain("brandName === 'Bonus'")
    expect(source).toContain('computeBonusUnitSale({')
  })

  it('Bonus dalı genel plate_prices yoluna düşmez', () => {
    // Bonus bloğu kendi `continue` ile genel döngüden çıkmalı; aksi hâlde
    // base_price=null olduğu için ürün ikinci kez atlanır.
    const bonusBlok = source.slice(
      source.indexOf("if (brandName === 'Bonus')"),
      source.indexOf('for (const thickness of (plate.thickness_options ?? []) as number[]) {', source.indexOf("if (brandName === 'Bonus')") + 100),
    )
    expect(bonusBlok).toContain('continue')
  })

  it('şehir yoksa Bonus fiyatı üretilmez (fail-closed)', () => {
    expect(source).toMatch(/if \(cityCode == null\) continue/)
  })

  it('fiyat çözülemeyen Bonus kalınlığı listelenmez (fail-closed)', () => {
    expect(source).toMatch(/if \(!sale\.ok\) continue/)
  })

  // DEĞİŞTİRİLDİ — 27 Temmuz 2026. Eski hâli `netCost: 0` şart koşuyordu ve
  // gerekçe olarak `bonus-price-privacy` sözleşmesi gösteriliyordu.
  //
  // O sözleşme bunu istemiyor: yalnız `components/**` (müşteri tarayıcısına
  // inen kod) Bonus fiyat modüllerini import edemez der. Burası
  // `requireOfficeReadAuth` arkasındaki sunucu rotası ve diğer TÜM markaların
  // net alışı buradan zaten /ofis'e iniyordu. Bonus'un sıfırlanması tutarsız
  // bir fazladan kısıttı; bedeli, teklifin en büyük kaleminin brüt kârdan
  // düşmesi ve marj kadranının o satıra dokunamamasıydı.
  //
  // Gerçek sınır KALDIRILMADI, doğru yere taşındı: ham fiyat modülleri hâlâ
  // yasak (fiyat `computeBonusUnitSale` üzerinden gelir) ve public uç
  // `app/api/bonus-price` net alışı döndürmez — o kilit
  // `tests/contracts/bonus-price-privacy.test.ts` içinde.
  it('Bonus fiyatı ham modülden değil, sunucu hesabından gelir', () => {
    const bonusBlok = source.slice(
      source.indexOf("if (brandName === 'Bonus')"),
      source.indexOf("materialSlug: 'tasyunu'"),
    )
    // Ham taban/liste fiyatı bu rotada elle okunmaz.
    expect(bonusBlok).not.toContain('getBonusBasePrice')
    expect(bonusBlok).not.toContain('getBonusListPrice')
    expect(bonusBlok).not.toContain('bonus-region-prices')
    // Net alış, marjı uygulayan tek hesabın döndürdüğü alandan gelir.
    expect(bonusBlok).toContain('netCost: sale.netCostPerM2')
  })

  it('bu rota yalnız yetkili ofis okumasına açık', () => {
    // Net alışın tarayıcıya inmesi ancak bu kapı sayesinde kabul edilebilir.
    expect(source).toContain('requireOfficeReadAuth')
  })

  it('alt-bölge gerektiren şehirde seçim istenir ve kullanıcıya bildirilir', () => {
    // İstanbul (yaka) ve Kocaeli (Gebze/diğer) seçim yapılmadan Bonus
    // fiyatı üretemez; ekran sessiz kalmamalı.
    expect(source).toContain('citySubRegionQuestion')
    expect(source).toContain('bonusNotes')
    expect(source).toContain('bonusSubRegion')
  })

  it('marka marjı fail-closed — çözülemezse ürün listelenmez', () => {
    expect(source).toContain('if (!margin) continue')
  })

  it('ham iskonto ve taban fiyat alanları yanıt tipinde yok', () => {
    const tip = source.slice(
      source.indexOf('export interface CatalogItem'),
      source.indexOf('export async function GET'),
    )
    expect(tip).not.toContain('discount_1')
    expect(tip).not.toContain('discount_2')
    expect(tip).not.toContain('base_price')
  })
})

describe('ürün adı bakımı', () => {
  const fixScript = readFileSync(
    fileURLToPath(new URL('../../scripts/fix-accessory-mojibake.mjs', import.meta.url)),
    'utf8',
  )

  it('onarım scripti düzeltmeyi name kolonuyla doğrular', () => {
    // Tahmine dayalı toplu değişiklik yapılmaz: her satır sağlam `name`
    // kolonuyla karşılaştırılır, doğrulanamayan satır atlanır.
    expect(fixScript).toContain('function dogrula(')
    expect(fixScript).toContain('atlananlar.push')
    expect(fixScript).toMatch(/if \(!dogrula\(yeni, r\.name\)\)/)
  })

  it('varsayılan mod kuru çalışmadır', () => {
    expect(fixScript).toContain("const UYGULA = process.argv.includes('--uygula')")
    expect(fixScript).toMatch(/if \(!UYGULA\)[\s\S]{0,200}process\.exit\(0\)/)
  })
})
