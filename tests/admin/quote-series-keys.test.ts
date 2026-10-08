import {describe,it,expect} from 'vitest';
import {groupQuotesIntoSeries} from '@/lib/admin/groupQuotesIntoSeries';
describe('teklif serisi kimliği',()=>{
 it('aynı anda aynı telefonla gelen ayrı işler filtrelenirken birbirinin React kaydını kullanamaz',()=>{
  const base={created_at:'2026-10-08T09:00:00Z',customer_phone:'05320000000',city_name:'İstanbul',material_type:'eps'};
  const groups=groupQuotesIntoSeries([{...base,id:'9007199254740993',customer_name:'Kuzey'},{...base,id:'9007199254740994',customer_name:'Güney'}]);
  expect(groups).toHaveLength(2);
  expect(new Set(groups.map(g=>g.seriesKey)).size).toBe(2);
  for(const g of groups)expect(groupQuotesIntoSeries(g.quotes)[0].seriesKey).toBe(g.seriesKey);
 });
});
