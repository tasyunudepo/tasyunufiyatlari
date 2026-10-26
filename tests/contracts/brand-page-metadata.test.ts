import { describe, expect, it, vi } from 'vitest';

// Sayfa modülü katalog sorgusunu da içe alır; başlık üretimi veritabanına dokunmaz.
vi.mock('@/lib/catalog/server', () => ({ getCatalogProductsByBrand: vi.fn() }));

import { BRAND_MAP, generateMetadata } from '@/app/marka/[brand]/page';

const metadataOf = (brand: string) => generateMetadata({ params: Promise.resolve({ brand }) });

// GCR kartı #8f2ad0 (Emrah onayı 14 Eki 2026): /marka/dalmacyali "dalmaçyalı" aramasında 783 gösterim, 0 tık;
// "dalmaçyalı fiyat listesi" aramasında 1,8. sıradan 12. sıraya geriledi. Başlık ve açıklama fiyat listesi niyetine
// göre yazıldı. Geri alma ölçütü kartta: bu iki sorguda sıra gerilerse eski başlık ve açıklama döner.
describe('marka sayfası başlık ve açıklaması', () => {
  it('Dalmaçyalı: başlık ve açıklama "fiyat listesi" ifadesini taşır', async () => {
    const meta = await metadataOf('dalmacyali');
    expect(meta.title).toBe('Dalmaçyalı Fiyat Listesi: Taşyünü ve EPS Levha');
    expect(meta.description).toBe(
      'Dalmaçyalı taşyünü ve EPS levha fiyat listesi. Kalınlık ve teslim iline göre tam kamyon veya TIR teslim fiyatını hesaplayın.',
    );
    expect(meta.alternates?.canonical).toBe('/marka/dalmacyali');
    expect(meta.openGraph?.title).toBe(meta.title);
    expect(meta.openGraph?.description).toBe(meta.description);
  });

  it('başlığa "resmi" ya da "yetkili" yazılmaz; site adı elle eklenmez', async () => {
    const meta = await metadataOf('dalmacyali');
    expect(String(meta.title)).not.toMatch(/resmi|yetkili/i);
    expect(String(meta.title)).not.toContain('|');
  });

  it('Dalmaçyalı sayfasında görünen tanıtım cümlesi değişmedi', () => {
    expect(BRAND_MAP.dalmacyali.description).toBe('Dalmaçyalı taşyünü ve EPS ısı yalıtım levhaları, sistem aksesuarları.');
  });

  it('diğer markaların başlık ve açıklaması aynı kaldı', async () => {
    // TEKNO marka sayfası 26 Ekim 2026'da kaldırıldı (Emrah kararı; /marka/tekno → /urunler, 301).
    expect(BRAND_MAP).not.toHaveProperty('tekno');
    for (const brand of ['filli-boya', 'optimix', 'oem']) {
      const meta = await metadataOf(brand);
      expect(meta.title).toBe(`${BRAND_MAP[brand].displayName} Ürünleri`);
      expect(meta.description).toBe(BRAND_MAP[brand].description);
    }
  });
});
