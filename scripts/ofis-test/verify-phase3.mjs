import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='docs/verification/ofis-20261008/evidence';
const report={screens:[],checks:[],errors:[],external:[]};
const save=()=>fs.writeFileSync(out+'/phase3-browser.json',JSON.stringify(report,null,2));
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
async function navigateQuotes(){
 const nav=page.getByRole('navigation',{name:'Ofis navigasyonu'}).getByRole('button',{name:'Teklifler',exact:true});
 if(!await nav.isVisible())await page.getByTestId('admin-drawer-toggle').click();await nav.click();await page.getByLabel('Tekliflerde ara',{exact:true}).waitFor();
}
try{
 await page.goto('http://127.0.0.1:3210/ofis',{waitUntil:'networkidle'});await navigateQuotes();
 await page.getByLabel('Tekliflerde ara',{exact:true}).fill('Örnek Kuzey');
 await page.locator('[data-testid^="quote-contact-"]').getByText('Proje · Başarılı temas kaydı var',{exact:true}).waitFor();
 await page.getByLabel('Görünüm adı',{exact:true}).fill('Kuzey görünümü');await page.getByRole('button',{name:'Görünümü kaydet',exact:true}).click();
 for(const width of [375,390,768,1440]){
  await page.setViewportSize({width,height:1000});await scan('list-'+width);
  await page.getByRole('button',{name:'Örnek Kuzey Yapı: Detay',exact:true}).click();
  const detail=page.getByRole(width<1200?'dialog':'region',{name:/Teklif detayı/});await detail.waitFor();
  await detail.getByLabel('Teknik föy',{exact:true}).waitFor();await scan('detail-'+width);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:out+'/phase3-detail-'+width+'.png',fullPage:true});
  await detail.getByRole('button',{name:'Listeye dön',exact:true}).click();
  assert.equal(await page.getByLabel('Tekliflerde ara',{exact:true}).inputValue(),'Örnek Kuzey');
 }
 report.checks.push('375/390/768 px tam ekran detay; 1440 px yan yana liste/dosya. Kapanınca arama korunur.');
 await page.getByLabel('Tekliflerde ara',{exact:true}).fill('eşleşme yok');assert.equal(await page.locator('[data-testid^="quote-row-"]').count(),0);
 await page.getByRole('button',{name:'Kuzey görünümü',exact:true}).click();assert.equal(await page.getByLabel('Tekliflerde ara',{exact:true}).inputValue(),'Örnek Kuzey');
 await page.reload({waitUntil:'networkidle'});await navigateQuotes();await page.getByRole('button',{name:'Kayıtlı görünümler',exact:true}).click();await page.getByRole('button',{name:'Kuzey görünümü',exact:true}).click();assert.equal(await page.getByLabel('Tekliflerde ara',{exact:true}).inputValue(),'Örnek Kuzey');
 report.checks.push('Filtre sonuçları eşleşiyor; adlandırılmış görünüm tarayıcı yenilemesinde korunur.');
 await page.setViewportSize({width:375,height:1000});
 await page.getByRole('button',{name:'Örnek Kuzey Yapı: Detay',exact:true}).scrollIntoViewIfNeeded();const y=await page.evaluate(()=>window.scrollY);
 await page.getByRole('button',{name:'Örnek Kuzey Yapı: Detay',exact:true}).click();await page.keyboard.press('Escape');await page.waitForTimeout(100);assert(Math.abs(await page.evaluate(()=>window.scrollY)-y)<4);report.checks.push('Mobil detaydan Escape ile dönünce liste kaydırması ve filtre korunur.');
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.documentElement.style.zoom='2');await scan('sheet-200-percent');await page.evaluate(()=>document.documentElement.style.zoom='');
 assert.equal(report.errors.length,0);assert.equal(report.external.length,0);
 for(const v of report.screens)assert.equal(v.small.length+v.contrast.length+v.targets.length+v.outside.length,0,JSON.stringify(v));
 report.passed=true;save();console.log(JSON.stringify({passed:true,views:report.screens.length,checks:report.checks}));
}catch(e){report.failure=e.stack;save();await page.screenshot({path:out+'/phase3-failure.png',fullPage:true});throw e}finally{await browser.close()}
