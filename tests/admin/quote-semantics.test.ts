import { describe, expect, it } from 'vitest';
import { pgBigintId, quoteStatusDistribution, quoteStatusLabel, summarizeQuoteContact, type InteractionHistory, type QuoteInteraction } from '@/lib/admin/quoteSemantics';
const quote = { id: '201', contact_successful: null, contact_attempted_at: null };
const row = (id: string, outcome: string, occurred_at: string, extra = {}): QuoteInteraction => ({ id, quote_id: '201', kind: 'arama_giden', outcome, occurred_at, ...extra });
const success = row('9007199254740993', 'ulasildi', '2026-10-08T08:00:00Z');
const fail = row('9007199254740994', 'ulasilamadi', '2026-10-08T09:00:00Z');
const history = (rows: QuoteInteraction[], extra = {}): InteractionHistory => ({ interactions: rows, firstSuccess: null, latestAttempt: null, hasOlder: false, ...extra });

describe('mevcut teklif ve görüşme alanlarının kayıpsız gösterimi', () => {
  it('altı aşama ve belirsiz grup toplamı seçili teklif sayısına eşittir', () => {
    const d = quoteStatusDistribution(['pending','contacted','quoted','approved','completed','rejected',null,'legacy'].map(status => ({status})));
    expect(d.counts.unknown).toBe(2);expect(Object.values(d.counts).reduce((a,b)=>a+b,0)).toBe(d.total);expect(d.total).toBe(8);
    expect(quoteStatusLabel(null)).toBe('Durumu belirsiz');
  });
  it('boş filtre kümesinde bütün sayaçlar sıfırdır', () => expect(quoteStatusDistribution([]).total).toBe(0));
  it('başarıdan sonraki başarısız arama önceki başarıyı silmez', () => {
    const result = summarizeQuoteContact(quote, history([fail,success]));
    expect(result.state).toBe('successful');expect(result.latest?.outcome).toBe('ulasilamadi');expect(result.firstRecordedSuccessAt).toBe(success.occurred_at);
  });
  it('son yüz satırda olmayan eski başarı ayrı özet sorgusuyla korunur', () => {
    expect(summarizeQuoteContact(quote,history([fail],{firstSuccess:success,latestAttempt:fail,hasOlder:true})).state).toBe('successful');
  });
  it('aynı müşteri veya başka teklifin görüşmesi bu teklife eklenmez', () => {
    expect(summarizeQuoteContact(quote,history([{...success,quote_id:'202'}])).state).toBe('none');
  });
  it('tıklama, kopya, not ve hatırlatma temas üretmez', () => {
    for (const kind of ['contact_link_clicked','phone_number_copied','not','hatirlatma'])
      expect(summarizeQuoteContact(quote,history([{...success,kind}])).state).toBe('none');
  });
  it('sonuçsuz kanal kaydı temas denemesi varsayılmaz', () => expect(summarizeQuoteContact(quote,history([{...success,outcome:null}])).state).toBe('none'));
  it('yalnız mesaj/ulaşılamadı kaydı denemedir', () => expect(summarizeQuoteContact(quote,history([fail])).state).toBe('attempted'));
  it('boş başarılı GET temas kaydı yok anlamındadır, aranmadı anlamında değil', () => expect(summarizeQuoteContact(quote,history([])).label).toBe('Temas kaydı yok'));
  it('okuma hatası başarı yok olarak gösterilmez', () => expect(summarizeQuoteContact(quote,undefined).state).toBe('unavailable'));
  it('eski başarılı alan korunur, zamanı ilk başarı diye uydurulmaz', () => {
    const s = summarizeQuoteContact({...quote,contact_successful:true},history([fail]));expect(s.state).toBe('successful');expect(s.firstRecordedSuccessAt).toBeNull();expect(s.latest?.outcome).toBe('ulasilamadi');
  });
  it('eski alanda daha yeni girişim varsa son sonuç onu gösterir', () => {
    const s=summarizeQuoteContact({...quote,contact_successful:false,contact_attempted_at:'2026-10-08T10:00:00Z'},history([success]));
    expect(s.state).toBe('successful');expect(s.latest?.source).toBe('legacy');expect(s.latest?.outcome).toBe('ulasilamadi');
  });
  it('eş zamanlı kayıtlarda bigint kimlik sırası kaybolmaz', () => {
    const s=summarizeQuoteContact(quote,history([success,{...fail,occurred_at:success.occurred_at}]));expect(s.latest?.outcome).toBe('ulasilamadi');
  });
  it('v24 null→ulasilamadi aktarımı kesin başarısızlık olarak sunulmaz', () => {
    const s=summarizeQuoteContact(quote,history([{...fail,created_by:'backfill-v24'}]));expect(s.state).toBe('uncertain');expect(s.latest?.outcome).toBeNull();
  });
  it('eşlenmemiş eski sonuç toplamdan kaybolmaz veya başarı diye sayılmaz', () => {
    const s=summarizeQuoteContact(quote,history([{...fail,outcome:'randevu'}]));expect(s.state).toBe('uncertain');expect(s.latest?.outcome).toBe('randevu');
  });
  it('kaynak nesneleri değiştirmez', () => {
    const source=history([fail,success]);const copy=JSON.stringify(source);summarizeQuoteContact(quote,source);expect(JSON.stringify(source)).toBe(copy);
  });
});
describe('Postgres bigint kimliği', () => {
  it('büyük kimliği ondalık metin olarak korur', () => expect(pgBigintId('9223372036854775807')).toBe('9223372036854775807'));
  it.each(['9223372036854775808','-1','0','1.2','2e3','01',Number.MAX_SAFE_INTEGER+1])('geçersiz veya JS içinde kaybolmuş kimliği reddeder: %s', value => expect(pgBigintId(value)).toBeNull());
});
