-- ============================================================
-- CANLI PAKET — ADIM 2: Bonus aktivasyonu
-- Tarih: 2026-07-13
--
-- ÖN ŞART: Bonus wizard dalını içeren kod production'a deploy edilmiş
-- olmalı. Bu script Bonus levhalarını görünür yapar; wizard'da Bonus
-- markası ve F 120 / F 150 / F 150 Pro modelleri seçilebilir hâle gelir.
--
-- Güvenlik: fiyat plate_prices'tan DEĞİL, plate_region_prices +
-- brands.margin_pct üzerinden sunucuda hesaplanır; bu tablolar ADIM 1'de
-- kurulmuş olmalıdır (kontrol aşağıda).
-- ============================================================

BEGIN;

DO $precheck$
DECLARE n INTEGER;
BEGIN
  IF to_regclass('public.plate_region_prices') IS NULL THEN
    RAISE EXCEPTION 'ADIM 1 uygulanmamış: plate_region_prices yok.';
  END IF;

  SELECT count(*) INTO n
  FROM public.plate_region_prices prp
  JOIN public.plates p ON p.id = prp.plate_id
  JOIN public.brands b ON b.id = p.brand_id
  WHERE b.name = 'Bonus';
  IF n <> 231 THEN
    RAISE EXCEPTION 'ADIM 1 eksik: 231 Bonus fiyat hücresi bekleniyordu, % bulundu.', n;
  END IF;

  IF (SELECT margin_pct FROM public.brands WHERE name = 'Bonus') IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'Bonus marka marjı 5 değil; aktivasyon durduruldu.';
  END IF;
END;
$precheck$;

UPDATE public.plates p
SET is_active = true
FROM public.brands b
WHERE p.brand_id = b.id
  AND b.name = 'Bonus'
  AND p.short_name IN ('F 150', 'F 150 Pro', 'F 120');

DO $postcheck$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n
  FROM public.plates p JOIN public.brands b ON b.id = p.brand_id
  WHERE b.name = 'Bonus' AND p.is_active = true;
  IF n <> 3 THEN
    RAISE EXCEPTION 'Aktivasyon başarısız: 3 aktif Bonus levhası bekleniyordu, % bulundu.', n;
  END IF;
END;
$postcheck$;

COMMIT;

-- Geri almak için:
--   UPDATE public.plates p SET is_active = false
--   FROM public.brands b
--   WHERE p.brand_id = b.id AND b.name = 'Bonus';
