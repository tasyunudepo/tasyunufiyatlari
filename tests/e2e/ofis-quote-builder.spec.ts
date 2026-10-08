import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, test, type Browser, type Page } from '@playwright/test'

// Yarı otomatik teklif ekranı (QuoteBuilder) — uçtan uca kilit.
//
// Referans olay: 27 Temmuz 2026, Mahmut Balcı teklifi (TY7002193).
// Ekran o gün şunları yapamıyordu ve hepsi elle/betikle yapıldı:
//   · toz grubunu tek tıkla eklemek (7 satır elle yazıldı)
//   · "3 TIR"ı metraja çevirmek (6.652,8 elle hesaplandı)
//   · marjı çevirip fiyatları yeniden üretmek (iskonto ile karıştırıldı)
//   · kâr / site farkı / paket artığı görmek (sonradan elle hesaplandı)
//   · teklifi çoğaltıp metrajı değiştirmek (betikle yapıldı)
//
// Bu spec bunların hepsini KAYDETMEDEN doğrular — üretim veritabanına
// test teklifi yazmaz.

const envPath = resolve(process.cwd(), '.env.local')

function readLocalEnv(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(envPath, 'utf8')
        .split('\n')
        .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
        .map((line) => {
          const i = line.indexOf('=')
          return [
            line.slice(0, i).trim(),
            line.slice(i + 1).trim().replace(/^["']|["']$/g, ''),
          ]
        }),
    )
  } catch {
    return {}
  }
}

const env = readLocalEnv()
const ADMIN_USER = env.ADMIN_USER || 'admin'
const ADMIN_PASSWORD = env.ADMIN_PASSWORD

/** Teklif ekranını açar ve taşyünü/Adıyaman bağlamını kurar. */
async function acEkran(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    httpCredentials: { username: ADMIN_USER, password: ADMIN_PASSWORD! },
  })
  const page = await context.newPage()
  await page.goto('/ofis')
  await page.getByRole('button', { name: 'Teklifler' }).first().click()
  await page.getByRole('button', { name: 'Yeni Teklif' }).click()
  await expect(page.getByTestId('manual-quote-editor')).toBeVisible({ timeout: 30_000 })

  await page.getByLabel('Müşteri adı *').fill('E2E Kontrol')
  await page.getByLabel('Telefon *').fill('05550001122')
  await page.locator('select').first().selectOption({ label: 'Adıyaman' })
  await page.locator('select').nth(1).selectOption('tasyunu')
  // Katalog fiyatlarının gelmesini bekle.
  await expect
    .poll(async () => page.getByTestId('open-accessory-set').count(), { timeout: 20_000 })
    .toBeGreaterThan(0)
  return page
}

/** Satır içi aramayla levha seçer. */
async function levhaSec(page: Page, sorgu: string) {
  const alan = page.getByLabel('Satır 1 ürün adı')
  await alan.click()
  await alan.pressSequentially(sorgu, { delay: 40 })
  await expect(page.getByTestId('urun-onerileri')).toBeVisible({ timeout: 15_000 })
  await page.locator('[data-testid="urun-onerileri"] [role="option"]').first().click()
}

/** Tablodaki bir sütunun dolu değerleri. */
async function sutun(page: Page, n: number): Promise<string[]> {
  const degerler = await page
    .locator(`table tbody tr td:nth-child(${n}) input`)
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))
  return degerler.filter((v) => v.trim().length > 0)
}

test.describe('yarı otomatik teklif ekranı', () => {
  test.skip(!ADMIN_PASSWORD, '.env.local içinde ADMIN_PASSWORD tanımlı olmalı')

  test('AC-01: TEKNO toz grubu tek tıkla, TY7002193 ile birebir ürün ve fiyat', async ({
    browser,
  }) => {
    const page = await acEkran(browser)

    await levhaSec(page, 'bonus f 150 pro 4')
    await expect(page.getByLabel('Satır 1 ürün adı')).toHaveValue(/Bonus F 150 Pro 4 cm/)

    // "3 TIR" → 6.652,8 m² (27 Tem'de elle hesaplanan sayı).
    await page.getByTestId('arac-3').click()
    await expect(page.getByLabel('İş metrajı (m²)')).toHaveValue('6652,8')
    await expect(page.getByTestId('arac-karsiligi')).toContainText('3 TIR')

    // Toz grubu tek tıkla — marka başlıkta olduğu için TEKNO seçilebiliyor.
    await page.getByTestId('open-accessory-set').click()
    const teknoKart = page
      .locator('[data-testid="accessory-set-dialog"] .grid > div')
      .filter({ has: page.getByTestId('set-brand-TEKNO') })
    await expect(teknoKart).toHaveCount(1, { timeout: 30_000 })
    await teknoKart.locator('[data-testid^="apply-set-"]').click()

    // Levha + 7 toz kalemi.
    await expect(page.locator('table tbody tr')).toHaveCount(8)

    const urunler = await sutun(page, 2)
    expect(urunler).toEqual([
      'Bonus F 150 Pro 4 cm',
      'TEKNOİZOFİX',
      'TEKNOİZOSIVA',
      'Çelik Çivili Dübel 115 mm (11,5 cm)',
      'FİLE 4X4 - 160 GR',
      'FİLELİ PVC KÖŞE PROFİLİ',
      'TEKNOLATEX 400',
      'TEKNODEKO İNCE (1,2 MM)',
    ])

    // 27 Tem 2026 regresyonu: yanlış ürünler sete GİRMEZ.
    expect(urunler.some((u) => u.includes('CHELFIX'))).toBe(false)
    expect(urunler.some((u) => u.includes('155 mm'))).toBe(false)

    // Miktarlar 6.652,8 m² için — gönderilen teklifle aynı.
    expect(await sutun(page, 3)).toEqual([
      '6652.8', '1597', '1597', '80', '147', '27', '54', '666',
    ])

    // ── Marj kadranı: %3 → TY7002193'ün birim fiyatları ──
    await page.getByLabel('Hedef marj yüzdesi').fill('3')
    await page.getByTestId('apply-margin').click()

    const fiyatlar = await sutun(page, 5)
    expect(fiyatlar.slice(1)).toEqual([
      '145.11', '159.96', '1466.28', '986.33', '1265.93', '935.03', '201.18',
    ])

    await page.context().close()
  })

  test('AC-02: göstergeler kâr, site farkı ve paket artığını kaydetmeden gösterir', async ({
    browser,
  }) => {
    const page = await acEkran(browser)
    await levhaSec(page, 'bonus f 150 pro 4')
    await page.getByTestId('arac-3').click()

    await page.getByTestId('open-accessory-set').click()
    const teknoKart = page
      .locator('[data-testid="accessory-set-dialog"] .grid > div')
      .filter({ has: page.getByTestId('set-brand-TEKNO') })
    await expect(teknoKart).toHaveCount(1, { timeout: 30_000 })
    await teknoKart.locator('[data-testid^="apply-set-"]').click()

    await page.getByLabel('Hedef marj yüzdesi').fill('3')
    await page.getByTestId('apply-margin').click()

    await expect(page.getByTestId('quote-indicators')).toBeVisible()
    // Paket artığı — birim testte 2.337,85 ₺ olarak kilitli sayı.
    await expect(page.getByTestId('gosterge-artik')).toContainText('2.337,85')
    // Marjı %5'ten %3'e indirmek site fiyatına göre indirim üretir.
    await expect(page.getByTestId('gosterge-site-farki')).toContainText('−')
    await expect(page.getByTestId('gosterge-m2')).not.toContainText('0,00')
    await expect(page.getByTestId('gosterge-kar')).toBeVisible()

    // GİZLİLİK: gösterge paneli belgeye çıkmadığını kendi üstünde söyler.
    await expect(page.getByTestId('quote-indicators')).toContainText('belgeye yazılmaz')

    await page.context().close()
  })

  test('AC-03: metraj değişince sarfiyata bağlı miktarlar yeniden hesaplanır', async ({
    browser,
  }) => {
    const page = await acEkran(browser)
    await levhaSec(page, 'bonus f 150 pro 4')
    await page.getByTestId('arac-3').click()

    await page.getByTestId('open-accessory-set').click()
    const teknoKart = page
      .locator('[data-testid="accessory-set-dialog"] .grid > div')
      .filter({ has: page.getByTestId('set-brand-TEKNO') })
    await expect(teknoKart).toHaveCount(1, { timeout: 30_000 })
    await teknoKart.locator('[data-testid^="apply-set-"]').click()

    expect(await sutun(page, 3)).toEqual([
      '6652.8', '1597', '1597', '80', '147', '27', '54', '666',
    ])

    // 27 Tem'de betikle yapılan iş: metrajı değiştir, miktarlar takip etsin.
    await page.getByLabel('İş metrajı (m²)').fill('7002')
    await expect
      .poll(async () => (await sutun(page, 3))[1], { timeout: 10_000 })
      .toBe('1681')

    expect(await sutun(page, 3)).toEqual([
      '7002', '1681', '1681', '85', '155', '29', '57', '701',
    ])

    await page.context().close()
  })

  test('AC-04: satır içi arama Türkçe klavye farkını yutar', async ({ browser }) => {
    const page = await acEkran(browser)

    const alan = page.getByLabel('Satır 1 ürün adı')
    await alan.click()
    // Üç engel birden: noktasız I (klavye), bitişik yazım ve isim farkı —
    // katalogda "TEKNO Yapıştırıcı" yazar, ticari ad "TEKNOİZOFİX"tir.
    await alan.pressSequentially('teknoizofix', { delay: 40 })
    await expect(page.getByTestId('urun-onerileri')).toBeVisible({ timeout: 15_000 })
    await expect(
      page.locator('[data-testid="urun-onerileri"] [role="option"]').first(),
    ).toContainText('TEKNOİZOFİX')

    // Escape öneriyi kapatır, yazılan metin kalır.
    await alan.press('Escape')
    await expect(page.getByTestId('urun-onerileri')).toHaveCount(0)
    await expect(alan).toHaveValue('teknoizofix')

    await page.context().close()
  })

  test('AC-05: toz grubu kartları marka başına tek ve markayı başlıkta gösterir', async ({
    browser,
  }) => {
    const page = await acEkran(browser)
    await levhaSec(page, 'bonus f 150 pro 4')
    await page.getByTestId('arac-3').click()
    await page.getByTestId('open-accessory-set').click()

    const kartlar = page.locator('[data-testid="accessory-set-dialog"] .grid > div')
    await expect(kartlar.first()).toBeVisible({ timeout: 30_000 })

    // Aynı toz markası birden çok paket tanımında geçse de tek kart çıkar.
    const markalar = await page
      .locator('[data-testid^="set-brand-"]')
      .allInnerTexts()
    expect(new Set(markalar).size).toBe(markalar.length)
    expect(markalar).toContain('TEKNO')

    await page.context().close()
  })

  test('AC-06: Diyarbakır Optimix %9 + %8 ve dübelde 4–5 cm tutunma payı', async ({
    browser,
  }) => {
    const page = await acEkran(browser)
    await page.locator('select').first().selectOption({ label: 'Diyarbakır' })

    await levhaSec(page, 'bonus f 120 9')
    await page.getByTestId('arac-3').click()
    await expect(page.getByLabel('İş metrajı (m²)')).toHaveValue('2851,2')

    await page.getByTestId('open-accessory-set').click()
    const optimixKart = page
      .locator('[data-testid="accessory-set-dialog"] .grid > div')
      .filter({ has: page.getByTestId('set-brand-Optimix') })
    await expect(optimixKart).toHaveCount(1, { timeout: 30_000 })
    await optimixKart.locator('[data-testid^="apply-set-"]').click()

    // 21 Ağustos 2026 kuralı: duvarda yaklaşık 4–5 cm tutunma payı hedeflenir.
    // 9 cm levhada alt sınır 13 cm; en kısa yeterli katalog ürünü 13,5 cm'dir.
    const urunler = await sutun(page, 2)
    expect(urunler).toContain('Fawori Optimix Taşyünü Dübeli Çelik Çivili 13,5cm 200 adet')
    expect(urunler).not.toContain('Fawori Optimix Taşyünü Dübeli Çelik Çivili 11,5cm 200 adet')

    expect((await sutun(page, 5)).slice(1)).toEqual([
      '180.65', '199.99', '1186.73', '1350.24', '2329.51', '1213.1', '284.82',
    ])
    await expect(page.getByText('2.875.031,17 ₺')).toBeVisible()

    await page.context().close()
  })
})

// Revize ve çoğaltma — listeden tek tıkla.
//
// Referans olay: 8 Ekim 2026. Müşteri sitede EPS 4 cm için 1 kamyon =
// 1.680 m² teklif aldı; ofiste aynı ürün 1.008 m² yazdı ve iki teklif eksik
// metrajla kaydedildi. Düzeltmek için yeni teklif yazmak, müşteri bilgisini
// de baştan girmek gerekiyordu.
//
// Liste ve kayıt uçları taklit edilir: üretim veritabanına yazılmaz, test
// canlıdaki teklif kayıtlarına bağlı kalmaz. Katalog (kapasite) canlıdır.
const OFIS_TEKLIFI = {
  id: 900001,
  quote_code: 'TE-2026-900001',
  request_type: 'manual_quote',
  source_channel: 'ofis',
  status: 'quoted',
  priority: 'normal',
  created_at: '2026-10-08T08:57:00.000Z',
  updated_at: '2026-10-08T08:57:00.000Z',
  customer_name: 'Revize Deneme',
  customer_phone: '05550009001',
  customer_email: '',
  customer_company: 'Deneme Yapı',
  material_type: 'eps',
  brand_name: 'Optimix',
  model_name: 'Optimix Karbonlu 4 cm',
  thickness_cm: 4,
  area_m2: 1008,
  city_code: '34',
  city_name: 'İstanbul',
  package_name: 'Ofis teklifi',
  total_price: 158215.68,
  price_without_vat: 131846.4,
  vat_amount: 26369.28,
  price_per_m2: 130.8,
  discount_percentage: 0,
  consent_channel: 'telefon',
  package_items: {
    items: [
      {
        lineNo: 1,
        kind: 'levha',
        catalogKey: 'levha-42-4',
        name: 'Optimix Karbonlu 4 cm',
        quantity: 1008,
        unit: 'm²',
        unitPrice: 130.8,
        listUnitPrice: 130.8,
        lineDiscountPct: 0,
        totalPrice: 131846.4,
        isPlate: true,
      },
    ],
    manual: { title: null, notes: null, discountPct: 0, shippingCharge: 0, validityDays: 7, areaM2: 1008 },
  },
}

const SITE_TEKLIFI = {
  ...OFIS_TEKLIFI,
  id: 900002,
  quote_code: 'TY9000002',
  request_type: 'pdf_quote',
  source_channel: 'wizard',
  status: 'pending',
  customer_name: 'Site Deneme',
  customer_phone: '05550009002',
  customer_company: null,
  model_name: 'EPS Karbonlu',
  area_m2: 1680,
  package_name: 'Sadece Levha',
  package_items: {
    items: [
      {
        name: 'Expert EPS Karbonlu 4 cm EPS',
        unit: 'm²',
        isPlate: true,
        quantity: 1680,
        unitPrice: 120,
        totalPrice: 201600,
        packageCount: 280,
      },
    ],
  },
}

interface Yakalanan {
  method: string
  body: Record<string, unknown>
}

/** Teklif listesini taklit verilerle açar; kayıt isteklerini yakalar. */
async function acListe(browser: Browser): Promise<{ page: Page; kayitlar: Yakalanan[] }> {
  const context = await browser.newContext({
    httpCredentials: { username: ADMIN_USER, password: ADMIN_PASSWORD! },
  })
  const page = await context.newPage()
  const kayitlar: Yakalanan[] = []

  await page.route('**/api/admin/quotes', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await route.fulfill({
      json: { ok: true, quotes: [OFIS_TEKLIFI, SITE_TEKLIFI], eventsByQuoteId: {}, funnelSummary: {} },
    })
  })
  await page.route('**/api/admin/quotes/manual', async (route) => {
    const istek = route.request()
    const body = istek.postDataJSON() as Record<string, unknown>
    kayitlar.push({ method: istek.method(), body })
    await route.fulfill({
      status: istek.method() === 'PUT' ? 200 : 201,
      json: {
        ok: true,
        quoteId: istek.method() === 'PUT' ? body.quoteId : 900003,
        quoteCode: istek.method() === 'PUT' ? 'TE-2026-900001' : 'TE-2026-900003',
        revisionNo: 1,
        totals: {},
        warnings: [],
        pdfUploadCapability: null,
      },
    })
  })

  await page.goto('/ofis')
  await page.getByRole('button', { name: 'Teklifler' }).first().click()
  await expect(page.getByTestId('quote-revise-900001')).toBeVisible({ timeout: 30_000 })
  return { page, kayitlar }
}

test.describe('teklif revizyonu ve çoğaltma', () => {
  test.skip(!ADMIN_PASSWORD, '.env.local içinde ADMIN_PASSWORD tanımlı olmalı')

  test('AC-07: ofis teklifi aynı numarayla 1.008 → 1.680 m² revize edilir', async ({ browser }) => {
    const { page, kayitlar } = await acListe(browser)

    // Sitedeki sihirbazdan gelen teklif revize EDİLEMEZ; yalnız çoğaltılır.
    await expect(page.getByTestId('quote-revise-900002')).toHaveCount(0)
    await expect(page.getByTestId('quote-duplicate-900002')).toBeVisible()

    await page.getByTestId('quote-revise-900001').click()
    await expect(page.getByTestId('manual-quote-editor')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('revize-banner')).toContainText('TE-2026-900001')

    // Müşteri, şehir, kalem ve metraj kayıttan gelir.
    await expect(page.getByLabel('Müşteri adı *')).toHaveValue('Revize Deneme')
    await expect(page.getByLabel('Telefon *')).toHaveValue('05550009001')
    await expect(page.getByLabel('Firma')).toHaveValue('Deneme Yapı')
    await expect(page.locator('select').first()).toHaveValue('34')
    await expect(page.getByLabel('İş metrajı (m²)')).toHaveValue('1008')
    await expect(page.getByLabel('Satır 1 ürün adı')).toHaveValue('Optimix Karbonlu 4 cm')

    // 8 Ekim 2026 hatası: EPS 4 cm'de "1 kamyon" 1.008 m² yazıyordu.
    // Paket 6 m² × 280 paket = 1.680 m² olmalı.
    await page.locator('select').nth(2).selectOption('kamyon')
    await page.getByTestId('arac-1').click()
    await expect(page.getByLabel('İş metrajı (m²)')).toHaveValue('1680')
    await expect(page.getByTestId('arac-karsiligi')).toContainText('1 kamyon')

    // Miktar metrajla ölçeklenir, YAZILAN birim fiyat değişmez.
    expect(await sutun(page, 3)).toEqual(['1680'])
    expect(await sutun(page, 5)).toEqual(['130.8'])
    await expect(page.getByTestId('manual-quote-total')).toHaveText(/263\.692,80/)

    await expect(page.getByTestId('manual-quote-save')).toHaveText('Revizyonu kaydet')
    await page.getByTestId('manual-quote-save').click()
    await expect(page.getByTestId('manual-quote-success')).toContainText('Teklif revize edildi', {
      timeout: 60_000,
    })
    await expect(page.getByTestId('manual-quote-success')).toContainText('TE-2026-900001')

    // Yeni teklif AÇILMAZ: tek istek, PUT, aynı teklif kimliği.
    expect(kayitlar).toHaveLength(1)
    expect(kayitlar[0].method).toBe('PUT')
    expect(kayitlar[0].body).toMatchObject({
      quoteId: 900001,
      customerName: 'Revize Deneme',
      cityCode: '34',
      areaM2: 1680,
      expectedPriceWithoutVat: 219744,
    })
    expect((kayitlar[0].body.lines as Array<Record<string, unknown>>)[0]).toMatchObject({
      quantity: 1680,
      unitPrice: 130.8,
      thicknessCm: 4,
    })

    await page.context().close()
  })

  test('AC-08: çoğaltma müşteri ve şehri taşır, yeni teklif olarak kaydeder', async ({ browser }) => {
    const { page, kayitlar } = await acListe(browser)

    await page.getByTestId('quote-duplicate-900002').click()
    await expect(page.getByTestId('manual-quote-editor')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('revize-banner')).toHaveCount(0)

    // 8 Ekim 2026: ad, telefon ve şehir çoğaltmada yeniden giriliyordu.
    await expect(page.getByLabel('Müşteri adı *')).toHaveValue('Site Deneme')
    await expect(page.getByLabel('Telefon *')).toHaveValue('05550009002')
    await expect(page.locator('select').first()).toHaveValue('34')
    await expect(page.getByLabel('İş metrajı (m²)')).toHaveValue('1680')
    await expect(page.getByTestId('manual-quote-missing')).toHaveCount(0)

    await expect(page.getByTestId('manual-quote-save')).toHaveText('Teklifi kaydet')
    await page.getByTestId('manual-quote-save').click()
    await expect(page.getByTestId('manual-quote-success')).toContainText('Teklif kaydedildi', {
      timeout: 60_000,
    })

    expect(kayitlar).toHaveLength(1)
    expect(kayitlar[0].method).toBe('POST')
    expect(kayitlar[0].body).not.toHaveProperty('quoteId')
    expect(kayitlar[0].body).toMatchObject({ customerName: 'Site Deneme', cityCode: '34', areaM2: 1680 })

    await page.context().close()
  })

  test('AC-09: revizeden çıkılınca aynı içerik yeni teklif olarak kaydedilir', async ({ browser }) => {
    const { page, kayitlar } = await acListe(browser)

    await page.getByTestId('quote-revise-900001').click()
    await expect(page.getByTestId('revize-banner')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('revize-cik').click()
    await expect(page.getByTestId('revize-banner')).toHaveCount(0)
    await expect(page.getByLabel('Müşteri adı *')).toHaveValue('Revize Deneme')

    await page.getByTestId('manual-quote-save').click()
    await expect(page.getByTestId('manual-quote-success')).toBeVisible({ timeout: 60_000 })
    expect(kayitlar[0].method).toBe('POST')
    expect(kayitlar[0].body).not.toHaveProperty('quoteId')

    await page.context().close()
  })
})
