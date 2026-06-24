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
