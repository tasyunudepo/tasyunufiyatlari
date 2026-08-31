# Karşılaştırma aktivasyonu — uygulama ve doğrulama planı

> Tarih: 31 Ağustos 2026
> Risk: R3 — fiyat/teklif yönlendirmesi ve kritik lead bağlamı

## Sonuç

`/tasyunu-karsilastir` sayfası yüksek niyetli yüzeylerden bulunabilir olacak;
kullanıcının şehir, yaka, kalınlık ve ürün seçimi ana hesaplayıcıya kayıpsız
aktarılacak. Karşılaştırma oturumu kişisel veri içermeyen bir kimlikle GA4
olaylarında ve teklif metadata'sında izlenebilecek.

İkinci dilimde mobil teknik tablo, 320–767 px arasında kaydırmasız karar
kartlarına dönüştürüldü. Karşılaştırma kaynağı da API, teklif, funnel olayı ve
CRM müşteri kökeninde birinci sınıf bir kanal hâline getirildi.

## Kabul kriterleri

| ID | Başlangıç ve eylem | Beklenen sonuç | Kanıt |
|---|---|---|---|
| AC-KA-001 | Ankara, 8 cm ve Bonus F 150 seçilip satır CTA'sına basılır | Ana hesaplayıcı Ankara, 8 cm ve tam olarak Bonus F 150 ile açılır | Playwright |
| AC-KA-002 | Karşılaştırma rotası temiz ziyaretçi olarak açılır | Proje ölçeği modalı karar akışını kesmez | Playwright |
| AC-KA-003 | Kategori, PDP veya ana hesaplayıcı ürün seçimi görüntülenir | Karşılaştırmaya bağlamsal ve ikincil bir giriş vardır | Playwright + kaynak sözleşmesi |
| AC-KA-004 | Karşılaştırma açılır ve ürün CTA'sına basılır | İki olay aynı anonim `comparison_session_id` değerini taşır | Vitest |
| AC-KA-005 | Fiyat satırı görüntülenir | `KDV hariç` ve tam araç nakliye koşulu fiyatla birlikte okunur | Playwright |
| AC-KA-006 | Şehir/yaka/kalınlık kontrolleri klavye veya ekran okuyucuyla kullanılır | Kontrollerin erişilebilir adı ve seçili durumu vardır | Playwright + detector |
| AC-KA-007 | Teknik kıyas 320, 375, 430 veya 767 px'de açılır | Sekiz mobil kart görünür, beş temel veri kesilmez ve sayfa yatay taşmaz | Playwright + görsel kontrol |
| AC-KA-008 | Mobil kart ayrıntısı klavyeden açılır | Yangın sınıfı, beyan türü ve kaynak tarihi erişilebilir olur | Playwright |
| AC-KA-009 | Karşılaştırmadan başlayan WhatsApp teklifi gönderilir | API payload'ı `sourceChannel=comparison` ve doğrulanmış oturum kimliği taşır | Playwright + Vitest |
| AC-KA-010 | Aynı oturum atomik teklif RPC'sine ulaşır | Quote generated kolonu, funnel source ve CRM `origin=comparison` aynı kayda bağlanır | Gerçek PostgreSQL 16 smoke |
| AC-KA-011 | Atıf veya oturum kimliği değiştirilerek aynı ticari talep tekrarlanır | Fingerprint değişmez; edinim bilgisi dedupe'ı atlatamaz | Vitest |

## Sınırlar

- Fiyat formülü, iskonto ve araç kapasitesi değiştirilmez.
- Koşulsuz “ücretsiz nakliye” veya doğrulanmamış teslim/ödeme vaadi eklenmez.
- Ana sayfadaki `Fiyatımı Hesapla` birincil CTA olarak kalır.
- Kişisel veri analitik olaylara veya URL'ye yazılmaz.
- Atomik `submit_quote_guarded` RPC imzası ve allowlist'i değiştirilmez.
- İstemcinin nested oturum değeri güvenilmez kabul edilir; API'de doğrulanan
  top-level değer RPC payload'ındaki nested alana sunucu tarafından yazılır.
- Migration additive'dir; eski teklifler için backfill uydurulmaz.

## Veritabanı tasarımı ve yayın sırası

`migration-v26-comparison-attribution.sql`, mevcut
`package_items.attribution.comparison_session_id` değerini STORED generated
`quotes.comparison_session_id` kolonuna çıkarır ve yalnız dolu değerleri
indeksler. Aynı değer iki yerde bağımsız yazılamadığı için doğruluk ayrışması
oluşmaz. `source_channel='comparison'` için geçerli ve en fazla 80 karakterlik
oturum zorunludur; comparison dışı kanala bu oturum bağlanamaz.

Güvenli production sırası:

1. Canlı DB'de v17 RPC, v24 customers/trigger, origin constraint'i, mevcut
   source dağılımı ve quotes tablo boyutu salt-okunur doğrulanır.
2. v26 migration uygulanır; generated kolon, constraint, partial index ve
   trigger assertion'ları transaction içinde geçer.
3. Uygulama yayına alınır; ilk comparison quote salt-okunur sorguyla quote,
   event ve customer zincirinde doğrulanır.
4. GA4/CRM raporunda `source_channel='comparison'` ayrı segmentlenir.

Migration production'a bu çalışma sırasında **uygulanmadı**.

Güvenli rollback, uygulamayı yeniden `sourceChannel=wizard` üretecek sürüme
döndürmek ve additive kolon/constraint'i yerinde bırakmaktır. Kolonu veya
`origin=comparison` kayıtlarını silen sert rollback, tarihsel atfı yok edeceği
için ayrı veri taşıma kararı olmadan uygulanmaz.

## Doğrulama

```text
Hedefli unit: npm run test:run -- tests/analytics/wizard-events.test.ts tests/api/quote-schema.test.ts
Hedefli E2E: npx playwright test tests/e2e/karsilastirma.spec.ts
Hızlı paket: npm run verify:fast
Tam paket: npm run verify:full
UI detector: node /home/emrah/.agents/skills/impeccable/scripts/detect.mjs --json <değişen UI dosyaları>
```

## 31 Ağustos doğrulama sonucu

| Kapı | Sonuç |
|---|---|
| `npm run verify:full` | 74 dosya / 657 test geçti; TypeScript, ESLint ve 467 sayfalık production build geçti |
| `npm run test:db:quote-guard` | Mevcut guard smoke + ayrı v26 PostgreSQL 16 smoke geçti; migration iki kez uygulanabildi |
| `tests/e2e/karsilastirma.spec.ts` | 8/8 geçti; mobile breakpoint, klavye, taşma ve comparison→quote payload dahil |
| Güncel ana sayfa WhatsApp + PDF teklif E2E | 2/2 geçti |
| Ziyaretçi metni kapısı | Geçti |
| Impeccable kaynak detector | `[]` |
| `verify:acceptance` | Üç mevcut hash sapması nedeniyle kırmızı; aşağıdaki not |

Kabul kilidindeki sapmalar:

- `tests/api/quotes-route.integration.test.ts`: bu çalışmanın comparison API
  kabulüyle bilinçli değişti; tüm ilgili testler yeşil.
- `tests/contracts/pdf-screen-consistency.test.ts`: bu çalışma değiştirmedi.
- `tests/e2e/quote-flows/pricing-consistency.spec.ts`: bu çalışma değiştirmedi.

Manifestte ilgisiz iki dosyanın sahipliği teyit edilmeden toplu hash yenilemesi
yapılmadı.

Korunan `critical-quote-flows.spec.ts` içindeki iki eski Wizard senaryosu,
artık ana sayfada bulunmayan çok adımlı “Dalmaçyalı” düğmesini aradığı için
teklif isteğinden önce zaman aşımına uğruyor. Ürün/PDP senaryoları 3/3 ve güncel
ana sayfa WhatsApp/PDF senaryoları 2/2 geçti; ürün hatası değil, eski helper test
borcudur ve bu kapsamda kilit dosya değiştirilmedi.
