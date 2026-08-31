\set ON_ERROR_STOP on

BEGIN;

-- quote-guard bootstrap yalnız v17'nin gerekli gördüğü kolonları kurar.
-- Gerçek v24'ün canlı şemada kullandığı eski ofis alanlarını temsil et.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS contact_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contact_successful BOOLEAN DEFAULT false;

DO $seed$
DECLARE
  v_outcome  TEXT;
  v_quote_id BIGINT;
BEGIN
  SELECT outcome, quote_id
    INTO v_outcome, v_quote_id
  FROM public.submit_quote_guarded(
    '{
      "customer_name":"V24 Backfill Test",
      "customer_email":"",
      "customer_phone":"05321234567",
      "customer_company":"",
      "customer_address":"",
      "material_type":"eps",
      "brand_id":1,
      "brand_name":"Dalmaçyalı",
      "model_name":"EPS Levha",
      "thickness_cm":5,
      "area_m2":400,
      "city_code":"34",
      "city_name":"İstanbul",
      "package_name":"EPS Sistem Paketi",
      "package_description":"",
      "plate_brand_name":"Dalmaçyalı",
      "accessory_brand_name":"Dalmaçyalı",
      "total_price":120000,
      "price_per_m2":250,
      "shipping_cost":0,
      "discount_percentage":0,
      "price_without_vat":100000,
      "vat_amount":20000,
      "package_count":80,
      "package_size_m2":5,
      "items_per_package":1,
      "vehicle_type":"none",
      "lorry_capacity_packages":null,
      "truck_capacity_packages":null,
      "lorry_fill_percentage":null,
      "truck_fill_percentage":null,
      "package_items":{},
      "request_type":"whatsapp_order",
      "source_channel":"wizard",
      "kvkk_consent":true,
      "consent_version":"kvkk-teklif-v1",
      "consent_purpose":"fiyat_teklifi_ve_iletisim",
      "consent_channel":"wizard"
    }'::jsonb,
    repeat('1', 64),
    repeat('2', 64),
    repeat('3', 64),
    repeat('4', 64)
  );

  IF v_outcome <> 'created' OR v_quote_id IS NULL THEN
    RAISE EXCEPTION 'v24 backfill seed quote oluşturulamadı: %, %', v_outcome, v_quote_id;
  END IF;

  UPDATE public.quotes
  SET admin_notes = 'Geçmiş müşteri notu',
      contact_attempted_at = now(),
      contact_successful = true
  WHERE id = v_quote_id;
END;
$seed$;

COMMIT;
