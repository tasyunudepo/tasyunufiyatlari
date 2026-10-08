import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHmac} from 'node:crypto';
import {root,state,verifyTarget} from './db.mjs';
process.chdir(root);
const baseline=process.argv.includes('--baseline');
const uiRoot=baseline?'/tmp/ofis-before-20261008':root;
const uiPort=baseline?3213:3210;
if(!process.argv.includes('--child')){
 verifyTarget();
 if(fs.readdirSync(root).some(n=>n.startsWith('.env')&&n!=='.env.example'))throw Error('Gerçek ortam dosyası bulundu');
 const keys=JSON.parse(fs.readFileSync(state+'/local-keys.json'));
 const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 Object.assign(env,{NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',OFIS_PREVIEW_MODE:'local-test',OFIS_WORKFLOW_ENABLED:'1',
  OFIS_WORK_CALENDAR:JSON.stringify({timeZone:'Europe/Istanbul',weekdays:[1,2,3,4,5],opens:'09:00',closes:'18:00',firstContactMinutes:30,example:true}),
  OFIS_LEGACY_CUTOFF:'2026-10-08T00:00:00+03:00',
  NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3211',NEXT_PUBLIC_SUPABASE_ANON_KEY:keys.anon,SUPABASE_SERVICE_ROLE_KEY:keys.service,
  ADMIN_USER:'preview',ADMIN_PASSWORD:'preview-only',PATRON_PASSWORD:'preview-readonly',PDF_CAPABILITY_SECRET:keys.secret,
  NEXT_FONT_GOOGLE_MOCKED_RESPONSES:path.join(root,'scripts/ofis-preview/font-responses.cjs'),NODE_OPTIONS:`--require=${root}/scripts/ofis-preview/network-guard.cjs`});
 if(fs.readdirSync(uiRoot).some(n=>n.startsWith('.env')&&n!=='.env.example'))throw Error('UI kopyasında ortam dosyası bulundu');
 const child=spawn(process.execPath,[import.meta.filename,'--child',...(baseline?['--baseline']:[])],{env,cwd:root,stdio:'inherit'});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
 child.on('exit',code=>process.exit(code??1));
}else{
 const {createServer}=await import('node:http');
 const {default:next}=await import('next');
 const {fixtureFor,tables}=await import('../ofis-preview/fixtures.mjs');
 const keys=JSON.parse(fs.readFileSync(state+'/local-keys.json'));
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
 const body=async req=>{const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>12*1024*1024)throw Error('Dosya sınırı');chunks.push(c)}return Buffer.concat(chunks)};
 const signed=(name,expires)=>createHmac('sha256',keys.secret).update(name+'|'+expires).digest('hex');
 const storagePath=name=>{if(!/^quote-pdfs\/[A-Za-z0-9_./-]+$/.test(name)||name.split('/').some(x=>x==='..'||x==='.'))throw Error('Geçersiz yerel nesne yolu');return path.join(state,'objects',name)};
 const rest=createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1:3211');
  if(['http://127.0.0.1:3210','http://127.0.0.1:3213'].includes(req.headers.origin)){
   res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
   res.setHeader('Access-Control-Allow-Headers','authorization, apikey, content-type, x-client-info, prefer');
   res.setHeader('Access-Control-Allow-Methods','GET, HEAD, POST, PATCH, DELETE, OPTIONS');
   res.setHeader('Access-Control-Expose-Headers','content-range');
   if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  }
  if(u.pathname.startsWith('/rest/v1/')){
   // Read-only synthetic catalog; quotes, interactions and office RPCs always
   // continue to the real isolated PostgreSQL instance below.
   const table=u.pathname.slice(9);
   if(['GET','HEAD'].includes(req.method)&&table!=='material_types'&&Object.hasOwn(tables,table))return json(res,200,tables[table]);
   const response=await fetch('http://127.0.0.1:3212/'+u.pathname.slice(9)+u.search,{method:req.method,headers:Object.fromEntries(Object.entries(req.headers).filter(([key])=>!['host','connection','content-length'].includes(key))),body:['GET','HEAD'].includes(req.method)?undefined:await body(req)});
   res.writeHead(response.status,Object.fromEntries([...response.headers].filter(([key])=>!['content-encoding','content-length','transfer-encoding'].includes(key))));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(u.pathname.startsWith('/storage/v1/object/sign/')&&req.method==='GET'){
   const name=decodeURIComponent(u.pathname.slice('/storage/v1/object/sign/'.length)),expires=u.searchParams.get('expires');
   if(Number(expires)<Date.now()||u.searchParams.get('token')!==signed(name,expires))return json(res,403,{error:'Süre doldu'});
   res.writeHead(200,{'Content-Type':'application/pdf'});res.end(fs.readFileSync(storagePath(name)));return;
  }
  if(!u.pathname.startsWith('/storage/v1/')||req.headers.authorization!=='Bearer '+keys.service)return json(res,403,{error:'Yalnız yerel test hizmeti'});
  if(u.pathname.startsWith('/storage/v1/object/sign/')&&req.method==='POST'){
   const name=decodeURIComponent(u.pathname.slice('/storage/v1/object/sign/'.length));
   if(!fs.existsSync(storagePath(name)))return json(res,404,{error:'Dosya yok'});
   const expires=String(Date.now()+600000);return json(res,200,{signedURL:`/object/sign/${name}?expires=${expires}&token=${signed(name,expires)}`});
  }
  if(u.pathname.startsWith('/storage/v1/object/')&&['POST','PUT'].includes(req.method)){
   const name=decodeURIComponent(u.pathname.slice('/storage/v1/object/'.length)),file=storagePath(name);
   if(fs.existsSync(file)&&req.headers['x-upsert']!=='true')return json(res,409,{error:'Dosya var'});
   let bytes=await body(req);
   if(req.headers['content-type']?.startsWith('multipart/form-data')){
    const form=await new Request('http://127.0.0.1',{method:'POST',headers:{'content-type':req.headers['content-type']},body:bytes}).formData();
    const upload=[...form.values()].find(value=>typeof value!=='string');
    if(!upload)throw Error('PDF dosyası yok');bytes=Buffer.from(await upload.arrayBuffer());
   }
   if(bytes.subarray(0,5).toString()!=='%PDF-')return json(res,400,{error:'Geçersiz PDF'});
   fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);return json(res,200,{Key:name,Id:name});
  }
  if(u.pathname==='/storage/v1/object/quote-pdfs'&&req.method==='DELETE'){
   const data=JSON.parse((await body(req)).toString());for(const name of data.prefixes??[])fs.rmSync(storagePath('quote-pdfs/'+name),{force:true});return json(res,200,[]);
  }
  json(res,404,{error:'Yerel test hizmetinde yok'});
 }catch(error){json(res,500,{error:error.message})}});
 if(!baseline)await new Promise(resolve=>rest.listen(3211,'127.0.0.1',resolve));
 const app=next({dev:true,dir:uiRoot,hostname:'127.0.0.1',port:uiPort,turbopack:false,webpack:true});await app.prepare();const handle=app.getRequestHandler();
 const catalogFixtures=new Set(['/api/admin/dashboard-metrics','/api/admin/combination-metrics','/api/admin/experiments','/api/admin/brands','/api/admin/material-types','/api/admin/storage-images','/api/admin/catalog-items','/api/admin/accessory-sets']);
 createServer(async(req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1:3210');
  if(u.pathname==='/'){
   const role=u.searchParams.get('role')==='patron'?'patron':'admin';
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Set-Cookie':`ofis_local_role=${role}; HttpOnly; SameSite=Strict; Path=/`});
   res.end(`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ofis · Yerel test DB</title><style>body{margin:0;font:16px Arial;color:#14181f}header{padding:12px 20px;background:#fff4e8;display:flex;gap:16px;flex-wrap:wrap}a{color:#9a3412}iframe{width:100%;height:calc(100dvh - 88px);border:0}</style><header><strong>Yerel test veritabanı · Kayıtlar sentetiktir</strong><span>Teklif/iş kaydı: yerel DB · Katalog/analiz: örnek veri · Yerel PDF deposu</span><a href="/?role=admin">Yönetici</a><a href="/?role=patron">Salt okunur</a></header><iframe title="Ofis" src="/ofis"></iframe></html>`);return;
  }
  const cookie=req.headers.cookie?.match(/(?:^|;\s*)ofis_local_role=(admin|patron)(?:;|$)/)?.[1];
  // Yalnız bu loopback demo geçidinde kökten seçilen rol önceliklidir:
  // tarayıcının eski Basic bilgisi girişi veya salt okunur rol seçimini bozamaz.
  // Cookie yoksa mevcut Basic doğrulaması aynen çalışır; gerçek app/proxy/auth değişmez.
  if(cookie)req.headers.authorization='Basic '+Buffer.from(cookie==='patron'?'patron:preview-readonly':'preview:preview-only').toString('base64');
  if(req.method==='GET'&&catalogFixtures.has(u.pathname))return json(res,200,fixtureFor(u.pathname,cookie));
  if(!/^\/(ofis|api|_next|fonts|images|favicon)/.test(u.pathname)){res.writeHead(404);res.end();return;}
  await handle(req,res);
 }).listen(uiPort,'127.0.0.1',()=>console.log(`OFIS_TEST_READY http://127.0.0.1:${uiPort} | ${baseline?'original baseline':'redesign'} | real endpoints -> local PostgREST -> isolated PostgreSQL | external sockets blocked`));
}
