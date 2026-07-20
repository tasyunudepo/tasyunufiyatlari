\set ON_ERROR_STOP on

-- v19 + v19b sonrası kontrat: fiyat hücreleri, golden değerler,
-- marka marjı, şehir eşlemesi ve RLS sınırı.

DO $assert$
DECLARE
  n INTEGER;
  v NUMERIC;
BEGIN
  -- 1358 fiyat hücresi: çekirdek 3 ürün 33 satır + 20 Temmuz genişletmesi
  -- 20 ürün 161 satır = 194 satır × 7 bölge (v22 + yeniden üretilmiş v19b).
  -- Genişletme uygulanmamış eski canlıda bu değer 231'dir.
  SELECT count(*) INTO n FROM public.plate_region_prices;
  IF n <> 1358 THEN
    RAISE EXCEPTION 'Beklenen 1358 fiyat hücresi, bulunan %', n;
  END IF;

  SELECT count(*) INTO n
  FROM public.plate_region_prices prp
  JOIN public.plates p ON p.id = prp.plate_id
  WHERE p.short_name = 'F 150';
  IF n <> 91 THEN
    RAISE EXCEPTION 'F 150 için 91 hücre bekleniyordu (13 kalınlık × 7), bulunan %', n;
  END IF;

  -- Golden: F 150 / 50 mm / 3. Bölge — liste 391,57 → taban 352,41
  SELECT prp.list_price INTO v
  FROM public.plate_region_prices prp
  JOIN public.plates p ON p.id = prp.plate_id
  WHERE p.short_name = 'F 150' AND prp.thickness_mm = 50 AND prp.region = 3;
  IF v IS DISTINCT FROM 391.57 THEN
    RAISE EXCEPTION 'F 150 50mm 3.bölge liste fiyatı 391.57 olmalıydı, bulunan %', v;
  END IF;

  SELECT prp.base_price INTO v
  FROM public.plate_region_prices prp
  JOIN public.plates p ON p.id = prp.plate_id
  WHERE p.short_name = 'F 150' AND prp.thickness_mm = 50 AND prp.region = 3;
  IF v IS DISTINCT FROM 352.41 THEN
    RAISE EXCEPTION 'F 150 50mm 3.bölge taban fiyatı 352.41 olmalıydı, bulunan %', v;
  END IF;

  -- Golden (genişletme): Gold Yellow 70 / 30 mm / 1. Bölge — liste 149,66
  SELECT prp.list_price INTO v
  FROM public.plate_region_prices prp
  JOIN public.plates p ON p.id = prp.plate_id
  WHERE p.short_name = 'Gold Yellow 70' AND prp.thickness_mm = 30 AND prp.region = 1;
  IF v IS DISTINCT FROM 149.66 THEN
    RAISE EXCEPTION 'Gold Yellow 70 30mm 1.bölge liste fiyatı 149.66 olmalıydı, bulunan %', v;
  END IF;

  -- Taban her hücrede liste × 0,90 (kuruşa yuvarlı)
  SELECT count(*) INTO n FROM public.plate_region_prices
  WHERE base_price <> round(list_price * 0.90, 2);
  IF n <> 0 THEN
    RAISE EXCEPTION '% hücrede taban ≠ liste × 0,90', n;
  END IF;

  -- Marka marjı: yalnız Bonus 5
  SELECT margin_pct INTO v FROM public.brands WHERE name = 'Bonus';
  IF v IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'Bonus margin_pct 5 olmalıydı, bulunan %', v;
  END IF;
  SELECT count(*) INTO n FROM public.brands WHERE name <> 'Bonus' AND margin_pct IS NOT NULL;
  IF n <> 0 THEN
    RAISE EXCEPTION 'Bonus dışında % markada margin_pct dolu', n;
  END IF;

  -- Şehir eşlemesi: yalnız 34 ve 41 NULL; örnek iller doğru bölgede
  SELECT count(*) INTO n FROM public.shipping_zones
  WHERE bonus_region IS NULL AND city_code NOT IN (34, 41);
  IF n <> 0 THEN
    RAISE EXCEPTION '% şehir eşlemesiz kaldı', n;
  END IF;
  SELECT count(*) INTO n FROM public.shipping_zones
  WHERE bonus_region IS NOT NULL AND city_code IN (34, 41);
  IF n <> 0 THEN
    RAISE EXCEPTION 'İstanbul/Kocaeli bonus_region NULL olmalı (alt-bölge sorusu)';
  END IF;

  IF (SELECT bonus_region FROM public.shipping_zones WHERE city_code = 6) <> 3 THEN
    RAISE EXCEPTION 'Ankara 3. bölge olmalı';
  END IF;
  IF (SELECT bonus_region FROM public.shipping_zones WHERE city_code = 65) <> 7 THEN
    RAISE EXCEPTION 'Van 7. bölge olmalı';
  END IF;
  IF (SELECT bonus_region FROM public.shipping_zones WHERE city_code = 14) <> 1 THEN
    RAISE EXCEPTION 'Bolu 1. bölge olmalı';
  END IF;
END;
$assert$;

-- RLS: anon taban fiyatları OKUYAMAZ (marj geri hesabı koruması)
DO $rls$
BEGIN
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM 1 FROM public.plate_region_prices LIMIT 1;
    RAISE EXCEPTION 'GÜVENLİK İHLALİ: anon plate_region_prices okuyabildi';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL; -- beklenen
  END;
  RESET ROLE;
END;
$rls$;

SELECT 'bonus-pricing-assert: OK' AS result;
