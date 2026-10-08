import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
process.chdir(root);
const port=Number(process.env.OFIS_PREVIEW_PORT||3210);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Geçersiz önizleme portu');
if(!process.argv.includes('--isolated-child')){
 const envFiles=fs.readdirSync(root).filter(n=>n.startsWith('.env')&&n!=='.env.example');
 if(envFiles.length)throw new Error('Önizleme çalışma ağacında .env dosyası bulunmamalı. Gerçek ortam dosyaları kopyalanmaz.');
 const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 Object.assign(env,{NODE_ENV:'development',OFIS_PREVIEW_MODE:'1',NEXT_TELEMETRY_DISABLED:'1',OFIS_PREVIEW_PORT:String(port),NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${port}`,NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-preview-no-credentials',SUPABASE_SERVICE_ROLE_KEY:'local-preview-no-credentials',ADMIN_USER:'preview',ADMIN_PASSWORD:'preview-only',PATRON_PASSWORD:'preview-readonly',NEXT_FONT_GOOGLE_MOCKED_RESPONSES:path.join(root,'scripts/ofis-preview/font-responses.cjs'),NODE_OPTIONS:`--require=${path.join(root,'scripts/ofis-preview/network-guard.cjs')}`});
 const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--isolated-child'],{cwd:root,env,stdio:'inherit'});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
 child.on('exit',code=>process.exit(code??1));
}else{
 const {createServer}=await import('node:http');
 const {fixtureFor}=await import('./fixtures.mjs');
 const {default:next}=await import('next');
 const app=next({dev:true,dir:root,hostname:'127.0.0.1',port,turbopack:false,webpack:true});
 await app.prepare();const handle=app.getRequestHandler();
 const json=(res,status,payload)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Ofis-Data-Mode':'synthetic-readonly'});res.end(JSON.stringify(payload))};
 const server=createServer(async(req,res)=>{
  const u=new URL(req.url,`http://127.0.0.1:${port}`);
  const referer=new URL(req.headers.referer||u.href);
  const role=(u.searchParams.get('role')||referer.searchParams.get('role'))==='patron'?'patron':'admin';
  // Every API, Supabase REST/auth/storage and upload route terminates here.
  // No request in this preview reaches a real Next API handler.
  if(/^\/(api|rest|auth|storage)\//.test(u.pathname)){
   if(!['GET','HEAD','OPTIONS'].includes(req.method))return json(res,405,{ok:false,error:'Bağlantısız önizleme: kayıt yazılmaz. Girdiğiniz bilgiler ekranda korunur.'});
   const fixture=fixtureFor(u.pathname,role);
   return json(res,fixture===null?404:200,fixture??{ok:false,error:'Bu veri yalnız doğrulanmış test ortamında kullanılabilir.'});
  }
  if(u.pathname==='/'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ofis | Bağlantısız yerel önizleme</title><style>body{margin:0;font:16px Arial;color:#14181f}header{padding:12px 20px;background:#fff4e8;border-bottom:1px solid #c2410c;display:flex;gap:20px;flex-wrap:wrap}a{color:#9a3412}iframe{width:100%;height:calc(100dvh - 74px);border:0}</style><header><strong>Faz 1 · Sentetik, salt okunur önizleme</strong><span>Gerçek veri bağlantısı ve kayıt yok.</span><a href="/?role=admin">Yönetici görünümü</a><a href="/?role=patron">Salt okunur rol</a></header><iframe title="Ofis uygulaması" src="/ofis?role=${role}"></iframe></html>`);return;
  }
  if(!/^\/(ofis|_next|fonts|images|favicon)/.test(u.pathname)){res.writeHead(404);res.end('Önizleme yalnız /ofis kapsamındadır.');return;}
  req.headers.authorization='Basic '+Buffer.from(role==='patron'?'patron:preview-readonly':'preview:preview-only').toString('base64');
  try{await handle(req,res)}catch{if(!res.headersSent)json(res,500,{ok:false,error:'Önizleme oluşturulamadı.'})}
 });
 server.listen(port,'127.0.0.1',()=>console.log(`OFIS_PREVIEW_READY http://127.0.0.1:${port} | synthetic-readonly | remote sockets blocked`));
}
