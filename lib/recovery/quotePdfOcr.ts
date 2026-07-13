export interface RecoveredQuoteFields {
  customerName: string
  phone: string
  location: string
  selectedSystem: string
  totalAreaM2: number | null
  subtotal: number | null
  vat: number | null
  grandTotal: number | null
  confidence: 'yüksek' | 'orta' | 'düşük'
  reviewNote: string
}

const CITY_NAMES = [
  'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya',
  'kocaeli', 'sakarya', 'tekirdag', 'tekirdag', 'balikesir', 'manisa',
  'mersin', 'kayseri', 'gaziantep', 'samsun', 'trabzon', 'eskisehir',
  'diyarbakir', 'sanliurfa', 'denizli', 'mugla', 'hatay', 'corum',
]

function parseTurkishNumber(value: string | undefined): number | null {
  if (!value) return null
  const normalized = value
    .replace(/[^\d.,-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function parseQuotePdfOcr(rawText: string): RecoveredQuoteFields {
  const lines = rawText.split(/\r?\n/).map(clean).filter(Boolean)
  const lower = lines.map((line) => line.toLocaleLowerCase('en-US'))

  const phoneLineIndex = lower.findIndex((line) => line.includes('telefon'))
  const phoneSearch = lines.slice(Math.max(0, phoneLineIndex), phoneLineIndex + 4).join(' ')
  const phone = phoneSearch.match(/(?:\+?90\s*)?0?5(?:[\s()-]*\d){9}/)?.[0]
    ?.replace(/\D/g, '') ?? ''

  let customerName = ''
  let location = ''
  if (phoneLineIndex >= 2) {
    const candidate = lines[phoneLineIndex - 1]
    const candidateLower = lower[phoneLineIndex - 1]
    const city = CITY_NAMES.find((name) => candidateLower.includes(name))
    if (city) {
      const cityIndex = candidateLower.lastIndexOf(city)
      customerName = clean(candidate.slice(0, cityIndex))
      location = clean(candidate.slice(cityIndex).replace(/\s*\/.*$/, ''))
    } else {
      customerName = candidate
    }
  }

  let selectedSystem = ''
  const phoneValueLine = lines.findIndex((line, index) =>
    index > phoneLineIndex && /0?5(?:[\s()-]*\d){9}/.test(line),
  )
  if (phoneValueLine >= 0) {
    selectedSystem = clean(
      lines[phoneValueLine].replace(/^(?:\+?90\s*)?0?5(?:[\s()-]*\d){9}\s*/, ''),
    )
    const continuation = lines[phoneValueLine + 1]
    if (continuation && !/\b(?:no|urun|bank|ara toplam)\b/i.test(continuation)) {
      selectedSystem = clean(`${selectedSystem} ${continuation.replace(/Toplam Metraj.*$/i, '')}`)
    }
  }

  const joined = lines.join(' ')
  const totalAreaM2 = parseTurkishNumber(
    joined.match(/Toplam Metraj\s+([\d.,]+)/i)?.[1],
  )
  const subtotal = parseTurkishNumber(
    joined.match(/Ara Toplam\s+([\d.,]+)/i)?.[1],
  )
  const vat = parseTurkishNumber(
    joined.match(/KDV\s*\(%?20\)\s+([\d.,]+)/i)?.[1],
  )
  const grandTotal = subtotal !== null && vat !== null
    ? Math.round((subtotal + vat) * 100) / 100
    : null

  const found = [customerName, phone, selectedSystem, totalAreaM2, grandTotal]
    .filter((value) => value !== '' && value !== null).length
  const confidence = found >= 5 ? 'yüksek' : found >= 3 ? 'orta' : 'düşük'
  const missing = [
    !customerName && 'müşteri',
    !phone && 'telefon',
    !selectedSystem && 'sistem',
    totalAreaM2 === null && 'metraj',
    grandTotal === null && 'toplam',
  ].filter(Boolean)

  return {
    customerName,
    phone,
    location,
    selectedSystem,
    totalAreaM2,
    subtotal,
    vat,
    grandTotal,
    confidence,
    reviewNote: missing.length
      ? `OCR kontrolü gerekli; eksik alanlar: ${missing.join(', ')}`
      : 'Türkçe karakterler ve rakamlar belgeyle karşılaştırılmalı',
  }
}

