'use client';
import {useState} from 'react';
import {formatCurrency} from '@/lib/admin/utils';
import {shippingText,type OfficeQuoteData} from '@/lib/admin/officeModel';
export function QuoteTechnicalSummary({quote}:{quote:Record<string,unknown>}){
 const q=quote as unknown as OfficeQuoteData;
 const revisions=q.package_items?.manual?.revisions??[];
 const [beforeIndex,setBeforeIndex]=useState(Math.max(0,revisions.length-1));
 const before=revisions[beforeIndex];
 const amount=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?formatCurrency(v):'Kayıtlı değil';
 const vehicle=quote.vehicle_type==='lorry'?'Kamyon':quote.vehicle_type==='truck'?'TIR':quote.vehicle_type==='multiple'?'Çoklu araç':'Araç karşılığı kayıtlı değil';
 const fill=Number(quote.vehicle_type==='lorry'?quote.lorry_fill_percentage:quote.truck_fill_percentage);
 const vehicleText=Number.isFinite(fill)&&fill>0?Math.abs(fill-100)<0.05?`= 1 ${vehicle}`:`${vehicle} · %${fill.toLocaleString('tr-TR')} doluluk`:vehicle;
 return <section className="ofis-technical" aria-label="Teknik föy">
  <p className="ofis-eyebrow">KAYITLI TEKLİF · REVİZYON {revisions.length}</p>
  <div className="ofis-technical-area"><strong>{Number(q.area_m2).toLocaleString('tr-TR')} m²</strong><span>{vehicleText}</span></div>
  <dl className="ofis-facts"><div><dt>KDV hariç tutar</dt><dd>{amount(q.price_without_vat)}</dd></div><div><dt>KDV dahil toplam</dt><dd>{amount(q.total_price)}</dd></div><div><dt>KDV hariç birim fiyat</dt><dd>{amount(q.price_per_m2)} / m²</dd></div><div><dt>Nakliye</dt><dd>{shippingText(q)}{Number(q.shipping_cost)>0&&` ${amount(q.shipping_cost)} + KDV`}</dd></div><div><dt>Geçerlilik</dt><dd>{q.package_items?.manual?.validityDays?`${q.package_items.manual.validityDays} gün · kayıtlı teklif koşulu`:'Bu kayıtta belirtilmemiş'}</dd></div><div><dt>Kaynak</dt><dd>Tutarlar teklif kaydından gelir; güncel fiyat listesiyle değiştirilmez.</dd></div></dl>
  {revisions.length>0&&<details open><summary>Revizyon farkı</summary><label className="ofis-revision-select">Karşılaştırılacak eski sürüm<select aria-label="Karşılaştırılacak eski sürüm" value={beforeIndex} onChange={e=>setBeforeIndex(Number(e.target.value))}>{revisions.map((r,i)=><option key={r.no} value={i}>Revizyon {r.no-1} · {new Date(r.at).toLocaleDateString('tr-TR')}</option>)}</select></label><div className="ofis-revision-diff" role="table" aria-label="Revizyon karşılaştırması"><div role="row"><strong role="columnheader">Alan</strong><strong role="columnheader">Önce</strong><strong role="columnheader">Güncel</strong></div>{[
   ['Metraj',before?.areaM2==null?'Kayıtlı değil':`${before.areaM2} m²`,`${q.area_m2} m²`],
   ['Birim / m²',amount(before?.pricePerM2),amount(q.price_per_m2)],
   ['Nakliye',amount(before?.shippingCost),amount(q.shipping_cost)],
   ['KDV hariç',amount(before?.priceWithoutVat),amount(q.price_without_vat)],
   ['KDV dahil',amount(before?.totalPrice),amount(q.total_price)],
  ].map(([label,old,current])=><div role="row" key={label}><span role="cell">{label}</span><span role="cell">{old}</span><span role="cell">{current}</span></div>)}</div><p className="ofis-helper">Eski kayıtta saklanmamış birim fiyat veya nakliye, bugünkü veriden türetilmez.</p></details>}
 </section>;
}
