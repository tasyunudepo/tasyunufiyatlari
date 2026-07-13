-- ============================================================
-- Migration v17 — Atomik teklif gönderim koruması
-- Tarih: 2026-07-13
--
-- Amaç:
--   - Idempotency replay / aynı anahtar-farklı istek conflict ayrımı
--   - IP başına 10 dakikada 5 yeni teklif
--   - Telefon başına 30 dakikada 3 yeni teklif
--   - Aynı telefon + ticari fingerprint için 30 dakikalık dedupe
--   - quotes + quote_funnel_events kayıtlarını tek transaction'da yazmak
--
-- Güvenlik sınırı:
--   - Hash'ler uygulama sunucusunda, QUOTE_ABUSE_HASH_SECRET ile HMAC-SHA256
--     olarak üretilir. Bu RPC ham IP veya rate-limit amaçlı ham telefon almaz.
--   - Telefon, müşteriyle iletişim kurulabilmesi için yalnızca mevcut quotes
--     iş kaydında bulunur. Guard tablolarında sadece 64 haneli özet saklanır.
--   - quotes.consent_ip eski şemayla uyumluluk için yerinde kalır; bu RPC o
--     kolona hiçbir zaman ham IP yazmaz.
--   - RPC yalnız service_role tarafından çalıştırılabilir.
-- ============================================================

BEGIN;

-- Kod hâlihazırda bu alanları kullanıyor. Eski kurulumlarda migration zinciri
-- eksik olsa da fonksiyonun oluşturulabilmesi için şemayı idempotent tamamla.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS request_type      TEXT NOT NULL DEFAULT 'whatsapp_order',
  ADD COLUMN IF NOT EXISTS source_channel    TEXT NOT NULL DEFAULT 'wizard',
  ADD COLUMN IF NOT EXISTS quote_code        TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url           TEXT,
  ADD COLUMN IF NOT EXISTS pdf_storage_path  TEXT,
  ADD COLUMN IF NOT EXISTS kvkk_consent      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_version   TEXT,
  ADD COLUMN IF NOT EXISTS consent_purpose   TEXT,
  ADD COLUMN IF NOT EXISTS consent_channel   TEXT,
  ADD COLUMN IF NOT EXISTS consent_ip        TEXT;

CREATE TABLE IF NOT EXISTS public.quote_submission_keys (
  id                    BIGSERIAL PRIMARY KEY,
  idempotency_hash      TEXT NOT NULL,
  request_fingerprint   TEXT NOT NULL,
  phone_hash            TEXT NOT NULL,
  quote_id              BIGINT NOT NULL
                        REFERENCES public.quotes(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT quote_submission_keys_idempotency_hash_format
    CHECK (idempotency_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT quote_submission_keys_request_fingerprint_format
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT quote_submission_keys_phone_hash_format
    CHECK (phone_hash ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_submission_keys_idempotency
  ON public.quote_submission_keys(idempotency_hash);

CREATE INDEX IF NOT EXISTS idx_quote_submission_keys_dedupe
  ON public.quote_submission_keys(phone_hash, request_fingerprint, quote_id);

CREATE INDEX IF NOT EXISTS idx_quote_submission_keys_created_at
  ON public.quote_submission_keys(created_at);

CREATE TABLE IF NOT EXISTS public.quote_rate_limit_events (
  id          BIGSERIAL PRIMARY KEY,
  ip_hash     TEXT NOT NULL,
  phone_hash  TEXT NOT NULL,
  quote_id    BIGINT NOT NULL
              REFERENCES public.quotes(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT quote_rate_limit_events_ip_hash_format
    CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT quote_rate_limit_events_phone_hash_format
    CHECK (phone_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_quote_rate_limit_events_ip_window
  ON public.quote_rate_limit_events(ip_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_rate_limit_events_phone_window
  ON public.quote_rate_limit_events(phone_hash, created_at DESC);

ALTER TABLE public.quote_submission_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_submission_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE public.quote_rate_limit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_rate_limit_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.quote_submission_keys FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.quote_rate_limit_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.quote_submission_keys_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.quote_rate_limit_events_id_seq FROM PUBLIC, anon, authenticated;

-- Dönüş sözleşmesi:
--   created      : yeni quote + funnel event yazıldı; bildirim gönderilebilir.
--   replayed     : aynı idempotency anahtarı ve aynı fingerprint; bildirim yok.
--   deduplicated : farklı anahtar, aynı telefon + fingerprint (30 dk); bildirim yok.
--   conflict     : aynı idempotency anahtarı farklı fingerprint ile kullanıldı.
--   rate_limited : IP ve/veya telefon limiti doldu; retry_after_seconds kullanılır.
--
-- p_quote_payload yalnız aşağıdaki açık allowlist'i kabul eder. Bilinmeyen alan
-- SQL hatasıyla reddedilir; böylece istemci JSON'u doğrudan tablo kaydına açılamaz.
CREATE OR REPLACE FUNCTION public.submit_quote_guarded(
  p_quote_payload        JSONB,
  p_idempotency_hash     TEXT,
  p_request_fingerprint  TEXT,
  p_phone_hash           TEXT,
  p_ip_hash              TEXT
)
RETURNS TABLE (
  outcome                 TEXT,
  quote_id                BIGINT,
  created_at              TIMESTAMPTZ,
  retry_after_seconds     INTEGER,
  limited_by              TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_now                    TIMESTAMPTZ := clock_timestamp();
  v_quote_id               BIGINT;
  v_quote_created_at       TIMESTAMPTZ;
  v_existing_fingerprint   TEXT;
  v_lock_key               BIGINT;
  v_ip_count               INTEGER := 0;
  v_phone_count            INTEGER := 0;
  v_ip_oldest              TIMESTAMPTZ;
  v_phone_oldest           TIMESTAMPTZ;
  v_ip_retry               INTEGER := 0;
  v_phone_retry            INTEGER := 0;
  v_retry_after            INTEGER := 0;
  v_limited_by             TEXT;
  v_request_type           TEXT;
  v_source_channel         TEXT;
  v_expected_status        TEXT;
  v_event_type             TEXT;
  v_allowed_keys           CONSTANT TEXT[] := ARRAY[
    'customer_name', 'customer_email', 'customer_phone', 'customer_company',
    'customer_address', 'material_type', 'brand_id', 'brand_name',
    'model_name', 'thickness_cm', 'area_m2', 'city_code', 'city_name',
    'package_name', 'package_description', 'plate_brand_name',
    'accessory_brand_name', 'total_price', 'price_per_m2', 'shipping_cost',
    'discount_percentage', 'price_without_vat', 'vat_amount', 'package_count',
    'package_size_m2', 'items_per_package', 'vehicle_type',
    'lorry_capacity_packages', 'truck_capacity_packages',
    'lorry_fill_percentage', 'truck_fill_percentage', 'package_items',
    'request_type', 'source_channel', 'status', 'quote_code', 'pdf_url',
    'pdf_storage_path', 'kvkk_consent', 'consent_timestamp',
    'consent_version', 'consent_purpose', 'consent_channel'
  ];
  v_required_keys          CONSTANT TEXT[] := ARRAY[
    'customer_name', 'customer_phone', 'material_type', 'brand_name',
    'thickness_cm', 'area_m2', 'city_code', 'city_name', 'package_name',
    'plate_brand_name', 'accessory_brand_name', 'total_price', 'price_per_m2',
    'price_without_vat', 'vat_amount', 'package_count', 'package_size_m2',
    'items_per_package', 'package_items', 'request_type', 'source_channel',
    'kvkk_consent', 'consent_version', 'consent_purpose', 'consent_channel'
  ];
  v_required_key           TEXT;
BEGIN
  IF p_quote_payload IS NULL OR jsonb_typeof(p_quote_payload) <> 'object' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'quote_payload bir JSON nesnesi olmalıdır';
  END IF;

  IF (p_quote_payload - v_allowed_keys) <> '{}'::JSONB THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'quote_payload allowlist dışında alan içeriyor';
  END IF;

  FOREACH v_required_key IN ARRAY v_required_keys LOOP
    IF NOT (p_quote_payload ? v_required_key)
       OR (p_quote_payload -> v_required_key) = 'null'::JSONB THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = format('quote_payload zorunlu alanı eksik: %s', v_required_key);
    END IF;
  END LOOP;

  IF p_idempotency_hash IS NULL
     OR p_request_fingerprint IS NULL
     OR p_phone_hash IS NULL
     OR p_ip_hash IS NULL
     OR p_idempotency_hash !~ '^[0-9a-f]{64}$'
     OR p_request_fingerprint !~ '^[0-9a-f]{64}$'
     OR p_phone_hash !~ '^[0-9a-f]{64}$'
     OR p_ip_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Guard hash alanları 64 haneli küçük harf hex olmalıdır';
  END IF;

  v_request_type := btrim(p_quote_payload ->> 'request_type');
  v_source_channel := btrim(p_quote_payload ->> 'source_channel');

  IF v_request_type NOT IN ('whatsapp_order', 'pdf_quote') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Geçersiz request_type';
  END IF;

  IF v_source_channel = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'source_channel boş olamaz';
  END IF;

  IF (p_quote_payload ->> 'kvkk_consent')::BOOLEAN IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'KVKK rızası olmadan teklif kaydedilemez';
  END IF;

  IF btrim(p_quote_payload ->> 'consent_version') = ''
     OR btrim(p_quote_payload ->> 'consent_purpose') = ''
     OR btrim(p_quote_payload ->> 'consent_channel') = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Rıza sürümü, amacı ve kanalı boş olamaz';
  END IF;

  IF jsonb_typeof(p_quote_payload -> 'package_items') <> 'object' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'package_items bir JSON nesnesi olmalıdır';
  END IF;

  v_expected_status := CASE
    WHEN v_request_type = 'pdf_quote' THEN 'quoted'
    ELSE 'pending'
  END;

  IF p_quote_payload ? 'status'
     AND p_quote_payload ->> 'status' IS DISTINCT FROM v_expected_status THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'status, request_type ile uyumlu değil';
  END IF;

  -- Aynı IP, telefon veya idempotency anahtarıyla gelen eşzamanlı istekleri
  -- deterministik kilit sırasıyla seri hâle getirir; farklı kullanıcılar bloklanmaz.
  FOR v_lock_key IN
    SELECT DISTINCT lock_key
    FROM unnest(ARRAY[
      hashtextextended('quote-guard:idem:' || p_idempotency_hash, 0),
      hashtextextended('quote-guard:ip:' || p_ip_hash, 0),
      hashtextextended('quote-guard:phone:' || p_phone_hash, 0)
    ]) AS locks(lock_key)
    ORDER BY lock_key
  LOOP
    PERFORM pg_advisory_xact_lock(v_lock_key);
  END LOOP;

  -- Idempotency kayıtları 24 saat tutulur. Süresi dolmuş aynı anahtar güvenle
  -- yeniden kullanılabilir; eski quote iş kaydı silinmez.
  DELETE FROM public.quote_submission_keys AS qsk
  WHERE qsk.idempotency_hash = p_idempotency_hash
    AND qsk.created_at < v_now - INTERVAL '24 hours';

  SELECT qsk.request_fingerprint, q.id, q.created_at
    INTO v_existing_fingerprint, v_quote_id, v_quote_created_at
  FROM public.quote_submission_keys AS qsk
  JOIN public.quotes AS q ON q.id = qsk.quote_id
  WHERE qsk.idempotency_hash = p_idempotency_hash;

  IF FOUND THEN
    IF v_existing_fingerprint = p_request_fingerprint THEN
      RETURN QUERY SELECT
        'replayed'::TEXT,
        v_quote_id,
        v_quote_created_at,
        NULL::INTEGER,
        NULL::TEXT;
    ELSE
      RETURN QUERY SELECT
        'conflict'::TEXT,
        NULL::BIGINT,
        NULL::TIMESTAMPTZ,
        NULL::INTEGER,
        NULL::TEXT;
    END IF;
    RETURN;
  END IF;

  -- Farklı idempotency anahtarıyla yinelenen aynı ticari talebi 30 dakika
  -- boyunca mevcut quote'a bağla. quotes.created_at kullanıldığı için tekrarlar
  -- dedupe penceresini sonsuza kadar ileri taşımaz.
  SELECT q.id, q.created_at
    INTO v_quote_id, v_quote_created_at
  FROM public.quote_submission_keys AS qsk
  JOIN public.quotes AS q ON q.id = qsk.quote_id
  WHERE qsk.phone_hash = p_phone_hash
    AND qsk.request_fingerprint = p_request_fingerprint
    AND q.created_at >= v_now - INTERVAL '30 minutes'
  ORDER BY q.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.quote_submission_keys (
      idempotency_hash,
      request_fingerprint,
      phone_hash,
      quote_id,
      created_at
    ) VALUES (
      p_idempotency_hash,
      p_request_fingerprint,
      p_phone_hash,
      v_quote_id,
      v_now
    );

    RETURN QUERY SELECT
      'deduplicated'::TEXT,
      v_quote_id,
      v_quote_created_at,
      NULL::INTEGER,
      NULL::TEXT;
    RETURN;
  END IF;

  SELECT count(*)::INTEGER, min(qrle.created_at)
    INTO v_ip_count, v_ip_oldest
  FROM public.quote_rate_limit_events AS qrle
  WHERE qrle.ip_hash = p_ip_hash
    AND qrle.created_at >= v_now - INTERVAL '10 minutes';

  SELECT count(*)::INTEGER, min(qrle.created_at)
    INTO v_phone_count, v_phone_oldest
  FROM public.quote_rate_limit_events AS qrle
  WHERE qrle.phone_hash = p_phone_hash
    AND qrle.created_at >= v_now - INTERVAL '30 minutes';

  IF v_ip_count >= 5 THEN
    v_ip_retry := greatest(
      1,
      ceil(extract(epoch FROM (v_ip_oldest + INTERVAL '10 minutes' - v_now)))::INTEGER
    );
  END IF;

  IF v_phone_count >= 3 THEN
    v_phone_retry := greatest(
      1,
      ceil(extract(epoch FROM (v_phone_oldest + INTERVAL '30 minutes' - v_now)))::INTEGER
    );
  END IF;

  IF v_ip_retry > 0 OR v_phone_retry > 0 THEN
    v_retry_after := greatest(v_ip_retry, v_phone_retry);
    v_limited_by := CASE
      WHEN v_ip_retry > 0 AND v_phone_retry > 0 THEN 'ip_and_phone'
      WHEN v_ip_retry > 0 THEN 'ip'
      ELSE 'phone'
    END;

    RETURN QUERY SELECT
      'rate_limited'::TEXT,
      NULL::BIGINT,
      NULL::TIMESTAMPTZ,
      v_retry_after,
      v_limited_by;
    RETURN;
  END IF;

  -- Açık kolon listesi kasıtlıdır. JSON içindeki ek alanlar yukarıda reddedilir;
  -- payload hiçbir yerde jsonb_populate_record ile tabloya açılmaz.
  INSERT INTO public.quotes AS inserted_quote (
    customer_name,
    customer_email,
    customer_phone,
    customer_company,
    customer_address,
    material_type,
    brand_id,
    brand_name,
    model_name,
    thickness_cm,
    area_m2,
    city_code,
    city_name,
    package_name,
    package_description,
    plate_brand_name,
    accessory_brand_name,
    total_price,
    price_per_m2,
    shipping_cost,
    discount_percentage,
    price_without_vat,
    vat_amount,
    package_count,
    package_size_m2,
    items_per_package,
    vehicle_type,
    lorry_capacity_packages,
    truck_capacity_packages,
    lorry_fill_percentage,
    truck_fill_percentage,
    package_items,
    request_type,
    source_channel,
    status,
    quote_code,
    pdf_url,
    pdf_storage_path,
    kvkk_consent,
    consent_timestamp,
    consent_version,
    consent_purpose,
    consent_channel,
    consent_ip
  ) VALUES (
    btrim(p_quote_payload ->> 'customer_name'),
    coalesce(btrim(p_quote_payload ->> 'customer_email'), ''),
    btrim(p_quote_payload ->> 'customer_phone'),
    coalesce(btrim(p_quote_payload ->> 'customer_company'), ''),
    coalesce(btrim(p_quote_payload ->> 'customer_address'), ''),
    btrim(p_quote_payload ->> 'material_type'),
    NULLIF(p_quote_payload ->> 'brand_id', '')::BIGINT,
    btrim(p_quote_payload ->> 'brand_name'),
    coalesce(btrim(p_quote_payload ->> 'model_name'), ''),
    (p_quote_payload ->> 'thickness_cm')::NUMERIC,
    (p_quote_payload ->> 'area_m2')::NUMERIC,
    btrim(p_quote_payload ->> 'city_code'),
    btrim(p_quote_payload ->> 'city_name'),
    btrim(p_quote_payload ->> 'package_name'),
    coalesce(btrim(p_quote_payload ->> 'package_description'), ''),
    btrim(p_quote_payload ->> 'plate_brand_name'),
    btrim(p_quote_payload ->> 'accessory_brand_name'),
    (p_quote_payload ->> 'total_price')::NUMERIC,
    (p_quote_payload ->> 'price_per_m2')::NUMERIC,
    coalesce((p_quote_payload ->> 'shipping_cost')::NUMERIC, 0),
    coalesce((p_quote_payload ->> 'discount_percentage')::NUMERIC, 0),
    (p_quote_payload ->> 'price_without_vat')::NUMERIC,
    (p_quote_payload ->> 'vat_amount')::NUMERIC,
    (p_quote_payload ->> 'package_count')::INTEGER,
    (p_quote_payload ->> 'package_size_m2')::NUMERIC,
    (p_quote_payload ->> 'items_per_package')::INTEGER,
    NULLIF(btrim(p_quote_payload ->> 'vehicle_type'), ''),
    NULLIF(p_quote_payload ->> 'lorry_capacity_packages', '')::INTEGER,
    NULLIF(p_quote_payload ->> 'truck_capacity_packages', '')::INTEGER,
    NULLIF(p_quote_payload ->> 'lorry_fill_percentage', '')::NUMERIC,
    NULLIF(p_quote_payload ->> 'truck_fill_percentage', '')::NUMERIC,
    p_quote_payload -> 'package_items',
    v_request_type,
    v_source_channel,
    v_expected_status,
    NULLIF(btrim(p_quote_payload ->> 'quote_code'), ''),
    NULLIF(btrim(p_quote_payload ->> 'pdf_url'), ''),
    NULLIF(btrim(p_quote_payload ->> 'pdf_storage_path'), ''),
    true,
    v_now,
    btrim(p_quote_payload ->> 'consent_version'),
    btrim(p_quote_payload ->> 'consent_purpose'),
    btrim(p_quote_payload ->> 'consent_channel'),
    NULL
  )
  RETURNING inserted_quote.id, inserted_quote.created_at
    INTO v_quote_id, v_quote_created_at;

  v_event_type := CASE
    WHEN v_request_type = 'pdf_quote' THEN 'pdf_quote_requested'
    ELSE 'whatsapp_order_requested'
  END;

  INSERT INTO public.quote_funnel_events (
    event_type,
    quote_id,
    material_type,
    brand_id,
    brand_name,
    model_name,
    thickness_cm,
    area_m2,
    city_code,
    city_name,
    package_name,
    total_price,
    metadata
  ) VALUES (
    v_event_type,
    v_quote_id,
    btrim(p_quote_payload ->> 'material_type'),
    NULLIF(p_quote_payload ->> 'brand_id', '')::BIGINT,
    btrim(p_quote_payload ->> 'brand_name'),
    NULLIF(btrim(p_quote_payload ->> 'model_name'), ''),
    (p_quote_payload ->> 'thickness_cm')::NUMERIC,
    (p_quote_payload ->> 'area_m2')::NUMERIC,
    btrim(p_quote_payload ->> 'city_code'),
    btrim(p_quote_payload ->> 'city_name'),
    btrim(p_quote_payload ->> 'package_name'),
    (p_quote_payload ->> 'total_price')::NUMERIC,
    jsonb_build_object(
      'plateBrandName', p_quote_payload ->> 'plate_brand_name',
      'accessoryBrandName', p_quote_payload ->> 'accessory_brand_name',
      'vehicleType', NULLIF(p_quote_payload ->> 'vehicle_type', ''),
      'submissionType', v_request_type,
      'sourceChannel', v_source_channel
    )
  );

  INSERT INTO public.quote_rate_limit_events (
    ip_hash,
    phone_hash,
    quote_id,
    created_at
  ) VALUES (
    p_ip_hash,
    p_phone_hash,
    v_quote_id,
    v_now
  );

  INSERT INTO public.quote_submission_keys (
    idempotency_hash,
    request_fingerprint,
    phone_hash,
    quote_id,
    created_at
  ) VALUES (
    p_idempotency_hash,
    p_request_fingerprint,
    p_phone_hash,
    v_quote_id,
    v_now
  );

  RETURN QUERY SELECT
    'created'::TEXT,
    v_quote_id,
    v_quote_created_at,
    NULL::INTEGER,
    NULL::TEXT;
END;
$function$;

COMMENT ON FUNCTION public.submit_quote_guarded(JSONB, TEXT, TEXT, TEXT, TEXT) IS
  'Teklif ve funnel eventini atomik yazar; idempotency, 30 dk dedupe ve IP/telefon limitlerini HMAC özetleriyle uygular.';

REVOKE ALL ON FUNCTION public.submit_quote_guarded(JSONB, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quote_guarded(JSONB, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

-- Migration anında güvenlik varsayımlarını doğrula. Bir assertion başarısızsa
-- transaction rollback olur ve yarım güvenlik kurulumu bırakılmaz.
DO $assertions$
BEGIN
  IF NOT (
    SELECT c.relrowsecurity AND c.relforcerowsecurity
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'quote_submission_keys'
  ) THEN
    RAISE EXCEPTION 'quote_submission_keys için RLS/FORCE RLS etkin değil';
  END IF;

  IF NOT (
    SELECT c.relrowsecurity AND c.relforcerowsecurity
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'quote_rate_limit_events'
  ) THEN
    RAISE EXCEPTION 'quote_rate_limit_events için RLS/FORCE RLS etkin değil';
  END IF;

  IF has_function_privilege(
       'anon',
       'public.submit_quote_guarded(jsonb,text,text,text,text)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated',
       'public.submit_quote_guarded(jsonb,text,text,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'submit_quote_guarded anon/authenticated tarafından çalıştırılabiliyor';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.submit_quote_guarded(jsonb,text,text,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'submit_quote_guarded service_role EXECUTE yetkisi eksik';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN ('quote_submission_keys', 'quote_rate_limit_events')
      AND grantee IN ('anon', 'authenticated')
  ) THEN
    RAISE EXCEPTION 'Guard tablolarında anon/authenticated tablo yetkisi kaldı';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('quote_submission_keys', 'quote_rate_limit_events')
      AND column_name IN ('ip', 'client_ip', 'phone', 'customer_phone')
  ) THEN
    RAISE EXCEPTION 'Guard tablolarında ham IP/telefon kolonu bulunuyor';
  END IF;
END;
$assertions$;

COMMIT;

-- Operasyon notu:
-- quote_rate_limit_events için periyodik saklama temizliği önerilir:
--   DELETE FROM public.quote_rate_limit_events
--   WHERE created_at < now() - INTERVAL '7 days';
-- quote_submission_keys için 24 saatten eski anahtarlar aynı anahtar tekrar
-- geldiğinde RPC içinde silinir; ayrıca günlük toplu temizlik uygulanabilir.
