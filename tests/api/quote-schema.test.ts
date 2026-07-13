import { describe, expect, it } from 'vitest'

import { apiQuoteSchema, quoteSchema } from '@/lib/schemas/quote.schema'

const basePayload = {
  customerName: 'Emrah Test',
  customerEmail: '',
  customerPhone: '0532 123 45 67',
  customerCompany: '',
  customerAddress: '',
  submissionType: 'pdf_quote' as const,
  sourceChannel: 'wizard',
  materialType: 'eps' as const,
  brandId: 1,
  brandName: 'Dalmaçyalı',
  modelId: 1,
  modelName: 'Test Levha',
  thicknessCm: 5,
  areaM2: 400,
  cityCode: '34',
  cityName: 'İstanbul',
  districtCode: null,
  districtName: null,
  packageName: 'Dengeli Paket',
  packageDescription: '',
  plateBrandName: 'Dalmaçyalı',
  accessoryBrandName: 'Dalmaçyalı',
  totalPrice: 1200,
  pricePerM2: 3,
  shippingCost: 0,
  discountPercentage: 0,
  priceWithoutVat: 1000,
  vatAmount: 200,
  packageCount: 80,
  packageSizeM2: 5,
  itemsPerPackage: 1,
  vehicleType: 'none' as const,
  lorryCapacityPackages: null,
  truckCapacityPackages: null,
  lorryFillPercentage: null,
  truckFillPercentage: null,
  packageItems: {},
  quoteCode: 'TYTEST001',
  pdfUrl: null,
  pdfStoragePath: null,
}

describe('quote API KVKK şeması', () => {
  it('onaysız payloadı reddeder', () => {
    const result = apiQuoteSchema.safeParse(basePayload)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'kvkkConsent')).toBe(true)
    }
  })

  it('gerçek onayı kabul eder', () => {
    expect(
      apiQuoteSchema.safeParse({ ...basePayload, kvkkConsent: true }).success,
    ).toBe(true)
  })
})

describe('quote API telefon şeması', () => {
  it('biçim karakterleri dışında en az 10 rakam ister', () => {
    const result = apiQuoteSchema.safeParse({
      ...basePayload,
      customerPhone: '-------',
      kvkkConsent: true,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === 'customerPhone'),
      ).toBe(true)
    }
  })

  it('10 rakamlı yerel telefonu kabul eder', () => {
    expect(
      apiQuoteSchema.safeParse({
        ...basePayload,
        customerPhone: '532 123 45 67',
        kvkkConsent: true,
      }).success,
    ).toBe(true)
  })

  it('form şemasında da rakamsız telefonu reddeder', () => {
    expect(
      quoteSchema.safeParse({
        customerName: 'Emrah Test',
        customerEmail: '',
        customerPhone: '----------',
        customerCompany: '',
        customerAddress: '',
        kvkkConsent: true,
      }).success,
    ).toBe(false)
  })
})
