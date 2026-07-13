\set ON_ERROR_STOP on

-- v18b sonrası kontrat: yeni tablolar ve pasif Bonus verisi kalkmış,
-- mevcut beş levha ve markaları dokunulmamış olmalı.

DO $assert$
DECLARE
  n INTEGER;
BEGIN
  IF to_regclass('public.plate_technical_profiles') IS NOT NULL THEN
    RAISE EXCEPTION 'plate_technical_profiles rollback sonrası hâlâ var';
  END IF;
  IF to_regclass('public.plate_technical_profile_private_notes') IS NOT NULL THEN
    RAISE EXCEPTION 'private_notes tablosu rollback sonrası hâlâ var';
  END IF;

  SELECT count(*) INTO n FROM public.brands WHERE name = 'Bonus';
  IF n <> 0 THEN
    RAISE EXCEPTION 'Bonus markası rollback sonrası hâlâ var';
  END IF;

  SELECT count(*) INTO n FROM public.plates;
  IF n <> 5 THEN
    RAISE EXCEPTION 'Mevcut levha sayısı bozuldu (beklenen 5, bulunan %)', n;
  END IF;
END;
$assert$;

SELECT 'technical-profiles-post-rollback: OK' AS result;
