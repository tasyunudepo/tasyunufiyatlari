\set ON_ERROR_STOP on

-- v18 sonrası kontrat: kayıt sayıları, kaynak etiketleri, TR7.5 ayrımı,
-- Bonus pasifliği ve RLS sınırı (anon iç notu okuyamaz).

DO $assert$
DECLARE
  n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM public.plate_technical_profiles;
  IF n <> 8 THEN
    RAISE EXCEPTION 'Beklenen 8 profil, bulunan %', n;
  END IF;

  SELECT count(*) INTO n FROM public.plate_technical_profiles
  WHERE density_source_type = 'manufacturer_verbal'
    AND density_source_label = 'Üretici sözlü beyanı — değişken';
  IF n <> 3 THEN
    RAISE EXCEPTION 'Sözlü üçlünün etiketi hatalı (beklenen 3, bulunan %)', n;
  END IF;

  SELECT count(*) INTO n FROM public.plate_technical_profiles
  WHERE density_source_type = 'datasheet'
    AND density_source_label = 'Föy beyanı'
    AND datasheet_ref IS NOT NULL;
  IF n <> 5 THEN
    RAISE EXCEPTION 'Föy beyanlı beş ürün kontratı bozuk (bulunan %)', n;
  END IF;

  -- TR7.5: addaki sayı çekme sınıfıdır; yoğunluk 100–120 sözlü aralıktır.
  SELECT count(*) INTO n FROM public.plate_technical_profiles
  WHERE product_key = 'fawori-optimix-tr75'
    AND density_min_kg_m3 = 100 AND density_max_kg_m3 = 120
    AND tensile_class = 'TR7.5'
    AND density_display NOT LIKE '%7,5%';
  IF n <> 1 THEN
    RAISE EXCEPTION 'TR7.5 profili çekme sınıfı/yoğunluk ayrımını ihlal ediyor';
  END IF;

  -- Bonus levhaları var ama pasif; katalog/wizard is_active=true filtresine düşmez.
  SELECT count(*) INTO n
  FROM public.plates p JOIN public.brands b ON b.id = p.brand_id
  WHERE b.name = 'Bonus' AND p.is_active = false;
  IF n <> 3 THEN
    RAISE EXCEPTION 'Beklenen 3 pasif Bonus levhası, bulunan %', n;
  END IF;

  SELECT count(*) INTO n
  FROM public.plates p JOIN public.brands b ON b.id = p.brand_id
  WHERE b.name = 'Bonus' AND p.is_active = true;
  IF n <> 0 THEN
    RAISE EXCEPTION 'Bonus levhası aktif duruma sızdı (%)', n;
  END IF;

  -- Bonus için fiyat satırı bilinçli olarak yazılmaz (PRD A-002 kapısı).
  SELECT count(*) INTO n
  FROM public.plate_prices pp
  JOIN public.plates p ON p.id = pp.plate_id
  JOIN public.brands b ON b.id = p.brand_id
  WHERE b.name = 'Bonus';
  IF n <> 0 THEN
    RAISE EXCEPTION 'Bonus için plate_prices kaydı oluşmamalıydı (%)', n;
  END IF;

  SELECT count(*) INTO n FROM public.plate_technical_profile_private_notes;
  IF n <> 3 THEN
    RAISE EXCEPTION 'Beklenen 3 iç kaynak notu, bulunan %', n;
  END IF;
END;
$assert$;

-- RLS: anon profilleri okur, iç notu okuyamaz.
DO $rls$
DECLARE
  n INTEGER;
BEGIN
  SET LOCAL ROLE anon;

  SELECT count(*) INTO n FROM public.plate_technical_profiles;
  IF n <> 8 THEN
    RAISE EXCEPTION 'anon profil okuması bozuk (beklenen 8, bulunan %)', n;
  END IF;

  BEGIN
    PERFORM 1 FROM public.plate_technical_profile_private_notes LIMIT 1;
    RAISE EXCEPTION 'GÜVENLİK İHLALİ: anon iç kaynak notunu okuyabildi';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL; -- beklenen sonuç
  END;

  RESET ROLE;
END;
$rls$;

SELECT 'technical-profiles-assert: OK' AS result;
