import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireOfficeReadAuth } from '@/lib/security/adminMutationAuth'
import { resolveMarginPctStrict, type MarginRuleInput } from '@/lib/pricing/margin'
import {
  buildAccessorySet,
  type AccessoryRow,
  type AccessorySetItem,
  type AccessoryTypeRow,
} from '@/lib/quote/buildAccessorySet'

export const dynamic = 'force-dynamic'

// Toz grubu paketleri — elle teklif ekranında tek tıkla eklenir.
//
// Wizard'ın "Premium / Dengeli / Ekonomik" kartlarının ofis karşılığı:
// levha markasına bağlı `package_definitions` satırları, her biri bir
// AKSESUAR markasının komple setini temsil eder.

const querySchema = z.object({
  plateBrandId: z.coerce.number().int().positive().optional(),
  plateThicknessCm: z.coerce.number().positive().max(100).optional(),
  materialType: z.enum(['tasyunu', 'eps']).default('tasyunu'),
  areaM2: z.coerce.number().positive().max(100000),
  cityCode: z.coerce.number().int().positive().optional(),
})

export interface AccessorySetOption {
  /** package_definitions.id — yoksa marka bazlı sentetik anahtar. */
  key: string
  name: string
  tier: string | null
  badge: string | null
  description: string | null
  accessoryBrandId: number
  accessoryBrandName: string
  marginPct: number
  items: AccessorySetItem[]
  totalCost: number
  complete: boolean
  missingTypes: string[]
}

export async function GET(req: NextRequest) {
  const auth = requireOfficeReadAuth(req)
  if (!auth.ok) return auth.response

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Geçersiz set parametresi.' },
      { status: 400 },
    )
  }
  const { plateBrandId, plateThicknessCm, materialType, areaM2, cityCode } = parsed.data

  const supabase = createServerSupabaseClient()

  const [defsRes, typesRes, accRes, brandsRes, materialsRes, zonesRes] = await Promise.all([
    // SIRA WIZARD İLE BİREBİR OLMAK ZORUNDA (WizardCalculator.tsx:516-521).
    // Paket motoru her aksesuar tipinde İLK eşleşen ürünü seçer; `id` sırası
    // orijinal set ürünlerini önceler (TEKNOİZOFİX id 77, sonradan eklenen
    // Chelfix 165+). Sırasız çekilirse ofis teklifi wizard'dan BAŞKA ürün
    // seçer — 27 Tem 2026'da tam bu oldu (Chelfix + 155 mm dübel).
    supabase.from('package_definitions').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('accessory_types').select('*').order('sort_order'),
    supabase.from('accessories').select('*').eq('is_active', true).order('id'),
    supabase.from('brands').select('id, name, margin_pct'),
    supabase.from('material_types').select('*'),
    cityCode
      ? supabase.from('shipping_zones').select('*').eq('city_code', cityCode).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (typesRes.error || accRes.error || brandsRes.error || materialsRes.error) {
    console.error('accessory-sets okunamadı:', {
      types: typesRes.error?.message,
      acc: accRes.error?.message,
      brands: brandsRes.error?.message,
      materials: materialsRes.error?.message,
    })
    return NextResponse.json({ ok: false, error: 'Toz grubu verisi okunamadı.' }, { status: 500 })
  }

  const brandById = new Map<number, { name: string }>(
    (brandsRes.data ?? []).map((b) => [b.id, { name: b.name }]),
  )
  const materialRule = (materialsRes.data ?? []).find(
    (m) => m.slug === materialType,
  ) as MarginRuleInput | undefined

  // Marj fail-closed: kural çözülemiyorsa fiyat üretilmez.
  const marginPct = resolveMarginPctStrict(materialRule ?? null, areaM2)
  if (marginPct == null) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Marj kuralı çözülemedi — Fiyatlandırma › Marj Kuralları sekmesini kontrol edin.',
      },
      { status: 409 },
    )
  }

  const accessoryTypes = (typesRes.data ?? []) as AccessoryTypeRow[]
  const accessories = (accRes.data ?? []) as AccessoryRow[]
  const city = (zonesRes.data ?? null) as { eps_toz_region_discount: number | null; optimix_toz_discount: number | null } | null

  // İlgili paket tanımları: levha markası verildiyse ona bağlı olanlar,
  // verilmediyse tüm tanımlar (operatör serbest set kurabilsin).
  const defs = (defsRes.data ?? []).filter(
    (d) => plateBrandId == null || d.plate_brand_id === plateBrandId,
  )

  const options: AccessorySetOption[] = []
  const gorulenMarkalar = new Set<number>()

  // Setin içeriği YALNIZ aksesuar markasına bağlı. Aynı markayı işaret eden
  // birden çok paket tanımı ("Dengeli Sistem", "Ekonomik Sistem"…) birebir
  // AYNI seti üretir; hepsini listelemek operatöre 13 kart gösterip hiçbirini
  // ayırt ettirmiyordu (27 Tem 2026 canlı doğrulama). Marka başına bir kart.
  for (const def of defs) {
    const accBrandId = def.accessory_brand_id
    if (accBrandId == null) continue
    if (gorulenMarkalar.has(accBrandId)) continue
    const accBrandName = brandById.get(accBrandId)?.name ?? ''

    const set = buildAccessorySet({
      accessoryTypes,
      accessories,
      accessoryBrandId: accBrandId,
      accessoryBrandName: accBrandName,
      materialType,
      plateThicknessCm,
      areaM2,
      marginPct,
      city,
    })

    // Hiç kalem çıkmayan tanım gösterilmez — boş kart operatörü yanıltır.
    if (set.items.length === 0) continue

    gorulenMarkalar.add(accBrandId)
    options.push({
      key: `def-${def.id}`,
      name: def.name ?? accBrandName,
      tier: def.tier ?? null,
      badge: def.badge ?? null,
      description: def.description ?? null,
      accessoryBrandId: accBrandId,
      accessoryBrandName: accBrandName,
      marginPct,
      items: set.items,
      totalCost: set.totalCost,
      complete: set.complete,
      missingTypes: set.missingTypes,
    })
  }

  // Paket tanımı olmayan toz markaları da seçilebilsin (ör. levha markası
  // seçilmemiş serbest teklif). Aynı marka iki kez listelenmez.
  const tozMarkaIdleri = new Set(
    accessories
      .filter((a) => a.brand_id != null && a.is_active !== false)
      .map((a) => a.brand_id as number),
  )
  for (const brandId of tozMarkaIdleri) {
    if (gorulenMarkalar.has(brandId)) continue
    const accBrandName = brandById.get(brandId)?.name ?? ''
    if (!accBrandName) continue

    const set = buildAccessorySet({
      accessoryTypes,
      accessories,
      accessoryBrandId: brandId,
      accessoryBrandName: accBrandName,
      materialType,
      plateThicknessCm,
      areaM2,
      marginPct,
      city,
    })
    if (set.items.length === 0) continue

    options.push({
      key: `brand-${brandId}`,
      name: `${accBrandName} toz grubu`,
      tier: null,
      badge: null,
      description: null,
      accessoryBrandId: brandId,
      accessoryBrandName: accBrandName,
      marginPct,
      items: set.items,
      totalCost: set.totalCost,
      complete: set.complete,
      missingTypes: set.missingTypes,
    })
  }

  // Komple setler önce, sonra ucuzdan pahalıya.
  options.sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1
    return a.totalCost - b.totalCost
  })

  return NextResponse.json(
    { ok: true, sets: options, marginPct, materialType, plateThicknessCm, areaM2 },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
