import {describe,it,expect} from 'vitest';
import {calendarFromJson,initialContactDue} from '@/lib/admin/officeCalendar';
import {dailyTasks,opportunitySummary,type OfficeTask,type OfficeProject} from '@/lib/admin/officeModel';
import {contactTargets} from '@/lib/phone/normalize';
const calendar={timeZone:'Europe/Istanbul' as const,weekdays:[1,2,3,4,5],opens:'09:00',closes:'18:00',firstContactMinutes:30};
describe('mesai hedefi',()=>{
 it('cuma kapanışından kalan süreyi pazartesi tüketir',()=>expect(initialContactDue('2026-10-09T17:50:00+03:00',calendar)).toBe('2026-10-12T06:20:00.000Z'));
 it('hafta sonu ve mesai dışı süreyi tüketmez',()=>expect(initialContactDue('2026-10-10T11:00:00+03:00',calendar)).toBe('2026-10-12T06:30:00.000Z'));
 it('takvim yoksa üretim varsayımı yapmaz',()=>{expect(calendarFromJson(undefined)).toBeNull();expect(calendarFromJson(JSON.stringify({...calendar,weekdays:[]}))).toBeNull()});
});
describe('günlük görev birimi',()=>{
 const task=(id:string,kind:OfficeTask['kind'],due_at:string,status:OfficeTask['status']='open',completed_at:string|null=null,cancelled_at:string|null=null):OfficeTask=>({id,kind,due_at,status,completed_at,cancelled_at,project_id:'p',owner:'o'});
 const now='2026-10-09T00:05:00+03:00';
 it('İstanbul gece yarısında ayrışık gruplar ve toplam korunur',()=>{
  const d=dailyTasks([task('1','initial_contact','2026-10-08T09:00:00+03:00'),task('2','followup','2026-10-08T15:00:00+03:00'),task('3','followup','2026-10-09T10:00:00+03:00'),task('4','followup','2026-10-10T10:00:00+03:00'),task('5','followup','2026-10-08T10:00:00+03:00','done',now),task('6','followup','2026-10-08T10:00:00+03:00','cancelled',null,now)],now);
  expect(d.total).toBe(5);expect(d.open).toHaveLength(3);expect(d.done).toHaveLength(1);expect(d.cancelled).toHaveLength(1);
  expect(d.initial.length+d.overdue.length+d.today.length).toBe(d.open.length);
  expect(new Set([...d.initial,...d.overdue,...d.today].map(t=>t.id)).size).toBe(3);
 });
 it('tamamlanan iş günlük toplamda kalır, iptal başarı değildir',()=>{
  const before=dailyTasks([task('1','followup',now)],now),after=dailyTasks([task('1','followup',now,'done',now)],now);
  expect(after.total).toBe(before.total);expect(after.open).toHaveLength(0);expect(after.done).toHaveLength(1);
 });
 it('seçimsiz proje sayılır ama tutarı sıfır diye etiketlenmez',()=>{
  const projects=[{id:'p',status:'pending',valuation_net_amount:300},{id:'q',status:null,valuation_net_amount:null},{id:'closed',status:'completed',valuation_net_amount:500}] as OfficeProject[];
  expect(opportunitySummary(projects)).toEqual({count:2,amount:300,unvalued:1});
 });
});
describe('iletişim hedefleri',()=>{
 it.each([['0532 000 00 11','+905320000011'],['5320000011','+905320000011'],['+44 20 7946 0000','+442079460000'],['001 202 555 0100','+12025550100']])('%s açık ülke kodunu korur',(raw,e164)=>expect(contactTargets(raw,'Örnek & mesaj')?.e164).toBe(e164));
 it.each(['','123','telefon 05320000011','+900000000000'])('geçersiz %s dış bağlantı üretmez',raw=>expect(contactTargets(raw,'')).toBeNull());
 it('WhatsApp metnini URL kodlar, içeriği değiştirmez',()=>expect(contactTargets('+442079460000','Örnek & metin')?.whatsapp).toBe('https://wa.me/442079460000?text=%C3%96rnek%20%26%20metin'));
});
