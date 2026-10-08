-- Yalnız sıfırdan kurulan sentetik yerel DB'nin eski ofis sözleşmesi.
ALTER ROLE service_role BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS contact_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_successful boolean,
  ADD COLUMN IF NOT EXISTS follow_up_date date,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS quote_code text,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS quoted_price numeric,
  ADD COLUMN IF NOT EXISTS quote_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS quote_sent_by text,
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.quote_funnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_funnel_events FORCE ROW LEVEL SECURITY;
GRANT ALL ON public.quotes, public.quote_funnel_events TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
CREATE TABLE public.material_types (id bigserial PRIMARY KEY, slug text UNIQUE, name text, min_order_m2 numeric);
INSERT INTO public.material_types(slug,name,min_order_m2) VALUES ('eps','EPS',250),('tasyunu','Taşyünü',0);
GRANT SELECT ON public.material_types TO service_role, anon, authenticated;
-- Kabul testi kasıtlı olarak yeni tablolara geniş default ACL bulaştırır.
-- Uygulama migration'ı bu üç yeni tabloda bunları kaldırmak zorundadır.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role, anon, authenticated;
