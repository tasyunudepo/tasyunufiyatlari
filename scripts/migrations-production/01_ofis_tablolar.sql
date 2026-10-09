-- ÜRETİM KOPYASI — 1/2 tablolar, kolonlar, yetkiler
-- Kaynak: scripts/migrations-proposed/20261008_ofis_phase1.sql (gövde birebir aynı).
-- Tek fark koruma kapısıdır: test hedefi bayrağı yerine üretim onayı bayrağı
-- (ofis.production_approved = 'emrah-2026-10') aranır. Bayrak olmadan çalışmaz.
-- Emrah "uygula" demeden çalıştırılmaz. Adımlar: docs/verification/ofis-20261008/YAYIN-HAZIRLIK.md
-- A/B onaylı; yalnız üretimden ayrı olduğu doğrulanan test hedefinde uygulanır.
-- Kanonik etki/geri dönüş: docs/verification/ofis-20261008/PHASE-1-DECISION.md
-- Mevcut v24 customers/customer_interactions ve quotes sözleşmesini gerektirir.
-- Backfill, müşteri/proje eşleştirmesi, teklif güncellemesi veya storage işlemi YOK.
-- Bu dosya mevcut API'lere atomiklik kazandırmaz; yeni transaction yazma yolu
-- ayrıca uygulanıp yalnız doğrulanmış test DB'de kabulden geçmelidir.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Kazara çalıştırmayı önleyen ek kapı. Bayrağı ayarlamak tek başına ortam kanıtı değildir.
DO $guard$
BEGIN
  IF current_setting('ofis.production_approved', true) IS DISTINCT FROM 'emrah-2026-10' THEN
    RAISE EXCEPTION 'Üretim onayı bayrağı olmadan uygulanmaz (ofis.production_approved)';
  END IF;
  IF to_regclass('public.customers') IS NULL
     OR to_regclass('public.customer_interactions') IS NULL
     OR to_regclass('public.quotes') IS NULL THEN
    RAISE EXCEPTION 'Ön koşul: mevcut müşteri, etkileşim ve teklif tabloları doğrulanmalı';
  END IF;
  IF to_regclass('public.sales_projects') IS NOT NULL
     OR to_regclass('public.sales_tasks') IS NOT NULL
     OR to_regclass('public.office_operations') IS NOT NULL THEN
    RAISE EXCEPTION 'Hedefte çakışan tablo var; IF NOT EXISTS ile farklı şema sessizce kabul edilmez';
  END IF;
END;
$guard$;

CREATE TABLE public.sales_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id bigint NULL REFERENCES public.customers(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  owner text NULL,
  status text NULL CHECK (status IS NULL OR status IN
    ('pending','contacted','quoted','approved','completed','rejected')),
  -- Eski tekliflerden satış aşaması veya fırsat değeri otomatik türetilmez.
  loss_category text NULL CHECK (loss_category IS NULL OR loss_category IN
    ('fiyat','stok_termin','vade_odeme','ulasilamadi','rakip','vazgecti','diger')),
  loss_reason text NULL,
  closed_at timestamptz NULL,
  valuation_quote_id bigint NULL,
  valuation_revision integer NULL CHECK (valuation_revision >= 0),
  valuation_net_amount numeric(18,2) NULL CHECK (valuation_net_amount >= 0),
  valuation_selected_at timestamptz NULL,
  valuation_selected_by text NULL,
  -- Eski kayıt kuyruğu sabit aktarım partisine bağlıdır; kayan yaş eşiği yoktur.
  legacy_batch_id uuid NULL,
  created_by text NOT NULL CHECK (length(btrim(created_by)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_projects_valuation_complete CHECK (
    num_nonnulls(valuation_quote_id, valuation_revision, valuation_net_amount,
      valuation_selected_at, valuation_selected_by) IN (0,5)
  ),
  CONSTRAINT sales_projects_closed_consistent CHECK (
    (status IS NOT NULL AND status IN ('completed','rejected') AND closed_at IS NOT NULL)
    OR ((status IS NULL OR status NOT IN ('completed','rejected')) AND closed_at IS NULL)
  ),
  CONSTRAINT sales_projects_rejected_reason CHECK (status IS DISTINCT FROM 'rejected' OR loss_category IS NOT NULL)
);

-- Nullable ekleme eski public INSERT sözleşmesini korur. Mevcut satırlar NULL kalır.
ALTER TABLE public.quotes
  ADD COLUMN project_id uuid NULL REFERENCES public.sales_projects(id) ON DELETE RESTRICT;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_project_id_id_unique UNIQUE (project_id, id);
-- Seçili teklif gerçekten bu projenin alternatifi olmalı.
ALTER TABLE public.sales_projects ADD CONSTRAINT sales_projects_valuation_same_project
  FOREIGN KEY (id, valuation_quote_id) REFERENCES public.quotes(project_id, id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

CREATE TABLE public.office_operations (
  id uuid PRIMARY KEY, -- aynı kullanıcı işleminin bütün retry'larında aynı anahtar
  actor text NOT NULL CHECK (length(btrim(actor)) > 0),
  operation_type text NOT NULL CHECK (operation_type IN (
    'contact_link_clicked','phone_number_copied','contact_attempt','contact_success',
    'followup_scheduled','task_completed','task_cancelled','project_created',
    'project_linked','project_unlinked','valuation_selected','valuation_cleared','outcome_recorded'
  )),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  project_id uuid NOT NULL REFERENCES public.sales_projects(id) ON DELETE RESTRICT,
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT office_operations_project_id_id_unique UNIQUE (project_id, id)
);

ALTER TABLE public.customer_interactions
  ADD COLUMN project_id uuid NULL REFERENCES public.sales_projects(id) ON DELETE RESTRICT,
  ADD COLUMN operation_id uuid NULL;
ALTER TABLE public.customer_interactions
  ADD CONSTRAINT customer_interactions_operation_unique UNIQUE (operation_id),
  ADD CONSTRAINT customer_interactions_operation_project CHECK (operation_id IS NULL OR project_id IS NOT NULL),
  ADD CONSTRAINT customer_interactions_operation_same_project FOREIGN KEY (project_id, operation_id)
    REFERENCES public.office_operations(project_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT customer_interactions_project_id_id_unique UNIQUE (project_id, id);

CREATE TABLE public.sales_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.sales_projects(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('initial_contact','followup')),
  due_at timestamptz NOT NULL,
  owner text NOT NULL CHECK (length(btrim(owner)) > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  scheduled_by text NOT NULL CHECK (length(btrim(scheduled_by)) > 0),
  completed_at timestamptz NULL,
  completed_by text NULL,
  result_interaction_id bigint NULL,
  cancelled_at timestamptz NULL,
  cancelled_by text NULL,
  cancellation_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_tasks_result_same_project FOREIGN KEY (project_id, result_interaction_id)
    REFERENCES public.customer_interactions(project_id, id) ON DELETE RESTRICT,
  CONSTRAINT sales_tasks_lifecycle CHECK (
    (status = 'open' AND num_nonnulls(completed_at, completed_by, result_interaction_id,
      cancelled_at, cancelled_by, cancellation_reason) = 0)
    OR (status = 'done' AND completed_at IS NOT NULL AND completed_by IS NOT NULL
      AND length(btrim(completed_by)) > 0 AND result_interaction_id IS NOT NULL
      AND num_nonnulls(cancelled_at, cancelled_by, cancellation_reason) = 0)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL
      AND length(btrim(cancelled_by)) > 0 AND cancellation_reason IS NOT NULL
      AND length(btrim(cancellation_reason)) > 0
      AND num_nonnulls(completed_at, completed_by, result_interaction_id) = 0)
  )
);

-- Tamamlanmış veya iptal edilmiş ilk temas da kimliğini korur; ikinci ilk iş açılmaz.
CREATE UNIQUE INDEX sales_tasks_one_initial_per_project ON public.sales_tasks(project_id)
  WHERE kind = 'initial_contact';
CREATE INDEX sales_tasks_open_due ON public.sales_tasks(due_at, id) WHERE status = 'open';
CREATE INDEX sales_tasks_completed ON public.sales_tasks(completed_at) WHERE status = 'done';
CREATE INDEX sales_tasks_cancelled ON public.sales_tasks(cancelled_at) WHERE status = 'cancelled';
CREATE INDEX sales_projects_customer ON public.sales_projects(customer_id);
CREATE INDEX office_operations_project ON public.office_operations(project_id, created_at, id);
CREATE INDEX customer_interactions_project_time ON public.customer_interactions(project_id, occurred_at, id);

-- Mevcut kayıtları veya v24 backfill'ini tekrar çalıştıran tetikleyici yok.
ALTER TABLE public.sales_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_projects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sales_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.office_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_operations FORCE ROW LEVEL SECURITY;
-- Supabase default ACL, service_role'a önceden ALL vermiş olabilir.
-- Dar GRANT daraltmaz: yalnız bu üç yeni tabloda önce bütün izinleri kaldır.
REVOKE ALL ON public.sales_projects, public.sales_tasks, public.office_operations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.sales_projects, public.sales_tasks TO service_role;
GRANT SELECT, INSERT ON public.office_operations TO service_role;
DO $effective_permissions$
DECLARE t text; p text; r text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales_projects','sales_tasks','office_operations'] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege('service_role', 'public.' || t, p)
        IS DISTINCT FROM (p IN ('SELECT','INSERT') OR (p = 'UPDATE' AND t <> 'office_operations')) THEN
        RAISE EXCEPTION 'Etkin service_role yetkisi beklenenden farklı: %.%', t, p;
      END IF;
    END LOOP;
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(r, 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
        RAISE EXCEPTION 'Yeni tabloya istenmeyen etkin erişim: %.%', r, t;
      END IF;
    END LOOP;
  END LOOP;
  IF has_any_column_privilege('service_role','public.office_operations','UPDATE,REFERENCES') THEN
    RAISE EXCEPTION 'İşlem defterinde istenmeyen sütun yetkisi';
  END IF;
END;
$effective_permissions$;
-- Yeni operation sonucu INSERT öncesi hazırlanır; boş rezervasyonla ayrı commit yapılmaz.
-- İstek tekilleştirme + görüşme INSERT + görev geçişi tek DB transaction'ında uygulanır.
-- Aynı anahtar farklı actor/yük/tür ile gelirse 409; aynı yük önceki sonuç döner.
COMMENT ON COLUMN public.quotes.project_id IS 'Operatörce açıkça kurulan proje bağı; telefon serisi değildir';
COMMENT ON COLUMN public.sales_projects.valuation_net_amount IS 'A/B onaylı: sunucuda kayıtlı revizyondan doğrulanan tek teklifin KDV hariç anlık tutarı; müşteri onayı veya kazanılmış satış değildir';
COMMENT ON TABLE public.office_operations IS 'Yeni atomik yazma yolu için idempotency ve iş olayı defteri; eski endpointleri kendiliğinden değiştirmez';
COMMIT;
