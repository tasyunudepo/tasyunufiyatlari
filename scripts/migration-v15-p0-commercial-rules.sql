-- P0 ticari kural senkronu — 13 Temmuz 2026
-- EPS komple sistem teklifi minimum 400 m².

BEGIN;

UPDATE public.material_types
SET
  min_order_m2 = 400,
  tier1_max_m2 = 800,
  tier1_margin_pct = 20,
  tier2_max_m2 = 1000,
  tier2_margin_pct = 10,
  tier3_margin_pct = 5
WHERE slug = 'eps';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.material_types
    WHERE slug = 'eps'
      AND min_order_m2 = 400
      AND tier1_max_m2 = 800
      AND tier1_margin_pct = 20
      AND tier2_max_m2 = 1000
      AND tier2_margin_pct = 10
      AND tier3_margin_pct = 5
  ) THEN
    RAISE EXCEPTION 'EPS ticari kuralı uygulanamadı';
  END IF;
END;
$$;

COMMIT;
