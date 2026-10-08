import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {sql,apply,verifyTarget,inventory,root,state} from './db.mjs';
verifyTarget();
const base='http://127.0.0.1:3210';
const auth='Basic '+Buffer.from('preview:preview-only').toString('base64');
const evidence={checks:[],startedAt:new Date().toISOString(),target:'isolated localhost PostgreSQL 55438',productionWrites:0};
const save=()=>fs.writeFileSync(root+'/docs/verification/ofis-20261008/evidence/phase1-endpoints.json',JSON.stringify(evidence,null,2)+'\n');
const log=text=>{evidence.checks.push(text);save();console.log(text)};
async function api(path,{method='GET',body,key,authorization=auth}={}){
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(authorization?{authorization}:{}),...(key?{'Idempotency-Key':key}:{})},body:body?JSON.stringify(body):undefined});
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={error:text}}
 return {status:r.status,data};
}
async function op(body,key=randomUUID()){const r=await api('/api/admin/office/operations',{method:'POST',body,key});assert.equal(r.status,200,JSON.stringify(r));return r.data}
const input=(name,phone='05320000011',unitPrice=100)=>({customerName:name,customerPhone:phone,cityCode:'34',cityName:'İstanbul',materialType:'eps',areaM2:300,title:'Sentetik kabul teklifi',lines:[{kind:'levha',description:'Örnek EPS levha',quantity:300,unit:'m²',unitPrice,isPlate:true,thicknessCm:4,packageCount:50}],shippingMode:'buyer_pays',shippingCharge:0,discountPct:0,validityDays:7,consentChannel:'telefon',expectedPriceWithoutVat:300*unitPrice,expectedTotalPrice:360*unitPrice});
async function quote(name,phone,price){const r=await api('/api/admin/quotes/manual',{method:'POST',body:input(name,phone,price)});assert.equal(r.status,201,JSON.stringify(r));return String(r.data.quoteId)}
try{
 const before=JSON.parse(fs.readFileSync(root+'/docs/verification/ofis-20261008/evidence/phase1-test-before.json'));
 const after=JSON.parse(fs.readFileSync(root+'/docs/verification/ofis-20261008/evidence/phase1-test-after.json'));
 for(const t of before.tables)assert.deepEqual(after.tables.find(x=>x.name===t.name)?.acl,t.acl,'Eski tablo ACL değişmemeli: '+t.name);
 const journal=after.effective_permissions.filter(x=>x.table==='office_operations'&&x.role==='service_role'&&x.allowed).map(x=>x.privilege).sort();
 assert.deepEqual(journal,['INSERT','SELECT']);log('Yeni tabloların etkin ACL kontrolü geçti; işlem defteri SELECT/INSERT, eski tablo ACL’leri aynı.');
 const q1=await quote('Test Kuzey Yapı');const q2=await quote('Test Kuzey Yapı alternatif',undefined,120);
 const created=await op({type:'project_created',quoteId:q1,name:'Kuzey cephe projesi',owner:'Örnek satışçı'});
 const {projectId,taskId}=created;evidence.projectId=projectId;evidence.quoteIds=[q1,q2];
 await op({type:'project_linked',projectId,quoteId:q2});
 assert.equal(sql(`SELECT count(*) FROM sales_tasks WHERE project_id='${projectId}' AND kind='initial_contact'`).trim(),'1');
 await op({type:'valuation_selected',projectId,quoteId:q1,revision:0});
 let board=(await api('/api/admin/office')).data;let p=board.projects.find(x=>x.id===projectId);
 assert.equal(Number(p.valuation_net_amount),30000);assert.equal(p.status,'pending');
 const tampered=await api('/api/admin/office/operations',{method:'POST',key:randomUUID(),body:{type:'valuation_selected',projectId,quoteId:q1,revision:0,netAmount:1}});assert.equal(tampered.status,400);
 let revision=await api('/api/admin/quotes/manual',{method:'PUT',body:{...input('Test Kuzey Yapı',undefined,150),quoteId:Number(q1)}});assert.equal(revision.status,200,JSON.stringify(revision));
 p=(await api('/api/admin/office')).data.projects.find(x=>x.id===projectId);assert.equal(Number(p.valuation_net_amount),30000);
 const historical=await op({type:'valuation_selected',projectId,quoteId:q1,revision:0});assert.equal(historical.netAmount,30000);
 const current=await op({type:'valuation_selected',projectId,quoteId:q1,revision:1});assert.equal(current.netAmount,45000);
 const invalidRev=await api('/api/admin/office/operations',{method:'POST',key:randomUUID(),body:{type:'valuation_selected',projectId,quoteId:q1,revision:999}});assert.equal(invalidRev.status,422);
 log('Alternatifler tek ilk temas işinde; tutar kayıtlı revizyondan gelir, istemci tutarı reddedilir, revize otomatik değer değiştirmez ve satış aşaması değişmez.');
 const shared=randomUUID(),success={type:'contact_success',projectId,quoteId:q1,taskId,channel:'phone',note:'Sentetik başarılı görüşme'};
 const concurrent=await Promise.all(Array.from({length:8},()=>op(success,shared)));
 assert.equal(new Set(concurrent.map(x=>x.interactionId)).size,1);
 assert.equal(sql(`SELECT count(*) FROM office_operations WHERE id='${shared}'`).trim(),'1');
 assert.equal(sql(`SELECT count(*) FROM customer_interactions WHERE operation_id='${shared}'`).trim(),'1');
 const conflict=await api('/api/admin/office/operations',{method:'POST',key:shared,body:{...success,note:'Farklı içerik'}});assert.equal(conflict.status,409);
 log('8 eşzamanlı aynı işlem → tek görüşme, tek işlem ve tek görev geçişi; aynı anahtarla farklı içerik 409.');
 const attempt=await op({type:'contact_attempt',projectId,quoteId:q1,channel:'phone',note:'Sonraki sentetik arama yanıtsız'});
 const history=(await api(`/api/admin/quotes/${q1}/interactions`)).data;
 assert.equal(history.firstSuccess.outcome,'ulasildi');assert.equal(history.latestAttempt.outcome,'ulasilamadi');assert.notEqual(history.firstSuccess.id,attempt.interactionId);
 log('Başarılı görüşmeden sonraki başarısız girişim önceki başarıyı ve ilk başarı tarihini korur.');
 const follow=await op({type:'followup_scheduled',projectId,dueAt:new Date().toISOString(),owner:'Örnek satışçı'});
 const failKey=randomUUID();
 sql("CREATE FUNCTION public.ofis_test_fail_task() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'sentetik transaction ortası hata'; END $$; CREATE TRIGGER ofis_test_failure BEFORE UPDATE ON public.sales_tasks FOR EACH ROW WHEN (NEW.status='done') EXECUTE FUNCTION public.ofis_test_fail_task();");
 try{
  const failed=await api('/api/admin/office/operations',{method:'POST',key:failKey,body:{type:'contact_success',projectId,quoteId:q1,taskId:follow.taskId,channel:'whatsapp'}});assert.equal(failed.status,503);
  assert.equal(sql(`SELECT count(*) FROM office_operations WHERE id='${failKey}'`).trim(),'0');
  assert.equal(sql(`SELECT count(*) FROM customer_interactions WHERE operation_id='${failKey}'`).trim(),'0');
  assert.equal(sql(`SELECT status FROM sales_tasks WHERE id='${follow.taskId}'`).trim(),'open');
 }finally{sql('DROP TRIGGER ofis_test_failure ON public.sales_tasks; DROP FUNCTION public.ofis_test_fail_task()');}
 await op({type:'contact_success',projectId,quoteId:q1,taskId:follow.taskId,channel:'whatsapp'},failKey);
 log('Journal ve görüşme INSERT sonrası görev UPDATE tetikleyicisi hata verdi: hiçbir kısmi kayıt kalmadı; aynı anahtarla tekrar deneme başarılı.');
 const lossKey=randomUUID(),lostBody={type:'followup_scheduled',projectId,dueAt:new Date(Date.now()+86400000).toISOString(),owner:'Örnek satışçı'};
 const proxy=createServer(async(req,res)=>{for await(const ignored of req){void ignored;}const r=await api('/api/admin/office/operations',{method:'POST',body:lostBody,key:lossKey});assert.equal(r.status,200);res.destroy();});
 await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
 try{await assert.rejects(fetch(`http://127.0.0.1:${proxy.address().port}`,{method:'POST',body:'sentetik cevap kaybı'}));}finally{await new Promise(resolve=>proxy.close(resolve));}
 const replay=await op(lostBody,lossKey);assert.equal(replay.replayed,true);
 assert.equal(sql(`SELECT count(*) FROM office_operations WHERE id='${lossKey}'`).trim(),'1');
 log('Sunucu commit sonrası HTTP cevabı kesildi; tekrar deneme aynı görevi döndürdü ve yeni kayıt üretmedi.');
 const countBefore=sql('SELECT count(*) FROM office_operations').trim();
 for(const authorization of [null,'Basic '+Buffer.from('patron:preview-readonly').toString('base64'),'Basic '+Buffer.from('bilinmeyen:yanlış').toString('base64')]){
  const denied=await api('/api/admin/office/operations',{method:'POST',body:lostBody,key:randomUUID(),authorization});assert([401,403].includes(denied.status));
 }
 assert.equal(sql('SELECT count(*) FROM office_operations').trim(),countBefore);
 const keys=JSON.parse(fs.readFileSync(state+'/local-keys.json'));
 for(const role of ['anon','authenticated']){
  const r=await fetch('http://127.0.0.1:3211/rest/v1/rpc/ofis_operation',{method:'POST',headers:{authorization:'Bearer '+keys[role],'Content-Type':'application/json'},body:JSON.stringify({p_id:randomUUID(),p_actor:'sahte',p_type:'contact_success',p_hash:'a'.repeat(64),p_body:success})});assert([401,403].includes(r.status));
 }
 for(const statement of ['UPDATE public.office_operations SET actor=actor','DELETE FROM public.office_operations','TRUNCATE public.office_operations'])assert.throws(()=>sql('SET ROLE service_role; '+statement));
 log('Anonim, bilinmeyen ve patron HTTP yazamaz; anon/authenticated RPC çağıramaz; service_role defteri UPDATE/DELETE/TRUNCATE edemez.');
 const prior=sql('SELECT count(*) FROM office_operations').trim();
 await op({type:'contact_link_clicked',projectId,channel:'whatsapp'});await op({type:'phone_number_copied',projectId});
 assert.equal(Number(sql('SELECT count(*) FROM office_operations').trim()),Number(prior)+2);
 assert.equal(sql(`SELECT status FROM sales_tasks WHERE id='${replay.taskId}'`).trim(),'open');
 assert.throws(()=>apply('scripts/migrations-proposed/20261008_ofis_phase1.rollback.sql'));
 assert.equal(sql(`SELECT count(*) FROM sales_projects WHERE id='${projectId}'`).trim(),'1');
 log('Tıklama/kopyalama görevi veya teması değiştirmez. Yeni veri varken ham rollback silmeyi reddeder; veri korunur.');
 inventory('phase1-test-final');evidence.finishedAt=new Date().toISOString();evidence.passed=true;save();
}catch(error){evidence.failure=error.stack;save();throw error}
