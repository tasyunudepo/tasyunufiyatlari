// Checks use the same sterile environment and external socket guard as preview.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
if(fs.readdirSync(root).some(n=>n.startsWith('.env')&&n!=='.env.example'))throw Error('Kontrol çalışma ağacında .env olmamalı');
const jobs={
 types:['node_modules/typescript/bin/tsc','--noEmit'],
 lint:['node_modules/eslint/bin/eslint.js','app/ofis','components/admin','lib/admin/quoteSemantics.ts','lib/admin/groupQuotesIntoSeries.ts','lib/admin/officeCalendar.ts','lib/admin/officeModel.ts','lib/admin/officeOperationSchema.ts','lib/hooks/useOffice.ts','lib/hooks/useOfficeMobile.ts','lib/phone','lib/security/quoteSubmissionGuard.ts','app/api/admin/office','app/api/admin/quotes/manual/route.ts','app/api/admin/quotes/[id]/interactions/route.ts','tests/admin'],
 alltests:['node_modules/vitest/vitest.mjs','run'],
 tests:['node_modules/vitest/vitest.mjs','run','tests/admin','tests/security/admin-mutation-auth.test.ts','tests/security/admin-role-signal.test.ts','tests/security/admin-routes-auth.test.ts','tests/security/admin-read-gates.test.ts','tests/quote/quote-duplicate-source.test.ts','tests/quote/quote-indicators.test.ts','tests/pricing/quote-totals.test.ts','tests/pricing/calc-pricing.test.ts'],
 build:['node_modules/next/dist/bin/next','build','--webpack'],
};
const job=jobs[process.argv[2]];if(!job)throw Error('types | lint | tests | build');
const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
Object.assign(env,{NODE_ENV:process.argv[2]==='build'?'production':'test',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3210',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-preview-no-credentials',SUPABASE_SERVICE_ROLE_KEY:'local-preview-no-credentials',NEXT_FONT_GOOGLE_MOCKED_RESPONSES:path.join(root,'scripts/ofis-preview/font-responses.cjs'),NODE_OPTIONS:`--require=${path.join(root,'scripts/ofis-preview/network-guard.cjs')}`});
let buildDataServer;
if(process.argv[2]==='build'){
 const {createServer}=await import('node:http');
 buildDataServer=createServer((req,res)=>{
  const safe=req.method==='GET'||req.method==='HEAD';
  res.writeHead(safe?200:405,{'Content-Type':'application/json','Content-Range':'0-0/0'});
  res.end(safe?'[]':JSON.stringify({error:'Build fixture is read-only'}));
 });
 await new Promise(resolve=>buildDataServer.listen(0,'127.0.0.1',resolve));
 env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:'+buildDataServer.address().port;
 console.log('BUILD_DATA_MODE: isolated empty catalog; writes denied; no remote credentials');
}
const child=spawn(process.execPath,job,{env,cwd:root,stdio:'inherit'});child.on('exit',code=>{buildDataServer?.close();process.exit(code??1)});
