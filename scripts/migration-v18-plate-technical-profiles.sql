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
