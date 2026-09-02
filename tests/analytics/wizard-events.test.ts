import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  notifyComparisonCtaClick,
  notifyComparisonOpened,
  notifyPdfQuoteRequested,
  notifyProductDetailCtaClick,
  notifyProductDetailComparisonPathClick,
  notifyProductDetailSectionView,
  notifyWhatsappOrderRequested,
  notifyWizardCalculationStarted,
  notifyWizardShowPrices,
} from '@/lib/notifyWizardEvent'

afterEach(() => {
  vi.unstubAllGlobals()
})

const base = {
  material_type: 'tasyunu',
  brand_name: 'Dalmaçyalı',
  model_name: 'SW035',
  thickness_cm: 5,
  city_code: 34,
  city_name: 'İstanbul',
  area_m2: 806.4,
  total_m2: 806.4,
  package_count: 160,
  result_session_id: 'ga-only-session-1',
  selected_package_name: 'Dengeli Sistem',
  selected_package_total: 316_218,
  selected_per_m2: 326.78,
}

describe('Wizard GA4 event allowlist', () => {
  it.each([
    ['PDF', () => notifyPdfQuoteRequested({ ...base, customer_type: 'individual' })],
    ['WhatsApp', () => notifyWhatsappOrderRequested(base)],
  ])('%s eventinde yalnız ticari ölçüm alanlarını gönderir', (_name, notify) => {
    const gtag = vi.fn()
    vi.stubGlobal('window', {
      gtag,
      location: { pathname: '/urunler/test' },
    })

    notify()

    expect(gtag).toHaveBeenCalledTimes(1)
    const payload = gtag.mock.calls[0][2] as Record<string, unknown>
    expect(payload.page_path).toBe('/urunler/test')
    expect(payload).not.toHaveProperty('ref_code')
    expect(payload).not.toHaveProperty('customer_name')
    expect(payload).not.toHaveProperty('customer_phone')
    expect(payload).not.toHaveProperty('customer_email')
    expect(payload).not.toHaveProperty('customer_address')
    expect(JSON.stringify(payload)).not.toContain('05321234567')
  })

  it('karşılaştırma açılış ve CTA eventlerini aynı anonim oturuma bağlar', () => {
    const gtag = vi.fn()
    vi.stubGlobal('window', {
      gtag,
      location: { pathname: '/tasyunu-karsilastir' },
    })

    notifyComparisonOpened({
      surface: 'genel',
      urun_sayisi: 8,
      entry_placement: 'category',
      comparison_session_id: 'cmp_test_1',
    })
    notifyComparisonCtaClick({
      surface: 'genel',
      entry_placement: 'category',
      comparison_session_id: 'cmp_test_1',
      brand_name: 'Bonus',
      model_name: 'F 150',
      city_code: 6,
      thickness_cm: 8,
    })

    expect(gtag).toHaveBeenCalledTimes(2)
    expect(gtag.mock.calls[0][1]).toBe('Karsilastirma_Acildi')
    expect(gtag.mock.calls[1][1]).toBe('Karsilastirma_CTA_Click')
    expect(gtag.mock.calls[0][2]).toMatchObject({
      comparison_session_id: 'cmp_test_1',
      entry_placement: 'category',
    })
    expect(gtag.mock.calls[1][2]).toMatchObject({
      comparison_session_id: 'cmp_test_1',
      model_name: 'F 150',
    })
  })

  it('kategori kaynaklı hesap başlangıcı ve sonucu aynı journey kimliğini taşır', () => {
    const gtag = vi.fn()
    vi.stubGlobal('window', {
      gtag,
      location: { pathname: '/' },
    })
    const attribution = {
      entry_surface: 'category' as const,
      catalog_journey_id: 'cat_test_1',
      section_key: 'cati',
    }

    notifyWizardCalculationStarted({ ...base, ...attribution })
    notifyWizardShowPrices({ ...base, ...attribution, results_count: 3 })

    expect(gtag).toHaveBeenCalledTimes(2)
    expect(gtag.mock.calls.map((call) => call[1])).toEqual([
      'Fiyat_Hesaplama_Basladi',
      'Fiyat_Gosterildi',
    ])
    for (const call of gtag.mock.calls) {
      expect(call[2]).toMatchObject({
        entry_surface: 'category',
        catalog_journey_id: 'cat_test_1',
        section_key: 'cati',
      })
    }
  })

  it('kategori kaynaklı ürün detay eventinde uygulama bağlamını taşır', () => {
    const gtag = vi.fn()
    vi.stubGlobal('window', {
      gtag,
      location: { pathname: '/urunler/tasyunu-levha/ornek-urun' },
    })

    notifyProductDetailCtaClick({
      product_name: 'Örnek Ürün',
      brand_name: 'Bonus',
      product_slug: 'ornek-urun',
      cta_type: 'pdf',
      cta_location: 'product_detail_summary',
      entry_surface: 'category',
      catalog_journey_id: 'cat_test_1',
      section_key: 'cati',
    })

    expect(gtag.mock.calls[0][2]).toMatchObject({
      entry_surface: 'category',
      catalog_journey_id: 'cat_test_1',
      section_key: 'cati',
    })
  })

  it('WhatsApp-first PDP CTA eventini anonim seçim ve deney bağlamına bağlar', () => {
    const gtag = vi.fn()
    vi.stubGlobal('window', {
      gtag,
      location: { pathname: '/urunler/tasyunu-levha/bonus-f-150-pro-tasyunu' },
    })

    notifyProductDetailCtaClick({
      product_name: 'Bonus Premium F 150 Pro',
      brand_name: 'Bonus',
      product_slug: 'bonus-f-150-pro-tasyunu',
      thickness_cm: 5,
      city_code: 34,
      city_name: 'İstanbul',
      sub_region_name: 'Avrupa Yakası',
      area_m2: 967.68,
      total_m2: 967.68,
      vehicle_type: 'lorry',
      vehicle_label: '1 Kamyon',
      price_per_m2: 348.77,
      total_price: 337_497.75,
      shipping_mode: 'included_in_sale_price',
      experience_variant: 'a_whatsapp_first',
      result_session_id: 'pdp-test-session',
      cta_type: 'whatsapp',
      cta_location: 'product_detail_summary',
    })

    expect(gtag).toHaveBeenCalledTimes(1)
    expect(gtag.mock.calls[0][1]).toBe('PDP_CTA_Click')
    expect(gtag.mock.calls[0][2]).toMatchObject({
      cta_type: 'whatsapp',
      sub_region_name: 'Avrupa Yakası',
      vehicle_label: '1 Kamyon',
      shipping_mode: 'included_in_sale_price',
      experience_variant: 'a_whatsapp_first',
      result_session_id: 'pdp-test-session',
    })
    expect(gtag.mock.calls[0][2]).not.toHaveProperty('ref_code')
    expect(Object.keys(gtag.mock.calls[0][2] as Record<string, unknown>).length).toBeLessThanOrEqual(25)
  })

  it('PDP bölüm görünümü ile karşılaştırma yolunu kişisel veri olmadan ölçer', () => {
    const gtag = vi.fn()
    vi.stubGlobal('window', {
      gtag,
      location: { pathname: '/urunler/tasyunu-levha/optimix-tr7-5-tasyunu' },
    })

    notifyProductDetailSectionView({
      product_name: 'Optimix TR7.5',
      brand_name: 'Optimix',
      product_slug: 'optimix-tr7-5-tasyunu',
      result_session_id: 'pdp_test_1',
      section_name: 'technical',
      seen_sections: 'package|technical',
      elapsed_ms_bucket: '46_120s',
      max_scroll_bucket: '75_89',
    })
    notifyProductDetailComparisonPathClick({
      product_name: 'Optimix TR7.5',
      brand_name: 'Optimix',
      product_slug: 'optimix-tr7-5-tasyunu',
      result_session_id: 'pdp_test_1',
      comparison_session_id: 'cmp_test_1',
      comparison_route: 'all_products',
      thickness_cm: 5,
      city_code: 34,
    })

    expect(gtag.mock.calls.map((call) => call[1])).toEqual([
      'PDP_Section_View',
      'PDP_Comparison_Path_Click',
    ])
    expect(gtag.mock.calls[0][2]).toMatchObject({
      seen_sections: 'package|technical',
      elapsed_ms_bucket: '46_120s',
    })
    expect(gtag.mock.calls[1][2]).toMatchObject({
      comparison_route: 'all_products',
      comparison_session_id: 'cmp_test_1',
    })
    expect(JSON.stringify(gtag.mock.calls)).not.toContain('customer_')
  })
})
