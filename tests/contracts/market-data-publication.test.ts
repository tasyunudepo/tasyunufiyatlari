import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  HOTSPOTS,
  MARKET_DATA_STATUS,
  MOCK_TRANSACTIONS,
  VOLUME_DATA,
} from '@/lib/data/marketData'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const pageSource = readFileSync(`${repoRoot}app/piyasa/page.tsx`, 'utf8')

describe('/piyasa doğrulanmış veri yayınlama sözleşmesi', () => {
  it('kaynak bağlı değilken hiçbir piyasa serisi yayınlamaz', () => {
    expect(MARKET_DATA_STATUS).toEqual({
      isPublished: false,
      reason: 'verified_source_missing',
    })
    expect(MOCK_TRANSACTIONS).toEqual([])
    expect(HOTSPOTS).toEqual([])
    expect(VOLUME_DATA).toEqual([])
  })

  it('sahte veri bileşenlerini ve kaynaksız sayısal iddiaları render etmez', () => {
    expect(pageSource).not.toContain('MarketTicker')
    expect(pageSource).not.toContain('VolumeChart')
    expect(pageSource).not.toContain('MOCK_TRANSACTIONS')
    expect(pageSource).not.toContain('HOTSPOTS')
    expect(pageSource).not.toContain('32.400 m²')
    expect(pageSource).not.toContain('%12.4 Artış')
    expect(pageSource).not.toContain('anlık yalıtım malzemesi talep endeksi')
  })

  it('ziyaretçiye dürüst boş durum ve çalışan fiyat yönlendirmesi sunar', () => {
    expect(pageSource).toContain(
      'Doğrulanmış piyasa verisi şu anda yayınlanmıyor.',
    )
    expect(pageSource).toContain(
      'Kaynağı, dönemi ve güncellenme tarihi doğrulanmayan rakamları göstermiyoruz.',
    )
    expect(pageSource).toContain('href="/#mantolama-hesaplayici"')
    expect(pageSource).toContain('Projem için fiyat hesapla')
  })
})
