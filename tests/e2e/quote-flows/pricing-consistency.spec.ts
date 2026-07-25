import { expect, test, type Locator } from '@playwright/test'

/**
 * Hesap tutarlılığı E2E'si (karar: 2026-07-23).
 *
 * Gerçek veriyle wizard'ı koşturur ve 3 paket kartında fiyat
 * İLİŞKİLERİNİ iddia eder — fiyatlar aylık değiştiği için sabit
 * rakam yerine değişmez matematik kuralları kilitlenir:
 *
 *   1. Büyük rakam (KDV dahil m²) = KDV hariç m² × 1,20
 *   2. Toplam (KDV dahil) ≈ KDV dahil m² × metraj
 *
 * Kesin zincir rakamları birim testlerde (calc-pricing.test.ts),
 * canlı veri kuralları verify:live:readonly bekçisindedir.
 * Bu üçlü birlikte "ekranda görünen rakam yanlış tabandan geliyor"
 * sınıfındaki hataları (Tekno KDV vakası) uçtan uca yakalar.
 */

function parseTl(text: string): number {
  const match = text.replace(/\./g, '').replace(',', '.').match(/[\d.]+/)
  if (!match) throw new Error(`Sayı ayrıştırılamadı: "${text}"`)
  return parseFloat(match[0])
}

async function cardNumbers(card: Locator) {
  const bigM2Text = await card
    .locator('div.font-heading.text-4xl')
    .innerText()
  const totalLine = await card.getByText(/^Toplam:/).innerText()
  const haricLine = await card.getByText(/KDV hariç m²:/).innerText()
  return {
    m2WithVat: parseTl(bigM2Text),
    totalWithVat: parseTl(totalLine.replace('Toplam:', '')),
    m2WithoutVat: parseTl(haricLine.replace('KDV hariç m²:', '')),
  }
}

test('3 paket kartında KDV dahil/hariç tabanı ve toplam-metraj ilişkisi tutarlıdır', async ({ page }) => {
  test.setTimeout(90_000)

  await page.goto('/')
  const wizard = page.locator('#mantolama-hesaplayici')

  // Dalmaçyalı akışı: kartlarda hem levha hem Tekno toz grubu fiyatlanır.
  await wizard.locator('button').filter({ hasText: 'Dalmaçyalı' }).first().click()
  await wizard.getByRole('button', { name: 'Kalınlık Seçimine Geç' }).click()
  await expect(wizard.getByText('Yalıtım Kalınlığını Seçin')).toBeVisible()
  await wizard.getByRole('button', { name: 'Konum Seçimine Geç' }).click()
  await expect(wizard.getByText('Teslimat İli')).toBeVisible()
  await wizard.locator('select').selectOption({ label: 'İstanbul' })
  await wizard.getByRole('button', { name: 'Metraj Gir' }).click()
  await expect(wizard.getByText('Sipariş metrajı')).toBeVisible()

  const metrajInput = wizard.locator('input[inputmode="decimal"], input[type="number"], input[type="text"]').first()
  // Input değeri JS sayı formatındadır ("806.4") — tr görüntü formatı değil.
  const rawMetraj = await metrajInput.inputValue()
  const metraj = rawMetraj.includes(',')
    ? parseTl(rawMetraj)
    : parseFloat(rawMetraj)
  expect(metraj).toBeGreaterThan(0)

  await wizard.getByRole('button', { name: '3 Teklifi Karşılaştır' }).click()

  await expect(page.getByText(/KDV hariç m²:/).first()).toBeVisible({ timeout: 20_000 })
  const cardCount = await page.getByText(/KDV hariç m²:/).count()
  expect(cardCount).toBeGreaterThanOrEqual(3)

  const cardRoots = page.locator('div.rounded-2xl.border-2', {
    has: page.getByText(/KDV hariç m²:/),
  })
  const n = await cardRoots.count()
  expect(n).toBeGreaterThanOrEqual(3)

  for (let i = 0; i < n; i++) {
    const { m2WithVat, totalWithVat, m2WithoutVat } = await cardNumbers(cardRoots.nth(i))

    // 1. Aynı taban: dahil = hariç × 1,20 (kuruş yuvarlama toleransı)
    expect(m2WithVat).toBeGreaterThan(0)
    expect(Math.abs(m2WithVat - m2WithoutVat * 1.2)).toBeLessThan(0.05)

    // 2. Toplam, m² fiyatı × metraj ile tutarlı (yuvarlama + binlik gösterim toleransı)
    expect(Math.abs(totalWithVat - m2WithVat * metraj) / totalWithVat).toBeLessThan(0.01)
  }
})
