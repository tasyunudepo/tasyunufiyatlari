import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {verifyTarget,sql,root} from './db.mjs';
verifyTarget();
// Eski ölçüm denemelerinin sabit sentetik saatlerini ayrıştır; eski kod aynı
// numara/saat anahtarı hatası nedeniyle bu kayıtları birlikte render edemiyor.
sql("UPDATE quotes SET created_at=created_at+id*interval '1 millisecond' WHERE customer_name LIKE 'Kıyas %'");
const out=root+'/docs/verification/ofis-20261008/evidence';
const report={method:'Tek masaüstü otomasyon geçişi, 1440 px. Alan odağı da tıklama sayılır; metin fill ile girilir. İnsan süresi veya dönüşüm artışı değildir. Eksik eski adımlar tamamlanmış sayılmaz.',rows:[]};
const authorization='Basic '+Buffer.from('preview:preview-only').toString('base64');
async function api(path,body,method='POST'){const r=await fetch('http://127.0.0.1:3210'+path,{method,headers:{authorization,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:body?JSON.stringify(body):undefined});const d=await r.json();assert(r.ok,JSON.stringify(d));return d}
const input=name=>({customerName:name,customerPhone:'05320000016',cityCode:'34',cityName:'İstanbul',materialType:'eps',areaM2:300,lines:[{kind:'levha',description:'Örnek EPS',quantity:300,unit:'m²',unitPrice:100,isPlate:true,thicknessCm:4}],shippingMode:'buyer_pays',shippingCharge:0,discountPct:0,validityDays:7,consentChannel:'telefon',expectedPriceWithoutVat:30000,expectedTotalPrice:36000});
const browser=await chromium.launch({headless:true});
const save=()=>fs.writeFileSync(out+'/task-comparison.json',JSON.stringify(report,null,2));
try{
 for(const variant of ['old','new']){
  const port=variant==='old'?3213:3210,base='http://127.0.0.1:'+port;
  const context=await browser.newContext({viewport:{width:1440,height:1000},httpCredentials:{username:'preview',password:'preview-only'}});
  await context.addInitScript(()=>{window.__clicks=0;document.addEventListener('click',()=>window.__clicks++,true)});
  await context.route('**/*',r=>{const u=new URL(r.request().url());return ['127.0.0.1','localhost'].includes(u.hostname)||['blob:','data:'].includes(u.protocol)?r.continue():r.abort()});
  const page=await context.newPage();page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));const name='Kıyas '+variant+' '+Date.now();const phone='0532'+String(Date.now()).slice(-7);const q=await api('/api/admin/quotes/manual',{...input(name),customerPhone:phone});const quoteId=q.quoteId;
  // Her ölçüm bağımsız bir sentetik müşteri kullanır. Eski serilerin aynı
  // telefon/timestamp anahtar çakışması ayrı regresyon kanıtında saklıdır.
  sql(`UPDATE quotes SET created_at=(date_trunc('day',now() AT TIME ZONE 'Europe/Istanbul')+interval '9 hours'+id*interval '1 millisecond') AT TIME ZONE 'Europe/Istanbul' WHERE id=${quoteId}`);
  let project;
  if(variant==='new')project=await api('/api/admin/office/operations',{type:'project_created',quoteId:String(quoteId),name,owner:'Kıyas operatörü'});
  async function click(locator){await locator.click()}
  async function fill(locator,value){await locator.click();await locator.fill(value)}
  async function nav(){await click(page.getByRole('button',{name:'Teklifler',exact:true}).first());await page.getByLabel('Tekliflerde ara',{exact:true}).waitFor()}
  async function find(){await fill(page.getByLabel('Tekliflerde ara',{exact:true}),name)}
  async function detail(){await click(page.getByRole('button',{name:variant==='old'?'Detay →':name+': Detay',exact:true}).first());await page.getByRole(variant==='old'?'dialog':'region',{name:/Teklif detayı/}).waitFor()}
  let start,clickStart;
  async function begin(){start=performance.now();clickStart=await page.evaluate(()=>window.__clicks)}
  async function end(task,complete,note){report.rows.push({variant,task,clicks:await page.evaluate(()=>window.__clicks)-clickStart,seconds:+((performance.now()-start)/1000).toFixed(2),complete,note});save()}
  await page.goto(base+'/ofis',{waitUntil:'networkidle'});await page.getByText('preview',{exact:true}).waitFor();
  await begin();
  const successes=sql('SELECT count(*) FROM customer_interactions WHERE outcome=\'ulasildi\'').trim();
  if(variant==='old'){
   await nav();await find();await detail();assert.equal(await page.getByRole('dialog').locator('a[href^="tel:"],a[href*="wa.me"]').count(),0);await end(1,false,'Talep/telefon bulundu; eski dosyada arama veya WhatsApp bağlantısı yok.');
  }else{
   await click(page.getByTestId('office-task-'+project.taskId));await click(page.getByRole('button',{name:'Telefon / Numarayı göster',exact:true}));const link=page.getByRole('link',{name:'Arama uygulamasında aç',exact:true});assert.equal(await link.getAttribute('href'),'tel:+90'+phone.slice(1));await link.evaluate(e=>e.addEventListener('click',event=>event.preventDefault(),{once:true}));await click(link);await end(1,true,'Tel hedefi doğru; dış arama engellendi, başarılı temas sayısı değişmedi.');
  }
  assert.equal(sql('SELECT count(*) FROM customer_interactions WHERE outcome=\'ulasildi\'').trim(),successes);
  await begin();
  if(variant==='old'){
   let response=page.waitForResponse(r=>r.url().endsWith('/api/admin/quotes/'+quoteId)&&r.request().method()==='PATCH');await click(page.getByRole('button',{name:'Ulaştım',exact:true}));assert.equal((await response).status(),200);await page.getByRole('dialog').waitFor({state:'hidden'});await detail();
   const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);await fill(page.getByLabel('Takip tarihi',{exact:true}),tomorrow);await fill(page.getByLabel('İlgilenen kişi',{exact:true}),'Kıyas operatörü');response=page.waitForResponse(r=>r.url().endsWith('/api/admin/quotes/'+quoteId)&&r.request().method()==='PATCH');await click(page.getByRole('button',{name:'Alanları kaydet',exact:true}));assert.equal((await response).status(),200);await end(2,true,'Temas ve tek follow_up_date alanı kaydedildi; ayrı görev/başarı geçmişi sözleşmesi yok.');assert.equal(sql(`SELECT follow_up_date FROM quotes WHERE id=${quoteId}`).trim(),tomorrow);
  }else{
   let response=page.waitForResponse(r=>r.url().endsWith('/api/admin/office/operations')&&r.request().postDataJSON().type==='contact_success');await click(page.getByRole('button',{name:'Görüştüm',exact:true}));assert.equal((await response).status(),200);await click(page.getByRole('button',{name:'Yarın',exact:true}));response=page.waitForResponse(r=>r.url().endsWith('/api/admin/office/operations')&&r.request().postDataJSON().type==='followup_scheduled');await click(page.getByRole('button',{name:'Takip planla',exact:true}));assert.equal((await response).status(),200);await end(2,true,'Temas sonucu ve tarih/sorumlulu ayrı takip görevi kaydedildi.');assert.equal(sql(`SELECT status FROM sales_tasks WHERE id='${project.taskId}'`).trim(),'done');
  }
  let overdue;
  if(variant==='old')sql(`UPDATE quotes SET follow_up_date=current_date-1 WHERE id=${quoteId}`);
  else overdue=await api('/api/admin/office/operations',{type:'followup_scheduled',projectId:project.projectId,dueAt:new Date(Date.now()-3600000).toISOString(),owner:'Kıyas operatörü'});
  await page.reload({waitUntil:'networkidle'});await page.getByText('preview',{exact:true}).waitFor();await begin();
  if(variant==='old'){
   await nav();await find();await detail();assert.equal(await page.getByRole('button',{name:/görevi tamamla|Görüştüm/i}).count(),0);await end(3,false,'Geciken tarih bulundu; bağımsız takip görevini tamamlayacak işlem yok. Tarihi silmek tamamlanma geçmişi değildir.');
  }else{
   await click(page.getByRole('button',{name:/^Geciken takip/}));await click(page.getByTestId('office-task-'+overdue.taskId));const response=page.waitForResponse(r=>r.url().endsWith('/api/admin/office/operations')&&r.request().postDataJSON().type==='contact_attempt');await click(page.getByRole('button',{name:'Ulaşamadım',exact:true}));assert.equal((await response).status(),200);await end(3,true,'Geciken görev sonuçla tamamlandı; önceki başarılı temas korundu.');assert.equal(sql(`SELECT status FROM sales_tasks WHERE id='${overdue.taskId}'`).trim(),'done');
  }
  await page.reload({waitUntil:'networkidle'});await page.getByText('preview',{exact:true}).waitFor();
  // Compile editor before measuring this route. No form data is saved in warm-up.
  await nav();await click(page.getByRole('button',{name:'Yeni Teklif',exact:true}));await page.getByTestId('manual-quote-editor').waitFor();await page.reload({waitUntil:'networkidle'});await page.getByText('preview',{exact:true}).waitFor();
  await begin();await nav();await click(page.getByRole('button',{name:'Yeni Teklif',exact:true}));
  const formName=name+' form';await fill(page.getByLabel('Müşteri adı *',{exact:true}),formName);await fill(page.getByLabel('Telefon *',{exact:true}),'05320000015');
  const city=page.getByLabel(/^Şehir/);await click(city);await city.selectOption('34');await fill(page.getByLabel('İş metrajı (m²)',{exact:true}),'300');
  const cell=page.getByLabel('Satır 1 ürün adı',{exact:true});await click(cell);await cell.evaluate(e=>{const d=new DataTransfer();d.setData('text/plain','Örnek EPS\t300\tm²\t100');e.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:d}))});
  async function persist(){const response=page.waitForResponse(r=>r.url().endsWith('/api/admin/quotes/manual')&&['POST','PUT'].includes(r.request().method()));await click(page.getByTestId('manual-quote-save'));const r=await response;assert([200,201].includes(r.status()),await r.text());const data=await r.json();await page.getByTestId('manual-quote-success').waitFor({timeout:45000});assert.equal(await page.getByTestId('manual-quote-pdf-warning').count(),0);return data}
  const doc=await persist();const download=page.waitForEvent('download');await click(page.getByTestId('manual-quote-pdf-download'));await (await download).saveAs(out+'/comparison-'+variant+'.pdf');
  await click(page.getByRole('button',{name:'Teklif Listesi',exact:true}));await fill(page.getByLabel('Tekliflerde ara',{exact:true}),formName);
  if(variant==='new')await click(page.getByRole('button',{name:formName+': Diğer işlemler',exact:true}));await click(page.getByTestId('quote-revise-'+doc.quoteId));await fill(page.getByLabel('İş metrajı (m²)',{exact:true}),'400');await fill(page.getByLabel('Satır 1 miktar',{exact:true}),'400');await persist();
  await click(page.getByRole('button',{name:'Teklif Listesi',exact:true}));await fill(page.getByLabel('Tekliflerde ara',{exact:true}),formName);await click(page.getByRole('button',{name:variant==='old'?'Detay →':formName+': Detay',exact:true}).first());
  if(variant==='new'){await page.getByRole('table',{name:'Revizyon karşılaştırması'}).waitFor();await end(4,true,'Yeni teklif, PDF, aynı numaraya revizyon ve önce/güncel karşılaştırma tamamlandı.')}
  else {assert.equal(await page.getByRole('table',{name:'Revizyon karşılaştırması'}).count(),0);await end(4,false,'Teklif/PDF/revizyon tamamlandı; eski arayüzde sürüm karşılaştırması yok.')}
  await page.screenshot({path:out+'/comparison-'+variant+'.png',fullPage:true});await context.close();
 }
 report.passed=true;save();console.log(JSON.stringify(report));
}catch(e){report.failure=e.stack;save();throw e}finally{await browser.close()}
