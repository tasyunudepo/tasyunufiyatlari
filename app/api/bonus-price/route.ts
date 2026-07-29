import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { computeBonusUnitSale } from '@/lib/pricing/bonus/sale'

export const dynamic = 'force-dynamic'

// Bonus levha birim satış fiyatı (KDV hariç, marj uygulanmış).
// Liste fiyatı, taban fiyat, iskonto ve marj yüzdesi YANITTA YER ALMAZ —
// müşteri yüzeyine yalnız nihai satış fiyatı çıkar.
const querySchema = z.object({
  model: z.string().min(1).max(40),
  thicknessCm: z.coerce.number().positive().max(50),
  cityCode: z.coerce.number().int().min(1).max(81),
  sub: z.enum(['avrupa', 'anadolu', 'gebze', 'diger']).optional(),
})

const FAIL_STATUS: Record<string, number> = {
  unknown_model: 404,
  not_bonus: 404,
  thickness_unavailable: 404,
  sub_region_required: 422,
  region_unresolved: 422,
  margin_unavailable: 503,
}

export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: 'invalid_query' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: brand, error } = await supabase
    .from('brands')
    .select('margin_pct')
    .eq('name', 'Bonus')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, reason: 'brand_lookup_failed' }, { status: 503 })
  }

  const result = computeBonusUnitSale({
    modelShortName: parsed.data.model,
    thicknessCm: parsed.data.thicknessCm,
    cityCode: parsed.data.cityCode,
    subChoice: parsed.data.sub ?? null,
    brandMarginPct: brand?.margin_pct ?? null,
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: FAIL_STATUS[result.reason] ?? 422 },
    )
  }

  // AÇIK BEYAZ LİSTE — `result`'ı olduğu gibi döndürme.
  //
  // Bu rota MÜŞTERİ wizard'ının çağırdığı public uçtur. `computeBonusUnitSale`
  // sonucuna sunucu-içi bir alan eklendiği anda (ör. `netCostPerM2` — net
  // alış fiyatı) nesneyi yaymak onu doğrudan müşterinin tarayıcısına
  // düşürürdü. Alan alan yazmak bu sızıntıyı yapısal olarak imkânsız kılar:
  // yeni bir alan buraya bilinçli eklenmedikçe dışarı çıkmaz.
  return NextResponse.json({
    ok: true,
    region: result.region,
    thicknessMm: result.thicknessMm,
    salePricePerM2: result.salePricePerM2,
    packageM2: result.packageM2,
    packagePieces: result.packagePieces,
    kamyonM2: result.kamyonM2,
    tirM2: result.tirM2,
  })
}
