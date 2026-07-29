# Codex Hakem Sentezi

## Panel durumu

- GLM 5.2: tamamlandı; güncel koddan yararlı dosya sahipliği ve koşullu nakliye önerileri çıkardı.
- MiniMax M3: kota/429 nedeniyle yanıt veremedi; bu turda CRO hakem oyu yok.
- DeepSeek V4 Pro: tamamlandı; P0 zincirini kodla büyük ölçüde doğruladı, fakat birkaç güncellik ve güvenlik hatası yaptı.

Panel çıktıları kanıt değil, hakem görüşüdür. Nihai karar güncel repo, AGENTS.md, kullanıcı tarafından kilitlenen ticari kurallar ve çalıştırılabilir kabul kriterlerine dayanır.

## Kabul edilen öneriler

1. Aynı dosyaya iki modelin aynı anda yazmaması ve sıcak dosyaların tek sahibe verilmesi.
2. `WizardCalculator.tsx` ile `SingleProductQuoteButton.tsx` işlerinin farklı sahiplerde paralel yürütülebilmesi.
3. WhatsApp mesajının sabit “nakliye dahil” yerine kanonik nakliye kararını tüketmesi.
4. `SingleProductQuoteButton` API başarısızlığında başarı state’ine geçmemesi.
5. P0’da `kvkkConsent`, `/1.2`, PII/marj logu, rate-limit/idempotency ve testlerin birlikte ele alınması.
6. Kullanılmayan package-engine’in P0’da doğrudan devreye alınmaması.
7. `SepetUI` scenario effect bağımlılığı ve mixed sepet server kontrolünün ayrı P1 karakterizasyon maddesi olarak incelenmesi.
8. Ticari soruların nakliye istisnası, EPS küçük sipariş, PDF teslimi ve uluslararası telefon kabulü gibi işletme kararlarına çevrilmesi.

## Reddedilen veya düzeltilen öneriler

1. **Testleri P2’ye erteleme reddedildi.** Proje R3/R4 riskinde ve kullanıcı açıkça test-first istedi. Minimal test omurgası P0-A01’dir; önce `kvkkConsent` 400 regresyonu yazılır.
2. **Process içi `Map`/LRU rate limit reddedildi.** Vercel çoklu instance ve cold start altında koruma sağlamaz. Dağıtık TTL store + DB idempotency birlikte kullanılacaktır.
3. **Next 16.1.7 “yükseltme gerekmiyor” iddiası yanlış.** Resmî advisory ve güncel `npm audit`, 16.1.7’yi proxy bypass açısından etkilenen aralıkta gösteriyor; güvenli güncel stabil sürüme yükseltme P0’dır.
4. **P0’da package-engine’e geçiş reddedildi.** Engine’de Optimix placeholder, cm/mm ve fiyatlama eksikleri vardır. Geçiş P1/P3 karakterizasyon ve golden test sonrasındadır.
5. **`kvkkConsent: true` hard-code edilmez.** Gerçek form onayı payload’a taşınır; eksik/false değer server’da yan etkisiz reddedilir.
6. **“Nakliye satış ekibiyle netleşir” tam araç için kullanılmaz.** Kilitli kural: tam kamyon/TIR siparişinde nakliye satış fiyatına dahildir. Düşük metraj ve ayrı sevkiyat farklı mesaj üretir.
7. **100 m² düşük metraj E2E’si doğrudan varsayılmaz.** Mevcut `full_vehicle_only` blokajı ve kullanıcının düşük metraj cevabı önce karakterizasyon testinde netleştirilir.
8. **Fiyat görüntüleme event’i eksik iddiası güncel değil.** `ProductPricePanel` event’i bugün tetikliyor; P0 kapsamına alınmaz.
9. **7,5 cm PDP parse hatası güncel aktif route için kanıtlanmadı.** Aktif Wizard’daki `parseInt(selectedKalinlik)` ayrı P1 karakterizasyon maddesidir.
10. **P0’da A/B testi reddedildi.** Yanlış vaat ve kırık UX deney konusu değildir; doğrudan düzeltilir. Trafik ve ölçüm kararlı hâle geldikten sonra deney düşünülür.

## Harman plan

Kanonik dosya: `kanonik-konsensus-fable-sol.md`.

- P0 üç paralel hatta ayrılır: lead/fiyat doğruluğu, güvenlik kapatma, müşteri vaadi/KVKK.
- Codex sıcak server/schema/Wizard/package/migration dosyalarının entegratörüdür.
- Claude Fable 5 izole PDP, analytics, CRO copy, SEO ve erişilebilirlik dosyalarını üstlenir.
- Ticari cevap eksikse görev `BEKLİYOR-EMRAH` olur; teknik ekip iş kuralı uydurmaz.
- P0 merge sırası: test/kontrat → server güvenlik → client tüketiciler → ortak entegrasyon → üç kritik E2E → release kanıtı.

## Test kapıları

- Her hata düzeltmesinden önce yeniden üretim testi.
- Her iterasyonda hedefli `verify:fast`.
- Faz sonunda `verify:full`.
- Teslimde üç kritik E2E, auth/RLS/storage matrisi, build, lint ve gerekiyorsa `web-copy-gate` içeren `verify:release`.
- Kabul testlerinde `skip`, `only`, gevşetme veya teste özel production bypass yok.
