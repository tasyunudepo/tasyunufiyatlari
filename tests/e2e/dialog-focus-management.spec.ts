import { expect, test } from '@playwright/test'

const PRODUCT_PATH = '/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu'

function channelToLinear(value: number) {
  const normalized = value / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function luminance([red, green, blue]: number[]) {
  return (
    0.2126 * channelToLinear(red)
    + 0.7152 * channelToLinear(green)
    + 0.0722 * channelToLinear(blue)
  )
}

function contrastRatio(foreground: number[], background: number[]) {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

test.describe('Dialog klavye ve odak yönetimi', () => {
  test('mobil menü kapalıyken Tab sırasından çıkar, açıkken odağı hapseder ve iade eder', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(PRODUCT_PATH)

    const opener = page.getByRole('button', { name: 'Menüyü aç' })
    const drawerElement = page.locator('#mobile-drawer')

    await expect(drawerElement).toHaveAttribute('aria-hidden', 'true')
    await expect(drawerElement).toHaveAttribute('inert', '')
    await expect(page.getByRole('dialog', { name: 'Mobil menü' })).toHaveCount(0)

    await opener.focus()
    await page.keyboard.press('Tab')
    expect(await drawerElement.evaluate((drawer) => drawer.contains(document.activeElement))).toBe(false)

    await opener.focus()
    await opener.click()

    const drawer = page.getByRole('dialog', { name: 'Mobil menü' })
    const closeButton = drawer.getByRole('button', { name: 'Menüyü kapat' })
    const lastAction = drawer.getByRole('link', { name: 'Fiyatımı Hesapla' })

    await expect(drawer).toBeVisible()
    await expect(drawer).not.toHaveAttribute('aria-hidden')
    await expect(drawer).not.toHaveAttribute('inert')
    await expect(closeButton).toBeFocused()

    await page.keyboard.press('Shift+Tab')
    await expect(lastAction).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(closeButton).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Mobil menü' })).toHaveCount(0)
    await expect(drawerElement).toHaveAttribute('aria-hidden', 'true')
    await expect(drawerElement).toHaveAttribute('inert', '')
    await expect(opener).toBeFocused()
  })

  test('PDF teklif modalı etiketleri, odak tuzağı, Escape ve CTA kontrastını korur', async ({ page }) => {
    await page.goto(PRODUCT_PATH)

    const opener = page.getByRole('button', { name: 'PDF teklifimi hazırla' })
    await opener.click()

    const dialog = page.getByRole('dialog', { name: 'Teklif Bilgileri' })
    const relatedPerson = dialog.getByLabel(/Ad Soyad \/ Firma/)
    const phone = dialog.getByLabel(/Telefon/)
    const closeButton = dialog.getByRole('button', { name: 'Kapat' })
    const submitButton = dialog.getByRole('button', { name: 'PDF Teklif Kaydı Oluştur' })

    await expect(dialog).toBeVisible()
    await expect(relatedPerson).toBeFocused()
    await expect(relatedPerson).toHaveAttribute('id', 'pdf-related-person')
    await expect(phone).toHaveAttribute('id', 'pdf-phone')
    await expect(dialog.locator('label[for="pdf-related-person"]')).toHaveCount(1)
    await expect(dialog.locator('label[for="pdf-phone"]')).toHaveCount(1)

    await closeButton.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(submitButton).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(closeButton).toBeFocused()

    const colors = await submitButton.evaluate((button) => {
      const styles = getComputedStyle(button)
      const parseRgb = (value: string) => (
        value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0]
      )
      return {
        foreground: parseRgb(styles.color),
        background: parseRgb(styles.backgroundColor),
      }
    })
    expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
})
