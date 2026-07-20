-- ============================================================
-- Bonus genişletmesi — AKTİVASYON (v22 sonrası, ayrı adım)
-- Tarih: 2026-07-20
--
-- Önkoşullar (sırayla):
--   1. migration-v22-bonus-tasyunu-genisletme.sql uygulanmış olmalı.
--   2. 15 ürün görseli product-images bucket'ına v22'deki dosya
--      adlarıyla yüklenmiş olmalı (yüklenmeden aktive etme: PDP kırık
--      görselle açılır).
--   3. Kod tarafı (bonus-region-prices.json + technical-profiles +
--      families.ts) main'e merge edilmiş olmalı.
--   4. Bu betik çalıştıktan SONRA Vercel redeploy şart: katalog
--      force-static, yeni slug'lar generateStaticParams ile build'de
--      üretilir.
-- ============================================================

BEGIN;

DO $akt$
DECLARE
  bonus_id INTEGER;
  n INTEGER;
BEGIN
  SELECT id INTO bonus_id FROM public.brands WHERE name = 'Bonus';

  -- 20 genişletme profili (11 PDP varsayılanı + 9 varyant çıpası) tam mı?
  SELECT count(*) INTO n FROM public.plate_technical_profiles
  WHERE product_key LIKE 'bonus-%'
    AND product_key NOT IN ('bonus-premium-f-150','bonus-premium-f-150-pro','bonus-premium-f-120');
  IF n <> 20 THEN
    RAISE EXCEPTION 'Teknik profil aynası eksik: 20 beklendi, % bulundu. v22 tam uygulanmamış.', n;
  END IF;

  -- Yeni ürünler wizard'a SIZMAMALI (FR-002 kapısı).
  SELECT count(*) INTO n FROM public.plate_technical_profiles
  WHERE wizard_eligible AND product_key LIKE 'bonus-%'
    AND product_key NOT IN ('bonus-premium-f-150','bonus-premium-f-150-pro','bonus-premium-f-120');
  IF n <> 0 THEN
    RAISE EXCEPTION 'Wizard sızıntısı: % yeni Bonus ürünü wizard_eligible=true.', n;
  END IF;

  UPDATE public.plates SET is_active = true
  WHERE brand_id = bonus_id
    AND is_active = false
    AND short_name IN (
      'Gold Plus 50','Gold Black 50','Gold Yellow 50','Gold Alu 50',
      'Premium F','Premium R','Premium R 150','Platin 110','Private 70',
      'Endüstriyel Levha 70','Endüstriyel Şilte 650',
      'Desibel','Kapı Paneli','Panel','Marin');

  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Aktive edilen plate sayısı: %', n;

  SELECT count(*) INTO n FROM public.plates
  WHERE brand_id = bonus_id AND is_active AND slug IS NOT NULL;
  IF n <> 18 THEN
    RAISE EXCEPTION 'Aktif Bonus PDP sayısı 18 olmalıydı, % bulundu.', n;
  END IF;
END;
$akt$;

COMMIT;

-- Sonraki adım: Vercel redeploy (yeni slug'lar statik üretime girsin).
-- Geri almak için:
--   UPDATE public.plates SET is_active=false
--   WHERE brand_id=(SELECT id FROM public.brands WHERE name='Bonus')
--     AND short_name NOT IN ('F 150','F 150 Pro','F 120');
