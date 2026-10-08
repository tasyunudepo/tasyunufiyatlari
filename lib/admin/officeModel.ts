import type { OfficeCalendar } from './officeCalendar';
import { istanbulDate } from './officeCalendar';
import { summarizeQuoteContact, type QuoteInteraction } from './quoteSemantics';
export type OfficeProject = {id:string;name:string;customer_id:string|null;owner:string|null;status:string|null;created_at:string;valuation_quote_id:string|null;valuation_revision:number|null;valuation_net_amount:number|null;valuation_selected_at:string|null};
export type OfficeTask = {id:string;project_id:string;kind:'initial_contact'|'followup';due_at:string;owner:string;status:'open'|'done'|'cancelled';completed_at:string|null;cancelled_at:string|null};
export type QuoteRevision = {no:number;at:string;areaM2:number;priceWithoutVat:number;totalPrice:number;pricePerM2?:number;shippingCost?:number;shippingMode?:string;items?:unknown[]};
export type OfficeQuoteData = {id:string;project_id?:string|null;customer_id?:string|null;customer_name:string;customer_phone:string;quote_code?:string|null;created_at:string;status:string|null;material_type:string;thickness_cm:number;area_m2:number;city_name:string;total_price:number;price_without_vat:number;price_per_m2:number;shipping_cost:number|null;vehicle_type?:string|null;follow_up_date?:string|null;contact_attempted_at?:string|null;contact_successful?:boolean|null;package_items?:{manual?:{revisionNo?:number;revisions?:QuoteRevision[];shippingMode?:string;validityDays?:number};items?:{name?:string;unitPrice?:number;quantity?:number;totalPrice?:number}[]}};
export type ProjectInteraction = QuoteInteraction & {project_id:string|null};
export type OfficeData = {asOf:string;truncated:boolean;projects:OfficeProject[];quotes:OfficeQuoteData[];tasks:OfficeTask[];interactions:ProjectInteraction[];calendar:OfficeCalendar|null;legacyCutoff:string|null};
export function dailyTasks(tasks:readonly OfficeTask[],asOf:string) {
 const day=istanbulDate(asOf),start=Date.parse(day+'T00:00:00+03:00'),end=start+86400000,now=Date.parse(asOf);
 const open=tasks.filter(t=>t.status==='open'&&Date.parse(t.due_at)<end).sort((a,b)=>Date.parse(a.due_at)-Date.parse(b.due_at)||a.id.localeCompare(b.id));
 const inDay=(value:string|null)=>value!==null&&Date.parse(value)>=start&&Date.parse(value)<end;
 const done=tasks.filter(t=>t.status==='done'&&inDay(t.completed_at));
 const cancelled=tasks.filter(t=>t.status==='cancelled'&&inDay(t.cancelled_at));
 const initial=open.filter(t=>t.kind==='initial_contact');
 const overdue=open.filter(t=>t.kind==='followup'&&Date.parse(t.due_at)<now);
 const today=open.filter(t=>t.kind==='followup'&&Date.parse(t.due_at)>=now);
 return {total:open.length+done.length+cancelled.length,open,done,cancelled,initial,overdue,today};
}
export function opportunitySummary(projects:readonly OfficeProject[]) {
 const open=projects.filter(p=>p.status!=='completed'&&p.status!=='rejected');
 return {count:open.length,amount:open.reduce((sum,p)=>sum+(p.valuation_net_amount??0),0),unvalued:open.filter(p=>p.valuation_net_amount===null).length};
}
export function projectContact(data:OfficeData,projectId:string) {
 const quotes=data.quotes.filter(q=>q.project_id===projectId),ids=new Set(quotes.map(q=>String(q.id)));
 const rows=data.interactions.filter(i=>i.project_id===projectId||!!i.quote_id&&ids.has(String(i.quote_id))).sort((a,b)=>Date.parse(b.occurred_at)-Date.parse(a.occurred_at));
 const legacy=quotes.filter(q=>q.contact_attempted_at).sort((a,b)=>Date.parse(b.contact_attempted_at!)-Date.parse(a.contact_attempted_at!))[0];
 const summary=summarizeQuoteContact({id:projectId,contact_attempted_at:legacy?.contact_attempted_at,contact_successful:legacy?.contact_successful},{interactions:rows.map(r=>({...r,quote_id:projectId})),firstSuccess:null,latestAttempt:null,hasOlder:false});
 const hasSuccess=summary.state==='successful'||quotes.some(q=>q.contact_successful===true);
 return {...summary,label:hasSuccess?'Başarılı temas kaydı var':summary.label,hasSuccess,rows};
}
export function oldReviewQuotes(data:OfficeData) {
 if(!data.legacyCutoff||!Number.isFinite(Date.parse(data.legacyCutoff)))return [];
 return data.quotes.filter(q=>!q.project_id&&Date.parse(q.created_at)<Date.parse(data.legacyCutoff!)&&!q.contact_attempted_at&&q.contact_successful!==true&&!q.follow_up_date
  &&!data.interactions.some(i=>String(i.quote_id)===String(q.id)&&(i.outcome||i.next_action_at&&!i.next_action_done_at)));
}
export function shippingText(quote:OfficeQuoteData) {
 const mode=quote.package_items?.manual?.shippingMode;
 if(mode==='buyer_pays')return 'Nakliye alıcıya aittir.';
 if(mode==='included_in_sale_price')return 'Bu kayıtlı teklifin nakliyesi fiyata dahildir.';
 if(mode==='separate_quote_required')return 'Nakliye ayrıca netleştirilecek.';
 return 'Nakliye koşulu bu kayıtta belirtilmemiş.';
}
export function quoteMessage(quote:OfficeQuoteData) {
 const days=quote.package_items?.manual?.validityDays;
 const price=new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(quote.price_without_vat);
 return `Merhaba ${quote.customer_name}, ${quote.quote_code??'teklif'} için ${quote.area_m2.toLocaleString('tr-TR')} m² üzerinden kayıtlı tutar ${price} + KDV. ${shippingText(quote)}${days?` Teklifte kayıtlı geçerlilik: ${days} gün.`:' Geçerlilik süresi bu kayıtta belirtilmemiş.'}`;
}
