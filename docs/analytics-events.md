# Analytics & Bildirim Sistemi

Bu doküman sitedeki tüm GA4 event'lerini, CallMeBot bildirimlerini ve nerede tetiklendiklerini özetler. Yeni event eklerken veya pazarlama/SEO ölçüm yaparken referans olarak kullanılır.

> **Son güncelleme:** 2026-05-01

---

## Mimari Özet

İki paralel kanal birlikte çalışır; her ikisi de aynı kullanıcı eylemini farklı amaçla işler.

```
KULLANICI EYLEMİ
        │
        ├──► CLIENT (gtag) ──► GA4
        │     • Davranışsal analitik (funnel, kohort, dashboard)
        │     • Kişisel veri yok (KVKK Consent Mode v2 default deny)
        │     • Cookie banner onayı sonrası tam veri
        │
        └──► SERVER (CallMeBot) ──► WhatsApp
              • Anlık operasyonel bildirim (Emrah + Muhammet abi)
              • Müşteri kim, hangi ürün, kaç m², kaç ₺
              • Rate limit: 60s aynı IP+source (whatsapp_intent için)
```

İkisi farklı sistemler için tasarlanır; biri bilgi toplama (GA4), diğeri operasyonel hız (CallMeBot). Çift bildirim üretmezler — quote insert sonrası sadece **bir kez** CallMeBot tetiklenir, GA4 event'i ek client-side sinyal verir.

---

## GA4 Event Listesi

### 1. `Whatsapp_Yazanlar`

**Tetik:** Sayfa içinde herhangi bir WhatsApp linkine (`wa.me/...`) tıklama.

**Helper:** [`lib/notifyWhatsappIntent.ts`](../lib/notifyWhatsappIntent.ts) → `notifyWhatsappIntent({ source })`

**Tetik noktaları (5 source):**

| Source | Konum |
|---|---|
| `header_mobile` | SiteHeader mobile drawer "WhatsApp" butonu |
| `footer_link` | SiteFooter "WhatsApp Destek" link |
| `iletisim_card` | `/iletisim` sayfası WhatsApp kartı |
| `depomuz_cta` | `/depomuz` "WhatsApp ile Yazışın" CTA |
| `product_detail_cta` | Ürün detay sayfası WhatsApp + Stok Alternatif sekmesi |

**Parametreler:**

| Param | Örnek | Açıklama |
|---|---|---|
| `source` | `header_mobile` | Hangi UI bileşeninden tıklandı |
| `page_path` | `/urunler/eps-levha/...` | Sayfa yolu |
| `product_name` | `Optimix Karbonlu` | Ürün detay'dan tıklandıysa |

**CallMeBot bildirimi:** ✅ Var — server-side `/api/whatsapp-intent` route + `lib/notifications.ts` zinciri. Rate-limit 60 saniye aynı IP+source.

---

### 2. `Telefon_Aramalari`

**Tetik:** Sayfa içinde herhangi bir `tel:` linkine tıklama.

**Helper:** [`lib/notifyPhoneCall.ts`](../lib/notifyPhoneCall.ts) → `notifyPhoneCall({ source })`

**Tetik noktaları (5 source):**

| Source | Konum |
|---|---|
| `header_mobile` | SiteHeader mobile drawer "Ara" butonu |
| `iletisim_phone` | `/iletisim` Telefon kartı + "Hemen Ara" butonu |
| `depomuz_phone` | `/depomuz` telefon row'u |
| `kvkk_phone` | `/kvkk` başvuru kartı |
| `topbar_phone` | (rezerve) Hub TrustStrip telefon — şu an aktif değil |

**Parametreler:** `source`, `page_path`, opsiyonel `product_name`

**CallMeBot bildirimi:** ❌ Yok. Telefon zaten çalacak; tıklama ≠ arama olduğu için spam koruması.

---

### 3. `Fiyat_Gosterildi`

**Tetik:** Wizard 4 step (Malzeme → Kalınlık → Konum → Metraj) tamamlanıp **"Fiyatları Göster"** butonuna basıldığında, hesaplanmış paketler ekrana geldiğinde.

**Helper:** [`lib/notifyWizardEvent.ts`](../lib/notifyWizardEvent.ts) → `notifyWizardShowPrices({...})`

**Tetik noktası:** `components/wizard/WizardCalculator.tsx` → `handleShowPrices` fonksiyonunun sonu

**Parametreler:**

| Param | Örnek | Açıklama |
|---|---|---|
| `material_type` | `tasyunu` / `eps` | Hangi ürün grubu |
| `brand_name` | `Dalmaçyalı`, `Expert`, `Optimix`, `TEKNO`, `OEM` | Seçilen marka |
| `model_name` | `SW035`, `HD150`, `EPS Karbonlu` | Model (varsa) |
| `thickness_cm` | `5` | Kalınlık |
| `city_code` | `34` | İl kodu |
| `city_name` | `İstanbul` | İl adı |
| `area_m2` | `320` | Kullanıcının girdiği metraj |
| `total_m2` | `324.5` | Paket sayısına yuvarlanmış metraj |
| `package_count` | `90` | Ana levha paket adedi |
| `results_count` | `3` | Hesaplanan tier sayısı |
| `cheapest_total` | `45000` | En ucuz paketin toplam ₺ |
| `cheapest_per_m2` | `138.46` | En ucuz m² fiyatı |
| `special_order_required` | `false` | ≥10.000 m² özel teklif (taşyünü) |
| `page_path` | `/` | Sayfa yolu |

**CallMeBot bildirimi:** ❌ Yok. Her wizard çalışması için bildirim spam'a dönüşür.

**Funnel anlamı:** Bu event kullanıcı niyetinin en güçlü sinyali. Sonrasında `Pdf_Teklif_Talebi` veya `Whatsapp_Siparis` gelmezse → **abandoned lead**, retargeting / form kısaltma için odak.

---

### 4. `Pdf_Teklif_Talebi`

**Tetik:** Wizard'dan paket seçildikten sonra "PDF Teklifimi Oluştur" formu submit edilince (server-side `/api/quotes` insert başarılı + PDF üretildi).

**Helper:** `lib/notifyWizardEvent.ts` → `notifyPdfQuoteRequested({...})`

**Tetik noktası:** `components/wizard/WizardCalculator.tsx` → `handleSubmitPdfOffer` (line ~480)

**Parametreler:** `Fiyat_Gosterildi`'deki tüm temel alanlar (`material_type`, `brand_name`, `thickness_cm`, `city_*`, `area_m2`, `total_m2`, `package_count`) + ek:

| Param | Örnek | Açıklama |
|---|---|---|
| `selected_package_name` | `Orijinal Sistem` / `Dengeli Sistem` / `Ekonomik Sistem` | Müşteri hangi tier'ı seçti |
| `selected_package_total` | `45230.50` | Seçilen paketin toplam ₺ |
| `selected_per_m2` | `139.50` | ₺/m² |
| `ref_code` | `TY1234567` | Quote DB referans kodu (DB'de aynı kodla quote insert edilmiş) |
| `customer_type` | `company` / `individual` | Form'da firma adı doldurduysa company |

**CallMeBot bildirimi:** ✅ Var — `/api/quotes` POST sonrası `sendNotification('package_pdf_quote', ...)`. Müşteri adı, telefon, paket, metraj, şehir, fiyat WhatsApp'a düşer.

---

### 5. `Whatsapp_Siparis`

**Tetik:** Wizard'dan paket seçildikten sonra "WhatsApp Sipariş" formu submit edilince (server-side quote insert + WhatsApp pencere açıldı).

**Helper:** `lib/notifyWizardEvent.ts` → `notifyWhatsappOrderRequested({...})`

**Tetik noktası:** `components/wizard/WizardCalculator.tsx` → `handleSubmitQuote` (line ~1043)

**Parametreler:** `Pdf_Teklif_Talebi` ile aynı (sadece `customer_type` yok).

**CallMeBot bildirimi:** ✅ Var — `sendNotification('package_whatsapp_order', ...)`.

> **Not — `Whatsapp_Yazanlar` ile farkı:**
> - `Whatsapp_Yazanlar` = sayfa içinde sıradan WA linkine tıklama (ürün/sayfa kontekstli ama form yok)
> - `Whatsapp_Siparis` = wizard formu submit edildi, paket ve fiyat seçilmiş, ref_code üretilmiş

---

## Funnel Analizi

GA4 Explore → Funnel Exploration:

```
Step 1: Fiyat_Gosterildi               ← Wizard'da fiyat ekranı görüldü
   │
   ├── Step 2A: Pdf_Teklif_Talebi      ← PDF teklif formu submit
   └── Step 2B: Whatsapp_Siparis       ← WhatsApp sipariş formu submit
```

**Conversion oranı:** `(Pdf + WA) / Fiyat_Gosterildi`
**Abandoned oranı:** 1 − Conversion

İkisi arasında `selected_package_name` + `area_m2` korunduğu için segmentation yapılabilir:
- Hangi şehirden kullanıcılar daha çok terk ediyor?
- Hangi marka × kalınlık kombinasyonu daha yüksek conversion?
- ≥10.000 m² (special_order) trafiğin oranı nedir?

---

## CallMeBot Bildirimleri (Server-Side)

### Kanal etiketleri

[`lib/notifications.ts`](../lib/notifications.ts) — `LeadEventType`:

| Event | Mesaj başlığı | Tetik noktası |
|---|---|---|
| `package_pdf_quote` | Mantolama Seti PDF Teklifi | `/api/quotes` POST (Wizard PDF) |
| `package_whatsapp_order` | Mantolama Seti WhatsApp Sipariş | `/api/quotes` POST (Wizard WA) |
| `single_product_pdf` | Tekil Levha PDF Teklifi | `/api/quotes` POST (ürün detay PDF) |
| `single_product_whatsapp` | Tekil Levha WhatsApp | `/api/quotes` POST (ürün detay WA) |
| `whatsapp_intent` | WhatsApp Niyet (form yok) | `/api/whatsapp-intent` POST |
| `catalog_whatsapp` | Katalog WhatsApp | (rezerve, henüz çağrılmıyor) |

### .env değişkenleri

```
CALLMEBOT_PHONE_2=905426084887      # Muhammet abi (opsiyonel)
CALLMEBOT_APIKEY_2=XXXXXXX
```

> **Önemli:** Köşeli parantez `<…>` veya tırnak yapıştırılırsa otomatik temizlenir (`cleanEnv()` helper). Ama yine de saf değer girmek tercih edilir.

### Rate limit

- `whatsapp_intent` — 60 saniye / IP+source (memory cache, Vercel cold start'ta sıfırlanır)
- Diğer event'ler için server-side limit yok; CallMeBot'un kendi 5 mesaj/saat free tier limiti devreye girer.

### Bot filtresi

`/api/whatsapp-intent` route'unda `User-Agent` regex (`bot|crawl|spider|scrape|headless`) bot tespit eder, sessiz drop.

---

## KVKK & Cookie Consent

### Default davranış (cookie banner onayı YOK iken)

- GA4 yüklenir ama **Consent Mode v2 default deny**:
  - `analytics_storage: 'denied'`
  - `ad_storage: 'denied'`
  - `ad_user_data: 'denied'`
  - `ad_personalization: 'denied'`
- Bu durumda GA4 sadece **anonim cookieless ping** atar — kişisel veri saklanmaz, ortalama trafik şekli görünür ama **funnel attribution bozuk** olur.

### Consent verildiğinde

[`components/analytics/CookieConsent.tsx`](../components/analytics/CookieConsent.tsx) "Tümünü Kabul Et" butonu:

```ts
window.gtag('consent', 'update', {
  analytics_storage: 'granted',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
});
```

Tercih `localStorage.cookie-consent-v1` anahtarına kaydedilir; sonraki ziyaretlerde otomatik replay edilir.

### Cookie Banner reddedildiğinde

Default deny korunur. Cookieless ping devam eder. Müşteri verisi GA4'e işlemez.

---

## GA4 Dashboard Kurulum Önerileri

Production'a ilk veri akmaya başladıktan **24 saat** sonra:

### 1. Custom Dimensions (Yönetici → Veri Görüntüleme → Custom Definitions)

Tüm event-scoped olarak işaretle:

| Boyut adı | Parametre | Anlam |
|---|---|---|
| Marka | `brand_name` | Hangi marka tercih ediliyor |
| Şehir | `city_name` | Coğrafi dağılım |
| Malzeme | `material_type` | Taşyünü vs EPS oranı |
| Kalınlık | `thickness_cm` | Hangi kalınlık popüler |
| Kanal | `source` | WhatsApp/Telefon click kaynak |
| Paket Tier | `selected_package_name` | Ekonomik/Dengeli/Orijinal seçimi |
| Müşteri Tipi | `customer_type` | Bireysel vs firma |
| Özel Teklif | `special_order_required` | ≥10.000 m² büyük proje |

### 2. Custom Metrics

| Metrik | Parametre | Birim |
|---|---|---|
| Talep edilen metraj | `area_m2` | m² (ortalama) |
| Yuvarlanmış metraj | `total_m2` | m² |
| Paket adedi | `package_count` | adet |
| Seçilen paket toplamı | `selected_package_total` | TRY (ortalama, toplam) |
| ₺/m² | `selected_per_m2` | TRY |

### 3. Conversion Event'leri

Yönetici → Events → Toggle "Mark as conversion":

- ✅ `Pdf_Teklif_Talebi` — birincil dönüşüm
- ✅ `Whatsapp_Siparis` — birincil dönüşüm
- 🔁 `Whatsapp_Yazanlar` — micro-conversion (intent)
- 🔁 `Telefon_Aramalari` — micro-conversion

### 4. Funnel Exploration

| Funnel | Step 1 | Step 2 | Anlam |
|---|---|---|---|
| **Wizard Conversion** | `Fiyat_Gosterildi` | `Pdf_Teklif_Talebi` OR `Whatsapp_Siparis` | Ana funnel |
| **Cross-channel intent** | Page view (kategori) | `Whatsapp_Yazanlar` OR `Telefon_Aramalari` | Form-dışı niyet |
| **Tier seçim analizi** | `Fiyat_Gosterildi` | `Pdf_Teklif_Talebi` filtered by `selected_package_name` | Hangi tier daha çok dönüşüyor |

### 5. Audience Segments (retargeting için)

- "Wizard fiyat görmüş ama teklif istememiş" → `Fiyat_Gosterildi` event'i var, `Pdf_Teklif_Talebi` ve `Whatsapp_Siparis` yok
- "Belirli marka tercih edenler" → `brand_name = X`
- "Büyük metraj kullanıcıları" → `area_m2 > 500`

---

## Yeni Event Eklerken

1. **Helper dosyası:** `lib/notify[Name]Event.ts` veya mevcut helper'a fonksiyon ekle
2. **GA4 event ismi:** Türkçe, `PascalCase_SnakeCase` formatı (örn. `Sepet_Olusturuldu`). Mevcut isimlerle çakışmasın.
3. **Parametre ekleme:** GA4 25 parametre/event limit. Tek seferde hepsini gönder; sonra dashboard'da Custom Dimension olarak işaretle.
4. **CallMeBot gerekli mi?** Operasyonel hızda fark yaratıyorsa (örn. yeni form submit'i) ekle. Tıklama-bazlı micro-event ise GA4 yeterli.
5. **Bu dosyayı güncelle.** Yeni event'i tablo satırı olarak ekle.

---

## Hata ayıklama

### GA4 event'i gelmiyor

1. **Production deploy mu?** GA4 sadece `NODE_ENV === 'production'`'da yüklenir ([app/layout.tsx](../app/layout.tsx))
2. **Cookie consent verildi mi?** Default deny modunda event'ler kısıtlı
3. **DevTools → Network → `collect`** request'lerine bak — gtag çağrıldıysa `g/collect?...` istekleri görünmeli
4. **Realtime → Events** GA4 dashboard — anlık görmek için (1-2 dakika gecikmeli)

### CallMeBot bildirim gelmiyor

1. **Vercel Function Logs** → `[sendNotification]` ve `[CallMeBot ...]` satırları
2. **Env değerleri** (Vercel Dashboard → Settings → Environment Variables) Production scope'unda mı?
3. **CallMeBot pre-registration**: WhatsApp'tan `+34 644 84 71 89` numarasına `I allow callmebot to send me messages` mesajı atılmış mı?
4. **API key formatı:** Köşeli parantez veya tırnak olmadan saf değer

---

## Dosya Referansları

| Dosya | Sorumluluk |
|---|---|
| `lib/notifyWhatsappIntent.ts` | WhatsApp click → `Whatsapp_Yazanlar` GA4 + `/api/whatsapp-intent` |
| `lib/notifyPhoneCall.ts` | Telefon click → `Telefon_Aramalari` GA4 |
| `lib/notifyWizardEvent.ts` | Wizard 3 event (Fiyat_Gosterildi, Pdf_Teklif_Talebi, Whatsapp_Siparis) |
| `lib/notifications.ts` | CallMeBot bildirim zinciri (server-side) |
| `lib/analytics/whatsappSource.ts` | WhatsApp + telefon source taksonomisi |
| `components/shared/WhatsappLink.tsx` | Server component'lerde WA link wrapper |
| `components/shared/PhoneCallLink.tsx` | Server component'lerde tel: link wrapper |
| `components/analytics/GoogleAnalytics.tsx` | GA4 + Consent Mode v2 yükleyici |
| `components/analytics/CookieConsent.tsx` | KVKK rıza banner |
| `app/api/whatsapp-intent/route.ts` | Server-side WA intent → CallMeBot |
| `app/api/quotes/route.ts` | Server-side quote insert + CallMeBot |
