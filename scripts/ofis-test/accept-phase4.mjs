import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {verifyTarget,sql,root} from './db.mjs';
verifyTarget();
const base='http://127.0.0.1:3210';
const authorization='Basic '+Buffer.from('preview:preview-only').toString('base64');
const report={checks:[],productionWrites:0};
const save=()=>fs.writeFileSync(root+'/docs/verification/ofis-20261008/evidence/phase4-endpoints.json',JSON.stringify(report,null,2));
async function api(path,body,method='POST'){const r=await fetch(base+path,{method,headers:{authorization,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}}
const input={customerName:'Eşzamanlı revizyon kabulü',customerPhone:'05320000018',cityCode:'34',cityName:'İstanbul',materialType:'eps',areaM2:300,title:'Sentetik',lines:[{kind:'levha',description:'Örnek EPS',quantity:300,unit:'m²',unitPrice:100,isPlate:true,thicknessCm:4,netCost:70}],shippingMode:'buyer_pays',shippingCharge:0,discountPct:0,validityDays:7,consentChannel:'telefon',expectedPriceWithoutVat:30000,expectedTotalPrice:36000};
try{
 const large={...input,customerName:'Uzun Excel kabulü',lines:Array.from({length:200},(_,i)=>({kind:'serbest',description:'Sentetik Excel kalemi '+i,quantity:1,unit:'adet',unitPrice:100,isPlate:false})),expectedPriceWithoutVat:20000,expectedTotalPrice:24000};
 const bigCreated=await api('/api/admin/quotes/manual',large);assert.equal(bigCreated.status,201);
 const bigRevised=await api('/api/admin/quotes/manual',{...large,quoteId:bigCreated.data.quoteId,expectedRevisionNo:0},'PUT');assert.equal(bigRevised.status,200,JSON.stringify(bigRevised));
 report.checks.push('200 Excel kalemli teklif gerçek endpoint ile oluşturulup revize edildi; sürüm filtresi URL boyutuna bağlı hata üretmedi.');
 const created=await api('/api/admin/quotes/manual',input);assert.equal(created.status,201);const quoteId=created.data.quoteId;
 const project=await api('/api/admin/office/operations',{type:'project_created',quoteId:String(quoteId),name:'Revizyon yarışı',owner:'Kabul'});assert.equal(project.status,200);const projectId=project.data.projectId;
 assert.equal((await api('/api/admin/office/operations',{type:'valuation_selected',projectId,quoteId:String(quoteId),revision:0})).status,200);
 const payload={...input,quoteId,expectedRevisionNo:0,shippingCharge:100,expectedPriceWithoutVat:30100,expectedTotalPrice:36120};
 const results=await Promise.all(Array.from({length:6},()=>api('/api/admin/quotes/manual',payload,'PUT')));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409,409,409,409,409]);
 const stored=JSON.parse(sql(`SELECT row_to_json(q) FROM quotes q WHERE id=${quoteId}`));assert.equal(stored.package_items.manual.revisions.length,1);assert.equal(stored.package_items.manual.revisions[0].priceWithoutVat,30000);assert.equal(stored.package_items.manual.revisions[0].pricePerM2,100);assert.equal(stored.package_items.manual.revisions[0].shippingCost,0);assert.equal(stored.price_without_vat,30100);
 assert.equal(sql(`SELECT valuation_net_amount FROM sales_projects WHERE id='${projectId}'`).trim(),'30000.00');
 assert.equal(sql(`SELECT count(*) FROM sales_tasks WHERE project_id='${projectId}' AND kind='initial_contact'`).trim(),'1');
 report.checks.push('6 eşzamanlı gerçek PUT: 1 başarılı, 5 çatışma; tek revizyon snapshotı, aynı teklif kimliği, tek ilk temas işi. Seçili proje değeri 30.000 TL’de kaldı.');
 const phoneChange=await api('/api/admin/quotes/manual',{...payload,expectedRevisionNo:1,customerPhone:'05320000017'},'PUT');assert.equal(phoneChange.status,409);assert.equal(sql(`SELECT customer_phone FROM quotes WHERE id=${quoteId}`).trim(),input.customerPhone);report.checks.push('Projeye bağlı teklifin numarası revizyonla değiştirilmedi; mevcut müşteri bağı korundu.');
 const stale=await api('/api/admin/quotes/manual',payload,'PUT');assert.equal(stale.status,409);const bad=await api('/api/admin/quotes/manual',{...payload,expectedRevisionNo:-1},'PUT');assert.equal(bad.status,400);
 const tamper=await api('/api/admin/quotes/manual',{...payload,expectedRevisionNo:1,expectedPriceWithoutVat:1},'PUT');assert.equal(tamper.status,409);
 report.checks.push('Eski revizyon numarası ve geçersiz sürüm reddedildi; istemci toplamı sunucu hesaplamasını değiştiremedi.');
 const selectOld=await api('/api/admin/office/operations',{type:'valuation_selected',projectId,quoteId:String(quoteId),revision:0});assert.equal(selectOld.data.netAmount,30000);
 const selectCurrent=await api('/api/admin/office/operations',{type:'valuation_selected',projectId,quoteId:String(quoteId),revision:1});assert.equal(selectCurrent.data.netAmount,30100);
 report.checks.push('Eski ve yeni revizyon için değerlemeye esas seçim yalnız ilgili kayıtlı KDV hariç tutarı kullandı.');
 report.passed=true;save();console.log(JSON.stringify(report));
}catch(e){report.failure=e.stack;save();throw e}
