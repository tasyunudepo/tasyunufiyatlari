import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const phase=process.argv[2]||'baseline';
const out=path.resolve('docs/verification/ofis-20261008/evidence');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[],requests=[],external=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
await page.route('**/*',r=>{const u=new URL(r.request().url());if(['127.0.0.1','localhost'].includes(u.hostname)||u.protocol==='data:')return r.continue();external.push(u.origin);return r.abort()});
await page.goto('http://127.0.0.1:3210/ofis',{waitUntil:'networkidle',timeout:90000});
await page.getByLabel('Giriş yapan kullanıcı').getByText('Önizleme', {exact:true}).waitFor();
await page.evaluate(()=>document.fonts.ready);
const result={phase,errors,external};
result.loadedFonts=await page.evaluate(()=>[...document.fonts].map(f=>({family:f.family,status:f.status})));
result.css=await page.locator('main').evaluate(e=>({font:getComputedStyle(e).fontFamily,sans:getComputedStyle(e).getPropertyValue('--font-sans'),geist:getComputedStyle(document.body).getPropertyValue('--font-geist-sans')}));
const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
await page.evaluate(()=>{const e=document.createElement('p');e.id='font-probe';e.textContent='Örnek Kuzey Yapı · 08.10.2026 · 1.680 m² · 263.692,80 ₺ · O/0 · I/ı/İ/1 · İ ı ş ğ ç ö ü';document.querySelector('main').prepend(e)});
await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const doc=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#font-probe'});result.renderedFonts=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
await page.getByRole('navigation',{name:'Ofis navigasyonu'}).getByRole('button',{name:'Teklifler',exact:true}).click();await page.waitForTimeout(1000);
const geometry=[];
for(const width of [1440,768,375]){
 await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,phase+'-'+width+'.png'),fullPage:true});
 geometry.push({width,...await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,clipped:[...document.querySelectorAll('main button, main select')].map(e=>{const r=e.getBoundingClientRect();return {label:e.textContent?.slice(0,30),x:r.x,right:r.right,w:r.width}}).filter(x=>x.w>0&&(x.x<0||x.right>innerWidth+1))}))});
}
result.geometry=geometry;result.requests=requests;fs.writeFileSync(path.join(out,phase+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({phase,css:result.css,renderedFonts:result.renderedFonts,geometry:geometry.map(g=>({width:g.width,clipped:g.clipped.length})),errors,external}));await browser.close();
