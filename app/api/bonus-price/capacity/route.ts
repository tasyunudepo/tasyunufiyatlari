import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { computeBonusCapacity } from '@/lib/pricing/bonus/sale'

export const dynamic = 'force-dynamic'

// Bonus paket/araç kapasiteleri (metraj adımı tam araç önerileri için).
// FİYAT VERİSİ DÖNDÜRMEZ — liste/taban/iskonto/marj bu yüzeye çıkmaz;
// fiyat yalnız /api/bonus-price üzerinden bölge+marjla hesaplanır.
const querySchema = z.object({
  model: z.string().min(1).max(40),
  thicknessCm: z.coerce.number().positive().max(50),
})

export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: 'invalid_query' }, { status: 400 })
  }

  const result = computeBonusCapacity({
    modelShortName: parsed.data.model,
    thicknessCm: parsed.data.thicknessCm,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 404 })
  }

  return NextResponse.json(result)
}
