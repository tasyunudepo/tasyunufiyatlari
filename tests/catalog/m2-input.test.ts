import { describe, expect, it } from 'vitest'

import { formatLocalizedM2Input, parseLocalizedM2Input } from '@/lib/catalog/m2Input'

describe('Türkçe metraj girişi', () => {
  it.each([
    ['806,4', 806.4],
    ['806.4', 806.4],
    ['1.497,6', 1497.6],
    ['806', 806],
  ])('%s değerini doğru ayrıştırır', (input, expected) => {
    expect(parseLocalizedM2Input(input)).toBe(expected)
  })

  it('geçersiz ve negatif değeri reddeder', () => {
    expect(parseLocalizedM2Input('abc')).toBeNull()
    expect(parseLocalizedM2Input('-1')).toBeNull()
  })

  it('ondalık metrajı Türkçe virgülle gösterir', () => {
    expect(formatLocalizedM2Input(806.4)).toBe('806,4')
    expect(formatLocalizedM2Input(806)).toBe('806')
  })
})
