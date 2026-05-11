// /ofis teklif listesi — "teklif serisi" gruplaması (v1)
// =============================================================
// Aynı müşteri (telefon) tarafından kısa süre içinde üretilen
// alternatif tekliflerin (8/9/10 cm, farklı paket vs.) operasyon
// ekranında tek bir karar oturumu olarak görünmesi için.
//
// Sözleşme:
//   - DB'ye dokunulmaz, gruplama saf frontend'de yapılır.
//   - Kural deterministik: aynı veri her zaman aynı seriyi üretir.
//   - Tek teklifli kayıtlar da 1 elemanlı seri olarak döner; UI
//     tarafında "tekil" görünüp görünmemesine quote sayısına bakar.
//
// Seri tanımı v1:
//   * customer_phone ana sinyal — telefonsuz quote gruplanmaz, kendi
//     başına tek elemanlı seri olur (UI tek teklif gibi gösterebilir).
//   * created_at farkı en fazla 15 dakika (ardışık quote'lar arası)
//   * city_name aynıysa pozitif sinyal, farklıysa yeni seri başlatır
//   * material_type aynıysa pozitif sinyal, farklıysa yeni seri başlatır
//   * brand / thickness / area / package farklı olabilir — alternatif
//     teklif mantığı bunları zaten kapsar.

const SERIES_GAP_MINUTES = 15;

// /api/admin/quotes'dan gelen quote satırının kullanılan alanları.
// Geri kalan alanlar `extras` üzerinden korunur ki UI tüm orijinal
// veriye erişebilsin.
export interface QuoteRow {
  id: number | string;
  created_at: string;
  customer_name?: string | null;
  customer_company?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  city_name?: string | null;
  material_type?: string | null;
  brand_name?: string | null;
  thickness_cm?: number | null;
  area_m2?: number | null;
  package_name?: string | null;
  source_channel?: string | null;
  request_type?: string | null;
  status?: string | null;
  total_price?: number | null;
  // Geri kalan alanlar serbest — orijinal quote objesi UI'da kullanılır
  [key: string]: unknown;
}

export interface QuoteSeries<T extends QuoteRow = QuoteRow> {
  /** Liste içinde unique anahtar (React key) — telefon + ilk timestamp */
  seriesKey: string;
  /** Telefonsuz seriler için 'no_phone' marker'ı */
  customerPhone: string;
  customerName?: string;
  customerCompany?: string;
  cityName?: string;
  materialType?: string;
  /** Seri içinde geçen tüm sourceChannel değerleri (uniq) */
  sourceChannels: string[];
  quoteCount: number;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  /** Artan sırada uniq kalınlıklar */
  thicknesses: number[];
  /** Görünüm sırasıyla uniq markalar */
  brands: string[];
  /** Görünüm sırasıyla uniq paket adları */
  packageNames: string[];
  /** Toplam tutarların ham toplamı (raporlama için, tek teklifin değil) */
  totalPriceSum: number;
  /** Seri içindeki en düşük teklif tutarı */
  minPrice: number | null;
  /** Seri içindeki en yüksek teklif tutarı */
  maxPrice: number | null;
  /** Seri içindeki teklifler — eskiden yeniye sıralı */
  quotes: T[];
}

// ─── Yardımcılar ─────────────────────────────────────────────────

function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  // Sadece rakam — boşluk, tire, parantez, +90 farklarını eler.
  const digits = raw.replace(/\D+/g, '');
  if (!digits) return '';
  // 90 ile başlayan 12-13 haneli numarayı 0XXX'e indir
  if (digits.length >= 12 && digits.startsWith('90')) {
    return '0' + digits.slice(2);
  }
  // 10 haneli ise (5XX...) başına 0 ekle
  if (digits.length === 10 && digits.startsWith('5')) {
    return '0' + digits;
  }
  return digits;
}

function normalizeIdentity(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function pushUniq<T>(arr: T[], v: T | null | undefined): void {
  if (v == null) return;
  if (!arr.includes(v)) arr.push(v);
}

function diffMinutes(a: string, b: string): number {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return Number.POSITIVE_INFINITY;
  return Math.abs(tb - ta) / 60000;
}

// ─── Ana fonksiyon ───────────────────────────────────────────────

/**
 * Quote listesini "teklif serileri" olarak grupla.
 *
 * Davranış:
 * - Telefonsuz quote'lar tek elemanlı seri olarak döner.
 * - Telefonu olanlar normalize edilip aynı telefon altında toplanır.
 * - Aynı telefon içinde, ardışık quote'lar arasındaki süre 15 dakikayı
 *   aşarsa yeni seri başlar.
 * - Aynı telefon içinde city_name veya material_type değişirse de yeni
 *   seri başlar (farklı projeler kabul edilir).
 *
 * Çıktı, en yeni serinin en üstte olduğu sırada döner.
 */
export function groupQuotesIntoSeries<T extends QuoteRow>(
  rows: T[],
  options?: { gapMinutes?: number }
): QuoteSeries<T>[] {
  const gap = options?.gapMinutes ?? SERIES_GAP_MINUTES;
  if (!rows || rows.length === 0) return [];

  // 1) Telefon bucket'ları + telefonsuzlar
  const phoneBuckets = new Map<string, T[]>();
  const orphans: T[] = []; // telefonsuzlar — her biri tek elemanlı seri

  for (const row of rows) {
    const phone = normalizePhone(row.customer_phone as string | null | undefined);
    if (!phone) {
      orphans.push(row);
    } else {
      const bucket = phoneBuckets.get(phone);
      if (bucket) bucket.push(row);
      else phoneBuckets.set(phone, [row]);
    }
  }

  // 2) Her telefon bucket'ını created_at'a göre sırala, sonra zaman/şehir/malzeme
  //    eşiklerine göre alt-serilere böl.
  const series: QuoteSeries<T>[] = [];

  for (const [phone, bucket] of phoneBuckets) {
    bucket.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let current: T[] = [];
    const flush = () => {
      if (current.length > 0) {
        series.push(buildSeries(phone, current));
        current = [];
      }
    };

    for (const row of bucket) {
      if (current.length === 0) {
        current.push(row);
        continue;
      }
      const last = current[current.length - 1];
      const gapOk = diffMinutes(last.created_at, row.created_at) <= gap;
      const cityMatch = (last.city_name ?? null) === (row.city_name ?? null);
      const matMatch = (last.material_type ?? null) === (row.material_type ?? null);
      const lastIdentity = normalizeIdentity(last.customer_company ?? last.customer_name);
      const nextIdentity = normalizeIdentity(row.customer_company ?? row.customer_name);
      const identityMatch =
        !lastIdentity || !nextIdentity ? true : lastIdentity === nextIdentity;

      if (gapOk && cityMatch && matMatch && identityMatch) {
        current.push(row);
      } else {
        flush();
        current.push(row);
      }
    }
    flush();
  }

  // 3) Telefonsuzları tek elemanlı seri olarak ekle
  for (const row of orphans) {
    series.push(buildSeries('no_phone', [row]));
  }

  // 4) En yeni seri en üstte (endedAt DESC)
  series.sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());
  return series;
}

function buildSeries<T extends QuoteRow>(phone: string, quotes: T[]): QuoteSeries<T> {
  // quotes burada eskiden yeniye sıralı (caller garantisi).
  const first = quotes[0];
  const last = quotes[quotes.length - 1];

  const thicknesses: number[] = [];
  const brands: string[] = [];
  const packageNames: string[] = [];
  const sourceChannels: string[] = [];
  let totalPriceSum = 0;
  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  for (const q of quotes) {
    if (typeof q.thickness_cm === 'number' && q.thickness_cm > 0) {
      pushUniq(thicknesses, q.thickness_cm);
    }
    if (q.brand_name) pushUniq(brands, q.brand_name);
    if (q.package_name) pushUniq(packageNames, q.package_name);
    if (q.source_channel) pushUniq(sourceChannels, q.source_channel);
    if (typeof q.total_price === 'number') {
      totalPriceSum += q.total_price;
      minPrice = minPrice == null ? q.total_price : Math.min(minPrice, q.total_price);
      maxPrice = maxPrice == null ? q.total_price : Math.max(maxPrice, q.total_price);
    }
  }

  thicknesses.sort((a, b) => a - b);

  const startedAt = first.created_at;
  const endedAt = last.created_at;
  const durationMinutes = quotes.length > 1 ? diffMinutes(startedAt, endedAt) : 0;

  // İsim/firma için en eksiksiz olanı tercih et — son tekliftekiler genelde
  // daha güncel ama önce dolu olanı seçmek mantıklı.
  const customerName =
    quotes.find((q) => q.customer_name)?.customer_name ?? undefined;
  const customerCompany =
    quotes.find((q) => q.customer_company)?.customer_company ?? undefined;
  const cityName = first.city_name ?? undefined;
  const materialType = first.material_type ?? undefined;

  const seriesKey = `${phone}-${new Date(startedAt).getTime()}`;

  return {
    seriesKey,
    customerPhone: phone,
    customerName: customerName ?? undefined,
    customerCompany: customerCompany ?? undefined,
    cityName: cityName ?? undefined,
    materialType: materialType ?? undefined,
    sourceChannels,
    quoteCount: quotes.length,
    startedAt,
    endedAt,
    durationMinutes,
    thicknesses,
    brands,
    packageNames,
    totalPriceSum,
    minPrice,
    maxPrice,
    quotes,
  };
}

// ─── UI helper'ları ──────────────────────────────────────────────

/** "12 dk içinde" / "<1 dk içinde" / "" */
export function formatSeriesDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes < 1) return '<1 dk içinde';
  if (minutes < 60) return `${Math.round(minutes)} dk içinde`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes - hours * 60);
  return rest > 0 ? `${hours} sa ${rest} dk içinde` : `${hours} sa içinde`;
}

/** "8 / 9 / 10 cm" */
export function formatThicknesses(cms: number[]): string {
  if (!cms || cms.length === 0) return '—';
  return `${cms.join(' / ')} cm`;
}
