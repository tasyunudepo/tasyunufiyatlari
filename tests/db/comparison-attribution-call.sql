\set ON_ERROR_STOP on

DO $test$
DECLARE
  v_outcome       TEXT;
  v_quote_id      BIGINT;
  v_source        TEXT;
  v_session       TEXT;
  v_customer_id   BIGINT;
  v_link_status   TEXT;
  v_origin        TEXT;
  v_event_source  TEXT;
  v_rejected      BOOLEAN := false;
  v_payload       JSONB := '{
    "customer_name":"Karşılaştırma Test",
    "customer_email":"",
    "customer_phone":"05441234567",
    "customer_company":"",
    "customer_address":"",
    "material_type":"tasyunu",
    "brand_id":1,
    "brand_name":"Bonus",
    "model_name":"F 150",
    "thickness_cm":5,
    "area_m2":1200,
    "city_code":"34",
    "city_name":"İstanbul",
    "package_name":"Komple Sistem",
    "package_description":"",
    "plate_brand_name":"Bonus",
    "accessory_brand_name":"Optimix",
    "total_price":360000,
    "price_per_m2":250,
    "shipping_cost":0,
    "discount_percentage":0,
    "price_without_vat":300000,
    "vat_amount":60000,
    "package_count":240,
    "package_size_m2":5,
    "items_per_package":1,
    "vehicle_type":"truck",
    "lorry_capacity_packages":160,
    "truck_capacity_packages":240,
    "lorry_fill_percentage":150,
    "truck_fill_percentage":100,
    "package_items":{"attribution":{"entry_surface":"comparison","comparison_session_id":"cmp_m123abc_def456","result_session_id":"wiz_test"}},
    "request_type":"whatsapp_order",
    "source_channel":"comparison",
    "kvkk_consent":true,
    "consent_version":"kvkk-teklif-v1",
    "consent_purpose":"fiyat_teklifi_ve_iletisim",
    "consent_channel":"comparison"
  }'::jsonb;
BEGIN
  SELECT outcome, quote_id
    INTO v_outcome, v_quote_id
  FROM public.submit_quote_guarded(
    v_payload,
    repeat('3', 64),
    repeat('4', 64),
    repeat('5', 64),
    repeat('6', 64)
  );

  IF v_outcome <> 'created' OR v_quote_id IS NULL THEN
    RAISE EXCEPTION 'Comparison RPC created dönmedi: %, %', v_outcome, v_quote_id;
  END IF;

  SELECT
    q.source_channel,
    q.comparison_session_id,
    q.customer_id,
    q.customer_link_status,
    c.origin
  INTO v_source, v_session, v_customer_id, v_link_status, v_origin
  FROM public.quotes q
  LEFT JOIN public.customers c ON c.id = q.customer_id
  WHERE q.id = v_quote_id;

  IF v_source <> 'comparison'
     OR v_session <> 'cmp_m123abc_def456'
     OR v_customer_id IS NULL
     OR v_link_status IS NOT NULL
     OR v_origin <> 'comparison' THEN
    RAISE EXCEPTION
      'Quote/CRM atfı hatalı: source=%, session=%, customer=%, link=%, origin=%',
      v_source, v_session, v_customer_id, v_link_status, v_origin;
  END IF;

  SELECT qfe.metadata ->> 'sourceChannel'
    INTO v_event_source
  FROM public.quote_funnel_events qfe
  WHERE qfe.quote_id = v_quote_id;

  IF v_event_source <> 'comparison' THEN
    RAISE EXCEPTION 'Funnel event sourceChannel comparison değil: %', v_event_source;
  END IF;

  IF to_regclass('public.idx_quotes_comparison_session_id') IS NULL THEN
    RAISE EXCEPTION 'Comparison session partial index yok';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.quotes'::regclass
      AND attname = 'comparison_session_id'
      AND attgenerated = 's'
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'comparison_session_id STORED generated değil';
  END IF;

  -- API dışından service role ile atlatma denense bile comparison kaynağı
  -- oturumsuz yazılamamalı.
  BEGIN
    PERFORM outcome
    FROM public.submit_quote_guarded(
      jsonb_set(v_payload, '{package_items}', '{}'::jsonb),
      repeat('7', 64),
      repeat('8', 64),
      repeat('9', 64),
      repeat('a', 64)
    );
  EXCEPTION WHEN check_violation THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Oturumsuz comparison quote DB constraint tarafından reddedilmedi';
  END IF;
END;
$test$;
