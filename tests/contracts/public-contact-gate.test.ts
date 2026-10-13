import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

// Emrah kararı (13 Ekim 2026, "tıklanabilir iletişim bilgileri olsun, bir daha deneyelim"): ana sayfa ve iletişim
// sayfasında telefon ve WhatsApp yeniden açıldı. 19 Ağustos 2026 kapısı (docs/verification/PLAN-1-TIR-LEAD-GATE-2026-08-19.md,
// AC-009) üst menü, alt bilgi, katalog/PDP ve hesaplayıcıda sürer: bu iki sayfa aşağıdaki yasak listesinden çıktı ve
// kendi sözleşmesini aldı.
const openContactPages = ['app/page.tsx', 'app/iletisim/page.tsx']
const publicSalesFiles = [
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

  it('ana sayfa ve iletişim sayfası tıklanabilir telefon ve WhatsApp yayınlar; bağlantılar ölçümlü bileşenden geçer', () => {
    for (const relativePath of openContactPages) {
      const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
      // Numara ve adres tek kaynaktan (lib/business/info.ts); tıklama Telefon_Aramalari / Whatsapp_Yazanlar olayını atar.
      expect(source, relativePath).toMatch(/<PhoneCallLink\b[^>]*href=\{TEL_URL\}/u)
      expect(source, relativePath).toMatch(/<WhatsappLink\b[^>]*href=\{WHATSAPP_URL\}/u)
      // Ölçümsüz düz bağlantı yok: elle yazılmış tel: ya da wa.me adresi olayı atlamış olur.
      expect(source, relativePath).not.toMatch(/href=(?:"|\{`|\{')(?:tel:|https:\/\/wa\.me)/u)
    }
  })

  it('iletişim sayfası artık "iletişim teklif kaydından sonra açılır" demez', () => {
    const source = fs.readFileSync(path.join(root, 'app/iletisim/page.tsx'), 'utf8')
    expect(source).not.toMatch(/teklif kaydı tamamlandığında|referanslı teklif oluştuktan sonra açılır/u)
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
    const source = [...publicSalesFiles, ...openContactPages]
      .map((relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8'))
      .join('\n')

    expect(source).not.toMatch(/Emin değilim, benimle iletişime geçin|Kararsızım, birlikte seçelim/u)
  })
})
