# Proje: tasyunufiyatlari.com

**Kök:** `~/projeler/aktif/tasyunufiyatlari`
**Wing (mempalace):** `tasyunufiyatlari`
**Tür:** Web (Next.js 14 App Router + Supabase + Vercel)
**Kısayol:** tüyo, taşyünü, EPS, levha, hesaplayıcı

## Repo kaynak envanteri

| Konu | Dosya |
|---|---|
| Proje yerel kurallar (Türkçe standardı) | `CLAUDE.md` |
| Proje bağlamı (iş modeli, iskonto, paket sistemi) | `PROJE_BAGLAM_v2.md` |
| Mimari (nakliye kuralları, schema, node zinciri) | `SYSTEM_ARCHITECTURE.md` |
| Domain model (MaterialType, ShippingZone, LogisticsCapacity) | `lib/types/index.ts` |
| Fiyat hesaplama motoru (shippingCost, isPriceFinal) | `lib/package-engine/calcPricing.ts` |
| Wizard (4 adım hesaplayıcı) | `components/wizard/WizardCalculator.tsx`, `WizardStep1-4.tsx` |
| PDP fiyat paneli (ürün detay) | `components/catalog/ProductPricePanel.tsx` |
| Sonuç kartları (3 paket) | `components/package/PackageCard.tsx` |
| GA4 event taksonomisi | `lib/notifyWizardEvent.ts`, `lib/analytics/whatsappSource.ts` |
| PDF modal | `components/modal/PdfOfferModal.tsx` |
| Admin panel | `app/ofis/`, `ADMIN_PANEL_OZETI.md` |
| SEO baseline | `_audit/seo-baseline-2026-05.md` |
| Edge/performans | `EDGE_REQUESTS_AUDIT_2026-05-31.md` |

## Domain kuralları

### Ödeme

- Ödeme **tek seferde** alınır. Kapora, ön ödeme, peşinat, taksit mekanizması
  YASAK. Müşteri tüm tutarı sipariş onayında öder.
- app/page.tsx:45 FAQ cevabındaki "kapora oranı" ifadesi yanlıştır.

### İskonto ve nakliye (taşyünü levha)

- Tam dolu kamyon veya tam dolu TIR siparişinde iskonto + nakliye fiyata
  dahildir. Bu **koşul-gerçeği**, vaat değildir.
- Genel oranlar: %14 kamyon, %18 TIR; marka/modele göre değişir.
- Low metrage → iskonto TIR seviyesinde kalır ama **nakliye alıcıya aittir**.
  UI/PDF'te uyarı zorunlu.
- "Nakliye ücretsiz" yazıyorsa yanına koşul yaz. "Ücretsiz" yerine "fiyata
  dahildir" tercih edilir.

### EPS kuralı

- EPS minimum sipariş metrajı `material_types.min_order_m2` (varsayılan 250 m²).
- EPS kademeli marjı (`tier1/tier2/tier3`) hesaplamada vardır, UI'da gösterilmez.
  Analiz yaparken bu tespiti yapabilirsin; kullanıcı istemeden tier oranlarını
  müşteri metnine taşıma.

### Tam araç zorunluluğu (taşyünü)

- Tam Kamyon / tam TIR / N×Kamyon + M×TIR kombinasyonları geçerli metrajlardır.
- Ara metraj için snap önerisi gösterilir (örn. 806 m², 1200 m², 2400 m²).
- Bu kural kullanıcıya "yukarı yuvarlama neden gerekli" sorusunu açıklayan
  temel mantıktır.

## Yasak vaat ifadeleri (müşteri görünen metinde YASAK)

- "fiyatı kilitle", "malı ayır", "kapora gönder"
- "ücretsiz nakliye" (koşulsuz — koşul görünür olmalı)
- "yarın sevkiyat", "24 saatte teslim", "aynı gün kargo"
- "3D Secure ile öde", "sanal POS", "taksitli ödeme"
- "kesin iskonto", "garanti fiyat", "sabit fiyat" (24 saatlik dahil)

**Neden:** Bu vaatlerin çoğu altyapısı olmayan sözlerdir; müşteri deneyimi
kırılır, hukuki risk oluşur.

## Türkçe standardı

- Kullanıcıya görünen metinde `ç, ğ, ı, İ, ö, ş, ü` doğru kullanılır.
- Bozuk yazım kabul edilmez: `sekilde`, `cikariyor`, `isteyisin`, `TÜrkçe`,
  `MEsela`, `emsela`.
- Kod adları (API, component, event) Türkçeleştirilmez.
- Bkz. `CLAUDE.md`.

## Bilinen teknik borçlar (aktif)

- URL parsing `?kalinlik=7.5cm` için parseInt kullanılıyor; 7.5 cm'lik
  kalınlıklar 7 olarak parse ediliyor ([ProductPricePanel.tsx:3-6](components/catalog/ProductPricePanel.tsx#L3-L6)).
- `quoteRes.ok` kontrolü başarısızlıkları sessiz yutuyor
  ([SingleProductQuoteButton.tsx:179](components/catalog/SingleProductQuoteButton.tsx#L179)).
- PDP'de `Fiyat_Gosterildi` event'i tetiklenmiyor — funnel asimetrisi.
- `lib/package-engine/calcPricing.ts` daha temiz bir model sunuyor (shippingCost:
  number | null, shippingMode enum, isPriceFinal) ama Wizard tarafı bunu
  kullanmıyor.

## Bilinen mevzuat/uyumluluk notları

- KDV: Türkiye'de %20. UI'da her zaman "KDV hariç" etiketi zorunlu.
- KVKK: Müşteri form verisi işlenmeden önce onay zorunlu. PDF ve WhatsApp
  modalında checkbox var.
- SEO: Tek @graph altında Organization + Product + FAQ + HowTo schema'ları.
  Schema.org tek doğruluk kaynağı `lib/business/info.ts`.
