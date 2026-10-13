import type jsPDF from 'jspdf'

// Resim olarak basılan belgenin üstüne görünmez gerçek metin katmanı.
//
// Teklif PDF'i ve Sipariş Onay Formu tarayıcıda sayfa görüntüsü olarak
// üretilir; görüntüde yazı seçilemez, IBAN kopyalanamaz, belgede arama
// çalışmaz. Taranmış belgelerdeki yöntemle her kelime kendi yerine görünmez
// olarak yazılır: görüntü aynı kalır, metin seçilir, kopyalanır ve aranır.
//
// Katman görünmez olduğu için yazı tipinin görünüşü önemsizdir; Türkçe
// harfleri ve ₺ işaretini taşıyan küçük bir alt küme kullanılır
// (public/fonts/teklif-metin-katmani.ttf, Noto Sans Regular'dan, ~21 KB).

const FONT_URL = '/fonts/teklif-metin-katmani.ttf'
const FONT_FILE = 'teklif-metin-katmani.ttf'
const FONT_NAME = 'TeklifMetinKatmani'

/** 1 mm = 72 / 25,4 punto. */
const PT_PER_MM = 72 / 25.4
/** Satır kutusunun tepesinden taban çizgisine oran (Latin yazı tipleri için yaklaşık). */
const BASELINE_RATIO = 0.78

export interface WordBox {
  text: string
  left: number
  top: number
  width: number
  height: number
  fontSizePx: number
}

export interface TextRun {
  text: string
  /** Sol kenar, mm. */
  x: number
  /** Taban çizgisi, mm. */
  y: number
  fontSizePt: number
  /** Kelimenin sayfadaki genişliği, mm; yazı bu genişliğe oturtulur. */
  widthMm: number
}

/** HTML kabındaki kelime kutusunu PDF koordinatına çevirir. */
export function toTextRun(word: WordBox, origin: { left: number; top: number }, mmPerPx: number): TextRun {
  return {
    text: word.text,
    x: (word.left - origin.left) * mmPerPx,
    y: (word.top - origin.top + word.height * BASELINE_RATIO) * mmPerPx,
    fontSizePt: word.fontSizePx * mmPerPx * PT_PER_MM,
    widthMm: word.width * mmPerPx,
  }
}

/** Kabın içindeki görünür yazıyı kelime kelime, belge sırasıyla toplar. */
export function collectWordBoxes(root: HTMLElement): WordBox[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  const boxes: WordBox[] = []

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue ?? ''
    const parent = node.parentElement
    if (!parent || !value.trim() || parent.closest('style,script')) continue
    const fontSizePx = Number.parseFloat(getComputedStyle(parent).fontSize) || 12

    for (const match of value.matchAll(/\S+/gu)) {
      const start = match.index ?? 0
      range.setStart(node, start)
      range.setEnd(node, start + match[0].length)
      const rect = range.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      boxes.push({ text: match[0], left: rect.left, top: rect.top, width: rect.width, height: rect.height, fontSizePx })
    }
  }

  return boxes
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

/** Katmanın yazı tipini getirir. Gelmezse `null`: belge katmansız üretilir. */
export async function loadTextLayerFont(): Promise<string | null> {
  try {
    const response = await fetch(FONT_URL, { cache: 'force-cache' })
    if (!response.ok) return null
    return toBase64(await response.arrayBuffer())
  } catch {
    return null
  }
}

/** Yazı tipini belgeye bir kez tanıtır. */
export function registerTextLayerFont(doc: jsPDF, fontBase64: string): void {
  doc.addFileToVFS(FONT_FILE, fontBase64)
  doc.addFont(FONT_FILE, FONT_NAME, 'normal')
}

/**
 * Geçerli sayfaya, `root` içindeki yazının görünmez kopyasını yazar.
 * `origin` sayfanın sol üst köşesine denk gelen ekran noktasıdır.
 */
export function addInvisibleTextLayer(
  doc: jsPDF,
  root: HTMLElement,
  origin: { left: number; top: number },
  mmPerPx: number,
): void {
  doc.setFont(FONT_NAME, 'normal')
  for (const box of collectWordBoxes(root)) {
    const run = toTextRun(box, origin, mmPerPx)
    if (!(run.fontSizePt > 0)) continue
    doc.setFontSize(run.fontSizePt)
    const natural = doc.getTextWidth(run.text)
    doc.text(run.text, run.x, run.y, {
      renderingMode: 'invisible',
      horizontalScale: natural > 0 ? run.widthMm / natural : 1,
    })
  }
}
