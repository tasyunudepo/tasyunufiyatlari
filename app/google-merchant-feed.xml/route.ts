import { getMerchantFeedXml } from '@/lib/compare/merchantFeed.server';

// Google Merchant Center ürün beslemesi (14 Ekim 2026): taşyünü mantolama levhaları × kalınlık, satış birimi
// 1 tam kamyon, fiyat KDV dahil. Tam statik: derlemede üretilir, ürün sayfalarıyla aynı anda yenilenir.
// Adres "/feed" ile başlamaz: robots.txt "/feed" önekini kapatıyor.
export const dynamic = 'force-static';

export async function GET() {
  return new Response(await getMerchantFeedXml(), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
