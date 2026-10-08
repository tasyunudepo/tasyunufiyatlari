import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='docs/verification/ofis-20261008/evidence';
const report={screens:[],checks:[],errors:[],external:[]};
const save=()=>fs.writeFileSync(out+'/phase2-browser.json',JSON.stringify(report,null,2));
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},httpCredentials:{username:'preview',password:'preview-only'},permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
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
try{
 await page.goto('http://127.0.0.1:3210/ofis',{waitUntil:'networkidle'});
 await page.getByTestId('office-today').waitFor();
 for(const width of [375,390,768,1440]){
  await page.setViewportSize({width,height:1000});await scan('today-'+width);
  await page.screenshot({path:out+'/phase2-today-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.documentElement.style.zoom='2');await scan('today-200-percent');await page.evaluate(()=>document.documentElement.style.zoom='');
 const before=await counts();assert.equal(before[0],before[1]+before[2]+before[3]);
 const panel=page.getByTestId('office-project-panel');
 await panel.getByRole('button',{name:'Telefon / Numarayı göster',exact:true}).click();
 const tel=await panel.getByRole('link',{name:'Arama uygulamasında aç'}).getAttribute('href');assert.match(tel,/^tel:\+90/);
 const wa=await panel.getByRole('link',{name:'WhatsApp',exact:true}).getAttribute('href');assert.match(wa,/^https:\/\/wa.me\/90/);
 await panel.getByRole('button',{name:'Kopyala',exact:true}).click();await panel.getByText('Numara kopyalandı.',{exact:true}).waitFor();
 await page.waitForTimeout(300);await panel.getByRole('button',{name:'İşlem yapmadım',exact:true}).click();assert.deepEqual(await counts(),before);
 report.checks.push('Numara kopyalama ve İşlem yapmadım günlük görev/başarı sayacını değiştirmez; tel/WhatsApp hedefi kontrol edildi, gerçek bağlantı açılmadı.');
 await panel.getByRole('button',{name:'Görüştüm',exact:true}).click();
 await page.waitForFunction(n=>Number(document.querySelector('[data-testid="daily-done"]')?.textContent)===n,before[1]+1);
 const after=await counts();assert.equal(after[0],before[0]);assert.equal(after[2],before[2]-1);
 await page.reload({waitUntil:'networkidle'});assert.deepEqual(await counts(),after);
 report.checks.push('Sonuç sunucuda kaydedilince görev tamamlandı; günlük toplam değişmedi; yenilemede kalıcı.');
 const active=page.getByTestId('office-project-panel');
 let failedKey;
 await page.route('**/api/admin/office/operations',r=>{failedKey=r.request().headers()['idempotency-key'];return r.fulfill({status:503,json:{ok:false,error:'Sentetik yanıt hatası'}})});
 await active.getByLabel('Görüşme notu',{exact:true}).fill('Girdi korunmalı');await active.getByRole('button',{name:'Ulaşamadım',exact:true}).click();
 await active.getByRole('alert').getByText('Sentetik yanıt hatası',{exact:false}).waitFor();assert.equal(await active.getByLabel('Görüşme notu',{exact:true}).inputValue(),'Girdi korunmalı');
 await page.unroute('**/api/admin/office/operations');
 const retry=page.waitForRequest(r=>r.url().endsWith('/api/admin/office/operations'));
 await active.getByRole('button',{name:'Ulaşamadım',exact:true}).click();assert.equal((await retry).headers()['idempotency-key'],failedKey);
 await page.waitForTimeout(400);report.checks.push('Hata sonrası not ve işlem anahtarı korunur; aynı eylemle retry yapılır.');
 const ro=await browser.newContext({viewport:{width:375,height:1000},httpCredentials:{username:'patron',password:'preview-readonly'}});
 const roPage=await ro.newPage();await roPage.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await roPage.goto('http://127.0.0.1:3210/ofis',{waitUntil:'networkidle'});await roPage.getByTestId('office-today').waitFor();
 assert.equal(await roPage.getByRole('button',{name:'Görüştüm',exact:true}).count(),0);assert.equal(await roPage.getByRole('button',{name:'Takip planla',exact:true}).count(),0);await ro.close();report.checks.push('Patron mobilde dosyayı okur; sonuç ve takip yazma kontrolleri yok.');
 assert.equal(report.errors.length,0);assert.equal(report.external.length,0);
 for(const s of report.screens)assert.equal(s.small.length+s.contrast.length+s.targets.length+s.outside.length,0,JSON.stringify(s));
 report.passed=true;save();console.log(JSON.stringify({passed:true,views:report.screens.length,checks:report.checks}));
}catch(e){report.failure=e.stack;save();throw e}finally{await browser.close()}
