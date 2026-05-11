# tasyunufiyatlari.com — Teknik SEO Durum Tespiti

**Tarih:** 2026-05-10
**Mod:** Plan Mode (raporlama, kod yazılmadı)
**Kapsam:** Dosya seviyesinde envanter, 12 başlık altında durum + dosya/satır referansı + risk.

> **Not:** Bu rapor sadece statik kod analizine dayanır. Production runtime, gerçek bot trafiği, Google Search Console verileri ve canlı sitemap doğrulaması bu rapora dahil değildir.

---

## 1. URL Mimarisi

| Konu | Durum | Referans / Açıklama |
|---|---|---|
| Router | ✅ Var | Next.js App Router · `next@^16.1.7`, React `19.2.1` ([package.json:23-27](../package.json#L23-L27)) |
| Pages Router kalıntısı | ✅ Yok | `app/` klasörü tek otorite, `pages/` yok |
| Ürün dynamic route | ✅ Var | [app/urunler/[kategori]/[slug]/page.tsx](../app/urunler/[kategori]/[slug]/page.tsx) — `params: Promise<{ kategori: string; slug: string }>` |
| Kategori dynamic route | ✅ Var | [app/urunler/[kategori]/page.tsx](../app/urunler/[kategori]/page.tsx) |
| Marka dynamic route | ✅ Var | [app/marka/[brand]/page.tsx](../app/marka/[brand]/page.tsx), [app/marka/[brand]/[kategori]/page.tsx](../app/marka/[brand]/[kategori]/page.tsx) |
| Bölge dynamic route | ⚠️ Eksik | [app/bolge/[sehir]/[ilce]/page.tsx](../app/bolge/[sehir]/[ilce]/page.tsx) — `dynamicParams` kontrolü yok, herhangi bir kombinasyon 200 dönüyor (doorway risk) |
| Legacy ürün redirect | ✅ Var | [app/urun/[slug]/page.tsx](../app/urun/[slug]/page.tsx) — `PREFIX_MAP` ile 16 prefix + `keywordFallback` |
| Slug kaynağı | ✅ Var | Supabase DB · `plates.slug`, `accessories.slug` ([lib/catalog/server.ts:88-104](../lib/catalog/server.ts#L88-L104)) |
| Slug kategori sözlüğü | ✅ Var | Statik map · [lib/catalog/categories.ts:15-73](../lib/catalog/categories.ts#L15-L73) |
| Slug Türkçe karakter | ✅ Yok | Tüm slug'lar ASCII (`tasyunu-levha`, `eps-levha`, `siva`, `yapistirici`, `fileli-kose-profilleri`). Türkçe karakterli slug grep'te bulunmadı. |
| Kalınlık varyantı URL | ⚠️ Query | `?kalinlik=N` query param ([app/urunler/[kategori]/[slug]/page.tsx:131-137](../app/urunler/[kategori]/[slug]/page.tsx#L131-L137)). Ayrı URL/sayfa yok — canonical buna işaret etmiyor (parametre stripped, doğru), kalınlığa özel SERP tıklama kaybı potansiyeli var. |

**Risk:** Orta — bölge sayfası açık uçlu, sahte içerik servis ediyor (bkz. §12).

---

## 2. Eski URL → Yeni URL Migration

| Konu | Durum | Referans |
|---|---|---|
| `next.config.ts` redirects | ✅ Var | [next.config.ts:41-78](../next.config.ts#L41-L78) — toplam **17 adet** kalıcı 301 |
| `vercel.json` redirects | ✅ Yok | [vercel.json](../vercel.json) sadece `regions: ["fra1"]` içeriyor — Next config tek otorite (doğru) |
| Legacy WP `/urun/...` slug catch-all | ✅ Var | [app/urun/[slug]/page.tsx](../app/urun/[slug]/page.tsx) — runtime `permanentRedirect` |

### Örnek 5 redirect ([next.config.ts:43-77](../next.config.ts#L43-L77))

```
/kategori/tasyunu-levhalar     → /urunler/tasyunu-levha     (301)
/kategori/dubeller             → /urunler/dubel             (301)
/kategori/yapistiricilar       → /urunler/yapistirici       (301)
/marka/fawori                  → /marka/filli-boya          (301)
/shop                          → /urunler                   (301)
```

### Eski WP pattern karşılığı

- `/kategori/<x>` ✅ — 9 alt kategori karşılanmış.
- `/urun/<full-slug>` ✅ — `app/urun/[slug]/page.tsx` PREFIX_MAP + keyword fallback ile `permanentRedirect`. 16 prefix tanımlı; eşleşmeyen slug için `keywordFallback` kategori sayfasına atıyor.
- `/shop`, `/shop/page/N` ✅ — `next.config.ts:73-74`.
- `/tasyunu-eps-depo` ✅ — `next.config.ts:75-76`.
- `/marka/fawori`, `/marka/filli-boya/expert` ✅ — alias yakalama [next.config.ts:66-69](../next.config.ts#L66-L69).
- Bireysel WP ürün URL'leri için `app/urun/[slug]/page.tsx` PREFIX_MAP'inde **sadece 16 ana prefix** var. WP'de daha fazla varyant olabilir — production logs / GSC'de 404 sayısı izlenmeli.

**Risk:** Düşük (kapsam mantıklı) · Orta (production 404 telemetrisi yok, kapsam doğrulanmamış).

---

## 3. Sitemap & Robots

| Konu | Durum | Referans |
|---|---|---|
| Dynamic sitemap | ✅ Var | [app/sitemap.ts](../app/sitemap.ts) — Next MetadataRoute |
| `public/sitemap.xml` statik | ✅ Yok | Yalnızca dynamic — doğru |
| robots dosyası | ✅ Var | [app/robots.ts](../app/robots.ts) |
| Canonical sitemap link | ✅ Var | `https://www.tasyunufiyatlari.com/sitemap.xml` ([app/robots.ts:12](../app/robots.ts#L12)) |

### Sitemap içeriği

- **Statik (6):** `/`, `/urunler`, `/hakkimizda`, `/iletisim`, `/depomuz`, `/kvkk` ([app/sitemap.ts:8-15](../app/sitemap.ts#L8-L15)).
- **Kategoriler (9):** `KATEGORI_MAP` keys → `tasyunu-levha`, `eps-levha`, `dubel`, `yapistirici`, `siva`, `file`, `fileli-kose-profilleri`, `astar`, `kaplama` ([app/sitemap.ts:38-45](../app/sitemap.ts#L38-L45)).
- **Markalar (5):** `dalmacyali`, `filli-boya`, `optimix`, `tekno`, `oem` ([app/sitemap.ts:19](../app/sitemap.ts#L19)).
- **Plate ürün detayları:** Supabase'den `is_active = true` ([app/sitemap.ts:58-77](../app/sitemap.ts#L58-L77)).
- **Aksesuar ürün detayları:** Supabase'den ([app/sitemap.ts:83-107](../app/sitemap.ts#L83-L107)).

### Sitemap'te dışlanan

- `/piyasa` ✅ (mock data — bkz §12).
- `/ofis`, `/api/admin` ✅ (admin paneli).
- `/bolge/<sehir>/<ilce>` ✅ — sitemap'te yok ama route 200 dönüyor; başka sayfalardan link yok ama keşfedilebilir → noindex disiplini önerilir.
- `/marka/<brand>/<kategori>` ⚠️ — sitemap'te yok ama route var. Marka altı kategori sayfaları indekslenmiyor.

### Robots

```
User-agent: *
Allow: /
Disallow: /piyasa, /ofis, /api/admin
Sitemap: https://www.tasyunufiyatlari.com/sitemap.xml
```

- ✅ `/ofis`, `/api/admin` blok.
- ✅ `/piyasa` blok (mock data).
- ❌ Query param disiplin yok: `?kalinlik=`, `?utm_*` için Disallow yok. Ürün detay `generateMetadata` içinde canonical kalınlık parametresini strip ediyor ([lib/seo/buildMetadata.ts:39](../lib/seo/buildMetadata.ts#L39), `path` param'ından geliyor, query yok) — **canonical disiplini var**, ek robots disallow gerekmeyebilir, ama Disallow `*?kalinlik=*` ekstra savunma olur.
- ❌ `/bolge/*` Disallow değil.

**Risk:** Orta — `/bolge/*` doorway, sitemap'te marka×kategori alt sayfaları eksik.

---

## 4. Metadata & Title/Description

| Konu | Durum | Referans |
|---|---|---|
| Merkezi helper | ✅ Var | [lib/seo/buildMetadata.ts:32-72](../lib/seo/buildMetadata.ts#L32-L72) |
| `metadataBase` | ✅ Var | [app/layout.tsx:28](../app/layout.tsx#L28) — `https://www.tasyunufiyatlari.com` |
| Title template | ✅ Var | `%s | Taşyünü Fiyatları` ([app/layout.tsx:30-33](../app/layout.tsx#L30-L33)) |
| Default description | ✅ Var | [app/layout.tsx:34-35](../app/layout.tsx#L34-L35) |
| Default OG | ✅ Var | `/og-image.png` 1200×630 dosya mevcut ([app/layout.tsx:39-55](../app/layout.tsx#L39-L55)) |
| Twitter card | ✅ Var | summary_large_image ([app/layout.tsx:56-62](../app/layout.tsx#L56-L62)) |
| Icons | ✅ Var | favicon.webp ([app/layout.tsx:63-69](../app/layout.tsx#L63-L69)) |

### `generateMetadata` kullanan sayfalar

- ✅ `/urunler/[kategori]/[slug]` ([:91-103](../app/urunler/[kategori]/[slug]/page.tsx#L91-L103)) — slug-bazlı OG, `meta_title`/`meta_description` DB'den, fallback brand+name
- ✅ `/urunler/[kategori]` ([:18-27](../app/urunler/[kategori]/page.tsx#L18-L27))
- ✅ `/marka/[brand]` ([:49-58](../app/marka/[brand]/page.tsx#L49-L58))
- ✅ `/bolge/[sehir]/[ilce]` ([:13-26](../app/bolge/[sehir]/[ilce]/page.tsx#L13-L26))

### Statik `metadata` export'u olan sayfalar

- ✅ `/urunler` ([:15-20](../app/urunler/page.tsx#L15-L20))
- ✅ `/hakkimizda` ([:15-21](../app/hakkimizda/page.tsx#L15-L21))
- ✅ `/iletisim` ([:35-41](../app/iletisim/page.tsx#L35-L41))
- ✅ `/depomuz` ([:21-26](../app/depomuz/page.tsx#L21-L26))
- ✅ `/kvkk` ([:19-24](../app/kvkk/page.tsx#L19-L24))

### Eksik metadata

- ❌ `/piyasa` — `metadata` export YOK ([app/piyasa/page.tsx](../app/piyasa/page.tsx)). Robots disallow olduğundan SEO kaybı yok ama tutarsızlık.
- ✅ `/` (home) — `app/layout.tsx` default'larıyla yetiniyor, `app/page.tsx` kendi metadata'sını export etmiyor; `"use client"` direktifi metadata export'una izin vermiyor (next.js zorunluluğu).

### Türkçe karakter encoding

- Tüm metadata Türkçe karakterli (Taşyünü, KDV hariç, vb.) → UTF-8 source dosyalar, layout `<html lang="tr">` ([app/layout.tsx:78](../app/layout.tsx#L78)). Bozuk encoding (`Ä±`, `Ã§`) görülmedi.
- OG image alt metni: `Fabrika çıkışlı taşyünü ve EPS mantolama — Kapı teslim PDF teklif` — Türkçe karakter doğru ([app/layout.tsx:52](../app/layout.tsx#L52)).

**Risk:** Düşük.

---

## 5. Schema.org / JSON-LD

| Schema türü | Durum | Nerede |
|---|---|---|
| Organization | ✅ Var (3 ayrı yerde) | [app/page.tsx:49-63](../app/page.tsx#L49-L63), [app/iletisim/page.tsx:43-62](../app/iletisim/page.tsx#L43-L62) (ContactPage altında), `buildLocalBusiness` legalName |
| LocalBusiness | ⚠️ Çoklu | [lib/seo/buildLocalBusiness.ts](../lib/seo/buildLocalBusiness.ts) (helper), [app/depomuz/page.tsx:28-56](../app/depomuz/page.tsx#L28-L56) (inline), [app/iletisim/page.tsx:298-305](../app/iletisim/page.tsx#L298-L305) (helper kullanıyor), [app/hakkimizda/page.tsx:182-185](../app/hakkimizda/page.tsx#L182-L185) (helper), [app/page.tsx:49-63](../app/page.tsx#L49-L63) (inline `["Organization","LocalBusiness"]`). **3 farklı LocalBusiness tanımı çakışıyor: home page, iletisim/hakkimizda (helper) ve depomuz (inline) — hepsi aynı şirket ama 3 ayrı `name`/adres alanıyla.** |
| Product | ✅ Var | [app/urunler/[kategori]/[slug]/page.tsx:162-181](../app/urunler/[kategori]/[slug]/page.tsx#L162-L181) — `Product` + nested `Offer` (varsa) |
| Offer | ✅ Var | Product içinde `availability: InStock`, `priceCurrency: TRY` |
| FAQPage | ✅ Var | [app/page.tsx:79-87](../app/page.tsx#L79-L87) — 6 soru |
| BreadcrumbList | ✅ Var | Helper [lib/seo/buildBreadcrumbList.ts](../lib/seo/buildBreadcrumbList.ts), kullanılıyor: ürün detay, kategori, bölge |
| WebApplication | ✅ Var | [app/page.tsx:65-77](../app/page.tsx#L65-L77) — Calculator için `BusinessApplication` |
| ContactPage | ✅ Var | [app/iletisim/page.tsx:43-62](../app/iletisim/page.tsx#L43-L62) |
| Brand | ⚠️ Kısmi | Sadece Product içinde nested (`brand: { '@type': 'Brand', name }`). Standalone Brand schema yok. |
| HowTo | ❌ Yok | Home page'de 3 adımlı `HOW_STEPS` var ama `HowTo` schema'ya bağlanmamış — AIO kaybı |
| Service | ❌ Yok | Mantolama hizmeti / sevkiyat hizmeti için Service schema yok |
| Speakable | ❌ Yok | AIO sinyali eksik |
| Person / Author | ❌ Yok | E-E-A-T author yok; hakkimizda'da `founder: 'Muhammet Öztürk'` LocalBusiness altında geçiyor ama Person schema değil |
| ImageObject | ❌ Yok | Tüm `image` alanları düz string (Product schema'da `image: [productImage]`) — width/height/caption zenginleştirme yok |
| Review / AggregateRating | ❌ Yok | Trust signal eksik |
| VideoObject | ❌ Yok | Video içerik yok zaten |

### `@graph` pattern

❌ Yok. Tüm schema'lar ayrı `<script type="application/ld+json">` tag'leri olarak basılıyor:
- [app/page.tsx:128-139](../app/page.tsx#L128-L139) — 3 ayrı script (Org, WebApp, FAQ)
- [app/urunler/[kategori]/[slug]/page.tsx:195-196](../app/urunler/[kategori]/[slug]/page.tsx#L195-L196) — Product + BreadcrumbList ayrı
- [app/iletisim/page.tsx:298-305](../app/iletisim/page.tsx#L298-L305) — ContactPage + LocalBusiness ayrı
- [app/hakkimizda/page.tsx:182-185](../app/hakkimizda/page.tsx#L182-L185) — sadece LocalBusiness

**`@graph` yapılsa entity'ler `@id` ile birbirine bağlanır** (Product → publisher LocalBusiness, Offer → seller Organization). Bu yapılmıyor → Knowledge Graph entity füzyonu zayıf.

### Schema fixture / builder

- ✅ `lib/seo/buildLocalBusiness.ts` (LocalBusinessSchema factory)
- ✅ `lib/seo/buildBreadcrumbList.ts`
- ❌ `buildBusinessNode()` canonical zinciri YOK
- ❌ `BUSINESS_REF` pointer pattern YOK
- ❌ Product/Service/HowTo factory yok — tüm schema inline

**Risk:** Kritik — duplicate LocalBusiness entity'leri, @graph yok, AIO için zayıf signal yapısı.

---

## 6. Canonical & hreflang

| Konu | Durum | Referans |
|---|---|---|
| Canonical helper | ✅ Var | [lib/seo/buildMetadata.ts:39-51](../lib/seo/buildMetadata.ts#L39-L51) |
| `metadataBase` | ✅ Var | [app/layout.tsx:28](../app/layout.tsx#L28) — relative path absolute'a çevriliyor |
| Self-referencing | ✅ Var | Her sayfa kendi `path` parametresiyle canonical üretiyor |
| Query param strip | ✅ Var | `path` argümanı her zaman query'siz veriliyor (örn. ürün detay: `/urunler/${kategori}/${slug}` — `?kalinlik` değişkeninden bağımsız) |
| Statik canonical | ✅ Var | `/depomuz` ve `/kvkk` `alternates: { canonical: '/kvkk' }` ([app/depomuz/page.tsx:25](../app/depomuz/page.tsx#L25), [app/kvkk/page.tsx:23](../app/kvkk/page.tsx#L23)) |
| hreflang | ✅ Yok | Türkçe-only site, gereksiz (doğru karar) |

**Risk:** Düşük.

---

## 7. Image Pipeline

| Konu | Durum | Referans |
|---|---|---|
| Image bileşeni | ✅ Var | `next/image` |
| Optimization | ⚠️ Kapalı | `unoptimized: true` ([next.config.ts:32](../next.config.ts#L32)) — Vercel image optimization devre dışı (Hobby tier 5K/ay limit kararı) |
| Remote pattern | ✅ Var | Supabase Storage `*.supabase.co/storage/v1/object/public/**` ([next.config.ts:33-39](../next.config.ts#L33-L39)) |
| Format | ⚠️ Yalnızca WebP | Tüm assets `.webp` (logo, hero, depo, hakkimizda). AVIF dönüşümü yok (`unoptimized` nedeniyle) |
| Hero priority | ✅ Var | Hakkımızda hero ([app/hakkimizda/page.tsx:97](../app/hakkimizda/page.tsx#L97)), depomuz hero ([app/depomuz/page.tsx:84](../app/depomuz/page.tsx#L84)), ürün detay ana görsel ([app/urunler/[kategori]/[slug]/page.tsx:286](../app/urunler/[kategori]/[slug]/page.tsx#L286)) |
| Home hero priority | ⚠️ Belirsiz | `app/page.tsx` hero'da `HeroSystemVisual` component'i kullanılıyor ([:165, 187](../app/page.tsx#L165-L187)); SiteHeader logo'da `priority` var ([components/shared/SiteHeader.tsx:129](../components/shared/SiteHeader.tsx#L129)) — H1 metin tabanlı, LCP element büyük ihtimalle metin |
| Lazy loading | ✅ Default | `priority` set edilmemiş tüm Image'lar lazy |
| Public assets | ✅ Var | `/public/tasyunu-logo.webp`, `/public/og-image.png`, `/hakkimizda/`, `/depo/`, `/images/markalogolar/` |

**Risk:** Düşük — `unoptimized: true` kasıtlı bir trade-off (CLAUDE.md'de gerekçe). Asset'ler önceden optimize edildi.

---

## 8. Performance Sinyalleri

| Konu | Durum | Referans |
|---|---|---|
| Bundle ölçümü | ❌ Yok | `npm run build` çıktısı bu raporda yok (statik analiz) |
| Home page render | ⚠️ All-client | [app/page.tsx:1](../app/page.tsx#L1) → `"use client"` — TÜM sayfa client component. RSC streaming/server JSON-LD avantajı kayıp. JSON-LD `dangerouslySetInnerHTML` client-side hydrate ediliyor (next.js initial HTML'a yine dahil eder, ama client cost var) |
| LCP element | ⚠️ Tahmin | Home: H1 metni (`text-[64px]`); ürün detay: `ProductImage` priority `aspect-[4/3]` |
| `"use client"` dağılımı | ⚠️ Geniş | 14 dosya: `app/page.tsx`, `app/providers.tsx`, tüm `app/ofis/tabs/*`. Admin paneli için kabul edilebilir; **home page için fazla** |
| `revalidate` / ISR | ✅ Var | Ürün detay 60s ([app/urunler/[kategori]/[slug]/page.tsx:23](../app/urunler/[kategori]/[slug]/page.tsx#L23)), `unstable_cache` logistics 1h ([:42-44](../app/urunler/[kategori]/[slug]/page.tsx#L42-L44)) |
| `force-dynamic` | ⚠️ Sadece admin | `app/ofis/layout.tsx:3` — admin paneli, doğru |
| Font stratejisi | ✅ Var | `next/font/google` — Geist Sans, Geist Mono, Barlow ([app/layout.tsx:2,11-25](../app/layout.tsx#L11-L25)). `latin-ext` Türkçe karakter destekli |
| GA loading | ✅ Var | `<Script strategy="beforeInteractive">` consent default + `afterInteractive` GA4 ([components/analytics/GoogleAnalytics.tsx:18-46](../components/analytics/GoogleAnalytics.tsx#L18-L46)) |
| Sentry | ✅ Var | `@sentry/nextjs@^10.51.0` — production CI'da source map upload, `tunnelRoute: '/monitoring'` ([next.config.ts:83-101](../next.config.ts#L83-L101)) |
| Source maps client'a | ✅ Yok | `deleteSourcemapsAfterUpload: true` ([:94](../next.config.ts#L94)) |
| Cache headers | ❌ Yok | `next.config.ts`'de `headers()` callback yok — statik dosyalar için `Cache-Control: immutable` tanımlı değil. Vercel default'ları yetebilir ama explicit değil |

**Risk:** Orta — Home page `"use client"` LCP/TBT ölçümü yapılmadan SEO etkisi tahmin edilemez; build çıktısı bu denetimde alınmadı.

---

## 9. Internal Linking

### Header navigation ([components/shared/SiteHeader.tsx:22-26](../components/shared/SiteHeader.tsx#L22-L26))

```
/urunler         → Ürün Kataloğu
/hakkimizda      → Hakkımızda
/iletisim        → İletişim
+ /              → Hesap Makinesi (CTA)
+ tel: + WhatsApp eylemleri
```

Mobil drawer: `+ /` (Anasayfa) eklenmiş ([:28-31](../components/shared/SiteHeader.tsx#L28-L31)).

### Footer ([components/shared/SiteFooter.tsx:11-45](../components/shared/SiteFooter.tsx#L11-L45))

| Grup | Linkler |
|---|---|
| Ürünler | `/`, `/urunler`, `/urunler/tasyunu-levha`, `/urunler/eps-levha` |
| Kurumsal | `/hakkimizda`, `/depomuz`, `/marka/dalmacyali` (✋ tek marka) |
| İletişim | `/iletisim`, `wa.me/...`, `mailto:` |
| Yasal | `/kvkk`, **`/iletisim` (Çerez Politikası)** ❌, **`/iletisim` (Kullanım Koşulları)** ❌ |

❌ **Çerez Politikası ve Kullanım Koşulları her ikisi de `/iletisim`'e link** ([SiteFooter.tsx:41-42](../components/shared/SiteFooter.tsx#L41-L42)) — gerçek sayfalar yok, kullanıcıyı yanlış yere atıyor.

⚠️ **Markalar grubu**: footer'da sadece `/marka/dalmacyali` linki var; Filli Boya / Optimix / TEKNO / Ekonomik markaları görünmez. Hub yok.

### Breadcrumb

- ✅ Ürün detay sayfası: visible breadcrumb + BreadcrumbList schema ([app/urunler/[kategori]/[slug]/page.tsx:200-213, 183-191](../app/urunler/[kategori]/[slug]/page.tsx))
- ✅ Kategori sayfası: visible + schema ([app/urunler/[kategori]/page.tsx:60-66, 39-46](../app/urunler/[kategori]/page.tsx))
- ✅ Marka sayfası: visible breadcrumb ([app/marka/[brand]/page.tsx:86-92](../app/marka/[brand]/page.tsx#L86-L92)) ama **schema yok**
- ✅ Bölge sayfası: BreadcrumbList schema var ([app/bolge/[sehir]/[ilce]/page.tsx:41-47](../app/bolge/[sehir]/[ilce]/page.tsx#L41-L47)) ama görsel breadcrumb yok
- ❌ Hakkımızda / İletişim / Depomuz / KVKK breadcrumb yok

### Calculator → ürün/kategori contextual link

⚠️ **Hesap sonrası link kontrolü:** WizardCalculator paket sonuç ekranı `PackageCard` döndürüyor; o card'larda kalınlık/marka detay sayfasına link `WizardLinkButton` ile ters yönde (ürün → wizard). Ürün/kategori detay sayfasına geri dönüş **otomatik link yok**. Kullanıcı PDF aldıktan sonra catalog ürün sayfasına sadece header CTA ile dönüyor.

### Marka altı kategoriler

- ✅ `/marka/[brand]/[kategori]` route mevcut ([app/marka/[brand]/[kategori]/page.tsx](../app/marka/[brand]/[kategori]/page.tsx))
- ⚠️ Sitemap'te yok (§3) — discover edilmesi zor

**Risk:** Orta — yasal sayfa linkleri kırık (UX/güven), marka hub footer eksik, breadcrumb dağılımı tutarsız.

---

## 10. Form & Conversion

### SepetUI v2 / WizardCalculator form alanları

PDF teklif modal ([components/modal/PdfOfferModal.tsx](../components/modal/PdfOfferModal.tsx)):
- Ad Soyad ✅ (zorunlu)
- Telefon ✅ (zorunlu, tel pattern)
- Şehir ✅
- Firma (opsiyonel)
- İlçe (opsiyonel)
- E-posta (opsiyonel)
- Adres (opsiyonel)
- KVKK consent checkbox ✅

WhatsApp Quote modal ([components/wizard/WizardCalculator.tsx:1493-1568](../components/wizard/WizardCalculator.tsx#L1493-L1568)):
- Aynı set, KVKK consent ✅

### Form gönderim flow

`POST /api/quotes` ([app/api/quotes/route.ts](../app/api/quotes/route.ts)):
1. Zod validation (`apiQuoteSchema` [lib/schemas/quote.schema.ts](../lib/schemas/quote.schema.ts))
2. `catalog` channel için server-side tier eligibility (kamyon/TIR minimum m²) doğrulaması ([:62-87](../app/api/quotes/route.ts#L62-L87))
3. Supabase `quotes` tablosuna insert
4. `quote_funnel_events` analytics insert
5. `sendNotification(...)` → CallmeBot WhatsApp (await zorunlu — Vercel serverless context tutsun diye)
6. Response: `{ ok, quoteId, createdAt }`

### KVKK consent UI ve backend kaydı

- ✅ UI: hem PdfOfferModal hem QuoteModal hem WizardCalculator quote modal'da checkbox ([WizardCalculator.tsx:1549-1568](../components/wizard/WizardCalculator.tsx#L1549-L1568))
- ✅ Schema: `kvkkConsent: boolean` ([lib/schemas/quote.schema.ts](../lib/schemas/quote.schema.ts), Zod parse)
- ⚠️ Backend persist: `mapQuotePayload` içinde `kvkk_consent` kolonu **görülmedi**. `apiQuoteSchema`'ya consent zorunlu olarak validate ediliyor olabilir ama DB'ye yazılıyor mu — `quotes` tablo şeması bu raporda doğrulanmadı.

### Conversion event tracking

- ✅ GA4 tag: `G-VCHRKVJCEN` ([app/layout.tsx:9](../app/layout.tsx#L9))
- ✅ Consent Mode v2 ([components/analytics/GoogleAnalytics.tsx:22-31](../components/analytics/GoogleAnalytics.tsx#L22-L31)) — ad_storage default DENIED, **analytics_storage default GRANTED** ⚠️ (KVKK strict ise tartışmalı)
- ✅ Pageview tracking ([components/analytics/GAPageviewTracker.tsx](../components/analytics/GAPageviewTracker.tsx))
- ✅ Custom events: `notifyWhatsappIntent`, `notifyPhoneCall`, `notifyWizardEvent` ([lib/notifyWhatsappIntent.ts](../lib/notifyWhatsappIntent.ts), vb.)
- ✅ DB-side funnel: `quote_funnel_events` tablosu
- ❌ Plausible / Meta Pixel yok
- ❌ **CookieConsent component MOUNT EDİLMEMİŞ**: [components/analytics/CookieConsent.tsx](../components/analytics/CookieConsent.tsx) tanımlı ama `app/layout.tsx`'te render edilmiyor. Kullanıcı için consent değiştirme UI'ı yok → **KVKK riski**: ad çerezleri default DENY iyi ama analytics_storage default GRANTED + UI'sız = "açık rıza" kanıtı zayıf.

### WhatsApp intent tracking

✅ Ayrı API route: [app/api/whatsapp-intent/route.ts](../app/api/whatsapp-intent/route.ts) — IP+source rate limit (60s/1), bot UA filtresi, Zod validation. Header / Footer / Sepet WhatsApp linkleri buradan loglanıyor.

**Risk:** Orta — KVKK consent UI eksik (hızlıca CookieConsent mount edilmeli); kvkk_consent DB kolonu doğrulaması yapılmadı.

---

## 11. Brand & Multi-Site Hooks

### ÖZERGRUP referansları

11 dosyada geçiyor (case-insensitive grep):
- [lib/seo/buildLocalBusiness.ts:35](../lib/seo/buildLocalBusiness.ts#L35) — `legalName: 'ÖzerGrup Yalıtım ve İzolasyon A.Ş.'`
- [app/page.tsx:52](../app/page.tsx#L52) — Org schema name içinde
- [app/iletisim/page.tsx:51, 284](../app/iletisim/page.tsx) — ContactPage + corp row
- [app/hakkimizda/page.tsx:81](../app/hakkimizda/page.tsx#L81) — H1 + timeline
- [app/depomuz/page.tsx:33](../app/depomuz/page.tsx#L33) — LocalBusiness `legalName`
- [app/kvkk/page.tsx:10](../app/kvkk/page.tsx#L10) — `COMPANY` const
- [components/cro/ProofBlock.tsx:7](../components/cro/ProofBlock.tsx#L7) — trust row
- [lib/pdfGenerator.ts](../lib/pdfGenerator.ts) — PDF teklif marka
- [docs/AUDITSFINAL/*](../docs/AUDITSFINAL/) — denetim notları (kullanıcıya yönelik değil)

❌ **Footer'da ÖZERGRUP geçmiyor** — sadece "Taşyünü Fiyatları" copyright var. Multi-site hub görünür değil.

### Marka entity referansları

[app/marka/[brand]/page.tsx:12-42](../app/marka/[brand]/page.tsx#L12-L42) — `BRAND_MAP`:
- `dalmacyali` (id 1, Dalmaçyalı)
- `filli-boya` (id 2, Fawori Expert)
- `optimix` (id 4, Fawori Optimix)
- `tekno` (id 6, TEKNO)
- `oem` (id 11, Ekonomik 2.Kalite)

⚠️ **Brand schema (standalone Organization) YOK** — sadece Product içinde nested `brand: { '@type': 'Brand', name }`. Filli Boya / Dalmaçyalı / TEKNO Knowledge Graph entity bağlantısı kurulmuyor (`sameAs: [...resmi-url]` yok).

### "Yetkili Bayi" trust signal

❌ "Yetkili Bayi" string'i kodda **yok**. "Resmi Bayi" 2 dosyada:
- [app/page.tsx:191](../app/page.tsx#L191) — `<BrandTrustLogos title="Resmi Bayilikler" variant="heroRail" />`
- [app/hakkimizda/page.tsx](../app/hakkimizda/page.tsx) — REASONS dizisi

✅ `BrandTrustLogos` component'i var ([components/shared/BrandTrustLogos](../components/shared/) — tam yolu doğrulanmadı; home + ürün detay sağ panelde "Bayilikler" başlığıyla render ediliyor [:357-361](../app/urunler/[kategori]/[slug]/page.tsx#L357-L361)).

**Risk:** Orta — Brand entity'leri Knowledge Graph'a bağlanmıyor, ÖZERGRUP multi-site hub footer'da yok.

---

## 12. Bilinen Teknik Borç (kod içinde)

### Grep: `TODO|FIXME|HACK|XXX|temporary` (`*.{ts,tsx}`)

| Konum | İçerik |
|---|---|
| [app/page.tsx:370](../app/page.tsx#L370) | `// PROOF BLOCK — sprint 4: kanıt katmanı (görsel placeholder, TODO: real assets)` |
| [components/catalog/ProductPricePanel.tsx:3](../components/catalog/ProductPricePanel.tsx#L3) | `TODO (teknik borç): URL parsing ?kalinlik=7.5cm için parseInt kullanılıyor` |
| [lib/importApplier.ts:114](../lib/importApplier.ts#L114) | `TODO: import_match_results'a raw_kdv_hint staging kolonu eklenince` |
| [lib/package-engine/calcPricing.ts:273-276](../lib/package-engine/calcPricing.ts#L273-L276) | `TODO: recipe parametresini resolveShipping'e ilet ve plate brand_id kontrolü yap.` + `// placeholder — şimdilik false döner, implementasyon TODO` |

### Geçici çözümler / tutarsızlıklar (yorumla işaretli olmasa da)

| Konum | Konu |
|---|---|
| `middleware.ts` | **YOK** — MEMORY.md'de bahsediliyor (admin Basic Auth: `/ofis`, `/api/admin`) ama dosya bulunamadı (PowerShell `Get-ChildItem` boş döndü). Admin paneli yalnızca robots.txt + URL gizliliği ile korunuyor. **Güvenlik riski**: `/ofis` ve `/api/admin/*` rotaları kimlik doğrulaması olmadan erişilebilir olabilir. |
| `app/piyasa/page.tsx` | **MOCK_TRANSACTIONS, HOTSPOTS** — sahte "piyasa verileri" sunuluyor ([:3, 44, 70](../app/piyasa/page.tsx)). Robots disallow ile kullanıcılara gösterilmemeli ama linklenirse trust kaybı. |
| `app/bolge/[sehir]/[ilce]/page.tsx` | **MOCK_TRANSACTIONS** ile "son hareketler" gösteriyor ([:36-39, 78-91](../app/bolge/[sehir]/[ilce]/page.tsx)). Sayfa açık uçlu (herhangi sehir/ilce kombinasyonu 200), sahte referans servis ediyor → doorway + güvenilirlik riski. |
| [components/analytics/CookieConsent.tsx](../components/analytics/CookieConsent.tsx) | Component yazılmış ama [app/layout.tsx](../app/layout.tsx)'te `<CookieConsent />` mount edilmemiş (grep: yalnızca self-reference + GA + docs). |
| [components/shared/SiteFooter.tsx:41-42](../components/shared/SiteFooter.tsx#L41-L42) | "Çerez Politikası" + "Kullanım Koşulları" footer linkleri her ikisi de `/iletisim`'e gidiyor — gerçek sayfalar yok. |
| 3 farklı LocalBusiness inline tanımı | bkz. §5 — entity duplicate. |
| Home page `"use client"` | bkz. §8 — RSC streaming kayıp. |
| Sentry source map upload | Sadece CI'da; CI=`process.env.CI` — Vercel'de otomatik set edilir, doğrulanması gerekir. |

### Hardcoded değerler

- ✅ Telefon: `+905322041825` 7+ dosyada hardcoded ([SiteHeader.tsx:33](../components/shared/SiteHeader.tsx#L33), [SiteFooter](../components/shared/SiteFooter.tsx), [iletisim](../app/iletisim/page.tsx), [depomuz](../app/depomuz/page.tsx), [hakkimizda](../app/hakkimizda/page.tsx), [kvkk](../app/kvkk/page.tsx), [buildLocalBusiness.ts:38](../lib/seo/buildLocalBusiness.ts#L38)). E-mail aynı durum: `bilgi@tasyunufiyatlari.com` 5+ dosyada. **Tek kaynaktan çekmek (BUSINESS_INFO/SITE_CONFIG) gerekir.**
- ✅ Adres: `Orhanlı Mescit Mh. Demokrasi Cd. No:5` ve `Mescit Mah. Ulugüney Sk. Harman Plaza Blok K2 No:15` (home page Org schema farklı adres! — [app/page.tsx:57](../app/page.tsx#L57)) ⚠️ — **3 farklı adres formatı**: home page (Mescit Mah. Ulugüney), buildLocalBusiness (Orhanlı Mescit Mh. Demokrasi), depomuz/iletisim (Orhanlı Mescit Mh. Demokrasi). Adres tutarsızlığı NAP (Name-Address-Phone) consistency kaybı, lokal SEO için kritik.
- ✅ Stok / fiyat: kodda hardcoded değil — DB-driven (plates, plate_prices, accessories).
- ✅ Şehir öncelik listesi: [app/urunler/[kategori]/[slug]/page.tsx:48-51](../app/urunler/[kategori]/[slug]/page.tsx#L48-L51) `PRIORITY_CITIES` hardcoded — kasıtlı bir UX kararı.

**Risk:** Kritik (NAP tutarsızlığı, middleware yok, mock data, KVKK consent UI yok).

---

# Özet — 3 Aşamalı Yol Haritası

## 1. Acil Müdahale (1 hafta içinde)

Bu maddeler kanama yaratabilir: kanonik veri tutarsızlığı, güvenlik, KVKK uyum, kırık link.

| # | Madde | Risk | Dosya |
|---|---|---|---|
| 1 | **Adres NAP tutarsızlığı:** home page Org schema (`Mescit Mah. Ulugüney`) vs `buildLocalBusiness` + iletisim/depomuz (`Orhanlı Mescit Mh. Demokrasi`). 3 farklı adres → Google Business Profile + Knowledge Graph senkronizasyonu kırık. Tek bir merkezi `BUSINESS_INFO` sözlüğüne taşı, tüm referansları oradan çek. | Kritik | [app/page.tsx:57](../app/page.tsx#L57), [lib/seo/buildLocalBusiness.ts:39-44](../lib/seo/buildLocalBusiness.ts#L39-L44), [app/depomuz/page.tsx:34-40](../app/depomuz/page.tsx#L34-L40), [app/iletisim/page.tsx:53-60](../app/iletisim/page.tsx#L53-L60) |
| 2 | **3 ayrı LocalBusiness schema tanımı entity'si çakışıyor.** `@graph` ile tek canonical node + `@id` zinciri kur (`buildBusinessNode()`); diğer schema'lardaki `publisher`/`provider`/`seller` alanlarını `BUSINESS_REF` pointer'a çevir. | Kritik | §5 |
| 3 | **Admin panel kimlik doğrulaması:** `middleware.ts` MEMORY.md'de tarif ediliyor ama dosya yok. `/ofis` ve `/api/admin/*` rotaları sadece robots.txt + URL gizliliği ile korunuyor. Basic Auth middleware geri konmalı VEYA Vercel password protection açılmalı. | Kritik | (yok) — yeni `middleware.ts` |
| 4 | **CookieConsent UI eksik:** banner component'i var ama `app/layout.tsx`'te mount edilmemiş. KVKK consent kanıtlanabilir değil. `<CookieConsent />` layout'a eklen. | Kritik | [components/analytics/CookieConsent.tsx](../components/analytics/CookieConsent.tsx) + [app/layout.tsx](../app/layout.tsx) |
| 5 | **Footer "Çerez Politikası" ve "Kullanım Koşulları" `/iletisim`'e gidiyor.** Ya gerçek sayfalar oluştur (`/cerez-politikasi`, `/kullanim-kosullari`) ya bu linkleri kaldır. | Yüksek | [components/shared/SiteFooter.tsx:41-42](../components/shared/SiteFooter.tsx#L41-L42) |
| 6 | **`/bolge/[sehir]/[ilce]` doorway page:** dynamicParams kontrolü yok, herhangi bir kombinasyon 200 dönüyor + MOCK_TRANSACTIONS sahte referans servis ediyor. `dynamicParams = false` + statik whitelist VEYA `noindex` meta + sahte mock veriyi kaldır. | Yüksek | [app/bolge/[sehir]/[ilce]/page.tsx](../app/bolge/[sehir]/[ilce]/page.tsx) |
| 7 | **Telefon ve e-mail hardcoded 7+ dosyada.** `BUSINESS_INFO` sözlüğüne taşı (madde 1 ile birlikte yapılır). | Yüksek | §12 |

## 2. 30 Gün İçinde

Stratejik önemde, kanama yapmıyor ama mevcut SEO/AIO performansının önünde bariyer.

| # | Madde | Risk | Dosya |
|---|---|---|---|
| 8 | **`@graph` pattern + entity zinciri kurulması.** Tüm schema'ları tek `<script>` içinde `@graph` array'ine bağla; `@id` ile Product → publisher → LocalBusiness, Offer → seller, BreadcrumbList → mainEntityOfPage zincirlerini ör. | Yüksek | [lib/seo/](../lib/seo/) — refactor |
| 9 | **HowTo schema:** Home page'de `HOW_STEPS` (3 adımda hesap) + ürün detayda kalınlık seçim/teklif akışı. AIO için yüksek değer. | Yüksek | [app/page.tsx:89-105](../app/page.tsx#L89-L105) |
| 10 | **Service schema:** "Mantolama hesaplama / fabrika çıkışlı sevkiyat" servisleri için. `provider: BUSINESS_REF`, `areaServed: TR`, `priceRange: '₺₺'`. | Orta | yeni `lib/seo/buildService.ts` |
| 11 | **Person/Author schema:** Hakkımızda'da `Muhammet Öztürk` `LocalBusiness.founder` altında geçiyor; bunu standalone `Person` schema'ya çıkar + `@id` ile bağla. E-E-A-T sinyali. | Orta | [app/hakkimizda/page.tsx:184](../app/hakkimizda/page.tsx#L184) |
| 12 | **Speakable işaretleme:** Home FAQ + ürün detay açıklama. Voice search / Google Assistant için. | Orta | FAQ schema'ya `speakable` property |
| 13 | **Brand schema standalone + `sameAs`:** Filli Boya, Dalmaçyalı, TEKNO için resmi URL'ler ile entity bağlama. | Orta | [app/marka/[brand]/page.tsx](../app/marka/[brand]/page.tsx) |
| 14 | **Marka × kategori sitemap eksik:** `/marka/<brand>/<kategori>` route mevcut ama sitemap'te yok. DB'den marka × ürün matrix üret. | Orta | [app/sitemap.ts](../app/sitemap.ts) |
| 15 | **Marka hub footer eksik:** Footer "Kurumsal" grubu sadece `/marka/dalmacyali` linkini içeriyor; tüm 5 markayı listele. | Orta | [components/shared/SiteFooter.tsx:23-28](../components/shared/SiteFooter.tsx#L23-L28) |
| 16 | **Home page `"use client"` ayrıştırması:** Schema script'leri ve hero'yu RSC olarak ayır; calculator + interactive bloklar client kalır. LCP/TBT iyileşir. | Orta | [app/page.tsx:1](../app/page.tsx#L1) |
| 17 | **Robots `?utm_*`, `?fbclid` Disallow:** Marketing parametre dağılımına karşı canonical disiplinini robots ile pekiştir. | Düşük | [app/robots.ts](../app/robots.ts) |
| 18 | **Production 404 telemetrisi:** Sentry zaten kurulu; eski WP URL'lerinden gelen 404'leri ayrı bir issue grubunda izle, PREFIX_MAP'e ekle. | Orta | Sentry setup |
| 19 | **kvkk_consent DB persist doğrulaması:** API'de `mapQuotePayload`'da kolon yok — `quotes` tablosuna eklenip persist edildiğini doğrula. | Orta | [app/api/quotes/route.ts:8-51](../app/api/quotes/route.ts#L8-L51) |
| 20 | **`unstable_cache` tag invalidation:** Ürün detay revalidate=60 + logistics tag `'logistics'`; admin update flow'unda `revalidateTag('logistics')` + `revalidatePath('/urunler/...')` çağrılıyor mu kontrolü. | Düşük | [app/urunler/[kategori]/[slug]/page.tsx:42-44](../app/urunler/[kategori]/[slug]/page.tsx#L42-L44) |

## 3. Roadmap (90+ gün)

Nice-to-have, mevcut sistem çalışıyor; rakipten önde olmak için.

| # | Madde | Risk |
|---|---|---|
| 21 | **ImageObject zenginleştirme:** Tüm `image` string'lerini `{ '@type': 'ImageObject', url, width, height, caption }` objelerine çevir. | Düşük |
| 22 | **Review / AggregateRating:** Google reviews fetch + schema (eğer veri varsa). | Düşük |
| 23 | **`/cerez-politikasi`, `/kullanim-kosullari` gerçek sayfalar.** | Düşük |
| 24 | **`/piyasa` gerçek veri:** mock veriyi kaldır VEYA sayfayı tamamen kaldır (robots disallow yeterli değilse). | Orta |
| 25 | **PROOF BLOCK gerçek görseller:** sahada çekilmiş depo/teslimat fotoğrafları. | Düşük |
| 26 | **AVIF format / `next/image` optimization yeniden değerlendirilmesi:** Vercel Pro tier'a geçiş hesabına göre `unoptimized: false` + AVIF aktif. | Düşük |
| 27 | **Cache-Control immutable headers** statik public dosyalar için explicit. | Düşük |
| 28 | **PRICING_HIDDEN_REASON micro-copy + Service schema'sında `eligibleQuantity` minOrder bağlantısı.** | Düşük |
| 29 | **Build çıktısında bundle size ölçümü, route segment ayrıştırması.** | Düşük |
| 30 | **`BUSINESS_REF` skill template'inin uygulanması:** `lib/seo/buildBusinessNode.ts` + `BUSINESS_REF` const + tüm publisher/provider/seller pointer'lara çevirme. | Orta |

---

## Ek Notlar

- **Tailwind v4** kullanılıyor (`@tailwindcss/postcss@^4`); `tailwind.config.js` yok. Tüm tema tokenları `globals.css` `@theme inline` blokunda. Skill referansları (`tailwind.config.ts`) bu projede uygulanmaz.
- **Next.js 16 params Promise kuralı** her dynamic route'da uygulanmış — denetim sırasında ihlal görülmedi.
- **Türkçe encoding** kontrolü: tüm `.ts/.tsx` dosyalarında Türkçe karakterler doğru, mojibake yok.
- **Sentry tunnel route** `/monitoring` aktif — adblock bypass için iyi.
- **Supabase MCP** `.mcp.json` üzerinden bağlı; bu denetim sırasında DB şemasına direkt SQL çekilmedi (rapor sadece dosya bazlı).

— Audit bitti.
