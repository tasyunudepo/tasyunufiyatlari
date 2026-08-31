import 'server-only'

import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/
const HASH_SECRET_MIN_BYTES = 32

export type QuoteGuardErrorCode =
  | 'invalid_phone'
  | 'missing_idempotency_key'
  | 'invalid_idempotency_key'
  | 'missing_client_ip'
  | 'invalid_client_ip'
  | 'missing_hash_secret'
  | 'weak_hash_secret'
  | 'invalid_fingerprint'

export type QuoteGuardHashContext =
  | 'ip'
  | 'phone'
  | 'idempotency'
  | 'request'

type HeaderReader = Pick<Headers, 'get'>

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | CanonicalValue[]
  | { [key: string]: CanonicalValue }

export class QuoteGuardInputError extends Error {
  constructor(
    public readonly code: QuoteGuardErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'QuoteGuardInputError'
  }
}

function getHashSecret(explicitSecret?: string): string {
  const secret = explicitSecret ?? process.env.QUOTE_ABUSE_HASH_SECRET

  if (!secret) {
    throw new QuoteGuardInputError(
      'missing_hash_secret',
      'QUOTE_ABUSE_HASH_SECRET tanımlı değil.',
    )
  }

  if (Buffer.byteLength(secret, 'utf8') < HASH_SECRET_MIN_BYTES) {
    throw new QuoteGuardInputError(
      'weak_hash_secret',
      `QUOTE_ABUSE_HASH_SECRET en az ${HASH_SECRET_MIN_BYTES} bayt olmalıdır.`,
    )
  }

  return secret
}

function normalizeIpCandidate(rawValue: string): string | null {
  let candidate = rawValue.trim().replace(/^"|"$/g, '')
  if (!candidate) return null

  const bracketedIpv6 = candidate.match(/^\[([^\]]+)](?::\d+)?$/)
  if (bracketedIpv6) candidate = bracketedIpv6[1]

  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/)
  if (ipv4WithPort) candidate = ipv4WithPort[1]

  return isIP(candidate) ? candidate.toLowerCase() : null
}

function canonicalize(value: unknown): CanonicalValue {
  if (value === null) return null

  if (typeof value === 'string') return value.trim()
  if (typeof value === 'boolean') return value

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new QuoteGuardInputError(
        'invalid_fingerprint',
        'Teklif fingerprint alanları sonlu sayı olmalıdır.',
      )
    }
    return Object.is(value, -0) ? 0 : value
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined ? null : canonicalize(item),
    )
  }

  if (typeof value === 'object') {
    const result: Record<string, CanonicalValue> = {}
    for (const key of Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key]
      if (item !== undefined) result[key] = canonicalize(item)
    }
    return result
  }

  throw new QuoteGuardInputError(
    'invalid_fingerprint',
    'Teklif fingerprint alanı desteklenmeyen bir değer içeriyor.',
  )
}

/**
 * Rate-limit ve dedupe için telefonu ham biçiminden bağımsızlaştırır.
 * Açık uluslararası önek yoksa 10/11 haneli numaralar Türkiye numarası kabul edilir.
 */
export function normalizePhoneForGuard(rawPhone: string): string {
  const raw = rawPhone.trim()
  const hasExplicitInternationalPrefix = raw.startsWith('+') || raw.startsWith('00')
  let digits = raw.replace(/\D/g, '')

  if (digits.startsWith('00')) digits = digits.slice(2)

  if (!hasExplicitInternationalPrefix && digits.length === 11 && digits.startsWith('0')) {
    digits = `90${digits.slice(1)}`
  } else if (!hasExplicitInternationalPrefix && digits.length === 10) {
    digits = `90${digits}`
  }

  if (digits.length < 10 || digits.length > 15) {
    throw new QuoteGuardInputError(
      'invalid_phone',
      'Telefon numarası 10 ila 15 rakam içermelidir.',
    )
  }

  return digits
}

/** İstemcinin aynı mantıksal gönderimde tekrar kullanacağı anahtarı doğrular. */
export function readIdempotencyKey(headers: HeaderReader): string {
  const key = headers.get('idempotency-key')?.trim()

  if (!key) {
    throw new QuoteGuardInputError(
      'missing_idempotency_key',
      'Idempotency-Key başlığı gereklidir.',
    )
  }

  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new QuoteGuardInputError(
      'invalid_idempotency_key',
      'Idempotency-Key geçerli biçimde değil.',
    )
  }

  return key
}

/**
 * Yalnız güvenilir reverse proxy tarafından normalize edilen başlıkları okur.
 * Ortak bir `unknown` anahtarı üretmez; IP yoksa çağıran fail-closed davranmalıdır.
 */
export function getTrustedClientIp(headers: HeaderReader): string {
  const forwardedFor = headers.get('x-forwarded-for')
  const realIp = headers.get('x-real-ip')
  const candidates = [forwardedFor?.split(',')[0], realIp].filter(
    (value): value is string => Boolean(value),
  )

  if (candidates.length === 0) {
    throw new QuoteGuardInputError(
      'missing_client_ip',
      'Güvenilir istemci IP başlığı bulunamadı.',
    )
  }

  for (const candidate of candidates) {
    const normalized = normalizeIpCandidate(candidate)
    if (normalized) return normalized
  }

  throw new QuoteGuardInputError(
    'invalid_client_ip',
    'Güvenilir istemci IP başlığı geçerli değil.',
  )
}

/** Ham kimliği DB'ye taşımadan, kullanım bağlamına ayrılmış HMAC üretir. */
export function hashGuardValue(
  context: QuoteGuardHashContext,
  value: string,
  explicitSecret?: string,
): string {
  const secret = getHashSecret(explicitSecret)
  return createHmac('sha256', secret)
    .update(context, 'utf8')
    .update('\0', 'utf8')
    .update(value, 'utf8')
    .digest('hex')
}

/**
 * Geçici ref/PDF alanları ve PII dışında, teklifin ticari anlamını kanonikleştirir.
 * Telefon ayrıca normalize `phone` hash'iyle dedupe anahtarına katılır.
 */
export function buildQuoteFingerprint(
  payload: Readonly<Record<string, unknown>>,
  explicitSecret?: string,
): string {
  const packageItems = payload.packageItems
  const commercialPackageItems = packageItems
    && typeof packageItems === 'object'
    && !Array.isArray(packageItems)
    ? Object.fromEntries(
        Object.entries(packageItems).filter(([key]) => key !== 'attribution'),
      )
    : packageItems
  const commercialPayload = {
    version: 1,
    submissionType: payload.submissionType,
    // Karşılaştırma, hesaplayıcı paket akışının edinim kaynağıdır; ticari
    // teklif anlamını değiştirmez ve dedupe anahtarı olarak kullanılamaz.
    sourceChannel: payload.sourceChannel === 'comparison'
      ? 'wizard'
      : payload.sourceChannel,
    materialType: payload.materialType,
    brandId: payload.brandId,
    brandName: payload.brandName,
    modelId: payload.modelId ?? null,
    modelName: payload.modelName ?? null,
    thicknessCm: payload.thicknessCm,
    areaM2: payload.areaM2,
    cityCode: payload.cityCode,
    cityName: payload.cityName,
    districtCode: payload.districtCode ?? null,
    packageName: payload.packageName,
    plateBrandName: payload.plateBrandName,
    accessoryBrandName: payload.accessoryBrandName,
    totalPrice: payload.totalPrice,
    pricePerM2: payload.pricePerM2,
    shippingCost: payload.shippingCost,
    discountPercentage: payload.discountPercentage,
    priceWithoutVat: payload.priceWithoutVat,
    vatAmount: payload.vatAmount,
    packageCount: payload.packageCount,
    packageSizeM2: payload.packageSizeM2,
    itemsPerPackage: payload.itemsPerPackage,
    vehicleType: payload.vehicleType ?? null,
    lorryCapacityPackages: payload.lorryCapacityPackages ?? null,
    truckCapacityPackages: payload.truckCapacityPackages ?? null,
    lorryFillPercentage: payload.lorryFillPercentage ?? null,
    truckFillPercentage: payload.truckFillPercentage ?? null,
    packageItems: commercialPackageItems,
  }

  const canonicalPayload = JSON.stringify(canonicalize(commercialPayload))
  return hashGuardValue('request', canonicalPayload, explicitSecret)
}
