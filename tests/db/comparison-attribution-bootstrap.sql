\set ON_ERROR_STOP on

BEGIN;

-- v24'ün v26 tarafından kullanılan en küçük davranışsal yüzeyi.
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

CREATE TABLE public.customers (
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
  kvkk_consent        BOOLEAN NOT NULL DEFAULT false,
  consent_basis       TEXT NULL
                      CHECK (consent_basis IS NULL OR consent_basis IN
                        ('acik_riza', 'sozlesme_hazirligi', 'mesru_menfaat')),
  consent_version     TEXT NULL,
  consent_timestamp   TIMESTAMPTZ NULL,
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_contact_at     TIMESTAMPTZ NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customers_phone_benzersiz UNIQUE (business_unit, phone_normalized)
);

ALTER TABLE public.quotes
  ADD COLUMN customer_id BIGINT NULL REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN customer_link_status TEXT NULL;

-- v26'nın bağımlılık ve replacement davranışını ölçmek için v24 imzalı eski
-- fonksiyon/trigger yüzeyi. Gövdeyi v26 gerçek CRM eşlemesiyle değiştirecek.
CREATE OR REPLACE FUNCTION public.quotes_link_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
BEGIN
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_quotes_link_customer
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.quotes_link_customer();

COMMIT;
