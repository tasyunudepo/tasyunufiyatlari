# Supabase RLS Güvenlik Notu

**Tarih:** 2026-05-21
**Konu:** Supabase Security Advisor maili — `rls_disabled_in_public`
**Proje:** `tasyunu-fiyatlari` / `latlzskzemmdnotzpscc`

## Teşhis

Supabase uyarısı doğru sınıfta: `public` schema'da RLS kapalı en az bir tablo var. Supabase dokümanına göre exposed schema'daki tablolar için RLS açık olmalı; RLS açıldığında publishable/anon key ile API'den veri erişimi policy olmadan kapalıdır. Service role key ise server-side kullanıldığında RLS'yi bypass eder, browser'a konmamalıdır.

Repo geçmişinde özellikle `fix-plate-prices-rls.sql` içinde `plate_prices` için `ALTER TABLE plate_prices DISABLE ROW LEVEL SECURITY;` kullanılmış. Ayrıca eski migration notları RLS disabled tabloların önce bilinçli ertelendiğini gösteriyor. Bugünkü kodda kritik değişim şu: teklif, import ve admin mutasyonları artık server route + `SUPABASE_SERVICE_ROLE_KEY` üzerinden çalışıyor. Bu yüzden direct anon write ihtiyacı yok.

## Risk

RLS kapalı tablo, proje URL'i ve anon key bilindiğinde REST API üzerinden okunabilir/yazılabilir/silinebilir olabilir. Anon key zaten frontend bundle'da bulunabilen publishable bir key olduğu için güvenlik RLS/policy katmanına dayanmalı.

Özellikle hassas tablolar:

- `quotes`: müşteri adı, telefon, adres, fiyat, KVKK rıza kaydı
- `quote_funnel_events`: lead/analitik eventleri
- `raw_import_files`, `raw_import_rows`, `import_match_results`, `import_apply_logs`: fiyat/import staging verisi
- fiyat yönetimi tablolarındaki update/delete yetkileri

## Hazırlanan Düzeltme

Dosya: `scripts/migration-v14-rls-public-hardening.sql`

Yaptıkları:

1. `public` schema'daki tüm base/partitioned tablolar için RLS açar.
2. `anon` ve `authenticated` rollerinden doğrudan `INSERT/UPDATE/DELETE` yetkilerini alır.
3. Eski policy'leri temizler.
4. Sadece public katalog/wizard tablolarına SELECT policy bırakır:
   - `brands`
   - `material_types`
   - `accessory_types`
   - `shipping_zones`
   - `shipping_districts`
   - `logistics_capacity`
   - `plates` (`is_active = true`)
   - `accessories` (`is_active = true`)
   - `package_definitions` (`is_active = true`)
   - `plate_prices` (aktif parent plate varsa)
5. Hassas tabloları RLS açık + public policy yok durumuna getirir:
   - `quotes`
   - `quote_funnel_events`
   - `raw_import_*`
   - `import_*`
   - `plate_prices_staging`
   - `accessory_match_catalog`

## Uygulama Sırası

1. Supabase SQL Editor'da `scripts/migration-v14-rls-public-hardening.sql` çalıştır.
2. Kontrol sorgularını çalıştır:
   - RLS kapalı public tablo kalmamalı.
   - `anon/authenticated` için `INSERT/UPDATE/DELETE` grant kalmamalı.
   - Public read policy listesi beklenen tablolarla sınırlı olmalı.
3. Siteyi test et:
   - Ana sayfa wizard ürün/şehir/fiyat yükleniyor mu?
   - `/urunler`, kategori ve ürün detay sayfaları açılıyor mu?
   - `/api/quotes` test submit çalışıyor mu?
   - `/ofis` admin teklif ve ürün ekranı açılıyor mu?
4. Supabase Security Advisor'da tekrar tarat / Resolve issue.

## Dikkat

`material_types` şu an wizard fiyat hesabında margin/minimum sipariş alanlarını client tarafına çekiyor. Bu güvenlik açığı değil, fakat ticari mantık görünürlüğü demek. Daha sıkı bir sonraki adımda wizard fiyat hesabını server API'ye taşımak ve `material_types` için public read'i sadece güvenli kolonlarla view üzerinden vermek daha doğru olur.
