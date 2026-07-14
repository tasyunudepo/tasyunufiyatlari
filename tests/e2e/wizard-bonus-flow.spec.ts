import { expect, test } from '@playwright/test'

// Bonus harman paket akışı (karar 13 revizyonu, 13 Temmuz 2026):
// Bonus levha + Expert/Optimix/TEKNO toz grubu üç paket kartı üretir.
// Bonus markası canlı DB'de aktif değilse testler atlanır.

test.describe('Bonus harman paket teklifi', () => {
  test('Bonus akışı: kapasiteli metraj adımı + 3 harman paketi', async ({ page }) => {
    await page.goto('/')
    const wizard = page.locator('#mantolama-hesaplayici')

    // Marka listesi Supabase'ten asenkron gelir; önce hidrasyonu bekle.
    await expect(
      wizard.locator('button').filter({ hasText: 'Dalmaçyalı' }).first(),
    ).toBeVisible({ timeout: 20_000 })

    const bonusButton = wizard.locator('button').filter({ hasText: 'Bonus' }).first()
    if ((await bonusButton.count()) === 0) {
      test.skip(true, 'Bonus markası canlıda aktif değil (migration/aktivasyon bekliyor).')
      return
    }

    await bonusButton.click()
    await expect(wizard.getByRole('button', { name: /F 150/ }).first()).toBeVisible()
    await wizard.getByRole('button', { name: 'F 150', exact: true }).click()

    await wizard.getByRole('button', { name: 'Kalınlık Seçimine Geç' }).click()
    await wizard.getByRole('button', { name: '5cm' }).click()
    await wizard.getByRole('button', { name: 'Konum Seçimine Geç' }).click()
    await wizard.locator('select').selectOption({ label: 'İstanbul' })
    await wizard.getByRole('button', { name: 'Avrupa Yakası' }).click()
    await wizard.getByRole('button', { name: 'Metraj Gir' }).click()

    // A2 kabulü: metraj adımı Bonus'un KENDİ kapasiteleriyle pozisyon alır
    // (F 150 / 5 cm: kamyon 967,7 m² — genel 480/1200 kaydı değil).
    await expect(wizard.getByText(/967,7/).first()).toBeVisible({ timeout: 15_000 })

    // Ara metraj tam araç düzenine uymaz: inline uyarı + CTA kilidi.
    const metrajInput = wizard.locator('input[type="number"]')
    await metrajInput.fill('500')
    await expect(wizard.getByText('Bu metraj tam araç düzenine uymuyor')).toBeVisible()
    await expect(wizard.getByRole('button', { name: '3 Teklifi Karşılaştır' })).toBeDisabled()

    // Üretici listesindeki birebir tam TIR değeri geçerlidir.
    await metrajInput.fill('1774.1')
    const compareButton = wizard.getByRole('button', { name: '3 Teklifi Karşılaştır' })
    await expect(compareButton).toBeEnabled()
    await compareButton.click()

    // B kabulü: üç harman paketi kartı (Expert/Optimix/TEKNO toz grubu).
    await expect(page.getByText('Premium Sistem').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Dengeli Sistem').first()).toBeVisible()
    await expect(page.getByText('Ekonomik Sistem').first()).toBeVisible()

    // Levha kalemi her kartta Bonus markasıyla listelenir.
    await expect(page.getByText(/Bonus F 150/).first()).toBeVisible()

    // TEKNO tozlu pakette sevkiyat ayrı teyide bağlanır (mevcut marka kuralı).
    await expect(page.getByText(/sevkiyat verisi henüz kesinleşmedi/).first()).toBeVisible()

    // Çifte marj kilidi (uçtan uca): sunucu levha fiyatı ile set m² fiyatı
    // tutarlı olmalı — set fiyatı levha fiyatının altına inemez.
    const res = await page.request.get(
      '/api/bonus-price?model=F%20150&thicknessCm=5&cityCode=34&sub=avrupa',
    )
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.salePricePerM2).toBe(370.03)
  })

  test('EPS seçiminde Bonus listelenmez; Bonus seçiliyken EPS\'e geçiş akışı tıkamaz', async ({ page }) => {
    await page.goto('/')
    const wizard = page.locator('#mantolama-hesaplayici')

    await expect(
      wizard.locator('button').filter({ hasText: 'Dalmaçyalı' }).first(),
    ).toBeVisible({ timeout: 20_000 })

    const bonusButton = wizard.locator('button').filter({ hasText: 'Bonus' }).first()
    if ((await bonusButton.count()) === 0) {
      test.skip(true, 'Bonus markası canlıda aktif değil.')
      return
    }

    // Bonus seçiliyken EPS'e geç: Bonus'un EPS ürünü yok.
    await bonusButton.click()
    await wizard.locator('button').filter({ hasText: 'EPS' }).first().click()

    // Bonus butonu marka listesinden kalkar, seçim geçerli markaya döner
    // ve akış ilerleyebilir (modelsiz tıkanma regresyonu).
    await expect(wizard.locator('button').filter({ hasText: 'Bonus' })).toHaveCount(0)
    await expect(wizard.getByRole('button', { name: 'Kalınlık Seçimine Geç' })).toBeEnabled()

    // Taşyününe dönünce Bonus tekrar görünür.
    await wizard.locator('button').filter({ hasText: 'Taşyünü' }).first().click()
    await expect(wizard.locator('button').filter({ hasText: 'Bonus' }).first()).toBeVisible()
  })
})
