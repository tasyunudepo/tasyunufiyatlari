import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireOfficeReadAuth } from '@/lib/security/adminMutationAuth'
import {
  applyMargin,
  resolveBrandMarginPctStrict,
  resolveMarginPctStrict,
  type MarginRuleInput,
} from '@/lib/pricing/margin'
import { joinBrandAndModel } from '@/lib/catalog/productLabel'
import { computeBonusUnitSale } from '@/lib/pricing/bonus/sale'
import { citySubRegionQuestion, type BonusSubRegionChoice } from '@/lib/pricing/bonus/subRegions'

export const dynamic = 'force-dynamic'

// Elle teklif ekranının ürün kaynağı.
//
// Amaç: operatör Excel'de yazar gibi satır girsin ama birim fiyat SİSTEMİN
// kurallarıyla gelsin — şehir/araç iskontosu (İSK1), ürün iskontosu (İSK2)
// ve marka/malzeme marj kuralı uygulanmış hâlde. Operatör dilerse üstüne
// yazar; yazdığında bunu bilerek yapmış olur.
//
// GİZLİLİK: ham `base_price`, `discount_1/2` ve marj yüzdesi tarayıcıya
// İNMEZ. Yalnız "net alış" ve "önerilen satış" döner — panel zaten admin
// yüzeyi ama gereksiz alan taşımamak için (bonus-price-privacy çizgisi).

const querySchema = z.object({
  cityCode: z.coerce.number().int().positive().optional(),
  areaM2: z.coerce.number().positive().max(100000).default(500),
  vehicle: z.enum(['tir', 'kamyon']).default('tir'),
  /**
   * Bonus alt-bölge seçimi. İstanbul'da yaka (Avrupa 3 / Anadolu 2),
   * Kocaeli'de Gebze (2) / diğer (1) fiyatı değiştirir; seçilmeden
   * Bonus fiyatı üretilemez.
   */
  sub: z.enum(['avrupa', 'anadolu', 'gebze', 'diger']).optional(),
  /** Aksesuar marjı bu malzemenin kademe kuralından çözülür. */
  materialType: z.enum(['tasyunu', 'eps', 'karma']).default('karma'),
})

export interface CatalogItem {
  key: string
  kind: 'levha' | 'aksesuar'
  id: number
  thicknessCm: number | null
  label: string
  /**
   * Ürünün kataloğdaki TAM adı. Etiket marka + kısa ad olduğu için
   * ("TEKNO Yapıştırıcı") operatörün bildiği ticari ad ("TEKNOİZOFİX")
   * etikette geçmiyor ve arama tutmuyordu. Arama bu alanı da tarar.
   */
  fullName: string
  brandName: string
  unit: string
  /** Paket içeriği — aksesuarda adet, levhada m². */
  unitContent: number | null
  packageM2: number | null
  /**
   * Tam araç kapasitesi (m²) — operatör "3 TIR" deyip metrajı elde etsin
   * diye. Bonus'ta üreticinin kendi kapasitesi, diğerlerinde
   * `logistics_capacity` tablosundaki kalınlık satırı.
   */
  truckM2: number | null
  lorryM2: number | null
  /** İskontolar uygulanmış alış (KDV hariç). */
  netCost: number
  /** Marj uygulanmış önerilen satış (KDV hariç). */
  suggestedUnitPrice: number
  marginPct: number
  /** Marjın nereden geldiği — operatör görsün diye. */
  marginSource: 'marka' | 'malzeme'
  materialSlug: string | null
  isActive: boolean
}

export async function GET(req: NextRequest) {
  const auth = requireOfficeReadAuth(req)
  if (!auth.ok) return auth.response

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Geçersiz katalog parametresi.' },
      { status: 400 },
    )
  }
  const { cityCode, areaM2, vehicle, sub, materialType } = parsed.data

  const supabase = createServerSupabaseClient()

  const [platesRes, pricesRes, accessoriesRes, brandsRes, materialsRes, zonesRes, logisticsRes] =
    await Promise.all([
      supabase
        .from('plates')
        .select('id, name, short_name, brand_id, material_type_id, thickness_options, base_price, base_price_per_cm, package_m2, discount_1, discount_2, is_kdv_included, is_active'),
      supabase.from('plate_prices').select('*'),
      supabase
        .from('accessories')
        .select('id, name, short_name, brand_id, accessory_type_id, base_price, discount_1, discount_2, is_kdv_included, unit, unit_content, is_active'),
      supabase.from('brands').select('id, name, margin_pct'),
      supabase.from('material_types').select('*'),
      supabase.from('shipping_zones').select('*'),
      supabase.from('logistics_capacity').select('*').order('thickness'),
    ])

  if (platesRes.error || accessoriesRes.error || brandsRes.error || materialsRes.error) {
    console.error('catalog-items okunamadı:', {
      plates: platesRes.error?.message,
      accessories: accessoriesRes.error?.message,
      brands: brandsRes.error?.message,
      materials: materialsRes.error?.message,
    })
    return NextResponse.json(
      { ok: false, error: 'Katalog okunamadı.' },
      { status: 500 },
    )
  }

  const brandById = new Map<number, { name: string; margin_pct: number | null }>(
    (brandsRes.data ?? []).map((b) => [b.id, { name: b.name, margin_pct: b.margin_pct }]),
  )
  const materialById = new Map<number, MarginRuleInput & { name: string }>(
    (materialsRes.data ?? []).map((m) => [m.id, m as MarginRuleInput & { name: string }]),
  )
  const materialBySlug = new Map<string, MarginRuleInput>(
    (materialsRes.data ?? []).map((m) => [m.slug, m as MarginRuleInput]),
  )
  const city = (zonesRes.data ?? []).find((z) => z.city_code === cityCode) ?? null

  // `logistics_capacity.thickness` MİLİMETRE tutulur (4 cm → 40).
  const logisticsByMm = new Map<number, { lorry_capacity_m2: number; truck_capacity_m2: number }>(
    (logisticsRes.data ?? []).map((l) => [
      Number(l.thickness),
      { lorry_capacity_m2: Number(l.lorry_capacity_m2), truck_capacity_m2: Number(l.truck_capacity_m2) },
    ]),
  )

  /** Marka marjı öncelikli; boşsa malzeme kademe kuralı (fail-closed). */
  function resolveMargin(
    brandMarginPct: number | null | undefined,
    materialRule: MarginRuleInput | null,
  ): { pct: number; source: 'marka' | 'malzeme' } | null {
    const pct = resolveBrandMarginPctStrict(brandMarginPct, materialRule, areaM2)
    if (pct == null) return null
    return { pct, source: brandMarginPct != null ? 'marka' : 'malzeme' }
  }

  const items: CatalogItem[] = []

  // Bonus fiyatı `plate_prices` tablosunda DEĞİL — bölge bazlı fiyat
  // listesinde (lib/pricing/bonus/bonus-region-prices.json). Bonus levhalarının
  // base_price'ı null ve plate_prices'ta hiç satırı yok; bu yüzden genel
  // hesap yolu onları atlıyordu (27 Tem 2026: katalogda 0 Bonus ürünü).
  const bonusSubRequired = cityCode != null && citySubRegionQuestion(cityCode) != null
  const bonusNotes: string[] = []
  if (bonusSubRequired && !sub) {
    bonusNotes.push(
      `${city?.city_name ?? 'Bu şehir'} için Bonus fiyatı bölge seçimi ister (${Object.keys(citySubRegionQuestion(cityCode!)?.options ?? {}).join(' / ')}).`,
    )
  }

  // ── Levhalar: her kalınlık ayrı satır ──
  for (const plate of platesRes.data ?? []) {
    const brand = plate.brand_id != null ? brandById.get(plate.brand_id) : undefined
    const material = plate.material_type_id != null ? materialById.get(plate.material_type_id) : undefined
    const materialSlug = material?.slug ?? null
    const brandName = brand?.name ?? ''

    // ── Bonus: ayrı fiyat yolu ──
    if (brandName === 'Bonus') {
      if (cityCode == null) continue // şehirsiz Bonus fiyatı üretilemez
      for (const thickness of (plate.thickness_options ?? []) as number[]) {
        const sale = computeBonusUnitSale({
          modelShortName: plate.short_name ?? plate.name,
          thicknessCm: thickness,
          cityCode,
          subChoice: (sub ?? null) as BonusSubRegionChoice | null,
          brandMarginPct: brand?.margin_pct,
        })
        if (!sale.ok) continue // fail-closed: fiyat çözülemiyorsa gösterme

        items.push({
          key: `levha-${plate.id}-${thickness}`,
          kind: 'levha',
          id: plate.id,
          thicknessCm: thickness,
          label: `${joinBrandAndModel(brandName, plate.short_name ?? plate.name)} ${thickness} cm`,
          fullName: plate.name,
          brandName,
          unit: 'm²',
          unitContent: null,
          packageM2: sale.packageM2 ?? null,
          // Bonus kapasitesi üreticinin kendi listesinden gelir; genel
          // `logistics_capacity` tablosundan FARKLIDIR (4 cm'de 2.217,6 m²
          // vs 1.872 m²) — karıştırılırsa metraj yanlış çıkar.
          truckM2: sale.tirM2 ?? null,
          lorryM2: sale.kamyonM2 ?? null,
          // Net alış /ofis'e iner — diğer TÜM markalarda zaten böyle.
          //
          // Bir süre burada `0` yazıyordu ve gerekçe olarak
          // `bonus-price-privacy` sözleşmesi gösteriliyordu. O sözleşme
          // bunu YASAKLAMIYOR: yalnız `components/**` (müşteri tarayıcısına
          // inen kod) Bonus fiyat modüllerini import edemez der. Burası
          // sunucu rotası ve arkasında `requireOfficeReadAuth` var.
          // Sonuç, Bonus levhası teklifin en büyük kalemi olduğu hâlde brüt
          // kârdan düşüyor ve marj kadranı o satıra dokunamıyordu.
          netCost: sale.netCostPerM2,
          suggestedUnitPrice: sale.salePricePerM2,
          marginPct: Number(brand?.margin_pct ?? 0),
          marginSource: 'marka',
          materialSlug: 'tasyunu',
          isActive: plate.is_active !== false,
        })
      }
      continue
    }

    for (const thickness of (plate.thickness_options ?? []) as number[]) {
      const priceRow = (pricesRes.data ?? []).find(
        (p) => p.plate_id === plate.id && p.thickness === thickness,
      )
      const packageM2 = Number(priceRow?.package_m2 ?? plate.package_m2 ?? 0)
      const basePrice = Number(
        priceRow?.base_price ?? plate.base_price ?? (plate.base_price_per_cm ?? 0) * thickness,
      )
      if (!Number.isFinite(basePrice) || basePrice <= 0) continue

      const kdvIncluded = priceRow?.is_kdv_included ?? plate.is_kdv_included ?? false
      const listExVat = kdvIncluded ? basePrice / 1.2 : basePrice
      const listPerM2 = packageM2 > 0 ? listExVat / packageM2 : listExVat

      // İSK1 — şehir/araç kaynaklı (taşyünü) veya bölge iskontosu (EPS).
      let isk1 = Number(priceRow?.discount_1 ?? plate.discount_1 ?? 0)
      if (materialSlug === 'tasyunu' && city) {
        isk1 = Number(vehicle === 'tir' ? city.discount_tir : city.discount_kamyon) || 0
      } else if (materialSlug === 'eps' && city) {
        const bolge = Number(city.eps_toz_region_discount ?? 0)
        if (bolge > 0) isk1 = bolge
      }

      // İSK2 — ürün iskontosu; Optimix levhada şehir kuralı ezer.
      let isk2 = Number(priceRow?.discount_2 ?? plate.discount_2 ?? 0)
      if (brandName === 'Optimix' && city && isk2 >= 10) {
        isk2 = Number(city.optimix_levha_discount ?? isk2)
      }

      const netCost = listPerM2 * (1 - isk1 / 100) * (1 - isk2 / 100)
      const margin = resolveMargin(brand?.margin_pct, materialBySlug.get(materialSlug ?? '') ?? null)
      if (!margin) continue // marj çözülemiyorsa fiyat gösterme (fail-closed)

      items.push({
        key: `levha-${plate.id}-${thickness}`,
        kind: 'levha',
        id: plate.id,
        thicknessCm: thickness,
        label: `${joinBrandAndModel(brandName, plate.short_name ?? plate.name)} ${thickness} cm`,
        fullName: plate.name,
        brandName,
        unit: 'm²',
        unitContent: null,
        packageM2: packageM2 > 0 ? packageM2 : null,
        truckM2: logisticsByMm.get(thickness * 10)?.truck_capacity_m2 ?? null,
        lorryM2: logisticsByMm.get(thickness * 10)?.lorry_capacity_m2 ?? null,
        netCost,
        suggestedUnitPrice: applyMargin(netCost, margin.pct),
        marginPct: margin.pct,
        marginSource: margin.source,
        materialSlug,
        isActive: plate.is_active !== false,
      })
    }
  }

  // ── Aksesuarlar (toz grubu, dübel, file, profil…) ──
  //
  // WIZARD PARİTESİ: aksesuar marjı HER ZAMAN malzeme-tipi kademe
  // kuralından gelir, marka marjından DEĞİL. Wizard'da toz kalemleri
  // `buildAccessoryItemsForDefinition`'a giren tek `marginPct` ile
  // fiyatlanır ve o değer malzeme kuralından çözülür.
  //
  // Burada marka marjına düşülürse aynı ürün, tek tek seçildiğinde toz
  // grubu paketinden FARKLI fiyat verirdi — operatörün fark edemeyeceği
  // bir tutarsızlık olurdu.
  const accessoryMaterialSlug = materialType === 'tasyunu' ? 'tasyunu' : 'eps'
  const accessoryRule = materialBySlug.get(accessoryMaterialSlug) ?? null
  const accessoryMarginPct = resolveMarginPctStrict(accessoryRule, areaM2)

  for (const acc of accessoriesRes.data ?? []) {
    const brand = acc.brand_id != null ? brandById.get(acc.brand_id) : undefined
    const brandName = brand?.name ?? ''
    const basePrice = Number(acc.base_price ?? 0)
    if (!Number.isFinite(basePrice) || basePrice <= 0) continue

    const listExVat = acc.is_kdv_included ? basePrice / 1.2 : basePrice

    let isk1 = Number(acc.discount_1 ?? 0)
    if (city && ['Dalmaçyalı', 'Expert', 'Optimix'].includes(brandName)) {
      const bolge = Number(city.eps_toz_region_discount ?? 0)
      if (bolge > 0) isk1 = bolge
    }
    let isk2 = Number(acc.discount_2 ?? 0)
    if (brandName === 'Optimix' && city && isk2 >= 10) {
      isk2 = Number(city.optimix_toz_discount ?? isk2)
    }

    const netCost = listExVat * (1 - isk1 / 100) * (1 - isk2 / 100)
    // Fail-closed: marj kuralı çözülemiyorsa fiyat üretilmez.
    if (accessoryMarginPct == null) continue

    items.push({
      key: `aksesuar-${acc.id}`,
      kind: 'aksesuar',
      id: acc.id,
      thicknessCm: null,
      label: joinBrandAndModel(brandName, acc.short_name ?? acc.name),
      fullName: acc.name,
      brandName,
      unit: acc.unit ?? 'PKT',
      unitContent: acc.unit_content ?? 1,
      packageM2: null,
      truckM2: null,
      lorryM2: null,
      netCost,
      suggestedUnitPrice: applyMargin(netCost, accessoryMarginPct),
      marginPct: accessoryMarginPct,
      marginSource: 'malzeme',
      materialSlug: null,
      isActive: acc.is_active !== false,
    })
  }

  items.sort((a, b) => a.label.localeCompare(b.label, 'tr-TR'))

  return NextResponse.json(
    {
      ok: true,
      items: items.filter((i) => i.isActive),
      context: {
        areaM2,
        vehicle,
        cityCode: cityCode ?? null,
        cityName: city?.city_name ?? null,
        /** Bonus için bölge seçimi gerekiyor mu ve seçenekleri ne? */
        bonusSubRegion: cityCode != null ? citySubRegionQuestion(cityCode) : null,
        bonusSubChoice: sub ?? null,
      },
      notes: bonusNotes,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
