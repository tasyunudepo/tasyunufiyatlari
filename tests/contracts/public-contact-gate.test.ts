import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const publicSalesFiles = [
  'app/page.tsx',
  'components/shared/SiteHeader.tsx',
  'components/shared/SiteFooter.tsx',
  'components/urunler-hub/TrustStrip.tsx',
  'components/catalog/ProductPricePanel.tsx',
  'components/catalog/StokAlternatifSection.tsx',
  'components/wizard/WizardStep1.tsx',
]

// Emrah kararı (14 Ekim 2026 öğle): iletişim sayfasında telefon numarası güven için yazılı durur;
// telefon ve WhatsApp düğmeleri önce "siparişiniz en az 1 tam kamyon mu?" diye sorar. 14 Ekim gece
// herkese açık bağlantılar 25 m²'lik talepleri geri getirmişti. Ana sayfada telefon/WhatsApp yok.
const contactPage = 'app/iletisim/page.tsx'
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

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

  it('iletişim sayfası telefon ve WhatsApp\'ı yalnız en az sipariş penceresinden açar', () => {
    const source = read(contactPage)
    expect(source).not.toMatch(/(?:tel:|wa\.me|<PhoneCallLink|<WhatsappLink)/u)
    expect(source).toMatch(/<GuardedContactLink\s+channel="phone"\s+href=\{TEL_URL\}/u)
    expect(source).toMatch(/<GuardedContactLink\s+channel="whatsapp"\s+href=\{WHATSAPP_URL\}/u)
    expect(source).toContain('data-testid="minimum-order-panel"')
    // Numaranın kendisi bağlantı değildir: elle tıklanınca pencereyi atlamasın.
    expect(source).toMatch(/<p className="[^"]*">\s*\{PHONE\}\s*<\/p>/u)
    expect(source).not.toMatch(/teklif kaydı tamamlandığında|referanslı teklif oluştuktan sonra açılır/u)
  })

  it('pencere "Evet"ten önce bağlantının ölçümünü ve gezinmesini durdurur', () => {
    const source = read('components/sales/GuardedContactLink.tsx')
    const capture = source.slice(source.indexOf('const handleClickCapture'), source.indexOf('const confirm'))
    expect(capture).toContain('event.preventDefault()')
    expect(capture).toContain('event.stopPropagation()')
    expect(source).toContain('onClickCapture={handleClickCapture}')
    expect(source.slice(source.indexOf('const confirm'))).toMatch(/allowNextRef\.current = true[\s\S]*querySelector\('a'\)\?\.click\(\)/u)
  })

  it('ana sayfa en az sipariş şeridini gösterir', () => {
    expect(read('app/page.tsx')).toContain('<MinimumOrderBanner />')
  })

  it('danışmanlık vaadiyle kararsız talep toplamaz', () => {
    const source = [...publicSalesFiles, contactPage]
      .map((relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8'))
      .join('\n')

    expect(source).not.toMatch(/Emin değilim, benimle iletişime geçin|Kararsızım, birlikte seçelim/u)
  })
})
