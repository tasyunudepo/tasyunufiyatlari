\set ON_ERROR_STOP on

DO $test$
DECLARE
  v_payload JSONB := '{
    "customer_name":"Limit Test",
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
  }'::jsonb;
  v_outcome TEXT;
  v_retry INTEGER;
  v_limited_by TEXT;
BEGIN
  SELECT outcome INTO v_outcome
  FROM public.submit_quote_guarded(
    v_payload, repeat('e', 64), repeat('e', 64), repeat('c', 64), repeat('d', 64)
  );
  IF v_outcome <> 'created' THEN
    RAISE EXCEPTION 'İkinci benzersiz teklif created olmalıydı: %', v_outcome;
  END IF;

  SELECT outcome INTO v_outcome
  FROM public.submit_quote_guarded(
    v_payload, repeat('f', 64), repeat('f', 64), repeat('c', 64), repeat('d', 64)
  );
  IF v_outcome <> 'created' THEN
    RAISE EXCEPTION 'Üçüncü benzersiz teklif created olmalıydı: %', v_outcome;
  END IF;

  SELECT outcome, retry_after_seconds, limited_by
    INTO v_outcome, v_retry, v_limited_by
  FROM public.submit_quote_guarded(
    v_payload, repeat('1', 64), repeat('1', 64), repeat('c', 64), repeat('2', 64)
  );
  IF v_outcome <> 'rate_limited' OR v_retry < 1 OR v_limited_by <> 'phone' THEN
    RAISE EXCEPTION 'Telefon limiti bekleniyordu: %, %, %', v_outcome, v_retry, v_limited_by;
  END IF;
END;
$test$;

