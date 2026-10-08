// Completely fictional records. Never import a production export into this file.
const states=['pending','quoted','contacted','approved','completed','rejected'];
export const quotes=states.map((status,i)=>({
 id:201+i,quote_code:`ORNEK-2026-00${i+1}`,created_at:`2026-10-0${8-i}T08:15:00.000Z`,updated_at:`2026-10-0${8-i}T08:15:00.000Z`,
 customer_name:['Örnek Kuzey Yapı','Örnek Ada Cephe','Örnek Çınar Proje','Örnek Güney Yapı','Örnek Doğu Proje','Örnek Batı Cephe'][i],customer_company:null,customer_phone:'',customer_email:'',customer_address:'Örnek proje adresi',
 city_name:'İstanbul',city_code:34,material_type:'eps',brand_name:'Optimix',model_name:'Karbonlu',thickness_cm:4,area_m2:1680,
 package_name:'Örnek teklif',total_price:263692.80,subtotal:219744,price_without_vat:219744,vat_amount:43948.80,price_per_m2:130.8,
 status,priority:i===1?'high':'normal',request_type:'manual_quote',source_channel:'ofis',vehicle_type:'lorry',package_count:280,
 contact_attempted_at:i>1?`2026-10-0${8-i}T09:15:00.000Z`:null,contact_successful:i>1?true:null,
 follow_up_date:i===1?'2026-10-07':null,quoted_by:'Örnek satışçı',admin_notes:'Bu kayıt yalnız yerel görünüm incelemesi içindir.',
 loss_category:status==='rejected'?'fiyat':null,closed_at:status==='completed'||status==='rejected'?'2026-10-08T08:00:00Z':null,
 gross_profit:status==='completed'?10987.2:null,sales_final_price:status==='completed'?219744:null,
 pdf_url:null,pdf_storage_path:null,
 package_items:{items:[{name:'Örnek EPS levha',quantity:1680,unit:'m²',unitPrice:130.8,listUnitPrice:130.8,totalPrice:219744,isPlate:true,kind:'levha',thicknessCm:4,packageCount:280}],manual:{shippingMode:'buyer_pays',shippingCharge:0,validityDays:7}},
}));
export const interactions = [
 {id:'9007199254740993',quote_id:'201',kind:'arama_giden',outcome:'ulasildi',occurred_at:'2026-10-08T08:30:00Z',created_by:'Örnek satışçı',body:'Örnek görüşme: ürün ihtiyacı konuşuldu.'},
 {id:'9007199254740994',quote_id:'201',kind:'arama_giden',outcome:'ulasilamadi',occurred_at:'2026-10-08T09:30:00Z',created_by:'Örnek satışçı',body:'Örnek ikinci arama: yanıt alınamadı.'},
];
const date='2026-10-08T10:00:00.000Z';
export const dashboard={daily_total:1,daily_pending_count:1,daily_quoted_count:0,avg_price_per_m2_today:130.8,daily_pdf_count:0,daily_whatsapp_count:0,recent_2h:0,prev_2h:0,velocity_ratio:null,velocity_trend:'stable',eps_count_30d:6,rockwool_count_30d:0,eps_ratio_30d:100,rockwool_ratio_30d:0,eps_area_m2_30d:10080,rockwool_area_m2_30d:0,eps_amount_30d:1582156.8,rockwool_amount_30d:0,today_amount:263692.8,today_area_m2:1680,week_count:6,week_amount:1582156.8,week_area_m2:10080,month_count:6,month_amount:1582156.8,month_area_m2:10080,eps_brands_7d:[{brand:'Optimix',count:6}],rockwool_brands_7d:[],product_breakdown_7d:[{brand:'Optimix',model:'Karbonlu',material:'eps',count:6}],computed_at:date};
export const combinations={eps_brands_7d:[{brand:'Optimix',count:6,area_m2:10080,amount:1582156.8}],rockwool_brands_7d:[],powder_brands_7d:[],top_cross_combinations_7d:[{plate_brand:'Optimix',model:'Karbonlu',powder_brand:'-',material:'eps',count:6,area_m2:10080,amount:1582156.8}],computed_at:date};
export const tables={
 shipping_zones:[{id:1,city_name:'İstanbul',city_code:34,region_name:'Marmara',is_active:true}],
 logistics_capacity:[{id:1,material_type_id:2,thickness:4,package_m2:6,packages_per_kamyon:280,packages_per_tir:520,m2_per_kamyon:1680,m2_per_tir:3120}],
 plates:[{id:1,brand_id:1,material_type_id:2,name:'Örnek EPS levha',short_name:'Örnek EPS',model_name:'Karbonlu',thickness:4,thickness_cm:4,package_m2:6,is_active:true,brands:{name:'Optimix'},material_types:{name:'EPS',slug:'eps'},image_url:null}],
 accessories:[],plate_prices:[],shipping_discounts:[],brands:[],material_types:[]
};
export function fixtureFor(path,role){
 const match=path.match(/^\/api\/admin\/quotes\/(\d+)\/interactions$/);
 if(match){const rows=interactions.filter(row=>row.quote_id===match[1]);return {ok:true,interactions:[...rows].reverse(),firstSuccess:rows.find(row=>row.outcome==='ulasildi')??null,latestAttempt:rows.at(-1)??null,hasOlder:false}}

 if(path==='/api/admin/me')return {user:role==='patron'?'patron':'Önizleme',role};
 if(path==='/api/admin/quotes')return {ok:true,quotes,eventsByQuoteId:{},funnelSummary:{}};
 if(path==='/api/admin/dashboard-metrics')return {ok:true,metrics:dashboard};
 if(path==='/api/admin/combination-metrics')return {ok:true,metrics:combinations};
 if(path==='/api/admin/experiments')return {ok:true,experiments:[]};
 if(path==='/api/admin/brands')return {ok:true,brands:[]};
 if(path==='/api/admin/material-types')return {ok:true,materialTypes:[],material_types:[]};
 if(path==='/api/admin/storage-images')return {ok:true,images:[]};
 if(path==='/api/admin/catalog-items')return {ok:true,items:[],total:0,notes:[],context:{bonusSubRegion:null}};
 if(path==='/api/admin/accessory-sets')return {ok:true,sets:[]};
 if(path.startsWith('/rest/v1/'))return tables[path.slice('/rest/v1/'.length)]??[];
 return null;
}
