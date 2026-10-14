import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  COMPARISON_ENTRY_STORAGE_KEY,
  rememberComparisonEntry,
  takeComparisonEntry,
} from '@/lib/compare/entry'

// 14 Ekim 2026: karşılaştırma bağlantıları temiz adresli; giriş yeri, kalınlık ve ürün sekme hafızasıyla taşınır.

function fakeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    map,
  }
}

describe('karşılaştırma giriş kaydı', () => {
  let storage: ReturnType<typeof fakeStorage>

  beforeEach(() => {
    storage = fakeStorage()
    ;(globalThis as unknown as { window: unknown }).window = { sessionStorage: storage }
  })

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window
  })

  it('yazılan kaydı varış yolunda bir kez verir, sonra siler', () => {
    rememberComparisonEntry({ entry: 'pdp_kalinlik', thicknessCm: 10, focus: 'SW035', path: '/tasyunu-karsilastir' })
    expect(takeComparisonEntry('/tasyunu-karsilastir')).toMatchObject({
      entry: 'pdp_kalinlik',
      thicknessCm: 10,
      focus: 'SW035',
    })
    expect(takeComparisonEntry('/tasyunu-karsilastir')).toBeNull()
  })

  it('başka yola yazılmış kaydı kullanmaz', () => {
    rememberComparisonEntry({ entry: 'category', path: '/tasyunu-yogunluk/150-kg-m3' })
    expect(takeComparisonEntry('/tasyunu-karsilastir')).toBeNull()
  })

  it('10 dakikadan eski kaydı kullanmaz', () => {
    rememberComparisonEntry({ entry: 'wizard', path: '/tasyunu-karsilastir' })
    expect(takeComparisonEntry('/tasyunu-karsilastir', Date.now() + 11 * 60 * 1000)).toBeNull()
  })

  it('bozuk kayıt sayfayı düşürmez', () => {
    storage.setItem(COMPARISON_ENTRY_STORAGE_KEY, '{bozuk')
    expect(takeComparisonEntry('/tasyunu-karsilastir')).toBeNull()
  })
})
