# Taşyünü Fiyatları Edge Requests AUDIT

Tarih: 2026-05-31  
Kapsam: Vercel Edge Requests grafiğindeki `tasyunufiyatlari` anormal payı, yerel Next.js kodu, build çıktısı ve Vercel CDN fiyatlama mantığı.

## 1. Yönetici Özeti

Ekran görüntüsündeki son 30 gün verisine göre `tasyunufiyatlari` **307.858 Edge Request** üretmiş. Bu, günlük ortalama **10.262 request** demek. Görünen projeler içinde en yüksek pay onda: **%42,4**.

Karşılaştırma:

| Proje | 30 gün request | Günlük ort. | tasyunufiyatlari farkı |
|---|---:|---:|---:|
| tasyunufiyatlari | 307.858 | 10.262 | baz |
| erenservis | 206.476 | 6.883 | tasyunu **%49 daha yüksek** |
| betaozelservis | 71.702 | 2.390 | tasyunu **4,29 kat** |
| peugottuzla | 35.454 | 1.182 | tasyunu **8,68 kat** |
| dsgservisi | 41.330 | 1.378 | tasyunu **7,45 kat** |
| kurtkoyhaliyikama | 53.196 | 1.773 | tasyunu **5,79 kat** |

En kritik nokta: Vercel dokümanına göre Dashboard'daki Edge Requests, Vercel CDN'e gelen request sayısıdır; statik asset, statik HTML, SSR/function hepsi bu grafiğe girer. Yani sadece `force-static` yapmak Edge Request sayısını sıfırlamaz; Vercel'e gelen request sayısını azaltmak gerekir. Statik/ISR dönüşümü daha çok **Function/ISR Read/CPU** yükünü azaltır.

Resmi referanslar:

- Vercel CDN requests grafiği Edge Requests olarak görünür: https://vercel.com/docs/manage-cdn-usage
- Edge Requests bölgesel fiyatlaması: ilk 10M dahil, sonrası 1M request için $2.00-$3.20 aralığı: https://vercel.com/docs/pricing/regional-pricing
- Vercel CDN cache, `Cache-Control`, `s-maxage`, `Vercel-CDN-Cache-Control` ile yönetilir: https://vercel.com/docs/caching/cdn-cache

## 2. Mevcut Durum

Build doğrulaması:

```text
npm run build
✓ Compiled successfully
✓ Generating static pages (296/296)

○ /urunler                      Static
● /urunler/[kategori]           SSG
● /marka/[brand]                SSG
● /marka/[brand]/[kategori]     SSG
● /urunler/[kategori]/[slug]    SSG
● /urunler/[kategori]/[slug]/[kalinlik] SSG
ƒ Proxy (Middleware)
```

Final doğrulama: `DETAIL_30d_COUNT=0`.

Halihazırda iyi olanlar:

| Alan | Durum | Etki |
|---|---|---|
| `next.config.ts` image optimization | `images.unoptimized: true` | Vercel image transformation limitini koruyor |
| `/urunler`, `/marka`, kategori hub'ları | Kullanıcı değişikliğiyle `force-static` olmuş | ISR read/function yükü düşmüş |
| `sitemap.xml` | `force-static` olmuş | Botların sitemap çağrısı function üretmiyor |
| Header ana logo/CTA | Bazı kritik linklerde `prefetch={false}` var | Kısmi Edge request tasarrufu |
| Proxy matcher | Tüm siteyi değil belirli legacy/admin rotaları kapsıyor | Önceki geniş middleware riskinden daha iyi |

## 3. Kök Neden Sınıflandırması

### A. Edge Request'i doğrudan artıranlar

1. **Next Link prefetch açık kalan ürün kartları — kapatıldı**

`components/catalog/ProductCard.tsx` içinde ürün kartı linklerinde `prefetch={false}` yoktu. Ürün liste/grid sayfalarında çok sayıda kart viewport'a girdikçe Next.js route/RSC prefetch isteği oluşturabiliyordu. Bu çalışma ile ürün kartı linkinde prefetch kapatıldı.

Kanıt: `components/catalog/ProductCard.tsx:23-25`

Tahmini etki: **%15-30 Edge Request düşüşü**  
Durum: **Uygulandı.** Risk düşük; sadece navigasyon ön yüklemesi kapanır, tıklanınca sayfa normal açılır.

2. **Breadcrumb ve iç linklerde prefetch açık — kapatıldı**

Ürün detay, marka ve kategori sayfalarında breadcrumb `Link` bileşenleri çoğunlukla default prefetch ile kalmıştı. Trafiği yüksek katalog yapısında bu, her sayfa görüntülemede fazladan route asset/RSC isteği doğurabilirdi. Bu çalışma ile katalog/marka/header/footer iç gezinme linklerinde prefetch kapatıldı; dönüşüm CTA'ları hızlı kalması için korunmuştur.

Kanıt:

- `app/urunler/[kategori]/[slug]/page.tsx:378-383`
- `app/marka/[brand]/page.tsx:125-142`
- `app/marka/[brand]/[kategori]/page.tsx:59-91`

Tahmini etki: **%5-12 Edge Request düşüşü**  
Durum: **Uygulandı.** Risk düşük.

3. **Bot ve eski WordPress URL trafiği Vercel'e kadar geliyor**

`proxy.ts` eski WordPress URL'lerini 301/410 ile temizliyor; bu SEO için iyi. Fakat bu request Vercel'e ulaştığı anda Edge Request sayılmış oluyor. Özellikle `/wp-admin`, `/xmlrpc.php`, `/*.php`, `/feed` gibi bot hedefleri Vercel içinde yakalandığı için Edge sayaçta kalır.

Kanıt: `proxy.ts:53-64`, `proxy.ts:193-212`

Tahmini etki: **%5-20 Edge Request düşüşü**  
Çözüm için Vercel içi proxy değil, Vercel öncesi katman gerekir: Cloudflare/WAF/cache rule.

4. **Faceted/query URL temizliği tüm public URL'leri kapsamıyor**

`LEGACY_QUERY_PARAMS` listesi vardı, ama matcher ağırlıklı legacy path'leri kapsıyordu. Bu çalışma ile legacy WooCommerce query paramları için query bazlı proxy matcher eklendi; normal katalog sayfaları middleware'e sokulmadan, sadece bu paramlar geldiğinde public URL canonical 301'e yönlenir.

Kanıt:

- Param listesi: `proxy.ts:3-18`
- Matcher kapsamı: `proxy.ts:193-212`

Tahmini etki: **%3-12 Edge Request düşüşü**  
Durum: **Uygulandı.** UTM/GA paramları korunur; sadece eski WooCommerce/faceted paramları temizlenir.

5. **Sentry tunnel `/monitoring` Vercel request'i üretir — kaldırıldı**

Başlangıçta `next.config.ts` içinde `tunnelRoute: '/monitoring'` açıktı. Sentry aktif kullanılmadığı için bu entegrasyon tamamen kaldırıldı: `@sentry/nextjs` bağımlılığı, `withSentryConfig`, `instrumentation.ts` ve `sentry.*.config.ts` dosyaları silindi.

Durum:

- `/monitoring` tunnel artık yok.
- Client/server/edge Sentry init artık yok.
- Sentry source map upload env değişkenleri `.env.example` içinden çıkarıldı.

Tahmini etki: **%1-6 Edge Request düşüşü**  
Risk: Düşük. Sentry kullanılmadığı için gözlem kaybı pratikte yok; hata takibi gerekiyorsa Vercel logs veya ileride daha hafif bir çözüm tercih edilebilir.

### B. Edge Request sayısını değil, Vercel compute/ISR yükünü azaltanlar

1. **Ürün detay ve kalınlık detayları `force-static` — tamamlandı**

Önceki build çıktısı bu route'ları `Revalidate 30d` gösteriyordu. Aylık deploy stratejisi olduğu için ürün detay ve kalınlık detayları `dynamic = 'force-static'` yapıldı. `unstable_cache` içindeki zaman bazlı `revalidate` de kaldırıldı; sadece tag bazlı invalidation kaldı.

Kanıt:

- `app/urunler/[kategori]/[slug]/page.tsx:29-30`
- `app/urunler/[kategori]/[slug]/[kalinlik]/page.tsx:10`

Tahmini Edge Request düşüşü: **%0-3**  
Tahmini ISR/Function/CPU düşüşü: **%10-25**  
Durum: **Uygulandı ve doğrulandı.** `DETAIL_30d_COUNT=0`; fiyat güncelleme ay başı deploy'a bağlı kalır, acil fiyat değişikliklerinde manuel deploy gerekir.

2. **Public catalog API route'ları dynamic — CDN cache eklendi**

`/api/catalog/products` ve `/api/catalog/products/[slug]` `force-dynamic`. Kodda sayfalar artık server-side repository ile veri çekiyor; bu API'ler public client tarafından aktif kullanılmıyor gibi görünüyor. Bot taraması veya eski client çağrıları varsa function maliyeti oluşturur.

Kanıt:

- `app/api/catalog/products/route.ts:13`
- `app/api/catalog/products/[slug]/route.ts:14`
- Public pages `getCatalogProducts/getCatalogProduct` kullanıyor.

Tahmini Edge Request düşüşü: **%1-5**  
Tahmini Function düşüşü: **%3-10**  
Durum: **Uygulandı.** Başarılı public catalog API yanıtlarına `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` eklendi; 404/admin/quote/upload/import/whatsapp yanıtlarına cache eklenmedi.

## 4. Öncelikli Çözüm Tablosu

| Öncelik | Öneri | Edge Request düşüşü | Compute/ISR düşüşü | Risk | Not |
|---:|---|---:|---:|---|---|
| P0 | Cloudflare ön cache: public GET HTML/RSC/static asset cache, `/api`, `/ofis`, quote/admin hariç | **%40-80** | %20-50 | Orta | Runbook hazır; DNS/Cloudflare tarafında uygulanacak |
| P1 | Ürün kartları ve katalog iç linklerinde `prefetch={false}` standardı | **%15-30** | %5-15 | Düşük | Tamamlandı |
| P1 | Bot/legacy URL'leri Cloudflare seviyesinde block/cache/redirect | **%5-20** | %5-20 | Düşük-Orta | Runbook hazır; Vercel proxy'den önce kesilmeli |
| P2 | WooCommerce query param temizlik kapsamını public route'lara genişlet | **%3-12** | %2-8 | Orta | Tamamlandı; UTM/GA paramları korunur |
| P2 | Ürün detay + kalınlık detaylarını aylık deploy stratejisine göre `force-static` yap | **%0-3** | **%10-25** | Orta | Tamamlandı; `DETAIL_30d_COUNT=0` |
| P2 | Public catalog API'lere cache header veya kaldırma | **%1-5** | **%3-10** | Düşük-Orta | Cache header tamamlandı |
| P3 | Sentry entegrasyonunu kaldır | **%1-6** | %1-4 | Düşük | Tamamlandı; `/monitoring` tunnel yok |
| P3 | `robots.ts`: `/api` tamamını, legacy param URL'lerini ve WP kalıntılarını daha sert disallow | **%1-4** | %1-3 | Düşük | Tamamlandı; kötü botları durdurmaz, iyi botları yönlendirir |

Toplam beklenen düşüş senaryoları:

| Senaryo | Uygulananlar | 307.858 request sonrası tahmin |
|---|---|---:|
| Sadece kod içi hızlı paket | prefetch kapatma + query temizliği + API cache | **190k-245k** |
| Bot/legacy de ele alınır | hızlı paket + Cloudflare bot/legacy kuralları | **150k-220k** |
| Tam edge optimizasyonu | Cloudflare cache + bot rules + prefetch + API/cache | **60k-150k** |

## 5. Uygulama Planı

### Faz 1: Hızlı ve güvenli kod değişiklikleri

1. `ProductCard` linkine `prefetch={false}` eklendi.
2. Breadcrumb ve katalog iç linklerinde `prefetch={false}` standardı uygulandı.
3. `robots.ts` içinde `/piyasa`, `/ofis`, `/api`, `/wp-admin`, `/wp-content`, `/wp-includes`, `/*.php`, feed ve XML-RPC yüzeyleri disallow edildi.
4. `/api/catalog/products*` uçlarına kısa CDN cache header eklendi.

Beklenen sonuç: **%18-35 Edge Request düşüşü**.

### Faz 2: ISR/compute azaltma

1. `/urunler/[kategori]/[slug]` ve `/urunler/[kategori]/[slug]/[kalinlik]` route'larında `revalidate` yerine `dynamic = 'force-static'`.
2. Aylık deploy hook zaten mevcut olduğu için fiyat snapshot tazeliği deploy ile yenilenir.
3. Acil fiyat güncelleme prosedürü: admin fiyat import sonrası manuel Vercel deploy hook.

Beklenen sonuç: Edge Request tarafında sınırlı, ama **ISR/Function maliyetinde %10-25 düşüş**.

### Faz 3: Vercel öncesi azaltma

Detaylı operasyon dokümanı: `CLOUDFLARE_EDGE_REDUCTION_RUNBOOK_2026-05-31.md`

Cloudflare kullanılıyorsa:

1. DNS proxy aktif.
2. Cache rule:
   - Cache: `GET`, host `www.tasyunufiyatlari.com`
   - Include: `/`, `/urunler*`, `/marka*`, `/hakkimizda`, `/iletisim`, `/depomuz`, `/_next/static/*`, statik görseller
   - Exclude: `/api/*`, `/ofis*`, preview/deploy URL'leri
   - Edge TTL: 1 saat - 1 gün; Browser TTL kısa tutulabilir.
3. WAF/bot rule:
   - Block/challenge: `/wp-admin*`, `/wp-login.php`, `/xmlrpc.php`, `/*.php`, `/feed*`
   - Cache/redirect: eski `/kategori/*`, `/shop*`, `/product-brands/*`

Beklenen sonuç: **%40-80 Edge Request düşüşü**.

## 6. İzleme Planı

Değişikliklerden sonra 48 saat şu metriklere bakılmalı:

| Metrik | Hedef |
|---|---|
| Vercel Edge Requests / project | `tasyunufiyatlari` günlük 10.2k -> önce 7k altı, sonra 4k altı |
| Vercel Edge Requests / region | Bot trafiği varsa tek/birkaç bölgede yoğunluk düşmeli |
| Vercel Functions | Public catalog API ve admin dışı function çağrıları düşmeli |
| ISR Reads | Ürün detay force-static sonrası belirgin düşmeli |
| Analytics page_view | Gerçek kullanıcı trafiği düşmemeli |
| Search Console crawl stats | 404/redirect ve query URL taraması düşmeli |

## 7. Son Karar

Bu projede Edge Request yüksekliği tek bir bug değil; katalog yapısı çok linkli olduğu için Next prefetch + bot/legacy tarama + Vercel'e kadar gelen statik isteklerin toplamı. Kod içi en mantıklı ilk hamle `prefetch={false}` standardı ve public API/cache temizliği. Fakat Vercel Edge Request grafiğini dramatik düşürmek için asıl kaldıraç **Vercel'in önünde cache/bot katmanı** kurmak.

Pratik hedef:

- Kısa vadede: **307.858 -> 190-245k**.
- Cloudflare ile: **307.858 -> 60-150k**.
- ISR/compute tarafında ayrıca: **%10-25** ek rahatlama.
