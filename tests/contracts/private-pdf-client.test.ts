import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

function read(path: string): string {
  return readFileSync(`${repoRoot}${path}`, 'utf8')
}

/**
 * PDF üreten istemciler.
 *
 * `kind`:
 *   'public'  → müşteri yüzeyi; POST /api/quotes, guard'lı RPC, Idempotency-Key zorunlu
 *   'ofis'    → operatör yüzeyi; POST /api/admin/quotes/manual, guard'sız
 *               (hız limiti ve dedupe operatör akışıyla bağdaşmıyor)
 *
 * Bu liste `pdf-client-coverage` testiyle korunuyor: `generateQuotePDF`
 * import eden her dosya burada olmak ZORUNDA. Aksi hâlde yeni bir ekran
 * eklendiğinde test yeşil kalır ama sözleşme fiilen delinir.
 */
const PDF_CLIENTS = [
  { path: 'components/wizard/WizardCalculator.tsx', kind: 'public', quoteFetch: "fetch('/api/quotes'" },
  { path: 'components/catalog/SingleProductQuoteButton.tsx', kind: 'public', quoteFetch: "fetch('/api/quotes'" },
  { path: 'app/ofis/tabs/quotes/QuoteBuilder.tsx', kind: 'ofis', quoteFetch: '"/api/admin/quotes/manual"' },
] as const

describe('private PDF istemci ve route sözleşmesi', () => {
  it.each(PDF_CLIENTS)(
    '$path: teklif kaydı oluşmadan upload yapmaz',
    ({ path, quoteFetch }) => {
      const source = read(path)
      const quoteIndex = source.indexOf(quoteFetch)
      const uploadIndex = source.indexOf('uploadPdfToStorage(', quoteIndex)

      // Değişmez kural: PDF önce kaydedilmiş bir teklife bağlanır.
      // Aksi hâlde storage'a sahipsiz dosya düşer.
      expect(quoteIndex, `${path} içinde teklif isteği bulunamadı`).toBeGreaterThan(-1)
      expect(uploadIndex, `${path} upload'u teklif isteğinden önce yapıyor`).toBeGreaterThan(quoteIndex)
      expect(source).toContain('pdfUploadCapability')
    },
  )

  it.each(PDF_CLIENTS.filter((c) => c.kind === 'public'))(
    '$path: public akış Idempotency-Key gönderir',
    ({ path }) => {
      // Guard'lı RPC bu başlığı zorunlu tutuyor (migration-v17).
      expect(read(path)).toContain("'Idempotency-Key': crypto.randomUUID()")
    },
  )

  it('storage route server path üretir, overwrite ve public URL kullanmaz', () => {
    const route = read('app/api/upload-pdf/route.ts')

    expect(route).toContain('randomUUID()')
    expect(route).toContain('upsert: false')
    expect(route).not.toContain('getPublicUrl')
    expect(route).not.toContain('upsert: true')
    expect(route).toContain('verifyPdfCapabilityToken')
  })

  it('upload route yalnız tanınan teklif kanallarını kabul eder', () => {
    const route = read('app/api/upload-pdf/route.ts')

    // Ofis teklifi ayrı bir request_type kullanıyor; kapı açılmazsa
    // elle yazılan teklifin PDF'i sessizce reddedilir.
    expect(route).toContain('manual_quote')
    expect(route).toContain('pdf_quote')
  })

  it('istemci helperı kalıcı public URL sözleşmesi taşımaz', () => {
    const helper = read('lib/uploadPdfToStorage.ts')

    expect(helper).toContain('signedUrl')
    expect(helper).not.toContain('publicUrl')
    expect(helper).toContain("formData.append('capability'")
    expect(helper).toContain("formData.append('quoteId'")
  })
})

// ── Meta-test: kapsam kaçağını yapısal olarak kapatır ──
//
// Audit notu (26 Tem 2026): bu dosyanın `it.each` listesi SABİTTİ. Yeni bir
// PDF üreten ekran eklendiğinde test yeşil kalıyor ama ekran hiç
// denetlenmiyordu. Aşağıdaki test, `generateQuotePDF` import eden her
// dosyanın yukarıdaki listede bulunmasını şart koşar.

const TARANAN_KLASORLER = ['app', 'components', 'lib']
const ATLANAN = new Set(['node_modules', '.next', 'dist'])

function tsDosyalariniTopla(dir: string, birikim: string[] = []): string[] {
  for (const entry of readdirSync(`${repoRoot}${dir}`)) {
    if (ATLANAN.has(entry)) continue
    const rel = `${dir}/${entry}`
    const st = statSync(`${repoRoot}${rel}`)
    if (st.isDirectory()) tsDosyalariniTopla(rel, birikim)
    else if (/\.tsx?$/.test(entry)) birikim.push(rel)
  }
  return birikim
}

describe('PDF istemci kapsamı', () => {
  it('generateQuotePDF kullanan her dosya sözleşme listesinde', () => {
    const hepsi = TARANAN_KLASORLER.flatMap((d) => tsDosyalariniTopla(d))

    const kullananlar = hepsi.filter((path) => {
      if (path === 'lib/pdfGenerator.ts') return false // tanımın kendisi
      const src = read(path)
      return /\bgenerateQuotePDF\b/.test(src) && /from ['"]@\/lib\/pdfGenerator['"]/.test(src)
    })

    const listelenen = new Set<string>(PDF_CLIENTS.map((c) => c.path))
    const eksikler = kullananlar.filter((p) => !listelenen.has(p))

    expect(
      eksikler,
      `Bu dosyalar PDF üretiyor ama private-pdf-client sözleşmesinde yok:\n  ${eksikler.join('\n  ')}\n` +
        'PDF_CLIENTS listesine ekleyin — aksi hâlde sözleşme sessizce delinir.',
    ).toEqual([])

    // Liste bayatlamasın: listedeki her dosya gerçekten PDF üretmeli.
    const artakalan = [...listelenen].filter((p) => !kullananlar.includes(p))
    expect(artakalan, `Listede olup artık PDF üretmeyen dosyalar: ${artakalan.join(', ')}`).toEqual([])
  })
})
