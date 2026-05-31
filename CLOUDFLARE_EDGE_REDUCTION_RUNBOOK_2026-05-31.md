# Cloudflare Edge Reduction Runbook

Tarih: 2026-05-31  
Hedef: `tasyunufiyatlari.com` isteklerinin mümkün olan kısmını Vercel'e ulaşmadan Cloudflare katmanında karşılamak veya kesmek.

## Beklenen Etki

| Kural grubu | Vercel Edge Requests etkisi | Risk |
|---|---:|---|
| Public HTML/static cache | %30-70 düşüş | Orta |
| Legacy/bot WAF block/challenge | %5-20 düşüş | Düşük-Orta |
| Eski WooCommerce URL cache/redirect | %3-12 düşüş | Düşük |
| Toplam gerçekçi aralık | **%40-80 düşüş** | Orta |

## Ön Koşul

Domain Cloudflare DNS'e taşınmalı ve proxy turuncu bulut olarak aktif olmalı:

- `tasyunufiyatlari.com`
- `www.tasyunufiyatlari.com`

Vercel tarafında domain aynı kalır; Cloudflare sadece öndeki cache/WAF katmanı olur.

## Cache Rules

### 1. Static Asset Cache

Rule name: `cache-static-assets`

Koşul:

```text
(http.host in {"tasyunufiyatlari.com" "www.tasyunufiyatlari.com"}
 and http.request.method eq "GET"
 and (
   starts_with(http.request.uri.path, "/_next/static/")
   or starts_with(http.request.uri.path, "/images/")
   or http.request.uri.path contains ".webp"
   or http.request.uri.path contains ".png"
   or http.request.uri.path contains ".jpg"
   or http.request.uri.path contains ".jpeg"
   or http.request.uri.path contains ".svg"
   or http.request.uri.path contains ".css"
   or http.request.uri.path contains ".js"
 ))
```

Aksiyon:

```text
Eligible for cache: true
Edge TTL: 1 month
Browser TTL: Respect origin / 1 day
Cache key: Ignore query string for static assets
```

### 2. Public Page Cache

Rule name: `cache-public-pages`

Koşul:

```text
(http.host in {"tasyunufiyatlari.com" "www.tasyunufiyatlari.com"}
 and http.request.method eq "GET"
 and not starts_with(http.request.uri.path, "/api/")
 and not starts_with(http.request.uri.path, "/ofis")
 and not starts_with(http.request.uri.path, "/_next/data/")
 and not starts_with(http.request.uri.path, "/_next/image")
 and not starts_with(http.request.uri.path, "/_vercel")
 and not starts_with(http.request.uri.path, "/__nextjs")
 and not http.request.uri.query contains "preview"
)
```

Aksiyon:

```text
Eligible for cache: true
Edge TTL: 1 hour
Browser TTL: Respect origin / 5 minutes
Serve stale while revalidating: enabled if available
Cache key: Include query string
```

Not: Public katalog sayfaları artık force-static/SSG olduğu için Cloudflare cache'e uygundur. `/api/*` ve `/ofis*` kesin dışarıda kalmalı.

## WAF / Bot Rules

### 3. WordPress Attack Surface

Rule name: `block-wordpress-noise`

Koşul:

```text
(http.request.uri.path eq "/wp-login.php"
 or http.request.uri.path eq "/xmlrpc.php"
 or starts_with(http.request.uri.path, "/wp-admin")
 or starts_with(http.request.uri.path, "/wp-content")
 or starts_with(http.request.uri.path, "/wp-includes")
 or ends_with(http.request.uri.path, ".php"))
```

Aksiyon:

```text
Block
```

Alternatif daha yumuşak aksiyon:

```text
Managed Challenge
```

### 4. Feed / Spam Crawl Noise

Rule name: `challenge-feed-crawlers`

Koşul:

```text
(http.request.uri.path eq "/feed"
 or ends_with(http.request.uri.path, "/feed")
 or http.request.uri.path contains "/feed/")
```

Aksiyon:

```text
Managed Challenge
```

### 5. Rate Limit Public Catalog Noise

Rule name: `rate-limit-catalog-bots`

Koşul:

```text
(http.request.method eq "GET"
 and (
   starts_with(http.request.uri.path, "/urunler")
   or starts_with(http.request.uri.path, "/marka")
 )
 and not cf.client.bot)
```

Aksiyon önerisi:

```text
Threshold: 120 requests / 1 minute / IP
Action: Managed Challenge
```

Googlebot/Bingbot gibi doğrulanmış botlar `cf.client.bot` ile hariç bırakılmalı.

## Query Param Politikası

Vercel `proxy.ts` içinde eski WooCommerce paramları temizleniyor:

```text
add_to_wishlist, _wpnonce, orderby, filter_paket_ici_m2, gridcookie,
source_id, source_tax, pwb-brand, pwb-brand-filter, paged,
product-page, min_price, max_price, wc-ajax
```

Cloudflare tarafında bu paramlı public URL'ler için ek davranış:

```text
Cache eligibility: false
Action: Let origin redirect to canonical URL
```

UTM ve GA paramları bloklanmamalı:

```text
utm_source, utm_medium, utm_campaign, gclid, fbclid
```

## Deploy Sonrası Kontrol

48 saat izleme:

| Metrik | Hedef |
|---|---|
| Vercel Edge Requests | Günlük 10.2k -> önce 7k altı, sonra 4k altı |
| Cloudflare Cache Hit Ratio | %60+ başlangıç, ideal %80+ |
| WAF events | WordPress/feed botları görünmeli |
| GA4 page_view | Gerçek kullanıcı trafiği düşmemeli |
| Form/teklif akışı | `/api/quotes`, `/api/upload-pdf`, `/api/whatsapp-intent` etkilenmemeli |

## Geri Alma

Sorun çıkarsa sırayla kapat:

1. `cache-public-pages`
2. `rate-limit-catalog-bots`
3. `challenge-feed-crawlers`
4. En son `cache-static-assets`

WordPress block rule genellikle güvenle açık kalabilir; bu projede WordPress runtime yok.
