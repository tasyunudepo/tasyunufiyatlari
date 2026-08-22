import { describe, expect, it, vi } from 'vitest'

import { createClientIdempotencyKey } from '@/lib/utils/clientIdempotencyKey'

describe('mobil uyumlu istemci idempotency anahtarı', () => {
  it('desteklenen güvenli bağlamda native randomUUID kullanır', () => {
    const randomUUID = vi.fn(() => '3f43a9b2-d620-4f16-b173-8fc4d59eedbe')
    const cryptoProvider = { randomUUID } as unknown as Crypto

    expect(createClientIdempotencyKey(cryptoProvider)).toBe(
      '3f43a9b2-d620-4f16-b173-8fc4d59eedbe',
    )
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('LAN HTTP bağlamında randomUUID yoksa getRandomValues ile UUID v4 üretir', () => {
    const cryptoProvider = {
      getRandomValues(array: Uint8Array) {
        for (let index = 0; index < array.length; index += 1) {
          array[index] = index
        }
        return array
      },
    } as unknown as Crypto

    const key = createClientIdempotencyKey(cryptoProvider)

    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('Web Crypto bütünüyle yoksa sessizce zayıf anahtar üretmez', () => {
    expect(() => createClientIdempotencyKey(null)).toThrow(
      /güvenli istek anahtarı/u,
    )
  })
})
