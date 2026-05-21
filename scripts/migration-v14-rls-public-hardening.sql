-- ============================================================
-- MIGRATION v14 - Public Schema RLS Hardening
-- Tarih: 2026-05-21
--
-- Supabase Security Advisor:
--   rls_disabled_in_public / Table publicly accessible
--
-- Amaç:
-- - public schema'daki tüm tablolar için RLS'yi açmak
-- - anon/authenticated rollerinden doğrudan INSERT/UPDATE/DELETE yetkisini almak
-- - sadece gerçekten public katalog/veri tablolarına SELECT policy bırakmak
-- - müşteri teklifleri, funnel event'leri ve import staging tablolarını public API'den kapatmak
--
-- Not:
-- - Admin/API yazmaları server-side SUPABASE_SERVICE_ROLE_KEY ile çalışır.
--   Service role RLS'yi bypass eder; bu key browser'a konmamalıdır.
-- - Browser anon client hâlâ katalog/wizard için aşağıdaki public read tablolarını okuyabilir.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Public API rollerinden geniş yetkileri geri al
-- ------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- ------------------------------------------------------------
-- 1. public schema'daki tüm base/partitioned tablolar için RLS aç
-- ------------------------------------------------------------
DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', tbl.nspname, tbl.relname);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 2. Eski / fazla public policy'leri temizle
-- ------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I;',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 3. Helper: tablo varsa public SELECT policy oluştur
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__tmp_create_public_select_policy(
  table_name text,
  using_expr text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  policy_name text := table_name || '_public_read';
BEGIN
  IF to_regclass('public.' || quote_ident(table_name)) IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated;', table_name);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy_name, table_name);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (%s);',
    policy_name,
    table_name,
    using_expr
  );
END $$;

-- ------------------------------------------------------------
-- 4. Public okunması gereken katalog / wizard tabloları
-- ------------------------------------------------------------
SELECT public.__tmp_create_public_select_policy('brands', 'true');
SELECT public.__tmp_create_public_select_policy('material_types', 'true');
SELECT public.__tmp_create_public_select_policy('accessory_types', 'true');
SELECT public.__tmp_create_public_select_policy('shipping_zones', 'true');
SELECT public.__tmp_create_public_select_policy('shipping_districts', 'true');
SELECT public.__tmp_create_public_select_policy('logistics_capacity', 'true');

SELECT public.__tmp_create_public_select_policy('plates', 'is_active = true');
SELECT public.__tmp_create_public_select_policy('accessories', 'is_active = true');
SELECT public.__tmp_create_public_select_policy('package_definitions', 'is_active = true');

SELECT public.__tmp_create_public_select_policy(
  'plate_prices',
  'EXISTS (
     SELECT 1
     FROM public.plates p
     WHERE p.id = plate_id
       AND p.is_active = true
   )'
);

-- ------------------------------------------------------------
-- 5. Sensitive tablolar: RLS açık, public policy yok
-- ------------------------------------------------------------
-- Aşağıdaki tablolar service_role ile server route'lardan erişilir.
-- RLS açık + policy yok => anon/authenticated REST API'den okuyamaz/yazamaz.
--
-- quotes
-- quote_funnel_events
-- raw_import_files
-- raw_import_rows
-- import_match_results
-- import_apply_logs
-- plate_prices_staging
-- accessory_match_catalog

DROP FUNCTION public.__tmp_create_public_select_policy(text, text);

COMMIT;

-- ============================================================
-- KONTROL SORGULARI
-- SQL Editor'da migration sonrası ayrı çalıştırılabilir.
-- ============================================================
--
-- 1) RLS kapalı public tablo kalmamalı:
-- SELECT n.nspname AS schema, c.relname AS table
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relkind IN ('r', 'p')
--   AND c.relrowsecurity = false
-- ORDER BY 1, 2;
--
-- 2) anon/authenticated DML grant kalmamalı:
-- SELECT grantee, table_schema, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND grantee IN ('anon', 'authenticated')
--   AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
-- ORDER BY table_name, grantee, privilege_type;
--
-- 3) Public read policy'leri:
-- SELECT schemaname, tablename, policyname, cmd, roles, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
