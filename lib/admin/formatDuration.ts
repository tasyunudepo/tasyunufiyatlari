// Süre biçimlendirme — ofis panelinde tek kaynak.
//
// SORUN (audit V3, 26 Temmuz 2026): "Ortalama ilk temas" kartı **1674 saat**
// yazıyordu. 70 günü saat cinsinden okumak zorunda kalmak metriği
// kullanılamaz kılıyor; üstelik bu sayı bir alarmdı ama nötr görünüyordu.

export type SureSiddeti = 'iyi' | 'uyari' | 'kritik'

export interface SureGosterimi {
  /** İnsan okunur metin: "3 saat", "2 gün", "10 hafta" */
  metin: string
  /** Eşiklere göre şiddet — renk için. */
  siddet: SureSiddeti
  /** Ham saat — sıralama ve karşılaştırma için korunur. */
  saat: number
}

const SAAT_GUN = 24
const SAAT_HAFTA = 24 * 7

/**
 * Saati okunabilir süreye çevirir.
 *
 * @example
 * formatSaat(3)    // "3 saat"
 * formatSaat(48)   // "2 gün"
 * formatSaat(1674) // "10 hafta"
 */
export function formatSaat(saat: number): string {
  if (!Number.isFinite(saat) || saat < 0) return '—'
  // Yuvarlamadan ÖNCE bakılır: 0,5 saat Math.round ile 1'e çıkıp
  // "1 saat" olarak görünüyordu.
  if (saat < 1) return 'bir saatten az'

  const s = Math.round(saat)
  if (s < SAAT_GUN) return `${s} saat`

  const gun = Math.round(s / SAAT_GUN)
  if (s < SAAT_HAFTA * 2) return `${gun} gün`

  const hafta = Math.round(s / SAAT_HAFTA)
  if (hafta < 9) return `${hafta} hafta`

  const ay = Math.round(s / (SAAT_GUN * 30))
  return `${ay} ay`
}

/**
 * İlk temas süresi için şiddet.
 *
 * Eşikler ticari karar değil, operasyonel sağduyu: teklif geldikten sonra
 * ilk gün içinde dönmek beklenir; iki günü aşan her temas gecikmedir.
 */
export function temasSiddeti(saat: number): SureSiddeti {
  if (!Number.isFinite(saat)) return 'iyi'
  if (saat <= 24) return 'iyi'
  if (saat <= 48) return 'uyari'
  return 'kritik'
}

export function sureGosterimi(saat: number | null | undefined): SureGosterimi | null {
  if (saat == null || !Number.isFinite(saat)) return null
  return {
    metin: formatSaat(saat),
    siddet: temasSiddeti(saat),
    saat,
  }
}

/**
 * "…-dir" eki — ünlü uyumu ve ünsüz benzeşmesiyle.
 *
 * `${formatSaat(s)}tir` gibi düz birleştirme "13 güntir" üretiyordu.
 * formatSaat yalnız dört birim döndürdüğü için ekler sabit tablodan gelir;
 * "saat" ön ünlü alır (saatler, saati → saattir), diğerleri kendi uyumunu izler.
 */
const SURE_EKI: Record<string, string> = {
  saat: 'saattir',
  gün: 'gündür',
  hafta: 'haftadır',
  ay: 'aydır',
}

/**
 * "13 gündür" biçiminde bekleyiş metni.
 *
 * @example
 * bekleyisSuresi(3)    // "3 saattir"
 * bekleyisSuresi(312)  // "13 gündür"
 * bekleyisSuresi(0.5)  // "bir saatten kısa süredir"
 */
export function bekleyisSuresi(saat: number): string {
  const metin = formatSaat(saat)
  if (metin === '—') return '—'
  if (metin === 'bir saatten az') return 'bir saatten kısa süredir'

  const bosluk = metin.lastIndexOf(' ')
  const sayi = metin.slice(0, bosluk)
  const birim = metin.slice(bosluk + 1)
  const ekli = SURE_EKI[birim]
  return ekli ? `${sayi} ${ekli}` : metin
}

/** Tailwind sınıfı — şiddete göre metin rengi. */
export const SIDDET_RENGI: Record<SureSiddeti, string> = {
  iyi: 'text-emerald-300',
  uyari: 'text-amber-300',
  kritik: 'text-red-300',
}

/**
 * İki tarih arasındaki saat farkı.
 * Geçersiz girdide null döner — çağıran taraf "veri yok" gösterir.
 */
export function saatFarki(
  baslangic: string | Date | null | undefined,
  bitis: string | Date | null | undefined,
): number | null {
  if (!baslangic || !bitis) return null
  const a = new Date(baslangic).getTime()
  const b = new Date(bitis).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const fark = (b - a) / 36e5
  return fark >= 0 ? fark : null
}
