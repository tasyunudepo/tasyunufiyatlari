import { describe, expect, it } from 'vitest'

import {
  buildCategoryProductQuery,
  getCategoryEntryContext,
} from '@/lib/catalog/category-entry-context'

describe('kategori → ürün detay bağlamı', () => {
  it('yeni ürün bağlantısında entry ve uygulama parametrelerini üretir', () => {
    expect(buildCategoryProductQuery('cati')).toBe('entry=category&uygulama=cati')
  })

  it('yeni uygulama parametresini geçerli bölüm bağlamına dönüştürür', () => {
    expect(getCategoryEntryContext('?entry=category&uygulama=cati')).toMatchObject({
      entrySurface: 'category',
      sectionKey: 'cati',
      sectionTitle: 'Çatı Levhaları',
      returnHref: '/urunler/tasyunu-levha?uygulama=cati#urunler',
    })
  })

  it('eski section parametresini geriye uyumlu okur', () => {
    expect(getCategoryEntryContext('?entry=category&section=cati')).toMatchObject({
      sectionKey: 'cati',
      isLegacySectionParam: true,
    })
  })

  it('kategori dışı veya bilinmeyen bağlamı kabul etmez', () => {
    expect(getCategoryEntryContext('?entry=pdp&uygulama=cati')).toBeNull()
    expect(getCategoryEntryContext('?entry=category&uygulama=bilinmeyen')).toBeNull()
  })
})
