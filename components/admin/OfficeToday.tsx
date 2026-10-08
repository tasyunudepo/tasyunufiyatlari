'use client';
import {useRef,useState} from 'react';
import {useOffice} from '@/lib/hooks/useOffice';
import {dailyTasks,opportunitySummary,oldReviewQuotes,projectContact} from '@/lib/admin/officeModel';
import {formatCurrency} from '@/lib/admin/utils';
import {OfficeProjectPanel} from './OfficeProjectPanel';
export function OfficeToday(){
 const selectionRef=useRef<HTMLElement|null>(null);
 const query=useOffice();const [group,setGroup]=useState<'all'|'initial'|'overdue'|'today'>('all');
 const [selection,setSelection]=useState<{quoteId:string;taskId?:string}|null>(null);
 function choose(value:{quoteId:string;taskId?:string}){setSelection(value);requestAnimationFrame(()=>{if(window.matchMedia('(max-width:1199px)').matches)selectionRef.current?.scrollIntoView({block:'start'});selectionRef.current?.focus({preventScroll:true})})}
 if(query.isPending)return <p>Bugünün işleri yükleniyor…</p>;
 if(query.error)return <section className="ofis-panel"><h1>Bugün</h1><p role="status">{query.error.message}</p><button className="ofis-secondary" onClick={()=>void query.refetch()}>Tekrar dene</button></section>;
 const data=query.data!,daily=dailyTasks(data.tasks,data.asOf),opportunity=opportunitySummary(data.projects);
 const old=oldReviewQuotes(data),oldIds=new Set(old.map(q=>q.id));
 const incoming=data.quotes.filter(q=>!q.project_id&&!oldIds.has(q.id));
 const rows=group==='all'?daily.open:daily[group];
 const number=(n:number)=>n.toLocaleString('tr-TR');
 const effective=selection??(()=>{const task=daily.open[0];const quote=task?data.quotes.find(q=>q.project_id===task.project_id):incoming[0];return quote?{quoteId:quote.id,taskId:task?.id}:null})();
 return <div className="ofis-today" data-testid="office-today">
  <header className="ofis-page-heading"><div><p className="ofis-eyebrow">SEVK MASASI · {new Date(data.asOf).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'long',weekday:'long'})}</p><h1>Bugün, sıradaki doğru iş.</h1><p className="ofis-muted">Hedef zamanı en çok geçen işten başlayın. Her satır ayrı bir görevdir.</p></div><button className="ofis-secondary" onClick={()=>void query.refetch()}>Yenile</button></header>
  {data.calendar?.example&&<p className="ofis-helper ofis-example-note">Örnek test takvimi: hafta içi {data.calendar.opens}–{data.calendar.closes} · ilk temas hedefi {data.calendar.firstContactMinutes} mesai dakikası. Üretim ayarı değildir.</p>}
  {!data.calendar&&<p role="status">Mesai takvimi ve ilk temas hedefi yapılandırılmamış. Yeni ilk temas işi otomatik zamanlanamaz.</p>}
  {data.truncated&&<p role="status">Veri sınırına ulaşıldı; sayaçlar yalnız yüklenen kayıtları kapsar.</p>}
  <section className="ofis-day-counts" aria-label="Günlük görev sayacı" data-testid="daily-counts"><div><span>Bugünün işleri</span><strong data-testid="daily-total">{daily.total}</strong></div><div><span>Tamamlandı</span><strong data-testid="daily-done">{daily.done.length}</strong></div><div><span>Bekliyor</span><strong data-testid="daily-open">{daily.open.length}</strong></div><div><span>İptal edildi</span><strong data-testid="daily-cancelled">{daily.cancelled.length}</strong></div></section>
  <p className="ofis-helper">Açık gecikmiş işler + bugün hedeflenen işler + bugün tamamlanan/iptal edilen işler. Gün sınırı İstanbul saatidir.</p>
  <div className="ofis-workspace">
   <div className="ofis-queue">
    <section className="ofis-panel"><div className="ofis-section-heading"><h2>İş sırası</h2><span className="ofis-helper">Hedef zamanına göre</span></div>
     <div className="ofis-filter-row" aria-label="Görev grupları">{([['all','Önerilen sıra',daily.open.length],['initial','İlk temas',daily.initial.length],['overdue','Geciken takip',daily.overdue.length],['today','Bugünkü takip',daily.today.length]] as const).map(([id,label,count])=><button key={id} className="ofis-filter" aria-pressed={group===id} onClick={()=>setGroup(id)}>{label} <span>{count}</span></button>)}</div>
     <div className="ofis-task-list">{rows.map(task=>{
      const project=data.projects.find(p=>p.id===task.project_id);const quote=data.quotes.find(q=>q.id===project?.valuation_quote_id)??data.quotes.find(q=>q.project_id===task.project_id);
      if(!project||!quote)return <p key={task.id}>Görev {task.id}: teklif kaydı bu görünümde yüklenemedi.</p>;
      const overdue=Date.parse(task.due_at)<Date.parse(data.asOf),minutes=Math.floor((Date.parse(data.asOf)-Date.parse(task.due_at))/60000);
      const reason=task.kind==='initial_contact'?projectContact(data,project.id).label:'Planlı geri dönüş sözü';
      return <button key={task.id} className="ofis-task-row" data-testid={'office-task-'+task.id} aria-pressed={effective?.taskId===task.id} onClick={()=>choose({quoteId:quote.id,taskId:task.id})}>
       <span className={'ofis-due '+(overdue?'is-late':'')}>{overdue?`${number(minutes)} dk gecikti`:new Date(task.due_at).toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'})}</span>
       <span className="ofis-task-content"><strong>{quote.customer_name}</strong><span>{quote.material_type==='eps'?'EPS':'Taşyünü'} · {quote.thickness_cm} cm · {number(quote.area_m2)} m² · {quote.city_name}</span><span className="ofis-helper">{reason} · {task.owner}</span></span>
       <span className="ofis-task-value">{project.valuation_net_amount===null?'Tutar seçilmedi':formatCurrency(project.valuation_net_amount)}<small>{project.valuation_net_amount===null?'Proje değeri belirsiz':'KDV hariç · seçili teklif'}</small><span className="ofis-helper">İşi aç →</span></span>
      </button>;
     })}{!rows.length&&<div className="ofis-empty"><h3>Bu grupta bekleyen iş yok.</h3><p>Yeni görevler ve kaydedilen sonuçlar yenilendiğinde burada görünür.</p></div>}</div>
    </section>
    <section className="ofis-panel"><h2>Projeye bağlanacak talepler <span className="ofis-muted">{incoming.length}</span></h2><p className="ofis-helper">Bunlar teklif kaydıdır; proje seçildiğinde tek ilk temas işi oluşur.</p>{incoming.map(q=><button className="ofis-incoming" key={q.id} onClick={()=>choose({quoteId:q.id})}><strong>{q.customer_name}</strong><span>{q.area_m2} m² · {q.city_name}</span><span>Proje seç →</span></button>)}</section>
    <details className="ofis-panel"><summary>İncelenecek eski kayıtlar · {old.length}</summary><p className="ofis-helper">{data.legacyCutoff?`${new Date(data.legacyCutoff).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})} sabit kesiminden önceki, temas ve planlı işi olmayan bağlantısız teklifler. Günlük görev toplamına dahil değildir.`:'Eski kayıt aktarım sınırı yapılandırılmamış; yaşa göre otomatik kuyruk oluşturulmaz.'}</p>{old.map(q=><button key={q.id} className="ofis-incoming" onClick={()=>choose({quoteId:q.id})}>{q.customer_name} · {q.quote_code??q.id}<span>İncele →</span></button>)}</details>
    <div className="ofis-opportunity"><strong>{formatCurrency(opportunity.amount)} <span className="ofis-helper">KDV hariç açık fırsat</span></strong><p>{opportunity.count} açık proje · {opportunity.unvalued} projede tutar seçilmemiş. Alternatifler toplamı çoğaltmaz.</p></div>
   </div>
   <aside ref={selectionRef} tabIndex={-1} className="ofis-selection" aria-label="Seçili iş">{effective?<OfficeProjectPanel key={effective.quoteId+'-'+effective.taskId} {...effective}/>:<section className="ofis-panel ofis-empty"><h2>Bir iş seçin</h2><p>Görüşme, mesaj ve sonraki adımı burada yönetin.</p></section>}</aside>
  </div>
 </div>;
}
