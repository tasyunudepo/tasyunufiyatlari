import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  QuoteGuardInputError,
  buildQuoteFingerprint,
  getTrustedClientIp,
  hashGuardValue,
  normalizePhoneForGuard,
  readIdempotencyKey,
} from '@/lib/security/quoteSubmissionGuard'

const TEST_SECRET = 'test-only-quote-guard-secret-32-bytes-minimum'

describe('normalizePhoneForGuard', () => {
  it.each([
    '0532 123 45 67',
    '5321234567',
    '+90 (532) 123-45-67',
    '0090 532 123 45 67',
  ])('%s biçimini aynı Türkiye numarasına dönüştürür', (phone) => {
    expect(normalizePhoneForGuard(phone)).toBe('905321234567')
  })

  it('uluslararası numarayı ülke koduyla rakamsal saklar', () => {
    expect(normalizePhoneForGuard('+44 20 7946 0958')).toBe('442079460958')
  })

  it.each(['-------', '123456789', '', '+() -'])('%s değerini reddeder', (phone) => {
    expect(() => normalizePhoneForGuard(phone)).toThrow(QuoteGuardInputError)
  })
})

describe('readIdempotencyKey', () => {
  it('geçerli UUID anahtarını kabul eder', () => {
    const headers = new Headers({
      'Idempotency-Key': '3f43a9b2-d620-4f16-b173-8fc4d59eedbe',
    })

    expect(readIdempotencyKey(headers)).toBe(
      '3f43a9b2-d620-4f16-b173-8fc4d59eedbe',
    )
  })

  it.each([
    undefined,
    'short',
    'contains spaces-invalid-key',
    'a'.repeat(129),
  ])('geçersiz anahtarı reddeder: %s', (key) => {
    const headers = new Headers()
    if (key) headers.set('Idempotency-Key', key)

    expect(() => readIdempotencyKey(headers)).toThrow(QuoteGuardInputError)
  })
})

describe('getTrustedClientIp', () => {
  it('x-forwarded-for zincirinin platforma en yakın ilk istemci adresini alır', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.24, 10.0.0.5',
      'x-real-ip': '198.51.100.7',
    })

    expect(getTrustedClientIp(headers)).toBe('203.0.113.24')
  })

  it('x-forwarded-for yoksa x-real-ip kullanır', () => {
    const headers = new Headers({ 'x-real-ip': '2001:db8::8' })

    expect(getTrustedClientIp(headers)).toBe('2001:db8::8')
  })

  it('güvenilir ve geçerli IP yoksa fail-closed davranır', () => {
    expect(() => getTrustedClientIp(new Headers())).toThrow(QuoteGuardInputError)
    expect(() =>
      getTrustedClientIp(new Headers({ 'x-forwarded-for': 'spoofed-value' })),
    ).toThrow(QuoteGuardInputError)
  })
})

describe('hashGuardValue', () => {
  it('ham değeri sızdırmayan 64 karakterlik HMAC-SHA256 üretir', () => {
    const hash = hashGuardValue('phone', '905321234567', TEST_SECRET)

    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toContain('905321234567')
  })

  it('aynı değeri bağlama göre farklı hashler', () => {
    expect(hashGuardValue('phone', 'aynı-değer', TEST_SECRET)).not.toBe(
      hashGuardValue('ip', 'aynı-değer', TEST_SECRET),
    )
  })

  it('kısa secret değerini reddeder', () => {
    expect(() => hashGuardValue('phone', '905321234567', 'kısa')).toThrow(
      QuoteGuardInputError,
    )
  })
})

describe('buildQuoteFingerprint', () => {
  const basePayload = {
    customerName: 'Emrah Test',
    customerPhone: '0532 123 45 67',
    submissionType: 'pdf_quote',
    sourceChannel: 'wizard',
    materialType: 'eps',
    brandId: 1,
    brandName: 'Dalmaçyalı',
    modelId: 11,
    modelName: 'EPS Levha',
    thicknessCm: 5,
    areaM2: 400,
    cityCode: '34',
    cityName: 'İstanbul',
    districtCode: null,
    packageName: 'Dengeli Paket',
    totalPrice: 120_000,
    pricePerM2: 300,
    shippingCost: 0,
    discountPercentage: 9,
    priceWithoutVat: 100_000,
    vatAmount: 20_000,
    packageCount: 80,
    packageSizeM2: 5,
    itemsPerPackage: 1,
    vehicleType: 'none',
    packageItems: {
      logistics: { shippingIncluded: true, vehicle: null },
      items: [{ id: 2, quantity: 80 }],
    },
    quoteCode: 'TY0000001',
    pdfUrl: 'https://example.test/first.pdf',
    pdfStoragePath: 'first.pdf',
  }

  it('nesne anahtar sırası ile geçici PDF/ref alanlarından etkilenmez', () => {
    const first = buildQuoteFingerprint(basePayload, TEST_SECRET)
    const second = buildQuoteFingerprint(
      {
        ...basePayload,
        quoteCode: 'TY9999999',
        pdfUrl: 'https://example.test/second.pdf',
        pdfStoragePath: 'second.pdf',
        packageItems: {
          items: [{ quantity: 80, id: 2 }],
          logistics: { vehicle: null, shippingIncluded: true },
        },
      },
      TEST_SECRET,
    )

    expect(first).toBe(second)
  })

  it('ticari olarak farklı isteğe farklı fingerprint verir', () => {
    expect(buildQuoteFingerprint(basePayload, TEST_SECRET)).not.toBe(
      buildQuoteFingerprint({ ...basePayload, areaM2: 500 }, TEST_SECRET),
    )
  })

  it('müşteri adındaki biçim farkını yeni teklif saymaz', () => {
    expect(buildQuoteFingerprint(basePayload, TEST_SECRET)).toBe(
      buildQuoteFingerprint(
        { ...basePayload, customerName: 'Başka Yazım' },
        TEST_SECRET,
      ),
    )
  })

  it('karşılaştırma atfını ticari talebi değiştirip dedupe atlatmak için kullanmaz', () => {
    const comparisonPayload = {
      ...basePayload,
      sourceChannel: 'comparison',
      comparisonSessionId: 'cmp_m123abc_def456',
      packageItems: {
        ...basePayload.packageItems,
        attribution: {
          entry_surface: 'comparison',
          comparison_session_id: 'cmp_m123abc_def456',
          result_session_id: 'result_123',
        },
      },
    }

    expect(buildQuoteFingerprint(comparisonPayload, TEST_SECRET)).toBe(
      buildQuoteFingerprint(basePayload, TEST_SECRET),
    )
  })
})

describe('QUOTE_ABUSE_HASH_SECRET', () => {
  const originalSecret = process.env.QUOTE_ABUSE_HASH_SECRET

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.QUOTE_ABUSE_HASH_SECRET
    } else {
      process.env.QUOTE_ABUSE_HASH_SECRET = originalSecret
    }
  })

  it('parametre verilmezse server-only env secret kullanır', () => {
    process.env.QUOTE_ABUSE_HASH_SECRET = TEST_SECRET

    expect(hashGuardValue('ip', '203.0.113.24')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('env secret yoksa fail-closed davranır', () => {
    delete process.env.QUOTE_ABUSE_HASH_SECRET

    expect(() => hashGuardValue('ip', '203.0.113.24')).toThrow(
      QuoteGuardInputError,
    )
  })
})
