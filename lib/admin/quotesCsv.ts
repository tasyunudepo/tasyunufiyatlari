// Teklif listesini CSV'ye çevirir.
//
// Audit E4: panelde HİÇBİR dışa aktarım yoktu — yalnız tek tek PDF indirme.
// Muhasebe/rapor akışı elle yapılıyordu.
//
// GİZLİLİK: `gross_profit` ve `sales_final_price` ADMIN-ONLY alanlardır
// (migration v22). CSV operatörün kendi makinesine iner, müşteriye giden bir
// yüzey değildir — yine de brüt kâr bilinçli olarak DIŞARIDA bırakılmıştır:
// dosya elden ele dolaşabilir. Ciro için "satışçı nihai fiyatı" yeterli.

export interface CsvQuote {
  id: number | string
  quote_code?: string | null
  created_at: string
  status?: string | null
  priority?: string | null
  request_type?: string | null
  source_channel?: string | null
  customer_name?: string | null
  customer_company?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  city_name?: string | null
  brand_name?: string | null
  package_name?: string | null
  material_type?: string | null
  thickness_cm?: number | null
  area_m2?: number | null
  price_per_m2?: number | null
  price_without_vat?: number | null
  vat_amount?: number | null
  total_price?: number | null
  sales_final_price?: number | null
  contact_attempted_at?: string | null
  follow_up_date?: string | null
  loss_category?: string | null
  quoted_by?: string | null
}

const BASLIKLAR = [
  'Teklif No',
  'Tarih',
  'Durum',
  'Öncelik',
  'Kanal',
  'Müşteri',
  'Firma',
  'Telefon',
  'E-posta',
  'Şehir',
  'Marka',
  'Paket',
  'Malzeme',
  'Kalınlık (cm)',
  'Metraj (m²)',
  'Birim Fiyat (₺/m²)',
  'KDV Hariç (₺)',
  'KDV (₺)',
  'Toplam (₺)',
  'Satış Fiyatı (₺)',
  'İlk Temas',
  'Takip Tarihi',
  'Kayıp Nedeni',
  'İlgilenen',
] as const

const DURUM: Record<string, string> = {
  pending: 'Bekliyor',
  contacted: 'İletişimde',
  quoted: 'Teklif Verildi',
  approved: 'Onaylandı',
  rejected: 'Kaybedildi',
  completed: 'Kazanıldı',
}

const KANAL: Record<string, string> = {
  wizard: 'Hesaplayıcı',
  catalog: 'Katalog',
  ofis: 'Ofis',
}

/**
 * CSV hücresi kaçışı.
 *
 * Formül enjeksiyonuna karşı korumalı: `=`, `+`, `-`, `@` ile başlayan
 * değerler Excel'de formül olarak çalıştırılabilir. Müşteri adı gibi serbest
 * metin alanları bu karakterlerle başlayabildiği için tek tırnak eklenir.
 */
function hucre(value: unknown): string {
  if (value == null) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[",\n\r;]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

/** Türkçe Excel virgülü ondalık ayracı sayar; sayılar da öyle yazılır. */
function sayi(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return ''
  return String(Number(value).toFixed(2)).replace('.', ',')
}

function tarih(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleString('tr-TR')
}

/**
 * Teklifleri CSV metnine çevirir.
 *
 * Ayraç noktalı virgül: Türkçe Excel varsayılanı budur ve ondalık virgülle
 * çakışmaz.
 */
export function buildQuotesCsv(quotes: CsvQuote[]): string {
  const satirlar: string[] = [BASLIKLAR.join(';')]

  for (const q of quotes) {
    satirlar.push(
      [
        hucre(q.quote_code ?? q.id),
        hucre(tarih(q.created_at)),
        hucre(DURUM[q.status ?? ''] ?? q.status ?? ''),
        hucre(q.priority ?? ''),
        hucre(KANAL[q.source_channel ?? ''] ?? q.source_channel ?? ''),
        hucre(q.customer_name),
        hucre(q.customer_company),
        hucre(q.customer_phone),
        hucre(q.customer_email),
        hucre(q.city_name),
        hucre(q.brand_name),
        hucre(q.package_name),
        hucre(q.material_type),
        hucre(q.thickness_cm ?? ''),
        sayi(q.area_m2),
        sayi(q.price_per_m2),
        sayi(q.price_without_vat),
        sayi(q.vat_amount),
        sayi(q.total_price),
        sayi(q.sales_final_price),
        hucre(tarih(q.contact_attempted_at)),
        hucre(q.follow_up_date ?? ''),
        hucre(q.loss_category ?? ''),
        hucre(q.quoted_by ?? ''),
      ].join(';'),
    )
  }

  return satirlar.join('\r\n')
}

/**
 * Excel'in UTF-8 tanıması için BOM eklenmiş Blob.
 * BOM olmadan Türkçe karakterler Excel'de bozuk görünür.
 */
export function buildQuotesCsvBlob(quotes: CsvQuote[]): Blob {
  return new Blob(['﻿', buildQuotesCsv(quotes)], {
    type: 'text/csv;charset=utf-8;',
  })
}

export function csvFileName(now: Date, ek?: string): string {
  const tarihStr = now.toISOString().slice(0, 10)
  return `teklifler_${tarihStr}${ek ? `_${ek}` : ''}.csv`
}
