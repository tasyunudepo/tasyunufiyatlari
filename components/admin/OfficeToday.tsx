'use client';
import {useRef,useState} from 'react';
import {CalendarCheck,CheckCircle2,ChevronRight,Clock,FileText} from 'lucide-react';
import {useOffice} from '@/lib/hooks/useOffice';
import {dailyTasks,opportunitySummary,oldReviewQuotes,projectContact} from '@/lib/admin/officeModel';
import {formatGecikme} from '@/lib/admin/formatDuration';
import {istanbulDate} from '@/lib/admin/officeCalendar';
import {formatCurrency} from '@/lib/admin/utils';
import {useAdminQuotes} from '@/lib/hooks/useAdminQuotes';
import {OfficeProjectPanel} from './OfficeProjectPanel';
import {OfficeOverviewSections} from './OfficeOverviewSections';
export function OfficeToday({onNavigate}:{onNavigate?:(section:string)=>void}={}){
 const adminQuotes=useAdminQuotes();
 const selectionRef=useRef<HTMLElement|null>(null);
 const query=useOffice();const [group,setGroup]=useState<'all'|'initial'|'overdue'|'today'>('all');
 // openPhone: satırdaki "Telefon" düğmesi dosyayı numara açık hâlde getirir.
 const [selection,setSelection]=useState<{quoteId:string;taskId?:string;openPhone?:number}|null>(null);
 function choose(value:{quoteId:string;taskId?:string;openPhone?:number}){setSelection(value);requestAnimationFrame(()=>{if(window.matchMedia('(max-width:1199px)').matches)selectionRef.current?.scrollIntoView({block:'start'});selectionRef.current?.focus({preventScroll:true})})}
 if(query.isPending)return <p>Bugünün işleri yükleniyor…</p>;
 if(query.error)return <section className="ofis-panel"><h1>Bugün</h1><p role="status">{query.error.message}</p><button className="ofis-secondary" onClick={()=>void query.refetch()}>Tekrar dene</button></section>;
 const data=query.data!,daily=dailyTasks(data.tasks,data.asOf),opportunity=opportunitySummary(data.projects);
 const old=oldReviewQuotes(data),oldIds=new Set(old.map(q=>q.id));
 const incoming=data.quotes.filter(q=>!q.project_id&&!oldIds.has(q.id));
 const rows=group==='all'?daily.open:daily[group];
 const number=(n:number)=>n.toLocaleString('tr-TR');
 // "Takip sözü dün 14:00": sözün ne zamana verildiği, tarih hesabı yaptırmadan.
 const dueLabel=(iso:string)=>{
  const time=new Date(iso).toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'});
  const day=istanbulDate(iso),today=istanbulDate(data.asOf),yesterday=istanbulDate(new Date(Date.parse(data.asOf)-86400000));
  if(day===today)return 'bugün '+time;
  if(day===yesterday)return 'dün '+time;
  return new Date(iso).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'short'})+' '+time;
 };
 const effective:{quoteId:string;taskId?:string;openPhone?:number}|null=selection??(()=>{const task=daily.open[0];const quote=task?data.quotes.find(q=>q.project_id===task.project_id):incoming[0];return quote?{quoteId:quote.id,taskId:task?.id}:null})();
 return <div className="ofis-today" data-testid="office-today">
  <header className="ofis-page-heading ofis-today-head">
   <div>
    <p className="ofis-helper">{new Date(data.asOf).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'long',year:'numeric',weekday:'long'})}</p>
    <h1>Bugün hangi teklif ilerleyecek?</h1>
    <p className="ofis-day-line" aria-label="Günlük görev sayacı" data-testid="daily-counts">
     <span>Bugün <strong data-testid="daily-total">{daily.total}</strong> iş</span>
     <span><strong data-testid="daily-open">{daily.open.length}</strong> bekliyor</span>
     <span><strong data-testid="daily-done">{daily.done.length}</strong> tamamlandı</span>
     <span><strong data-testid="daily-cancelled">{daily.cancelled.length}</strong> iptal</span>
    </p>
   </div>
   <button className="ofis-secondary" onClick={()=>void query.refetch()}>Yenile</button>
  </header>
  {!data.calendar&&<p role="status">Mesai takvimi ve ilk temas hedefi yapılandırılmamış. Yeni ilk temas işi otomatik zamanlanamaz.</p>}
  {data.truncated&&<p role="status">Veri sınırına ulaşıldı; sayaçlar yalnız yüklenen kayıtları kapsar.</p>}
  {/* Sayaç kutuları aynı günlük görev kümesinden hesaplanır ve listeyi süzer. */}
  <div className="ofis-kpis" aria-label="Görev grupları">
   {([['initial','İlk temas',daily.initial.length,'yeni projeler',FileText,'info'],['overdue','Geciken takip',daily.overdue.length,'sözü geçen görüşmeler',Clock,'danger'],['today','Bugünkü takip',daily.today.length,'bugün planlı',CalendarCheck,'info']] as const).map(([id,label,count,note,Icon,tone])=>
    <button key={id} className="ofis-kpi" data-tone={tone} aria-pressed={group===id} onClick={()=>setGroup(group===id?'all':id)}>
     <span className="ofis-kpi-icon" aria-hidden="true"><Icon size={24}/></span>
     <span className="ofis-kpi-text"><span>{label}</span> <strong>{count}</strong><small>{note}</small></span>
    </button>)}
   <div className="ofis-kpi" data-tone="success">
    <span className="ofis-kpi-icon" aria-hidden="true"><CheckCircle2 size={24}/></span>
    <span className="ofis-kpi-text"><span>Tamamlanan</span> <strong>{daily.done.length}</strong><small>bugün, {daily.total} işten</small></span>
   </div>
  </div>
  <div className="ofis-workspace">
   <div className="ofis-queue">
    <section className="ofis-panel ofis-first">
     <div className="ofis-section-heading">
      <div><h2>Önce ilgilen</h2><p className="ofis-helper">Hedef zamanı en çok geçen iş en üstte.</p></div>
      <button className="ofis-link" aria-pressed={group==='all'} onClick={()=>setGroup('all')}>Tüm işler <span>{daily.open.length}</span></button>
     </div>
     <div className="ofis-task-columns" aria-hidden="true"><span>Müşteri</span><span>İhtiyaç</span><span>Bekleme</span><span>Sonraki adım</span></div>
     <div className="ofis-task-list">{rows.map(task=>{
      const project=data.projects.find(p=>p.id===task.project_id);const quote=data.quotes.find(q=>q.id===project?.valuation_quote_id)??data.quotes.find(q=>q.project_id===task.project_id);
      if(!project||!quote)return <p key={task.id}>Görev {task.id}: teklif kaydı bu görünümde yüklenemedi.</p>;
      const overdue=Date.parse(task.due_at)<Date.parse(data.asOf),minutes=Math.floor((Date.parse(data.asOf)-Date.parse(task.due_at))/60000);
      const reason=task.kind==='initial_contact'?projectContact(data,project.id).label:'Takip sözü '+dueLabel(task.due_at);
      const selected=effective?.taskId===task.id;
      const next=task.kind==='initial_contact'?'Müşteriyi ara':'Takip görüşmesi';
      return <div key={task.id} className="ofis-task-row" data-selected={selected}>
       <button className="ofis-task-main" data-testid={'office-task-'+task.id} aria-pressed={selected} onClick={()=>choose({quoteId:quote.id,taskId:task.id})}>
        <span className="ofis-t-cell"><strong>{quote.customer_name}</strong><span className="ofis-helper">{quote.city_name}</span></span>
        <span className="ofis-t-cell"><span>{quote.material_type==='eps'?'EPS':'Taşyünü'} · {quote.thickness_cm} cm · {number(quote.area_m2)} m²</span><span className="ofis-helper">{project.valuation_net_amount===null?'Tutar seçilmedi':formatCurrency(project.valuation_net_amount)+' · KDV hariç'}</span></span>
        <span className="ofis-t-cell"><strong className={overdue?'ofis-late':undefined}>{overdue?formatGecikme(minutes)+' gecikti':new Date(task.due_at).toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'})}</strong><span className="ofis-helper">{reason} · {task.owner}</span></span>
       </button>
       <button className="ofis-link ofis-t-next" aria-label={`${quote.customer_name}: ${next}`} onClick={()=>choose({quoteId:quote.id,taskId:task.id,openPhone:Date.now()})}>{next}<ChevronRight size={18} aria-hidden="true"/></button>
      </div>;
     })}{!rows.length&&<div className="ofis-empty"><h3>Bu grupta bekleyen iş yok.</h3></div>}</div>
    </section>
    <section className="ofis-panel"><h2>Projeye bağlanacak talepler <span className="ofis-muted">{incoming.length}</span></h2>{incoming.map(q=><button className="ofis-incoming" key={q.id} aria-pressed={!effective?.taskId&&effective?.quoteId===q.id} onClick={()=>choose({quoteId:q.id})}><strong>{q.customer_name}</strong><span>{number(q.area_m2)} m² · {q.city_name}</span><span className="ofis-incoming-go">Proje seç</span></button>)}</section>
    <details className="ofis-panel"><summary>İncelenecek eski kayıtlar · {old.length}</summary><p className="ofis-helper">{data.legacyCutoff?`${new Date(data.legacyCutoff).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})} sabit kesiminden önceki, temas ve planlı işi olmayan bağlantısız teklifler. Günlük görev toplamına dahil değildir.`:'Eski kayıt aktarım sınırı yapılandırılmamış; yaşa göre otomatik kuyruk oluşturulmaz.'}</p>{old.map(q=><button key={q.id} className="ofis-incoming" onClick={()=>choose({quoteId:q.id})}>{q.customer_name} · {q.quote_code??q.id}<span>İncele →</span></button>)}</details>
    <p className="ofis-helper ofis-footnote">Günlük sayaç: açık gecikmiş işler, bugün hedeflenen işler ve bugün tamamlanan ya da iptal edilen işler. Gün sınırı İstanbul saatidir.{data.calendar?.example&&<> Örnek test takvimi: hafta içi {data.calendar.opens}–{data.calendar.closes}, ilk temas hedefi {data.calendar.firstContactMinutes} mesai dakikası. Üretim ayarı değildir.</>}</p>
    <div className="ofis-opportunity"><strong>{formatCurrency(opportunity.amount)} <span className="ofis-helper">KDV hariç açık fırsat</span></strong><p>{opportunity.count} açık proje · {opportunity.unvalued} projede tutar seçilmemiş. Alternatifler toplamı çoğaltmaz.</p></div>
   </div>
   <aside ref={selectionRef} tabIndex={-1} className="ofis-selection" aria-label="Seçili iş">{effective?<OfficeProjectPanel key={effective.quoteId+'-'+effective.taskId+'-'+(effective.openPhone??0)} quoteId={effective.quoteId} taskId={effective.taskId} openPhone={Boolean(effective.openPhone)}/>:<section className="ofis-panel ofis-empty"><h2>Bir iş seçin</h2><p>Görüşme, mesaj ve sonraki adımı burada yönetin.</p></section>}</aside>
  </div>
  <OfficeOverviewSections data={data} quotes={adminQuotes.quotes as never} selectedQuoteId={effective?.quoteId} onNavigate={onNavigate}/>
 </div>;
}
