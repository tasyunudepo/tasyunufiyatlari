// Kabul kontrolleri açık işleri tüketirse, inceleme için üç sentetik iş hazırlar.
// Yeni veri yalnız doğrulanmış yerel DB'ye, gerçek uygulama endpoint'lerinden yazılır.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import {verifyTarget,sql,root} from './db.mjs';
verifyTarget();
const count=Number(sql("SELECT count(*) FROM sales_tasks WHERE status='open' AND due_at < (date_trunc('day',now() AT TIME ZONE 'Europe/Istanbul')+interval '1 day') AT TIME ZONE 'Europe/Istanbul'"));
if(count){console.log('Önizlemede açık işler var; ek örnek oluşturulmadı.');process.exit(0)}
const auth='Basic '+Buffer.from('preview:preview-only').toString('base64');
async function post(path,body){const r=await fetch('http://127.0.0.1:3210'+path,{method:'POST',headers:{authorization:auth,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify(body)});const result=await r.json();assert(r.ok,JSON.stringify(result));return result}
const quote=await post('/api/admin/quotes/manual',{customerName:'Örnek Sahil Yapı',customerPhone:'05320000077',cityCode:'34',cityName:'İstanbul',materialType:'eps',areaM2:300,title:'Örnek cephe teklifi',lines:[{kind:'levha',description:'Örnek EPS levha',quantity:300,unit:'m²',unitPrice:120,isPlate:true,thicknessCm:4,packageCount:50}],shippingMode:'buyer_pays',shippingCharge:0,discountPct:0,validityDays:7,consentChannel:'telefon',expectedPriceWithoutVat:36000,expectedTotalPrice:43200});
assert(Number.isSafeInteger(quote.quoteId));
// Yalnız bu sentetik teklifin geliş saatini sabah olarak kur; SLA beklemesini göster.
sql(`UPDATE quotes SET created_at=(date_trunc('day',now() AT TIME ZONE 'Europe/Istanbul')+interval '9 hours') AT TIME ZONE 'Europe/Istanbul' WHERE id=${quote.quoteId}`);
const project=await post('/api/admin/office/operations',{type:'project_created',quoteId:String(quote.quoteId),name:'Örnek Sahil Yapı · İstanbul cephesi',owner:'Örnek satışçı'});
await post('/api/admin/office/operations',{type:'valuation_selected',projectId:project.projectId,quoteId:String(quote.quoteId),revision:0});
const board=await (await fetch('http://127.0.0.1:3210/api/admin/office',{headers:{authorization:auth}})).json();
const followups=[];
for(const [name,minutes] of [['Örnek Kuzey Yapı',-60],['Örnek Ada Cephe',20]]){
 const q=board.quotes.find(q=>q.customer_name===name&&q.project_id);if(!q)continue;
 const dayEnd=Number(sql("SELECT extract(epoch FROM ((date_trunc('day',now() AT TIME ZONE 'Europe/Istanbul')+interval '1 day') AT TIME ZONE 'Europe/Istanbul'))*1000"));
 followups.push(await post('/api/admin/office/operations',{type:'followup_scheduled',projectId:q.project_id,dueAt:new Date(Math.min(Date.now()+minutes*60000,dayEnd-1000)).toISOString(),owner:'Örnek satışçı'}));
}
fs.writeFileSync(root+'/docs/verification/ofis-20261008/evidence/demo-seed.json',JSON.stringify({quoteId:quote.quoteId,project,followups,synthetic:true,productionWrites:0},null,2));
console.log('İnceleme için ilk temas, geciken takip ve bugünkü takip örnekleri hazır.');
