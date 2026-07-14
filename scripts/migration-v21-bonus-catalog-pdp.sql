-- ============================================================
-- Migration v21 — Bonus levhalarının katalog (PDP) entegrasyonu
-- Tarih: 2026-07-14
--
-- Karar (Emrah, 14 Temmuz 2026): Bonus F 120 / F 150 / F 150 Pro
-- katalogda PDP olarak yayınlanır. Faz 1 fiyatsızdır:
--   sales_mode='quote_only', pricing_visibility_mode='quote_required',
--   requires_city_for_pricing=true → fiyat kutusu "teklif ile belirlenir"
--   notu gösterir; PDP'deki hesaplayıcı CTA'sı wizard'a prefill ile gider.
--   (Faz 2'de PDP'ye bölge seçici + canlı /api/bonus-price gelecek.)
--
-- İçerik kuralları:
--   - Teknik değerler plate_technical_profiles föy beyanlarıyla birebir
--     (v18); föyde olmayan değer yazılmaz.
--   - Kalınlık seçenekleri üreticinin Haziran 2026 fiyat listesindeki
--     satılabilir kalınlıklardır (plate_prices bilinçli olarak YOK;
--     taban fiyat müşteri yüzeyine inmez, fiyat sunucuda hesaplanır).
--
-- Not: thickness_options wizard'ı da besler; F 150 Pro'daki listede
-- olmayan 3 cm kaldırılır (fiyat API'si zaten 404 veriyordu), üç üründe
-- listede olan 15 cm eklenir.
-- ============================================================

BEGIN;

DO $v21$
DECLARE
  bonus_id INTEGER;
  n INTEGER;
BEGIN
  SELECT id INTO bonus_id FROM public.brands WHERE name = 'Bonus';
  IF bonus_id IS NULL THEN
    RAISE EXCEPTION 'Bonus markası bulunamadı; migration durduruldu.';
  END IF;

  -- Görseller: bonusyalitim.com.tr resmî Premium F ailesi render'ı
  -- (üretici üç varyantı tek görselle sunuyor); product-images bucket'ına
  -- 14 Temmuz 2026'da yüklendi.

  -- ── Bonus Premium F 150 ────────────────────────────────────
  UPDATE public.plates SET
    slug = 'bonus-f-150-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-f-150-tasyunu.webp',
    thickness_options = '[2,3,4,5,6,7,8,9,10,11,12,13,15]'::jsonb,
    preferred_thickness = 5,
    sales_mode = 'quote_only',
    pricing_visibility_mode = 'quote_required',
    requires_city_for_pricing = true,
    meta_title = 'Bonus Premium F 150 Taşyünü Levha — 150 kg/m³ Mantolama | Taşyünü Fiyatları',
    meta_description = 'Bonus Premium F 150 taşyünü mantolama levhası: föy beyanı 150 kg/m³ (±%10) yoğunluk, A1 yanmazlık, 15 kPa dik çekme dayanımı. 2-15 cm kalınlık, bölgenize göre anında m² fiyatı.',
    catalog_description = 'Bonus Premium F 150, sıvalı dış cephe mantolama sistemleri için üretilen yüksek yoğunluklu taşyünü ısı yalıtım levhasıdır. Üretici föyü beyanına göre yoğunluğu 150 kg/m³ (±%10), ısı iletkenlik katsayısı kalınlığa göre 0,036–0,040 W/mK, dik çekme dayanımı 15 kPa, basma dayanımı 40–70 kPa aralığındadır ve A1 sınıfı yanmaz malzemedir. Üretici fiyat listesinde 2-15 cm arası kalınlıklarla yer alır. Fiyat, üreticinin bölge listesine göre şehrinize özel hesaplanır ve sevkiyat tam kamyon / tam TIR kuralıyla yapılır; bölgenize özel m² fiyatını hesaplayıcıdan anında alabilirsiniz.'
  WHERE brand_id = bonus_id AND short_name = 'F 150';

  -- ── Bonus Premium F 150 Pro ────────────────────────────────
  UPDATE public.plates SET
    slug = 'bonus-f-150-pro-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-f-150-pro-tasyunu.webp',
    thickness_options = '[4,5,6,7,8,10,12,15]'::jsonb,
    preferred_thickness = 5,
    sales_mode = 'quote_only',
    pricing_visibility_mode = 'quote_required',
    requires_city_for_pricing = true,
    meta_title = 'Bonus Premium F 150 Pro Taşyünü Levha — 150 kg/m³ Mantolama | Taşyünü Fiyatları',
    meta_description = 'Bonus Premium F 150 Pro taşyünü mantolama levhası: föy beyanı 150 kg/m³ (±%10) yoğunluk, A1 yanmazlık. 4-15 cm kalınlık seçenekleri, bölgenize göre anında m² fiyatı.',
    catalog_description = 'Bonus Premium F 150 Pro, sıvalı dış cephe mantolama sistemleri için üretilen taşyünü ısı yalıtım levhasıdır. Üretici föyü beyanına göre yoğunluğu 150 kg/m³ (±%10), ısı iletkenlik katsayısı kalınlığa göre 0,036–0,038 W/mK, dik çekme dayanımı 10 kPa, basma dayanımı 35–50 kPa aralığındadır ve A1 sınıfı yanmaz malzemedir. "Pro" adı otomatik üstünlük anlamına gelmez; föy değerleri karşılaştırma bağlamında değerlendirilmelidir. Üretici fiyat listesinde 4-15 cm arası kalınlıklarla yer alır. Fiyat, üreticinin bölge listesine göre şehrinize özel hesaplanır ve sevkiyat tam kamyon / tam TIR kuralıyla yapılır.'
  WHERE brand_id = bonus_id AND short_name = 'F 150 Pro';

  -- ── Bonus Premium F 120 ────────────────────────────────────
  UPDATE public.plates SET
    slug = 'bonus-f-120-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-f-120-tasyunu.webp',
    thickness_options = '[3,4,5,6,7,8,9,10,11,12,13,15]'::jsonb,
    preferred_thickness = 5,
    sales_mode = 'quote_only',
    pricing_visibility_mode = 'quote_required',
    requires_city_for_pricing = true,
    meta_title = 'Bonus Premium F 120 Taşyünü Levha — 120 kg/m³ Mantolama | Taşyünü Fiyatları',
    meta_description = 'Bonus Premium F 120 taşyünü mantolama levhası: föy beyanı 120 kg/m³ (±%10) yoğunluk, A1 yanmazlık. 3-15 cm kalınlık, bölgenize göre anında m² fiyatı.',
    catalog_description = 'Bonus Premium F 120, sıvalı dış cephe mantolama sistemleri için üretilen taşyünü ısı yalıtım levhasıdır. Üretici föyü beyanına göre yoğunluğu 120 kg/m³ (±%10), ısı iletkenlik katsayısı kalınlığa göre 0,036–0,038 W/mK, dik çekme dayanımı 10 kPa, basma dayanımı 35–50 kPa aralığındadır ve A1 sınıfı yanmaz malzemedir. Üretici fiyat listesinde 3-15 cm arası kalınlıklarla yer alır. Fiyat, üreticinin bölge listesine göre şehrinize özel hesaplanır ve sevkiyat tam kamyon / tam TIR kuralıyla yapılır; bölgenize özel m² fiyatını hesaplayıcıdan anında alabilirsiniz.'
  WHERE brand_id = bonus_id AND short_name = 'F 120';

  -- ── Doğrulama kapıları ─────────────────────────────────────
  SELECT count(*) INTO n FROM public.plates
  WHERE brand_id = bonus_id AND slug IS NOT NULL AND is_active;
  IF n <> 3 THEN
    RAISE EXCEPTION 'Bonus katalog kaydı 3 olmalıydı, % bulundu.', n;
  END IF;

  SELECT count(*) INTO n FROM public.plates p
  WHERE p.slug IN ('bonus-f-150-tasyunu','bonus-f-150-pro-tasyunu','bonus-f-120-tasyunu')
    AND p.brand_id <> bonus_id;
  IF n <> 0 THEN
    RAISE EXCEPTION 'Slug çakışması: Bonus slug''ı başka markada kullanılıyor.';
  END IF;
END;
$v21$;

COMMIT;

-- Geri almak için (katalogdan kaldırır, wizard etkilenmez; kalınlıklar
-- v18 önceki hâline döndürülmek istenirse ayrıca güncellenir):
--   UPDATE public.plates SET slug = NULL
--   WHERE brand_id = (SELECT id FROM public.brands WHERE name='Bonus');
