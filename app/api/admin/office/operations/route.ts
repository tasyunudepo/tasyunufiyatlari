import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminMutationAuth } from '@/lib/security/adminMutationAuth';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { officeOperationSchema } from '@/lib/admin/officeOperationSchema';
import { calendarFromJson, initialContactDue } from '@/lib/admin/officeCalendar';
export const dynamic = 'force-dynamic';
const headers = {'Cache-Control':'no-store'};
const fail = (error:string,status:number) => NextResponse.json({ok:false,error},{status,headers});
export async function POST(req:NextRequest) {
  const auth = requireAdminMutationAuth(req);
  if (!auth.ok) return auth.response;
  if (process.env.OFIS_WORKFLOW_ENABLED !== '1') return fail('Proje ve görev akışı bu ortamda etkin değil.',503);
  const key = req.headers.get('idempotency-key');
  if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return fail('Sabit işlem anahtarı gerekli.',400);
  const parsed = officeOperationSchema.safeParse(await req.json().catch(()=>null));
  if (!parsed.success) return fail('İşlem alanları geçersiz. Tutar istemciden kabul edilmez.',400);
  const input = parsed.data;
  if (input.type==='outcome_recorded' && input.status==='rejected' && !input.lossCategory) return fail('Kayıp nedeni zorunlu.',422);
  const db = createServerSupabaseClient();
  // Zod şeması sabit anahtar sırası üretir; retry hash'i sunucuda hesaplanır.
  // Hesaplanan tarih/tutar hash'e dahil edilmez: cevap kaybı sonrası aynı istek değişmez.
  const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const body:Record<string,unknown> = {...input};
  if (input.type==='project_created') {
    const calendar = calendarFromJson(process.env.OFIS_WORK_CALENDAR);
    if (!calendar) return fail('Mesai takvimi ve ilk temas hedefi yapılandırılmamış.',503);
    const {data,error} = await db.from('quotes').select('created_at').eq('id',input.quoteId).maybeSingle();
    if (error) return fail('Talep zamanı okunamadı.',503);
    if (!data) return fail('Teklif bulunamadı.',404);
    body.initialDueAt = initialContactDue(data.created_at,calendar);
  }
  const {data,error} = await db.rpc('ofis_operation',{p_id:key,p_actor:auth.user,p_type:input.type,p_hash:hash,p_body:body});
  if (error) {
    const status = /^PT(400|404|409|422)$/.test(error.code) ? Number(error.code.slice(2)) : 503;
    return fail(status===503?'İşlem kaydedilemedi. Aynı işlem anahtarıyla tekrar deneyin.':error.message,status);
  }
  return NextResponse.json({ok:true,...data},{headers});
}
