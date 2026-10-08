import { NextRequest, NextResponse } from 'next/server';
import { requireOfficeReadAuth } from '@/lib/security/adminMutationAuth';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { calendarFromJson } from '@/lib/admin/officeCalendar';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest) {
 const auth=requireOfficeReadAuth(req);if(!auth.ok)return auth.response;
 const headers={'Cache-Control':'no-store'};
 if(process.env.OFIS_WORKFLOW_ENABLED!=='1')return NextResponse.json({ok:false,error:'Proje ve görev akışı bu ortamda etkin değil.'},{status:503,headers});
 const {data,error}=await createServerSupabaseClient().rpc('ofis_workbench');
 if(error)return NextResponse.json({ok:false,error:'Proje ve görevler okunamadı.'},{status:503,headers});
 return NextResponse.json({ok:true,...data,calendar:calendarFromJson(process.env.OFIS_WORK_CALENDAR),legacyCutoff:process.env.OFIS_LEGACY_CUTOFF??null},{headers});
}
