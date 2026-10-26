import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { isStorefrontHiddenBrandId, STOREFRONT_HIDDEN_BRAND_IDS } from '@/lib/catalog/storefrontBrands'

// Emrah, 26 Ekim 2026: "TEKNO'nun 21 ürün sayfası, /marka/tekno sayfası ve
// bayilik logosu çıkaralım." Kayıt veritabanında ve ofiste durur.
const src = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')

describe('TEKNO sitenin ön yüzünde yok', () => {
  it('TEKNO (6) gizli marka; diğerleri değil', () => {
    expect(STOREFRONT_HIDDEN_BRAND_IDS).toEqual([6])
    expect(isStorefrontHiddenBrandId(6)).toBe(true)
    for (const id of [1, 2, 4, 11, 12, null]) expect(isStorefrontHiddenBrandId(id)).toBe(false)
  })

  it('katalog, tek ürün, ürün merkezi ve site haritası gizli markayı eler', () => {
    const server = src('lib/catalog/server.ts')
    expect(server).toContain('.filter(\n      (r) => !isStorefrontHiddenBrandId(r.brand_id),\n    )')
    expect(server).toContain('if (isStorefrontHiddenBrandId(row.brands?.id)) return null;')
    expect(src('lib/catalog/hub.ts')).toContain('const HUB_BRAND_IDS = [1, 2, 4, 11];')
    const sitemap = src('app/sitemap.ts')
    expect(sitemap).toContain("const BRAND_SLUGS = ['dalmacyali', 'filli-boya', 'optimix', 'oem'];")
    expect(sitemap).toContain('if (isStorefrontHiddenBrandId(row.brand_id)) continue;')
  })

  it('eski adresler kalıcı olarak kategoriye ve ürün merkezine yönlenir', () => {
    const config = src('next.config.ts')
    expect(config).toContain("{ source: '/urunler/:kategori/tekno-:slug', destination: '/urunler/:kategori', permanent: true }")
    expect(config).toContain("{ source: '/marka/tekno', destination: '/urunler', permanent: true }")
    expect(config).toContain("{ source: '/marka/tekno/:kategori', destination: '/urunler/:kategori', permanent: true }")
  })

  it('bayilik şeridinde ve tanıtım cümlesinde TEKNO geçmez', () => {
    expect(src('components/home/DealerBrandStrip.tsx')).not.toMatch(/tekno/i)
    expect(src('components/cro/BrandStrip.tsx')).not.toMatch(/tekno/i)
    expect(src('components/cro/ProofBlock.tsx')).not.toMatch(/tekno/i)
  })
})
