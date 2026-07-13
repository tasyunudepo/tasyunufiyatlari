-- ============================================================
-- CANLI PAKET — ADIM 1: Bonus veri altyapısı (v18 + v19 + v19b)
-- Tarih: 2026-07-13
--
-- Supabase SQL Editor'da TEK SEFERDE çalıştırılır. Üç migration
-- sırayla uygulanır; her biri kendi BEGIN/COMMIT bloğundadır ve
-- doğrulama kapıları başarısız olursa o blok kendini geri alır.
--
-- Bu adım siteyi ETKİLEMEZ: Bonus levhaları is_active=false kurulur.
-- Aktivasyon (ADIM 2) yalnız yeni kod deploy edildikten sonra yapılır.
-- ============================================================

-- ============================================================
-- Migration v18 — Levha teknik profilleri (karşılaştırma verisi)
-- Tarih: 2026-07-13
--
-- Karar kaynağı:
--   - bonus-karsilastirma-fikir-turlari.md (Tur 2 föy doğrulaması,
--     Tur 3 Emrah kararı: sekiz ürün, sözlü beyan etiketiyle girer)
--   - docs/verification/bonus-yogunluk-karsilastirma-prd.md (FR-001,
--     FR-006, AC-001, AC-006)
--
-- Amaç:
--   - plates.density tek sayı alanı kaynak/aralık taşımıyor; teknik
--     karşılaştırma bunun yerine plate_technical_profiles üzerinden
--     beslenecek.
--   - Yoğunluk iki kaynak türüyle kaydedilir:
--       datasheet           → "Föy beyanı"
--       manufacturer_verbal → "Üretici sözlü beyanı — değişken"
--   - Sözlü bildirimin iç kaynak notu ayrı, public erişime kapalı
--     tabloda tutulur (FORCE RLS + policy yok → yalnız service_role).
--   - Bonus markası ve üç Bonus levhası is_active=false olarak eklenir;
--     doğrulanmış ticari fiyat (PRD A-002) gelmeden katalog/wizard'a
--     düşmezler. plate_prices satırı bilinçli olarak YAZILMAZ.
--
-- Bu migration eklemelidir; rollback için:
--   scripts/migration-v18b-rollback-plate-technical-profiles.sql
-- ============================================================

BEGIN;

-- ─── 1. Şema ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plate_technical_profiles (
  id                    BIGSERIAL PRIMARY KEY,
  plate_id              INTEGER NOT NULL UNIQUE
                        REFERENCES public.plates(id) ON DELETE CASCADE,
  product_key           TEXT NOT NULL UNIQUE,
  application_scope     TEXT NOT NULL DEFAULT 'sivali_dis_cephe_mantolama',
  wizard_eligible       BOOLEAN NOT NULL DEFAULT false,
  comparison_eligible   BOOLEAN NOT NULL DEFAULT false,
  density_min_kg_m3     NUMERIC NOT NULL,
  density_max_kg_m3     NUMERIC NOT NULL,
  density_display       TEXT NOT NULL,
  density_source_type   TEXT NOT NULL
    CHECK (density_source_type IN ('datasheet', 'manufacturer_verbal')),
  density_source_label  TEXT NOT NULL,
  density_source_date   DATE NOT NULL,
  lambda_display        TEXT,
  tensile_display       TEXT,
  tensile_class         TEXT,
  compressive_display   TEXT,
  fire_class            TEXT NOT NULL DEFAULT 'A1',
  thickness_mm_min      INTEGER,
  thickness_mm_max      INTEGER,
  datasheet_ref         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT plate_technical_profiles_density_range
    CHECK (density_min_kg_m3 <= density_max_kg_m3),
  -- Föy beyanı belge referansı olmadan kaydedilemez (yayın kapısı).
  CONSTRAINT plate_technical_profiles_datasheet_ref_required
    CHECK (density_source_type <> 'datasheet' OR datasheet_ref IS NOT NULL),
  CONSTRAINT plate_technical_profiles_thickness_range
    CHECK (
      thickness_mm_min IS NULL
      OR thickness_mm_max IS NULL
      OR thickness_mm_min <= thickness_mm_max
    )
);

-- Sözlü bildirimin iç kaydı: kim/hangi kanal. Müşteriye ve public
-- API'ye asla açılmaz (AC-006).
CREATE TABLE IF NOT EXISTS public.plate_technical_profile_private_notes (
  id                   BIGSERIAL PRIMARY KEY,
  profile_id           BIGINT NOT NULL UNIQUE
                       REFERENCES public.plate_technical_profiles(id) ON DELETE CASCADE,
  internal_source_note TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. RLS ─────────────────────────────────────────────────

ALTER TABLE public.plate_technical_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.plate_technical_profiles TO anon, authenticated;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'plate_technical_profiles'
      AND policyname = 'plate_technical_profiles_public_read'
  ) THEN
    CREATE POLICY plate_technical_profiles_public_read
      ON public.plate_technical_profiles
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END;
$policy$;

ALTER TABLE public.plate_technical_profile_private_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plate_technical_profile_private_notes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.plate_technical_profile_private_notes FROM anon, authenticated;
-- Bilinçli: private notes için hiçbir policy tanımlanmaz.
-- Yalnız RLS bypass yetkili service_role okuyabilir.

-- ─── 3. Bonus markası ve levhaları (pasif) ──────────────────

INSERT INTO public.brands (name, tier, description)
SELECT 'Bonus', 'premium', 'Eryap Grup taş yünü levha markası'
WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE name = 'Bonus');

-- Üç Bonus levhası; is_active=false → katalog ve wizard sorguları
-- (is_active=true filtresi) bu ürünleri ticari veri gelene dek görmez.
INSERT INTO public.plates
  (brand_id, category_id, material_type_id, name, short_name,
   density, thickness_options, is_active)
SELECT
  (SELECT id FROM public.brands WHERE name = 'Bonus'),
  (SELECT id FROM public.product_categories WHERE slug = 'mantolama'),
  (SELECT id FROM public.material_types WHERE slug = 'tasyunu'),
  v.name, v.short_name, v.density, v.thickness_options::jsonb, false
FROM (VALUES
  ('Bonus Premium F 150 Taşyünü Isı Yalıtım Levhası',     'F 150',     150, '[2,3,4,5,6,7,8,9,10,11,12,13]'),
  ('Bonus Premium F 150 Pro Taşyünü Isı Yalıtım Levhası', 'F 150 Pro', 150, '[3,4,5,6,7,8,9,10,11,12]'),
  ('Bonus Premium F 120 Taşyünü Isı Yalıtım Levhası',     'F 120',     120, '[3,4,5,6,7,8,9,10,11,12,13]')
) AS v(name, short_name, density, thickness_options)
WHERE NOT EXISTS (
  SELECT 1 FROM public.plates p
  JOIN public.brands b ON b.id = p.brand_id
  WHERE b.name = 'Bonus' AND p.short_name = v.short_name
);

-- ─── 4. Sekiz ürünün teknik profili (idempotent UPSERT) ─────

WITH profile_seed (
  brand_name, short_name, product_key,
  wizard_eligible, comparison_eligible,
  density_min, density_max, density_display,
  density_source_type, density_source_label, density_source_date,
  lambda_display, tensile_display, tensile_class, compressive_display,
  fire_class, thickness_mm_min, thickness_mm_max, datasheet_ref
) AS (
  VALUES
    ('Bonus', 'F 150', 'bonus-premium-f-150',
     true, true,
     150, 150, '150 kg/m³ (±%10)',
     'datasheet', 'Föy beyanı', DATE '2026-07-13',
     '0,036–0,040 W/mK (kalınlığa göre)', '15 kPa', NULL,
     '40–70 kPa (kalınlığa göre; ince kalınlıkta NPD)',
     'A1', 20, 130, '_audit/teknik-foyler/2026-07/bonus-premium-f-150.pdf'),

    ('Bonus', 'F 150 Pro', 'bonus-premium-f-150-pro',
     true, true,
     150, 150, '150 kg/m³ (±%10)',
     'datasheet', 'Föy beyanı', DATE '2026-07-13',
     '0,036–0,038 W/mK (kalınlığa göre)', '10 kPa', NULL,
     '35–50 kPa (ince kalınlıkta NPD)',
     'A1', 30, 120, '_audit/teknik-foyler/2026-07/bonus-premium-f-150-pro.pdf'),

    ('Expert', 'HD150', 'expert-hd150',
     true, true,
     150, 150, '≥150 kg/m³',
     'datasheet', 'Föy beyanı', DATE '2026-07-13',
     '0,038 W/mK', '≥15 kPa', 'TR15',
     '≥40 kPa — CS(10)40 (30 mm için föy notu: değer farklılaşabilir)',
     'A1', 30, 150, 'docs/ExpertTaşyünüHD150IsiYalitimLevhasiTDS.pdf'),

    ('Bonus', 'F 120', 'bonus-premium-f-120',
     true, true,
     120, 120, '120 kg/m³ (±%10)',
     'datasheet', 'Föy beyanı', DATE '2026-07-13',
     '0,036–0,038 W/mK (kalınlığa göre)', '10 kPa', NULL,
     '35–50 kPa (ince kalınlıkta NPD)',
     'A1', 30, 130, '_audit/teknik-foyler/2026-07/bonus-premium-f-120.pdf'),

    ('Expert', 'LD125', 'expert-ld125',
     true, true,
     125, 125, '≥125 kg/m³',
     'datasheet', 'Föy beyanı', DATE '2026-07-13',
     '0,037 W/mK', '≥7,5 kPa', 'TR7.5',
     '≥30 kPa — CS(10)30 (30 mm için föy notu: değer farklılaşabilir)',
     'A1', 30, 150, 'docs/6.ExpertTaşyünüLD125IsiYalitimLevhasiTDS.pdf'),

    ('Dalmaçyalı', 'SW035', 'dalmacyali-sw035',
     true, true,
     110, 120, '110–120 kg/m³',
     'manufacturer_verbal', 'Üretici sözlü beyanı — değişken', DATE '2026-07-13',
     '0,035 W/mK', '≥10 kPa', 'TR10',
     '≥30 kPa — CS(10)30 (30 mm için föy notu: değer farklılaşabilir)',
     'A1', 30, 100, 'docs/dalmacyali_stonewool_sw_035_tasyuenue_isi_yalitim_levhasi_68f039f652.pdf'),

    ('Expert', 'Premium', 'expert-tasyunu-premium',
     true, true,
     100, 110, '100–110 kg/m³',
     'manufacturer_verbal', 'Üretici sözlü beyanı — değişken', DATE '2026-07-13',
     '0,035 W/mK', '≥7,5 kPa', 'TR7.5',
     '≥25 kPa — CS(10)25 (30 mm için föy notu: değer farklılaşabilir)',
     'A1', 30, 100, 'docs/4-1ExpertTaşyünüPremiumIsiYalitimLevhasiTDS_Rev.pdf'),

    ('Optimix', 'TR7.5', 'fawori-optimix-tr75',
     true, true,
     100, 120, '100–120 kg/m³',
     'manufacturer_verbal', 'Üretici sözlü beyanı — değişken', DATE '2026-07-13',
     '0,035 W/mK', '≥7,5 kPa', 'TR7.5',
     '≥25 kPa — CS(10)25',
     'A1', 40, 150, 'docs/Fawori_Tasyuenue_TR_7_5_Isi_Yalitim_Levhasi_TDS_4b4e64b7ab.pdf')
)
INSERT INTO public.plate_technical_profiles
  (plate_id, product_key, application_scope,
   wizard_eligible, comparison_eligible,
   density_min_kg_m3, density_max_kg_m3, density_display,
   density_source_type, density_source_label, density_source_date,
   lambda_display, tensile_display, tensile_class, compressive_display,
   fire_class, thickness_mm_min, thickness_mm_max, datasheet_ref)
SELECT
  p.id, s.product_key, 'sivali_dis_cephe_mantolama',
  s.wizard_eligible, s.comparison_eligible,
  s.density_min, s.density_max, s.density_display,
  s.density_source_type, s.density_source_label, s.density_source_date,
  s.lambda_display, s.tensile_display, s.tensile_class, s.compressive_display,
  s.fire_class, s.thickness_mm_min, s.thickness_mm_max, s.datasheet_ref
FROM profile_seed s
JOIN public.brands b ON b.name = s.brand_name
JOIN public.plates p ON p.brand_id = b.id AND p.short_name = s.short_name
ON CONFLICT (product_key) DO UPDATE SET
  plate_id             = EXCLUDED.plate_id,
  wizard_eligible      = EXCLUDED.wizard_eligible,
  comparison_eligible  = EXCLUDED.comparison_eligible,
  density_min_kg_m3    = EXCLUDED.density_min_kg_m3,
  density_max_kg_m3    = EXCLUDED.density_max_kg_m3,
  density_display      = EXCLUDED.density_display,
  density_source_type  = EXCLUDED.density_source_type,
  density_source_label = EXCLUDED.density_source_label,
  density_source_date  = EXCLUDED.density_source_date,
  lambda_display       = EXCLUDED.lambda_display,
  tensile_display      = EXCLUDED.tensile_display,
  tensile_class        = EXCLUDED.tensile_class,
  compressive_display  = EXCLUDED.compressive_display,
  fire_class           = EXCLUDED.fire_class,
  thickness_mm_min     = EXCLUDED.thickness_mm_min,
  thickness_mm_max     = EXCLUDED.thickness_mm_max,
  datasheet_ref        = EXCLUDED.datasheet_ref,
  updated_at           = now();

-- ─── 5. Sözlü üçlünün iç kaynak notu ────────────────────────

INSERT INTO public.plate_technical_profile_private_notes (profile_id, internal_source_note)
SELECT tp.id,
       'Filli Boya bayi ticari bilgisi — sözlü bildirim, 13 Temmuz 2026 (Emrah). Yazılı föy beyanı yok; DoP/yazılı teyit gelirse profil datasheet kaynağına yükseltilecek.'
FROM public.plate_technical_profiles tp
WHERE tp.density_source_type = 'manufacturer_verbal'
ON CONFLICT (profile_id) DO NOTHING;

-- ─── 6. Kapanış doğrulaması — sessiz eksik kayıt yasak ──────

DO $assert$
DECLARE
  profile_count INTEGER;
  missing TEXT;
BEGIN
  SELECT count(*) INTO profile_count
  FROM public.plate_technical_profiles
  WHERE product_key IN (
    'bonus-premium-f-150', 'bonus-premium-f-150-pro', 'expert-hd150',
    'bonus-premium-f-120', 'expert-ld125', 'dalmacyali-sw035',
    'expert-tasyunu-premium', 'fawori-optimix-tr75'
  );

  IF profile_count <> 8 THEN
    SELECT string_agg(k.key, ', ') INTO missing
    FROM (VALUES
      ('bonus-premium-f-150'), ('bonus-premium-f-150-pro'), ('expert-hd150'),
      ('bonus-premium-f-120'), ('expert-ld125'), ('dalmacyali-sw035'),
      ('expert-tasyunu-premium'), ('fawori-optimix-tr75')
    ) AS k(key)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.plate_technical_profiles tp WHERE tp.product_key = k.key
    );

    RAISE EXCEPTION
      'Migration v18: 8 teknik profil bekleniyordu, % bulundu. Eksik: %. Muhtemel neden: plates.short_name / brands.name eşleşmesi canlıda farklı.',
      profile_count, missing;
  END IF;

  IF (SELECT count(*) FROM public.plate_technical_profile_private_notes) < 3 THEN
    RAISE EXCEPTION 'Migration v18: sözlü üçlünün iç kaynak notu eksik.';
  END IF;
END;
$assert$;

COMMIT;

-- ============================================================
-- Migration v19 — Bonus bölge bazlı fiyat altyapısı (şema)
-- Tarih: 2026-07-13
--
-- Karar kaynağı: bonus-karsilastirma-fikir-turlari.md Tur 4 kararları.
--   - Taban fiyat = Bonus liste fiyatı × 0,90 (KDV hariç, bölge bazlı).
--   - Kâr marjı marka önceliklidir: brands.margin_pct (yalnız Bonus %5);
--     boş markalar mevcut material_types kademe kuralında kalır.
--   - Nakliye bölgesi (1-7) şehir eşlemesi taşyünü haritasından gelir
--     (PDF s.83). İstanbul ve Kocaeli alt-bölge sorusuyla çözülür;
--     bu iki ilde bonus_region NULL bırakılır.
--
-- Veri seed'i AYRI dosyadadır (üretilmiş):
--   scripts/migration-v19b-seed-bonus-region-prices.sql
--   (kaynak: lib/pricing/bonus/bonus-region-prices.json;
--    üretici: node scripts/generate-bonus-region-price-seed.mjs)
--
-- Güvenlik sınırı:
--   - plate_region_prices tablosuna anon/authenticated ERİŞEMEZ:
--     taban fiyat (liste−%10) müşteriye açılırsa satış fiyatından marj
--     geri hesaplanabilir. Müşteri yüzeyi yalnız marj uygulanmış satış
--     fiyatını görür; bu tabloyu sadece service_role okur.
-- ============================================================

BEGIN;

-- ─── 1. brands.margin_pct — marka öncelikli marj ────────────

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS margin_pct NUMERIC;

DO $chk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'brands_margin_pct_range' AND conrelid = 'public.brands'::regclass
  ) THEN
    ALTER TABLE public.brands
      ADD CONSTRAINT brands_margin_pct_range
      CHECK (margin_pct IS NULL OR (margin_pct >= 0 AND margin_pct <= 100));
  END IF;
END;
$chk$;

-- Karar: yalnız Bonus %5; diğer markalar NULL kalır (malzeme kuralı).
UPDATE public.brands SET margin_pct = 5 WHERE name = 'Bonus';

-- ─── 2. shipping_zones.bonus_region ─────────────────────────

ALTER TABLE public.shipping_zones
  ADD COLUMN IF NOT EXISTS bonus_region SMALLINT;

DO $chk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shipping_zones_bonus_region_range'
      AND conrelid = 'public.shipping_zones'::regclass
  ) THEN
    ALTER TABLE public.shipping_zones
      ADD CONSTRAINT shipping_zones_bonus_region_range
      CHECK (bonus_region IS NULL OR (bonus_region >= 1 AND bonus_region <= 7));
  END IF;
END;
$chk$;

-- ─── 3. plate_region_prices ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plate_region_prices (
  id               BIGSERIAL PRIMARY KEY,
  plate_id         INTEGER NOT NULL
                   REFERENCES public.plates(id) ON DELETE CASCADE,
  region           SMALLINT NOT NULL CHECK (region >= 1 AND region <= 7),
  thickness_mm     INTEGER NOT NULL CHECK (thickness_mm > 0),
  -- Üretici tavsiye liste fiyatı (KDV hariç) — kaynak belgeyle birebir.
  list_price       NUMERIC(10,2) NOT NULL CHECK (list_price > 0),
  -- Sisteme kaydedilen taban: liste × 0,90 (KDV hariç, marjsız).
  base_price       NUMERIC(10,2) NOT NULL,
  package_pieces   INTEGER,
  package_m2       NUMERIC(8,2),
  truck_packages   INTEGER,
  truck_m2         NUMERIC(10,2),
  trailer_packages INTEGER,
  trailer_m2       NUMERIC(10,2),
  source_doc       TEXT NOT NULL,
  source_date      DATE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT plate_region_prices_base_below_list
    CHECK (base_price > 0 AND base_price <= list_price),
  CONSTRAINT plate_region_prices_unique_cell
    UNIQUE (plate_id, region, thickness_mm)
);

CREATE INDEX IF NOT EXISTS idx_plate_region_prices_lookup
  ON public.plate_region_prices (plate_id, thickness_mm, region);

ALTER TABLE public.plate_region_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plate_region_prices FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.plate_region_prices FROM anon, authenticated;
-- Bilinçli: policy tanımlanmaz; yalnız RLS bypass yetkili service_role okur.

COMMIT;

-- ============================================================
-- Migration v19b — Bonus bölge fiyat seed'i (ÜRETİLMİŞ DOSYA)
-- Kaynak: lib/pricing/bonus/bonus-region-prices.json
-- Üretici: node scripts/generate-bonus-region-price-seed.mjs
-- ELLE DÜZENLEMEYİN — değişiklik JSON'da yapılır, dosya yeniden üretilir.
--
-- Belge: BONUS FİYAT LİSTESİ - Haziran 2026.pdf (2026-06-08); taban = liste × 0.90
-- ============================================================

BEGIN;

-- ─── Şehir → Bonus bölgesi (İstanbul 34 ve Kocaeli 41 bilinçli NULL) ──

UPDATE public.shipping_zones sz
SET bonus_region = m.region
FROM (VALUES
  (1, 5),
  (2, 6),
  (3, 3),
  (4, 7),
  (5, 4),
  (6, 3),
  (7, 4),
  (8, 6),
  (9, 4),
  (10, 3),
  (11, 2),
  (12, 6),
  (13, 7),
  (14, 1),
  (15, 3),
  (16, 2),
  (17, 3),
  (18, 3),
  (19, 4),
  (20, 3),
  (21, 6),
  (22, 4),
  (23, 6),
  (24, 6),
  (25, 6),
  (26, 2),
  (27, 5),
  (28, 5),
  (29, 6),
  (30, 7),
  (31, 5),
  (32, 3),
  (33, 5),
  (35, 3),
  (36, 7),
  (37, 3),
  (38, 4),
  (39, 4),
  (40, 4),
  (42, 3),
  (43, 2),
  (44, 6),
  (45, 3),
  (46, 5),
  (47, 7),
  (48, 4),
  (49, 7),
  (50, 4),
  (51, 5),
  (52, 5),
  (53, 6),
  (54, 1),
  (55, 4),
  (56, 7),
  (57, 5),
  (58, 5),
  (59, 3),
  (60, 5),
  (61, 5),
  (62, 6),
  (63, 6),
  (64, 3),
  (65, 7),
  (66, 4),
  (67, 2),
  (68, 4),
  (69, 6),
  (70, 4),
  (71, 3),
  (72, 7),
  (73, 7),
  (74, 2),
  (75, 7),
  (76, 7),
  (77, 2),
  (78, 2),
  (79, 5),
  (80, 5),
  (81, 1)
) AS m(city_code, region)
WHERE sz.city_code = m.city_code;

UPDATE public.shipping_zones SET bonus_region = NULL WHERE city_code IN (34, 41);

DO $zone_assert$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM public.shipping_zones
  WHERE bonus_region IS NULL AND city_code NOT IN (34, 41);
  IF n <> 0 THEN
    RAISE EXCEPTION 'v19b: % şehir bonus_region eşlemesi olmadan kaldı', n;
  END IF;
END;
$zone_assert$;

-- ─── Bölge fiyatları (231 hücre) ──────────────────────────

WITH seed (brand_name, short_name, region, thickness_mm, list_price, base_price,
           package_pieces, package_m2, truck_packages, truck_m2,
           trailer_packages, trailer_m2) AS (
  VALUES
  ('Bonus', 'F 150', 1, 20, 220.54, 198.49, 10, 7.2, 288, 2073.6, 528, 3801.6),
  ('Bonus', 'F 150', 2, 20, 224.75, 202.28, 10, 7.2, 288, 2073.6, 528, 3801.6),
  ('Bonus', 'F 150', 3, 20, 230.01, 207.01, 10, 7.2, 288, 2073.6, 528, 3801.6),
  ('Bonus', 'F 150', 4, 20, 235.27, 211.74, 10, 7.2, 288, 2073.6, 528, 3801.6),
  ('Bonus', 'F 150', 5, 20, 244.22, 219.80, 10, 7.2, 288, 2073.6, 528, 3801.6),
  ('Bonus', 'F 150', 6, 20, 253.68, 228.31, 10, 7.2, 288, 2073.6, 528, 3801.6),
  ('Bonus', 'F 150', 7, 20, 265.26, 238.73, 10, 7.2, 288, 2073.6, 528, 3801.6),
  ('Bonus', 'F 150', 1, 30, 241.01, 216.91, 6, 4.32, 360, 1555.2, 660, 2851.2),
  ('Bonus', 'F 150', 2, 30, 246.63, 221.97, 6, 4.32, 360, 1555.2, 660, 2851.2),
  ('Bonus', 'F 150', 3, 30, 253.64, 228.28, 6, 4.32, 360, 1555.2, 660, 2851.2),
  ('Bonus', 'F 150', 4, 30, 260.66, 234.59, 6, 4.32, 360, 1555.2, 660, 2851.2),
  ('Bonus', 'F 150', 5, 30, 272.58, 245.32, 6, 4.32, 360, 1555.2, 660, 2851.2),
  ('Bonus', 'F 150', 6, 30, 285.21, 256.69, 6, 4.32, 360, 1555.2, 660, 2851.2),
  ('Bonus', 'F 150', 7, 30, 300.64, 270.58, 6, 4.32, 360, 1555.2, 660, 2851.2),
  ('Bonus', 'F 150', 1, 40, 297.02, 267.32, 5, 3.6, 336, 1209.6, 616, 2217.6),
  ('Bonus', 'F 150', 2, 40, 304.23, 273.81, 5, 3.6, 336, 1209.6, 616, 2217.6),
  ('Bonus', 'F 150', 3, 40, 313.25, 281.93, 5, 3.6, 336, 1209.6, 616, 2217.6),
  ('Bonus', 'F 150', 4, 40, 322.27, 290.04, 5, 3.6, 336, 1209.6, 616, 2217.6),
  ('Bonus', 'F 150', 5, 40, 337.60, 303.84, 5, 3.6, 336, 1209.6, 616, 2217.6),
  ('Bonus', 'F 150', 6, 40, 353.84, 318.46, 5, 3.6, 336, 1209.6, 616, 2217.6),
  ('Bonus', 'F 150', 7, 40, 373.68, 336.31, 5, 3.6, 336, 1209.6, 616, 2217.6),
  ('Bonus', 'F 150', 1, 50, 371.27, 334.14, 4, 2.88, 336, 967.7, 616, 1774.1),
  ('Bonus', 'F 150', 2, 50, 380.29, 342.26, 4, 2.88, 336, 967.7, 616, 1774.1),
  ('Bonus', 'F 150', 3, 50, 391.57, 352.41, 4, 2.88, 336, 967.7, 616, 1774.1),
  ('Bonus', 'F 150', 4, 50, 402.84, 362.56, 4, 2.88, 336, 967.7, 616, 1774.1),
  ('Bonus', 'F 150', 5, 50, 422.00, 379.80, 4, 2.88, 336, 967.7, 616, 1774.1),
  ('Bonus', 'F 150', 6, 50, 442.30, 398.07, 4, 2.88, 336, 967.7, 616, 1774.1),
  ('Bonus', 'F 150', 7, 50, 467.10, 420.39, 4, 2.88, 336, 967.7, 616, 1774.1),
  ('Bonus', 'F 150', 1, 60, 446.03, 401.43, 3, 2.16, 360, 777.6, 660, 1425.6),
  ('Bonus', 'F 150', 2, 60, 457.25, 411.53, 3, 2.16, 360, 777.6, 660, 1425.6),
  ('Bonus', 'F 150', 3, 60, 471.28, 424.15, 3, 2.16, 360, 777.6, 660, 1425.6),
  ('Bonus', 'F 150', 4, 60, 485.31, 436.78, 3, 2.16, 360, 777.6, 660, 1425.6),
  ('Bonus', 'F 150', 5, 60, 509.16, 458.24, 3, 2.16, 360, 777.6, 660, 1425.6),
  ('Bonus', 'F 150', 6, 60, 534.41, 480.97, 3, 2.16, 360, 777.6, 660, 1425.6),
  ('Bonus', 'F 150', 7, 60, 565.28, 508.75, 3, 2.16, 360, 777.6, 660, 1425.6),
  ('Bonus', 'F 150', 1, 70, 520.19, 468.17, 3, 2.16, 312, 673.9, 572, 1235.5),
  ('Bonus', 'F 150', 2, 70, 533.14, 479.83, 3, 2.16, 312, 673.9, 572, 1235.5),
  ('Bonus', 'F 150', 3, 70, 549.33, 494.40, 3, 2.16, 312, 673.9, 572, 1235.5),
  ('Bonus', 'F 150', 4, 70, 565.51, 508.96, 3, 2.16, 312, 673.9, 572, 1235.5),
  ('Bonus', 'F 150', 5, 70, 593.03, 533.73, 3, 2.16, 312, 673.9, 572, 1235.5),
  ('Bonus', 'F 150', 6, 70, 622.17, 559.95, 3, 2.16, 312, 673.9, 572, 1235.5),
  ('Bonus', 'F 150', 7, 70, 657.78, 592.00, 3, 2.16, 312, 673.9, 572, 1235.5),
  ('Bonus', 'F 150', 1, 80, 594.57, 535.11, 2, 1.44, 408, 587.5, 748, 1077.1),
  ('Bonus', 'F 150', 2, 80, 609.42, 548.48, 2, 1.44, 408, 587.5, 748, 1077.1),
  ('Bonus', 'F 150', 3, 80, 627.99, 565.19, 2, 1.44, 408, 587.5, 748, 1077.1),
  ('Bonus', 'F 150', 4, 80, 646.56, 581.90, 2, 1.44, 408, 587.5, 748, 1077.1),
  ('Bonus', 'F 150', 5, 80, 678.12, 610.31, 2, 1.44, 408, 587.5, 748, 1077.1),
  ('Bonus', 'F 150', 6, 80, 711.55, 640.40, 2, 1.44, 408, 587.5, 748, 1077.1),
  ('Bonus', 'F 150', 7, 80, 752.40, 677.16, 2, 1.44, 408, 587.5, 748, 1077.1),
  ('Bonus', 'F 150', 1, 90, 669.04, 602.14, 3, 2.16, 240, 518.4, 440, 950.4),
  ('Bonus', 'F 150', 2, 90, 685.88, 617.29, 3, 2.16, 240, 518.4, 440, 950.4),
  ('Bonus', 'F 150', 3, 90, 706.92, 636.23, 3, 2.16, 240, 518.4, 440, 950.4),
  ('Bonus', 'F 150', 4, 90, 727.97, 655.17, 3, 2.16, 240, 518.4, 440, 950.4),
  ('Bonus', 'F 150', 5, 90, 763.74, 687.37, 3, 2.16, 240, 518.4, 440, 950.4),
  ('Bonus', 'F 150', 6, 90, 801.62, 721.46, 3, 2.16, 240, 518.4, 440, 950.4),
  ('Bonus', 'F 150', 7, 90, 847.92, 763.13, 3, 2.16, 240, 518.4, 440, 950.4),
  ('Bonus', 'F 150', 1, 100, 742.55, 668.30, 2, 1.44, 336, 483.8, 616, 887),
  ('Bonus', 'F 150', 2, 100, 760.58, 684.52, 2, 1.44, 336, 483.8, 616, 887),
  ('Bonus', 'F 150', 3, 100, 783.13, 704.82, 2, 1.44, 336, 483.8, 616, 887),
  ('Bonus', 'F 150', 4, 100, 805.68, 725.11, 2, 1.44, 336, 483.8, 616, 887),
  ('Bonus', 'F 150', 5, 100, 844.01, 759.61, 2, 1.44, 336, 483.8, 616, 887),
  ('Bonus', 'F 150', 6, 100, 884.59, 796.13, 2, 1.44, 336, 483.8, 616, 887),
  ('Bonus', 'F 150', 7, 100, 934.20, 840.78, 2, 1.44, 336, 483.8, 616, 887),
  ('Bonus', 'F 150', 1, 110, 818.30, 736.47, 2, 1.44, 288, 414.72, 528, 760.32),
  ('Bonus', 'F 150', 2, 110, 839.35, 755.42, 2, 1.44, 288, 414.72, 528, 760.32),
  ('Bonus', 'F 150', 3, 110, 865.65, 779.09, 2, 1.44, 288, 414.72, 528, 760.32),
  ('Bonus', 'F 150', 4, 110, 891.96, 802.76, 2, 1.44, 288, 414.72, 528, 760.32),
  ('Bonus', 'F 150', 5, 110, 936.68, 843.01, 2, 1.44, 288, 414.72, 528, 760.32),
  ('Bonus', 'F 150', 6, 110, 984.02, 885.62, 2, 1.44, 288, 414.72, 528, 760.32),
  ('Bonus', 'F 150', 7, 110, 1041.89, 937.70, 2, 1.44, 288, 414.72, 528, 760.32),
  ('Bonus', 'F 150', 1, 120, 914.30, 822.87, 2, 1.44, 264, 380.2, 484, 697),
  ('Bonus', 'F 150', 2, 120, 937.25, 843.53, 2, 1.44, 264, 380.2, 484, 697),
  ('Bonus', 'F 150', 3, 120, 965.95, 869.36, 2, 1.44, 264, 380.2, 484, 697),
  ('Bonus', 'F 150', 4, 120, 994.64, 895.18, 2, 1.44, 264, 380.2, 484, 697),
  ('Bonus', 'F 150', 5, 120, 1043.43, 939.09, 2, 1.44, 264, 380.2, 484, 697),
  ('Bonus', 'F 150', 6, 120, 1095.08, 985.57, 2, 1.44, 264, 380.2, 484, 697),
  ('Bonus', 'F 150', 7, 120, 1158.21, 1042.39, 2, 1.44, 264, 380.2, 484, 697),
  ('Bonus', 'F 150', 1, 130, 990.97, 891.87, 2, 1.44, 240, 345.6, 440, 633.6),
  ('Bonus', 'F 150', 2, 130, 1016.22, 914.60, 2, 1.44, 240, 345.6, 440, 633.6),
  ('Bonus', 'F 150', 3, 130, 1047.78, 943.00, 2, 1.44, 240, 345.6, 440, 633.6),
  ('Bonus', 'F 150', 4, 130, 1079.35, 971.42, 2, 1.44, 240, 345.6, 440, 633.6),
  ('Bonus', 'F 150', 5, 130, 1133.01, 1019.71, 2, 1.44, 240, 345.6, 440, 633.6),
  ('Bonus', 'F 150', 6, 130, 1189.83, 1070.85, 2, 1.44, 240, 345.6, 440, 633.6),
  ('Bonus', 'F 150', 7, 130, 1259.27, 1133.34, 2, 1.44, 240, 345.6, 440, 633.6),
  ('Bonus', 'F 150', 1, 150, 1142.07, 1027.86, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 150', 2, 150, 1170.13, 1053.12, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 150', 3, 150, 1205.20, 1084.68, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 150', 4, 150, 1240.28, 1116.25, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 150', 5, 150, 1299.90, 1169.91, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 150', 6, 150, 1363.03, 1226.73, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 150', 7, 150, 1440.19, 1296.17, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 120', 1, 30, 201.57, 181.41, 8, 5.76, 264, 1520.6, 484, 2787.8),
  ('Bonus', 'F 120', 2, 30, 207.31, 186.58, 8, 5.76, 264, 1520.6, 484, 2787.8),
  ('Bonus', 'F 120', 3, 30, 214.49, 193.04, 8, 5.76, 264, 1520.6, 484, 2787.8),
  ('Bonus', 'F 120', 4, 30, 221.66, 199.49, 8, 5.76, 264, 1520.6, 484, 2787.8),
  ('Bonus', 'F 120', 5, 30, 233.86, 210.47, 8, 5.76, 264, 1520.6, 484, 2787.8),
  ('Bonus', 'F 120', 6, 30, 246.77, 222.09, 8, 5.76, 264, 1520.6, 484, 2787.8),
  ('Bonus', 'F 120', 7, 30, 262.55, 236.30, 8, 5.76, 264, 1520.6, 484, 2787.8),
  ('Bonus', 'F 120', 1, 40, 239.97, 215.97, 6, 4.32, 264, 1140.5, 484, 2090.9),
  ('Bonus', 'F 120', 2, 40, 247.62, 222.86, 6, 4.32, 264, 1140.5, 484, 2090.9),
  ('Bonus', 'F 120', 3, 40, 257.18, 231.46, 6, 4.32, 264, 1140.5, 484, 2090.9),
  ('Bonus', 'F 120', 4, 40, 266.75, 240.08, 6, 4.32, 264, 1140.5, 484, 2090.9),
  ('Bonus', 'F 120', 5, 40, 283.01, 254.71, 6, 4.32, 264, 1140.5, 484, 2090.9),
  ('Bonus', 'F 120', 6, 40, 300.23, 270.21, 6, 4.32, 264, 1140.5, 484, 2090.9),
  ('Bonus', 'F 120', 7, 40, 321.27, 289.14, 6, 4.32, 264, 1140.5, 484, 2090.9),
  ('Bonus', 'F 120', 1, 50, 299.48, 269.53, 5, 3.6, 264, 950.4, 484, 1742.4),
  ('Bonus', 'F 120', 2, 50, 308.66, 277.79, 5, 3.6, 264, 950.4, 484, 1742.4),
  ('Bonus', 'F 120', 3, 50, 320.14, 288.13, 5, 3.6, 264, 950.4, 484, 1742.4),
  ('Bonus', 'F 120', 4, 50, 331.62, 298.46, 5, 3.6, 264, 950.4, 484, 1742.4),
  ('Bonus', 'F 120', 5, 50, 351.13, 316.02, 5, 3.6, 264, 950.4, 484, 1742.4),
  ('Bonus', 'F 120', 6, 50, 371.79, 334.61, 5, 3.6, 264, 950.4, 484, 1742.4),
  ('Bonus', 'F 120', 7, 50, 397.04, 357.34, 5, 3.6, 264, 950.4, 484, 1742.4),
  ('Bonus', 'F 120', 1, 60, 359.95, 323.96, 4, 2.88, 264, 760.32, 484, 1393.92),
  ('Bonus', 'F 120', 2, 60, 371.43, 334.29, 4, 2.88, 264, 760.32, 484, 1393.92),
  ('Bonus', 'F 120', 3, 60, 385.77, 347.19, 4, 2.88, 264, 760.32, 484, 1393.92),
  ('Bonus', 'F 120', 4, 60, 400.12, 360.11, 4, 2.88, 264, 760.32, 484, 1393.92),
  ('Bonus', 'F 120', 5, 60, 424.51, 382.06, 4, 2.88, 264, 760.32, 484, 1393.92),
  ('Bonus', 'F 120', 6, 60, 450.34, 405.31, 4, 2.88, 264, 760.32, 484, 1393.92),
  ('Bonus', 'F 120', 7, 60, 481.91, 433.72, 4, 2.88, 264, 760.32, 484, 1393.92),
  ('Bonus', 'F 120', 1, 70, 418.98, 377.08, 3, 2.88, 240, 691.2, 440, 1267.2),
  ('Bonus', 'F 120', 2, 70, 431.61, 388.45, 3, 2.88, 240, 691.2, 440, 1267.2),
  ('Bonus', 'F 120', 3, 70, 447.39, 402.65, 3, 2.88, 240, 691.2, 440, 1267.2),
  ('Bonus', 'F 120', 4, 70, 463.17, 416.85, 3, 2.88, 240, 691.2, 440, 1267.2),
  ('Bonus', 'F 120', 5, 70, 490.01, 441.01, 3, 2.88, 240, 691.2, 440, 1267.2),
  ('Bonus', 'F 120', 6, 70, 518.41, 466.57, 3, 2.88, 240, 691.2, 440, 1267.2),
  ('Bonus', 'F 120', 7, 70, 553.14, 497.83, 3, 2.88, 240, 691.2, 440, 1267.2),
  ('Bonus', 'F 120', 1, 80, 479.93, 431.94, 3, 2.16, 264, 570.24, 484, 1045.44),
  ('Bonus', 'F 120', 2, 80, 495.24, 445.72, 3, 2.16, 264, 570.24, 484, 1045.44),
  ('Bonus', 'F 120', 3, 80, 514.37, 462.93, 3, 2.16, 264, 570.24, 484, 1045.44),
  ('Bonus', 'F 120', 4, 80, 533.50, 480.15, 3, 2.16, 264, 570.24, 484, 1045.44),
  ('Bonus', 'F 120', 5, 80, 566.02, 509.42, 3, 2.16, 264, 570.24, 484, 1045.44),
  ('Bonus', 'F 120', 6, 80, 600.45, 540.41, 3, 2.16, 264, 570.24, 484, 1045.44),
  ('Bonus', 'F 120', 7, 80, 642.54, 578.29, 3, 2.16, 264, 570.24, 484, 1045.44),
  ('Bonus', 'F 120', 1, 90, 539.44, 485.50, 3, 2.16, 240, 518.4, 440, 950.4),
  ('Bonus', 'F 120', 2, 90, 556.28, 500.65, 3, 2.16, 240, 518.4, 440, 950.4),
  ('Bonus', 'F 120', 3, 90, 577.32, 519.59, 3, 2.16, 240, 518.4, 440, 950.4),
  ('Bonus', 'F 120', 4, 90, 598.37, 538.53, 3, 2.16, 240, 518.4, 440, 950.4),
  ('Bonus', 'F 120', 5, 90, 634.14, 570.73, 3, 2.16, 240, 518.4, 440, 950.4),
  ('Bonus', 'F 120', 6, 90, 672.02, 604.82, 3, 2.16, 240, 518.4, 440, 950.4),
  ('Bonus', 'F 120', 7, 90, 718.32, 646.49, 3, 2.16, 240, 518.4, 440, 950.4),
  ('Bonus', 'F 120', 1, 100, 598.55, 538.70, 2, 1.44, 336, 483.84, 616, 887.04),
  ('Bonus', 'F 120', 2, 100, 616.58, 554.92, 2, 1.44, 336, 483.84, 616, 887.04),
  ('Bonus', 'F 120', 3, 100, 639.13, 575.22, 2, 1.44, 336, 483.84, 616, 887.04),
  ('Bonus', 'F 120', 4, 100, 661.68, 595.51, 2, 1.44, 336, 483.84, 616, 887.04),
  ('Bonus', 'F 120', 5, 100, 700.01, 630.01, 2, 1.44, 336, 483.84, 616, 887.04),
  ('Bonus', 'F 120', 6, 100, 740.59, 666.53, 2, 1.44, 336, 483.84, 616, 887.04),
  ('Bonus', 'F 120', 7, 100, 790.20, 711.18, 2, 1.44, 336, 483.84, 616, 887.04),
  ('Bonus', 'F 120', 1, 110, 659.90, 593.91, 2, 1.44, 288, 414.72, 528, 760.32),
  ('Bonus', 'F 120', 2, 110, 680.95, 612.86, 2, 1.44, 288, 414.72, 528, 760.32),
  ('Bonus', 'F 120', 3, 110, 707.25, 636.53, 2, 1.44, 288, 414.72, 528, 760.32),
  ('Bonus', 'F 120', 4, 110, 733.56, 660.20, 2, 1.44, 288, 414.72, 528, 760.32),
  ('Bonus', 'F 120', 5, 110, 778.28, 700.45, 2, 1.44, 288, 414.72, 528, 760.32),
  ('Bonus', 'F 120', 6, 110, 825.62, 743.06, 2, 1.44, 288, 414.72, 528, 760.32),
  ('Bonus', 'F 120', 7, 110, 883.49, 795.14, 2, 1.44, 288, 414.72, 528, 760.32),
  ('Bonus', 'F 120', 1, 120, 737.18, 663.46, 2, 1.44, 264, 380.2, 484, 697),
  ('Bonus', 'F 120', 2, 120, 760.13, 684.12, 2, 1.44, 264, 380.2, 484, 697),
  ('Bonus', 'F 120', 3, 120, 788.83, 709.95, 2, 1.44, 264, 380.2, 484, 697),
  ('Bonus', 'F 120', 4, 120, 817.52, 735.77, 2, 1.44, 264, 380.2, 484, 697),
  ('Bonus', 'F 120', 5, 120, 866.31, 779.68, 2, 1.44, 264, 380.2, 484, 697),
  ('Bonus', 'F 120', 6, 120, 917.96, 826.16, 2, 1.44, 264, 380.2, 484, 697),
  ('Bonus', 'F 120', 7, 120, 981.09, 882.98, 2, 1.44, 264, 380.2, 484, 697),
  ('Bonus', 'F 120', 1, 130, 799.09, 719.18, 2, 1.44, 240, 345.6, 440, 633.6),
  ('Bonus', 'F 120', 2, 130, 824.34, 741.91, 2, 1.44, 240, 345.6, 440, 633.6),
  ('Bonus', 'F 120', 3, 130, 855.90, 770.31, 2, 1.44, 240, 345.6, 440, 633.6),
  ('Bonus', 'F 120', 4, 130, 887.47, 798.72, 2, 1.44, 240, 345.6, 440, 633.6),
  ('Bonus', 'F 120', 5, 130, 941.13, 847.02, 2, 1.44, 240, 345.6, 440, 633.6),
  ('Bonus', 'F 120', 6, 130, 997.95, 898.16, 2, 1.44, 240, 345.6, 440, 633.6),
  ('Bonus', 'F 120', 7, 130, 1067.39, 960.65, 2, 1.44, 240, 345.6, 440, 633.6),
  ('Bonus', 'F 120', 1, 150, 920.67, 828.60, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 120', 2, 150, 948.73, 853.86, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 120', 3, 150, 983.80, 885.42, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 120', 4, 150, 1018.88, 916.99, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 120', 5, 150, 1078.50, 970.65, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 120', 6, 150, 1141.63, 1027.47, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 120', 7, 150, 1218.79, 1096.91, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 150 Pro', 1, 40, 284.42, 255.98, 5, 3.6, 336, 1209.6, 616, 2217.6),
  ('Bonus', 'F 150 Pro', 2, 40, 291.63, 262.47, 5, 3.6, 336, 1209.6, 616, 2217.6),
  ('Bonus', 'F 150 Pro', 3, 40, 300.65, 270.59, 5, 3.6, 336, 1209.6, 616, 2217.6),
  ('Bonus', 'F 150 Pro', 4, 40, 309.67, 278.70, 5, 3.6, 336, 1209.6, 616, 2217.6),
  ('Bonus', 'F 150 Pro', 5, 40, 325.00, 292.50, 5, 3.6, 336, 1209.6, 616, 2217.6),
  ('Bonus', 'F 150 Pro', 6, 40, 341.24, 307.12, 5, 3.6, 336, 1209.6, 616, 2217.6),
  ('Bonus', 'F 150 Pro', 7, 40, 361.08, 324.97, 5, 3.6, 336, 1209.6, 616, 2217.6),
  ('Bonus', 'F 150 Pro', 1, 50, 348.77, 313.89, 4, 2.88, 336, 967.68, 616, 1774.08),
  ('Bonus', 'F 150 Pro', 2, 50, 357.79, 322.01, 4, 2.88, 336, 967.68, 616, 1774.08),
  ('Bonus', 'F 150 Pro', 3, 50, 369.07, 332.16, 4, 2.88, 336, 967.68, 616, 1774.08),
  ('Bonus', 'F 150 Pro', 4, 50, 380.34, 342.31, 4, 2.88, 336, 967.68, 616, 1774.08),
  ('Bonus', 'F 150 Pro', 5, 50, 399.50, 359.55, 4, 2.88, 336, 967.68, 616, 1774.08),
  ('Bonus', 'F 150 Pro', 6, 50, 419.80, 377.82, 4, 2.88, 336, 967.68, 616, 1774.08),
  ('Bonus', 'F 150 Pro', 7, 50, 444.60, 400.14, 4, 2.88, 336, 967.68, 616, 1774.08),
  ('Bonus', 'F 150 Pro', 1, 60, 419.03, 377.13, 3, 2.16, 360, 777.6, 660, 1425.6),
  ('Bonus', 'F 150 Pro', 2, 60, 430.25, 387.23, 3, 2.16, 360, 777.6, 660, 1425.6),
  ('Bonus', 'F 150 Pro', 3, 60, 444.28, 399.85, 3, 2.16, 360, 777.6, 660, 1425.6),
  ('Bonus', 'F 150 Pro', 4, 60, 458.31, 412.48, 3, 2.16, 360, 777.6, 660, 1425.6),
  ('Bonus', 'F 150 Pro', 5, 60, 482.16, 433.94, 3, 2.16, 360, 777.6, 660, 1425.6),
  ('Bonus', 'F 150 Pro', 6, 60, 507.41, 456.67, 3, 2.16, 360, 777.6, 660, 1425.6),
  ('Bonus', 'F 150 Pro', 7, 60, 538.28, 484.45, 3, 2.16, 360, 777.6, 660, 1425.6),
  ('Bonus', 'F 150 Pro', 1, 70, 488.69, 439.82, 3, 2.16, 312, 673.92, 572, 1235.52),
  ('Bonus', 'F 150 Pro', 2, 70, 501.64, 451.48, 3, 2.16, 312, 673.92, 572, 1235.52),
  ('Bonus', 'F 150 Pro', 3, 70, 517.83, 466.05, 3, 2.16, 312, 673.92, 572, 1235.52),
  ('Bonus', 'F 150 Pro', 4, 70, 534.01, 480.61, 3, 2.16, 312, 673.92, 572, 1235.52),
  ('Bonus', 'F 150 Pro', 5, 70, 561.53, 505.38, 3, 2.16, 312, 673.92, 572, 1235.52),
  ('Bonus', 'F 150 Pro', 6, 70, 590.67, 531.60, 3, 2.16, 312, 673.92, 572, 1235.52),
  ('Bonus', 'F 150 Pro', 7, 70, 626.28, 563.65, 3, 2.16, 312, 673.92, 572, 1235.52),
  ('Bonus', 'F 150 Pro', 1, 80, 558.57, 502.71, 2, 1.44, 408, 587.52, 748, 1077.12),
  ('Bonus', 'F 150 Pro', 2, 80, 573.42, 516.08, 2, 1.44, 408, 587.52, 748, 1077.12),
  ('Bonus', 'F 150 Pro', 3, 80, 591.99, 532.79, 2, 1.44, 408, 587.52, 748, 1077.12),
  ('Bonus', 'F 150 Pro', 4, 80, 610.56, 549.50, 2, 1.44, 408, 587.52, 748, 1077.12),
  ('Bonus', 'F 150 Pro', 5, 80, 642.12, 577.91, 2, 1.44, 408, 587.52, 748, 1077.12),
  ('Bonus', 'F 150 Pro', 6, 80, 675.55, 608.00, 2, 1.44, 408, 587.52, 748, 1077.12),
  ('Bonus', 'F 150 Pro', 7, 80, 716.40, 644.76, 2, 1.44, 408, 587.52, 748, 1077.12),
  ('Bonus', 'F 150 Pro', 1, 100, 697.55, 627.80, 2, 1.44, 336, 483.84, 616, 887.04),
  ('Bonus', 'F 150 Pro', 2, 100, 715.58, 644.02, 2, 1.44, 336, 483.84, 616, 887.04),
  ('Bonus', 'F 150 Pro', 3, 100, 738.13, 664.32, 2, 1.44, 336, 483.84, 616, 887.04),
  ('Bonus', 'F 150 Pro', 4, 100, 760.68, 684.61, 2, 1.44, 336, 483.84, 616, 887.04),
  ('Bonus', 'F 150 Pro', 5, 100, 799.01, 719.11, 2, 1.44, 336, 483.84, 616, 887.04),
  ('Bonus', 'F 150 Pro', 6, 100, 839.59, 755.63, 2, 1.44, 336, 483.84, 616, 887.04),
  ('Bonus', 'F 150 Pro', 7, 100, 889.20, 800.28, 2, 1.44, 336, 483.84, 616, 887.04),
  ('Bonus', 'F 150 Pro', 1, 120, 854.90, 769.41, 2, 1.44, 264, 380.16, 484, 696.96),
  ('Bonus', 'F 150 Pro', 2, 120, 877.85, 790.07, 2, 1.44, 264, 380.16, 484, 696.96),
  ('Bonus', 'F 150 Pro', 3, 120, 906.55, 815.90, 2, 1.44, 264, 380.16, 484, 696.96),
  ('Bonus', 'F 150 Pro', 4, 120, 935.24, 841.72, 2, 1.44, 264, 380.16, 484, 696.96),
  ('Bonus', 'F 150 Pro', 5, 120, 984.03, 885.63, 2, 1.44, 264, 380.16, 484, 696.96),
  ('Bonus', 'F 150 Pro', 6, 120, 1035.68, 932.11, 2, 1.44, 264, 380.16, 484, 696.96),
  ('Bonus', 'F 150 Pro', 7, 120, 1098.81, 988.93, 2, 1.44, 264, 380.16, 484, 696.96),
  ('Bonus', 'F 150 Pro', 1, 150, 1067.82, 961.04, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 150 Pro', 2, 150, 1095.88, 986.29, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 150 Pro', 3, 150, 1130.95, 1017.86, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 150 Pro', 4, 150, 1166.03, 1049.43, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 150 Pro', 5, 150, 1225.65, 1103.09, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 150 Pro', 6, 150, 1288.78, 1159.90, 2, 1.44, 216, 311, 396, 570.2),
  ('Bonus', 'F 150 Pro', 7, 150, 1365.94, 1229.35, 2, 1.44, 216, 311, 396, 570.2)
)
INSERT INTO public.plate_region_prices
  (plate_id, region, thickness_mm, list_price, base_price,
   package_pieces, package_m2, truck_packages, truck_m2,
   trailer_packages, trailer_m2, source_doc, source_date)
SELECT
  p.id, s.region, s.thickness_mm, s.list_price, s.base_price,
  s.package_pieces, s.package_m2, s.truck_packages, s.truck_m2,
  s.trailer_packages, s.trailer_m2,
  'BONUS FİYAT LİSTESİ - Haziran 2026.pdf', DATE '2026-06-08'
FROM seed s
JOIN public.brands b ON b.name = s.brand_name
JOIN public.plates p ON p.brand_id = b.id AND p.short_name = s.short_name
ON CONFLICT (plate_id, region, thickness_mm) DO UPDATE SET
  list_price       = EXCLUDED.list_price,
  base_price       = EXCLUDED.base_price,
  package_pieces   = EXCLUDED.package_pieces,
  package_m2       = EXCLUDED.package_m2,
  truck_packages   = EXCLUDED.truck_packages,
  truck_m2         = EXCLUDED.truck_m2,
  trailer_packages = EXCLUDED.trailer_packages,
  trailer_m2       = EXCLUDED.trailer_m2,
  source_doc       = EXCLUDED.source_doc,
  source_date      = EXCLUDED.source_date,
  updated_at       = now();

DO $price_assert$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n
  FROM public.plate_region_prices prp
  JOIN public.plates p ON p.id = prp.plate_id
  JOIN public.brands b ON b.id = p.brand_id
  WHERE b.name = 'Bonus';
  IF n <> 231 THEN
    RAISE EXCEPTION 'v19b: 231 fiyat hücresi bekleniyordu, % bulundu. plates/brands eşleşmesini kontrol edin.', n;
  END IF;
END;
$price_assert$;

COMMIT;
