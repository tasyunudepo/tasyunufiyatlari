import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

import { jsPDF } from 'jspdf'
import { describe, expect, it } from 'vitest'

import { registerTextLayerFont, toTextRun } from '@/lib/pdf/textLayer'

// Görünmez metin katmanı (13 Ekim 2026).
//
// Teklif PDF'i ve Sipariş Onay Formu sayfa görüntüsü olarak üretiliyor;
// müşteri IBAN'ı kopyalayamıyor, belgede arama yapamıyordu. Her kelime kendi
// yerine görünmez olarak yazılır. Gerçek tarayıcı kontrolü
// tests/e2e/quote-pdf-document.spec.ts içindedir.

const FONT_PATH = resolve(process.cwd(), 'public/fonts/teklif-metin-katmani.ttf')

describe('metin katmanı: kelime kutusundan PDF koordinatına', () => {
  // Belge kabı ekranın solunda çizilir; A4 genişliği 794 px = 210 mm.
  const mmPerPx = 210 / 794
  const origin = { left: -10000, top: 0 }

  it('sol kenar ve genişlik sayfaya göre milimetreye çevrilir', () => {
    const run = toTextRun({ text: 'TR22', left: -10000 + 178, top: 870, width: 34, height: 20, fontSizePx: 14 }, origin, mmPerPx)
    expect(run.text).toBe('TR22')
    expect(run.x).toBeCloseTo(178 * mmPerPx, 6)
    expect(run.widthMm).toBeCloseTo(34 * mmPerPx, 6)
  })

  it('taban çizgisi satır kutusunun içindedir', () => {
    const run = toTextRun({ text: 'x', left: -10000, top: 100, width: 6, height: 20, fontSizePx: 14 }, origin, mmPerPx)
    expect(run.y).toBeGreaterThan(100 * mmPerPx)
    expect(run.y).toBeLessThan(120 * mmPerPx)
  })

  it('yazı boyutu piksel ölçüsünden puntoya çevrilir', () => {
    // 794 px = 210 mm = 595,28 pt → 1 px ≈ 0,7497 pt
    const run = toTextRun({ text: 'x', left: -10000, top: 0, width: 6, height: 16, fontSizePx: 12 }, origin, mmPerPx)
    expect(run.fontSizePt).toBeCloseTo(12 * (595.2756 / 794), 3)
  })

  it('küçültülmüş kapta ölçek oranı yazı boyutuna da uygulanır', () => {
    const half = toTextRun({ text: 'x', left: 0, top: 0, width: 10, height: 16, fontSizePx: 12 }, { left: 0, top: 0 }, mmPerPx / 2)
    const full = toTextRun({ text: 'x', left: 0, top: 0, width: 10, height: 16, fontSizePx: 12 }, { left: 0, top: 0 }, mmPerPx)
    expect(half.fontSizePt).toBeCloseTo(full.fontSizePt / 2, 6)
    expect(half.widthMm).toBeCloseTo(full.widthMm / 2, 6)
  })
})

describe('metin katmanı: yazı tipi', () => {
  it('küçüktür; her belgeye gömülür', () => {
    expect(statSync(FONT_PATH).size).toBeLessThan(40_000)
  })

  it('kütüphaneye tanıtılır ve Türkçe harfleri, ₺ ve belge işaretlerini taşır', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    registerTextLayerFont(doc, readFileSync(FONT_PATH).toString('base64'))
    doc.setFont('TeklifMetinKatmani', 'normal')

    const font = doc.getFont() as unknown as { metadata: { cmap: { unicode: { codeMap: Record<number, number> } } } }
    const codeMap = font.metadata.cmap.unicode.codeMap
    for (const char of 'çğıöşüÇĞİÖŞÜ₺²·—’0123456789TRIBANabcxyz.,:/()%+') {
      expect(codeMap[char.codePointAt(0)!], `glif eksik: ${char}`).toBeGreaterThan(0)
    }
  })

  it('iki belge de katmanı yazar; yazı tipi gelmezse belge yine üretilir', () => {
    for (const file of ['lib/pdfGenerator.ts', 'lib/orderConfirmationPdf.ts']) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8')
      expect(source).toContain('const textFont = await loadTextLayerFont()')
      expect(source).toContain('addInvisibleTextLayer(doc, ')
      expect(source).toMatch(/if \(textFont\)/u)
    }
    const layer = readFileSync(resolve(process.cwd(), 'lib/pdf/textLayer.ts'), 'utf8')
    expect(layer).toContain("renderingMode: 'invisible'")
  })
})
