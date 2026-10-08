import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const phase=process.argv[2]||'phase0';
const out=path.resolve('docs/verification/ofis-20261008/evidence');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
const report={errors:[],external:[],requests:[],screens:[],checks:[]};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('request',r=>report.requests.push({url:r.url(),method:r.method()}));
await context.route('**/*',r=>{const u=new URL(r.request().url());if(['127.0.0.1','localhost'].includes(u.hostname)||['data:','blob:'].includes(u.protocol))return r.continue();report.external.push(u.origin);return r.abort()});
const save=()=>fs.writeFileSync(path.join(out,phase+'-validation.json'),JSON.stringify(report,null,2));
async function navigate(name){
 const button=page.getByRole('navigation',{name:'Ofis navigasyonu'}).getByRole('button',{name,exact:true});
 if(!await button.isVisible())await page.getByTestId('admin-drawer-toggle').click();
 await button.click();await page.waitForTimeout(450);
 await page.locator('main').getByText('yükleniyor',{exact:false}).first().waitFor({state:'hidden',timeout:10000}).catch(()=>{});
}
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
 await page.goto('http://127.0.0.1:3210/ofis',{waitUntil:'networkidle',timeout:90000});
 await page.getByLabel('Giriş yapan kullanıcı').getByText('Önizleme',{exact:true}).waitFor();
 await page.evaluate(()=>document.fonts.ready);
 const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
 report.fonts={loaded:await page.evaluate(()=>[...document.fonts].map(f=>({family:f.family,status:f.status}))),rendered:{}};
 for(const id of ['font-specimen','font-turkish','font-technical']){
  await page.locator('#'+id).scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);
  const doc=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#'+id});
  report.fonts.rendered[id]=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
 }
 report.fonts.computed=await page.locator('#font-specimen').evaluate(e=>({family:getComputedStyle(e).fontFamily,size:getComputedStyle(e).fontSize,numeric:getComputedStyle(e).fontVariantNumeric}));
 await page.locator('.ofis-font-specimen').screenshot({path:path.join(out,phase+'-font-specimen.png')});
 for(const width of [1440,768,390,375]){
  await page.setViewportSize({width,height:1000});
  for(const [id,name] of [['dashboard','Genel Bakış'],['quotes','Teklifler'],['analytics','Analiz'],['experiments','Satış Deneyleri'],['pricing','Fiyatlandırma'],['catalog','Katalog']]){
   await navigate(name);await page.evaluate(()=>window.scrollTo(0,0));await scan(`${id}-${width}`);
   if(['dashboard','quotes','analytics'].includes(id))await page.screenshot({path:path.join(out,`${phase}-${id}-${width}.png`),fullPage:true});
  }
 }
 await navigate('Teklifler');
 const row=page.getByTestId('quote-row-201');const more=row.getByRole('button',{name:'Örnek Kuzey Yapı: Diğer işlemler'});
 await more.click();await scan('menu-375');
 await row.getByRole('button',{name:'Teklifi sil',exact:true}).scrollIntoViewIfNeeded();
 const hit=await row.getByRole('button',{name:'Teklifi sil',exact:true}).evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))});
 assert(hit,'Sil menü içinde erişilebilir');
 await page.keyboard.press('Escape');assert.equal(await more.getAttribute('aria-expanded'),'false');assert(await more.evaluate(e=>e===document.activeElement));
 await more.press('Enter');await page.keyboard.press('Tab');assert(await row.locator('.ofis-more-panel').evaluate(e=>e.contains(document.activeElement)));
 let confirmed=false;page.once('dialog',async d=>{confirmed=true;await d.dismiss()});await row.getByRole('button',{name:'Teklifi sil',exact:true}).click();assert(confirmed);report.checks.push('Diğer: klavye aç/kapat, Tab erişimi, Escape odağı, silme iptali');
 await page.keyboard.press('Escape');await row.getByRole('button',{name:'Örnek Kuzey Yapı: Detay',exact:true}).click();
 if(phase==='phase1'){
  await page.getByTestId('contact-state').getByText('Başarılı temas kaydı var',{exact:true}).waitFor();
  assert.match(await page.getByTestId('contact-latest').innerText(),/Ulaşılamadı/);
  report.checks.push('Önce başarılı, sonra başarısız temas: başarı korunur; son girişim başarısızdır');
  await page.getByTestId('quote-contact-history').scrollIntoViewIfNeeded();
  await page.getByTestId('quote-contact-history').screenshot({path:path.join(out,'phase1-contact-history-375.png')});
 }
 await scan('detail-375');
 await page.getByRole('dialog').screenshot({path:path.join(out,phase+'-detail-375.png')});await page.keyboard.press('Escape');
 await more.click();await row.getByTestId('quote-revise-201').click();await scan('revise-375');
 assert(await page.getByText('revize ediliyor.',{exact:false}).isVisible());report.checks.push('Revize menüsü mevcut editörü açar');
 await page.goto('http://127.0.0.1:3210/ofis',{waitUntil:'networkidle'});await navigate('Analiz');
 // CSS zoom 2 with 1440 physical CSS px gives 720 px effective layout.
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.documentElement.style.zoom='2');await scan('analytics-200-percent');
 await page.screenshot({path:path.join(out,phase+'-zoom-200.png'),fullPage:true});await page.evaluate(()=>document.documentElement.style.zoom='');
 await page.setViewportSize({width:720,height:500});await scan('analytics-200-reflow-equivalent');
 await page.goto('http://127.0.0.1:3210/ofis?role=patron',{waitUntil:'networkidle'});await navigate('Teklifler');
 assert.equal(await page.getByRole('button',{name:'Yeni Teklif',exact:true}).count(),0);
 await page.getByTestId('quote-row-201').getByRole('button',{name:'Örnek Kuzey Yapı: Diğer işlemler'}).click();
 assert.equal(await page.getByRole('button',{name:'Teklifi sil',exact:true}).count(),0);assert.equal(await page.getByTestId('quote-revise-201').count(),0);
 report.checks.push('Patron: yeni teklif, revize, çoğalt, sil, durum ve öncelik mutasyonları yok');

 if(phase==='phase1'){
  await page.keyboard.press('Escape');
  await page.getByTestId('quote-row-201').getByRole('button',{name:'Örnek Kuzey Yapı: Detay',exact:true}).click();
  await page.getByTestId('contact-state').getByText('Başarılı temas kaydı var',{exact:true}).waitFor();
  report.checks.push('Patron mevcut görüşme geçmişini okuyabilir');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Teklif Verildi',exact:true}).click();
  assert.match(await page.getByTestId('status-denominator').innerText(),/1 teklif/);
  assert.equal(await page.getByTestId('status-count-quoted').innerText(),'1');
  report.checks.push('Durum filtresi liste ve dağılım paydasını birlikte değiştirir');
  const payload=await (await page.request.get('http://127.0.0.1:3210/api/admin/quotes')).json();
  payload.quotes.at(-1).status='legacy_unknown';
  await page.route('**/api/admin/quotes',r=>r.fulfill({json:payload}));
  await page.reload({waitUntil:'networkidle'});await navigate('Teklifler');
  assert.equal(await page.getByTestId('status-count-unknown').innerText(),'1');
  const counts=await page.locator('[data-testid^="status-count-"]').allTextContents();assert.equal(counts.reduce((a,b)=>a+Number(b),0),6);
  await page.getByRole('button',{name:'Durumu belirsiz',exact:true}).click();
  assert.match(await page.getByTestId('status-denominator').innerText(),/1 teklif/);
  await scan('unknown-filter-720');
  report.checks.push('Bilinmeyen durum korunur, ayrı filtrelenir ve dağılım toplamından düşmez');
  await page.unroute('**/api/admin/quotes');
  await page.route('**/api/admin/quotes/201/interactions',r=>r.fulfill({status:503,json:{ok:false,error:'Görüşme geçmişi alınamadı. Teklifteki eski alanlar korunuyor.'}}));
  await page.goto('http://127.0.0.1:3210/ofis?role=patron',{waitUntil:'networkidle'});await navigate('Teklifler');
  await page.getByTestId('quote-row-201').getByRole('button',{name:'Örnek Kuzey Yapı: Detay',exact:true}).click();
  await page.getByTestId('contact-state').getByText('Temas geçmişi doğrulanamadı',{exact:true}).waitFor();
  const history=page.getByTestId('quote-contact-history');
  assert.match(await history.innerText(),/Başarı geçmişi doğrulanamadı/);
  assert.doesNotMatch(await history.innerText(),/Bu teklife bağlı görüşme kaydı yok/);
  await scan('contact-history-error-720');
  await history.scrollIntoViewIfNeeded();await history.screenshot({path:path.join(out,'phase1-contact-read-error.png')});
  await page.unroute('**/api/admin/quotes/201/interactions');await history.getByRole('button',{name:'Tekrar dene',exact:true}).click();
  await page.getByTestId('contact-state').getByText('Başarılı temas kaydı var',{exact:true}).waitFor();
  report.checks.push('Geçmiş okuma hatası boş kayıt gibi gösterilmez; tekrar denemede başarı özeti geri gelir');
 }
 report.mutationGuard=[];
 for(const [method,url] of [['POST','/api/upload-pdf'],['PATCH','/api/admin/quotes/201'],['DELETE','/rest/v1/quotes'],['POST','/auth/v1/token'],['PUT','/storage/v1/object/test/file']]){
  const res=await page.request.fetch('http://127.0.0.1:3210'+url,{method,data:{synthetic:true}});report.mutationGuard.push({method,url,status:res.status()});assert.equal(res.status(),405);
 }
 assert.equal(report.errors.length,0);assert.equal(report.external.length,0);
 for(const screen of report.screens)assert.equal(screen.small.length+screen.contrast.length+screen.targets.length+screen.outside.length,0,screen.label+' görsel kontrolü');
 assert(report.fonts.rendered['font-turkish'].fonts.every(f=>f.isCustomFont&&f.familyName==='Atkinson Hyperlegible Next'));
 save();console.log(JSON.stringify({checks:report.checks,errors:report.errors,external:report.external,fonts:report.fonts.rendered,issues:report.screens.filter(s=>s.small.length||s.contrast.length||s.targets.length||s.outside.length).map(s=>({label:s.label,small:s.small,contrast:s.contrast,targets:s.targets,outside:s.outside})),guard:report.mutationGuard}));
}catch(e){report.failure=e.stack;save();console.error(e);process.exitCode=1}finally{await browser.close()}
