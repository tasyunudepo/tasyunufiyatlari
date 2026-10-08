'use client';
import {useState} from 'react';
import {useOffice,useOfficeOperation} from '@/lib/hooks/useOffice';
import {useAdminRole} from '@/lib/admin/useAdminRole';
import {projectContact,quoteMessage,shippingText,type OfficeData,type OfficeProject,type OfficeQuoteData} from '@/lib/admin/officeModel';
import {QUOTE_STATUS_LABELS,INTERACTION_LABELS,INTERACTION_RESULT_LABELS} from '@/lib/admin/quoteSemantics';
import {istanbulDate} from '@/lib/admin/officeCalendar';
import {contactTargets} from '@/lib/phone/normalize';
import {formatCurrency} from '@/lib/admin/utils';
const date=(v:string)=>new Date(v).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'short',timeStyle:'short'});

export function OfficeProjectPanel({quoteId,taskId}:{quoteId:string;taskId?:string}){
 const query=useOffice();
 if(query.isPending)return <p>Proje dosyası yükleniyor…</p>;
 if(query.error)return <p role="status">{query.error.message}</p>;
 const data=query.data!,quote=data.quotes.find(q=>String(q.id)===String(quoteId));
 if(!quote)return <p>Teklif bu veri görünümünde bulunamadı.</p>;
 const project=data.projects.find(p=>p.id===quote.project_id);
 return project?<ProjectRecord key={project.id+'-'+quote.id+'-'+(taskId??'manual')} data={data} project={project} quote={quote} taskId={taskId}/>:<UnlinkedQuote key={quote.id} data={data} quote={quote}/>;
}
function UnlinkedQuote({data,quote}:{data:OfficeData;quote:OfficeQuoteData}){
 const role=useAdminRole(),operation=useOfficeOperation();
 const [name,setName]=useState(quote.customer_name+' · '+quote.city_name);
 const [owner,setOwner]=useState(role.user);
 const [projectId,setProjectId]=useState('');
 const candidates=data.projects.filter(p=>p.customer_id===quote.customer_id);
 return <section className="ofis-panel ofis-project-panel" aria-label="Proje bağlantısı">
  <p className="ofis-eyebrow">PROJE DOSYASI</p><h2>{quote.customer_name}</h2>
  <p>Bu teklif henüz bir projeye bağlı değil. Bağlantıyı siz seçersiniz; teklifin satış durumu korunur.</p>
  {role.canMutate?<><label>Proje adı<input value={name} onChange={e=>setName(e.target.value)} maxLength={200}/></label>
   <label>Sorumlu<input value={owner} onChange={e=>setOwner(e.target.value)} maxLength={200}/></label>
   {!data.calendar&&<p role="status">İlk temas işi için mesai takvimi ve hedef süre yapılandırılmalı.</p>}
   <button className="ofis-primary" disabled={operation.busy||!name.trim()||!owner.trim()||!data.calendar} onClick={()=>void operation.run({type:'project_created',quoteId:quote.id,name,owner})}>Yeni proje ve ilk temas işi oluştur</button>
   {candidates.length>0&&<><label>Aynı müşteri kaydındaki mevcut proje<select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Projeyi siz seçin</option>{candidates.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <button className="ofis-secondary" disabled={!projectId||operation.busy} onClick={()=>void operation.run({type:'project_linked',projectId,quoteId:quote.id})}>Seçili projeye alternatif olarak bağla</button></>}
   {operation.error&&<p role="alert">{operation.error} Bilgileriniz korundu; aynı düğmeyle tekrar deneyebilirsiniz.</p>}
  </>:<p>Salt okunur hesap; proje bağlantısını yönetici kurabilir.</p>}
 </section>;
}
function ProjectRecord({data,project,quote,taskId}:{data:OfficeData;project:OfficeProject;quote:OfficeQuoteData;taskId?:string}){
 const role=useAdminRole(),operation=useOfficeOperation();
 const contact=projectContact(data,project.id);
 const task=data.tasks.find(t=>t.id===taskId&&t.project_id===project.id&&t.status==='open');
 const alternatives=data.quotes.filter(q=>q.project_id===project.id);
 const [channel,setChannel]=useState<'phone'|'whatsapp'>('phone');
 const [note,setNote]=useState('');const [phoneOpen,setPhoneOpen]=useState(false);
 const [contactPhone,setContactPhone]=useState(quote.customer_phone??'');
 const [feedback,setFeedback]=useState('');const [message,setMessage]=useState(()=>quoteMessage(quote));
 const [due,setDue]=useState('');const [owner,setOwner]=useState(project.owner??role.user);
 const [valuationQuote,setValuationQuote]=useState(quote.id);
 const [revision,setRevision]=useState(quote.package_items?.manual?.revisions?.length??0);
 const [linkQuote,setLinkQuote]=useState('');
 const [status,setStatus]=useState(project.status??'');const [loss,setLoss]=useState('');
 const targets=contactTargets(contactPhone,message);
 const valuationSource=alternatives.find(q=>q.id===valuationQuote);
 const revisionCount=valuationSource?.package_items?.manual?.revisions?.length??0;
 const candidateQuotes=data.quotes.filter(q=>!q.project_id&&q.customer_id===project.customer_id);
 const selected=data.quotes.find(q=>q.id===project.valuation_quote_id);
 const actionDisabled=!role.canMutate||operation.busy;
 async function record(success:boolean){
  const contactNote=contactPhone!==quote.customer_phone?`Bu görüşmede kullanılan numara: ${contactPhone}\n${note}`:note;
  const saved=await operation.run({type:success?'contact_success':'contact_attempt',projectId:project.id,quoteId:quote.id,channel,note:contactNote,...(task?{taskId:task.id}:{})});
  if(saved){setNote('');setFeedback(task?'Sonuç kaydedildi; görev tamamlandı.':'Görüşme geçmişine kaydedildi.');}
 }
 async function copy(){
  try{await navigator.clipboard.writeText(quote.customer_phone);setFeedback('Numara kopyalandı.');await operation.run({type:'phone_number_copied',projectId:project.id});}
  catch{setFeedback('Kopyalanamadı. Aşağıdaki numarayı seçip kopyalayabilirsiniz.');}
 }
 function quick(days:number){
  if(!data.calendar)return;
  const base=new Date(istanbulDate(data.asOf)+'T12:00:00+03:00');base.setUTCDate(base.getUTCDate()+days);
  setDue(istanbulDate(base)+'T'+data.calendar.opens);
 }
 return <section className="ofis-panel ofis-project-panel" data-testid="office-project-panel" aria-label="Proje dosyası">
  <div><p className="ofis-eyebrow">PROJE DOSYASI</p><h2>{project.name}</h2><p className="ofis-muted">{quote.quote_code??quote.id} · {quote.customer_name}</p></div>
  <dl className="ofis-facts"><div><dt>Satış aşaması · proje</dt><dd>{QUOTE_STATUS_LABELS[project.status as keyof typeof QUOTE_STATUS_LABELS]??'Durumu belirsiz'}</dd></div><div><dt>Temas durumu</dt><dd data-testid="project-contact-state">{contact.label}</dd></div><div><dt>Son girişim</dt><dd>{contact.latest?`${INTERACTION_RESULT_LABELS[contact.latest.outcome??'']??'Sonuç belirsiz'} · ${date(contact.latest.occurredAt)}`:'Girişim kaydı yok'}</dd></div><div><dt>Kayıtlı en eski başarı</dt><dd>{contact.firstRecordedSuccessAt?date(contact.firstRecordedSuccessAt):contact.hasSuccess?'Eski kayıtta var; tarih bilinmiyor':'Başarı kaydı yok'}</dd></div></dl>
  <div className="ofis-next-step"><strong>{task?task.kind==='initial_contact'?'Sıradaki iş: ilk temas':'Sıradaki iş: takip':'Görüşme sonucu veya sonraki adımı kaydedin'}</strong>{task&&<p>{date(task.due_at)} · {task.owner}</p>}<p className="ofis-helper">Bağlantıya basmak görevi tamamlamaz. Sonuç kaydedildiğinde tamamlanır.</p></div>
  <div className="ofis-actions">
   <button className="ofis-primary" onClick={()=>setPhoneOpen(v=>!v)} aria-expanded={phoneOpen}>Telefon / Numarayı göster</button>
   {targets&&role.canMutate?<a className="ofis-whatsapp" href={targets.whatsapp} target="_blank" rel="noreferrer" onClick={()=>void operation.run({type:'contact_link_clicked',projectId:project.id,channel:'whatsapp'})}>WhatsApp</a>:<span className="ofis-helper">{targets?'Salt okunur hesap':'Numara eksik veya biçimi geçersiz'}</span>}
  </div>
  {phoneOpen&&<div className="ofis-phone-box"><p className="ofis-phone-number">{quote.customer_phone||'Numara kayıtlı değil'}</p><div className="ofis-actions"><button className="ofis-secondary" disabled={actionDisabled||!quote.customer_phone} onClick={()=>void copy()}>Kopyala</button>{targets&&role.canMutate&&<a className="ofis-secondary" href={targets.tel} onClick={()=>void operation.run({type:'contact_link_clicked',projectId:project.id,channel:'phone'})}>Arama uygulamasında aç</a>}</div><p className="ofis-helper">Ham kayıt korunur. Numara biçimi, aktif hat veya WhatsApp hesabı olduğunu doğrulamaz.</p></div>}
  {phoneOpen&&role.canMutate&&<details><summary>İletişim numarasını düzelt</summary><label>Bu görüşmede kullanılacak numara<input aria-label="Bu görüşmede kullanılacak numara" value={contactPhone} maxLength={32} onChange={e=>setContactPhone(e.target.value)}/></label><p className="ofis-helper">Bu seçim yalnız açık görüşme için geçerlidir. Teklifteki ham numara ve müşteri bağlantısı korunur; sonuç kaydedilirse kullanılan farklı numara görüşme notuna eklenir.</p>{!targets&&<p role="status">Numara eksik veya biçimi geçersiz; arama ve WhatsApp bağlantıları kapalı.</p>}<button className="ofis-secondary" onClick={()=>setContactPhone(quote.customer_phone??'')}>Kayıtlı numaraya dön</button></details>}
  <details><summary>Mesaj taslağını düzenle</summary><label className="mt-3">Seçili teklifin mesajı<textarea aria-label="Seçili teklifin mesajı" rows={5} value={message} onChange={e=>setMessage(e.target.value)}/></label><p className="ofis-helper">{shippingText(quote)} İç maliyet ve marj paylaşılmaz.</p></details>
  {role.canMutate&&<fieldset disabled={operation.busy} className="ofis-result-form"><legend>Görüşme sonucu kaydet</legend><label>Kanal<select aria-label="Kanal" value={channel} onChange={e=>setChannel(e.target.value as 'phone'|'whatsapp')}><option value="phone">Telefon</option><option value="whatsapp">WhatsApp</option></select></label><label>Görüşme notu<textarea aria-label="Görüşme notu" value={note} maxLength={4000} rows={3} onChange={e=>setNote(e.target.value)}/></label><div className="ofis-actions"><button className="ofis-primary" onClick={()=>void record(true)}>{channel==='phone'?'Görüştüm':'Yanıt aldım'}</button><button className="ofis-secondary" onClick={()=>void record(false)}>{channel==='phone'?'Ulaşamadım':'Mesaj gönderdim'}</button><button className="ofis-secondary" onClick={()=>setFeedback('Sonuç kaydedilmedi; görev açık kaldı.')}>İşlem yapmadım</button></div></fieldset>}
  {feedback&&<p role="status">{feedback}</p>}
  {operation.error&&<p role="alert">{operation.error} Girdiniz korundu; aynı eylemle tekrar deneyin.</p>}
  {role.canMutate&&<details open><summary>Sonraki takip işi</summary><div className="ofis-actions mt-3">{[[1,'Yarın'],[3,'3 gün'],[7,'Haftaya']].map(([n,label])=><button key={n} className="ofis-secondary" disabled={!data.calendar||operation.busy} onClick={()=>quick(Number(n))}>{label}</button>)}</div><label>Kesin tarih ve saat · İstanbul<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label><label>Takip sorumlusu<input value={owner} onChange={e=>setOwner(e.target.value)}/></label>{due&&<p className="ofis-helper">Kaydedilecek: {date(due+':00+03:00')}</p>}<button className="ofis-secondary" disabled={actionDisabled||!due||!owner.trim()} onClick={()=>void operation.run({type:'followup_scheduled',projectId:project.id,dueAt:new Date(due+':00+03:00').toISOString(),owner})}>Takip planla</button>{task&&<button className="ofis-secondary" disabled={actionDisabled} onClick={()=>{const reason=window.prompt('Görevi iptal etme nedeni');if(reason?.trim())void operation.run({type:'task_cancelled',projectId:project.id,taskId:task.id,reason})}}>Bu görevi iptal et</button>}</details>}
  <details><summary>Alternatifler ve proje değeri · {alternatives.length} teklif</summary><p className="mt-3"><strong>{project.valuation_net_amount===null?'Tutar seçilmedi':formatCurrency(project.valuation_net_amount)+' · KDV hariç'}</strong></p><p className="ofis-helper">{selected?`${selected.quote_code??selected.id} · Revizyon ${project.valuation_revision}`:'Değerlemeye esas teklif seçilmemiş.'} Bu seçim müşteri onayı veya kazanılmış satış değildir.</p>{role.canMutate&&<><label>Değerlemeye esas teklif<select aria-label="Değerlemeye esas teklif" value={valuationQuote} onChange={e=>{setValuationQuote(e.target.value);setRevision(alternatives.find(q=>q.id===e.target.value)?.package_items?.manual?.revisions?.length??0)}}>{alternatives.map(q=><option key={q.id} value={q.id}>{q.quote_code??q.id} · {q.area_m2} m²</option>)}</select></label><label>Kayıtlı revizyon<select aria-label="Kayıtlı revizyon" value={revision} onChange={e=>setRevision(Number(e.target.value))}>{Array.from({length:revisionCount+1},(_,i)=><option key={i} value={i}>Revizyon {i}{i===revisionCount?' · güncel':''}</option>)}</select></label><div className="ofis-actions"><button className="ofis-secondary" disabled={actionDisabled} onClick={()=>void operation.run({type:'valuation_selected',projectId:project.id,quoteId:valuationQuote,revision})}>Değerlemeye esas seç</button>{project.valuation_net_amount!==null&&<button className="ofis-secondary" disabled={actionDisabled} onClick={()=>void operation.run({type:'valuation_cleared',projectId:project.id})}>Değer seçimini kaldır</button>}</div>{candidateQuotes.length>0&&<><label>Bağlanacak alternatif<select value={linkQuote} onChange={e=>setLinkQuote(e.target.value)}><option value="">Teklif seçin</option>{candidateQuotes.map(q=><option key={q.id} value={q.id}>{q.quote_code??q.id} · {q.area_m2} m²</option>)}</select></label><button className="ofis-secondary" disabled={!linkQuote||actionDisabled} onClick={()=>void operation.run({type:'project_linked',projectId:project.id,quoteId:linkQuote})}>Bu projeye bağla</button></>}</>}</details>
  {role.canMutate&&<details><summary>Projenin satış aşaması</summary><label className="mt-3">Proje aşaması<select aria-label="Proje aşaması" value={status} onChange={e=>setStatus(e.target.value)}><option value="" disabled>Durumu belirsiz</option>{Object.entries(QUOTE_STATUS_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{status==='rejected'&&<label>Kayıp nedeni<select value={loss} onChange={e=>setLoss(e.target.value)}><option value="">Neden seçin</option>{Object.entries({fiyat:'Fiyat',stok_termin:'Stok / termin',vade_odeme:'Ödeme koşulu',ulasilamadi:'Ulaşılamadı',rakip:'Rakip',vazgecti:'Vazgeçti',diger:'Diğer'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}<button className="ofis-secondary" disabled={actionDisabled||!status||status==='rejected'&&!loss} onClick={()=>void operation.run({type:'outcome_recorded',projectId:project.id,status:status as keyof typeof QUOTE_STATUS_LABELS,...(status==='rejected'?{lossCategory:loss as 'fiyat'}:{})})}>Proje aşamasını kaydet</button><p className="ofis-helper">Teklif belgesinin durumu ve takip işleri ayrıca korunur.</p></details>}
  <details open><summary>Görüşme geçmişi · {contact.rows.length} kayıt</summary><ol className="ofis-history">{contact.rows.slice(0,20).map(r=><li key={String(r.id)}><strong>{r.created_by==='backfill-v24'?'Eski temas aktarımı':INTERACTION_LABELS[r.kind]??r.kind} · {r.created_by==='backfill-v24'&&r.outcome!=='ulasildi'?'Sonuç belirsiz':INTERACTION_RESULT_LABELS[r.outcome??'']??'Sonuç belirtilmedi'}</strong><time dateTime={r.occurred_at}>{date(r.occurred_at)}</time>{r.body&&<p>{r.body}</p>}</li>)}</ol>{!contact.rows.length&&<p className="ofis-muted">Temas kaydı yok.</p>}{contact.rows.length>20&&<p className="ofis-helper">Son 20 kayıt gösteriliyor; başarı özeti tüm yüklü geçmişi kapsıyor.</p>}</details>
 </section>;
}
