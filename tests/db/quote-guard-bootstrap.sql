\set ON_ERROR_STOP on

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END;
$roles$;

CREATE TABLE public.quotes (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_company TEXT,
  customer_address TEXT,
  material_type TEXT NOT NULL,
  brand_id BIGINT,
  brand_name TEXT NOT NULL,
  model_name TEXT,
  thickness_cm NUMERIC NOT NULL,
  area_m2 NUMERIC NOT NULL,
  city_code TEXT NOT NULL,
  city_name TEXT NOT NULL,
  package_name TEXT NOT NULL,
  package_description TEXT,
  plate_brand_name TEXT NOT NULL,
  accessory_brand_name TEXT NOT NULL,
  total_price NUMERIC NOT NULL,
  price_per_m2 NUMERIC NOT NULL,
  shipping_cost NUMERIC DEFAULT 0,
  discount_percentage NUMERIC DEFAULT 0,
  price_without_vat NUMERIC NOT NULL,
  vat_amount NUMERIC NOT NULL,
  package_count INTEGER NOT NULL,
  package_size_m2 NUMERIC NOT NULL,
  items_per_package INTEGER NOT NULL,
  vehicle_type TEXT,
  lorry_capacity_packages INTEGER,
  truck_capacity_packages INTEGER,
  lorry_fill_percentage NUMERIC,
  truck_fill_percentage NUMERIC,
  package_items JSONB NOT NULL,
  status TEXT DEFAULT 'pending'
);

CREATE TABLE public.quote_funnel_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  quote_id BIGINT REFERENCES public.quotes(id) ON DELETE SET NULL,
  material_type TEXT,
  brand_id BIGINT,
  brand_name TEXT,
  model_name TEXT,
  thickness_cm NUMERIC,
  area_m2 NUMERIC,
  city_code TEXT,
  city_name TEXT,
  package_name TEXT,
  total_price NUMERIC,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

