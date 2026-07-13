-- ============================================================
-- Migration v20 — Bonus harman paket tanımları
-- Tarih: 2026-07-13
--
-- Karar (Emrah, 13 Temmuz 2026 — karar 13 revizyonu): Bonus levha
-- komple set olarak üç toz grubu harmanıyla satılır:
--   1) Expert (Fawori Expert) → Premium Sistem
--   2) Optimix                → Dengeli Sistem
--   3) TEKNO                  → Ekonomik Sistem
--
-- Sıralama ve rozetler mevcut marka kalıbıyla aynıdır (bkz. Expert
-- tanımları id 7-9). Eski üretim kodu Bonus için package_definitions
-- okumaz (ayrı levha-kartı akışı); bu satırların yeni wizard kodu
-- deploy edilmeden eklenmesi canlıyı ETKİLEMEZ.
-- ============================================================

BEGIN;

DO $v20$
DECLARE
  bonus_id   INTEGER;
  expert_id  INTEGER;
  optimix_id INTEGER;
  tekno_id   INTEGER;
  n          INTEGER;
BEGIN
  SELECT id INTO bonus_id   FROM public.brands WHERE name = 'Bonus';
  SELECT id INTO expert_id  FROM public.brands WHERE name = 'Expert';
  SELECT id INTO optimix_id FROM public.brands WHERE name = 'Optimix';
  SELECT id INTO tekno_id   FROM public.brands WHERE name = 'TEKNO';

  IF bonus_id IS NULL OR expert_id IS NULL OR optimix_id IS NULL OR tekno_id IS NULL THEN
    RAISE EXCEPTION 'Marka bulunamadı (Bonus/Expert/Optimix/TEKNO); migration durduruldu.';
  END IF;

  INSERT INTO public.package_definitions
    (name, tier, description, badge, warranty_years, display_order,
     is_default, is_active, plate_brand_id, accessory_brand_id, sort_order)
  SELECT v.name, v.tier, v.description, v.badge, 2, 1,
         false, true, bonus_id, v.acc_id, v.sort_order
  FROM (VALUES
    ('Premium Sistem',  'premium',     'Bonus levha + Expert toz grubu',  'Premium',    expert_id,  1),
    ('Dengeli Sistem',  'performance', 'Bonus levha + Optimix toz grubu', 'En Popüler', optimix_id, 2),
    ('Ekonomik Sistem', 'eco',         'Bonus levha + TEKNO toz grubu',   'En Uygun',   tekno_id,   3)
  ) AS v(name, tier, description, badge, acc_id, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.package_definitions pd
    WHERE pd.plate_brand_id = bonus_id AND pd.sort_order = v.sort_order
  );

  SELECT count(*) INTO n
  FROM public.package_definitions
  WHERE plate_brand_id = bonus_id AND is_active;
  IF n <> 3 THEN
    RAISE EXCEPTION 'Bonus için 3 aktif paket tanımı bekleniyordu, % bulundu.', n;
  END IF;
END;
$v20$;

COMMIT;

-- Geri almak için:
--   DELETE FROM public.package_definitions
--   WHERE plate_brand_id = (SELECT id FROM public.brands WHERE name = 'Bonus');
