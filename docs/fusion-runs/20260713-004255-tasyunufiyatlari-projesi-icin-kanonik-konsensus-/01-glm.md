# GLM 5.2

Durum: tamam  
Health-check: uyarı, ana görev yine denendi  
Süre: 304 sn  


Yeterli veri topladım. AGENTS.md ile gerçek kod tabanını kıyasladım, geçmiş fusion-runs çıktılarını kanıt sayamam. Şimdi hakemlik raporunu yazıyorum.

---

# Kanonik-Konsensus-Fable-Sol Planı — Hakemlik Raporu (GLM 5.2)

## 0. Değerlendirme Çerçevesi

Bu rapor **güncel kod tabanına dayanır**. `docs/fusion-runs/` ve `docs/AUDITSFINAL/` çıktıları yalnızca geçmiş panel önerileri olarak okundu, kaynak kanıt olarak kullanılmadı. AGENTS.md ve gerçek dosyalar (calcPricing.ts, ProductPricePanel.tsx, SepetUI.tsx, SingleProductQuoteButton.tsx, proxy.ts, app/api/quotes/route.ts, lib/utils/whatsapp.ts, lib/schemas/pdfOffer.schema.ts) doğrudan incelendi.

Ticari kural teyidi: `shippingCost=0` tek başına kayıp değildir; tam dolu kamyon/TIR'da nakliye fiyata dahildir, düşük metrajda alıcıya aittir ve uyarı zorunludur. Bu rapor bu kurala sıkı bağlı kalır.

---

## 1. En Kritik Teşhisler

### 1.1 AGENTS.md'nin bazı teknik borç iddiaları güncelliğini yitirmiş

| AGENTS.md iddiası | Güncel durum | Kanıt |
|---|---|---|
| "app/page.tsx:45 FAQ kapora ifadesi yanlış" | **Geçersiz** — `kapora` kelimesi app/page.tsx içinde yok | grep kapora → eşleşme yok |
| "PDP'de Fiyat_Gosterildi event'i tetiklenmiyor" | **Geçersiz** — `notifyProductDetailPriceView` useEffect ile çağrılıyor | ProductPricePanel.tsx:350-374 |
| "quoteRes.ok kontrolü başarısızlıkları sessiz yutuyor" | **Doğru** ve planlandıandan kötü: hata log'lanıyor ama `successState` yine set ediliyor | SingleProductQuoteButton.tsx:208-244 |
| "calcPricing.ts daha temiz model sunuyor ama Wizard kullanmıyor" | **Doğru** — Wizard kendi local hesabını yapıyor, PDP de local `calcPrice` kullanıyor | WizardCalculator.tsx:143-190, ProductPricePanel.tsx:171-175 |
| "URL parsing ?kalinlik=7.5cm için parseInt" | **Teyit edilemedi** — app/urunler altında parseInt(thickness) eşleşmedi. Wizard'da `parseInt(selectedKalinlik)` var ama Wizard'da 7.5 cm seçeneği yok. Kullanıcı teyit etmeli. | grep `parseInt.*thickness` → eşleşme yok |

### 1.2 Test altyapısı sıfır

`package.json`'da vitest/jest/playwright yok. Sadece `eslint` mevcut. Hiç `*.test.ts` / `*.spec.ts` dosyası yok. Bu, R3/R4 kabul kriterlerini baştan kısıtlar. Plan P0 öncesi minimum omurga kurmayı şart koşmalı.

### 1.3 `/api/quotes` rate-limit yok

`/api/whatsapp-intent` IP+source rate-limit'li (60s/1). Ama **`/api/quotes` korumasız** — `proxy.ts` matcher'ında yok, route içinde limit yok. Rakip/scraper form spam yapabilir. AGENTS.md "Bilinen teknik borçlar" listesinde bu yok ama gerçek bir P0'dır.

### 1.4 WhatsApp mesajı koşulsuz "nakliye dahil" diyor — AGENTS.md kural ihlali

`lib/utils/whatsapp.ts:34` sabit:
```
`${ctx.pricePerM2.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺/m² (KDV hariç, nakliye dahil)`
```

AGENTS.md: *"Nakliye ücretsiz yazıyorsa yanına koşul yaz."* PDP'de `quoteShippingIncluded` sepetsiz/ara-metrajda `false` olsa bile mesaj aynı gidiyor. **Low-metraj müşteriye yanlış vaat** — hukuki risk. Bu mesaj her iki çağrı yerinde de (PDP ve Wizard) aynı içerikle kullanılıyor; çağıran `ctx`'i zenginleştirmek şart.

### 1.5 SingleProductQuoteButton sessiz başarı üretiyor

`SingleProductQuoteButton.tsx`: `quoteRes.ok` false olsa bile akış `finally`'e düşmeden `setSuccessState({...})`'i çağırıyor (satır 244). Müşteriye "Teklifiniz hazır / Talep sisteme kaydedildi" gösteriliyor ama DB kaydı başarısız. `console.error` var, kullanıcı feedback'i yok. Bu P0'dır çünkü müşteri yanlış güven hissediyor.

### 1.6 PDP + Wizard ortak motor kullanmıyor

`ProductPricePanel.tsx:171-175` `calcPrice` lokal; `WizardCalculator` kendi hesabını yapıyor; `lib/package-engine/calcPricing.ts` kullanılmıyor. Marj sabiti `PROFIT_MARGIN = 0.1` PDP'ye gömülü (satır 59). Wizard tarafında ayrı. Aynı ürün-şehir-kalınlık-metraj kombinasyonu iki yerde farklı sonuç verebilir. Audit/şikayet kanalı riski.

### 1.7 SepetUI `scenario` dependency bug

`SepetUI.tsx:213` useEffect imzasında `scenario` kullanılıyor ama `225` bağımlılık dizisinde yok. Senaryo değişince `onChange` tetiklenmeyebilir; bu `ProductPricePanel`'in `sepetState.scenario` değerini eski tutar. Küçük ama gerçek bug.

### 1.8 Phone regex TR-only

`pdfOffer.schema.ts:41` `^05\d{9}$`. Yurtdışı telefonu reddediyor. Son commit "uluslararası telefon validasyonu" diyor ama schema hala TR-only. **Teyit gerek**: son commit'in kapsamı neyi değiştirdi? Wizard QuoteModal eşdeğeri mi düzeltildi?

### 1.9 Mixed sepet server-side tier kontrolünden kaçıyor

`/api/quotes/route.ts:73-99` sadece `vehicleType === 'lorry' || 'truck'` için tier eligibility kontrol ediyor. `ProductPricePanel.tsx:269-274` karışık sepette `vehicleType = null` gönderiyor. Yani mixed senaryoda server-side minimum kontrolü atlanıyor. Doğru olabilir (blended fiyat zaten correct) ama kullanıcı teyit etmeli.

### 1.10 calcPricing.ts'te Optimix levha iskontosu placeholder

`calcPricing.ts:274-277` `checkOptimixPlate` her zaman `false` döner, TODO yorumu var. Bu engine şu an kullanılmadığı için müşteriye etkisi yok ama refactor sonrası P1/P2'de çözülmezse fiyat sapması yaratır.

---

## 2. Dosya Bazlı Uygulanabilir Plan

İş paylaşımı **dosya sahipliğiyle** ayrılır. Aynı dosyada iki ajan aynı iterasyonda çalışmaz. Pair dosyalar (engine vs consumer) farklı iterasyonlara kaydırılır.

### P0 — Hafta 1 (Ticari/hukuki/doğruluk riski)

| ID | Dosya | Sorumlu | İşlem | Test |
|---|---|---|---|---|
| **P0-1** | `lib/utils/whatsapp.ts` + `QuoteContext` | Claude | `(KDV hariç, nakliye dahil)` ifadesini kaldır. `ctx.isShippingIncluded: boolean` ekle. true ise "fiyata dahildir (tam dolu araç)", false ise "nakliye satış ekibiyle netleşir" metni üretilsin. | unit: ctx.isShippingIncluded=false → "nakliye dahil" string YOK |
| **P0-2** | `app/api/quotes/route.ts` | Codex | IP + phone bazlı rate-limit: IP/dk=5, phone/saat=3. 429 döner. Memory map (Vercel ephemeral yeterli, kalıcı gerekmiyorsa Upstash opsiyonel). | unit: 6. istek → 429; phone farklı → 200 |
| **P0-3** | `components/catalog/SingleProductQuoteButton.tsx` | Codex | `quoteRes.ok=false` durumunda `successState` set etme. Hata state'i göster ("Teklif kaydında sorun oluştu, lütfen WhatsApp'tan ulaşın"). PDF yine açılsın (blob elimizde). | unit: quoteRes.ok=false → errorState set, successState null |
| **P0-4** | `components/catalog/ProductPricePanel.tsx` + `components/catalog/SepetUI.tsx` + `lib/utils/whatsapp.ts` çağrı yeri | Claude (UI/state) + Codex (PDF generator parametre) | SepetUI scenario `ara_metraj` / `below_minimum` / `empty` için panelde "nakliye alıcıya aittir" uyarısı göster. `quoteShippingIncluded`'u zaten hesaplıyor (satır 292-294); bunu `QuoteContext.isShippingIncluded`'a ve PDF generator'a aktar. | unit: scenario=below_minimum → uyarı render; PDP WhatsApp link ctx.isShippingIncluded=false |
| **P0-5** | `lib/package-engine/calcPricing.ts` + `components/catalog/ProductPricePanel.tsx` | Codex (engine) | `PROFIT_MARGIN` ve iskonto zincirini `lib/package-engine/constants.ts`'e taşı. PDP `calcPrice`'ı engine üzerinden çağırır hale getir (en azından plate için). | unit: PDP calcPrice(engine) vs Wizard(engine) → aynı girdi aynı çıktı |

### P1 — Hafta 2 (Tutarlılık/erken borç)

| ID | Dosya | Sorumlu | İşlem |
|---|---|---|---|
| **P1-1** | `components/catalog/SepetUI.tsx` | Codex | `useEffect` bağımlılık dizisine `scenario` ekle (satır 225). |
| **P1-2** | `lib/package-engine/calcPricing.ts` | Codex | `checkOptimixPlate`'i gerçek implementasyona geçir; recipe parametresi `resolveShipping`'e iletilsin. |
| **P1-3** | `lib/schemas/pdfOffer.schema.ts` + `lib/schemas/quote.schema.ts` | Codex | `phone` regex'i uluslararası destekli hale getir: `^\+?[1-9]\d{7,14}$` (E.164). Hata mesajı "ülke koduyla girin (örn: +90532… veya +49151…)" |
| **P1-4** | `app/urunler/[kategori]/[slug]/page.tsx` (kullanıcı teyitli) | Claude | Eğer `parseInt` 7.5 → 7 bug gerçekten varsa: `parseFloat` veya `'7-5'` segment formatına geçiş. Kullanıcı teyiti şart (grep ile eşleşmedi). |

### P2 — Hafta 3 (CRO/test omurgası)

| ID | Dosya | Sorumlu | İşlem |
|---|---|---|---|
| **P2-1** | `package.json` + `vitest.config.ts` (yeni) + `lib/package-engine/__tests__/calcPricing.test.ts` (yeni) + `lib/utils/__tests__/whatsapp.test.ts` (yeni) + `lib/schemas/__tests__/pdfOffer.test.ts` (yeni) | Codex | Vitest kur; 3 kritik unit test paketi: calcPricing (low-metrage null, full-vehicle discount zinciri), whatsapp message (isShippingIncluded koşullu), pdfOffer schema (E.164 phone, kvkkConsent). |
| **P2-2** | `components/wizard/WizardCalculator.tsx` | Codex | Wizard hesabını calcPricing engine'e taşı. Kademeli: önce plate slot, sonra accessory. |
| **P2-3** | `components/catalog/ProductPricePanel.tsx` + `components/catalog/SepetUI.tsx` | Claude | Mobile sticky CTA + sepet `scenario` geçişlerini Playwright smoke test (e2e). |

### P3 — Uzun vade (plan sınırları dışında)

- Calcengine'i server-side API'ye taşıyıp PDP ve Wizard fetch etsin.
- A/B altyapısı (KVKK uyumlu).
- Optimix marka eşleme tablosu DB'ye taşın.

### İş Paylaşımı Özeti (aynı iterasyonda çakışmaz)

| Ajan | Sahip olduğu dosyalar |
|---|---|
| **Codex** | `lib/package-engine/*`, `lib/schemas/*`, `app/api/quotes/route.ts`, `components/catalog/SingleProductQuoteButton.tsx`, `components/catalog/SepetUI.tsx` (P1-1), `components/wizard/WizardCalculator.tsx` (P2-2), test omurgası |
| **Claude** | `lib/utils/whatsapp.ts`, `components/catalog/ProductPricePanel.tsx` (UI/state), `components/modal/*`, `app/urunler/[kategori]/[slug]/page.tsx` (P1-4) |
| **Pair** | P0-4'te WhatsApp mesaj değişimi Codex'in PDF generator çağrısını da etkiler. **Sıralama**: Claude `QuoteContext.isShippingIncluded` ekler → Codex PDF generator parametre bağlar. İki adım, farklı dosyalar, çakışma yok. |

---

## 3. Riskler

| Risk | Etki | Azaltma |
|---|---|---|
| Test omurgası kurulmadan P0 patch'leri merge edilirse gerileme yakalanamaz | Yüksek | P0-1 → P0-5 sonrası **P2-1 test omurga zorunlu**. P0 patch'leri için manuel smoke yeterli; kalıcı regressyon P2'de yakalanır. |
| `calcPricing` engine refactor'u PDP-Wizard farkını ortaya çıkarır | Orta | Engine değişikliği **output diff testi** gerektirir: aynı girdilerle iki implementasyonun sonuçları = %0.01'e kadar aynı olmalı. |
| Rate-limit memory map Vercel serverless'ta cold-start ile sıfırlanır | Düşük | Upstash Redis opsiyonel; ilk adımda ephemeral kabul edilebilir, P2'de Upstash'e taşı. |
| WhatsApp mesajından "nakliye dahil" kaldırılırsa **dönüşüm düşebilir** (test edilmiş metin) | Orta-Yüksek | CRO hipotezi olarak ölç: 2 hafta A/B, "fiyata dahildir (tam dolu araç)" vs "nakliye satış ekibiyle netleşir". |
| Phone regex E.164'e geçiş mevcut TR-only kayıtları bozar | Düşük | DB'deki mevcut `05XXXXXXXXx` numaralar normalize unsur (baştaki 0 → +90). Migration script P1-3'ün parçası. |
| Mixed sepet (TIR+Kamyon) server-side tier kontrolü atlanıyor | Düşük | P0-4 sonrası `quoteShippingIncluded` ile birlikte tier eligibility'yi mixed için de tanımla. |

---

## 4. Kabul Kriterleri (R3/R4) — Minimum Test Omurgası

### R3 — Derleme/Statik (her patch'te)

- `npm run lint` → sıfır hata, sıfır uyarı (mevcut baseline)
- `npx tsc --noEmit` → sıfır hata
- `npm run build` → başarılı (Vercel preview deploy)

### R4 — Doğruluk/Gözlemlenebilirlik

**P0 patch'leri için** (test omurgası yokken, manuel smoke):
- PDP 806 m² tam kamyon (lorry_optimal): "nakliye fiyata dahildir" etiketi görünür, WhatsApp mesajında "fiyata dahildir (tam dolu araç)"
- PDP 50 m² ara-metraj (ara_metraj): CTA disabled veya uyarı kutusunda "nakliye alıcıya aittir"
- PDP below_minimum: uyarı render, WhatsApp mesajında "nakliye dahil" YOK
- /api/quotes 6. istek (IP) → 429
- SingleProductQuoteButton DB hatası simülasyonu (route 500 dön) → errorState, successState YOK

**P2-1 sonrası** (test omurgası kurulunca):
- `npm test` → en az 3 paket yeşil (calcPricing, whatsapp, pdfOffer schema)
- `npx playwright test` → PDP smoke (2 senaryo: full-vehicle, low-metrage)

### Tanım: "P0 tamamlandı"

1. 5 P0 patch'i merge edildi (lint+build temiz).
2. Manuel smoke test yukarıdaki 5 senaryoyu geçti.
3. WhatsApp mesajında "nakliye dahil" ifadesi yok, koşullu metin var.
4. `proxy.ts` veya `/api/quotes` rate-limit aktif (Vercel loglarında 429 teyit).

---

## 5. Ticari Karar Kapıları (Kullanıcıya Sorular)

AGENTS.md cevabı çok net olanlar hariç, aşağıdakiler **kullanıcı teyidi gerekli** karar kapılarıdır. Sade Türkçe sorular:

1. **WhatsApp mesajı nakliye ifadesi** — Şu an koşulsuz "nakliye dahil" yazıyor. Üç seçenek:
   - (a) Tamamen kaldır, sadece "KDV hariç" yaz
   - (b) Tam dolu araç siparişinde "fiyata dahildir (tam dolu araç)", diğer durumda "nakliye satış ekibiyle netleşir" — **önerilen**
   - (c) Hiç dokunma (mevcut davranış)

2. **Hesap motoru birleştirme** — PDP'de `PROFIT_MARGIN = 0.1` sabit, Wizard kendi hesabını yapıyor, `calcPricing.ts` kullanılmıyor. Bu marjı ortak `lib/package-engine/constants.ts`'e taşıyalım mı, PDP local hesabı kalsın mı?

3. **Mixed sepet (TIR+Kamyon)** — Server-side tier kontrolü atlanıyor. Onaylı mısın (blended fiyat correct), yoksa mixed için de minimum kontrol ekleyelim mi?

4. **Telefon regex** — TR-only (`05XXXXXXXXX`). Yurtdışı sipariş kabul edecek miyiz? E.164 (`+90 5XX…` veya `+49 1XX…`) geçişini onaylıyor musun?

5. **Rate-limit eşikleri** — `/api/quotes` için: IP başına dakikada 5 istek, telefon başına saatte 3 teklif — kabul ediyor musun? Veya farklı eşik tercih eder misin?

6. **`?kalinlik=7.5cm` parse hatası** — AGENTS.md'de var ama güncel kodda bulamadım. Bu hala bir sorun mu, yoksa çözüldü mü? Teyit eder misin?

7. **Test omurgası önceliği** — P0 patch'leri için manuel smoke yeterli, yoksa hiçbir P0 patch'i merge edilmeden önce vitest kurulumunu mu istersin?

---

## 6. Kapanış Notu

Planın temel eksiklikleri: (1) test omurgası yokluğu R3/R4'ü zayıflatıyor, (2) AGENTS.md iddialarının bir kısmı güncel değil, (3) WhatsApp mesajı kural ihlali P0 ama panel raporlarında yeterince vurgulanmadı. Plan uygulanabilir ama P0 öncesi **sorular 1-7'nin cevabı** ve **P2-1 test omurgasının sıralaması** kullanıcı tarafından belirlenmeli.

Kod yazılmadı, dosya değiştirilmedi; yalnızca plan/hakemlik üretildi.
