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
    ).toContainText(/Yapıştırıcı/i)

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

  test('AC-06: Diyarbakır Optimix %9 + %8 ve 9 cm levhaya 15,5 cm dübel', async ({
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

    // 14 Ağustos 2026 düzeltmesi: önceki kabul 9 cm levhada ilk kayıt olan
    // 11,5 cm dübeli kilitliyordu. Tedarikçi kuralı 7–10 cm taşyününde
    // 15,5 cm olduğundan ürün ve buna bağlı teklif toplamı birlikte değişti.
    const urunler = await sutun(page, 2)
    expect(urunler).toContain('Fawori Optimix Taşyünü Dübeli Çelik Çivili 15,5cm 200 adet')
    expect(urunler).not.toContain('Fawori Optimix Taşyünü Dübeli Çelik Çivili 11,5cm 200 adet')

    expect((await sutun(page, 5)).slice(1)).toEqual([
      '180.65', '199.99', '1274.64', '1350.24', '2329.51', '1213.1', '284.82',
    ])
    await expect(page.getByText('2.884.103,48 ₺')).toBeVisible()

    await page.context().close()
  })
})
