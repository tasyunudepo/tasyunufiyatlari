-- ÜRETİM KOPYASI — geri alma (yalnız yeni tablolar BOŞKEN)
-- Kaynak: scripts/migrations-proposed/20261008_ofis_phase1.rollback.sql (gövde birebir aynı).
-- Tek fark koruma kapısıdır: test hedefi bayrağı yerine üretim onayı bayrağı
-- (ofis.production_approved = 'emrah-2026-10') aranır. Bayrak olmadan çalışmaz.
-- Emrah "uygula" demeden çalıştırılmaz. Adımlar: docs/verification/ofis-20261008/YAYIN-HAZIRLIK.md
-- UYGULANMADI. Yalnız yeni tablolar BOŞ ve ilişkiler kullanılmamış test DB için.
-- Gerçek iş verisi oluştuysa şema silinmez: feature flag kapatılır, veri korunur.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $guard$
BEGIN
  IF current_setting('ofis.production_approved', true) IS DISTINCT FROM 'emrah-2026-10' THEN
    RAISE EXCEPTION 'Üretim onayı bayrağı olmadan uygulanmaz (ofis.production_approved)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sales_projects)
     OR EXISTS (SELECT 1 FROM public.sales_tasks)
     OR EXISTS (SELECT 1 FROM public.office_operations)
     OR EXISTS (SELECT 1 FROM public.quotes WHERE project_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.customer_interactions WHERE project_id IS NOT NULL OR operation_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Yeni iş verisi var: silerek geri alma reddedildi; uygulama bayrağını kapatın';
  END IF;
END;
$guard$;
DROP FUNCTION IF EXISTS public.ofis_workbench();
DROP FUNCTION IF EXISTS public.ofis_operation(uuid,text,text,text,jsonb);
DROP TABLE public.sales_tasks;
ALTER TABLE public.sales_projects DROP CONSTRAINT sales_projects_valuation_same_project;
ALTER TABLE public.quotes DROP CONSTRAINT quotes_project_id_id_unique;
ALTER TABLE public.customer_interactions
  DROP CONSTRAINT customer_interactions_project_id_id_unique,
  DROP CONSTRAINT customer_interactions_operation_unique;
ALTER TABLE public.customer_interactions DROP COLUMN project_id, DROP COLUMN operation_id;
ALTER TABLE public.quotes DROP COLUMN project_id;
DROP TABLE public.office_operations;
DROP TABLE public.sales_projects;
COMMIT;
