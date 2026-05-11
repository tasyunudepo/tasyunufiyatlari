# Sprint 4-5 — Bölge Sayfaları Roadmap

**Hazırlık tarihi:** 2026-05-11
**Bağlam:** Sprint 0 / Faz 5'te `/bolge/*` rotaları geçici olarak kapatıldı (302 → `/iletisim`).
Sahte `MOCK_TRANSACTIONS` referansları temizlendi. Sprint 4-5 bu rotayı **gerçek içerikle**
yeniden açacak.

> **Neden 302 (geçici redirect)?** Sprint 4-5'te bölge sayfaları açılacak. 301 yapılsaydı
> Google ileride yeni içeriği indexlerken zorlanırdı (eski 301 kararı cache'lenmiş olur).
> 302 → "şimdilik /iletisim'e bak, ileride buranın gerçek içeriği gelecek" sinyali.

---

## Tier 1 — Yakın Depo Bölgeleri (Orhanlı'dan 1–2 saat)

Önceliği yüksek; sevkiyat avantajı en bariz, dönüşüm potansiyeli en yüksek bölgeler.

### İstanbul Anadolu Yakası

- [ ] Tuzla
- [ ] Pendik
- [ ] Kartal
- [ ] Maltepe
- [ ] Sancaktepe
- [ ] Sultanbeyli
- [ ] Çekmeköy
- [ ] Ümraniye
- [ ] Üsküdar
- [ ] Beykoz
- [ ] Şile
- [ ] Ağva
- [ ] Riva

### Kocaeli Yakını

- [ ] Gebze
- [ ] Çayırova
- [ ] Darıca
- [ ] Dilovası
- [ ] Körfez

---

## Tier 2 — Tarihsel Yoğun Talep Nişleri

Tier 1 kadar coğrafi olarak yakın değil, ama proje akışı / sezonluk talep sebebiyle
historically güçlü pazarlar.

### Kocaeli Kıyı Şeridi

- [ ] Kandıra
- [ ] Karasu
- [ ] Kerpe
- [ ] Kefken

### Sakarya

- [ ] Sapanca
- [ ] Geyve

### Bursa

- [ ] Yenişehir

### Bolu

- [ ] Göynük

### Ankara–Bolu Sınırı

- [ ] Güdül

---

## Her Bölge İçin İçerik Notları (kullanıcı dolduracak)

Her bölge sayfası açılmadan önce aşağıdaki notların doldurulması beklenir. Boş alanları
özgün içerikle doldurmadan sayfayı yayına almak Sprint 0'da kapatılan **doorway / thin
content riskini** geri getirir.

| Alan | Açıklama |
|---|---|
| **Tipik talep dönemi** | Yaz / kış / sonbahar — bölgenin proje yoğunluğu zamanı |
| **Tipik proje tipi** | Yeni inşaat / tadilat / dış cephe / çatı / endüstriyel |
| **Bölgeye özel teknik öneri** | Örn: deniz kıyısında 150 yoğunluk; soğuk illerde 8–10 cm kalınlık |
| **Tamamlanmış iş referansı** | Paylaşıma açık projeler (foto/proje adı/m² varsa) |
| **Saha ziyareti yapılabilirlik** | Müşteri talep ederse teknik ekip gidebilir mi? Hangi koşulda? |
| **Sevkiyat hattı notu** | Hangi araç tipiyle (kamyon/TIR), doluluk eşiği, ortalama transit süresi |

---

## Sprint 4-5 Mimari Kararları

### Route Yapısı

İki seçenek var, kullanıcı kararı verilecek:

- **A) `/bolge/[sehir]/[ilce]`** (Sprint 0'da silinen yapı, geri açılır)
  - Avantaj: hiyerarşik URL, breadcrumb doğal
  - Dezavantaj: 24 il × 8 ilçe = 192 sayfa, çoğu thin content olur
- **B) `/bolge/[slug]`** (her bölge için tek seviye slug)
  - Avantaj: sadece 22 sayfa (Tier 1 + Tier 2), her biri özgün içerikli
  - Dezavantaj: hiyerarşi URL'de görünmez
- **Öneri:** B — kalite > kantite. Sonradan ihtiyaç olursa hiyerarşik genişlemek zor değil.

### Statik Whitelist

- `generateStaticParams()` ile yalnızca yukarıdaki Tier 1 + Tier 2 listesindeki slug'lar
- `export const dynamicParams = false` → liste dışı slug'lar 404 döner
- Bu Sprint 0'daki doorway riskini kalıcı olarak engeller

### Schema Stratejisi

Her bölge sayfası `@graph` ile bağlı:
- `LocalBusiness` (BUSINESS_REF — Sprint 1'de tek canonical entity)
- `Service` (`areaServed: { '@type': 'City', name: '<şehir>' }`)
- `BreadcrumbList`
- `FAQPage` (bölgeye özel 3–5 soru, kullanıcı doldurur)

### İçerik Hacmi

- **Minimum 800–1200 kelime özgün içerik** per sayfa
- Aksi takdirde thin content cezası riski

### Etkileşim

- Calculator linki anchor (`#mantolama-hesaplayici`) → şehir preset YOK, kullanıcı kendi seçsin
- WhatsApp + tel: doğrudan link (Sprint 0'daki notifyWhatsappIntent + notifyPhoneCall pattern'iyle aynı `source` etiketi: `bolge_<slug>`)
- Header / Footer Sprint 0'daki yapıyla aynı

---

## Sprint 4-5 Açılış Ön Şartları

Bu kontroller yapılmadan Sprint 4-5'e başlanmaz:

- [ ] Sprint 0 deploy'u canlıda 7 gün sorunsuz (Vercel hata izleme + Sentry).
- [ ] Yukarıdaki içerik notları her bölge için en az %80 doldurulmuş.
- [ ] BUSINESS_REF entity zinciri kurulmuş (Sprint 1 hedefi).
- [ ] `@graph` pattern Sprint 1'de production'a alınmış.
- [ ] Image pipeline kararı netleşmiş (Vercel Pro mu, mevcut `unoptimized: true` mı).

---

## Sprint 0 → Sprint 4-5 Bağı

Sprint 0'daki `next.config.ts` redirect'leri:

```ts
{ source: '/bolge/:sehir/:ilce', destination: '/iletisim', permanent: false },
{ source: '/bolge/:sehir',       destination: '/iletisim', permanent: false },
{ source: '/bolge',              destination: '/iletisim', permanent: false },
```

**Sprint 4-5'e geçişte bu 3 redirect'in TAMAMI KALDIRILIR.** Yeni route yapısı (`/bolge/[slug]`)
açıldığında redirect kuralları çakışır, manuel temizlik yapılmalı.

— Roadmap sonu.
