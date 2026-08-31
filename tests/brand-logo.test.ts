import { describe, expect, it } from 'vitest'

import { resolveBrandMark } from '@/lib/brandLogo'

describe('paket marka logosu sunumu', () => {
  it('model içeren levha adını gerçek marka logosuna indirger', () => {
    const mark = resolveBrandMark('Bonus F 150 Pro')

    expect(mark.displayName).toBe('Bonus')
    expect(mark.logo?.src).toBe('/images/markalogolar/bonus-logo-red.svg')
  })

  it('Fawori alt markalarını ortak logoda kendi adlarıyla ayırır', () => {
    const expert = resolveBrandMark('Expert')
    const optimix = resolveBrandMark('Fawori Optimix')

    expect(expert.logo?.src).toBe('/images/markalogolar/fawori-taşyünü- fiyatları.webp')
    expect(optimix.logo?.src).toBe(expert.logo?.src)
    expect(expert.displayName).toBe('Expert')
    expect(expert.accessibleName).toBe('Fawori Expert')
    expect(optimix.displayName).toBe('Optimix')
    expect(optimix.accessibleName).toBe('Fawori Optimix')
  })

  it('TEKNO adını büyük-küçük harften bağımsız eşler', () => {
    expect(resolveBrandMark('TEKNO').logo?.src).toContain('Tekno Taşyünü')
    expect(resolveBrandMark('Tekno').displayName).toBe('TEKNO')
  })

  it('logosu olmayan markayı metin olarak korur', () => {
    expect(resolveBrandMark('İzocam')).toMatchObject({
      displayName: 'İzocam',
      accessibleName: 'İzocam',
      logo: null,
    })
  })
})
