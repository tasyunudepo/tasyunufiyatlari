-- ============================================================
-- Migration v22 — Bonus taşyünü genişletmesi (mantolama dışı aileler)
-- Tarih: 2026-07-20
--
-- Karar (Emrah, 20 Temmuz 2026): Haziran 2026 fiyat listesindeki tüm
-- taşyünü aileleri kataloğa eklenir. Gold ailesi ve Endüstriyel ürünler
-- yoğunluk varyantı başına ayrı PDP AÇMAZ: aile başına tek PDP + PDP
-- içi yoğunluk seçici (lib/pricing/bonus/families.ts). Varyant fiyatları
-- lib/pricing/bonus/bonus-region-prices.json + lib/technical-profiles
-- üzerinden /api/bonus-price'ta çözülür; bu migration yalnız katalog
-- yüzeyini kurar.
--
-- İçerik kuralları (v21 ile aynı):
--   - Hepsi Faz 1 fiyatsız PDP: sales_mode='quote_only',
--     pricing_visibility_mode='quote_required',
--     requires_city_for_pricing=true. Fiyatlı modellerde canlı bölge
--     fiyatı BonusRegionPrice kartından iner; taban fiyat müşteri
--     yüzeyine inmez (plate_prices bilinçli YOK).
--   - Desibel / Kapı Paneli / Panel / Marin üretici listesinde fiyatsızdır
--     ("Bölge yöneticisi ile iletişime geçiniz") → canlı fiyat kartı
--     çıkmaz (families.ts UNPRICED_MODELS), statik "Teklif ile
--     belirlenir" akışı geçerlidir.
--   - Teknik değerler fiyat listesi PDF'inin teknik özellik sayfaları
--     ve föylerle birebirdir; föyde olmayan değer YAZILMAZ. Premium F /
--     Premium R / Premium R 150 föylerinde kg/m³ beyanı YOKTUR →
--     yoğunluk alanları NULL bırakılır (addaki sayı model adıdır).
--   - Satılabilir kalınlık kaynağı fiyat listesidir (thickness_options);
--     profil thickness_mm_min/max föy beyanıdır, ikisi farklı olabilir.
--   - Kâr marjı bu dosyada YOKTUR; brands.margin_pct canlı kuralı geçerli.
--
-- Görseller: product-images bucket'ına yüklenmeleri AKTİVASYONDAN ÖNCE
-- yapılmalıdır; bu migration image_cover'ı beklenen yola yazar.
-- Wizard: HİÇBİR yeni ürün wizard'a girmez (FR-002 korunur) —
-- plate_technical_profiles.wizard_eligible=false.
--
-- Aktivasyon ayrı betiktedir: canli-bonus-genisletme-aktivasyon.sql
-- (yeni slug'lar force-static olduğundan aktivasyon sonrası redeploy şart).
-- ============================================================

BEGIN;

-- ─── 0a. Yoğunluk beyanı olmayan ürünler için şema gevşetmesi ──
-- v18'de density kolonları NOT NULL idi; beyan yoksa değer uydurmak
-- yerine NULL'a izin verilir, tutarlılık CHECK ile korunur.
ALTER TABLE public.plate_technical_profiles ALTER COLUMN density_min_kg_m3 DROP NOT NULL;
ALTER TABLE public.plate_technical_profiles ALTER COLUMN density_max_kg_m3 DROP NOT NULL;
ALTER TABLE public.plate_technical_profiles ALTER COLUMN density_display DROP NOT NULL;
ALTER TABLE public.plate_technical_profiles ALTER COLUMN density_source_type DROP NOT NULL;
ALTER TABLE public.plate_technical_profiles ALTER COLUMN density_source_label DROP NOT NULL;
ALTER TABLE public.plate_technical_profiles ALTER COLUMN density_source_date DROP NOT NULL;

DO $chk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'plate_technical_profiles_density_declaration_coherent'
  ) THEN
    ALTER TABLE public.plate_technical_profiles
      ADD CONSTRAINT plate_technical_profiles_density_declaration_coherent
      CHECK (
        (density_min_kg_m3 IS NULL AND density_max_kg_m3 IS NULL
         AND density_display IS NULL AND density_source_type IS NULL
         AND density_source_label IS NULL AND density_source_date IS NULL)
        OR
        (density_min_kg_m3 IS NOT NULL AND density_max_kg_m3 IS NOT NULL
         AND density_display IS NOT NULL AND density_source_type IS NOT NULL
         AND density_source_label IS NOT NULL AND density_source_date IS NOT NULL)
      );
  END IF;
END;
$chk$;

-- plates.density de aynı gerekçeyle NULL olabilmeli (Premium F/R,
-- Marin/Panel gibi çok-varyantlı ya da beyansız ürünler).
ALTER TABLE public.plates ALTER COLUMN density DROP NOT NULL;

-- ─── 0b. Yeni plate satırları (pasif) ───────────────────────
-- Aile PDP'lerinde short_name = varsayılan varyantın modeli (seçici
-- lib/pricing/bonus/families.ts'ten diğer varyantlara geçer).
INSERT INTO public.plates
  (brand_id, category_id, material_type_id, name, short_name,
   density, thickness_options, is_active)
SELECT
  (SELECT id FROM public.brands WHERE name = 'Bonus'),
  -- Not: product_categories'te şimdilik tek kategori (mantolama) var ve
  -- katalog listesi material_type üzerinden filtreleniyor; gerçek
  -- kategori ayrımı (çatı/endüstriyel/marin) ayrı iş kalemidir.
  (SELECT id FROM public.product_categories WHERE slug = 'mantolama'),
  (SELECT id FROM public.material_types WHERE slug = 'tasyunu'),
  v.name, v.short_name, v.density, v.thickness_options::jsonb, false
FROM (VALUES
  ('Bonus Gold Plus Taşyünü Giydirme Cephe Levhası',            'Gold Plus 50',          50,  '[3,4,5,6,7,8,10,12,15,20]'),
  ('Bonus Gold Black Taşyünü Giydirme Cephe Levhası',           'Gold Black 50',         50,  '[3,4,5,6,7,8,10,12,15]'),
  ('Bonus Gold Yellow Taşyünü Giydirme Cephe Levhası',          'Gold Yellow 50',        50,  '[3,4,5,6,7,8,10,12,15]'),
  ('Bonus Gold Alu Taşyünü Giydirme Cephe Levhası',             'Gold Alu 50',           50,  '[5,6,7,8,10,12,15]'),
  ('Bonus Premium F Taşyünü Mantolama Levhası',                 'Premium F',             NULL, '[4,5,6,7,8,9,10,11,12,13,15]'),
  ('Bonus Premium R Taşyünü Çatı Levhası',                      'Premium R',             NULL, '[4,5,6,7,8,10,12,15]'),
  ('Bonus Premium R 150 Taşyünü Çatı Levhası',                  'Premium R 150',         NULL, '[3,4,5,6,7,8,10,12,15]'),
  ('Bonus Platin 110 Taşyünü Kat Arası Levhası',                'Platin 110',            110, '[2,3,4,5]'),
  ('Bonus Private 70 Alüminyum Kaplı Taşyünü Levha',            'Private 70',            70,  '[2.5,3,4,5]'),
  ('Bonus Endüstriyel Taşyünü Levha',                           'Endüstriyel Levha 70',  70,  '[2.5,3,4,5,6,7,8,10,12]'),
  ('Bonus Endüstriyel Rabitz Telli Taşyünü Şilte',              'Endüstriyel Şilte 650', 80,  '[3,4,5,6,7,8,10,12]'),
  ('Bonus Desibel Alçı Kaplı Kompozit Taşyünü Levha',           'Desibel',               110, '[3,5,8]'),
  ('Bonus Taşyünü Kapı Paneli',                                 'Kapı Paneli',           NULL, '[3,4,5,6,7,8,10,12]'),
  ('Bonus Taşyünü Panel (Sandviç Panel Dolgusu)',               'Panel',                 NULL, '[3,4,5,6,7,8,10,12]'),
  ('Bonus Marin Taşyünü Levha ve Şilte Serisi',                 'Marin',                 NULL, '[3,4,5,6]'),
  -- Varyant ÇIPA satırları: aile PDP'sindeki yoğunluk seçicisinin diğer
  -- varyantları. slug verilmez ve HİÇ aktive edilmezler (katalogda
  -- görünmezler); tek amaçları plate_region_prices ve
  -- plate_technical_profiles kayıtlarına plate_id sağlamaktır.
  ('Bonus Gold Plus Taşyünü Giydirme Cephe Levhası (70 kg/m³ varyant)',   'Gold Plus 70',          70,  '[3,4,5,6,7,8,10,12,15]'),
  ('Bonus Gold Plus Taşyünü Giydirme Cephe Levhası (90 kg/m³ varyant)',   'Gold Plus 90',          90,  '[3,4,5,6,7,8,10,12,15]'),
  ('Bonus Gold Black Taşyünü Giydirme Cephe Levhası (70 kg/m³ varyant)',  'Gold Black 70',         70,  '[3,4,5,6,7,8,10,12,15]'),
  ('Bonus Gold Black Taşyünü Giydirme Cephe Levhası (90 kg/m³ varyant)',  'Gold Black 90',         90,  '[3,4,5,6,7,8,10,12,15]'),
  ('Bonus Gold Yellow Taşyünü Giydirme Cephe Levhası (70 kg/m³ varyant)', 'Gold Yellow 70',        70,  '[3,4,5,6,7,8,10,12,15]'),
  ('Bonus Endüstriyel Taşyünü Levha (110 kg/m³ varyant)',                 'Endüstriyel Levha 110', 110, '[2.5,3,4,5,6,7,8,10,12]'),
  ('Bonus Endüstriyel Rabitz Telli Taşyünü Şilte (700 varyant)',          'Endüstriyel Şilte 700', 90,  '[3,4,5,6,7,8,10,12]'),
  ('Bonus Endüstriyel Rabitz Telli Taşyünü Şilte (720 varyant)',          'Endüstriyel Şilte 720', 100, '[3,4,5,6,7,8,10,12]'),
  ('Bonus Endüstriyel Rabitz Telli Taşyünü Şilte (750 varyant)',          'Endüstriyel Şilte 750', 125, '[3,4,5,6,7,8,10]')
) AS v(name, short_name, density, thickness_options)
WHERE NOT EXISTS (
  SELECT 1 FROM public.plates p
  JOIN public.brands b ON b.id = p.brand_id
  WHERE b.name = 'Bonus' AND p.short_name = v.short_name
);

-- ─── 1. Katalog PDP alanları ────────────────────────────────
DO $v22$
DECLARE
  bonus_id INTEGER;
  n INTEGER;
BEGIN
  SELECT id INTO bonus_id FROM public.brands WHERE name = 'Bonus';
  IF bonus_id IS NULL THEN
    RAISE EXCEPTION 'Bonus markası bulunamadı; migration durduruldu.';
  END IF;

  -- Ortak quote_only alanları
  UPDATE public.plates SET
    sales_mode = 'quote_only',
    pricing_visibility_mode = 'quote_required',
    requires_city_for_pricing = true,
    preferred_thickness = 5
  WHERE brand_id = bonus_id
    AND short_name IN (
      'Gold Plus 50','Gold Black 50','Gold Yellow 50','Gold Alu 50',
      'Premium F','Premium R','Premium R 150','Platin 110','Private 70',
      'Endüstriyel Levha 70','Endüstriyel Şilte 650',
      'Desibel','Kapı Paneli','Panel','Marin');

  -- Platin yalnız 2-5 cm satılır; 5 cm varsayılan uygundur.
  -- (preferred_thickness=5 ortak blokta atandı.)

  -- ── Gold ailesi (giydirme cephe) ──
  UPDATE public.plates SET
    slug = 'bonus-gold-plus-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-gold-plus-tasyunu.webp',
    meta_title = 'Bonus Gold Plus Taşyünü — Giydirme Cephe Levhası 50/70/90 kg/m³ | Taşyünü Fiyatları',
    meta_description = 'Bonus Gold Plus taşyünü giydirme cephe levhası: 50, 70 ve 90 kg/m³ yoğunluk seçenekleri, A1 yanmazlık, su itici. 3-20 cm kalınlık, bölgenize göre anında m² fiyatı.',
    catalog_description = 'Bonus Gold Plus, havalandırmalı ve havalandırmasız giydirme dış cephe sistemleri için üretilen taşyünü yalıtım levhasıdır. Üretici beyanına göre 50, 70 ve 90 kg/m³ yoğunluk seçenekleriyle üretilir; ısı iletkenlik katsayısı 0,035 W/mK ve A1 sınıfı yanmaz malzemedir. Su itici yapısı nemlenmeye bağlı ısı kaybını önler. Sayfadaki yoğunluk seçiciyle varyantı değiştirebilir, bölgenize özel m² fiyatını anında görebilirsiniz. Sevkiyat tam kamyon / tam TIR kuralıyla yapılır.'
  WHERE brand_id = bonus_id AND short_name = 'Gold Plus 50';

  UPDATE public.plates SET
    slug = 'bonus-gold-black-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-gold-black-tasyunu.webp',
    meta_title = 'Bonus Gold Black Taşyünü — Siyah Cam Tüllü Giydirme Cephe Levhası | Taşyünü Fiyatları',
    meta_description = 'Bonus Gold Black siyah cam tüllü taşyünü giydirme cephe levhası: 50, 70 ve 90 kg/m³ seçenekleri, A1 yanmazlık. Bölgenize göre anında m² fiyatı.',
    catalog_description = 'Bonus Gold Black, siyah cam tülü kaplamalı taşyünü giydirme cephe levhasıdır; kaplama açık derzli cephelerde koyu ve homojen bir görünüm sağlar. Üretici beyanına göre 50, 70 ve 90 kg/m³ yoğunluk seçenekleriyle üretilir; ısı iletkenlik katsayısı 0,035 W/mK ve A1 sınıfı yanmaz malzemedir. Sayfadaki yoğunluk seçiciyle varyantı değiştirebilir, bölgenize özel m² fiyatını anında görebilirsiniz.'
  WHERE brand_id = bonus_id AND short_name = 'Gold Black 50';

  UPDATE public.plates SET
    slug = 'bonus-gold-yellow-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-gold-yellow-tasyunu.webp',
    meta_title = 'Bonus Gold Yellow Taşyünü — Sarı Cam Tüllü Giydirme Cephe Levhası | Taşyünü Fiyatları',
    meta_description = 'Bonus Gold Yellow sarı cam tüllü taşyünü giydirme cephe levhası: 50 ve 70 kg/m³ seçenekleri, A1 yanmazlık. Bölgenize göre anında m² fiyatı.',
    catalog_description = 'Bonus Gold Yellow, sarı cam tülü kaplamalı taşyünü giydirme cephe levhasıdır. Üretici beyanına göre 50 ve 70 kg/m³ yoğunluk seçenekleriyle üretilir; ısı iletkenlik katsayısı 0,035 W/mK ve A1 sınıfı yanmaz malzemedir. Sayfadaki yoğunluk seçiciyle varyantı değiştirebilir, bölgenize özel m² fiyatını anında görebilirsiniz.'
  WHERE brand_id = bonus_id AND short_name = 'Gold Yellow 50';

  UPDATE public.plates SET
    slug = 'bonus-gold-alu-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-gold-alu-tasyunu.webp',
    meta_title = 'Bonus Gold Alu Taşyünü — Alüminyum Folyolu Giydirme Cephe Levhası | Taşyünü Fiyatları',
    meta_description = 'Bonus Gold Alu alüminyum folyo kaplı taşyünü levha: 50 kg/m³, A1 yanmazlık, buhar kesici folyo. Bölgenize göre anında m² fiyatı.',
    catalog_description = 'Bonus Gold Alu, alüminyum folyo kaplamalı taşyünü yalıtım levhasıdır; folyo yüzey buhar kesici görevi görür. Üretici beyanına göre 50 kg/m³ yoğunlukta üretilir; ısı iletkenlik katsayısı 0,035 W/mK ve A1 sınıfı yanmaz malzemedir. 5-15 cm kalınlık seçenekleriyle satılır; bölgenize özel m² fiyatını anında görebilirsiniz.'
  WHERE brand_id = bonus_id AND short_name = 'Gold Alu 50';

  -- ── Premium F (taban model, mantolama) ──
  UPDATE public.plates SET
    slug = 'bonus-premium-f-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-premium-f-tasyunu.webp',
    meta_title = 'Bonus Premium F Taşyünü Mantolama Levhası — TR7.5 | Taşyünü Fiyatları',
    meta_description = 'Bonus Premium F taşyünü mantolama levhası: A1 yanmazlık, ≥7,5 kPa dik çekme (TR7.5). 4-15 cm kalınlık, bölgenize göre anında m² fiyatı.',
    catalog_description = 'Bonus Premium F, sıvalı dış cephe mantolama sistemleri için üretilen taşyünü ısı yalıtım levhasıdır ve Premium F ailesinin giriş modelidir. Üretici föyü beyanına göre dik çekme dayanımı ≥7,5 kPa (TR7.5 sınıfı), ısı iletkenlik katsayısı 0,035 W/mK ve A1 sınıfı yanmaz malzemedir; föyde yoğunluk beyanı yer almaz. Üretici fiyat listesinde 4-15 cm arası kalınlıklarla yer alır. Daha yüksek dik çekme dayanımı arayan projeler için föy beyanlı F 120 ve F 150 modelleri ayrıca katalogdadır. Fiyat, üreticinin bölge listesine göre şehrinize özel hesaplanır.'
  WHERE brand_id = bonus_id AND short_name = 'Premium F';

  -- ── Premium R ailesi (çatı) ──
  UPDATE public.plates SET
    slug = 'bonus-premium-r-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-premium-r-tasyunu.webp',
    meta_title = 'Bonus Premium R Taşyünü Çatı Levhası — ≥35 kPa Basma Dayanımı | Taşyünü Fiyatları',
    meta_description = 'Bonus Premium R taşyünü çatı levhası: ≥35 kPa basma dayanımı, A1 yanmazlık. Teras ve endüstriyel çatılar için, bölgenize göre anında m² fiyatı.',
    catalog_description = 'Bonus Premium R, teras çatı, endüstriyel çatı ve eğimli çatı uygulamaları için üretilen basınç dayanımlı taşyünü levhadır. Üretici beyanına göre basma dayanımı ≥35 kPa, ısı iletkenlik katsayısı 0,037 W/mK ve A1 sınıfı yanmaz malzemedir; föyde yoğunluk beyanı yer almaz. Üretici fiyat listesinde 4-15 cm arası kalınlıklarla yer alır. Daha yüksek basma dayanımı için Premium R 150 modeli ayrıca katalogdadır. Fiyat, üreticinin bölge listesine göre şehrinize özel hesaplanır.'
  WHERE brand_id = bonus_id AND short_name = 'Premium R';

  UPDATE public.plates SET
    slug = 'bonus-premium-r-150-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-premium-r-150-tasyunu.webp',
    meta_title = 'Bonus Premium R 150 Taşyünü Çatı Levhası — ≥50 kPa Basma Dayanımı | Taşyünü Fiyatları',
    meta_description = 'Bonus Premium R 150 taşyünü çatı levhası: ≥50 kPa basma dayanımı, A1 yanmazlık. Üzerinde gezilen çatılar için, bölgenize göre anında m² fiyatı.',
    catalog_description = 'Bonus Premium R 150, yük taşıyan çatı uygulamaları için üretilen yüksek basınç dayanımlı taşyünü levhadır. Üretici beyanına göre basma dayanımı ≥50 kPa, ısı iletkenlik katsayısı 0,038 W/mK ve A1 sınıfı yanmaz malzemedir; föyde yoğunluk beyanı yer almaz (addaki 150 model adıdır). Üretici fiyat listesinde 3-15 cm arası kalınlıklarla yer alır. Fiyat, üreticinin bölge listesine göre şehrinize özel hesaplanır.'
  WHERE brand_id = bonus_id AND short_name = 'Premium R 150';

  -- ── Platin / Private ──
  UPDATE public.plates SET
    slug = 'bonus-platin-110-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-platin-110-tasyunu.webp',
    meta_title = 'Bonus Platin 110 Taşyünü — Kat Arası ve Döşeme Altı Levha | Taşyünü Fiyatları',
    meta_description = 'Bonus Platin 110 taşyünü: 110 kg/m³, kat araları ve döşeme betonu altı ses/ısı yalıtımı. 2-5 cm kalınlık, bölgenize göre anında m² fiyatı.',
    catalog_description = 'Bonus Platin 110, kat aralarında ve döşeme betonu altında darbe sesi ve ısı yalıtımı için kullanılan kaplamasız taşyünü levhadır. Üretici beyanına göre yoğunluğu 110 kg/m³, ısı iletkenlik katsayısı 0,036 W/mK, basma dayanımı 20-40 mm için 5 kPa ve 50 mm için 20 kPa olup A1 sınıfı yanmaz malzemedir. Üretici fiyat listesinde 2-5 cm kalınlıklarla yer alır. Fiyat, üreticinin bölge listesine göre şehrinize özel hesaplanır.'
  WHERE brand_id = bonus_id AND short_name = 'Platin 110';

  UPDATE public.plates SET
    slug = 'bonus-private-70-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-private-70-tasyunu.webp',
    meta_title = 'Bonus Private 70 Taşyünü — Alüminyum Kaplı Klima/Havalandırma Levhası | Taşyünü Fiyatları',
    meta_description = 'Bonus Private 70 alüminyum kaplı taşyünü: 70 kg/m³, klima ve havalandırma kanalları için. 2,5-5 cm kalınlık, bölgenize göre anında m² fiyatı.',
    catalog_description = 'Bonus Private 70, klima ve havalandırma kanallarının yalıtımı için alüminyum folyo kaplamalı üretilen taşyünü levhadır. Üretici beyanına göre yoğunluğu 70 kg/m³, ısı iletkenlik katsayısı 0,036 W/mK ve A1 sınıfı yanmaz malzemedir. Üretici fiyat listesinde 2,5-5 cm kalınlıklarla yer alır. Fiyat, üreticinin bölge listesine göre şehrinize özel hesaplanır.'
  WHERE brand_id = bonus_id AND short_name = 'Private 70';

  -- ── Endüstriyel aile ──
  UPDATE public.plates SET
    slug = 'bonus-endustriyel-levha-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-endustriyel-levha-tasyunu.webp',
    meta_title = 'Bonus Endüstriyel Taşyünü Levha — 70 / 110 kg/m³ Sanayi Yalıtımı | Taşyünü Fiyatları',
    meta_description = 'Bonus Endüstriyel taşyünü levha: 70 ve 110 kg/m³ seçenekleri, yüksek sıcaklık dayanımı, A1 yanmazlık. Sanayi tesisleri için bölgenize göre anında m² fiyatı.',
    catalog_description = 'Bonus Endüstriyel Levha, sanayi tesislerinde yüksek sıcaklığa dayanım gerektiren yüzeylerin yalıtımı için kaplamasız üretilen taşyünü levhadır. Üretici beyanına göre 70 ve 110 kg/m³ yoğunluk seçenekleriyle üretilir; ısı iletkenlik katsayısı 50 °C ortalama sıcaklıkta 0,040 W/mK olup servis sıcaklığıyla artar ve A1 sınıfı yanmaz malzemedir. Sayfadaki yoğunluk seçiciyle varyantı değiştirebilir, bölgenize özel m² fiyatını anında görebilirsiniz.'
  WHERE brand_id = bonus_id AND short_name = 'Endüstriyel Levha 70';

  UPDATE public.plates SET
    slug = 'bonus-endustriyel-silte-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-endustriyel-silte-tasyunu.webp',
    meta_title = 'Bonus Endüstriyel Şilte — Rabitz Telli Taşyünü Şilte 650/700/720/750 | Taşyünü Fiyatları',
    meta_description = 'Bonus rabitz telli taşyünü şilte: kazan, tesisat ve egzoz boruları, baca ve makine dairesi yalıtımı. 80-125 kg/m³ seçenekleri, bölgenize göre anında m² fiyatı.',
    catalog_description = 'Bonus Endüstriyel Şilte, kazanlar, tesisat ve egzoz boruları, bacalar, çift cidarlı kaplar ve çelik konstrüksiyon yüzeyler gibi sıcak ve eğrisel yüzeylerin yalıtımı için üretilen rabitz telli (tel örgülü) taşyünü şiltedir; tel örgü şiltenin boru ve tank yüzeylerine sarılarak monte edilmesini sağlar. Üretici beyanına göre 650/700/720/750 tipleri sırasıyla 80, 90, 100 ve 125 kg/m³ yoğunluktadır; ısı iletkenlik katsayısı 50 °C ortalama sıcaklıkta 0,037-0,039 W/mK olup servis sıcaklığıyla artar. Sayfadaki tip seçiciyle varyantı değiştirebilir, bölgenize özel m² fiyatını anında görebilirsiniz.'
  WHERE brand_id = bonus_id AND short_name = 'Endüstriyel Şilte 650';

  -- ── Fiyatsız (teklif-üzerine) ürünler ──
  UPDATE public.plates SET
    slug = 'bonus-desibel-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-desibel-tasyunu.webp',
    meta_title = 'Bonus Desibel — Alçı Kaplı Kompozit Taşyünü Bölme Duvar Levhası | Taşyünü Fiyatları',
    meta_description = 'Bonus Desibel alçı kaplı kompozit taşyünü levha: ara bölme ve komşu duvarlar, merdiven/asansör boşlukları için ses yalıtımı. Teklif ile fiyat.',
    catalog_description = 'Bonus Desibel, bir yüzü alçı levha kaplı, arada alüminyum folyo bulunan kompozit taşyünü levhadır; dış duvarların iç yüzeylerinde, ara bölme ve komşu duvarlarda, merdiven ve asansör boşluklarında ısı ve ses yalıtımı için kullanılır. Üretici beyanına göre taşyünü çekirdeği 110 kg/m³ yoğunluktadır ve ısı iletkenlik katsayısı 0,036 W/mK''dir. Bu ürün üretici fiyat listesinde bölge fiyatıyla yer almaz; fiyat teklifle belirlenir, formu doldurun aynı gün dönüş yapalım.'
  WHERE brand_id = bonus_id AND short_name = 'Desibel';

  UPDATE public.plates SET
    slug = 'bonus-kapi-paneli-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-kapi-paneli-tasyunu.webp',
    meta_title = 'Bonus Taşyünü Kapı Paneli — Yangın Dayanımlı Kapı Dolgusu | Taşyünü Fiyatları',
    meta_description = 'Bonus taşyünü kapı paneli: yangın dayanımlı çelik kapı ve panel dolgusu, 100-150 kg/m³, A1 yanmazlık. Teklif ile fiyat.',
    catalog_description = 'Bonus Taşyünü Kapı Paneli, yangın dayanımlı çelik kapıların ve panellerin dolgusunda kullanılan yüksek yoğunluklu taşyünü levhadır. Üretici beyanına göre 100-150 kg/m³ yoğunluk aralığında ve A1 sınıfı yanmaz malzemedir. Bu ürün üretici fiyat listesinde bölge fiyatıyla yer almaz; fiyat proje bazında teklifle belirlenir.'
  WHERE brand_id = bonus_id AND short_name = 'Kapı Paneli';

  UPDATE public.plates SET
    slug = 'bonus-panel-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-panel-tasyunu.webp',
    meta_title = 'Bonus Taşyünü Panel — Sandviç Panel Dolgu Levhası | Taşyünü Fiyatları',
    meta_description = 'Bonus taşyünü panel: sandviç panel üretimi için 100-130 kg/m³ dolgu levhası, A1 yanmazlık. Teklif ile fiyat.',
    catalog_description = 'Bonus Taşyünü Panel, sandviç panel üretiminde dolgu malzemesi olarak kullanılan taşyünü levhadır. Üretici beyanına göre 100-130 kg/m³ yoğunluk aralığında, ısı iletkenlik katsayısı 0,040 W/mK ve A1 sınıfı yanmaz malzemedir. Bu ürün üretici fiyat listesinde bölge fiyatıyla yer almaz; fiyat proje bazında teklifle belirlenir.'
  WHERE brand_id = bonus_id AND short_name = 'Panel';

  UPDATE public.plates SET
    slug = 'bonus-marin-tasyunu',
    image_cover = 'https://latlzskzemmdnotzpscc.supabase.co/storage/v1/object/public/product-images/bonus-marin-tasyunu.webp',
    meta_title = 'Bonus Marin Taşyünü — Gemi ve Tersane Yalıtımı (Levha + Şilte) | Taşyünü Fiyatları',
    meta_description = 'Bonus Marin taşyünü serisi: gemi makine dairesi, boru ve baca yalıtımı için levha (45-150 kg/m³) ve şilte (45-125 kg/m³) tipleri, A1 yanmazlık. Teklif ile fiyat.',
    catalog_description = 'Bonus Marin serisi, gemi ve tersane uygulamaları için üretilen taşyünü levha ve şilte ailesidir; makine dairelerinde, boru ve baca sarımlarında, güverte ve perde yalıtımlarında kullanılır. Üretici beyanına göre levha tipleri 45, 110, 140 ve 150 kg/m³ (alüminyum folyolu seçenekleriyle), şilte tipleri 45, 60 ve 125 kg/m³ yoğunluktadır; ısı iletkenlik katsayısı 0,036-0,037 W/mK''dir. Marin serisi üretici fiyat listesinde bölge fiyatıyla yer almaz; fiyat proje bazında teklifle belirlenir. Tuzla ve çevresindeki tersane işleri için formu doldurun, aynı gün dönüş yapalım.'
  WHERE brand_id = bonus_id AND short_name = 'Marin';

  -- ── Doğrulama kapıları ─────────────────────────────────────
  SELECT count(*) INTO n FROM public.plates
  WHERE brand_id = bonus_id AND slug IS NOT NULL;
  IF n <> 18 THEN
    RAISE EXCEPTION 'Bonus slug''lı plate sayısı 18 olmalıydı (3 eski + 15 yeni), % bulundu.', n;
  END IF;

  SELECT count(*) INTO n FROM public.plates p
  JOIN public.plates q ON q.slug = p.slug AND q.id <> p.id
  WHERE p.brand_id = bonus_id;
  IF n <> 0 THEN
    RAISE EXCEPTION 'Slug çakışması tespit edildi.';
  END IF;
END;
$v22$;

-- ─── 2. Teknik profil DB aynası (varsayılan varyantlar) ─────
-- Kaynak: lib/technical-profiles/index.ts (uygulama bu TS havuzundan
-- okur; DB kaydı bütünlük/denetim aynasıdır). plate_id UNIQUE olduğu
-- için aile PDP'sine yalnız varsayılan varyantın profili yazılır;
-- diğer varyant profilleri (Gold Plus 70/90 vb.) TS havuzundadır.
WITH profile_seed (
  short_name, product_key, application_scope,
  density_min, density_max, density_display,
  density_source_type, density_source_label, density_source_date,
  lambda_display, tensile_display, tensile_class, compressive_display,
  thickness_mm_min, thickness_mm_max, datasheet_ref
) AS (
  VALUES
    ('Gold Plus 50', 'bonus-gold-plus-50', 'giydirme_cephe',
     50, 50, '50 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,035 W/mK', 'Aranmaz', NULL, 'Aranmaz', 30, 200,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s46'),
    ('Gold Black 50', 'bonus-gold-black-50', 'giydirme_cephe',
     50, 50, '50 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,035 W/mK', 'Aranmaz', NULL, 'Aranmaz', 50, 150,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s46'),
    ('Gold Yellow 50', 'bonus-gold-yellow-50', 'giydirme_cephe',
     50, 50, '50 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,035 W/mK', 'Aranmaz', NULL, 'Aranmaz', 50, 150,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s46'),
    ('Gold Alu 50', 'bonus-gold-alu-50', 'giydirme_cephe',
     50, 50, '50 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,035 W/mK', 'Aranmaz', NULL, 'Aranmaz', 50, 150,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s46'),
    ('Premium F', 'bonus-premium-f', 'sivali_dis_cephe_mantolama',
     NULL, NULL, NULL, NULL, NULL, NULL,
     '0,035 W/mK', '≥7,5 kPa', 'TR7.5', 'Aranmaz', 40, 120,
     '_audit/teknik-foyler/2026-07/bonus-premium-f.pdf'),
    ('Premium R', 'bonus-premium-r', 'cati',
     NULL, NULL, NULL, NULL, NULL, NULL,
     '0,037 W/mK', 'Aranmaz', NULL, '≥35 kPa', 40, 150,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s62'),
    ('Premium R 150', 'bonus-premium-r-150', 'cati',
     NULL, NULL, NULL, NULL, NULL, NULL,
     '0,038 W/mK', 'Aranmaz', NULL, '≥50 kPa', 30, 150,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s62'),
    ('Platin 110', 'bonus-platin-110', 'kat_arasi_doseme',
     110, 110, '110 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,036 W/mK', 'Aranmaz', NULL, '5 kPa (20–40 mm), 20 kPa (50 mm)', 20, 50,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s65'),
    ('Private 70', 'bonus-private-70', 'tesisat',
     70, 70, '70 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,036 W/mK', 'Aranmaz', NULL, 'Aranmaz', 25, 50,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s67'),
    ('Endüstriyel Levha 70', 'bonus-endustriyel-levha-70', 'endustriyel',
     70, 70, '70 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,040 W/mK (50 °C; servis sıcaklığıyla artar)', 'Aranmaz', NULL, 'Aranmaz', 25, 120,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s69'),
    ('Endüstriyel Şilte 650', 'bonus-endustriyel-silte-650', 'endustriyel',
     80, 80, '80 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,039 W/mK (50 °C; servis sıcaklığıyla artar)', 'Aranmaz', NULL, 'Aranmaz', 50, 120,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s72'),
    -- Varyant çıpalarının profilleri (TS havuzuyla 1:1 ayna)
    ('Gold Plus 70', 'bonus-gold-plus-70', 'giydirme_cephe',
     70, 70, '70 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,035 W/mK', 'Aranmaz', NULL, 'Aranmaz', 30, 150,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s46'),
    ('Gold Plus 90', 'bonus-gold-plus-90', 'giydirme_cephe',
     90, 90, '90 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,035 W/mK', 'Aranmaz', NULL, 'Aranmaz', 30, 150,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s46'),
    ('Gold Black 70', 'bonus-gold-black-70', 'giydirme_cephe',
     70, 70, '70 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,035 W/mK', 'Aranmaz', NULL, 'Aranmaz', 30, 150,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s46'),
    ('Gold Black 90', 'bonus-gold-black-90', 'giydirme_cephe',
     90, 90, '90 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,035 W/mK', 'Aranmaz', NULL, 'Aranmaz', 30, 150,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s46'),
    ('Gold Yellow 70', 'bonus-gold-yellow-70', 'giydirme_cephe',
     70, 70, '70 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,035 W/mK', 'Aranmaz', NULL, 'Aranmaz', 30, 150,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s46'),
    ('Endüstriyel Levha 110', 'bonus-endustriyel-levha-110', 'endustriyel',
     110, 110, '110 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,040 W/mK (50 °C; servis sıcaklığıyla artar)', 'Aranmaz', NULL, 'Aranmaz', 25, 120,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s69'),
    ('Endüstriyel Şilte 700', 'bonus-endustriyel-silte-700', 'endustriyel',
     90, 90, '90 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,039 W/mK (50 °C; servis sıcaklığıyla artar)', 'Aranmaz', NULL, 'Aranmaz', 50, 120,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s72'),
    ('Endüstriyel Şilte 720', 'bonus-endustriyel-silte-720', 'endustriyel',
     100, 100, '100 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,038 W/mK (50 °C; servis sıcaklığıyla artar)', 'Aranmaz', NULL, 'Aranmaz', 50, 120,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s72'),
    ('Endüstriyel Şilte 750', 'bonus-endustriyel-silte-750', 'endustriyel',
     125, 125, '125 kg/m³', 'datasheet', 'Föy beyanı', DATE '2026-07-20',
     '0,037 W/mK (50 °C; servis sıcaklığıyla artar)', 'Aranmaz', NULL, 'Aranmaz', 50, 120,
     '_audit/teknik-foyler/2026-07/bonus-fiyat-listesi-haziran-2026.pdf#s72')
)
INSERT INTO public.plate_technical_profiles
  (plate_id, product_key, application_scope,
   wizard_eligible, comparison_eligible,
   density_min_kg_m3, density_max_kg_m3, density_display,
   density_source_type, density_source_label, density_source_date,
   lambda_display, tensile_display, tensile_class, compressive_display,
   fire_class, thickness_mm_min, thickness_mm_max, datasheet_ref)
SELECT
  p.id, s.product_key, s.application_scope,
  false, false,
  s.density_min, s.density_max, s.density_display,
  s.density_source_type, s.density_source_label, s.density_source_date,
  s.lambda_display, s.tensile_display, s.tensile_class, s.compressive_display,
  'A1', s.thickness_mm_min, s.thickness_mm_max, s.datasheet_ref
FROM profile_seed s
JOIN public.brands b ON b.name = 'Bonus'
JOIN public.plates p ON p.brand_id = b.id AND p.short_name = s.short_name
ON CONFLICT (product_key) DO UPDATE SET
  plate_id            = EXCLUDED.plate_id,
  application_scope   = EXCLUDED.application_scope,
  wizard_eligible     = EXCLUDED.wizard_eligible,
  comparison_eligible = EXCLUDED.comparison_eligible,
  density_min_kg_m3   = EXCLUDED.density_min_kg_m3,
  density_max_kg_m3   = EXCLUDED.density_max_kg_m3,
  density_display     = EXCLUDED.density_display,
  density_source_type = EXCLUDED.density_source_type,
  density_source_label = EXCLUDED.density_source_label,
  density_source_date = EXCLUDED.density_source_date,
  lambda_display      = EXCLUDED.lambda_display,
  tensile_display     = EXCLUDED.tensile_display,
  tensile_class       = EXCLUDED.tensile_class,
  compressive_display = EXCLUDED.compressive_display,
  fire_class          = EXCLUDED.fire_class,
  thickness_mm_min    = EXCLUDED.thickness_mm_min,
  thickness_mm_max    = EXCLUDED.thickness_mm_max,
  datasheet_ref       = EXCLUDED.datasheet_ref,
  updated_at          = now();

COMMIT;

-- Geri almak için:
--   DELETE FROM public.plate_technical_profiles WHERE product_key IN (...yeni 11 anahtar...);
--   DELETE FROM public.plates WHERE brand_id=(SELECT id FROM public.brands WHERE name='Bonus')
--     AND short_name NOT IN ('F 150','F 150 Pro','F 120');
