\set ON_ERROR_STOP on

-- v18 doğrulaması için asgari şema: canlıdaki brands/plates zincirinin
-- migration'ın dokunduğu kolonları. Mevcut beş levha seed edilir;
-- Bonus kayıtlarını migration'ın kendisi oluşturmalıdır.

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

CREATE TABLE public.brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  tier VARCHAR(20),
  description TEXT
);

CREATE TABLE public.product_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE public.material_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE public.plates (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER REFERENCES public.brands(id),
  category_id INTEGER REFERENCES public.product_categories(id),
  material_type_id INTEGER REFERENCES public.material_types(id),
  name VARCHAR(200) NOT NULL,
  short_name VARCHAR(100),
  density INTEGER,
  thickness_options JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.plate_prices (
  id SERIAL PRIMARY KEY,
  plate_id INTEGER NOT NULL REFERENCES public.plates(id)
);

CREATE TABLE public.shipping_zones (
  id SERIAL PRIMARY KEY,
  city_code INTEGER NOT NULL UNIQUE,
  city_name VARCHAR(100) NOT NULL,
  base_shipping_cost NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- v19b eşleme doğrulaması 81 ilin tamamını gerektirir.
INSERT INTO public.shipping_zones (city_code, city_name)
SELECT g, 'İl ' || g FROM generate_series(1, 81) AS g;

INSERT INTO public.brands (name, tier) VALUES
  ('Dalmaçyalı', 'premium'),
  ('Expert', 'mid'),
  ('Optimix', 'eco');

INSERT INTO public.product_categories (name, slug) VALUES ('Mantolama', 'mantolama');
INSERT INTO public.material_types (name, slug) VALUES ('Taşyünü', 'tasyunu');

INSERT INTO public.plates (brand_id, category_id, material_type_id, name, short_name, density, thickness_options) VALUES
  ((SELECT id FROM public.brands WHERE name = 'Dalmaçyalı'),
   (SELECT id FROM public.product_categories WHERE slug = 'mantolama'),
   (SELECT id FROM public.material_types WHERE slug = 'tasyunu'),
   'Dalmaçyalı Stonewool SW035 Taşyünü Levha', 'SW035', 120, '[3,4,5,6,7,8,10,12]'),
  ((SELECT id FROM public.brands WHERE name = 'Expert'),
   (SELECT id FROM public.product_categories WHERE slug = 'mantolama'),
   (SELECT id FROM public.material_types WHERE slug = 'tasyunu'),
   'Expert Taşyünü Premium Isı Yalıtım Levhası', 'Premium', 120, '[3,4,5,6,7,8,10]'),
  ((SELECT id FROM public.brands WHERE name = 'Expert'),
   (SELECT id FROM public.product_categories WHERE slug = 'mantolama'),
   (SELECT id FROM public.material_types WHERE slug = 'tasyunu'),
   'Expert HD150 Taşyünü Isı Yalıtım Levhası', 'HD150', 150, '[5,6,7,8,10,12]'),
  ((SELECT id FROM public.brands WHERE name = 'Expert'),
   (SELECT id FROM public.product_categories WHERE slug = 'mantolama'),
   (SELECT id FROM public.material_types WHERE slug = 'tasyunu'),
   'Expert LD125 Taşyünü Isı Yalıtım Levhası', 'LD125', 125, '[5,6,7,8,10]'),
  ((SELECT id FROM public.brands WHERE name = 'Optimix'),
   (SELECT id FROM public.product_categories WHERE slug = 'mantolama'),
   (SELECT id FROM public.material_types WHERE slug = 'tasyunu'),
   'Optimix TR7.5 Taşyünü Isı Yalıtım Levhası', 'TR7.5', 120, '[5,6,8,10]');
