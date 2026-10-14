// Karşılaştırma tablosu için föy değerlerini okur (Emrah kararı, 14 Ekim 2026).
//
// NEDEN: profil kayıtları föydeki biçimi aynen tutar ("≥30 kPa — CS(10)30 (30 mm için föy notu: değer
// farklılaşabilir)"). Tabloda hücre tek satır kalır; sınıf ve notlar dipnota iner. En iyi değeri
// işaretlemek için sayı da gerekir. Aralıklı değerde temkinli uç esas alınır: ısı iletkenliğinde ÜST
// değer (0,036–0,040 → 0,040), dayanımda ALT değer (40–70 kPa → 40). Yoğunluk "en iyi" sayılmaz:
// yüksek yoğunluk tek başına daha iyi yalıtım demek değildir.

export interface ParsedValue {
  /** Hücrede görünen kısa biçim: "0,036–0,040", "≥30 kPa", "40–70 kPa". */
  short: string
  /** Kıyas için temkinli sayı; okunamazsa null (vurgu yapılmaz). */
  value: number | null
  /** Dipnota inen açıklama: sınıf, kalınlık notu, NPD. Yoksa null. */
  note: string | null
}

const NUM = /\d+(?:[.,]\d+)?/g
const toNumber = (s: string) => Number(s.replace(',', '.'))

function splitNote(display: string): { head: string; note: string | null } {
  const text = display.trim()
  const dash = text.indexOf(' — ')
  let head = dash >= 0 ? text.slice(0, dash) : text
  let rest = dash >= 0 ? text.slice(dash + 3) : ''
  const paren = head.indexOf(' (')
  if (paren >= 0) {
    rest = [head.slice(paren + 2).replace(/\)$/, ''), rest].filter(Boolean).join('; ')
    head = head.slice(0, paren)
  }
  const note = rest
    .replace(/\s+\(([^)]*)\)/g, '; $1') // yalnız boşlukla açılan parantez; "CS(10)25" bozulmaz
    .replace(/^;\s*/, '')
    .trim()
  return { head: head.trim(), note: note.length > 0 ? note : null }
}

/** λD: "0,036–0,040 W/mK (kalınlığa göre)" → { short: "0,036–0,040", value: 0.040, note: "kalınlığa göre" } */
export function parseLambda(display: string): ParsedValue {
  const { head, note } = splitNote(display)
  const numbers = (head.match(NUM) ?? []).map(toNumber)
  const short = head.replace(/\s*W\/mK\s*$/i, '').trim()
  return { short, value: numbers.length > 0 ? Math.max(...numbers) : null, note }
}

/** kPa değerleri (dik çekme, basma): "≥40 kPa — CS(10)40 (…)" → { short: "≥40 kPa", value: 40, note: "CS(10)40; …" } */
export function parseKpa(display: string): ParsedValue {
  const { head, note } = splitNote(display)
  const numbers = (head.match(NUM) ?? []).map(toNumber)
  return { short: head, value: numbers.length > 0 ? Math.min(...numbers) : null, note }
}

export interface TechnicalRow {
  key: string
  lambda: ParsedValue
  tensile: ParsedValue
  compressive: ParsedValue
}

export interface BestValues {
  /** En düşük ısı iletkenliği (temkinli üst uç). */
  lambda: number | null
  /** En yüksek dik çekme (alt uç). */
  tensile: number | null
  /** En yüksek basma dayanımı (alt uç). */
  compressive: number | null
}

const pick = (values: (number | null)[], fn: (...v: number[]) => number) => {
  const known = values.filter((v): v is number => v !== null && Number.isFinite(v))
  return known.length > 0 ? fn(...known) : null
}

export function bestTechnicalValues(rows: TechnicalRow[]): BestValues {
  return {
    lambda: pick(rows.map((r) => r.lambda.value), Math.min),
    tensile: pick(rows.map((r) => r.tensile.value), Math.max),
    compressive: pick(rows.map((r) => r.compressive.value), Math.max),
  }
}

/** Değer en iyiye eşit mi (kayan nokta için küçük tolerans). */
export function isBest(value: number | null, best: number | null): boolean {
  return value !== null && best !== null && Math.abs(value - best) < 1e-9
}
