import type { CatalogItem } from '@/app/api/admin/catalog-items/route'

// Satır içi ürün arama — "yazdığım harfe göre veri tabanından anlık"
// (27 Tem 2026 kullanıcı isteği).
//
// Katalog zaten istemcide (react-query önbelleğinde) duruyor; her tuşta
// sunucuya gitmek gereksiz gecikme olurdu. Arama bu yüzden yerelde,
// saf bir fonksiyonla yapılır.

/**
 * Türkçe duyarlı normalleştirme.
 *
 * `toLocaleLowerCase('tr-TR')` tek başına yetmez: operatör "TEKNOIZOFIX"
 * yazdığında (klavyede noktasız I) "TEKNOİZOFİX" bulunmalı. Aksanlar da
 * eşitlenir ki "Dalmaçyalı" araması "dalmacyali" ile de tutsun.
 */
export function normalizeTr(raw: string): string {
  return raw
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıi]/g, 'i')
    .replace(/[şs]/g, 's')
    .replace(/[ğg]/g, 'g')
    .replace(/[üu]/g, 'u')
    .replace(/[öo]/g, 'o')
    .replace(/[çc]/g, 'c')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface CatalogSearchHit {
  item: CatalogItem
  /** Düşük daha iyi — sıralama için. */
  score: number
}

/**
 * Sorgudaki HER kelimenin geçtiği kalemleri döndürür.
 *
 * Puanlama: baştan eşleşme en iyi, sonra kelime başı, sonra herhangi bir yer.
 * Levhalar aksesuarların önüne alınır — teklif levhayla başlar.
 */
export function searchCatalogItems(
  items: CatalogItem[],
  query: string,
  limit = 8,
): CatalogItem[] {
  const q = normalizeTr(query)
  if (q.length < 2) return []

  const kelimeler = q.split(' ').filter(Boolean)
  const vurular: CatalogSearchHit[] = []

  for (const item of items) {
    if (item.isActive === false) continue

    // Tam ad da taranır: katalog etiketi marka + KISA ad'dır
    // ("TEKNO Yapıştırıcı") ama operatör ticari adı bilir ("TEKNOİZOFİX")
    // ve teklifte/PDF'te o görünür. Yalnız etikete bakılırsa operatörün
    // aradığı ürün hiç bulunamıyordu (27 Tem 2026 E2E bulgusu).
    const metin = normalizeTr(`${item.label} ${item.brandName} ${item.fullName ?? ''}`)
    // Boşluktan bağımsız ikinci deneme: katalogda ürün "TEKNO İzofix"
    // (marka + kısa ad) diye durur, operatörün bildiği ad ise
    // "TEKNOİZOFİX"tir. Bitişik yazılan sorgu da tutmalı.
    const metinSiki = metin.replace(/ /g, '')
    const eslesti = kelimeler.every(
      (k) => metin.includes(k) || metinSiki.includes(k.replace(/ /g, '')),
    )
    if (!eslesti) continue

    const konum = metin.indexOf(kelimeler[0])
    // Kelime başında mı? (baştaysa 0, kelime başıysa küçük, ortadaysa büyük)
    const kelimeBasi = konum === 0 || metin[konum - 1] === ' '
    const score =
      (konum === 0 ? 0 : kelimeBasi ? 100 : 300) +
      konum +
      (item.kind === 'levha' ? 0 : 50)

    vurular.push({ item, score })
  }

  vurular.sort((a, b) => (a.score !== b.score ? a.score - b.score : a.item.label.localeCompare(b.item.label, 'tr')))
  return vurular.slice(0, limit).map((v) => v.item)
}
