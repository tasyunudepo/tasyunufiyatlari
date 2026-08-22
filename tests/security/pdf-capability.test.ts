import { createHmac } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  PdfCapabilityError,
  assertPdfCapabilityConfigured,
  createPdfCapabilityToken,
  verifyPdfCapabilityToken,
} from '@/lib/security/pdfCapability'

const TEST_SECRET = 'test-only-pdf-capability-secret-32-bytes-minimum'
const OTHER_SECRET = 'another-test-pdf-capability-secret-32-bytes'
const NOW_SECONDS = 1_800_000_000

function signPayloadPart(payloadPart: string): string {
  return createHmac('sha256', TEST_SECRET)
    .update('pdf-capability-v1', 'utf8')
    .update('\0', 'utf8')
    .update(payloadPart, 'utf8')
    .digest('base64url')
}

function signRawPayload(payload: string): string {
  const payloadPart = Buffer.from(payload, 'utf8').toString('base64url')
  return `${payloadPart}.${signPayloadPart(payloadPart)}`
}

describe('PDF upload capability tokenı', () => {
  it('teklif, aksiyon ve süre sınırını imzalı olarak doğrular', () => {
    const token = createPdfCapabilityToken(
      {
        quoteId: 42,
        action: 'upload',
        expiresAt: NOW_SECONDS + 900,
      },
      TEST_SECRET,
      NOW_SECONDS,
    )

    expect(
      verifyPdfCapabilityToken(
        token,
        { expectedQuoteId: '42', expectedAction: 'upload' },
        TEST_SECRET,
        NOW_SECONDS,
      ),
    ).toEqual({
      quoteId: '42',
      action: 'upload',
      expiresAt: NOW_SECONDS + 900,
    })
  })

  it('PII içermez; payload yalnız sürüm, teklif, aksiyon ve süre alanlarını taşır', () => {
    const token = createPdfCapabilityToken(
      {
        quoteId: '9007199254740993',
        action: 'upload',
        expiresAt: NOW_SECONDS + 60,
      },
      TEST_SECRET,
      NOW_SECONDS,
    )
    const [payloadPart] = token.split('.')
    const payload = JSON.parse(
      Buffer.from(payloadPart, 'base64url').toString('utf8'),
    )

    expect(payload).toEqual({
      v: 1,
      q: '9007199254740993',
      a: 'upload',
      exp: NOW_SECONDS + 60,
    })
    expect(token).not.toContain('telefon')
    expect(token).not.toContain('email')
    expect(token).not.toContain('name')
  })

  it('payload değiştirildiğinde imzayı reddeder', () => {
    const token = createPdfCapabilityToken(
      {
        quoteId: 42,
        action: 'upload',
        expiresAt: NOW_SECONDS + 900,
      },
      TEST_SECRET,
      NOW_SECONDS,
    )
    const [, signature] = token.split('.')
    const tamperedPayload = Buffer.from(
      JSON.stringify({ v: 1, q: '43', a: 'upload', exp: NOW_SECONDS + 900 }),
      'utf8',
    ).toString('base64url')

    expect(() =>
      verifyPdfCapabilityToken(
        `${tamperedPayload}.${signature}`,
        { expectedQuoteId: '43', expectedAction: 'upload' },
        TEST_SECRET,
        NOW_SECONDS,
      ),
    ).toThrowError(new PdfCapabilityError('invalid_signature'))
  })

  it('farklı secret ile doğrulamayı reddeder', () => {
    const token = createPdfCapabilityToken(
      {
        quoteId: 42,
        action: 'upload',
        expiresAt: NOW_SECONDS + 900,
      },
      TEST_SECRET,
      NOW_SECONDS,
    )

    expect(() =>
      verifyPdfCapabilityToken(
        token,
        { expectedQuoteId: 42, expectedAction: 'upload' },
        OTHER_SECRET,
        NOW_SECONDS,
      ),
    ).toThrowError(new PdfCapabilityError('invalid_signature'))
  })

  it('süresi dolmuş tokenı reddeder', () => {
    const token = createPdfCapabilityToken(
      {
        quoteId: 42,
        action: 'upload',
        expiresAt: NOW_SECONDS + 60,
      },
      TEST_SECRET,
      NOW_SECONDS,
    )

    expect(() =>
      verifyPdfCapabilityToken(
        token,
        { expectedQuoteId: 42, expectedAction: 'upload' },
        TEST_SECRET,
        NOW_SECONDS + 60,
      ),
    ).toThrowError(new PdfCapabilityError('expired'))
  })

  it('beklenen teklif veya aksiyon eşleşmiyorsa reddeder', () => {
    const token = createPdfCapabilityToken(
      {
        quoteId: 42,
        action: 'upload',
        expiresAt: NOW_SECONDS + 900,
      },
      TEST_SECRET,
      NOW_SECONDS,
    )

    expect(() =>
      verifyPdfCapabilityToken(
        token,
        { expectedQuoteId: 43, expectedAction: 'upload' },
        TEST_SECRET,
        NOW_SECONDS,
      ),
    ).toThrowError(new PdfCapabilityError('quote_mismatch'))

    expect(() =>
      verifyPdfCapabilityToken(
        token,
        { expectedQuoteId: 42, expectedAction: 'download' as 'upload' },
        TEST_SECRET,
        NOW_SECONDS,
      ),
    ).toThrowError(new PdfCapabilityError('action_mismatch'))
  })

  it.each([
    '',
    'tek-parça',
    'fazla.parça.var',
    '*geçersiz*.imza',
    `${Buffer.from('not-json').toString('base64url')}.kısa`,
  ])('bozuk tokenı fail-closed reddeder: %s', (token) => {
    expect(() =>
      verifyPdfCapabilityToken(
        token,
        { expectedQuoteId: 42, expectedAction: 'upload' },
        TEST_SECRET,
        NOW_SECONDS,
      ),
    ).toThrow(PdfCapabilityError)
  })

  it.each([
    '{}',
    JSON.stringify({ v: 2, q: '42', a: 'upload', exp: NOW_SECONDS + 60 }),
    JSON.stringify({ v: 1, q: '0', a: 'upload', exp: NOW_SECONDS + 60 }),
    JSON.stringify({ v: 1, q: '42', a: 'download', exp: NOW_SECONDS + 60 }),
    JSON.stringify({ v: 1, q: '42', a: 'upload', exp: 'yarın' }),
  ])('imzası geçerli olsa bile hatalı claim yapısını reddeder: %s', (payload) => {
    expect(() =>
      verifyPdfCapabilityToken(
        signRawPayload(payload),
        { expectedQuoteId: 42, expectedAction: 'upload' },
        TEST_SECRET,
        NOW_SECONDS,
      ),
    ).toThrowError(new PdfCapabilityError('malformed_token'))
  })

  it.each([
    { quoteId: 0, expiresAt: NOW_SECONDS + 60 },
    { quoteId: '1.5', expiresAt: NOW_SECONDS + 60 },
    { quoteId: 42, expiresAt: NOW_SECONDS },
    { quoteId: 42, expiresAt: Number.NaN },
  ])('geçersiz üretim girdisini reddeder: %o', ({ quoteId, expiresAt }) => {
    expect(() =>
      createPdfCapabilityToken(
        { quoteId, action: 'upload', expiresAt },
        TEST_SECRET,
        NOW_SECONDS,
      ),
    ).toThrow(PdfCapabilityError)
  })
})

describe('PDF_CAPABILITY_SECRET', () => {
  const originalSecret = process.env.PDF_CAPABILITY_SECRET

  afterEach(() => {
    vi.unstubAllEnvs()
    if (originalSecret === undefined) {
      delete process.env.PDF_CAPABILITY_SECRET
    } else {
      process.env.PDF_CAPABILITY_SECRET = originalSecret
    }
  })

  it('açık secret verilmezse server-only env değerini kullanır', () => {
    process.env.PDF_CAPABILITY_SECRET = TEST_SECRET

    const token = createPdfCapabilityToken(
      {
        quoteId: 42,
        action: 'upload',
        expiresAt: NOW_SECONDS + 60,
      },
      undefined,
      NOW_SECONDS,
    )

    expect(
      verifyPdfCapabilityToken(
        token,
        { expectedQuoteId: 42, expectedAction: 'upload' },
        undefined,
        NOW_SECONDS,
      ),
    ).toMatchObject({ quoteId: '42', action: 'upload' })
  })

  it.each([undefined, 'kısa-secret'])(
    'secret yoksa veya zayıfsa fail-closed davranır: %s',
    (secret) => {
      if (secret === undefined) {
        delete process.env.PDF_CAPABILITY_SECRET
      } else {
        process.env.PDF_CAPABILITY_SECRET = secret
      }

      expect(() =>
        createPdfCapabilityToken(
          {
            quoteId: 42,
            action: 'upload',
            expiresAt: NOW_SECONDS + 60,
          },
          undefined,
          NOW_SECONDS,
        ),
      ).toThrow(PdfCapabilityError)
    },
  )

  it('yalnız development ortamında ortak yerel secret ile token üretip doğrular', () => {
    delete process.env.PDF_CAPABILITY_SECRET
    vi.stubEnv('NODE_ENV', 'development')

    const token = createPdfCapabilityToken(
      {
        quoteId: 42,
        action: 'upload',
        expiresAt: NOW_SECONDS + 60,
      },
      undefined,
      NOW_SECONDS,
    )

    expect(
      verifyPdfCapabilityToken(
        token,
        { expectedQuoteId: 42, expectedAction: 'upload' },
        undefined,
        NOW_SECONDS,
      ),
    ).toMatchObject({ quoteId: '42', action: 'upload' })
  })

  it('yapılandırma ön kontrolü güçlü secret ile geçer', () => {
    expect(() => assertPdfCapabilityConfigured(TEST_SECRET)).not.toThrow()
    expect(() => assertPdfCapabilityConfigured('kısa-secret')).toThrow(
      PdfCapabilityError,
    )
  })
})
