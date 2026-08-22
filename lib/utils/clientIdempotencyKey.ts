type ClientCrypto = Pick<Crypto, 'getRandomValues'> &
  Partial<Pick<Crypto, 'randomUUID'>>

function byteToHex(value: number): string {
  return value.toString(16).padStart(2, '0')
}

/**
 * Teklif POST'ları için mobil ve LAN HTTP uyumlu UUID v4 üretir.
 * `crypto.randomUUID` yalnız güvenli bağlamlarda sunulabildiğinden, yoksa
 * insecure context'te de kullanılabilen `getRandomValues` ile aynı UUID
 * biçimi oluşturulur. Web Crypto bütünüyle yoksa zayıf rastgeleliğe düşmez.
 */
export function createClientIdempotencyKey(
  cryptoProvider: ClientCrypto | null = globalThis.crypto,
): string {
  if (cryptoProvider && typeof cryptoProvider.randomUUID === 'function') {
    return cryptoProvider.randomUUID()
  }

  if (!cryptoProvider || typeof cryptoProvider.getRandomValues !== 'function') {
    throw new Error(
      'Tarayıcınız güvenli istek anahtarı oluşturmayı desteklemiyor. Lütfen tarayıcınızı güncelleyin.',
    )
  }

  const bytes = cryptoProvider.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byteToHex).join('')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}
