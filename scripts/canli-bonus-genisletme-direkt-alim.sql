-- ============================================================
-- Bonus genişletmesi — fiyatlı 11 PDP'yi Direkt Alım'a geçir
-- Tarih: 2026-07-20 (Emrah'ın PDP geri bildirimi, madde 3)
--
-- F ailesiyle parite: sales_mode='single_only',
-- pricing_visibility_mode='from_price' → BonusRegionPrice'a product
-- geçilir, araç seçimli PDF teklif butonu açılır (commit f6053c8 akışı).
-- Yan etki (madde 2'nin DB ayağı): single_only olunca "Takım Fiyatını
-- Gör" sistem-teklifi bloğu da kaybolur; mantolama dışı ürünlerde bu
-- blok ayrıca kodda kapsam kapısıyla gizlenir.
-- Fiyatsız 4 ürün (Desibel, Kapı Paneli, Panel, Marin) quote_only kalır.
-- ============================================================

BEGIN;

DO $direkt$
DECLARE
  bonus_id INTEGER;
  n INTEGER;
BEGIN
  SELECT id INTO bonus_id FROM public.brands WHERE name = 'Bonus';

  UPDATE public.plates SET
    sales_mode = 'single_only',
    pricing_visibility_mode = 'from_price'
  WHERE brand_id = bonus_id
    AND slug IS NOT NULL
    AND short_name IN (
      'Gold Plus 50','Gold Black 50','Gold Yellow 50','Gold Alu 50',
      'Premium F','Premium R','Premium R 150','Platin 110','Private 70',
      'Endüstriyel Levha 70','Endüstriyel Şilte 650');

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 11 THEN
    RAISE EXCEPTION 'Direkt Alım geçişi 11 satır beklerken % satır güncelledi.', n;
  END IF;

  -- Fiyatsızlar quote_only kalmalı
  SELECT count(*) INTO n FROM public.plates
  WHERE brand_id = bonus_id
    AND short_name IN ('Desibel','Kapı Paneli','Panel','Marin')
    AND sales_mode = 'quote_only';
  IF n <> 4 THEN
    RAISE EXCEPTION 'Fiyatsız 4 ürün quote_only kalmalıydı, % bulundu.', n;
  END IF;
END;
$direkt$;

COMMIT;
