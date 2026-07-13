import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const PROMISE_FILES = [
  'app/page.tsx',
  'app/iletisim/page.tsx',
  'app/hakkimizda/page.tsx',
  'components/cro/BrandStrip.tsx',
  'components/cro/HeroSystemVisual.tsx',
  'components/cro/ProofBlock.tsx',
  'components/cro/RiskMistakesBlock.tsx',
  'components/cro/SituationSelector.tsx',
  'components/cro/TrustStrip.tsx',
  'components/shared/BrandTrustLogos.tsx',
] as const

const sources = PROMISE_FILES.map((file) => ({
  file,
  content: readFileSync(resolve(ROOT, file), 'utf8'),
}))

const joinedSource = sources
  .map(({ file, content }) => `\n/* ${file} */\n${content}`)
  .join('\n')

describe('ziyaretçiye verilen ticari vaatler', () => {
  it.each([
    ['koşulsuz ücretsiz nakliye', /ücretsiz\s+nakliye/iu],
    ['desteklenmeyen kısmi yük', /\b(?:kısmi\s+yük|parsiyel)\b/iu],
    ['teyitsiz anlık stok', /\b(?:anlık\s+stok|stokta\s+(?:var|hazır)|kesin\s+stok)\b/iu],
    ['desteklenmeyen ödeme vaadi', /\b(?:kapora|peşinat|taksit|3D\s*Secure|sanal\s+POS)\b/iu],
    ['teyitsiz 81 il iddiası', /\b81\s+il(?:e|de)?\b/iu],
    ['depo çıkışlı sipariş vaadi', /\b(?:depodan\s+(?:sevkiyat|yükleme)|depo\s+teslim)\b/iu],
    ['kesin dönüş veya teslim garantisi', /\b(?:dönüş|teslim)\s+garantisi\b/iu],
  ])('%s ifadesini içermez', (_label, pattern) => {
    expect(joinedSource).not.toMatch(pattern)
  })

  it('kesin yanıt veya teslim süresi vaat etmez', () => {
    expect(joinedSource).not.toMatch(
      /(?:yanıt|dönüş|teslim|sevkiyat)[^.!?\n]{0,80}\b\d+\s*(?:dk|dakika|saat|iş\s*günü|gün)\b/iu,
    )
    expect(joinedSource).not.toMatch(
      /\b\d+\s*(?:dk|dakika|saat|iş\s*günü|gün)\b[^.!?\n]{0,80}(?:yanıt|dönüş|teslim|sevkiyat)/iu,
    )
  })

  it('PDF gönderilmiş gibi e-posta veya WhatsApp vaadi vermez', () => {
    expect(joinedSource).not.toMatch(
      /(?:e-?posta|mail|WhatsApp)[^.!?]{0,160}(?:gönderilir|gönderildi|iletilir)/iu,
    )
  })

  it('tek seferde ödeme kuralını açıkça söyler', () => {
    expect(sources.find(({ file }) => file === 'app/page.tsx')?.content).toMatch(
      /ödeme[^.!?]{0,100}sipariş\s+onayında[^.!?]{0,100}tek\s+seferde/iu,
    )
  })

  it('nakliye dahil koşulunu tam araç ve uygun EPS setiyle sınırlar', () => {
    const home = sources.find(({ file }) => file === 'app/page.tsx')?.content ?? ''

    expect(home).toMatch(/tam\s+(?:kamyon|araç)[^.!?]{0,120}nakliye[^.!?]{0,80}fiyata\s+dahil/iu)
    expect(home).toMatch(/uygun\s+EPS\s+set[^.!?]{0,120}nakliye[^.!?]{0,80}fiyata\s+dahil/iu)
  })

  it('belgeyle teyit edilmemiş faaliyet yılı, şube/depo sayısı veya resmi teklif iddiası yayınlamaz', () => {
    const about = sources.find(({ file }) => file === 'app/hakkimizda/page.tsx')?.content ?? ''
    const brandTrust = sources.find(({ file }) => file === 'components/shared/BrandTrustLogos.tsx')?.content ?? ''

    expect(about).not.toMatch(/\b(?:2006|2010|2015|20\s*yıl|üç\s+şube|iki\s+depo)\b/iu)
    expect(brandTrust).not.toMatch(/resmi\s+teklif/iu)
  })

  it('TEKNO markasını levha veya taşyünü üreticisi gibi tanıtmaz', () => {
    const brandStrip = sources.find(({ file }) => file === 'components/cro/BrandStrip.tsx')?.content ?? ''

    expect(brandStrip).toContain('Tekno toz grubu ve aksesuar ürünleri')
    expect(brandStrip).not.toMatch(/alt:\s*['"]Tekno\s+(?:taşyünü|levha)/iu)
  })
})
