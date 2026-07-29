-- ============================================================
-- Migration v24 — Müşteri varlığı ve etkileşim defteri
-- Tarih: 2026-07-27
-- Sözleşme: docs/verification/GOAL-teklif-crm-2026-07-27.md (F1)
--
-- NEDEN: Bugüne kadar "müşteri" diye bir kayıt yok; her quotes satırı kendi
-- müşteri bilgisini denormalize taşıyor ve aynı kişinin geçmişi hiçbir yerde
-- toplanmıyor. lib/admin/groupQuotesIntoSeries.ts müşteri birleştirme değil,
-- "aynı telefon + 15 dakika" karar oturumu gruplaması. Ayrıca telefonla gelip
-- teklife dönüşmeyen talep hiç kayda giremiyor.
--
-- KRİTİK KURAL: quotes tablosuna eklenen her kolon NULL kabul eder veya
-- DEFAULT'ludur. submit_quote_guarded (v17) açık kolon listesiyle INSERT
-- ettiği için bu kural bozulursa ciro yolu düşer.
--
-- GİZLİLİK: yeni tablolar yalnız admin yüzeyinde kullanılır; v14 sertleştirme
-- kalıbı — RLS + FORCE RLS açık, policy YOK, anon/authenticated'a REVOKE.
--
-- KVKK: retention_until kolonu baştan var ama BOŞ bırakılır. Saklama/imha
-- politikası bilinçli olarak ertelendi (27 Tem 2026 kararı); bu migration
-- hiçbir otomatik silme kurmaz.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1) Telefon normalizasyonu — lib/security/quoteSubmissionGuard.ts
--    normalizePhoneForGuard() ile BİREBİR aynı davranış.
--    Parite testi: tests/pricing/phone-normalize-parity.test.ts
--    Geçersiz girdide hata fırlatmaz, NULL döner (trigger'ı düşürmemek için).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_phone_tr(p_raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  v_raw    TEXT;
  v_digits TEXT;
  v_intl   BOOLEAN;
BEGIN
  IF p_raw IS NULL THEN RETURN NULL; END IF;

  v_raw := btrim(p_raw);
  v_intl := (left(v_raw, 1) = '+' OR left(v_raw, 2) = '00');
  v_digits := regexp_replace(v_raw, '\D', '', 'g');

  IF left(v_digits, 2) = '00' THEN
    v_digits := substr(v_digits, 3);
  END IF;

  IF NOT v_intl AND length(v_digits) = 11 AND left(v_digits, 1) = '0' THEN
    v_digits := '90' || substr(v_digits, 2);
  ELSIF NOT v_intl AND length(v_digits) = 10 THEN
    v_digits := '90' || v_digits;
  END IF;

  IF length(v_digits) < 10 OR length(v_digits) > 15 THEN
    RETURN NULL;
  END IF;

  RETURN v_digits;
END;
$fn$;

-- ─────────────────────────────────────────────────────────────
-- 2) customers
--    business_unit: alcifiyatlari ileride aynı katmana bağlanabilsin diye
--    baştan var; bugün tek değer ('tasyunu').
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id                  BIGSERIAL PRIMARY KEY,
  business_unit       TEXT NOT NULL DEFAULT 'tasyunu',
  phone_normalized    TEXT NOT NULL,
  phone_display       TEXT NOT NULL,
  display_name        TEXT NOT NULL,
  company_name        TEXT NULL,
  email               TEXT NULL,
  city_code           TEXT NULL,
  city_name           TEXT NULL,
  address             TEXT NULL,
  customer_type       TEXT NOT NULL DEFAULT 'bireysel'
                      CHECK (customer_type IN ('bireysel', 'kurumsal')),
  origin              TEXT NOT NULL DEFAULT 'wizard'
                      CHECK (origin IN ('wizard', 'catalog', 'telefon', 'ofis', 'ithal')),
  owner               TEXT NULL,
  status              TEXT NOT NULL DEFAULT 'aktif'
                      CHECK (status IN ('aktif', 'pasif', 'kara_liste')),
  -- KVKK: elle/telefonla gelen müşteride açık rıza yoktur; dayanak
  -- sözleşme hazırlığıdır (m.5/2-c). Sahte rıza kaydı YAZILMAZ.
  kvkk_consent        BOOLEAN NOT NULL DEFAULT false,
  consent_basis       TEXT NULL
                      CHECK (consent_basis IS NULL OR consent_basis IN
                        ('acik_riza', 'sozlesme_hazirligi', 'mesru_menfaat')),
  consent_version     TEXT NULL,
  consent_channel     TEXT NULL,
  consent_timestamp   TIMESTAMPTZ NULL,
  consent_recorded_by TEXT NULL,
  -- Saklama politikası kararı ertelendi; kolon boş durur, otomatik silme yok.
  retention_until     DATE NULL,
  notes               TEXT NULL,
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_contact_at     TIMESTAMPTZ NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customers_phone_benzersiz UNIQUE (business_unit, phone_normalized)
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone_normalized);
CREATE INDEX IF NOT EXISTS idx_customers_last_contact ON public.customers (last_contact_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_customers_display_name ON public.customers (lower(display_name));

-- ─────────────────────────────────────────────────────────────
-- 3) customer_interactions — append-only etkileşim defteri
--    Bugün admin_notes tek alan ve üzerine yazılıyor; ikinci arama
--    kaydedilemiyor. Burada her temas ayrı satır.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_interactions (
  id                  BIGSERIAL PRIMARY KEY,
  customer_id         BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  quote_id            BIGINT NULL REFERENCES public.quotes(id) ON DELETE SET NULL,
  kind                TEXT NOT NULL
                      CHECK (kind IN ('arama_giden', 'arama_gelen', 'whatsapp', 'eposta',
                                      'ziyaret', 'not', 'teklif_gonderildi',
                                      'kvkk_aydinlatma', 'hatirlatma')),
  outcome             TEXT NULL
                      CHECK (outcome IS NULL OR outcome IN
                        ('ulasildi', 'ulasilamadi', 'mesaj_birakildi',
                         'randevu', 'ilgilenmiyor', 'fiyat_verildi')),
  body                TEXT NULL,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_action_at      TIMESTAMPTZ NULL,
  next_action_note    TEXT NULL,
  next_action_done_at TIMESTAMPTZ NULL,
  reminder_sent_at    TIMESTAMPTZ NULL,
  created_by          TEXT NOT NULL DEFAULT 'ofis',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interactions_customer
  ON public.customer_interactions (customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_quote
  ON public.customer_interactions (quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interactions_next_action
  ON public.customer_interactions (next_action_at)
  WHERE next_action_at IS NOT NULL AND next_action_done_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 4) quotes'a bağ kolonları — HEPSİ NULL kabul eder (v17 kuralı)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS customer_id          BIGINT NULL REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_link_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS consent_basis        TEXT NULL,
  ADD COLUMN IF NOT EXISTS consent_recorded_by  TEXT NULL,
  ADD COLUMN IF NOT EXISTS rule_overrides       JSONB NULL,
  ADD COLUMN IF NOT EXISTS rule_override_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_by           TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_customer_id
  ON public.quotes (customer_id) WHERE customer_id IS NOT NULL;

COMMENT ON COLUMN public.quotes.customer_id IS
  'v24: müşteri kütüğü bağı. NULL olabilir — bağlama başarısız olursa teklif yine yazılır.';
COMMENT ON COLUMN public.quotes.customer_link_status IS
  'v24: NULL=bağlandı, ''failed''=trigger bağlayamadı (ofis raporunda görünür).';

-- ─────────────────────────────────────────────────────────────
-- 5) Geriye dönük eşleştirme
--    5a) Mevcut tekliflerden müşteri kütüğü üret.
--        display_name: telefon grubundaki EN SON teklifin adı (en güncel yazım).
-- ─────────────────────────────────────────────────────────────
WITH kaynak AS (
  SELECT
    public.normalize_phone_tr(q.customer_phone) AS phone_norm,
    q.customer_phone,
    q.customer_name,
    q.customer_company,
    q.customer_email,
    q.customer_address,
    q.city_code,
    q.city_name,
    q.source_channel,
    q.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY public.normalize_phone_tr(q.customer_phone)
      ORDER BY q.created_at DESC
    ) AS rn,
    MIN(q.created_at) OVER (
      PARTITION BY public.normalize_phone_tr(q.customer_phone)
    ) AS ilk_gorulme
  FROM public.quotes q
  WHERE public.normalize_phone_tr(q.customer_phone) IS NOT NULL
)
INSERT INTO public.customers (
  business_unit, phone_normalized, phone_display, display_name, company_name,
  email, city_code, city_name, address, customer_type, origin,
  consent_basis, first_seen_at
)
SELECT
  'tasyunu',
  k.phone_norm,
  k.customer_phone,
  COALESCE(NULLIF(btrim(k.customer_name), ''), 'İsimsiz müşteri'),
  NULLIF(btrim(COALESCE(k.customer_company, '')), ''),
  NULLIF(btrim(COALESCE(k.customer_email, '')), ''),
  k.city_code,
  k.city_name,
  NULLIF(btrim(COALESCE(k.customer_address, '')), ''),
  CASE WHEN NULLIF(btrim(COALESCE(k.customer_company, '')), '') IS NULL
       THEN 'bireysel' ELSE 'kurumsal' END,
  CASE WHEN k.source_channel IN ('wizard', 'catalog') THEN k.source_channel ELSE 'ithal' END,
  'sozlesme_hazirligi',
  k.ilk_gorulme
FROM kaynak k
WHERE k.rn = 1
ON CONFLICT (business_unit, phone_normalized) DO NOTHING;

-- 5b) Teklifleri müşteriye bağla.
UPDATE public.quotes q
SET customer_id = c.id
FROM public.customers c
WHERE q.customer_id IS NULL
  AND c.business_unit = 'tasyunu'
  AND c.phone_normalized = public.normalize_phone_tr(q.customer_phone);

-- 5c) last_contact_at: en son teklif anı.
UPDATE public.customers c
SET last_contact_at = s.son
FROM (
  SELECT customer_id, MAX(created_at) AS son
  FROM public.quotes
  WHERE customer_id IS NOT NULL
  GROUP BY customer_id
) s
WHERE c.id = s.customer_id AND c.last_contact_at IS NULL;

-- 5d) Dolu admin_notes → etkileşim defterine taşı (not geçmişi kurtarılır).
INSERT INTO public.customer_interactions
  (customer_id, quote_id, kind, body, occurred_at, created_by)
SELECT
  q.customer_id,
  q.id,
  'not',
  q.admin_notes,
  COALESCE(q.updated_at, q.created_at),
  'backfill-v24'
FROM public.quotes q
WHERE q.customer_id IS NOT NULL
  AND NULLIF(btrim(COALESCE(q.admin_notes, '')), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.customer_interactions ci
    WHERE ci.quote_id = q.id AND ci.created_by = 'backfill-v24'
  );

-- 5e) Temas kayıtları → etkileşim defteri.
INSERT INTO public.customer_interactions
  (customer_id, quote_id, kind, outcome, occurred_at, created_by)
SELECT
  q.customer_id,
  q.id,
  'arama_giden',
  CASE WHEN q.contact_successful IS TRUE THEN 'ulasildi' ELSE 'ulasilamadi' END,
  q.contact_attempted_at,
  'backfill-v24'
FROM public.quotes q
WHERE q.customer_id IS NOT NULL
  AND q.contact_attempted_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.customer_interactions ci
    WHERE ci.quote_id = q.id AND ci.kind = 'arama_giden' AND ci.created_by = 'backfill-v24'
  );

-- ─────────────────────────────────────────────────────────────
-- 6) Yeni tekliflerde otomatik müşteri bağlama
--    KRİTİK: bu trigger submit_quote_guarded transaction'ı İÇİNDE çalışır.
--    Hatası teklif gönderimini komple düşürürdü — bu yüzden gövde
--    EXCEPTION WHEN OTHERS ile sarılı. CRM eksikliği < ciro kaybı.
-- ─────────────────────────────────────────────────────────────
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
    CASE WHEN NEW.source_channel IN ('wizard', 'catalog', 'ofis')
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
        -- Ad/şehir en güncel teklife göre tazelenir; boş değerle ezilmez.
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
  -- Müşteri kütüğü hiçbir koşulda teklif kaydını düşürmez.
  NEW.customer_link_status := 'failed';
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_quotes_link_customer ON public.quotes;
CREATE TRIGGER trg_quotes_link_customer
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.quotes_link_customer();

-- updated_at tazeleyici (quotes'taki kalıbın aynısı)
CREATE OR REPLACE FUNCTION public.customers_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.customers_touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 7) RLS — v14 sertleştirme kalıbı: policy YOK, yalnız service role
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_interactions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.customers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.customer_interactions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.customers_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.customer_interactions_id_seq FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8) Doğrulama kapıları
-- ─────────────────────────────────────────────────────────────
DO $v24$
DECLARE
  n_musteri  INTEGER;
  n_bagsiz   INTEGER;
  n_beklenen INTEGER;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.customers'::regclass) THEN
    RAISE EXCEPTION 'customers RLS açık değil.';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.customer_interactions'::regclass) THEN
    RAISE EXCEPTION 'customer_interactions RLS açık değil.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers') THEN
    RAISE EXCEPTION 'customers üzerinde policy var — anon erişimi açılmış olabilir.';
  END IF;

  -- Normalizasyon paritesi (TS fixture'larıyla aynı örnekler)
  IF public.normalize_phone_tr('0532 123 45 67') <> '905321234567' THEN
    RAISE EXCEPTION 'normalize_phone_tr: 11 haneli 0-önekli numara hatalı.';
  END IF;
  IF public.normalize_phone_tr('5321234567') <> '905321234567' THEN
    RAISE EXCEPTION 'normalize_phone_tr: 10 haneli numara hatalı.';
  END IF;
  IF public.normalize_phone_tr('+90 532 123 45 67') <> '905321234567' THEN
    RAISE EXCEPTION 'normalize_phone_tr: +90 önekli numara hatalı.';
  END IF;
  IF public.normalize_phone_tr('123') IS NOT NULL THEN
    RAISE EXCEPTION 'normalize_phone_tr: geçersiz numara NULL dönmeli.';
  END IF;

  -- Backfill kapsaması: normalize edilebilir telefonu olan her teklif bağlanmalı.
  SELECT count(*) INTO n_musteri FROM public.customers;
  SELECT count(*) INTO n_bagsiz
    FROM public.quotes
    WHERE customer_id IS NULL
      AND public.normalize_phone_tr(customer_phone) IS NOT NULL;
  SELECT count(DISTINCT public.normalize_phone_tr(customer_phone)) INTO n_beklenen
    FROM public.quotes
    WHERE public.normalize_phone_tr(customer_phone) IS NOT NULL;

  IF n_bagsiz > 0 THEN
    RAISE EXCEPTION 'Backfill eksik: % teklif hâlâ müşteriye bağlanmadı.', n_bagsiz;
  END IF;
  IF n_musteri < n_beklenen THEN
    RAISE EXCEPTION 'Müşteri sayısı beklenenden az: % < %', n_musteri, n_beklenen;
  END IF;

  RAISE NOTICE 'v24 tamam — % müşteri, % teklif bağlandı.',
    n_musteri,
    (SELECT count(*) FROM public.quotes WHERE customer_id IS NOT NULL);
END;
$v24$;

COMMIT;

-- ============================================================
-- Geri almak için:
--   DROP TRIGGER IF EXISTS trg_quotes_link_customer ON public.quotes;
--   DROP FUNCTION IF EXISTS public.quotes_link_customer();
--   DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
--   DROP FUNCTION IF EXISTS public.customers_touch_updated_at();
--   DROP TABLE IF EXISTS public.customer_interactions;
--   ALTER TABLE public.quotes
--     DROP COLUMN IF EXISTS customer_id,
--     DROP COLUMN IF EXISTS customer_link_status,
--     DROP COLUMN IF EXISTS consent_basis,
--     DROP COLUMN IF EXISTS consent_recorded_by,
--     DROP COLUMN IF EXISTS rule_overrides,
--     DROP COLUMN IF EXISTS rule_override_reason,
--     DROP COLUMN IF EXISTS created_by;
--   DROP TABLE IF EXISTS public.customers;
--   DROP FUNCTION IF EXISTS public.normalize_phone_tr(TEXT);
-- ============================================================
