import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifyTarget,sql,root} from './db.mjs';
verifyTarget();
const out=root+'/docs/verification/ofis-20261008/evidence';const report={checks:[],external:[]};
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:375,height:1000},httpCredentials:{username:'preview',password:'preview-only'}});const page=await context.newPage();
await context.route('**/*',r=>{const u=new URL(r.request().url());if(['127.0.0.1','localhost'].includes(u.hostname)||['blob:','data:'].includes(u.protocol))return r.continue();report.external.push(u.origin);return r.abort()});
try{
 const q=JSON.parse(sql("SELECT row_to_json(q) FROM quotes q WHERE project_id IS NOT NULL ORDER BY id DESC LIMIT 1"));
 await page.goto('http://127.0.0.1:3210/ofis',{waitUntil:'networkidle'});await page.getByText('preview',{exact:true}).waitFor({state:'attached'});await page.getByTestId('admin-drawer-toggle').click();await page.getByRole('navigation').getByRole('button',{name:'Teklifler',exact:true}).click();await page.getByLabel('Tekliflerde ara',{exact:true}).fill(q.quote_code);await page.getByRole('button',{name:q.customer_name+': Detay',exact:true}).click();const panel=page.getByTestId('office-project-panel');
 await panel.getByRole('button',{name:'Telefon / Numarayı göster',exact:true}).click();
 await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:()=>Promise.reject(Error('Sentetik pano hatası'))}));await panel.getByRole('button',{name:'Kopyala',exact:true}).click();await panel.getByText('Kopyalanamadı. Aşağıdaki numarayı seçip kopyalayabilirsiniz.').waitFor();assert((await panel.innerText()).includes(q.customer_phone));
 await panel.getByText('İletişim numarasını düzelt',{exact:true}).click();const input=panel.getByLabel('Bu görüşmede kullanılacak numara',{exact:true});await input.fill('eksik');assert.equal(await panel.locator('a[href^="tel:"],a[href*="wa.me"]').count(),0);
 await input.fill('+44 20 7946 0018');assert.equal(await panel.getByRole('link',{name:'Arama uygulamasında aç',exact:true}).getAttribute('href'),'tel:+442079460018');assert((await panel.getByRole('link',{name:'WhatsApp',exact:true}).getAttribute('href')).startsWith('https://wa.me/442079460018?text='));
 await panel.getByLabel('Kanal',{exact:true}).selectOption('whatsapp');await panel.getByLabel('Görüşme notu',{exact:true}).fill('Sentetik ülke kodu kabulü.');const r=page.waitForResponse(r=>r.url().endsWith('/api/admin/office/operations')&&r.request().postDataJSON().type==='contact_success');await panel.getByRole('button',{name:'Yanıt aldım',exact:true}).click();assert.equal((await r).status(),200);await panel.getByText('Görüşme geçmişine kaydedildi.',{exact:true}).waitFor();
 assert.equal(sql(`SELECT customer_phone FROM quotes WHERE id=${q.id}`).trim(),q.customer_phone);const latest=JSON.parse(sql(`SELECT row_to_json(i) FROM customer_interactions i WHERE quote_id=${q.id} ORDER BY id DESC LIMIT 1`));assert.equal(latest.kind,'whatsapp');assert.equal(latest.outcome,'ulasildi');assert(latest.body.includes('+44 20 7946 0018'));assert.equal(latest.project_id,q.project_id);
 report.checks.push('Pano hatasında ham numara seçilebilir ve geri bildirim açık. Geçersiz girişte dış link yok. +44 kodu korunur; gerçek arama/mesaj açılmadı.','Mobilde bağlantıya basmadan WhatsApp yanıtı elle kaydedildi; doğru proje/kanal, kullanılan farklı numara notta, ham teklif numarası değişmedi.');
 await page.screenshot({path:out+'/contact-correction-375.png',fullPage:true});assert.equal(report.external.length,0);report.passed=true;
}catch(e){report.failure=e.stack;throw e}finally{fs.writeFileSync(out+'/contact-browser.json',JSON.stringify(report,null,2));await browser.close()}
