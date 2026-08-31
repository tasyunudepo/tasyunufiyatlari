import { describe, expect, it } from 'vitest'

import { buildQuotesCsv, csvFileName, type CsvQuote } from '@/lib/admin/quotesCsv'

// Audit E4: panelde hiçbir dışa aktarım yoktu; muhasebe/rapor akışı elle
// yapılıyordu. CSV eklenirken iki tuzak var:
//   1) Formül enjeksiyonu — "=" ile başlayan müşteri adı Excel'de çalışır
//   2) Türkçe Excel: ayraç ";", ondalık ",", UTF-8 için BOM gerekir

const ORNEK: CsvQuote = {
  id: 42,
  quote_code: 'TE-2026-000042',
  created_at: '2026-07-20T09:30:00.000Z',
  status: 'completed',
  priority: 'high',
  source_channel: 'ofis',
  customer_name: 'Ahmet Yılmaz',
  customer_company: 'Yılmaz İnşaat',
  customer_phone: '05321234567',
  city_name: 'İstanbul',
  brand_name: 'Bonus',
  material_type: 'tasyunu',
  thickness_cm: 5,
  area_m2: 1000,
  price_per_m2: 372.31,
  price_without_vat: 372306.56,
  vat_amount: 74461.31,
  total_price: 446767.87,
  gross_profit: 50000,
} as CsvQuote & { gross_profit: number }

describe('CSV dışa aktarım', () => {
  it('başlık satırı ve kayıt satırı üretir', () => {
    const csv = buildQuotesCsv([ORNEK])
    const satirlar = csv.split('\r\n')

    expect(satirlar).toHaveLength(2)
    expect(satirlar[0]).toContain('Teklif No')
    expect(satirlar[1]).toContain('TE-2026-000042')
  })

  it('Türkçe Excel ayracı olarak noktalı virgül kullanır', () => {
    const csv = buildQuotesCsv([ORNEK])
    expect(csv.split('\r\n')[0].split(';').length).toBeGreaterThan(20)
  })

  it('sayılarda ondalık ayracı virgüldür', () => {
    const csv = buildQuotesCsv([ORNEK])
    expect(csv).toContain('446767,87')
    expect(csv).not.toContain('446767.87')
  })

  it('durum ve kanal Türkçe etikete çevrilir', () => {
    const csv = buildQuotesCsv([ORNEK])
    expect(csv).toContain('Kazanıldı')
    expect(csv).toContain('Ofis')
  })

  it('karşılaştırma kaynağını raporda ayrı kanal olarak gösterir', () => {
    const csv = buildQuotesCsv([{ ...ORNEK, source_channel: 'comparison' }])

    expect(csv).toContain('Karşılaştırma')
  })

  it('BRÜT KÂR dışa aktarılmaz — dosya elden ele dolaşabilir', () => {
    const csv = buildQuotesCsv([ORNEK])
    expect(csv).not.toContain('50000')
    expect(csv.split('\r\n')[0]).not.toMatch(/kâr|kar|profit/i)
  })

  describe('formül enjeksiyonu koruması', () => {
    it.each([
      ['=HYPERLINK("http://kotu.site")', "'=HYPERLINK"],
      ['+1+1', "'+1+1"],
      ['-2+3', "'-2+3"],
      ['@SUM(A1)', "'@SUM(A1)"],
    ])('%s tırnakla etkisizleştirilir', (girdi, beklenen) => {
      const csv = buildQuotesCsv([{ ...ORNEK, customer_name: girdi }])
      expect(csv).toContain(beklenen)
    })

    it('normal ad bozulmaz', () => {
      const csv = buildQuotesCsv([{ ...ORNEK, customer_name: 'Ahmet Yılmaz' }])
      expect(csv).toContain('Ahmet Yılmaz')
      expect(csv).not.toContain("'Ahmet")
    })
  })

  describe('kaçış', () => {
    it('noktalı virgül içeren değer tırnaklanır', () => {
      const csv = buildQuotesCsv([{ ...ORNEK, customer_company: 'A;B Yapı' }])
      expect(csv).toContain('"A;B Yapı"')
    })

    it('çift tırnak ikilenir', () => {
      const csv = buildQuotesCsv([{ ...ORNEK, customer_name: 'Ali "Usta" Veli' }])
      expect(csv).toContain('"Ali ""Usta"" Veli"')
    })

    it('satır sonu içeren not tabloyu bozmaz', () => {
      const csv = buildQuotesCsv([{ ...ORNEK, customer_company: 'A\nB' }])
      // Değer tırnaklandığı için kayıt satırı bölünmez.
      expect(csv).toContain('"A\nB"')
    })
  })

  it('eksik alanlar boş hücre olur, "null" yazılmaz', () => {
    const csv = buildQuotesCsv([
      { id: 1, created_at: '2026-07-20T09:30:00.000Z' } as CsvQuote,
    ])
    expect(csv).not.toContain('null')
    expect(csv).not.toContain('undefined')
    expect(csv).not.toContain('NaN')
  })

  it('boş listede yalnız başlık döner', () => {
    expect(buildQuotesCsv([]).split('\r\n')).toHaveLength(1)
  })

  it('dosya adı tarihli üretilir', () => {
    expect(csvFileName(new Date('2026-07-27T10:00:00Z'))).toBe('teklifler_2026-07-27.csv')
    expect(csvFileName(new Date('2026-07-27T10:00:00Z'), 'kazanilan')).toBe(
      'teklifler_2026-07-27_kazanilan.csv',
    )
  })
})
