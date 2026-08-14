-- Optimix toz grubu fiyat koşulu — 14 Ağustos 2026
-- Kaynak: Artvin Fawori Optimix teklif tablosu.
-- İSK1 şehirdeki optimix_toz_discount değeridir; İSK2 bayi iskontosu %8'dir.

BEGIN;

DO $$
DECLARE
  optimix_brand_id BIGINT;
BEGIN
  SELECT id
    INTO optimix_brand_id
    FROM brands
   WHERE name = 'Optimix'
   LIMIT 1;

  IF optimix_brand_id IS NULL THEN
    RAISE EXCEPTION 'Optimix markası bulunamadı; migration durduruldu.';
  END IF;

  -- Bilinmeyen bir ticari koşulu sessizce ezme.
  IF EXISTS (
    SELECT 1
      FROM accessories
     WHERE brand_id = optimix_brand_id
       AND is_active = TRUE
       AND COALESCE(discount_2, -1) NOT IN (8, 16)
  ) THEN
    RAISE EXCEPTION 'Optimix aksesuarlarında beklenmeyen İSK2 değeri var; migration durduruldu.';
  END IF;

  UPDATE accessories
     SET discount_2 = 8
   WHERE brand_id = optimix_brand_id
     AND is_active = TRUE
     AND discount_2 IS DISTINCT FROM 8;
END $$;

COMMIT;
