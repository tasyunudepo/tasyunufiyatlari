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
