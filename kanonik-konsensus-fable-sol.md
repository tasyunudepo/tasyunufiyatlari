# Taşyünü Fiyatları — Kanonik Konsensus ve Paralel Sprint Sözleşmesi

> Durum: Ana ticari kurallar kilitli, 13 Temmuz Claude/Opus ikinci hakem kontrolü **KABUL**; **P0 canlıda kapatıldı** (kanıt: bölüm 8.1 sonundaki "13 Temmuz canlı kapanış kanıtı", release commit `8f4ebd9`). P1–P3 henüz başlamadı  
> Tarih: 13 Temmuz 2026  
> Sahip: Emrah  
> Entegratör: Codex  
> Paralel uygulayıcı/hakem: Claude Fable 5  
> Risk sınıfı: R3–R4 — fiyat, teklif, KVKK, auth, RLS ve kritik lead akışı

Bu dosya, kapsamlı Codex auditi ile Fable 5 denetiminin tekilleştirilmiş uygulama sözleşmesidir. Eski audit raporları kanıt kaynağı değil, bulgu kaynağıdır. Güncel kod, canlı salt-okunur doğrulama, yazılı ticari kararlar ve çalıştırılabilir testler son doğruluk kaynağıdır.

## 1. Ana sonuç

13 Temmuz denetiminin ana sonucu, projenin o günkü hâliyle yayına uygun olmadığıydı: müşteri teklif akışında kayıt kopukluğu, yanlış WhatsApp toplamı, çalışmayan marj güncelleme zinciri, spam yüzeyi, public PDF erişimi, korumasız mutasyon rotaları, kişisel/ticari veri logları ve yanıltıcı müşteri vaatleri vardı. Bu yayın engelleyicilerin tamamı aynı gün canlıda kapatıldı; kanıtlar bölüm 8.1'in sonundadır. P0 kapandığı için CRO/tasarım çalışmalarının önündeki sıralama engeli kalkmıştır; öncelik sırası P1–P3 planına tabidir.

Güncel faz durumu:

| Faz | Durum | Kapsam |
|---|---|---|
| **P0** | ✅ Canlıda kapatıldı (13 Temmuz 2026) | Teklif kaydı, doğru fiyat/marj, PDF güvenliği, spam koruması, nakliye/vaat temizliği, PII-marj logları, KVKK |
| **P1** | ⏳ Bekliyor | Tek fiyat otoritesi, Bonus markası, TEKNO sevkiyat paneli, import (Excel) bütünlüğü, kalıcı gizlilik |
| **P2** | ⏳ Bekliyor | SEO, erişilebilirlik, performans, ölçüm kalitesi, genel kod temizliği (tam repo lint borcu: 89 hata / 15 uyarı) |
| **P3** | ⏳ Bekliyor | RBAC ve admin giriş güçlendirme, güvenlik başlıkları, gözlemlenebilirlik/otomatik arıza alarmı, mimari sadeleştirme |

P1'in Bonus kalemi için karar ve veri hazırlığı tamamlandı: sekiz ürünlük karşılaştırma kararı `bonus-karsilastirma-fikir-turlari.md` dosyasında, uygulama devri `docs/fusion-runs/20260713-042146-bonus-tasyunu-fiyat-verisi-dogrulamasi-home-emra/05-codex-fable-handoff.md` içindedir. Kod uygulaması henüz başlamadı.

## 2. Kilitli ticari kararlar

Bu kararlar teknik ekip tarafından yeniden yorumlanamaz:

1. Ödeme tek seferde alınır; kapora, ön ödeme ve taksit vaadi verilmez.
2. KDV oranı `%20`dir; müşteri fiyatlarında “KDV hariç” etiketi görünür olmalıdır.
3. **Tam kamyon veya tam TIR siparişinde nakliye zaten satış fiyatına dahildir.**
4. Tam araçta `shippingCost: 0`, tek başına nakliye kaybı veya eksik fiyat kanıtı değildir.
5. Tam araç fiyatına `base_shipping_cost` ayrıca eklenmez; aksi hâlde nakliye iki kez sayılabilir.
6. **Taşyününde tam araç altındaki tekil ürüne fiyat veya teklif verilmez.** Müşteri en yakın tam kamyon/TIR metrajına yönlendirilir.
7. Depo stoğu, depo teslimi ve “depoda varsa parsiyel satış” müşteri teklif akışından çıkarılır; site yalnız fabrikadan çıkan siparişleri destekler.
8. **EPS sistem teklifi minimum 400 m²’dir.** Wizard’ın tanımlı toz grubu/set kalemleri teklife dahilse nakliye satış fiyatına dahildir.
9. Yalnız EPS levhası alınırsa tam kamyon/TIR dolumuna kadar nakliye alıcıya aittir; tam araçta nakliye satış fiyatına dahildir.
10. EPS marj kademeleri admin panelinden yönetilir. 13 Temmuz 2026 tarihli teyitli başlangıç değerleri: `400–800 m² %20`, `801–1000 m² %10`, `1001+ m² %5`.
11. Canlı veride TEKNO levhası yoktur; TEKNO yalnız toz grubu/aksesuar markasıdır. Bonus ayrı ve yeni bir levha markası olarak hazırlanacaktır.
12. TEKNO toz grubunun şehir/sevkiyat verisi kesinleşmeden bu pakette koşulsuz nakliye vaadi verilmez; sonuç `separate_quote_required` olur.
13. Bonus levha + TEKNO toz grubu kombinasyonu, TEKNO şehir/sevkiyat kuralı aktif edilene kadar kesin fiyat üretmez; `separate_quote_required` ve `isPriceFinal:false` döner.
14. PDF oluştuktan sonra başarı alanında sade biçimde `WhatsApp`, `E-posta` ve `PDF indir` seçenekleri gösterilir; otomatik mesaj/e-posta gönderim sistemi kurulmaz.
15. GA4 analitik ölçümü işletme sahibinin açık risk kabulüyle rıza kapısı olmadan çalışmaya devam eder. Bu karar “hukuken uyumlu” sayılmaz; GA4'e kişisel veri gönderilmemesi zorunludur.
16. Koşulsuz “ücretsiz nakliye” yerine “koşullar sağlandığında nakliye fiyata dahildir” denir.
17. Altyapısı olmayan teslim, fiyat garantisi, stok, belge veya yanıt süresi vaadi yayınlanmaz.

### Nakliye için teknik karşılık

Belirsiz `shippingCost` alanı uzun vadede aşağıdaki sözleşmeye dönüştürülecektir:

```ts
type ShippingMode =
  | "included_in_sale_price"
  | "buyer_pays"
  | "separate_quote_required";

type ShippingDecision = {
  mode: ShippingMode;
  separateShippingCharge: number | null;
  isPriceFinal: boolean;
  customerMessage: string;
};
```

PDF, WhatsApp, Wizard ve PDP aynı `ShippingDecision` sonucunu kullanacaktır.

## 3. Ticari karar kapıları — durum tablosu

Sorular ticari dille sorulur; veri modeli, enum, API ve test karşılığını modeller çıkarır.

| ID | Ticari konu | Kilitli karar / mevcut durum | Durum |
|---|---|---|---|
| K-01 | TEKNO levha/toz kapsamı | Canlı DB: TEKNO levha `0`, aktif aksesuar `27`. TEKNO toz grubu korunur; Bonus yeni levha markasıdır. | **KİLİTLİ** |
| K-02 | EPS minimumu, marjı ve nakliyesi | Set minimumu 400 m²; mevcut set/toz kalemleri dahilse nakliye fiyata dahil. Yalnız levhada tam araç altı nakliye alıcıya ait. Başlangıç marjları `%20/%10/%5`. | **KİLİTLİ** |
| K-03 | Kamyon altı taşyünü | Teklif yok; yalnız tam kamyon, tam TIR ve geçerli kombinasyonlar. En yakın tam araç metrajı önerilir. | **KİLİTLİ** |
| K-04 | PDF teslim deneyimi | PDF oluşunca ekranda WhatsApp, e-posta ve indir seçenekleri çıkar. WhatsApp/e-posta kullanıcı uygulamasını hazır metin ve güvenli bağlantıyla açar. | **KİLİTLİ** |
| K-05 | Özel teklif bağlantısı müşteriye kaç gün açık kalsın; teklif ve müşteri kaydını satış takibi için ne kadar süre saklıyoruz? | Hukuk ve operasyon teyidi gelene kadar kalıcı public link verilmez. P0 teknik varsayımı: signed URL yalnız anlık açma/indirme için env’den ayarlı **15 dakika** geçerlidir; retention ayrı karardır. | Kalıcı teslim ve retention; P0 private PDF’yi bloklamaz |
| K-06 | Tuzla depo satış yolu | Müşteri teklif akışından kaldırılır; eski alanlar önce pasifleştirilir, sonra kontrollü temizlenir. | **KİLİTLİ** |
| K-07 | EPS set içeriği | Wizard’ın mevcut tanımlı set/toz grubu kalemleri birlikte fiyatlanır; yalnız levha ayrı nakliye kuralına tabidir. | **KİLİTLİ** |
| K-08 | 10.000 m² üstünde ekranda referans fiyat gösterelim mi, yoksa yalnız özel teklif talebi mi alalım? | Fiyat garantisi verilmez; özel teklif talebi alınır. | Büyük metraj sözleşmesi |
| K-09 | Elimizde müşteriye gösterebileceğimiz güncel TSE/CE/yangın belgeleri ve kesin faaliyet başlangıç yılı var mı? | Belgesiz iddia kaldırılır. | Güven blokları ve schema |
| K-10 | Satış ekibi hangi gün ve saatlerde belirli bir dönüş süresini gerçekten tutabiliyor? | Dakika garantisi verilmez; “çalışma saatlerinde dönüş” kullanılır. | CTA mikro metni |
| K-11 | Ofis panelinde patron ve personel aynı işlemleri mi yapmalı; fiyat/import/silme yetkisi kimde olmalı? | Patron salt-okunur, mutasyon yalnız admin. | P1 RBAC |
| K-12 | Satış bildirimi CallMeBot ile devam mı edecek, yoksa farklı bir WhatsApp/e-posta kanalı mı kullanılacak? | P0’da veri en aza indirilir; sağlayıcı değişimi P1’de kararlaştırılır. | Bildirim ve KVKK metni |

## 4. Öncelik modeli

| Seviye | Anlam | Başlama şartı |
|---|---|---|
| **P0** | Yayın engelleyici; lead, yanlış fiyat, PII, auth ve yanlış vaat | Hemen, üç paralel hat |
| **P1** | Tek fiyat/domain otoritesi, kalıcı gizlilik, import bütünlüğü | P0 sözleşmeleri yeşil |
| **P2** | SEO, erişilebilirlik, performans, ölçüm ve kalite kapısı | P1 çekirdek kontratlar kararlı |
| **P3** | Mimari sadeleştirme, RBAC, gözlemlenebilirlik, repo hijyeni | P2 release kapısı mevcut |

---

# P0 — Tek release, üç paralel hat

P0 sıralı tek kuyruk değildir. Aşağıdaki üç hat, dosya sahipliği çakışmadığı sürece aynı anda ilerler. Birleşim sırasını Codex yönetir.

## P0-A — Lead ve fiyat doğruluğu

| ID | İş | Sahip | Dosya sahipliği | Kabul kanıtı |
|---|---|---|---|---|
| P0-A01 | Minimal test omurgası ve mevcut hatayı üreten kırmızı test | **Codex** | `package.json`, lockfile, test config, `tests/api/**` | Eksik `kvkkConsent` isteği 400 üretir; test düzeltmeden önce kırmızıdır. |
| P0-A02 | Dağıtık rate limit + idempotency + IP/telefon hash dedupe | **Codex** | `app/api/quotes/route.ts`, `lib/security/**`, migration | 10 eşzamanlı aynı istek yalnız 1 quote, 1 event, 1 bildirim üretir; kota aşımı `429 + Retry-After`. |
| P0-A03 | Wizard payload’ına KVKK onayını ekle | **Codex** | `components/wizard/WizardCalculator.tsx` | Wizard PDF ve WhatsApp `kvkkConsent:true` gönderir; onaysız akışta yan etki oluşmaz. |
| P0-A04 | PDP payload’ına KVKK ekle ve sahte başarıyı kaldır | **Claude Fable 5** | `components/catalog/SingleProductQuoteButton.tsx`, `tests/components/catalog/**` | API başarısızsa “Talep sisteme kaydedildi” görünmez; kullanıcı dürüst hata ve alternatif iletişim görür. |
| P0-A05 | WhatsApp ve PDF QR toplamındaki ikinci `/1.2` işlemini kaldır | **Codex** | `WizardCalculator.tsx`, `tests/domain/whatsapp-total*` | Ekran, PDF QR ve WhatsApp KDV hariç toplamı en fazla `0,01 TL` farkla eşleşir. |
| P0-A06 | PII ve ticari marj/iskonto loglarını kaldır | **Codex** | `WizardCalculator.tsx`, `lib/notifications.ts` | Production konsol/loglarında ad, telefon, e-posta, adres, İSK1/İSK2 ve marj yoktur. |
| P0-A07 | Üç kritik kayıt yolunu entegrasyon/E2E ile kilitle | **Codex entegrasyonu; Fable PDP fixture desteği** | Codex: `tests/e2e/quote-flows/**`; Fable: `tests/components/catalog/fixtures/**` | Wizard PDF, Wizard WhatsApp ve PDP PDF başarı/hata senaryoları geçer. PDP doğrudan WhatsApp yolu `/api/quotes` kayıt akışı değildir; fiyat/nakliye mesaj smoke testi AC-P0-04 kapsamındadır. |
| P0-A08 | Admin marjını bütün fiyat yüzeylerinde tek canlı kurala bağla | **Codex kontrat/DB/Wizard/admin; Claude Fable 5 PDP tüketimi** | Codex: `lib/pricing/margin*`, `WizardCalculator.tsx`, admin önizleme; Fable: `ProductPricePanel.tsx`, `lib/catalog/pricing.ts` tüketimi | Önce mevcut sapmayı kanıtlayan kırmızı fixture: Wizard `%5`, PDP/mobil/SEO/admin `%10`. Düzeltme sonrası bütün yüzeyler `%5` kullanır; beklenen satış fiyatı düşüşü yaklaşık `%4,55`tir. |
| P0-A09 | PDF sonrası sade teslim kartı — Wizard | **Codex** | `WizardCalculator.tsx`, ortak PDF teslim helper’ı | Başarılı kayıtta WhatsApp, e-posta ve indir seçenekleri görünür; başarısız kayıtta başarı kartı yoktur. |
| P0-A10 | PDF sonrası sade teslim kartı — PDP | **Claude Fable 5** | `SingleProductQuoteButton.tsx` | Wizard ile aynı üç seçenek ve aynı dürüst başarı/hata sözleşmesi. |
| P0-A11 | EPS minimumunu canlı `500`den kanonik `400 m²`ye geçir | **Codex** | Sürümlü migration, `material_types`, admin doğrulaması, Wizard/PDP/server validation | Önce 400 m²’nin reddedildiği kırmızı test; migration sonrası 399,9 reddedilir, 400 kabul edilir. Canlı DB, admin, Wizard, PDP ve API aynı `min_order_m2=400` değerini kullanır. |

Başlangıç rate-limit politikası teknik varsayımdır; yük testi ve gerçek trafik gözlemine göre env’den ayarlanır:

- IP: 10 dakikada 5 yeni teklif.
- Normalize telefon hash’i: 30 dakikada 3 yeni teklif.
- Aynı idempotency key: tek kayıt ve tek bildirim.
- Ham IP/telefon rate-limit deposuna yazılmaz.
- Dağıtık store için P0 teknik varsayımı: mevcut Supabase/PostgreSQL üzerinde atomik RPC + süreli hash kayıtları kullanılır; process içi `Map/LRU` kullanılmaz. Yeni dış servis ancak DB yük testi yetersiz kalırsa ayrıca kararlaştırılır.

## P0-B — Güvenlik kapatma

| ID | İş | Sahip | Dosya sahipliği | Kabul kanıtı |
|---|---|---|---|---|
| P0-B01 | Import ve bulk mutasyonlarına handler-level auth | **Codex** | `app/api/import/**`, `app/api/products/bulk-insert/**`, ortak server auth helper | Auth’suz `401`, salt-okunur rol `403`; yetkisiz istekte DB delta `0`. |
| P0-B02 | Next.js güvenli stabil sürüme yükseltme | **Codex** | `package.json`, lockfile, `proxy.ts` testleri | Next proxy bypass advisory’si audit’te yok; `/ofis` ve admin rotaları korunur; legacy 301/410 bozulmaz. |
| P0-B03 | Public PDF bucket’ını private capability akışına çevir | **Codex** | `app/api/upload-pdf/**`, storage policy/migration, server testleri | Anon URL erişmez; `QUOTE_PDF_SIGNED_URL_TTL_SECONDS=900` varsayımıyla signed URL süresinde açılır; `upsert:false`; başarısız quote yetim dosya üretmez. Ticari saklama süresi P0’ı bloklamaz. |
| P0-B04 | PDF client hata ve teslim davranışını yeni sözleşmeye bağla | **Claude Fable 5** | `lib/uploadPdfToStorage.ts`, `SingleProductQuoteButton.tsx` | Quote/capability olmadan upload denenmez; public URL başarı iddiası yapılmaz. |
| P0-B05 | Canlı RLS kontratını otomatik doğrulama | **Codex** | migration/DB testleri | Anon hassas tablo count `0`; katalog yalnız izinli SELECT; anon DML yok. |

Güvenlik rollback kuralı: Eski güvensiz davranışa dönülmez. Sorun halinde ilgili özellik `503` veya feature flag ile kapatılır; auth, KVKK, private bucket veya idempotency kaldırılmaz.

## P0-C — Müşteriye doğru söz ve KVKK

| ID | İş | Sahip | Dosya sahipliği | Kabul kanıtı |
|---|---|---|---|---|
| P0-C01 | GA4 sürekli ölçüm kararını doğru politika ve veri hijyeniyle uygula | **Claude Fable 5** | `components/analytics/**`, çerez politikası; `app/layout.tsx` entegrasyonu Codex | `analytics_storage` açık kalır; tek kullanıcı hareketinde mükerrer event `0`; GA4’e ad, telefon, e-posta, adres veya güvensiz query parametresi gitmez; risk kabulü belgelenir. |
| P0-C02 | Mock piyasa verisini yayından kaldır veya gerçek kaynak kapısına bağla | **Claude Fable 5** | `app/piyasa/**`, `lib/data/marketData.ts` | Kaynaksız sayı “anlık piyasa” olarak yayınlanmaz. |
| P0-C03 | Koşulsuz ücretsiz nakliye, gönderilmeyen PDF, depo/parsiyel satış ve teyitsiz vaatleri temizle | **Claude Fable 5** | `app/page.tsx`, `components/cro/**`, katalog depo/stok bileşenleri, `app/iletisim/**`, `app/hakkimizda/**` | Müşteri yüzeyinde depo teslimi, stok varsa parsiyel satış ve diğer yasak/teyitsiz vaat `0`; ziyaretçi metni değiştiği için `web-copy-gate` geçer. |
| P0-C04 | Eksik “KDV hariç” etiketlerini kritik fiyat yüzeylerinde tamamla | **Claude Fable 5** | Katalog kartları, stok ve araç kartları, mobil sticky yüzeyler | Görünür fiyatlarda eksik KDV etiketi `0`. |
| P0-C05 | Consent metadata sürümü/kanalı/amacını kaydet | **Codex** | quote migration, schema ve API | Onaylı kayıtta boolean, timestamp, metin sürümü, amaç ve kanal bulunur. |

## P0 doğrulama matrisi

| Kabul ID | Risk | Kanıt katmanı | Bitiş kanıtı | Korunan mı? |
|---|---:|---|---|---|
| AC-P0-01 | R3 | API/contract | Eksik consent `400` ve sıfır DB/storage/notify yan etkisi | Evet |
| AC-P0-02 | R3 | Concurrency + DB | 10 duplicate → 1 quote/event/notify | Evet |
| AC-P0-03 | R3 | Component + E2E | API hatası başarı ekranına geçmez | Evet |
| AC-P0-04 | R3 | Unit + E2E | Ürün kalemleri toplandıktan sonra **KDV hariç genel toplam bir kez kuruşa yuvarlanır**; kart/PDF/Wizard WhatsApp/PDP WhatsApp aynı kanonik net/brüt toplamı, m² fiyatını ve nakliye metnini kullanır; yüzey farkı ≤ `0,01 TL` olur. | Evet |
| AC-P0-05 | R3 | HTTP + Storage | Private bucket, signed/expired/overwrite matrisi | Evet |
| AC-P0-06 | R3 | Auth + DB delta | Yetkisiz mutasyon `0` | Evet |
| AC-P0-07 | R3 | Browser network + event contract | Sayfa/CTA ölçümü kayıpsız ve tekil; GA4 eventlerinde PII `0` | Evet |
| AC-P0-08 | R3 | Static + browser | Production PII/marj logu `0` | Evet |
| AC-P0-09 | R3 | Copy gate + review | Yasak/teyitsiz müşteri vaadi `0` | Evet |
| AC-P0-10 | R3 | DB + unit + browser | Admin `%5` kaydı tüm fiyat yüzeylerinde `appliedMarginPct=5`; aynı girdi yüzey farkı ≤ `0,01 TL` | Evet |
| AC-P0-11 | R3 | Component + E2E | PDF başarısında WhatsApp/e-posta/indir görünür; başarısız kayıtta görünmez | Evet |
| AC-P0-12 | R3 | Migration + DB/API + E2E | EPS 399,9 m² reddedilir; 400 m² komple set kabul edilir; bütün yüzeylerde minimum `400` | Evet |

P0 bitmeden yeni deney, yeniden tasarım veya package-engine geçişi başlatılmaz.

---

# P1 — Tek fiyat otoritesi, veri bütünlüğü ve kalıcı güvenlik

## P1-A — Kanonik fiyat/domain motoru

| ID | İş | Sahip | Bağımlılık | Kabul kanıtı |
|---|---|---|---|---|
| P1-A01 | Saf `lib/pricing/*` modülleri ve `PriceQuote` sözleşmesi | **Codex** | K-01…K-08 ticari cevapları | Tek giriş aynı net/brüt toplam, araç planı ve `ShippingMode` üretir. |
| P1-A02 | EPS marj kademeleri, set/tek-levha nakliyesi ve marka/şehir iskonto seçicisi | **Codex** | Optimix ve TEKNO güncel liste teyidi | 399/400/800/801/1000/1001 m² golden testleri; set ve yalnız levha farklı nakliye kararını üretir. |
| P1-A03 | Kamyon/TIR/karma araç dilimlerinin ayrı fiyatlanması | **Codex** | Karma araç kuralı | 1 TIR + 1 kamyonda her dilime doğru iskonto. |
| P1-A04 | Wizard’ı ortak motora bağla | **Codex** | A01–A03 | Wizard eski inline formülü tekrar etmez. |
| P1-A05 | PDP’yi ortak motora bağla | **Claude Fable 5** | A01–A03 sözleşmesi dondurulmuş | Aynı girdi Wizard=PDP; Fable sözleşmeyi değiştirmez. |
| P1-A06 | 7,5 cm, gerçek paket metrajı ve depo yolunun müşteri akışından çıkarılması | **Codex + Fable ayrı dosya sahipliği** | K-06 | 7,5 cm→75 mm; validasyon/fiyat/PDF aynı `actualOrderM2`; depo seçeneği müşteri yüzeylerinde `0`. |
| P1-A07 | Server-side fiyat yeniden hesaplama | **Codex** | Ortak motor kararlı | Manipüle client toplamı kaydedilmez; server snapshot kullanılır. |

## P1-D — TEKNO kural verisi ve Bonus marka hazırlığı

| ID | İş | Sahip | Kabul kanıtı |
|---|---|---|---|
| P1-D01 | TEKNO’yu yalnız toz grubu olarak kanonikleştir; sahte levha varsayımını kaldır | **Codex** | Canlı DB ve Wizard’da TEKNO levha `0`; mevcut 27 aktif aksesuar korunur. |
| P1-D02 | TEKNO şehir/sevkiyat kuralını taslak/aktif ve yürürlük tarihli admin yapısına taşı | **Codex** | Teyitsiz şehir değeri kesin fiyat üretmez; eski teklifler değişmez; değişiklik geçmişi vardır. |
| P1-D03 | Bonus veri paketini P0 ile paralel hazırla, canlı aktivasyonu kapalı tut | **Claude Fable 5 veri eşleme; Codex import/aktivasyon kapısı** | Fiyat, KDV, paket m², kamyon/TIR kapasitesi, şehir iskonto ve kaynak tarihi eksiksiz değilse Wizard’da görünmez. |
| P1-D04 | Bonus’u ortak motor sonrasında yeni levha markası olarak aktive et | **Codex entegrasyon; Fable PDP/Wizard görünürlük testi** | Bir kamyon, bir TIR ve karma araç golden testi geçer; Wizard=PDP toplamı. Bonus+TEKNO kombinasyonu aktif şehir kuralı yoksa `separate_quote_required` ve `isPriceFinal:false` üretir. |

Kanonik çıktı en az şu alanları açık adla taşır: `requestedM2`, `actualOrderM2`, `packageCount`, `productTotalNet`, `vatAmount`, `totalGross`, `pricePerM2Net`, `pricePerM2Gross`, `vehiclePlan`, `shippingMode`, `separateShippingCharge`, `isPriceFinal`, `warnings`.

## P1-B — Import ve veri sözleşmesi

| ID | İş | Sahip | Kabul kanıtı |
|---|---|---|---|
| P1-B01 | İSK1/İSK2/`package_m2` alanlarını preview→apply→rollback boyunca taşı | **Codex** | Üç alan snapshot ve rollback’te birebir korunur. |
| P1-B02 | KDV bayrağını no-op kararına ekle | **Codex** | Aynı sayı, farklı KDV durumu no-op sayılmaz. |
| P1-B03 | Apply/snapshot/log/status değişimini tek DB transaction/RPC yap | **Codex** | Ortadaki yapay hata bütün batch’i geri alır. |
| P1-B04 | Fiyat/iskonto/package veri kalite raporu | **Claude Fable 5 — salt-okunur test/hakemlik** | Eksik/negatif/uyumsuz kayıtlar redakte raporda görünür. |

## P1-C — Gizlilik ve yetki

| ID | İş | Sahip | Kabul kanıtı |
|---|---|---|---|
| P1-C01 | Public `select("*")` yerine güvenli kolonlu view/API | **Codex** | Browser’a maliyet, marj ve iç iskonto kolonları gitmez. |
| P1-C02 | PDF/quote/event retention ve tam silme | **Codex** | Silme isteği ilişkili PDF ve eventleri kontrollü kaldırır. |
| P1-C03 | Patron/personel/admin rol ayrımı | **Codex** | K-11 kararına göre rol matrisi handler seviyesinde geçer. |
| P1-C04 | CallMeBot veri aktarımı ve müşteri metni | **Claude Fable 5 yorum; Codex entegrasyon** | Sağlayıcı/amaç metni gerçekle uyumlu, mesaj minimum PII taşır. |

---

# P2 — SEO, erişilebilirlik, performans ve ölçüm

| ID | İş | Sahip | Kabul kanıtı |
|---|---|---|---|
| P2-01 | Geçersiz kalınlık ve boş marka×kategori rotalarını 404/noindex yap | **Claude Fable 5** | Geçersiz örnekler 404; sitemap/canonical dışında. |
| P2-02 | Sitemap hata yönetimi, gerçek `lastModified`, URL kapsamı | **Claude Fable 5** | Sitemap yalnız canonical 200 URL; DB hatası sessiz yutulmaz. |
| P2-03 | Product Offer schema stok/KDV/minimum/satıcı doğruluğu | **Claude Fable 5** | Görünen fiyat ve schema aynı temele dayanır; koşulsuz `InStock` yok. |
| P2-04 | Statik PDP ve canlı Wizard fiyat/cache tazeliğini izlenebilir kıl | **Codex** | P0’daki tek marj kaynağı korunur; admin fiyat değişikliği onaylı süre içinde iki yüzeye yansır ve sentetik kontrol bunu ölçer. |
| P2-05 | Modal/drawer/form label/kontrast erişilebilirliği | **Claude Fable 5** | Axe kritik/ciddi `0`; klavye akışı ve focus restore geçer. |
| P2-06 | PDF bağımlılıklarını gecikmeli yükle, başlangıç isteklerini azalt | **Codex** | PDF kodu ilk paket dışında; başlangıç JS/istek baz çizgiden iyi. |
| P2-07 | Funnel event sözleşmesi ve doğrulanmış lead metriği | **Codex** | Gösterim→form→API başarı zinciri tek session/quote ile izlenir. |
| P2-08 | Tam lint/CI kapısı | **Codex entegrasyonu; Fable sahip dosyalarını temizler** | Lint hata `0`, typecheck/test/build zorunlu; kaçış yok. |
| P2-09 | Markalı gerçek 404 deneyimi | **Claude Fable 5** | 404 route doğru status korur; hesaplayıcı ve iletişime yol verir. |

---

# P3 — Mimari sadeleştirme ve operasyon

| ID | İş | Sahip | Kabul kanıtı |
|---|---|---|---|
| P3-01 | Eski `lib/package-engine` için kaldır/uyarla kararı | **Codex** | Üretimde iki fiyat otoritesi kalmaz. |
| P3-02 | cm/mm, net/brüt, araç ve nakliye tiplerini açıklaştır | **Codex** | Belirsiz `grandTotal/pricePerM2/shippingCost` adları kalkar. |
| P3-03 | Basic Auth’tan SSO/MFA/RBAC’a geçiş | **Codex** | Kişiye bağlı audit trail ve rol testleri. |
| P3-04 | CSP/frame/nosniff/referrer/permissions başlıkları | **Codex** | Canlı header matrisi ve CSP ihlal gözlemi. |
| P3-05 | Lead/fiyat/veri tazeliği alarmı | **Codex** | Alarm sentetik arızada doğru kişiye ulaşır. |
| P3-06 | CSV/JWT/env/yedek/repo hijyeni | **Claude Fable 5 öneri ve ayrı hijyen commit’i; Codex review** | Hassas CSV tracked değil; gömülü anon JWT yok; `.env.local` 600. |

---

# 5. Paralel çalışma sözleşmesi

## 5.1 Dal ve worktree modeli

- Codex: `codex/<sprint>-core`
- Claude Fable 5: `fable/<sprint>-client-truth`
- Entegrasyon: `integration/<sprint>` — yalnız Codex birleştirir.
- Her model ayrı worktree kullanır; mevcut kirli ana worktree’de uygulama yapılmaz.
- İşler risk başına küçük ve geri alınabilir commit’lerle teslim edilir.
- Fable’ın değişikliği doğrudan production branch’e girmez; Codex kod, test ve ticari kural review’u yapar.

## 5.2 Sıcak dosya sahipliği

| Dosya/alan | Tek sahip | Paralel kural |
|---|---|---|
| `components/wizard/WizardCalculator.tsx` | **Codex** | Fable yalnız bulgu/test fixture önerir. |
| `components/catalog/SingleProductQuoteButton.tsx` | **Claude Fable 5** | Codex API sözleşmesini değiştirirse önce handoff notu yazar. |
| `components/catalog/ProductPricePanel.tsx` | **Claude Fable 5** | Ortak `lib/pricing` kontratını değiştiremez. |
| `lib/catalog/pricing.ts` | **Claude Fable 5 tüketici; Codex kontrat sahibi** | Sabit marj kaldırılır; Codex’in dondurduğu marj sözleşmesi tüketilir. |
| `app/ofis/tabs/MarginRulesTab.tsx`, `ProductsTab.tsx` | **Codex** | Admin kayıt ve önizleme aynı marj kaynağını kullanır. |
| `app/api/quotes/route.ts` | **Codex** | Rate limit, idempotency ve server price aynı sahipte. |
| `lib/schemas/quote.schema.ts` | **Codex** | Fable schema değişikliği istemini patch önerisi olarak verir. |
| `app/api/import/**`, `lib/import*` | **Codex** | Migration numarası merkezi tahsis edilir. |
| `app/api/upload-pdf/**`, storage policy | **Codex** | Fable yalnız client tüketimini değiştirir. |
| `components/analytics/**` | **Claude Fable 5** | `app/layout.tsx` son entegrasyonunu Codex yapar. |
| `app/page.tsx`, `components/cro/**`, politika/iletişim/hakkımızda | **Claude Fable 5** | Web copy gate Fable hedefli, Codex final çalıştırır. |
| `lib/pricing/**`, domain tipleri | **Codex** | Sözleşme dondurulmadan Fable entegrasyona başlamaz. |
| `package.json`, lockfile, CI, `proxy.ts`, `app/layout.tsx` | **Codex entegratör** | Hiçbir paralel ajan doğrudan değiştirmez. |

## 5.3 Handoff şablonu

Her görev şu bilgiyle devredilir:

```text
Görev ID:
Commit:
Değiştirilen dosyalar:
Kontrat sürümü/commit hash:
Kabul kriterleri:
Çalıştırılan testler ve sonuç:
Yeni env/migration:
Ticari varsayım:
Kalan risk:
Entegratörden istenen ortak dosya değişikliği:
```

## 5.4 Çakışma ve durma kuralları

1. Aynı dosyaya iki model aynı anda yazmaz.
2. Ticari karar açık değilse üretim davranışı varsayılmaz; görev `BEKLİYOR-EMRAH` olur.
3. Bir model diğerinin kabul testini silmez, gevşetmez, `skip/only` yapmaz.
4. API/schema sözleşmesi değişirse tüketici hatlar durur ve yeni kontratı yazılı alır.
5. Migration numaraları ve package/lockfile değişiklikleri yalnız entegratöründür.
6. Güvenlik değişikliği geri alınacaksa fail-open değil fail-closed yol seçilir.
7. Fable review’u öneridir; kod ve ticari kural için son teknik hakem Codex, ticari hakem Emrah’dır.
8. P0-C01 sırası: Fable sürekli GA4 ölçümü ve PII’siz event sözleşmesini `components/analytics/**` altında test eder; Codex daha sonra `app/layout.tsx` entegrasyonunu yapar. Default-deny uygulanmaz.
9. P1-A05 başlamadan önce `lib/pricing` kontratının sürümü ve commit hash’i handoff kaydında dondurulur.
10. Kilitli ticari karar, P0/P1 kapsamı, dosya sahipliği veya kabul kriteri değiştiğinde önceki Fable hükmü otomatik olarak eski sürüme ait sayılır. Güncel dosya üzerinde yeni salt-okunur Fable kontrolü ve açık hüküm olmadan “ortak kabul” yazılmaz.

---

# 6. Doğrulama komut modeli

Repo başlangıç profili: test runner yok; yalnız `npm run lint` ve `npm run build` var. Minimum omurga P0’da kurulur; bütün araçlar birden eklenmez.

```text
verify:fast
  hedefli unit/API/component testleri + değişen dosyalarda lint

verify:full
  tüm unit/entegrasyon + typecheck + lint + build

verify:release
  kabul kilidi + ziyaretçi metni + unit/API/type + P0 lint + gerçek DB smoke +
  production dependency eşiği + build + beş kritik teklif E2E
```

`npm run verify:release` yerel/CI release kapısıdır. Canlı RLS, bucket erişimi,
signed URL ve production env smoke testi bu komut geçse bile ayrıca zorunludur.
Tam repo lint sıfırı P2 borcudur; P0 release kapısı değişiklik alanında lint hatası
olmamasını zorunlu tutar ve uyarıları görünür bırakır.

`npm run verify:live:readonly`, canlı sisteme kayıt yazmadan handler auth,
anon RLS görünürlüğü, katalog SELECT, bucket gizliliği, public PDF erişimi ve
`submit_quote_guarded` RPC varlığını kontrol eder. Bu komut deploy öncesi kırmızı,
deploy sonrası yeşil olması gereken üretim kapısıdır.

Test katmanları:

- Saf fiyat/KDV/nakliye/idempotency: unit.
- API/schema/storage/auth: entegrasyon/contract ve gerektiğinde DB testi.
- Wizard PDF, Wizard WhatsApp, PDP PDF: işlevsel Playwright E2E.
- Marj `%10→%5`: saf fiyat unit testi + DB/API contract + Wizard/PDP/admin işlevsel karşılaştırma.
- Modal/form/consent: component + Playwright/axe.
- RLS/migration: staging veya lokal Supabase DB testi; yalnız frontend mock yeterli değildir.

# 7. Definition of Done

- [x] Zorunlu ticari kararlar yazılı olarak cevaplandı veya ilgili işler bloklandı.
- [ ] P0 kabul kriterlerinin tümü kanıtlandı.
- [x] Korunan testlerde `skip`, `only`, zoraki geçiş veya teste özel production yolu yok.
- [x] Build başarılı.
- [x] Değiştirilen dosyalarda lint hatası yok; P2 sonunda tam repo lint sıfır.
- [x] Üç kritik teklif akışı gerçek tarayıcıda geçti.
- [ ] Auth, RLS ve private PDF kanıtları geçti.
- [x] Kart/PDF/WhatsApp fiyat, m² ve nakliye koşulu onaylı senaryolarda aynı kanonik helper ve E2E akışında eşleşti.
- [x] Canlı EPS minimumu, admin, Wizard, PDP ve API’de `400 m²` olarak eşleşti; 399,9/400 sınır testi geçti.
- [ ] Bonus+TEKNO kombinasyonu, aktif şehir kuralı yokken kesin fiyat üretmedi.
- [ ] Müşteri görünen metin değiştiyse `web-copy-gate` risksiz geçti.
- [x] Kalan risk, ticari belirsizlik ve rollback yolu kaydedildi.

# 8. Model görüşleri ve karar günlüğü

## 8.1 Codex ilk sentezi

- P0 üç paralel hatta ayrıldı: lead/fiyat, güvenlik ve müşteri doğruluğu.
- Tam araçta nakliye kaybı iddiası reddedildi; kullanıcı kararı kanonik kurala dönüştürüldü.
- Taşyününde kapasite altı teklif ve depo istisnası, 13 Temmuz ticari kararıyla kaldırıldı.
- EPS minimumu 400 m²; set/toz grubu dahilse nakliye fiyata dahil, yalnız levhada tam araç altı nakliye alıcıya ait olarak kilitlendi.
- Canlı kontrolde TEKNO levha olmadığı, 27 aktif TEKNO aksesuarı bulunduğu ve Bonus’un yeni levha markası olacağı doğrulandı.
- GA4 default-deny görevi, işletme sahibinin açık risk kabulüyle sürekli ölçüm + PII’siz event sözleşmesine çevrildi.
- Canlı taşyünü marjı `%5` olarak kaydedilmiş olsa da PDP, mobil/SEO başlangıç fiyatı ve admin önizlemenin sabit `%10` kullandığı kanıtlandı; düzeltme P0’a alındı.
- PDF teslimi otomatik servis entegrasyonu yerine başarı ekranında WhatsApp/e-posta/indir seçenekleri olarak sadeleştirildi.
- Rate limit, `kvkkConsent` düzeltmesiyle aynı release’e ve onun önüne alındı.
- Sıcak dosyalar tek sahibe verildi; Codex entegratör, Fable izole client/CRO/SEO sahibi oldu.
- P0 için önce kırmızı regresyon testi, sonra en küçük düzeltme ve release doğrulaması zorunlu tutuldu.

## 8.2 Claude Fable 5 yorumu

**Fable nihai hükmü: KABUL.** İlk incelemede beş revizyon istemiş; revize dosyayı ikinci kez kontrol ederek beşinin de işlendiğini doğrulamıştır. Kilitli nakliye kararının metin boyunca tutarlı işlendiğini, P0’ın üç paralel hatta ayrılmasını, test-first yaklaşımını, dağıtık rate limit + DB idempotency kararını, fail-closed rollback’i ve tek dosya/tek sahip matrisini kabul etmiştir.

> **Sürüm notu:** Bu kabul, 13 Temmuz 2026 tarihli GA4, EPS 400 m², taşyünü tam-araç, TEKNO/Bonus, sade PDF teslimi ve canlı marj teşhisi revizyonlarından öncedir. Yeni sürümün salt-okunur ikinci hakem kontrolü Bölüm 8.4’te ayrıca kayıtlıdır.

Fable’ın açıkça kabul ettiği iş payı:

- P0-A04, P0-B04, P0-C01…C04.
- P1-A05, P1-B04 salt-okunur hakemliği, P1-C04 yorum/handoff.
- P2-01, P2-02, P2-03, P2-05, P2-09.
- P3-06 ayrı hijyen çalışması.

Fable’ın istediği beş revizyon ve işlenme durumu:

1. PDP WhatsApp’ın üç kayıt yolundan ayrı olduğu açıklandı; fiyat/nakliye smoke testine bağlandı. **İşlendi.**
2. Kuruş farkı testinde yuvarlama noktası “kalemler toplandıktan sonra genel toplamda bir kez” olarak tanımlandı. **İşlendi.**
3. K-05 beklerken private PDF’yi bloklamamak için env’den ayarlı 15 dakikalık geçici signed URL varsayımı eklendi. **İşlendi.**
4. Analytics bileşeni handoff’undan sonra `app/layout.tsx` entegrasyonunun Codex tarafından yapılacağı sıralandı. **İşlendi.**
5. P1-A05 öncesi `lib/pricing` kontrat sürümü/commit hash’i zorunlu handoff alanı yapıldı. **İşlendi.**

Fable’ın ikinci kontrolü:

- PDP WhatsApp kapsam ayrımını onayladı.
- Genel toplamda tek kuruş yuvarlama kuralını onayladı.
- `QUOTE_PDF_SIGNED_URL_TTL_SECONDS=900` geçici P0 varsayımını onayladı.
- Analytics handoff → Codex `app/layout.tsx` entegrasyon sırasını onayladı.
- `lib/pricing` kontratının sürüm/commit hash ile dondurulmasını onayladı.

Fable’ın kesin ticari teyidi: **Tam kamyon/TIR nakliyesi satış fiyatına dahildir; `shippingCost=0` tek başına kayıp kanıtı değildir.**

## 8.3 Fusion paneli ve Codex hakem kararı

Panel tamamlandı. GLM ve DeepSeek rapor üretti; MiniMax kota/429 nedeniyle yanıt veremedi. Panel raporları kanıt değil, bağımsız hakem görüşü olarak değerlendirildi.

Kabul edilenler:

- Sıcak dosyaların tek sahipte kalması ve Wizard/PDP işlerinin farklı sahiplerle paralelleştirilmesi.
- WhatsApp metninin sabit “nakliye dahil” yerine kanonik nakliye kararını tüketmesi.
- P0’da KVKK, `/1.2`, rate-limit/idempotency, sahte başarı ve log temizliğinin birlikte ele alınması.
- Package-engine’in P0’da devreye alınmaması.

Reddedilen/düzeltilenler:

- Testleri P2’ye erteleme reddedildi; kırmızı regresyon testi P0-A01’de kalır.
- Process içi `Map`/LRU rate limit reddedildi; dağıtık store + DB idempotency gerekir.
- “Next 16.1.7 yükseltme gerektirmiyor” iddiası reddedildi; güncel resmî advisory’ye göre etkilenen sürümdür.
- `kvkkConsent:true` hard-code edilmez; gerçek form onayı taşınır.
- Tam araçta “nakliye netleşir” denmez; kilitli iş kuralı gereği nakliye satış fiyatına dahildir.
- P0’da A/B testi yapılmaz; yanlış vaat ve kırık UX doğrudan düzeltilir.

Ayrıntılı sentez: `docs/fusion-runs/20260713-004255-tasyunufiyatlari-projesi-icin-kanonik-konsensus-/04-codex-synthesis.md`.

## 8.4 13 Temmuz revizyonu — Claude ikinci hakem kontrolü

İnceleme yerel Claude CLI üzerinde `opus` model takma adıyla, salt-okunur ve dosya düzenleme araçları kapalı biçimde yapıldı. İlk tur hükmü **KOŞULLU KABUL** oldu. İstenen altı düzeltme aynı dosyada işlendi ve ikinci turda tek tek doğrulandı:

1. Canlı EPS `500→400 m²` geçiş görevi ile `399,9/400` sınır testi eklendi.
2. Wizard `%5` ile PDP/mobil/SEO/admin `%10` mevcut sapması, düzeltmeden önce kırmızı fixture olarak zorunlu kılındı.
3. Bonus+TEKNO kombinasyonu, aktif şehir kuralı yokken `separate_quote_required` ve `isPriceFinal:false` olarak kilitlendi.
4. Kapsam veya ticari karar değişikliğinde önceki Fable/Claude hükmünün geçersizleşmesi ve yeniden inceleme zorunluluğu çalışma sözleşmesine eklendi.
5. P0 dağıtık rate-limit deposu için Supabase/PostgreSQL atomik RPC + süreli hash kaydı teknik varsayımı yazıldı; process içi `Map/LRU` reddedildi.
6. Depo teslimi ve parsiyel satış metinlerinin müşteri yüzeylerinden kaldırılması P0-C03’e açık kabul kriteri olarak eklendi.

Ek kontrolde AC-P0-04’ün Wizard/PDP kart, PDF ve WhatsApp yüzeylerinde net/brüt toplam, m² fiyatı ve nakliye metnini `0,01 TL` toleransla eşitlediği; Definition of Done’ın EPS 400 m² ve Bonus+TEKNO negatif senaryolarını kapsadığı doğrulandı.

**İkinci tur hakem hükmü: KABUL.**

## 8.5 P0 uygulama ilerlemesi — Codex entegrasyonu

13 Temmuz uygulama turunda kod ve test tarafında tamamlananlar:

- Vitest ve Playwright omurgası kuruldu; `26` test dosyasında `163` unit/API/contract testi ve `5` kritik tarayıcı akışı geçti.
- `/api/quotes`, Postgres `submit_quote_guarded` RPC sözleşmesine bağlandı. IP `10 dk/5`, telefon `30 dk/3`, `Idempotency-Key`, telefon+fingerprint dedupe, tek quote/event ve yalnız `created` sonucunda tek bildirim uygulanıyor.
- Geçici PostgreSQL 16 üzerinde sürümlü migration ile 10 gerçek eşzamanlı RPC çalıştırıldı: `1 created + 9 replayed`, `1 quote`, `1 funnel event`, `1 rate-limit kaydı`; route katmanında 10 tekrar için yalnız 1 bildirim testi geçti.
- Wizard PDF, Wizard WhatsApp ve PDP PDF payload’ları gerçek `kvkkConsent` ve idempotency anahtarı taşıyor. Onaysız istek DB/storage/bildirim yan etkisi olmadan `400` dönüyor.
- Yanlış ikinci `/1.2` kaldırıldı; kart, API payload, PDF ve iki WhatsApp yolu aynı KDV/net/m² hesap yardımcısına bağlandı. Wizard PDF’deki KDV dâhil m² ile WhatsApp’taki KDV hariç m² sapması kapatıldı.
- Canlı taşyünü marjının gerçekte `%5` kaydedildiği doğrulandı. PDP/mobil/SEO’daki sabit `%10` kaldırıldı ve bütün yüzeyler canlı `material_types` kuralına bağlandı.
- Canlı EPS minimumu `400 m²`; marjlar `400–800 %20`, `801–1000 %10`, `1001+ %5` olarak doğrulandı. API `399,9`u reddediyor, `400`ü kabul ediyor.
- Tam kamyonun yanlışlıkla TIR diye etiketlenmesi düzeltildi. Kamyon/TIR/kombinasyon ve WhatsApp/PDF nakliye metni ortak ticari karara bağlandı. `804 m²` gibi eksik yük artık `806,4 m²` tam kamyon sayılmıyor; Wizard presetleri gerçek ondalıklı kapasiteyi yazıyor.
- TEKNO toz grubunda kesinleşmemiş sevkiyat artık hiçbir yüzeyde “nakliye alıcıya ait” diye varsayılmıyor; ürün tutarı referans, nakliye ve kesin teklif ayrı teyit olarak gösteriliyor. PDF de aynı `separate_quote_required` kararını tüketiyor.
- Katalogdaki depo/parsiyel fiyat ve teklif yolu kaldırıldı; düşük metraj en yakın tam araca tamamlanıyor. `/depomuz` ve eski depo satış URL’si kataloğa yönleniyor.
- PDF yüklemesi quote-bound HMAC capability, random server path, `upsert:false`, private bucket migrationı ve kısa ömürlü signed URL sözleşmesine geçti. Admin PDF erişimi her açışta `60` saniyelik signed URL üretiyor.
- Import/bulk-insert mutasyonları handler seviyesinde admin yetkisine alındı; patron salt okunur kaldı.
- GA4 işletme kararına uygun biçimde açık kaldı; reklam depolama/sinyalleri bütün analytics bileşenlerinde kapatıldı, pageview query/hash/PII taşımıyor ve mükerrer pathname eventi engelleniyor. DB teklifiyle eşleştirilebilen `ref_code` GA4 eventlerinden çıkarıldı.
- Kaynaksız `/piyasa` rakamları yayından kaldırıldı; koşulsuz nakliye, depo/parsiyel, 81 il, kesin süre ve teyitsiz belge/garanti vaatleri temizlendi.
- Next.js `16.1.7 → 16.2.9`, Supabase JS `2.87.1 → 2.110.2` yükseltildi. Next proxy bypass ve `ws` yüksek riskleri audit listesinden çıktı.
- Production build `308` sayfayla geçti. `.env.local` izni `600` yapıldı.
- `npm run verify:release` sekiz aşamalı tek komut olarak eklendi ve baştan sona geçti: kabul kilidi, ziyaretçi metni, `163` test+typecheck, P0 lint, gerçek PostgreSQL smoke, production yüksek/kritik audit eşiği, `308` sayfalık build ve `5` Playwright akışı.
- Katalog veri kaynağındaki geçici hata artık sahte `404 Ürün Bulunamadı` sonucuna çevrilmiyor; bir kez yeniden deneniyor ve kalıcı servis hatası 404’ten ayrılıyor.

Canlı release’i bloklayan teknik kapılar (13 Temmuz kapanışından önceki durum):

1. `migration-v16-private-quote-pdfs.sql` ve `migration-v17-quote-submission-guard.sql` canlı Supabase’e henüz uygulanmadı.
2. Production’da `QUOTE_ABUSE_HASH_SECRET` ve `PDF_CAPABILITY_SECRET` en az 32 bayt farklı rastgele değerlerle tanımlanmalı; signed/capability TTL env’leri eklenmeli. Kod eksik yapılandırmada bilinçli olarak `503` ile kapalı kalır.
3. Private bucket migrationı ile uygulama kodu aynı release’te devreye alınmalı; eski public davranışa rollback yapılmaz.
4. Tam repo lint kapısı P2 borcu olarak `89 hata / 15 uyarı` veriyor. P0’ın hedefli test/type/build/E2E kanıtı yeşil olsa da genel lint sıfır değil.
5. `web-copy-gate`, ziyaretçi metnindeki riskler temizlendikten sonra test/teknik dokümandaki `vi.mock`, `example.test` ve HTML `placeholder` sözcüklerini de aynı desenle işaretlediği için global çıkışı `1`; işaretlenen kalan satırlar ziyaretçi metni değil.
6. Canlı salt-okunur kontrolde import/bulk rotaları yeni handler auth kodunu henüz taşımıyor; public PDF bucket’ı `public:true`, public nesne erişimi `200` ve `submit_quote_guarded` canlıda yok. Bunlar deploy eksikliği kanıtıdır; yerel test başarısı canlı kapanış sayılmaz.
7. Tekrarlanabilir `npm run verify:live:readonly` sonucu: anon hassas tablo/katalog kontrolleri `3` geçti; handler auth, PDF capability, private bucket, public URL ve RPC varlığı toplam `6` kontrolde başarısız. Canlı release bu sonuç `0` başarısıza inmeden kapatılamaz.

Bu kapılardan 1, 2, 3, 6 ve 7 numaralılar 13 Temmuz canlı release’iyle geçildi; kanıtlar 8.1’in sonundaki "13 Temmuz canlı kapanış kanıtı" bölümündedir. 4. madde (tam repo lint borcu: `89 hata / 15 uyarı`) P2 işi olarak, 5. madde web-copy-gate deseninin bilinen yanlış-pozitif notu olarak sürer. P0 hem kod hem canlı doğrulama olarak yeşildir.

## 8.1 — 13 Temmuz PDF/kayıt arızası kök neden doğrulaması

- Canlı `quotes` tablosunda toplam `13` kayıt vardır. Son iki kayıt 11 Mayıs 2026 günü Türkiye saatiyle `11:28` ve `12:05`te oluşmuş; daha yeni kayıt yoktur.
- `d68b3dd` commit'i 11 Mayıs 2026 `15:44`te API şemasında `kvkkConsent=true` alanını zorunlu yaptı, fakat Wizard ve katalog payload'ları aynı değişiklikte bu alanı göndermedi. 11 Mayıs sonrası kayıt kesilmesinin kod seviyesindeki kök nedeni budur.
- Güncel payload'lar KVKK alanını taşımaktadır; ancak localhost gerçek isteği `HTTP 503` döndürmektedir. Yerel `.env.local` içinde `QUOTE_ABUSE_HASH_SECRET` ve `PDF_CAPABILITY_SECRET` yoktur; canlı Supabase şemasında da `submit_quote_guarded` RPC henüz bulunmamaktadır. Güvenlik tasarımı gereği bu eksiklerde teklif yolu fail-closed kalır.
- Wizard tek `try/catch` içinde PDF üretimi ile teklif kaydını birleştirdiği için API 503 hatasını yanlış biçimde “PDF oluşturulurken hata” diye gösteriyordu. Akış aşamaları ayrıldı: PDF üretim hatası ile teklif kayıt hatası artık farklı mesaj verir.
- Yeni sözleşme testi `tests/contracts/wizard-pdf-error-message.test.ts`, teklif kayıt hatasının yeniden PDF hatası diye gösterilmesini engeller. Hedefli API/sözleşme testleri `9/9` ve TypeScript kontrolü geçmiştir.
- Canlı düzeltmenin kapanış koşulu kontrollü release olarak belirlendi: v16/v17 migration, iki farklı güçlü production secret, uygulama deploy'u ve sonrasında gerçek kayıt + ofis görünürlüğü smoke testi aynı pencerede tamamlanmalıydı. Aşağıdaki kanıtlarla bu koşul tamamlandı.

### 13 Temmuz canlı kapanış kanıtı

- V16 ve v17 canlı Supabase projesine transaction içinde uygulandı. `quote-pdfs` bucket `public=false`; atomik RPC yalnız `service_role` tarafından çalıştırılabiliyor ve iki guard tablosunda RLS + FORCE RLS açık.
- `QUOTE_ABUSE_HASH_SECRET`, `PDF_CAPABILITY_SECRET` ve PDF süre ayarları Vercel Production ortamına secret olarak eklendi; değerler repoya veya çıktı kayıtlarına yazılmadı.
- Release commit'i `8f4ebd9` üretime alındı. Canlı salt-okunur doğrulama `9 geçti / 0 başarısız` verdi.
- Kontrollü canlı PDF teklif kaydı `ID 99`, `TYSMOKE034154` referansıyla `created` oldu ve ofis API’sinde göründü. Aynı payload yeni idempotency anahtarıyla `deduplicated` oldu; ikinci quote oluşmadı.
- PDF private storage'a bağlandı; yükleme `HTTP 200`, signed nesne erişimi `HTTP 200`, admin PDF endpoint'i `HTTP 302` private signed URL yönlendirmesi verdi.
- Yerel release kanıtı: `164/164` unit/API/contract testi, TypeScript, hedefli lintte `0` hata, gerçek PostgreSQL eşzamanlı smoke, `308` sayfalık production build ve `5/5` kritik Playwright akışı geçti.
- P0 teklif/PDF kayıt kesintisi canlıda kapatıldı. Sistem test kaydı ofiste “SİSTEM TESTİ SİLİNEBİLİR” adıyla ayırt edilebilir.

# 9. Goal-ready sözleşme

- **Outcome:** P0 sonunda üç teklif yolu doğru fiyat ve tek canlı marj kuralıyla, geçerli lead KVKK onayıyla, spam/duplicate korumasıyla, private PDF erişimiyle, sade WhatsApp/e-posta/indir seçenekleriyle ve dürüst başarı/hata mesajıyla çalışır; GA4 ölçümü PII göndermeden sürer.
- **Verification surface:** Unit, API/contract, DB/storage/auth matrisi, üç kritik E2E, build, lint ve web-copy-gate.
- **Constraints:** Tam araç nakliyesi ikinci kez eklenmez; tek ödeme/KDV/domain kuralları bozulmaz; güvenlik rollback’i fail-open olmaz.
- **Boundaries:** Her model yalnız sahip olduğu dosyalara yazar; ortak sözleşme ve sıcak dosyalar entegratördedir.
- **Iteration policy:** Önce yeniden üretim testi, sonra tek odaklı değişiklik, hedefli test, faz sonunda full, teslimde release.
- **Blocked stop:** Ticari karar eksikse görev `BEKLİYOR-EMRAH`; aynı engel kanıtla sürüyorsa uygulama yapılmaz.
