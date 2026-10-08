'use client';
import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import type {OfficeData} from '@/lib/admin/officeModel';
import type {OfficeOperationInput} from '@/lib/admin/officeOperationSchema';
export const OFFICE_KEY=['admin','office'] as const;
export function useOffice(){return useQuery<OfficeData>({queryKey:OFFICE_KEY,queryFn:async()=>{const r=await fetch('/api/admin/office',{cache:'no-store'});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error??'İşler okunamadı');return d},staleTime:10000,refetchInterval:30000,retry:false});}
export function useOfficeOperation(){
 const client=useQueryClient();const pending=useRef(false);const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
 async function run(body:OfficeOperationInput){
  if(pending.current)return false;
  pending.current=true;setBusy(true);setError(null);
  const fingerprint=JSON.stringify(body),scope='office-pending-'+('projectId' in body?body.projectId:body.quoteId);
  let previous:{fingerprint:string;key:string}|null=null;try{previous=JSON.parse(sessionStorage.getItem(scope)??'null')}catch{}
  const key=previous?.fingerprint===fingerprint?previous.key:crypto.randomUUID();
  try{
   sessionStorage.setItem(scope,JSON.stringify({fingerprint,key}));
   const r=await fetch('/api/admin/office/operations',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:fingerprint});
   const d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw Error(d?.error??'Yanıt alınamadı. Aynı bilgilerle tekrar deneyin.');
   sessionStorage.removeItem(scope);
   await Promise.all([client.invalidateQueries({queryKey:OFFICE_KEY}),client.invalidateQueries({queryKey:['admin','quotes']}),client.invalidateQueries({queryKey:['admin','quote-interactions']})]);
   return true;
  }catch(e){setError(e instanceof Error?e.message:'Kayıt başarısız. Girdiniz korundu.');return false}
  finally{pending.current=false;setBusy(false)}
 }
 return {run,busy,error};
}
