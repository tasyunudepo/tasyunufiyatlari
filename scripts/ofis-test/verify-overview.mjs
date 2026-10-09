// Genel Bakış alt bölümleri, hızlı erişim, üst çubuk ve durum seçicisi.
// Yalnız okur: GET dışındaki istekler tarayıcıda kesilir, kayıt oluşturmaz.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='docs/verification/ofis-20261008/evidence';
const report={checks:[],errors:[],views:[]};
const browser=await chromium.launch({headless:true});
async function open(width,height){
 const context=await browser.newContext({baseURL:'http://127.0.0.1:3210',viewport:{width,height},httpCredentials:{username:'preview',password:'preview-only'}});
 await context.route('**/*',r=>['GET','HEAD'].includes(r.request().method())?r.continue():r.abort());
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('/ofis',{waitUntil:'networkidle'});await page.getByTestId('office-today').waitFor();return page;
}
const geometry=page=>page.evaluate(()=>{const cw=document.documentElement.clientWidth;
 const small=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 for(let n=w.nextNode();n;n=w.nextNode()){if(n.textContent.trim().length<2)continue;const e=n.parentElement,r=e.getBoundingClientRect();if(!r.width)continue;if(parseFloat(getComputedStyle(e).fontSize)<14)small.push(n.textContent.trim().slice(0,24))}
 const targets=[...document.querySelectorAll('main button,main a,main select,main input,main summary,nav button,header button,header a')].map(e=>({r:e.getBoundingClientRect(),t:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,24)})).filter(x=>x.r.width>0&&(x.r.height<43.5||x.r.width<43.5)).map(x=>x.t);
 return {overflow:document.documentElement.scrollWidth-cw,small,targets}});

// ── 1440: bölümler kayıtlardan dolu ──
let page=await open(1440,900);
const overview=page.getByTestId('office-overview');await overview.waitFor();
for(const h of ['Talep kalitesi ve kaynaklar','Bugünkü ekip planı','Fiyat ve ürün kontrolü','Son işlemler','Yarınki planlananlar'])await page.getByRole('heading',{name:h,exact:true}).waitFor();
// Sayaç ile ekip planı aynı görev kümesi: plan satırı sayısı = min(toplam, 8).
const total=Number(await page.getByTestId('daily-total').textContent());
const planRows=await page.locator('section[aria-labelledby="ofis-plan"] tbody tr').count();
assert.equal(planRows,Math.min(total,8),'Ekip planı günlük toplamla uyuşmalı');
// Kaynak tablosundaki tekil proje toplamı dipnottaki toplamla eşit.
const src=page.locator('section[aria-labelledby="ofis-kaynak"]');
const cells=await src.locator('tbody tr td:nth-child(3)').allTextContents();
const foot=await src.locator('p.ofis-helper').last().textContent();
const stated=Number(/toplam (\d+) proje/.exec(foot)?.[1]??NaN);
assert.equal(cells.reduce((t,c)=>t+Number(c),0),stated,'Kaynak satırlarının toplamı tekil proje sayısına eşit olmalı');
let g=await geometry(page);assert.equal(g.overflow,0);assert.deepEqual(g.small,[]);assert.deepEqual(g.targets,[]);
await page.screenshot({path:out+'/overview-1440.png',fullPage:true});report.views.push('overview-1440');
report.checks.push(`Beş alt bölüm görünür; ekip planı ${planRows} satır = günlük toplam ${total}; kaynak toplamı ${stated} proje ile eşit.`);

// ── hızlı erişim: gerçek kayıt gösteren görünümler ──
for(const [name,testid] of [['Müşteriler','office-customers'],['Proje Notları','office-notes'],['Görevler','office-tasks'],['Ayarlar','office-settings']]){
 await page.getByRole('navigation',{name:'Ofis navigasyonu'}).getByRole('button',{name,exact:true}).click();await page.getByTestId(testid).waitFor();
 g=await geometry(page);assert.equal(g.overflow,0,name);assert.deepEqual(g.small,[],name);assert.deepEqual(g.targets,[],name);
}
await page.getByRole('navigation',{name:'Ofis navigasyonu'}).getByRole('button',{name:'Müşteriler',exact:true}).click();
await page.getByTestId('office-customers').locator('tbody tr').first().waitFor();
const customers=await page.getByTestId('office-customers').locator('tbody tr').count();assert.ok(customers>0,'Müşteri kütüğü kayıt göstermeli');
await page.getByRole('navigation',{name:'Ofis navigasyonu'}).getByRole('button',{name:'Ürünler',exact:true}).click();await page.getByRole('button',{name:'Lojistik Kapasite',exact:true}).waitFor();
await page.getByRole('navigation',{name:'Ofis navigasyonu'}).getByRole('button',{name:'Raporlar',exact:true}).click();await page.getByText('Marka & Kombinasyon Analizi').first().waitFor();
report.checks.push(`Hızlı erişim: Müşteriler (${customers} kayıt), Proje Notları, Görevler, Ayarlar açılır; Ürünler Katalog'a, Raporlar Analiz'e götürür.`);

// ── üst çubuk: arama ve yeni teklif ──
const first=await (async()=>{await page.getByRole('navigation',{name:'Ofis navigasyonu'}).getByRole('button',{name:'Teklifler',exact:true}).click();const r=page.locator('[data-testid^="quote-row-"]').first();await r.waitFor();return (await r.locator('.ofis-q-name strong').textContent()).trim()})();
await page.getByRole('navigation',{name:'Ofis navigasyonu'}).getByRole('button',{name:'Genel Bakış',exact:true}).click();
await page.getByLabel('Müşteri, teklif veya ürün ara',{exact:true}).fill(first);await page.keyboard.press('Enter');
await page.getByLabel('Tekliflerde ara',{exact:true}).waitFor();assert.equal(await page.getByLabel('Tekliflerde ara',{exact:true}).inputValue(),first);
const hits=await page.locator('[data-testid^="quote-row-"] .ofis-q-name strong').allTextContents();assert.ok(hits.length>0&&hits.every(h=>h.includes(first)),'Arama sonuçları aranan metni içermeli');
await page.getByRole('button',{name:'Yeni teklif yaz',exact:true}).click();await page.getByTestId('manual-quote-editor').waitFor();
report.checks.push('Üst çubuk araması Teklifler listesini aranan metinle açar; "+ Yeni teklif" teklif yazma ekranını açar.');

// ── durum seçicisi: sonuçlar seçilen durumla birebir ──
await page.getByRole('button',{name:'Teklif Listesi',exact:true}).click();
const status=page.getByLabel('Duruma göre filtrele',{exact:true});await status.selectOption('quoted');
const chips=await page.locator('[data-testid^="quote-row-"] .ofis-q-state .ofis-status').allTextContents();
assert.ok(chips.every(c=>c.trim()==='Teklif Verildi'),'Durum filtresi sonuçlarla uyuşmalı');
await status.selectOption('completed');const done=await page.locator('[data-testid^="quote-row-"] .ofis-q-state .ofis-status').allTextContents();assert.ok(done.every(c=>c.trim()==='Tamamlandı'));
report.checks.push(`Durum açılır seçicisi: "Teklif Verildi" ${chips.length} satır, hepsi o durumda.`);
await page.context().close();

// ── 375×844: ilk iş satırı ilk ekranda tam görünür ──
page=await open(375,844);
const row=await page.locator('.ofis-task-row').first().boundingBox();
assert.ok(row&&row.y>=0&&row.y+row.height<=844,`İlk iş satırı ilk ekrana sığmalı (alt kenar ${row&&Math.round(row.y+row.height)})`);
g=await geometry(page);assert.equal(g.overflow,0,'375 px yatay taşma');assert.deepEqual(g.small,[]);assert.deepEqual(g.targets,[]);
await page.screenshot({path:out+'/overview-375.png',fullPage:true});report.views.push('overview-375');
report.checks.push(`375×844: ilk iş satırı ${Math.round(row.y)}–${Math.round(row.y+row.height)} px arasında, ilk ekranda tam görünür; yatay taşma yok.`);
await page.context().close();await browser.close();
assert.deepEqual(report.errors,[]);
fs.writeFileSync(out+'/overview-browser.json',JSON.stringify({passed:true,...report},null,2));
console.log(JSON.stringify({passed:true,checks:report.checks}));
