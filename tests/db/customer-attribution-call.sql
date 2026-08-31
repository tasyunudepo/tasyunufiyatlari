\set ON_ERROR_STOP on

DO $test$
DECLARE
  v_quote_id       BIGINT;
  v_customer_id    BIGINT;
  v_origin         TEXT;
  v_link_status    TEXT;
  v_customer_count INTEGER;
  v_note_count     INTEGER;
  v_call_count     INTEGER;
BEGIN
  IF to_regclass('public.customers') IS NULL
     OR to_regclass('public.customer_interactions') IS NULL THEN
    RAISE EXCEPTION 'v24 müşteri tablolarını oluşturmadı';
  END IF;

  IF NOT (
    SELECT c.relrowsecurity AND c.relforcerowsecurity
    FROM pg_catalog.pg_class c
    WHERE c.oid = 'public.customers'::regclass
  ) OR NOT (
    SELECT c.relrowsecurity AND c.relforcerowsecurity
    FROM pg_catalog.pg_class c
    WHERE c.oid = 'public.customer_interactions'::regclass
  ) THEN
    RAISE EXCEPTION 'v24 müşteri tablolarında RLS + FORCE RLS birlikte açık değil';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('customers', 'customer_interactions')
  ) THEN
    RAISE EXCEPTION 'v24 müşteri tablolarında beklenmeyen RLS policy var';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.customers', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.customers', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.customers', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.customers', 'DELETE')
     OR NOT has_table_privilege('service_role', 'public.customer_interactions', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.customer_interactions', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.customer_interactions', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.customer_interactions', 'DELETE')
     OR NOT has_sequence_privilege('service_role', 'public.customers_id_seq', 'USAGE')
     OR NOT has_sequence_privilege('service_role', 'public.customer_interactions_id_seq', 'USAGE') THEN
    RAISE EXCEPTION 'v24 service_role tablo/sequence yetkileri eksik';
  END IF;

  SELECT q.id, q.customer_id, q.customer_link_status, c.origin
    INTO v_quote_id, v_customer_id, v_link_status, v_origin
  FROM public.quotes q
  LEFT JOIN public.customers c ON c.id = q.customer_id
  WHERE q.customer_name = 'V24 Backfill Test';

  IF v_quote_id IS NULL OR v_customer_id IS NULL
     OR v_link_status IS NOT NULL OR v_origin <> 'wizard' THEN
    RAISE EXCEPTION
      'v24 backfill bağı hatalı: quote=%, customer=%, link=%, origin=%',
      v_quote_id, v_customer_id, v_link_status, v_origin;
  END IF;

  SELECT count(*) INTO v_customer_count
  FROM public.customers
  WHERE phone_normalized = '905321234567';

  SELECT count(*) INTO v_note_count
  FROM public.customer_interactions
  WHERE quote_id = v_quote_id
    AND kind = 'not'
    AND created_by = 'backfill-v24';

  SELECT count(*) INTO v_call_count
  FROM public.customer_interactions
  WHERE quote_id = v_quote_id
    AND kind = 'arama_giden'
    AND outcome = 'ulasildi'
    AND created_by = 'backfill-v24';

  IF v_customer_count <> 1 OR v_note_count <> 1 OR v_call_count <> 1 THEN
    RAISE EXCEPTION
      'v24 ikinci çalıştırmada kopya/backfill hatası: customer=%, note=%, call=%',
      v_customer_count, v_note_count, v_call_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.quotes'::regclass
      AND tgname = 'trg_quotes_link_customer'
      AND tgenabled <> 'D'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'v24 müşteri bağlama triggerı etkin değil';
  END IF;
END;
$test$;
