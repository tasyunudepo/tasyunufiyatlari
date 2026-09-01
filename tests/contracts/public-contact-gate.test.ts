import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const publicSalesFiles = [
  'app/page.tsx',
  'app/iletisim/page.tsx',
  'components/shared/SiteHeader.tsx',
  'components/shared/SiteFooter.tsx',
  'components/urunler-hub/TrustStrip.tsx',
  'components/catalog/ProductPricePanel.tsx',
  'components/catalog/StokAlternatifSection.tsx',
  'components/wizard/WizardStep1.tsx',
]

describe('herkese açık satış iletişim kapısı', () => {
  it('teklif öncesi sayfalarda doğrudan telefon veya WhatsApp bağlantısı yayınlamaz', () => {
    for (const relativePath of publicSalesFiles) {
      const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
      expect(source, relativePath).not.toMatch(/(?:tel:|wa\.me|WHATSAPP_URL|PhoneCallLink|WhatsappLink)/u)
    }
  })

  it('Bonus WhatsApp-first istisnasını yalnız çözülmüş fiyat ve araç planında açar', () => {
    const source = fs.readFileSync(
      path.join(root, 'components/catalog/BonusRegionPrice.tsx'),
      'utf8',
    )
    const purchaseBranch = source.slice(source.indexOf('variant === "purchase-desk"'))

    expect(purchaseBranch).toContain('buildWhatsAppLink(message)')
    expect(purchaseBranch).toMatch(/resolvedData\s*&&\s*purchaseCalculation/)
    expect(purchaseBranch).toContain('data-testid="pdp-whatsapp-primary"')
    expect(purchaseBranch).not.toContain('tel:')
  })

  it('danışmanlık vaadiyle kararsız talep toplamaz', () => {
    const source = publicSalesFiles
      .map((relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8'))
      .join('\n')

    expect(source).not.toMatch(/Emin değilim, benimle iletişime geçin|Kararsızım, birlikte seçelim/u)
  })
})
