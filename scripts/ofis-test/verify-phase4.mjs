import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sql,verifyTarget,state} from './db.mjs';
verifyTarget();
const out='docs/verification/ofis-20261008/evidence';
const report={screens:[],checks:[],errors:[],external:[]};
const save=()=>fs.writeFileSync(out+'/phase4-browser.json',JSON.stringify(report,null,2));
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},httpCredentials:{username:'preview',password:'preview-only'},permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
await page.addInitScript(()=>{window.__pdfTexts=[];new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n instanceof HTMLElement&&n.parentElement===document.body&&n.textContent.includes('MANTOLAMA SETİ FİYAT TEKLİFİ'))window.__pdfTexts.push(n.innerText)}).observe(document,{childList:true,subtree:true})});
await context.route('**/*',r=>{const u=new URL(r.request().url());if(['127.0.0.1','localhost'].includes(u.hostname)||['blob:','data:'].includes(u.protocol))return r.continue();report.external.push(u.origin);return r.abort()});
const counts=async()=>{const v=await Promise.all(['total','done','open','cancelled'].map(n=>page.getByTestId('daily-'+n).innerText()));return v.map(Number)};
async function scan(label){
 const data=await page.evaluate(()=>{
  const rgba=s=>{const m=s.match(/[\d.]+/g)?.map(Number);return m?{r:m[0],g:m[1],b:m[2],a:m[3]??1}:{r:255,g:255,b:255,a:1}};
  const blend=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
  const lum=c=>[c.r,c.g,c.b].map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
  const visible=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility==='visible'&&s.display!=='none'&&r.right>0&&r.x<innerWidth};
  const root=document.querySelector('.ofis-surface');const small=[],contrast=[],targets=[],outside=[],gradients=[];
  const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walk.nextNode()){
   const n=walk.currentNode,e=n.parentElement;if(!n.textContent.trim()||!visible(e)||e.closest('script,style,option,svg,[aria-hidden="true"],button:disabled'))continue;
   const s=getComputedStyle(e),size=parseFloat(s.fontSize);if(size<14)small.push({text:n.textContent.trim().slice(0,70),size});
   const chain=[];for(let a=e;a;a=a.parentElement)chain.unshift(a);
   let bg={r:255,g:255,b:255,a:1},opacity=1,gradient=false;
   for(const a of chain){const st=getComputedStyle(a);bg=blend(rgba(st.backgroundColor),bg);opacity*=Number(st.opacity);if(st.backgroundImage!=='none')gradient=true;}
   if(gradient){gradients.push(n.textContent.trim().slice(0,50));continue;}
   const fg=rgba(s.color);fg.a*=opacity;const l1=lum(blend(fg,bg)),l2=lum(bg);const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
   if(ratio<4.5)contrast.push({text:n.textContent.trim().slice(0,70),ratio:+ratio.toFixed(2),fg:s.color,bg});
  }
  for(const e of root.querySelectorAll('main button,main select,main input:not([type="checkbox"]):not([type="range"]),main a,.nx-topbar button,.nx-topbar a')){
   if(!visible(e))continue;const r=e.getBoundingClientRect();const item={text:(e.getAttribute('aria-label')||e.textContent||e.getAttribute('placeholder')||'input').trim().slice(0,70),x:r.x,right:r.right,width:r.width,height:r.height};
   // Horizontal data tables have their own intentional scroll region.
   if(!e.closest('.overflow-x-auto,.admin-nexus-table-wrap')&&(r.x<-.5||r.right>innerWidth+.5))outside.push(item);
   if(r.width<43.5||r.height<43.5)targets.push(item);
  }
  return {width:innerWidth,scroll:document.documentElement.scrollWidth,small,contrast,targets,outside,gradients};
 });
 report.screens.push({label,...data});save();
 return data;
}

const name='Faz 4 Örnek '+Date.now();let quoteId;const timings=[];
async function navQuotes(){const nav=page.getByRole('navigation',{name:'Ofis navigasyonu'}).getByRole('button',{name:'Teklifler',exact:true});if(!await nav.isVisible())await page.getByTestId('admin-drawer-toggle').click();await nav.click();}
async function saveQuote(){const r=page.waitForResponse(r=>r.url().endsWith('/api/admin/quotes/manual')&&['POST','PUT'].includes(r.request().method()));await page.getByTestId('manual-quote-save').click();const response=await r;assert([200,201].includes(response.status()),await response.text());const data=await response.json();await page.getByTestId('manual-quote-success').waitFor({timeout:45000});assert.equal(await page.getByTestId('manual-quote-pdf-warning').count(),0);await page.getByTestId('manual-quote-pdf-download').waitFor();return data;}
try{
 await page.goto('http://127.0.0.1:3210/ofis',{waitUntil:'networkidle'});await navQuotes();await page.getByRole('button',{name:'Yeni Teklif',exact:true}).click();
 await page.getByLabel('Müşteri adı *',{exact:true}).fill(name);await page.getByLabel('Telefon *',{exact:true}).fill('05320000019');await page.getByLabel('Şehir *',{exact:true}).selectOption('34');await page.getByLabel('Malzeme',{exact:true}).selectOption('eps');await page.getByLabel('İş metrajı (m²)',{exact:true}).fill('300');
 await page.getByLabel('Satır 1 ürün adı',{exact:true}).evaluate(e=>{const dt=new DataTransfer();dt.setData('text/plain','Örnek EPS levha\t300\tm²\t120\nÖrnek teslim hizmeti\t1\tadet\t200');e.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:dt}))});
 assert.equal(await page.locator('input[aria-label$="ürün adı"]').count(),3);
 await page.getByLabel('Toplu iskonto yüzdesi',{exact:true}).fill('10');await page.getByLabel('Nakliye tutarı',{exact:true}).fill('500');await page.getByLabel("Teklif notu (PDF'e girer)",{exact:true}).fill('Sentetik kabul teklifi.');
 for(const width of [375,390,768,1440]){await page.setViewportSize({width,height:1000});await scan('builder-'+width);await page.screenshot({path:out+'/phase4-builder-'+width+'.png',fullPage:true})}
 await page.evaluate(()=>document.documentElement.style.zoom='2');await scan('builder-200-percent');await page.evaluate(()=>document.documentElement.style.zoom='');
 const start=Date.now();const created=await saveQuote();quoteId=created.quoteId;timings.push({action:'save+pdf',ms:Date.now()-start});
 assert.equal(created.totals.priceWithoutVat,33080);assert.equal(created.totals.totalPrice,39696);
 let stored=JSON.parse(sql(`SELECT row_to_json(q) FROM quotes q WHERE id=${quoteId}`));assert(stored.pdf_storage_path);const oldPdf=stored.pdf_storage_path;assert.equal(fs.readFileSync(state+'/objects/quote-pdfs/'+oldPdf).subarray(0,5).toString(),'%PDF-');
 const pdf=await context.request.get('http://127.0.0.1:3210/api/admin/quotes/'+quoteId+'/pdf');assert.equal(pdf.status(),200);assert.equal((await pdf.body()).subarray(0,5).toString(),'%PDF-');
 const pdfTexts=await page.evaluate(()=>window.__pdfTexts);assert(pdfTexts.length>0);assert(!pdfTexts.some(t=>/net maliyet|iç maliyet|brüt kâr|marj/i.test(t)));report.pdfTextCaptured=true;
 report.checks.push('Excel iki satır yapıştırma, %10 iskonto ve 500 TL nakliye: sunucu 33.080 KDV hariç / 39.696 KDV dahil; gerçek PDF üretildi, yerel depoya yüklendi ve gerçek PDF endpoint’inden alındı.');
 await page.getByRole('button',{name:'Teklif Listesi',exact:true}).click();await page.getByLabel('Tekliflerde ara',{exact:true}).fill(name);await page.getByRole('button',{name:name+': Diğer işlemler',exact:true}).click();await page.getByTestId('quote-revise-'+quoteId).click();
 await page.setViewportSize({width:375,height:1000});assert.equal(await page.getByLabel('Müşteri adı *',{exact:true}).inputValue(),name);await page.getByLabel('İş metrajı (m²)',{exact:true}).fill('400');await page.getByLabel('Satır 1 miktar',{exact:true}).fill('400');
 const revised=await saveQuote();assert.equal(revised.quoteId,quoteId);assert.equal(revised.revisionNo,1);
 stored=JSON.parse(sql(`SELECT row_to_json(q) FROM quotes q WHERE id=${quoteId}`));const old=stored.package_items.manual.revisions[0];assert.equal(old.priceWithoutVat,33080);assert.equal(old.pricePerM2,110.27);assert.equal(old.shippingCost,500);assert.equal(old.pdfStoragePath,oldPdf);assert(fs.existsSync(state+'/objects/quote-pdfs/'+oldPdf));assert.notEqual(stored.pdf_storage_path,oldPdf);
 await page.getByRole('button',{name:'Teklif Listesi',exact:true}).click();await page.getByLabel('Tekliflerde ara',{exact:true}).fill(name);await page.getByRole('button',{name:name+': Detay',exact:true}).click();await page.getByRole('table',{name:'Revizyon karşılaştırması'}).waitFor();await scan('revision-mobile');await page.screenshot({path:out+'/phase4-revision-mobile.png',fullPage:true});assert((await page.getByRole('table',{name:'Revizyon karşılaştırması'}).innerText()).includes('33.080'));
 report.checks.push('Mobilde aynı numaraya revize edildi; eski PDF ve metraj/birim/nakliye/toplam snapshotı korundu, önce/güncel karşılaştırma görüntülendi. İç maliyet ve marj PDF çizim kaynağına girmedi.');
 await page.getByRole('button',{name:'Listeye dön',exact:true}).click();await page.getByRole('button',{name:name+': Diğer işlemler',exact:true}).click();await page.getByTestId('quote-duplicate-'+quoteId).click();assert.equal(await page.getByLabel('Müşteri adı *',{exact:true}).inputValue(),name);assert.equal(await page.getByTestId('revize-banner').count(),0);report.checks.push('Çoğalt müşteri/kalemleri taşır; revize kipine girmez.');
 for(const role of ['admin','patron']){const read=await browser.newContext({viewport:{width:375,height:1000},httpCredentials:{username:role==='patron'?'patron':'preview',password:role==='patron'?'preview-readonly':'preview-only'}});const p=await read.newPage();await p.goto('http://127.0.0.1:3210/ofis',{waitUntil:'networkidle'});if(role==='patron'){await p.getByTestId('admin-drawer-toggle').click();await p.getByRole('navigation').getByRole('button',{name:'Teklifler',exact:true}).click();assert.equal(await p.getByRole('button',{name:'Yeni Teklif',exact:true}).count(),0);const denied=await read.request.put('http://127.0.0.1:3210/api/admin/quotes/manual',{data:{quoteId}});assert.equal(denied.status(),403)}await read.close()}
 report.checks.push('Mobil salt okunur hesapta oluşturma/revizyon eylemleri yok; gerçek PUT endpoint’i 403.');
 report.quoteId=quoteId;report.timings=timings;assert.equal(report.errors.length,0);assert.equal(report.external.length,0);for(const v of report.screens)assert.equal(v.small.length+v.contrast.length+v.targets.length+v.outside.length,0,JSON.stringify(v));report.passed=true;save();console.log(JSON.stringify({passed:true,views:report.screens.length,checks:report.checks}));
}catch(e){report.quoteId=quoteId;report.failure=e.stack;save();await page.screenshot({path:out+'/phase4-failure.png',fullPage:true});throw e}finally{await browser.close()}
