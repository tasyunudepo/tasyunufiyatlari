-- ============================================================
-- Migration v18b — v18 geri alma
-- Tarih: 2026-07-13
--
-- Sıra önemlidir: önce iç not tablosu, sonra profiller, en son
-- (yalnız güvenliyse) pasif Bonus levhaları ve Bonus markası.
--
-- Güvenlik sınırı:
--   - Bonus levhaları yalnız hâlâ pasifse (is_active=false) ve
--     hiçbir fiyat/teklif kaydı bunlara bağlanmadıysa silinir.
--   - Aktifleştirilmiş veya fiyat almış Bonus verisi bu script ile
--     SİLİNMEZ; o durumda bilinçli manuel karar gerekir.
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS public.plate_technical_profile_private_notes;
DROP TABLE IF EXISTS public.plate_technical_profiles;

-- Pasif ve fiyatsız Bonus levhalarını kaldır.
DELETE FROM public.plates p
USING public.brands b
WHERE p.brand_id = b.id
  AND b.name = 'Bonus'
  AND p.is_active = false
  AND NOT EXISTS (
    SELECT 1 FROM public.plate_prices pp WHERE pp.plate_id = p.id
  );

-- Levhası kalmadıysa Bonus markasını kaldır.
DELETE FROM public.brands b
WHERE b.name = 'Bonus'
  AND NOT EXISTS (SELECT 1 FROM public.plates p WHERE p.brand_id = b.id);

COMMIT;
