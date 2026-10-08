import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {root,verifyTarget} from './db.mjs';

verifyTarget();
const origin='http://127.0.0.1:3210';
const basic=value=>'Basic '+Buffer.from(value).toString('base64');
const stale=basic('old:old');
const admin=basic('preview:preview-only');
const checks=[];
const report={passed:false,checks};
let browser;
try{
 for(const [label,headers,status,role] of [
  ['Oturumsuz API kapalı',{},401],
  ['Yanlış Basic girişi kapalı',{authorization:stale},401],
  ['Doğrudan demo yönetici girişi',{authorization:admin},200,'admin'],
  ['Doğrudan demo salt okunur girişi',{authorization:basic('patron:preview-readonly')},200,'patron'],
  ['Eski Basic bilgisi yerel yönetici oturumunu engellemez',{cookie:'ofis_local_role=admin',authorization:stale},200,'admin'],
  ['Önbellekteki yönetici bilgisi seçili salt okunur rolü değiştirmez',{cookie:'ofis_local_role=patron',authorization:admin},200,'patron'],
 ]){
  const response=await fetch(origin+'/api/admin/me',{headers});
  assert.equal(response.status,status,label);
  if(role)assert.equal((await response.json()).role,role,label);
  checks.push(label);
 }
 // Yalnız reddedilmesi gereken istekler; hiçbir başarılı kayıt işlemi yok.
 for(const [headers,status] of [
  [{},401],
  [{cookie:'ofis_local_role=patron',authorization:admin},403],
 ]){
  const response=await fetch(origin+'/api/admin/office/operations',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'});
  assert.equal(response.status,status,'Yetkisiz veya salt okunur yazma reddedilmeli');
 }
 checks.push('Oturumsuz ve salt okunur yazma istekleri reddedildi');
 browser=await chromium.launch({headless:true});
 for(const authorization of [undefined,stale]){
  const context=await browser.newContext({extraHTTPHeaders:authorization?{authorization}: {}});
  await context.route('**/*',route=>{
   const request=route.request();
   return new URL(request.url()).hostname==='127.0.0.1'&&['GET','HEAD'].includes(request.method())?route.continue():route.abort();
  });
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/',{waitUntil:'networkidle'});
  const office=page.frameLocator('iframe[title="Ofis"]');
  await office.getByTestId('office-today').waitFor();
  const role=()=>page.evaluate(async()=>{const response=await fetch('/api/admin/me');return (await response.json()).role});
  assert.equal(await role(),'admin');
  await page.getByRole('link',{name:'Salt okunur',exact:true}).click();
  await office.getByTestId('office-today').waitFor();
  assert.equal(await role(),'patron');
  assert.equal(await office.getByRole('button',{name:'Görüştüm',exact:true}).count(),0);
  await page.getByRole('link',{name:'Yönetici',exact:true}).click();
  await office.getByTestId('office-today').waitFor();
  assert.equal(await role(),'admin');
  assert.deepEqual(errors,[]);
  checks.push(authorization?'Eski Basic bilgisiyle tarayıcı girişi ve rol geçişleri':'Şifresiz yerel giriş ve rol geçişleri');
  await context.close();
 }
 report.passed=true;
 console.log(JSON.stringify(report,null,2));
}catch(error){report.failure=error.message;throw error}
finally{
 await browser?.close();
 fs.writeFileSync(root+'/docs/verification/ofis-20261008/evidence/local-entry.json',JSON.stringify(report,null,2)+'\n');
}
