-- Onaylı A/B modelinin atomik yazma yolu. Yalnız doğrulanmış test DB.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_setting('ofis.verified_test_target',true) IS DISTINCT FROM 'yes' THEN
  RAISE EXCEPTION 'Doğrulanmış ayrı test hedefi gerekli';
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ofis_operation(p_id uuid,p_actor text,p_type text,p_hash text,p_body jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $fn$
DECLARE
 old_op public.office_operations%ROWTYPE;
 project public.sales_projects%ROWTYPE;
 quote public.quotes%ROWTYPE;
 task public.sales_tasks%ROWTYPE;
 project_key uuid;
 task_key uuid;
 interaction_key bigint;
 result jsonb;
 rev integer;
 current_rev integer;
 amount numeric;
 snapshot jsonb;
 contact_kind text;
 contact_outcome text;
 event_time timestamptz;
BEGIN
 IF p_actor IS NULL OR btrim(p_actor)='' OR p_hash !~ '^[0-9a-f]{64}$' OR jsonb_typeof(p_body) IS DISTINCT FROM 'object' THEN
  RAISE SQLSTATE 'PT400' USING MESSAGE='Geçersiz işlem';
 END IF;
 -- Bütün retry'lar aynı transaction kilidini alır. İlk işlem rollback olursa
 -- bekleyen istek işlemi üstlenir; commit olduysa kaydedilmiş sonucu döndürür.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text, 72119));
 SELECT * INTO old_op FROM office_operations WHERE id=p_id;
 IF FOUND THEN
  IF old_op.actor<>p_actor OR old_op.operation_type<>p_type OR old_op.payload_hash<>p_hash THEN
   RAISE SQLSTATE 'PT409' USING MESSAGE='İşlem anahtarı başka içerikle kullanılmış';
  END IF;
  RETURN old_op.result || jsonb_build_object('replayed',true);
 END IF;
 IF p_type='project_created' THEN
  SELECT * INTO quote FROM quotes WHERE id=(p_body->>'quoteId')::bigint FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Teklif bulunamadı'; END IF;
  IF quote.project_id IS NOT NULL THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Teklif zaten bir projeye bağlı'; END IF;
  IF p_body->>'initialDueAt' IS NULL THEN RAISE SQLSTATE 'PT422' USING MESSAGE='İlk temas takvimi yapılandırılmalı'; END IF;
  project_key=gen_random_uuid(); task_key=gen_random_uuid();
  INSERT INTO sales_projects(id,customer_id,name,owner,status,created_by)
   VALUES(project_key,quote.customer_id,p_body->>'name',p_body->>'owner','pending',p_actor);
  UPDATE quotes SET project_id=project_key WHERE id=quote.id;
  INSERT INTO sales_tasks(id,project_id,kind,due_at,owner,scheduled_by)
   VALUES(task_key,project_key,'initial_contact',(p_body->>'initialDueAt')::timestamptz,p_body->>'owner',p_actor);
  result=jsonb_build_object('projectId',project_key,'taskId',task_key);
 ELSE
  project_key=(p_body->>'projectId')::uuid;
  -- Proje kilidi farklı anahtarlı eşzamanlı görev/alternatif/değerleme işlerini sıralar.
  SELECT * INTO project FROM sales_projects WHERE id=project_key FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Proje bulunamadı'; END IF;
  result=jsonb_build_object('projectId',project_key);
  IF p_type='project_linked' THEN
   SELECT * INTO quote FROM quotes WHERE id=(p_body->>'quoteId')::bigint FOR UPDATE;
   IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Teklif bulunamadı'; END IF;
   IF quote.project_id IS NOT NULL AND quote.project_id<>project_key THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='Teklif başka projeye bağlı';
   END IF;
   IF quote.customer_id IS DISTINCT FROM project.customer_id THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='Müşteri bağı farklı; otomatik birleştirme yapılmaz';
   END IF;
   UPDATE quotes SET project_id=project_key WHERE id=quote.id;
   result=result||jsonb_build_object('quoteId',quote.id::text);
  ELSIF p_type='valuation_selected' THEN
   SELECT * INTO quote FROM quotes WHERE id=(p_body->>'quoteId')::bigint AND project_id=project_key FOR UPDATE;
   IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Değerleme teklifi bu projeye bağlı değil'; END IF;
   rev=(p_body->>'revision')::integer;
   current_rev=jsonb_array_length(COALESCE(quote.package_items #> '{manual,revisions}','[]'::jsonb));
   IF rev IS NULL OR rev<0 OR rev>current_rev THEN RAISE SQLSTATE 'PT422' USING MESSAGE='Kayıtlı revizyon bulunamadı'; END IF;
   IF rev=current_rev THEN
    amount=quote.price_without_vat;
   ELSE
    snapshot=(quote.package_items #> '{manual,revisions}')->rev;
    IF (snapshot->>'no')::integer IS DISTINCT FROM rev+1 THEN RAISE SQLSTATE 'PT422' USING MESSAGE='Revizyon sırası doğrulanamadı'; END IF;
    amount=(snapshot->>'priceWithoutVat')::numeric;
   END IF;
   IF amount IS NULL OR amount<0 THEN RAISE SQLSTATE 'PT422' USING MESSAGE='Revizyonun net tutarı kayıtlı değil'; END IF;
   UPDATE sales_projects SET valuation_quote_id=quote.id,valuation_revision=rev,
    valuation_net_amount=round(amount,2),valuation_selected_at=now(),valuation_selected_by=p_actor,updated_at=now()
    WHERE id=project_key;
   -- Projenin ve teklifin satış durumuna dokunulmaz.
   result=result||jsonb_build_object('quoteId',quote.id::text,'revision',rev,'netAmount',round(amount,2));
  ELSIF p_type='valuation_cleared' THEN
   UPDATE sales_projects SET valuation_quote_id=NULL,valuation_revision=NULL,valuation_net_amount=NULL,
    valuation_selected_at=NULL,valuation_selected_by=NULL,updated_at=now() WHERE id=project_key;
  ELSIF p_type IN ('contact_attempt','contact_success') THEN
   IF project.customer_id IS NULL THEN RAISE SQLSTATE 'PT422' USING MESSAGE='Önce doğrulanmış müşteri bağı gerekli'; END IF;
   IF p_body->>'quoteId' IS NOT NULL THEN
    SELECT * INTO quote FROM quotes WHERE id=(p_body->>'quoteId')::bigint AND project_id=project_key;
    IF NOT FOUND OR quote.customer_id IS DISTINCT FROM project.customer_id THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Teklif ve proje müşteri bağı uyuşmuyor'; END IF;
   END IF;
   IF p_body->>'taskId' IS NOT NULL THEN
    SELECT * INTO task FROM sales_tasks WHERE id=(p_body->>'taskId')::uuid AND project_id=project_key FOR UPDATE;
    IF NOT FOUND OR task.status<>'open' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Görev açık değil veya bu projeye ait değil'; END IF;
    task_key=task.id;
   END IF;
   IF p_body->>'channel' NOT IN ('phone','whatsapp') THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Geçersiz kanal'; END IF;
   contact_kind=CASE WHEN p_body->>'channel'='phone' THEN 'arama_giden' ELSE 'whatsapp' END;
   contact_outcome=CASE WHEN p_type='contact_success' THEN 'ulasildi' WHEN contact_kind='whatsapp' THEN 'mesaj_birakildi' ELSE 'ulasilamadi' END;
   event_time=COALESCE((p_body->>'occurredAt')::timestamptz,now());
   IF event_time>now()+interval '5 minutes' THEN RAISE SQLSTATE 'PT422' USING MESSAGE='Görüşme zamanı gelecekte olamaz'; END IF;
   -- Sonucu önceden belirleyip journal INSERT ve yan etkileri tek transaction'a al.
   interaction_key=nextval(pg_get_serial_sequence('public.customer_interactions','id'));
   result=result||jsonb_build_object('interactionId',interaction_key::text,'taskId',task_key);
   INSERT INTO office_operations(id,actor,operation_type,payload_hash,project_id,result)
    VALUES(p_id,p_actor,p_type,p_hash,project_key,result);
   INSERT INTO customer_interactions(id,customer_id,quote_id,project_id,operation_id,kind,outcome,body,occurred_at,created_by)
    VALUES(interaction_key,project.customer_id,(p_body->>'quoteId')::bigint,project_key,p_id,contact_kind,contact_outcome,p_body->>'note',event_time,p_actor);
   IF task_key IS NOT NULL THEN
    UPDATE sales_tasks SET status='done',completed_at=now(),completed_by=p_actor,result_interaction_id=interaction_key,updated_at=now() WHERE id=task_key;
   END IF;
   RETURN result||jsonb_build_object('replayed',false);
  ELSIF p_type='followup_scheduled' THEN
   task_key=gen_random_uuid();
   INSERT INTO sales_tasks(id,project_id,kind,due_at,owner,scheduled_by)
    VALUES(task_key,project_key,'followup',(p_body->>'dueAt')::timestamptz,p_body->>'owner',p_actor);
   result=result||jsonb_build_object('taskId',task_key);
  ELSIF p_type='task_cancelled' THEN
   SELECT * INTO task FROM sales_tasks WHERE id=(p_body->>'taskId')::uuid AND project_id=project_key FOR UPDATE;
   IF NOT FOUND OR task.status<>'open' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Görev açık değil'; END IF;
   UPDATE sales_tasks SET status='cancelled',cancelled_at=now(),cancelled_by=p_actor,cancellation_reason=p_body->>'reason',updated_at=now() WHERE id=task.id;
  ELSIF p_type='outcome_recorded' THEN
   UPDATE sales_projects SET status=p_body->>'status',loss_category=CASE WHEN p_body->>'status'='rejected' THEN p_body->>'lossCategory' END,
    loss_reason=CASE WHEN p_body->>'status'='rejected' THEN p_body->>'reason' END,
    closed_at=CASE WHEN p_body->>'status' IN ('completed','rejected') THEN now() END,updated_at=now() WHERE id=project_key;
  ELSIF p_type NOT IN ('contact_link_clicked','phone_number_copied') THEN
   RAISE SQLSTATE 'PT400' USING MESSAGE='Desteklenmeyen işlem';
  END IF;
 END IF;
 INSERT INTO office_operations(id,actor,operation_type,payload_hash,project_id,result)
  VALUES(p_id,p_actor,p_type,p_hash,project_key,result);
 RETURN result||jsonb_build_object('replayed',false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.ofis_operation(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ofis_operation(uuid,text,text,text,jsonb) TO service_role;

-- Tek SQL snapshot'ı: pano ve sayaçlar aynı veri anından gelir.
CREATE OR REPLACE FUNCTION public.ofis_workbench() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=public,pg_temp AS $fn$
 WITH p AS (SELECT * FROM sales_projects ORDER BY created_at DESC,id LIMIT 1000),
 q AS (SELECT * FROM quotes ORDER BY created_at DESC,id DESC LIMIT 2000),
 t AS (SELECT * FROM sales_tasks WHERE project_id IN (SELECT id FROM p)),
 ci AS (SELECT i.* FROM customer_interactions i WHERE i.project_id IN (SELECT id FROM p)
   OR i.quote_id IN (SELECT id FROM q))
 SELECT jsonb_build_object(
  'asOf',now(),'truncated',(SELECT count(*)>1000 FROM sales_projects) OR (SELECT count(*)>2000 FROM quotes),
  'projects',COALESCE((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('customer_id',p.customer_id::text,'valuation_quote_id',p.valuation_quote_id::text)) FROM p),'[]'::jsonb),
  'quotes',COALESCE((SELECT jsonb_agg(to_jsonb(q)||jsonb_build_object('id',q.id::text,'customer_id',q.customer_id::text)) FROM q),'[]'::jsonb),
  'tasks',COALESCE((SELECT jsonb_agg(to_jsonb(t)||jsonb_build_object('result_interaction_id',t.result_interaction_id::text)) FROM t),'[]'::jsonb),
  'interactions',COALESCE((SELECT jsonb_agg(to_jsonb(ci)||jsonb_build_object('id',ci.id::text,'quote_id',ci.quote_id::text,'customer_id',ci.customer_id::text)) FROM ci),'[]'::jsonb)
 );
$fn$;
REVOKE ALL ON FUNCTION public.ofis_workbench() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ofis_workbench() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
