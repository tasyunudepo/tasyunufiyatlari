import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
export const state='/tmp/ofis-test-20261008';
export const root=path.resolve(import.meta.dirname,'../..');
const env={PATH:process.env.PATH,LANG:'C.UTF-8'};
export function sql(query,database='ofis_acceptance'){
 return execFileSync('psql',['-X','-h',state+'/socket','-p','55438','-U','ofis_test_owner','-d',database,'-qAt','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',env});
}
export function verifyTarget(database='postgres'){
 const [dir,port,user]=sql("SELECT current_setting('data_directory') || '|' || current_setting('port') || '|' || current_user",database).trim().split('|');
 if(dir!==state+'/data'||port!=='55438'||user!=='ofis_test_owner')throw Error('Test hedefi eşleşmedi; yazma reddedildi');
 if(!fs.existsSync(state+'/initdb.log')||fs.existsSync(root+'/.env.local'))throw Error('İzolasyon kanıtı eksik veya ortam dosyası var');
}
export function apply(file,database='ofis_acceptance'){
 verifyTarget(database);
 // Repodaki HAM SQL; sohbetten SQL yeniden üretilmez.
 return sql("SET ofis.verified_test_target='yes';\n"+fs.readFileSync(path.join(root,file),'utf8'),database);
}
export function inventory(name,database='ofis_acceptance'){
 const report=JSON.parse(apply('scripts/ofis-test/inventory.sql',database));
 fs.writeFileSync(path.join(root,'docs/verification/ofis-20261008/evidence',name+'.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
