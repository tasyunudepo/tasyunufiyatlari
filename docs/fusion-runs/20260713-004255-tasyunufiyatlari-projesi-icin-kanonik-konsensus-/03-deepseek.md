# DeepSeek V4 Pro

Durum: tamam  
Health-check: uyarı, ana görev yine denendi  
Süre: 249 sn  


Tüm verileri topladım. Şimdi kapsamlı hakem raporunu yazıyorum.

---

# Kanonik Konsensus — Fable Sprint Planı Hakem Raporu

**Tarih:** 2026-07-13  
**Hakem Model:** DeepSeek V4 Pro  
**Kapsam:** P0-P3 öncelikli zincir, Codex/Claude Fable 5 iş paylaşımı, R3/R4 kabul kriterleri, minimum test omurgası, ticari karar kapıları  
**Dayanak:** Güncel repo dosyaları + AGENTS.md + canlı audit bulguları — `docs/fusion-runs` raporları kanıt sayılmamıştır

---

## 1. SAHA DOĞRULAMASI — Her P0 maddesi için gerçek kod kanıtı

| # | P0 Maddesi | Audit İddiası | Kod Kanıtı | Sonuç |
|---|---|---|---|---|
| 1 | Rate limit yok | `/api/quotes` korumasız | `app/api/quotes/route.ts:65` — doğrudan `POST` handler, rate limit katmanı yok | **DOĞRULANDI** |
| 2 | kvkkConsent payload'da yok | Wizard + PDP kırık | `WizardCalculator.tsx:1239-1281` — `buildQuotePayload` return objesinde `kvkkConsent` alanı yok; `SingleProductQuoteButton.tsx` — dosyada `kvkkConsent` string'i hiç geçmiyor; `quote.schema.ts:104` — `apiQuoteSchema` bu alanı ZORUNLU tutuyor | **DOĞRULANDI** |
| 3 | PDP sahte başarı | DB hatası yutuluyor | `SingleProductQuoteButton.tsx:238` — `} catch { /* DB hatası PDF'i engellemez */ }` ve L243-244 — hatadan bağımsız `setSuccessState` çağrılıyor | **DOĞRULANDI** |
| 4 | WhatsApp /1.2 | ~%16.7 düşük fiyat | `WizardCalculator.tsx:1364-1365` — `grandTotal / 1.2` yorumu "KDV dahil" diyor; `PackageCard.tsx:33` — aynı `grandTotal`'ı `* 1.2` ile KDV dahile çeviriyor → grandTotal zaten KDV hariç | **DOĞRULANDI** |
| 5 | PII + marj log | Konsolda hassas veri | `WizardCalculator.tsx:1031-1042` — tüm fiyat zinciri + marj oranı; L655 — `payload: quotePayload` ile müşteri adı/telefon/eposta/adres | **DOĞRULANDI** |
| 6 | Test yok | 0 proje testi | Repoda `node_modules` dışında sıfır `*.test.*` dosyası | **DOĞRULANDI** |

### Ek P0-altı bulgular (audit memory'den doğrulandı)

| # | Konu | Durum |
|---|---|---|
| 7 | Auth'suz `/api/import` + `/api/products/bulk-insert` | `lib/supabase-server.ts:6` — `SUPABASE_SERVICE_ROLE_KEY` ile istemci oluşturuyor, admin auth kontrolü rotalarda yok |
| 8 | Public `quote-pdfs` bucket | Canlıda 97 nesne var (audit memory) — bucket policy kontrol edilmeli |
| 9 | Wizard eski `calcPricing` kullanıyor | `WizardCalculator.tsx` eski `calculatePackage` fonksiyonuyla çalışıyor; `lib/package-engine/calcPricing.ts`'teki `resolveShipping()` kullanılmıyor |
| 10 | URL `parseInt` 7.5cm → 7cm hatası | `ProductPricePanel.tsx:3-6` — TODO yorumu, düzeltilmemiş; `app/urun/[slug]/page.tsx` silinmiş (git: D) |
| 11 | Next 16.1.7 | `package.json:22` — zaten 16.1.7'de, yükseltme gerekmiyor ✅ |
| 12 | Koşulsuz "nakliye dahil" vaatleri | `whatsapp.ts:34` — `"(KDV hariç, nakliye dahil)"` her mesaja sabit yazılıyor, düşük metrajda bu yanlış |

---

## 2. TEKNİK KÖK NEDEN ANALİZİ

### 2.1 WhatsApp /1.2 — kök neden

**Zincir:** `PricingResult.grandTotalGross` (KDV dahil) → `PackageCard.totals.grandTotal` (KDV dahil olarak set ediliyor, `buildCards.ts:124`) → **AMA WizardCalculator.tsx** bu değeri ESKİ `CalculatedPackage.grandTotal` üzerinden alıyor. Eski implementasyonda `grandTotal` KDV hariç (`PackageCard.tsx:33` bunu `* 1.2` ile çarpıyor).

WizardCalculator'taki yorum yanlış: `grandTotal` KDV dahil değil, KDV hariç. `/ 1.2` yaparak zaten KDV'siz değeri bir kez daha bölüyoruz → **müşteriye ~%16.7 düşük fiyat**.

**Kök neden:** İki farklı `CalculatedPackage`/`PackageCard` tipinin `grandTotal` semantiği belirsiz. Eski tip KDV hariç, yeni engine tipi KDV dahil. Wizard eski tip üzerinden çalışıyor.

### 2.2 kvkkConsent — kök neden

**Zincir:** `apiQuoteSchema` L104 → `kvkkConsent: z.boolean().refine(val => val === true)`  
`buildQuotePayload` L1239-1281 → return objesinde `kvkkConsent` alanı yok  
`SingleProductQuoteButton` → tüm dosyada `kvkkConsent` string'i geçmiyor

**Sonuç:** Her iki akışta da (wizard PDF, wizard WhatsApp, PDP PDF) API'ye giden JSON'da `kvkkConsent` yok → Zod 400 hatası → **üç teklif yolu da kırık**.

### 2.3 PDP sahte başarı — kök neden

`SingleProductQuoteButton.tsx:238`: `} catch { /* DB hatası PDF'i engellemez */ }` — DB insert hatası yutuluyor. Hemen ardından L243-244'te success state set ediliyor. Kullanıcı "Talep sisteme kaydedildi" görüyor ama kayıt yok.

### 2.4 PII log — kök neden

Geliştirme sırasında konulan debug `console.log`'ları temizlenmemiş. L1031-1042'de tüm fiyat zinciri (marj oranı dahil) ve L655'te müşteri PII'si konsola yazılıyor.

---

## 3. HIZLI DÜZELTME vs KALICI MİMARİ ÖNERİ

| Sorun | Hızlı Düzeltme | Kalıcı Mimari Öneri |
|---|---|---|
| /1.2 | WizardCalculator L1364-1365: `grandTotal / 1.2` → `grandTotal` (bölme yapma) | `QuoteContext.totalKdvHaric` → `totalKdvDahil` olarak yeniden adlandır; WhatsApp formatına KDV dahil fiyatı yaz. `generateQuoteWhatsAppMessage` fonksiyonu KDV dönüşümü yapmasın, çağıran taraf doğru değeri geçsin. |
| kvkkConsent | `buildQuotePayload` return'üne `kvkkConsent: true` ekle (wizard); SingleProductQuoteButton payload'ına `kvkkConsent: true` ekle | API seviyesinde Zod `.default(true)` yerine client'tan gelen değeri doğrula. Form checkbox'ı gerçekten işaretlenmeden gönderilemesin. |
| Sahte başarı | L238 catch içinde `setSuccessState` çağrısını engelle, hata durumunda hata state'i göster | `quoteRes.ok` kontrolünü successState'ten ÖNCE yap; DB hatası durumunda "Teklif kaydı başarısız oldu, lütfen tekrar deneyin" göster |
| PII log | L1031-1042 ve L655'teki `console.log`/`console.error` satırlarını sil veya `if (process.env.NODE_ENV === 'development')` ile sar | Tüm projede `console.log` grep'i yap; PII içeren tüm log'ları temizle. Sentry'de PII redaksiyonunu yapılandır. |
| Rate limit | `/api/quotes` route'una `lru-cache` ile IP + telefon bazlı 5 dk window | API gateway seviyesinde (Vercel Edge + Upstash Redis) rate limit; `x-forwarded-for` + telefon hash ile idempotency key |

---

## 4. DOSYA BAZLI PATCH PLANI — Codex / Claude Fable 5 İş Paylaşımı

**Temel kural:** Tek release, sıralı zincir. Ancak aynı dosyaya dokunmayan işler paralel yürütülebilir.

### Codex (Backend/Engine odaklı — 3 dosya)

| Sıra | Dosya | Değişiklik | Tahmini Süre |
|---|---|---|---|
| C1 | `app/api/quotes/route.ts` | Rate limit (IP + telefon hash, 5 dk window, max 3 istek), idempotency header kontrolü, telefon/IP dedupe (son 24 saat) | 45 dk |
| C2 | `components/wizard/WizardCalculator.tsx` | `buildQuotePayload` return'üne `kvkkConsent: true` ekle (L1239); WhatsApp `/1.2` düzeltmesi (L1364-1365: `grandTotal`'ı direkt kullan); PII console.log temizliği (L1031-1042 ve L655) | 30 dk |
| C3 | `lib/utils/whatsapp.ts` | `generateQuoteWhatsAppMessage` — nakliye durumunu parametre olarak al, `shippingMode !== 'included'` ise "(nakliye hariç)" yaz; mesaj formatındaki sabit "(KDV hariç, nakliye dahil)" ibaresini dinamik yap | 20 dk |

### Claude Fable 5 (Frontend/UI odaklı — 3 dosya)

| Sıra | Dosya | Değişiklik | Tahmini Süre |
|---|---|---|---|
| F1 | `components/catalog/SingleProductQuoteButton.tsx` | Payload'a `kvkkConsent: true` ekle (L165 civarı); sahte başarı düzeltmesi: L238 catch'i successState'i engellesin, hata toast'ı göster; L208-217 `quoteRes.ok` false ise success state'e geçme | 40 dk |
| F2 | `components/package/PackageCard.tsx` | Düşük metrajda `isShippingIncluded=false` olduğunda kartta "Nakliye alıcıya aittir" uyarısını belirgin göster; `m2PriceLabel` dinamik olsun | 20 dk |
| F3 | `components/catalog/ProductPricePanel.tsx` | PDP `Fiyat_Gosterildi` event tetikleme (viewport observer ile); `parseInt` → `parseFloat` kalınlık düzeltmesi (L3-6 TODO'sunu kapat) | 25 dk |

### Ortak — Test Omurgası (yeni dosyalar, çakışma yok)

| Sıra | Dosya | Değişiklik | Kim? |
|---|---|---|---|
| T1 | `__tests__/api/quotes.test.ts` | `/api/quotes` POST: başarılı, Zod 400 (kvkkConsent yok), rate limit 429, idempotency, telefon dup | Codex |
| T2 | `__tests__/whatsapp-message.test.ts` | `generateQuoteWhatsAppMessage`: tam TIR (nakliye dahil), düşük metraj (nakliye hariç uyarısı), /1.2 düzeltmesi sonrası fiyat doğruluğu | Codex |
| T3 | `__tests__/pdp-quote-button.test.tsx` | `SingleProductQuoteButton`: başarılı akış, DB hatası → başarı mesajı GÖSTERİLMEMELİ, kvkkConsent payload'da var mı | Claude |

**Dosya çakışması:** Yok. Codex ve Claude tamamen ayrı dosyalara yazıyor.

---

## 5. TİCARİ KARAR KAPILARI — Kullanıcıya Sorular

Bu soruların cevabı implementasyon detayını değiştirir. Sprint başlamadan önce yanıtlanmalı.

### Kapı 1: Düşük metraj nakliye politikası
> "Tam kamyon altı siparişte nakliye alıcıya ait. Müşteriye hangi metrajın altında uyarı gösterilsin? Taşyünü için __ m², EPS için __ m²?"

**Mevcut durum:** `lib/package-engine/constants.ts` içinde `TASYUNU_LOW_METRAGE_M2` ve `EPS_LOW_METRAGE_M2` tanımlı olmalı. Bu değerler ne? Kamyon kapasitesi mi yoksa keyfi eşik mi?

### Kapı 2: Parsiyel nakliye fiyatlandırması
> "Düşük metraj siparişte nakliye ücretini sistem hesaplasın mı, yoksa 'iletişime geçin' yönlendirmesi yeterli mi? Hesaplanacaksa hangi km başına ücret veya sabit bölge tarifesi kullanılsın?"

**Mevcut durum:** `resolveShipping()` düşük metrajda `shippingCost=null` dönüyor. `base_shipping_cost` sadece tam araç dolumunda kullanılıyor.

### Kapı 3: WhatsApp mesaj formatı
> "WhatsApp mesajında KDV dahil fiyat mı, KDV hariç fiyat mı gösterilsin? Mevcut mesajda 'KDV hariç' yazıyor. Müşterinin KDV'yi sonradan öğrenip şaşırmasını engellemek için KDV dahil göstermek ister misiniz?"

**AGENTS.md kuralı:** "UI'da her zaman 'KDV hariç' etiketi zorunlu" — ama WhatsApp bir UI değil, satış mesajı. Ticari karar.

### Kapı 4: Rate limit eşiği
> "Aynı IP/telefondan 5 dakikada kaç teklif gönderilebilsin? 3 mü, 5 mi?"

### Kapı 5: `shippingCost=0` anlamı
> **Kesin ticari kural (zaten mutabık):** Tam kamyon veya tam TIR siparişinde nakliye satış fiyatına dahildir. `shippingCost=0` tek başına "kayıp" değil, "dahil" anlamındadır. Düşük metrajda `shippingCost=null` + uyarı zorunludur.  
> **Teyit sorusu:** Bu kuralın istisnası var mı? (Örn: Bazı şehirler tam araçta bile ek nakliye ücreti isteyebilir mi?)

---

## 6. R3/R4 KABUL KRİTERLERİ

### R3 (Sprint Release — P0 Paketi)

| ID | Kriter | Doğrulama Yöntemi |
|---|---|---|
| R3.1 | `/api/quotes` aynı IP'den 5 dk içinde 4. istek → HTTP 429 | `curl` ile art arda 4 POST |
| R3.2 | `kvkkConsent: false` → API 400, hata mesajında "KVKK" geçmeli | `curl` ile `kvkkConsent: false` body |
| R3.3 | Wizard + PDP tüm akışlarda `kvkkConsent: true` payload'da var → API 200 | Playwright: wizard PDF + WhatsApp, PDP PDF |
| R3.4 | WhatsApp mesajında `/1.2` bölmesi yok, fiyat doğru | `generateQuoteWhatsAppMessage` çıktısını manuel hesapla |
| R3.5 | PDP quote DB hatası → başarı mesajı GÖSTERİLMEZ, hata toast'ı GÖSTERİLİR | Playwright: DB'yi simüle et veya network intercept |
| R3.6 | Browser console'da PII (isim, telefon, eposta) veya marj oranı YOK | `console.log` grep + manuel kontrol |
| R3.7 | Düşük metraj (kamyon altı) → "Nakliye alıcıya aittir" uyarısı PDF + WhatsApp + UI kartta görünür | Playwright: 100 m² taşyünü senaryosu |

### R4 (Hardening Release — P1-P3)

| ID | Kriter |
|---|---|
| R4.1 | `/api/import` — `x-auth-user` header'ı olmadan 401 |
| R4.2 | `/api/products/bulk-insert` — auth kontrolü |
| R4.3 | `quote-pdfs` bucket — public access KAPALI, signed URL ile erişim |
| R4.4 | PDP sayfasında `Fiyat_Gosterildi` GA4 event'i tetikleniyor (visible + 2 sn) |
| R4.5 | 7.5cm kalınlık doğru parse ediliyor (parseFloat) |
| R4.6 | Koşulsuz "nakliye dahil" ifadesi kalmadı — tüm metinler "fiyata dahildir" veya "nakliye hariç" |
| R4.7 | Entegrasyon test paketi `npm test` ile geçiyor (minimum 6 test) |

---

## 7. MİNİMUM TEST OMBURGASI

```
__tests__/
├── api/
│   └── quotes.test.ts          # 4 test: başarılı, kvkk 400, rate limit 429, idempotency
├── lib/
│   └── whatsapp-message.test.ts # 3 test: tam TIR fiyat, düşük metraj uyarı, /1.2 sonrası doğruluk
├── components/
│   └── pdp-quote-button.test.tsx # 3 test: başarılı akış, DB hatası → hata state, kvkk payload'da
└── fixtures/
    └── quote-payloads.ts        # Test veri fabrikaları
```

**Araç:** Vitest + @testing-library/react + msw (API mock). Projede henüz test framework'ü yok; `package.json`'a eklenmesi gerekecek.

---

## 8. RİSKLER

| Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|
| **kvkkConsent fix'i mevcut canlı veriyi bozar** | Düşük | Yüksek | `apiQuoteSchema` zaten bu alanı zorunlu tutuyor — canlıda zaten kimse teklif gönderemiyor (3 yol kırık). Düzeltme kırık olanı tamir eder |
| **WhatsApp /1.2 fix'i mevcut müşteri fiyatlarını aniden yükseltir** | Kesin | Orta | Zaten hatalı düşük fiyat gösteriliyordu. Düzeltme gerçek fiyatı gösterir. Satış ekibine önceden haber verilmeli |
| **Rate limit meşru müşterileri engeller** | Orta | Yüksek | Window başına 3 istek cömert bir sınır. 5 dk'da 3 teklif normal kullanıcı için fazla. Monitor edilip ayarlanabilir |
| **İki ajan aynı anda test yazarsa çakışır** | Düşük | Düşük | Test dosyaları yeni oluşturulacak. Sıralı commit yeterli |
| **Package-engine Wizard'a bağlanırsa regression riski** | Yüksek | Yüksek | **Bu release'te YAPMA.** Mevcut eski hesaplamayı düzelt, yeni engine'e geçiş ayrı release |

---

## 9. ÖZET ZAMAN ÇİZELGESİ

| Aşama | İş | Süre | Sorumlu |
|---|---|---|---|
| 1 | Ticari karar kapıları yanıtlanır | — | Kullanıcı |
| 2.1 | `app/api/quotes/route.ts` rate limit + dedupe | 45 dk | Codex |
| 2.2 | `SingleProductQuoteButton.tsx` kvkk + sahte başarı | 40 dk | Claude F5 |
| 3.1 | `WizardCalculator.tsx` kvkk + /1.2 + PII log | 30 dk | Codex |
| 3.2 | `PackageCard.tsx` nakliye uyarısı | 20 dk | Claude F5 |
| 4.1 | `whatsapp.ts` dinamik nakliye mesajı | 20 dk | Codex |
| 4.2 | `ProductPricePanel.tsx` event + parseInt | 25 dk | Claude F5 |
| 5 | Test omurgası (6+ test) | 60 dk | Codex + Claude F5 |
| 6 | R3 kabul testleri (Playwright) | 30 dk | Ortak |
| 7 | Release + canlı doğrulama | 20 dk | Kullanıcı |

**Toplam paralel süre:** ~3 saat (Codex ve Claude F5 eşzamanlı).

---

**Hakem hükmü:** P0 zinciri gerçek ve acildir — her madde kodda bağımsız doğrulandı. Dosya çakışması olmayan iş bölümü yukarıda tanımlandı. Ticari karar kapıları yanıtlanmadan implementasyona başlanmamalı. `ShippingCost=0` kuralı açık: tam araçta dahil, düşük metrajda null + uyarı zorunlu.

Raporu kullanıcıya sunmadan önce başka bir şey kontrol etmemi istediğin bir nokta var mı?
