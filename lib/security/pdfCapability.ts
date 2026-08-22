import 'server-only'

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const CAPABILITY_VERSION = 1 as const
const CAPABILITY_DOMAIN = 'pdf-capability-v1'
const SECRET_MIN_BYTES = 32
const MAX_TOKEN_LENGTH = 2_048
const MAX_PAYLOAD_PART_LENGTH = 1_024
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/
const SHA256_BASE64URL_LENGTH = 43
const QUOTE_ID_PATTERN = /^[1-9]\d{0,18}$/

// Yerel Next geliştirme sunucusunda üretim secret'ı bulunmayabilir. Quotes ve
// upload route'ları ayrı bundle'larda çalışsa da aynı değeri türetmeleri için
// random bir süreç anahtarı yerine yalnız development'ta geçerli deterministik
// bir anahtar kullanılır. Production/test ortamları fail-closed kalır.
const LOCAL_DEVELOPMENT_SECRET = createHash('sha256')
  .update(`${CAPABILITY_DOMAIN}\0${process.cwd()}\0local-development`, 'utf8')
  .digest('hex')

export type PdfCapabilityAction = 'upload'

export type PdfCapabilityErrorCode =
  | 'missing_secret'
  | 'weak_secret'
  | 'invalid_quote_id'
  | 'invalid_expiration'
  | 'invalid_action'
  | 'malformed_token'
  | 'invalid_signature'
  | 'expired'
  | 'quote_mismatch'
  | 'action_mismatch'

export type PdfCapabilityClaims = {
  quoteId: string
  action: PdfCapabilityAction
  expiresAt: number
}

export type CreatePdfCapabilityInput = {
  quoteId: string | number
  action: PdfCapabilityAction
  /** Unix zamanı, saniye cinsinden. */
  expiresAt: number
}

export type VerifyPdfCapabilityOptions = {
  expectedQuoteId: string | number
  expectedAction: PdfCapabilityAction
}

type EncodedCapabilityClaims = {
  v: typeof CAPABILITY_VERSION
  q: string
  a: PdfCapabilityAction
  exp: number
}

const ERROR_MESSAGES: Record<PdfCapabilityErrorCode, string> = {
  missing_secret: 'PDF capability secret tanımlı değil.',
  weak_secret: 'PDF capability secret yeterince güçlü değil.',
  invalid_quote_id: 'Teklif kimliği geçerli değil.',
  invalid_expiration: 'PDF capability son kullanma zamanı geçerli değil.',
  invalid_action: 'PDF capability aksiyonu geçerli değil.',
  malformed_token: 'PDF capability tokenı geçerli biçimde değil.',
  invalid_signature: 'PDF capability imzası geçerli değil.',
  expired: 'PDF capability tokenının süresi dolmuş.',
  quote_mismatch: 'PDF capability farklı bir teklife ait.',
  action_mismatch: 'PDF capability istenen aksiyona ait değil.',
}

export class PdfCapabilityError extends Error {
  constructor(public readonly code: PdfCapabilityErrorCode) {
    super(ERROR_MESSAGES[code])
    this.name = 'PdfCapabilityError'
  }
}

function getSecret(explicitSecret?: string): string {
  const configuredSecret = explicitSecret ?? process.env.PDF_CAPABILITY_SECRET
  const secret = configuredSecret === undefined && process.env.NODE_ENV === 'development'
    ? LOCAL_DEVELOPMENT_SECRET
    : configuredSecret

  if (secret === undefined) {
    throw new PdfCapabilityError('missing_secret')
  }

  if (Buffer.byteLength(secret, 'utf8') < SECRET_MIN_BYTES) {
    throw new PdfCapabilityError('weak_secret')
  }

  return secret
}

/** PDF teklifi DB'ye yazılmadan önce server yapılandırmasını fail-closed doğrular. */
export function assertPdfCapabilityConfigured(explicitSecret?: string): void {
  getSecret(explicitSecret)
}

function normalizeQuoteId(quoteId: string | number): string {
  if (typeof quoteId === 'number') {
    if (!Number.isSafeInteger(quoteId) || quoteId <= 0) {
      throw new PdfCapabilityError('invalid_quote_id')
    }
    return String(quoteId)
  }

  const normalized = quoteId.trim()
  if (!QUOTE_ID_PATTERN.test(normalized)) {
    throw new PdfCapabilityError('invalid_quote_id')
  }

  return normalized
}

function readNowSeconds(explicitNowSeconds?: number): number {
  const nowSeconds = explicitNowSeconds ?? Math.floor(Date.now() / 1_000)
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0) {
    throw new PdfCapabilityError('invalid_expiration')
  }
  return nowSeconds
}

function validateAction(action: unknown): asserts action is PdfCapabilityAction {
  if (action !== 'upload') {
    throw new PdfCapabilityError('invalid_action')
  }
}

function createSignature(payloadPart: string, secret: string): Buffer {
  return createHmac('sha256', secret)
    .update(CAPABILITY_DOMAIN, 'utf8')
    .update('\0', 'utf8')
    .update(payloadPart, 'utf8')
    .digest()
}

function readSignedPayload(token: string, secret: string): string {
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    throw new PdfCapabilityError('malformed_token')
  }

  const parts = token.split('.')
  if (parts.length !== 2) {
    throw new PdfCapabilityError('malformed_token')
  }

  const [payloadPart, signaturePart] = parts
  if (
    !payloadPart ||
    payloadPart.length > MAX_PAYLOAD_PART_LENGTH ||
    !BASE64URL_PATTERN.test(payloadPart) ||
    signaturePart.length !== SHA256_BASE64URL_LENGTH ||
    !BASE64URL_PATTERN.test(signaturePart)
  ) {
    throw new PdfCapabilityError('malformed_token')
  }

  const providedSignature = Buffer.from(signaturePart, 'base64url')
  const expectedSignature = createSignature(payloadPart, secret)

  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw new PdfCapabilityError('invalid_signature')
  }

  const payloadBuffer = Buffer.from(payloadPart, 'base64url')
  if (payloadBuffer.toString('base64url') !== payloadPart) {
    throw new PdfCapabilityError('malformed_token')
  }

  return payloadBuffer.toString('utf8')
}

function parseClaims(serializedPayload: string): EncodedCapabilityClaims {
  let candidate: unknown
  try {
    candidate = JSON.parse(serializedPayload)
  } catch {
    throw new PdfCapabilityError('malformed_token')
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new PdfCapabilityError('malformed_token')
  }

  const claims = candidate as Record<string, unknown>
  const keys = Object.keys(claims).sort()
  if (
    keys.length !== 4 ||
    keys[0] !== 'a' ||
    keys[1] !== 'exp' ||
    keys[2] !== 'q' ||
    keys[3] !== 'v' ||
    claims.v !== CAPABILITY_VERSION ||
    typeof claims.q !== 'string' ||
    !QUOTE_ID_PATTERN.test(claims.q) ||
    claims.a !== 'upload' ||
    !Number.isSafeInteger(claims.exp) ||
    (claims.exp as number) < 0
  ) {
    throw new PdfCapabilityError('malformed_token')
  }

  return claims as EncodedCapabilityClaims
}

/**
 * Teklif kaydına bağlı, kısa ömürlü PDF yükleme yetkisi üretir.
 * Token müşteri adı, telefon, e-posta veya dosya adı gibi PII taşımaz.
 */
export function createPdfCapabilityToken(
  input: CreatePdfCapabilityInput,
  explicitSecret?: string,
  explicitNowSeconds?: number,
): string {
  const secret = getSecret(explicitSecret)
  const nowSeconds = readNowSeconds(explicitNowSeconds)
  const quoteId = normalizeQuoteId(input.quoteId)
  validateAction(input.action)

  if (!Number.isSafeInteger(input.expiresAt) || input.expiresAt <= nowSeconds) {
    throw new PdfCapabilityError('invalid_expiration')
  }

  const claims: EncodedCapabilityClaims = {
    v: CAPABILITY_VERSION,
    q: quoteId,
    a: input.action,
    exp: input.expiresAt,
  }
  const payloadPart = Buffer.from(JSON.stringify(claims), 'utf8').toString(
    'base64url',
  )
  const signaturePart = createSignature(payloadPart, secret).toString(
    'base64url',
  )

  return `${payloadPart}.${signaturePart}`
}

/**
 * Capability imzasını sabit-zamanlı karşılaştırır; teklif, aksiyon ve süreyi
 * ayrı ayrı doğrulamadan hiçbir claim döndürmez.
 */
export function verifyPdfCapabilityToken(
  token: string,
  options: VerifyPdfCapabilityOptions,
  explicitSecret?: string,
  explicitNowSeconds?: number,
): PdfCapabilityClaims {
  const secret = getSecret(explicitSecret)
  const nowSeconds = readNowSeconds(explicitNowSeconds)
  const expectedQuoteId = normalizeQuoteId(options.expectedQuoteId)
  const serializedPayload = readSignedPayload(token, secret)
  const claims = parseClaims(serializedPayload)

  if (claims.exp <= nowSeconds) {
    throw new PdfCapabilityError('expired')
  }

  if (options.expectedAction !== claims.a) {
    throw new PdfCapabilityError('action_mismatch')
  }

  if (expectedQuoteId !== claims.q) {
    throw new PdfCapabilityError('quote_mismatch')
  }

  return {
    quoteId: claims.q,
    action: claims.a,
    expiresAt: claims.exp,
  }
}
