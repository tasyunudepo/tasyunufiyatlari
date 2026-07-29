import { applyMargin } from '@/lib/pricing/margin'
import { roundToKurus } from '@/lib/pricing/quoteTotals'

// Toz grubu setini kurar — wizard'ın `buildAccessoryItemsForDefinition`
// mantığının saf ve sunucuda çalışan karşılığı.
//
// NEDEN: Bu sitenin kuruluş amacı teklif hazırlama zahmetini kaldırmaktı.
// Elle teklif ekranında toz grubunu 7 satır tek tek yazmak o amaca ters;
// operatör markayı seçmeli, set komple gelmeli (27 Tem 2026 geri bildirimi).
//
// SADAKAT NOTU: aksesuar fiyatında marj HER ZAMAN malzeme-tipi kademe
// kuralından gelir (`resolveMarginPctStrict(materialRule, areaM2)`), marka
// marjından DEĞİL — Bonus dalı dahil wizard böyle çalışıyor
// (WizardCalculator.tsx:1219, :1575). Aksi hâlde ofis teklifi ile
// hesaplayıcı farklı fiyat üretirdi.

export interface AccessoryTypeRow {
  id: number
  name: string
  sort_order: number | null
  consumption_rate_eps: number | null
  consumption_rate_tasyunu: number | null
}

export interface AccessoryRow {
  id: number
  name: string
  short_name: string | null
  brand_id: number | null
  accessory_type_id: number | null
  base_price: number | null
  discount_1: number | null
  discount_2: number | null
  is_kdv_included: boolean | null
  unit: string | null
  unit_content: number | null
  is_for_eps: boolean | null
  is_for_tasyunu: boolean | null
  is_active: boolean | null
}

export interface CityDiscounts {
  eps_toz_region_discount: number | null
  optimix_toz_discount: number | null
}

export interface AccessorySetItem {
  accessoryId: number
  accessoryTypeName: string
  description: string
  quantity: number
  unit: string
  /** m² başına sarfiyat — PDF'te ve kontrolde görünür. */
  consumptionRate: number
  /** Paket içeriği (adet/kg) — paket artığı göstergesi bunu kullanır. */
  unitContent: number
  /** İskontolar uygulanmış birim alış, KDV hariç. Marj kadranının dayanağı. */
  netCost: number
  unitPrice: number
  totalPrice: number
}

export interface AccessorySetResult {
  items: AccessorySetItem[]
  totalCost: number
  /** Zorunlu bir aksesuar tipi bulunamadıysa false — set eksik. */
  complete: boolean
  /** Bulunamayan tip adları — operatöre neyin eksik olduğu söylenir. */
  missingTypes: string[]
}

/**
 * Aksesuar birim satış fiyatı: liste → KDV ayıkla → İSK1 → İSK2 → marj.
 * `calculateSalePrice` (WizardCalculator.tsx:917) ile aynı sıra.
 */
function accessoryNetCost(
  basePrice: number,
  isk1: number,
  isk2: number,
  isKdvIncluded: boolean,
): number {
  const listExVat = isKdvIncluded ? basePrice / 1.2 : basePrice
  return listExVat * (1 - isk1 / 100) * (1 - isk2 / 100)
}

/**
 * Bir toz grubu markası için komple set kurar.
 *
 * @param materialType Sarfiyat oranı buna göre seçilir (EPS ↔ taşyünü farklı)
 * @param areaM2 İş metrajı — miktarlar buradan türer
 * @param marginPct Malzeme-tipi kademe marjı (marka marjı DEĞİL)
 */
export function buildAccessorySet(input: {
  accessoryTypes: AccessoryTypeRow[]
  accessories: AccessoryRow[]
  accessoryBrandId: number
  accessoryBrandName: string
  materialType: 'tasyunu' | 'eps'
  areaM2: number
  marginPct: number
  city: CityDiscounts | null
}): AccessorySetResult {
  const {
    accessoryTypes,
    accessories,
    accessoryBrandId,
    accessoryBrandName,
    materialType,
    areaM2,
    marginPct,
    city,
  } = input

  const isEps = materialType === 'eps'
  const brandAccessories = accessories.filter(
    (a) => a.brand_id === accessoryBrandId && a.is_active !== false,
  )

  const items: AccessorySetItem[] = []
  const missingTypes: string[] = []
  let totalCost = 0

  // SIRA DEĞİŞTİRİLMEZ. Wizard `accessoryTypes` ve `accessories` dizilerini
  // sorgudan geldiği sırayla kullanır (tipler `sort_order`, ürünler `id`) ve
  // her tipte İLK eşleşen ürünü seçer. Burada yeniden sıralamak — hatta
  // "aynı" görünen bir sıralama bile — seçilen ÜRÜNÜ değiştirebilir.
  // Sıralama sorumluluğu çağırana aittir (app/api/admin/accessory-sets).
  for (const type of accessoryTypes) {
    const consumption = Number(
      (isEps ? type.consumption_rate_eps : type.consumption_rate_tasyunu) ?? 0,
    )
    // Sarfiyatı olmayan tip bu malzemede kullanılmaz — eksik sayılmaz.
    if (!Number.isFinite(consumption) || consumption <= 0) continue

    const acc = brandAccessories.find(
      (a) =>
        a.accessory_type_id === type.id &&
        (isEps ? a.is_for_eps : a.is_for_tasyunu),
    )
    if (!acc) {
      missingTypes.push(type.name)
      continue
    }

    const basePrice = Number(acc.base_price ?? 0)
    const unitContent = Number(acc.unit_content ?? 0)
    if (!Number.isFinite(basePrice) || basePrice <= 0 || unitContent <= 0) {
      missingTypes.push(type.name)
      continue
    }

    // Paket/kutu bazlı satılır: ihtiyaç yukarı yuvarlanır.
    const quantity = Math.ceil((areaM2 * consumption) / unitContent)

    let isk1 = Number(acc.discount_1 ?? 0)
    let isk2 = Number(acc.discount_2 ?? 0)

    // EPS'te bölge iskontosu levha markasından bağımsız, AKSESUAR markasına
    // göre uygulanır (wizard ile aynı kural).
    if (isEps && city && ['Dalmaçyalı', 'Expert', 'Optimix'].includes(accessoryBrandName)) {
      const bolge = Number(city.eps_toz_region_discount ?? 0)
      if (bolge > 0) isk1 = bolge
      if (accessoryBrandName === 'Optimix' && isk2 >= 10) {
        isk2 = Number(city.optimix_toz_discount ?? isk2)
      }
    }

    const netCost = accessoryNetCost(basePrice, isk1, isk2, acc.is_kdv_included === true)
    const unitPrice = applyMargin(netCost, marginPct)
    const totalPrice = roundToKurus(unitPrice * quantity)
    totalCost = roundToKurus(totalCost + totalPrice)

    items.push({
      accessoryId: acc.id,
      accessoryTypeName: type.name,
      description: acc.name,
      quantity,
      unit: acc.unit ?? 'PKT',
      consumptionRate: consumption,
      unitContent,
      // YUVARLANMADAN taşınır. Marj kadranı bu sayının üstüne marj bindirir;
      // kuruşa yuvarlanmış maliyetten hesaplanırsa fiyat 1 kuruş kayar
      // (147,17 → 145,12 yerine 145,11 olmalı) ve "uygula"ya basmak, doğru
      // kurulmuş setin fiyatını sessizce bozar.
      netCost,
      unitPrice,
      totalPrice,
    })
  }

  return {
    items,
    totalCost,
    complete: missingTypes.length === 0,
    missingTypes,
  }
}
