-- ============================================================
-- Migration v26 — Karşılaştırma yolculuğu ve CRM atfı
-- Tarih: 2026-08-31
--
-- Amaç:
--   - package_items.attribution.comparison_session_id değerini sorgulanabilir,
--     indeksli bir quote kolonu hâline getirmek
--   - source_channel='comparison' tekliflerini CRM'de doğru ilk temas
--     kaynağıyla bağlamak
--   - v17 submit_quote_guarded imzasını ve allowlist'ini değiştirmemek
--
-- Yayın sırası: önce bu migration, sonra comparison source üreten uygulama.
-- Üretime uygulamadan önce canlı fonksiyon/constraint farkı salt-okunur
-- önkontrolle doğrulanmalıdır.
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- v26, v17 + v24 üstüne kurulur. Eksik zincirde sessizce yarım kurulum yapma.
DO $dependencies$
BEGIN
  IF to_regclass('public.quotes') IS NULL THEN
    RAISE EXCEPTION 'v26 bağımlılığı eksik: public.quotes';
  END IF;
  IF to_regclass('public.customers') IS NULL THEN
    RAISE EXCEPTION 'v26 bağımlılığı eksik: public.customers (v24)';
  END IF;
  IF to_regprocedure('public.submit_quote_guarded(jsonb,text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'v26 bağımlılığı eksik: submit_quote_guarded (v17)';
  END IF;
  IF to_regprocedure('public.normalize_phone_tr(text)') IS NULL THEN
    RAISE EXCEPTION 'v26 bağımlılığı eksik: normalize_phone_tr (v24)';
  END IF;
  IF to_regprocedure('public.quotes_link_customer()') IS NULL THEN
    RAISE EXCEPTION 'v26 bağımlılığı eksik: quotes_link_customer (v24)';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.quotes'::regclass
      AND attname IN ('package_items', 'source_channel', 'customer_id')
      AND NOT attisdropped
    GROUP BY attrelid
    HAVING count(*) = 3
  ) THEN
    RAISE EXCEPTION 'v26 bağımlılığı eksik: quotes package_items/source_channel/customer_id';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.quotes'::regclass
      AND tgname = 'trg_quotes_link_customer'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'v26 bağımlılığı eksik: trg_quotes_link_customer';
  END IF;
END;
$dependencies$;

-- Kaynak veri RPC'nin zaten kabul ettiği package_items JSONB'sidir. STORED
-- generated kolon iki ayrı session doğruluğu oluşmasını engeller ve eski
-- istemcilerin payload sözleşmesini bozmadan SQL/BI sorgusunu hızlandırır.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS comparison_session_id TEXT
  GENERATED ALWAYS AS (
    NULLIF(
      btrim(package_items #>> '{attribution,comparison_session_id}'),
      ''
    )
  ) STORED;

DO $generated_column$
DECLARE
  v_type       TEXT;
  v_generated  "char";
  v_expression TEXT;
BEGIN
  SELECT
    pg_catalog.format_type(a.atttypid, a.atttypmod),
    a.attgenerated,
    pg_catalog.pg_get_expr(d.adbin, d.adrelid)
  INTO v_type, v_generated, v_expression
  FROM pg_catalog.pg_attribute a
  LEFT JOIN pg_catalog.pg_attrdef d
    ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = 'public.quotes'::regclass
    AND a.attname = 'comparison_session_id'
    AND NOT a.attisdropped;

  IF v_type IS DISTINCT FROM 'text'
     OR v_generated IS DISTINCT FROM 's'
     OR v_expression NOT LIKE '%comparison_session_id%' THEN
    RAISE EXCEPTION 'quotes.comparison_session_id beklenen STORED generated TEXT kolon değil';
  END IF;
END;
$generated_column$;

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_comparison_session_id_format,
  DROP CONSTRAINT IF EXISTS quotes_comparison_source_requires_session,
  DROP CONSTRAINT IF EXISTS quotes_comparison_session_requires_source;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_comparison_session_id_format
    CHECK (
      comparison_session_id IS NULL
      OR (
        char_length(comparison_session_id) <= 80
        AND comparison_session_id ~ '^cmp_[A-Za-z0-9]+_[A-Za-z0-9]+$'
      )
    ) NOT VALID,
  ADD CONSTRAINT quotes_comparison_source_requires_session
    CHECK (
      source_channel <> 'comparison'
      OR comparison_session_id IS NOT NULL
    ) NOT VALID,
  ADD CONSTRAINT quotes_comparison_session_requires_source
    CHECK (
      comparison_session_id IS NULL
      OR source_channel = 'comparison'
    ) NOT VALID;

ALTER TABLE public.quotes
  VALIDATE CONSTRAINT quotes_comparison_session_id_format;
ALTER TABLE public.quotes
  VALIDATE CONSTRAINT quotes_comparison_source_requires_session;
ALTER TABLE public.quotes
  VALIDATE CONSTRAINT quotes_comparison_session_requires_source;

CREATE INDEX IF NOT EXISTS idx_quotes_comparison_session_id
  ON public.quotes (comparison_session_id)
  WHERE comparison_session_id IS NOT NULL;

-- Önce geniş constraint'i doğrula; sonra eski origin constraint'ini kaldır.
-- Böylece transaction içinde bile origin hiçbir anda korumasız kalmaz.
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_origin_v26_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_origin_v26_check
    CHECK (origin IN ('wizard', 'catalog', 'comparison', 'telefon', 'ofis', 'ithal'))
    NOT VALID;

ALTER TABLE public.customers
  VALIDATE CONSTRAINT customers_origin_v26_check;

DO $replace_origin_constraint$
DECLARE
  v_constraint_name TEXT;
  v_origin_attnum    SMALLINT;
BEGIN
  SELECT a.attnum
    INTO v_origin_attnum
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = 'public.customers'::regclass
    AND a.attname = 'origin'
    AND NOT a.attisdropped;

  IF v_origin_attnum IS NULL THEN
    RAISE EXCEPTION 'customers.origin kolonu bulunamadı';
  END IF;

  FOR v_constraint_name IN
    SELECT c.conname
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.customers'::regclass
      AND c.contype = 'c'
      AND c.conname <> 'customers_origin_v26_check'
      AND c.conkey = ARRAY[v_origin_attnum]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.customers DROP CONSTRAINT %I',
      v_constraint_name
    );
  END LOOP;
END;
$replace_origin_constraint$;

ALTER TABLE public.customers
  RENAME CONSTRAINT customers_origin_v26_check TO customers_origin_check;

-- v24 gövdesi korunur; yalnız comparison güvenilir CRM origin kümesine girer.
-- Mevcut müşterinin origin'i ON CONFLICT sırasında değiştirilmez: ilk temas
-- kaynağı tarihçesi korunur.
CREATE OR REPLACE FUNCTION public.quotes_link_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_phone TEXT;
  v_id    BIGINT;
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_phone := public.normalize_phone_tr(NEW.customer_phone);
  IF v_phone IS NULL THEN
    NEW.customer_link_status := 'failed';
    RETURN NEW;
  END IF;

  INSERT INTO public.customers (
    business_unit, phone_normalized, phone_display, display_name, company_name,
    email, city_code, city_name, address, customer_type, origin,
    consent_basis, kvkk_consent, consent_version, consent_timestamp,
    first_seen_at, last_contact_at
  )
  VALUES (
    'tasyunu',
    v_phone,
    NEW.customer_phone,
    COALESCE(NULLIF(btrim(NEW.customer_name), ''), 'İsimsiz müşteri'),
    NULLIF(btrim(COALESCE(NEW.customer_company, '')), ''),
    NULLIF(btrim(COALESCE(NEW.customer_email, '')), ''),
    NEW.city_code,
    NEW.city_name,
    NULLIF(btrim(COALESCE(NEW.customer_address, '')), ''),
    CASE WHEN NULLIF(btrim(COALESCE(NEW.customer_company, '')), '') IS NULL
         THEN 'bireysel' ELSE 'kurumsal' END,
    CASE WHEN NEW.source_channel IN ('wizard', 'catalog', 'comparison', 'ofis')
         THEN NEW.source_channel ELSE 'ithal' END,
    CASE WHEN NEW.kvkk_consent IS TRUE THEN 'acik_riza' ELSE 'sozlesme_hazirligi' END,
    COALESCE(NEW.kvkk_consent, false),
    NEW.consent_version,
    NEW.consent_timestamp,
    NEW.created_at,
    NEW.created_at
  )
  ON CONFLICT (business_unit, phone_normalized) DO UPDATE
    SET last_contact_at = GREATEST(
          COALESCE(public.customers.last_contact_at, EXCLUDED.last_contact_at),
          EXCLUDED.last_contact_at
        ),
        display_name = COALESCE(NULLIF(btrim(EXCLUDED.display_name), ''), public.customers.display_name),
        company_name = COALESCE(EXCLUDED.company_name, public.customers.company_name),
        email        = COALESCE(EXCLUDED.email, public.customers.email),
        city_code    = COALESCE(EXCLUDED.city_code, public.customers.city_code),
        city_name    = COALESCE(EXCLUDED.city_name, public.customers.city_name),
        updated_at   = now()
  RETURNING id INTO v_id;

  NEW.customer_id := v_id;
  NEW.customer_link_status := NULL;
  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- CRM eksikliği hiçbir koşulda teklif kaydını düşürmez.
  NEW.customer_link_status := 'failed';
  RETURN NEW;
END;
$fn$;

DO $assertions$
DECLARE
  v_origin_constraint TEXT;
  v_trigger_function   TEXT;
BEGIN
  SELECT pg_catalog.pg_get_constraintdef(c.oid)
    INTO v_origin_constraint
  FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = 'public.customers'::regclass
    AND c.conname = 'customers_origin_check';

  IF v_origin_constraint IS NULL
     OR position('comparison' IN v_origin_constraint) = 0 THEN
    RAISE EXCEPTION 'customers origin constraint comparison içermiyor';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(
    'public.quotes_link_customer()'::regprocedure
  ) INTO v_trigger_function;

  IF position('comparison' IN v_trigger_function) = 0 THEN
    RAISE EXCEPTION 'quotes_link_customer comparison eşlemesini içermiyor';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.quotes'::regclass
      AND tgname = 'trg_quotes_link_customer'
      AND tgenabled <> 'D'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'trg_quotes_link_customer etkin değil';
  END IF;
END;
$assertions$;

COMMENT ON COLUMN public.quotes.comparison_session_id IS
  'Karşılaştırma yüzeyinden başlayan anonim yolculuk kimliği; package_items attribution alanından üretilir.';

COMMIT;

-- Güvenli rollback: uygulamayı yeniden source_channel=wizard üretir hâle
-- getirmek; nullable/additive kolon ve geniş origin constraint'ini yerinde
-- bırakmaktır. Kolon/constraint silen sert rollback tarihsel atfı yok eder ve
-- ayrı veri taşıma kararı olmadan uygulanmamalıdır.
