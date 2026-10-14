import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendNotification } from '@/lib/notifications';
import { WHATSAPP_SOURCE_LABEL, type WhatsappSource } from '@/lib/analytics/whatsappSource';

export const runtime = 'nodejs';

// ─── Rate limit: aynı IP+source için 60 saniyede 1 bildirim ──────
//    CallmeBot saatlik 5 mesaj limiti var; çift tıklama / bot spam'i
//    bu limiti yakar. Memory cache (Vercel cold start'ta sıfırlanır,
//    yeterli bir koruma).
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const ipCache = new Map<string, number>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const last = ipCache.get(key);
  if (last && now - last < RATE_LIMIT_WINDOW_MS) return true;
  ipCache.set(key, now);
  // Cache temizliği: 1000 entry'den fazla olunca eskileri sil
  if (ipCache.size > 1000) {
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    for (const [k, v] of ipCache) if (v < cutoff) ipCache.delete(k);
  }
  return false;
}

const ALLOWED_SOURCES: WhatsappSource[] = [
  'header_desktop',
  'header_mobile',
  'header_mobile_topbar',
  'wizard_help_step1',
  // Sonuç ekranı CTA'ları: en yüksek niyetli sinyaller. Bu ikisi listede
  // olmadığı için wizard sonuç bildirimleri sessizce 400'e düşüyordu.
  'wizard_result_summary',
  'wizard_result_card',
  'footer_link',
  'iletisim_card',
  'depomuz_cta',
  'product_detail_cta',
  'product_detail_summary',
  'product_detail_card',
  'site_general',
];

const intentSchema = z.object({
  source: z.enum(ALLOWED_SOURCES as [WhatsappSource, ...WhatsappSource[]]),
  productName: z.string().max(120).optional(),
  page: z.string().max(200).optional(),
  // Ölçüm sözleşmesi: oturum zinciri alanları (GA4 tarafıyla ortak).
  resultSessionId: z.string().max(64).optional(),
  ctaLocation: z.string().max(64).optional(),
  experienceVariant: z.literal('a_whatsapp_first').optional(),
  pricedContext: z.object({
    refCode: z.string().regex(/^TYW[A-Z0-9]{8,16}$/),
    modelName: z.string().min(1).max(80),
    thicknessCm: z.number().positive().max(30),
    cityCode: z.number().int().min(1).max(81),
    cityName: z.string().min(1).max(80),
    subRegionName: z.string().min(1).max(80).optional(),
    areaM2: z.number().positive().max(1_000_000),
    packageCount: z.number().int().positive().max(1_000_000),
    vehicleType: z.enum(['lorry', 'truck', 'mixed']),
    vehicleLabel: z.string().min(1).max(80),
    pricePerM2: z.number().positive().max(10_000_000),
    totalExVat: z.number().positive().max(10_000_000_000),
    shippingMode: z.enum([
      'included_in_sale_price',
      'buyer_responsible',
      'separate_quote_required',
    ]),
  }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = intentSchema.parse(body);

    // IP bazlı rate limit (Vercel header'ları)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = req.headers.get('user-agent') || '';

    // Basit bot filtresi
    if (/bot|crawl|spider|scrape|headless/i.test(userAgent)) {
      return NextResponse.json({ ok: true, skipped: 'bot' });
    }

    const rateKey = `${ip}:${data.source}`;
    if (isRateLimited(rateKey)) {
      return NextResponse.json({ ok: true, skipped: 'rate_limit' });
    }

    // Bildirim gönder — quote akışındaki gibi await edilmeli
    try {
      await sendNotification('whatsapp_intent', {
        source: WHATSAPP_SOURCE_LABEL[data.source] ?? data.source,
        page: data.page,
        productName: data.productName,
        refCode: data.pricedContext?.refCode,
        thicknessCm: data.pricedContext?.thicknessCm,
        areaM2: data.pricedContext?.areaM2,
        cityName: data.pricedContext?.cityName,
        totalPrice: data.pricedContext?.totalExVat,
        vehicleLabel: data.pricedContext?.vehicleLabel,
        pricePerM2: data.pricedContext?.pricePerM2,
        shippingMode: data.pricedContext?.shippingMode,
      });
    } catch (err) {
      console.warn('[whatsapp-intent] notify failed (non-fatal):', err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'invalid payload' },
        { status: 400 }
      );
    }
    console.error('[whatsapp-intent] unexpected error:', err);
    return NextResponse.json(
      { ok: false, error: 'internal' },
      { status: 500 }
    );
  }
}
