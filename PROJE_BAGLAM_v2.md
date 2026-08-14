# TaşYünü Fiyatları - Proje Bağlamı v2.0

> Bu dosya yeni chat oturumlarında bağlamı korumak için oluşturulmuştur.
> Proje Anayasası ile PROJE_BAGLAM.md birleştirilmiştir.
> **Son güncelleme: 12 Aralık 2025, 17:40**

---
#Projenin YAPILMA SEBEBİ, İŞLEYİŞİ, GENEL HATLARI ve AMAÇLARI

Örnekler vererek anlatayım senin tabloyu anlaman için daha iyi olur

Aslında bunu daha önce bir kaç kez yaptım ama geldiğimiz nokta bu, belkide bu anlatıyı @PROJE_BAGLAM_v2.md a eklemeliyim en başına

Şimdi, biz İstanbul Tuzla ilçesinde İnşaat Malzemeleri satışı yapan bir firmayız. Filli Boya (Betek Grup Çatısı altında Markalardan biri) Bu markalara Ait Dalmaçyalı, Filli Boya nın alt markası Expert, Fawori alt markası Optimix gibi biraz daha baştan karışık bir marka grubuna ait ürünlerin bayisiyiz.

Bu ürünler Taşyünü ve EPS ve Toz grubu şeklinde gruplandırılmış listelerde geliyor. Taşyünü listesi ayrı, eps ve toz grubu dediğimiz aksesuarlar ayrı. Taşyünü Balıkesir ilinde üretildiği için, nakliye fiyat iskontoları o şehre göre dizayn edilmiş. Eps ve Toz grubu Gebze de üretildiği için nakliye iskontoları farklı şekilde dizayn edilmiş.

Projenin Amacı; gelen lsitelerde karmaşadan doalyı hesaplamanın zorluğunu minimize etmek ve otomatikleştirip dönüşüm artıran hemen teklife ve dönüşümü arırmayı amaçlayan bir teklif sistemi kurmaktı.

Hedefler
- Aylık değişen ve bize gönderilen xlsx formatında gelen  fiyat listelerini sadece google drive da bir klasöre atarak ve ekstradan admin panelinde bir drag drop ile kolayca güncelleyebilmek. Bu listelerden sütun başlarında yazdığından anlaşılacağı üzere, biri kdv dahil, diğeri kdv hariç geliyor. Yani buradan sitemimizin sağlıklı çalışması için kdv dahil yazan sütundan direk %20 düşerek kdv hariç fiyatı bulup o şekilde işlememiz gerekiyor fiyatı.
- Bize gelen fiyatlar İstanbul merkezli olduğumuz için İstanbul ili için ayarlanmış iskontolar ana sütunlarda geliyor bunun dışındaki indirimlerin illere göre belirlenmiş listeleri var ve bu listelere göre yer değiştiriyoruz. Örneklerle ilerleyelim ki net anlaşılsın
  TAŞYÜNÜ LEVHA KDV HARİÇ Fiyatları.xlsx dosyası taşyünü fiyatlarının olduğu liste. Taşyünü levhalar farklı model ve kalınlıklarda
@tasyunu_maliyet.csv de csv formatı hali

 Toz Grubu Fiyatları.xlsx dosyası da eps ve toz grubu ürünler yani aksesuarların olduğu liste. Bu liste ilginç şekilde Kdv dahil geliyor ve sistemimize bu fiyatları sokarken kdv sinin ayıklanması gerektiğini düşünüyorum

Ana mantık şu listelerden gelen fiyatları İstanbul iskontolarına göre ayıkla default fiyat olarak admin panellerinde İstanbul iskontoları ile kdv hariç + kdv fiyatı şeklinde fiyat göster tabi ayrıca toplamda kdv dahil şeklinde de göster

Şehir anasayfadaki wizardda veya admin panelinde veya site içindeki ehrhangi bir üründen teklif oluşturur iken bu mantıkla devam edelim. Şehir değiştiğinde iskontoda değişir. 
Şimdi listelerde 2 adet iskonto oranı var 
Önce Taşyünü lsitesi İskonto Mantığını anlatayım

Ön Şartlar: Fabrika diyor ki; (bizde müşteriye demek zorunda kalıyorduk) Biz 1 kamyon veya tırı full tam dolu göndeririz, ne 1 m2 fazla, ne de 1 m2 eksik, sadece ve sadece araçlardan birini tam doldurursanız göndeririz. Bu kural, minimum alım şeklinde muhakkak işlenmeli sistemimize. Ne zaman esniyor alım miktarı  
1 tırı geçti diyelim, 1 de kamyon dolmalı, bu miktarıda geçerse 2 tır tam dolmalı. Bu kural taşyününde ve net şekilde çalışıyor. Bu kuralı ne bozar, eğer seçilen levhadan stoğumuzda var ise depo teslim, nakliye hariç fiyat ile  (istanbul - Tuzla) şeklinde verebilriiz. Ürünlere stok adında bir bölüm ekleyip miktar girebiliriz sistem kurulumu açsından sadece bir fikir

Mesela
 Dalmaçyalı Stonewool SW035 Taşyünü Yalıtım Levhası 3cm ürünü için İSK1 sütununda bizim listemizde 18 yazıyor, bu 18 in anlamı default değer şu:
İstanbuldan tam dolu 1 Tır" alım için geçerli iskonto, sistemde hesaplarken m2 mantığını çalıştırıp pakete denkleştiriyoruz. 3 cm levhanın minimum alımı ne kadardı  1.165,40 ₺ paket fiyatı, 194,23 m2 fiyatı bu fiyatlar 2.496 m2 alımda geçerli, eğer 1 kamyonda 3cm kalınlık tam dolu 1.344 m2 olursa iskonto %14 e düşer. 


(If) eğer ürünün kalınlığa göre değişen metraj oranlarında kamyon miktarına denk gelirse yani tam dolu tır 2.496 m2, şehir değişir Balıkesir olursa iskonto %22 ye çıkar, 1.344 m2 olursa  %18 e düşer

(If) yine aynı ürün Dalmaçyalı sw035 3 cm lik üzerinden devam ediyoruz, şehir Bursa seçilirse Tır iskontosu %21, metraj tırdan 1 m2 bile düşük olursa %17 iskonto (Metraj artırıp iskontodan faydalanma noktası teklif aşamasında wizardda veya sonuçlarda vurgulanmalı)

Taşyünü için durum bu şekilde, eminim, umarım net anlaşılmıştır.


Kalem Bazında Ambalaj Tır Kampanyası.xlsx adıyla bize gelen lsitede ise 2 sayfa sekmesi olan,  DALMAÇYALI ve EXPERT diğerinde FAWORİ OPTİMİX yazan liste var. 


Bu listede DALMAÇYALI VE EXPERT te bize 2 iskonto sütunu ile karşılıyor, ilk sütundaki 9 bizimde içinde bulunduğumuz şehir istanbulunda dahil olduğu Bölge 1 şehirlerinin iskontosunu ifade ediyor. Bölge 1 Şehirleri Adana, Aksaray, Bilecik, Bolu, Bursa, Çorum, Düzce, İstanbul, Kahramanmaraş, Kayseri, Kırıkkale, Kırşehir, Kocaeli, Nevşehir, Niğde, Osmaniye, Sakarya,Sivas, Yalova ve Yozgat bu şehirlerin iskontosu %9 Eğer 


2. Bölgeden Adıyaman, Afyonkarahisar, Amasya, Ankara, Balıkesir, Bartın, Batman, Bayburt, Çankırı, Diyarbakır, Edirne, Elazığ, erzincan, Eskşehir, Gaziantep, Giresun ve devamı bu listeleri ekte bulabilirsiniz, listelerin içindede bulabilirsiniz

bu listeden olursa %7 ye düşer iskonto oranı ve hesaplama buna göre devam eder. Bölge iskontosu da %5 Ağrı, Antalya,Ardahan, Aydın, Bingöl ile başlayıp devame den ilelrimizi kapsıyor tüm listelerde görebilirsiniz hangi şehirler olduğunu. DALMAÇYALI ve EXPERT EPS ve Toz grubu aksesuarları için durum bu şekilde

FAWORİ OPTİMİX için ise 1.sütundaki İSK1 için yine 9 yazılı geliyor, aynı mantık devam ediyor, bölge ve şehir değiştikçe iskonto oranı %7-%5 şeklinde dğeişiyor

İSK2 sütununda yazan 4. satırda "Fawori Optimix Isı Yalıtım Levhası Karbonlu 2 cm" ürünü ile başlayan ve 17. satırda "Fawori Optimix Mineral Kaplama (çizgi) 25 kg" ile biten ürünlere kadar %16 iskonto olduğunu görüyoruz listenin devamında ise %8 sabit.  %16 iskonto yapılan alan için ise yine özel bir iskonto alanı var şehre göre adı OPTİMİX BÖLGE İSKONTOSU buda tablonun içinde fiyat lsitesinde var yine ekte ekliyorum 

İskonto mantığı bu şekilde çalışıyor Filli boya grubu için.

Site ön yüzünde Taşyünü ve ya EPS seçildiğinde dış cephede kullanılan markalar, marka seçildiğinde, ilgili modeller çıkıyor, ondan sonra kalınlık seçilip, altındaki input alanına metraj giriliyor, sonraki sayfada şehir il ilçe girilip 3 seçenek sunuluyor

Amaç bu wizardda dorğu iskontoları uygulayarak gösterebilmek.

Henüz hazır olmayan tüm ürünleri klasik eticaret sitesi gibi sunma mantığı ilede gösterirken sayfa içinde yine aynı mantığı çalıştırarak doğru fiyatlar verebilmek

---

## 🗺️ İskonto ve Nakliye Sistemi — Tam Harita (Mart 2026 Güncel)

> Bu bölüm 21 Mart 2026'da doğrulandı ve DB verileriyle karşılaştırıldı.

### shipping_zones Sütunları — Gerçek Anlamları

| Sütun | Kimler için | Ne anlama gelir |
|---|---|---|
| `discount_tir` | Taşyünü levha | Tam TIR iskontosu (İSK1 — araç bazlı) |
| `discount_kamyon` | Taşyünü levha | Tam kamyon iskontosu (İSK1 — araç bazlı) |
| `eps_toz_region_discount` | Dalmaçyalı + Expert toz/EPS | Bölge iskontosu (İSK1 — bölge bazlı) |
| `optimix_toz_discount` | Optimix toz ürünleri | Bölge iskontosu (İSK1 — bölge bazlı) |
| `optimix_levha_discount` | Yalnızca Optimix levha | Bölge bazlı İSK2 (ürün + bölge kombine) |
| `base_shipping_cost` | Parsiyel/küçük siparişler | Araç başı nakliye bedeli (TL) |

### Bölge Sistemi — 2 FARKLI Harita (Toz/EPS ürünleri için)

> ⚠️ İki toz sütunu **farklı** bölge haritalarını kullanır. Karıştırmayın.

#### Harita A: Filli Boya / Dalmaçyalı — `eps_toz_region_discount` (20/34/27 il)
*Kaynak: Şubat 2026 Filli Boya Isı Yalıtım Grubu Satış Şartları*

| Bölge | İskonto | İl Sayısı | İller |
|---|---|---|---|
| Bölge 1 | **%9** | 20 | Adana, Aksaray, Bilecik, Bolu, Bursa, Çorum, Düzce, İstanbul, Kahramanmaraş, Kayseri, Kırıkkale, Kırşehir, Kocaeli, Nevşehir, Niğde, Osmaniye, Sakarya, Sivas, Yalova, Yozgat |
| Bölge 2 | **%7** | 34 | Adıyaman, Afyonkarahisar, Amasya, Ankara, Balıkesir, Bartın, Batman, Bayburt, Çankırı, Diyarbakır, Edirne, Elazığ, Erzincan, Eskişehir, Gaziantep, Giresun, Gümüşhane, Hatay, Karabük, Karaman, Kilis, Kırklareli, Konya, Kütahya, Malatya, Mardin, Mersin, Ordu, Samsun, Şanlıurfa, Sinop, Tekirdağ, Tokat, Zonguldak |
| Bölge 3 | **%5** | 27 | Ağrı, Antalya, Ardahan, Artvin, Aydın, Bingöl, Bitlis, Burdur, Çanakkale, Denizli, Erzurum, Hakkari, Iğdır, Isparta, İzmir, Kars, Kastamonu, Manisa, Muğla, Muş, Rize, Siirt, Şırnak, Trabzon, Tunceli, Uşak, Van |

#### Harita B: Fawori / Optimix — `optimix_toz_discount` (34/28/19 il)
*Kaynak: Fawori Optimix Gebze bölge iskonto listesi*

| Bölge | İskonto | İl Sayısı | İller |
|---|---|---|---|
| Bölge 1 | **%9** | 34 | Adana, Adıyaman, Aksaray, Batman, Bilecik, Bingöl, Bitlis, Bolu, Bursa, Çorum, Diyarbakır, Düzce, Elazığ, İstanbul, Kahramanmaraş, Kayseri, Kırıkkale, Kırşehir, Kocaeli, Malatya, Mardin, Muş, Nevşehir, Niğde, Osmaniye, Sakarya, Şanlıurfa, Siirt, Sivas, Şırnak, Tunceli, Van, Yalova, Yozgat |
| Bölge 2 | **%7** | 28 | Afyonkarahisar, Amasya, Ankara, Balıkesir, Bartın, Bayburt, Çankırı, Edirne, Erzincan, Eskişehir, Gaziantep, Giresun, Gümüşhane, Hakkari, Hatay, Karabük, Karaman, Kilis, Kırklareli, Konya, Kütahya, Mersin, Ordu, Samsun, Sinop, Tekirdağ, Tokat, Zonguldak |
| Bölge 3 | **%5** | 19 | Ağrı, Antalya, Ardahan, Artvin, Aydın, Burdur, Çanakkale, Denizli, Erzurum, Iğdır, Isparta, İzmir, Kars, Kastamonu, Manisa, Muğla, Rize, Trabzon, Uşak |

> **Fark:** Optimix haritasında doğu illeri (Batman, Bingöl, Diyarbakır, Elazığ vb.) Bölge 1'de; Filli Boya haritasında ise Bölge 2-3'te.

### Ürün Tipine Göre Fiyat Hesaplama Formülleri

#### 1. Taşyünü Levha (Dalmaçyalı / Expert)
```
Liste fiyatı → plate_prices.base_price (KDV HARİÇ)

Katalog gösterimi:
  displayPrice = base_price × (1 - discount_tir / 100)
  [Şehir seçilince discount_tir değişir]

Wizard hesabı (tam satış fiyatı):
  kdvHaric = base_price × (1 - isk1/100) × (1 - isk2/100) × 1.10
  kdvDahil = kdvHaric × 1.20
  [isk1 = plates.discount_1, isk2 = plates.discount_2]
```

#### 2. Optimix Levha
```
Liste fiyatı → plate_prices.base_price (KDV HARİÇ)

Katalog gösterimi:
  displayPrice = base_price × (1 - optimix_levha_discount / 100)

Wizard hesabı:
  kdvHaric = base_price × (1 - isk1/100) × (1 - isk2/100) × 1.10
  [isk2 = optimix_levha_discount (bölge bazlı)]
```

#### 3. Dalmaçyalı / Expert Toz & EPS Aksesuarlar
```
Liste fiyatı → accessories.base_price (KDV DAHİL)

Hesap:
  kdvHaric = base_price / 1.20
  iskontolu = kdvHaric × (1 - isk1/100) × (1 - isk2/100)
  kdvDahilSatis = iskontolu × 1.10 × 1.20
  [isk1 = eps_toz_region_discount (şehre göre), isk2 = accessories.discount_2]
```

#### 4. Optimix Toz Aksesuarlar
```
Liste fiyatı → accessories.base_price (KDV DAHİL)

Hesap:
  kdvHaric = base_price / 1.20
  iskontolu = kdvHaric × (1 - isk1/100) × (1 - isk2/100)
  kdvDahilSatis = iskontolu × 1.10 × 1.20
  [isk1 = optimix_toz_discount (şehre göre), isk2 = accessories.discount_2]
```

### base_shipping_cost — Ne Zaman Devreye Girer?

Fabrika tam araç doldurmadan sevk etmez. Parsiyel sipariş (kamyon dolduramayan) durumunda nakliye bedeli ayrıca ödenir:

| Şehir | base_shipping_cost | Açıklama |
|---|---|---|
| İstanbul | 0 | Tuzla depo — müşteri gelebilir |
| Balıkesir | 0 | Fabrika — sıfır mesafe |
| Kocaeli | ₺500 | Yakın ama depo yok |
| Ankara | ₺3.000 | Uzak mesafe parsiyel |
| İzmir | ₺3.500 | En uzak aktif hat |

WizardCalculator'da şu an `shippingCost: 0` sabit (TODO notu var) — parsiyel nakliye entegrasyonu yapılmadı.

### DB Güncel Durumu (21 Mart 2026)

| Tablo/Sütun | Durum |
|---|---|
| `logistics_capacity` — 3-10cm | ✅ Dolu |
| `logistics_capacity` — 11-20cm | ✅ Eklendi (21.03.2026) |
| `discount_tir / discount_kamyon` — 81 il | ✅ Ocak 2025 listesinden güncellendi |
| `eps_toz_region_discount` — 81 il | ✅ 3 bölge (9/7/5) tam dolu |
| `optimix_toz_discount` — 81 il | ✅ 3 bölge (9/7/5) tam dolu |
| `optimix_levha_discount` — 5 il özel | ✅ İst/Koc/Ank/Bal/İzm farklı |

---

## ⚠️ Risk Analizi (21 Mart 2026)

### ✅ Kapatıldı Risk 1: Katalog Fiyat Paneli Yanlış İskonto Kullanıyordu

**Dosya:** `components/catalog/ProductPricePanel.tsx`
**Düzeltme (21.03.2026):** `product.brand.name` kontrolüyle:
- Optimix → `optimix_levha_discount` (ISK2 bölge bazlı)
- Dalmaçyalı/Expert → `discount_tir` (TIR iskontosu)

### 🟡 Orta Risk 2: optimix_levha_discount 76 Şehirde Doğrulanmadı

**Durum:** 76 şehir %16 default değerinde (seed SQL'den)
**Soru:** Optimix levha bölge iskontosu da 9/7/5 mi yoksa sabit mi?
**Etki:** Katalog Optimix levha fiyatı yanlış çıkabilir
**Aksiyon:** Optimix levha bölge iskonto listesi temin edilip güncellenmeli

### 🟡 Orta Risk 3: WizardCalculator Nakliye Hesaplamıyor

**Dosya:** `components/wizard/WizardCalculator.tsx` satır 624
**Durum:** `shippingCost: 0` — sabit sıfır
**Etki:** Ankara/İzmir müşterileri nakliye ücreti görmüyor
**Aksiyon:** `calcPricing.ts`'teki `resolveShipping()` wizard'a bağlanmalı

### 🟢 Düşük Risk 4: plates.discount_1 / discount_2 Taşyünü İçin

**Durum:** SW035 için discount_1=9, discount_2=8 — bu Kalem Bazında Ambalaj listesinden geliyor
**Soru:** Taşyünü wizard hesabında ISK1 olarak `plates.discount_1` mı yoksa `discount_tir` mi kullanılıyor?
**Aksiyon:** `calculateSalePrice` fonksiyonu gözden geçirilmeli

### ✅ Kapanan Riskler

| Risk | Çözüm |
|---|---|
| 76 ilde `discount_tir/kamyon = 0` | Ocak 2025 listesinden güncellendi |
| `eps_toz_region_discount` eksik | 81 il Filli Boya bölge haritasıyla dolduruldu |
| `optimix_toz_discount` eksik | 81 il Fawori/Optimix bölge haritasıyla dolduruldu |
| ProductPricePanel yanlış iskonto kolonu | `product.brand` kontrolüyle Dalmaçyalı→discount_tir, Optimix→optimix_levha_discount düzeltildi |
| PROJE_BAGLAM bölge haritası hatalı | İki ayrı harita (Filli Boya/Dalmaçyalı 20/34/27 ve Fawori/Optimix 34/28/19) olarak güncellendi |
| 10cm üzeri kalınlık yok | 11-20cm logistics_capacity eklendi |

---


## 📑 İçindekiler

1. [Proje Özeti](#1-proje-özeti)
2. [Proje Vizyonu & Hedefler](#2-proje-vizyonu--hedefler)
3. [Kritik İş Kuralları](#3-kritik-iş-kuralları-business-logic)
4. [Teknik Yapı](#4-teknik-yapı)
5. [Fiyatlandırma Mantığı](#5-fiyatlandırma-mantığı)
6. [Üç Paket Sistemi](#6-üç-paket-sistemi)
7. [Yeni Özellikler (Game Changers)](#7-yeni-özellikler-game-changers)
8. [Veritabanı Mimarisi](#8-veritabanı-mimarisi)
9. [UI/UX Tasarım Konsepti](#9-uiux-tasarım-konsepti)
10. [Mevcut Durum & Tamamlananlar](#10-mevcut-durum--tamamlananlar)
11. [Bekleyen Görevler](#11-bekleyen-görevler)
12. [Bilinen Sorunlar ve Çözümleri](#12-bilinen-sorunlar-ve-çözümleri)
13. [Yol Haritası](#13-yol-haritası)
14. [Hızlı Referans Tablosu](#14-hızlı-referans-tablosu)
15. [Geliştirme Ortamı](#15-geliştirme-ortamı)

---

## 1. Proje Özeti

### Amaç
Taşyünü ve EPS yalıtım malzemeleri için **lojistik tabanlı dinamik fiyatlandırma** sistemi.

### Ne Yapıyoruz?
Klasik e-ticaret sitesi **DEĞİL**, bir **"Lojistik Tabanlı Paket Konfigüratörü"** inşa ediyoruz.

**Temel Fark:** Müşteri sadece "ürün" seçmiyor, bir "lojistik operasyon" satın alıyor. Sistem, arka planda tır/kamyon kapasiteleri, coğrafi iskontolar, stok durumu gibi onlarca parametreyi işleyerek müşteriye **3 akıllı paket seçeneği** sunuyor.

### Mevcut Site
- **URL:** [tasyunufiyatlari.com](https://tasyunufiyatlari.com)
- **Trafik:** Günlük 50-60 ziyaretçi
- **SEO Değeri:** Var (korunacak)
- **Sorun:** Basit ürün listeleme - müşteri kafası karışıyor

### Yeni Uygulama
- **Framework:** Next.js 16 (App Router)
- **Backend:** Supabase (PostgreSQL)
- **Yaklaşım:** Tesla'nın "Arabanı Tasarla" konsepti - self-servis ama akıllı

---

## 2. Proje Vizyonu & Hedefler

### Neden Yapıyoruz?

1. **Analytics Gerçeği:** 15 aylık veri "10cm taşyünü + paket hesaplama" aramalarını gösteriyor
2. **Operasyonel Zorluk:** Filli Boya "yarım tır çıkarmam" diyor, müşteri "1 paket kaç m²?" soruyor
3. **Rekabet Avantajı:** Akıllı self-servis sistem

### Başarı Kriterleri

| Kriter | Hedef |
|--------|-------|
| Müşteri fiyat görme süresi | **30 saniye** |
| Tır doluluk oranı | **%80+** (lojistik optimizasyonu) |
| Bounce rate | **%40 → %15** (mevcut siteden) |
| Manuel teklif süresi | **45 dk → 5 dk** |

---

## 3. Kritik İş Kuralları (Business Logic)

> ⚠️ **UYARI:** Bu kurallar projenin kaderini belirliyor. Hiçbiri atlanamaz!

### KURAL #1: "TIR DOLMADAN ÇIKMAZ" PRENSİBİ

**Kaynak:** Filli Boya (Taşyünü Üreticisi)
**Kural:** Fabrika, kamyon veya tır tam dolmadan taşyünü sevk etmiyor

#### Kalınlık Bazlı Minimum Miktarlar

> **Kaynak:** `tasyunu_maliyet.csv` - Gerçek lojistik verileri
> **Levha Boyutu:** 600mm × 1000mm = 0.6 m²/levha

| Kalınlık | Paket İçi Adet | 1 Paket (m²) | Kamyon (m²) | Tır (m²) | Paket/Kamyon | Paket/Tır |
|----------|----------------|--------------|-------------|----------|--------------|-----------|
| 3 cm     | 10             | 6.0          | 1.344,00    | 2.496,00 | 224          | 416       |
| 4 cm     | 6              | 3.6          | 1.008,00    | 1.872,00 | 280          | 520       |
| 5 cm     | 6              | 3.6          | 806,40      | 1.497,60 | 224          | 416       |
| 6 cm     | 5              | 3.0          | 672,00      | 1.248,00 | 224          | 416       |
| 7 cm     | 4              | 2.4          | 537,60      | 998,40   | 224          | 416       |
| 8 cm     | 3              | 1.8          | 504,00      | 936,00   | 280          | 520       |
| 9 cm     | 3              | 1.8          | 453,60      | 842,40   | 252          | 468       |
| 10 cm ⭐| 3              | 1.8          | 403,20      | 748,80   | 224          | 416       |

**Not:** 10 cm en popüler kalınlıktır (Analytics verisi)

### KURAL #2: COĞRAFİ İSKONTO SİSTEMİ

**Merkez:** Tuzla/İstanbul (Depo) + Balıkesir (Fabrika)
**Mantık:** Mesafe + Hacim = Fiyat

#### Üç Bölge Stratejisi

**🟢 YEŞİL BÖLGE** (Nakliye Dahil - En İyi Fiyat)
- **İller:** İstanbul, Kocaeli, Sakarya, Düzce, Bolu, Balıkesir, Bursa
- **Şart:** Full kamyon/tır
- **Kaynak:** Direkt Balıkesir Fabrika

**🟡 SARI BÖLGE** (Depo Parsiyel)
- **İlçeler:** Tuzla, Pendik, Kartal, Maltepe, Sultanbeyli, Sancaktepe, Gebze
- **Şart:** Stokta olmalı
- **Kaynak:** Tuzla Depo
- **Fiyat:** Fabrika + İç Nakliye + Kar Marjı

**🔴 KIRMIZI BÖLGE** (Nakliye Hariç)
- **Durum:** Uzak il + Az miktar (örn: Sivas'tan 100 m²)
- **Çözüm:** "Nakliye Alıcıya Aittir" (EX-WORKS fiyat)
- **Alternatif:** "Tuzla depomuzdan aldırabilirsiniz"

### KURAL #3: EPS ÖZEL ŞARTLARI

- **Minimum:** 250 m² (Taşyünü'nden farklı)
- **ZORUNLU:** Toz grubu ile birlikte satılır
- **Neden:** Fabrika kuralı - tekil satış yok

**UI Kuralı:** Müşteri EPS seçerse, sepete otomatik yapıştırıcı/sıva eklenir ve silinmesine izin verilmez.

### KURAL #4: HİBRİT PAKET STOK KONTROLÜ

**Senaryo:** En Ucuz Kombinasyon (Dalmaçyalı Levha + All Alçı Sıva)
**Şart:** İkisi de Tuzla deposunda olmalı
**Yoksa:** "Tükendi" veya "Sadece Fabrika Teslim (Full Set)"

### KURAL #5: "10CM KRALDIR" STRATEJİSİ

**Analytics Kanıtı:** 15 aylık veri 10cm'nin 5cm ve 8cm'den çok daha fazla arandığını gösteriyor

**Aksiyon:**
- Sihirbaz varsayılanı: **10cm + Taşyünü**
- SEO: `/10-cm-tasyunu-fiyatlari` ana Landing Page

---

## 4. Teknik Yapı

### Frontend

| Teknoloji | Versiyon | Kullanım |
|-----------|----------|----------|
| **Next.js** | 16.0.8 | App Router, SSR, ISR |
| **React** | 19.2.1 | UI Library |
| **TypeScript** | ^5 | Type Safety |
| **Tailwind CSS** | ^4 | Styling |

**Konum:** `c:\Users\Emrah\Desktop\Tasyunufİyatlari\tasyunu-front\`

### Backend & Database

| Teknoloji | Açıklama |
|-----------|----------|
| **Supabase** | PostgreSQL + Real-time + Auth |
| **PostgreSQL** | Complex queries, JSONB |

### Veritabanı Tabloları

#### Temel Tablolar
- `brands` - Markalar (Dalmaçyalı, Expert, Optimix, Kaspor, OEM)
- `plates` - Levhalar (EPS, Taşyünü)
- `plate_prices` - Kalınlık bazlı levha fiyatları ⭐
- `accessories` - Toz grubu ürünleri
- `accessory_types` - Aksesuar tipleri ve sarfiyat oranları
- `package_definitions` - 3 paket tanımı
- `material_types` - Malzeme tipleri (eps, tasyunu)

#### Lojistik & Coğrafi
- `shipping_zones` - Şehir bazlı nakliye ve iskonto bilgileri
- `shipping_districts` - İlçe bazlı ek nakliye maliyetleri

#### Gelecek Tablolar (Anayasa'dan)
- `warehouse_inventory` - Depo stok takibi
- `payment_terms` - Vade farkı ayarları
- `competitor_prices` - Rakip istihbarat

---

## 5. Fiyatlandırma Mantığı

### İskonto Sistemi

- **İSK1:** Ürün bazlı sabit iskonto (veritabanından)
- **İSK2:** Marka ve bölgeye göre değişen iskonto
  - **Dalmaçyalı/Expert:** Ürün bazlı (veritabanından)
  - **Optimix Levha:** Bölge bazlı (`shipping_zones.optimix_levha_discount`)
  - **Optimix Toz:** Ürün bazlı (veritabanından)

### KDV Mantığı

| Ürün Tipi | Liste Fiyatı | `is_kdv_included` |
|-----------|--------------|-------------------|
| **Taşyünü Levha** | KDV HARİÇ | `false` |
| **EPS Levha** | KDV DAHİL | `true` |
| **Toz Grubu** | KDV DAHİL | `true` |

### Hesaplama Formülü

```typescript
// 1. KDV hariç fiyata normalize et
const kdvHaricListe = isKdvIncluded ? basePrice / 1.20 : basePrice;

// 2. İskonto uygula
const iskontoluFiyat = kdvHaricListe * (1 - isk1/100) * (1 - isk2/100);

// 3. Kar ekle (%10)
const karliKdvHaric = iskontoluFiyat * 1.10;

// 4. KDV ekle (müşteriye göster)
const kdvDahilSatis = karliKdvHaric * 1.20;
```

**Kod Konumu:** [`app/page.tsx:306-348`](tasyunu-front/app/page.tsx#L306-L348) - `calculateSalePrice` fonksiyonu

---

## 6. Üç Paket Sistemi

> **PSİKOLOJİ:** "Decoy Effect" kullanıyoruz. Müşteri tek fiyat görse "pahalı" deyip gider. Ama 3 seçenek sunarsak ortadakini alır (%60 satış).

### 🥉 EN UCUZ KOMBİNASYON

**Hedef Kitle:** Bütçesi kısıtlı
**Strateji:** Levha marka ama toz grubu yan sanayi

**Örnek Kombinasyon:**
- **Levha:** Dalmaçyalı 5cm (Marka)
- **Yapıştırıcı & Sıva:** All Alçı / TEKNO / ONAT (Yerel)
- **Dübel:** Standart kalite
- **File:** 145gr
- **Garanti:** 2 yıl malzeme
- **Fiyat:** ~196 TL/m² (500 m² için 98.450 TL)
- **Satış Oranı:** %25

### 🥈 DENGELİ SİSTEM ⭐ "EN ÇOK TERCİH EDİLEN"

**Hedef Kitle:** Marka isteyenler ama full orijinal istemeyenler
**Strateji:** Levha + toz grubu farklı markalar (akıllı kombine)
**Badge:** "EN ÇOK TERCİH EDİLEN" (kartı %5 büyük göster)

**Örnek Kombinasyon:**
- **Levha:** Dalmaçyalı 5cm
- **Yapıştırıcı & Sıva:** Fawori / Optimix
- **Dübel:** Fawori standart
- **File:** 160gr
- **Garanti:** 5 yıl sistem
- **Fiyat:** ~220 TL/m² (500 m² için 110.000 TL)
- **Satış Oranı:** %60 🎯

### ⭐ 1. KALİTE PAKETİ

**Hedef Kitle:** "En iyisini istiyorum" diyen
**Strateji:** Tam takım orijinal sistem

**Örnek Kombinasyon:**
- **Levha:** Dalmaçyalı 5cm
- **Yapıştırıcı & Sıva:** Dalmaçyalı Orijinal
- **Dübel:** Dalmaçyalı Avrupa kalite
- **File:** 160gr Dalmaçyalı
- **Garanti:** 10 yıl tam kapsam
- **Fiyat:** ~250 TL/m² (500 m² için 125.000 TL)
- **Satış Oranı:** %15

### Her Pakette Neler Var?

1. **Levha** (EPS veya Taşyünü)
2. **Yapıştırıcı**
3. **Sıva**
4. **Dübel** (kalınlığa uygun boy)
5. **File** (Donatı Filesi)
6. **Fileli Köşe**
7. **Astar**
8. **Mineral Kaplama**

**Otomatik dübel boyu kuralı (14 Ağustos 2026 teyidi):**
- Taşyünü 3–6 cm levha: en az 11,5 cm çelik çivili dübel
- Taşyünü 7–10 cm levha: en az 15,5 cm çelik çivili dübel
- EPS 3–6 cm levha: en az 9,5 cm plastik dübel (TEKNO karşılığı 10 cm)
- EPS 7–10 cm levha: en az 11,5 cm plastik dübel (TEKNO karşılığı 12 cm)
- 10 cm üstü levhada doğrulanmış otomatik eşleştirme yoktur; sistem yanlış
  kısa dübel seçmek yerine seti eksik işaretler.
- `accessories.dowel_length` eski TEKNO kayıtlarında mm (`115`, `155`), diğer
  kayıtlarda cm (`11.5`, `15.5`) tutulduğu için seçim öncesi cm'ye normalize edilir.

### Toz Grubu Markaları

**Yan Sanayi:**
- All Alçı (Eskişehir)
- TEKNO
- ONAT
- ENTEGRE

**Marka:**
- Dalmaçyalı (Orijinal)
- Fawori
- Optimix

> **NOT:** Kaspor = Sadece EPS levha üreticisi (toz grubu YOK)

---

## 7. Yeni Özellikler (Game Changers)

### 1. 💰 Finans Modülü: "Vade Farkı Sihirbazı"

**Sorun:** İnşaat sektöründe nakit ≠ vadeli fiyat. Excel'de manuel hesaplama hata riski yüksek.

**Çözüm:** Admin panelinde "Aylık Vade Farkı Oranı" ayarı (örn: %4)

**Müşteri Görecek:**
```
ÖDEME SEÇENEKLERİ
━━━━━━━━━━━━━━━━━━━━━━━
💵 Nakit         : 100.000 TL
📅 30 Gün Vadeli : 104.000 TL (+%4)
📅 60 Gün Vadeli : 108.160 TL (+%8.16)
📅 90 Gün Vadeli : 112.486 TL (+%12.49)
```

**Formül:** `Yeni_Fiyat = Baz_Fiyat × (1 + Oran)^Ay_Sayısı`

**Durum:** ⏳ Henüz uygulanmadı

### 2. 🕵️ Rakip İstihbarat: "Hayalet Bot"

**Ne Yapar:** Her sabah 09:00'da rakip sitelere gidip fiyat toplar

**Teknoloji:** Puppeteer/Cheerio (web scraping)

**Admin Görecek:**
```
🚨 PİYASA UYARISI (09:12)
━━━━━━━━━━━━━━━━━━━━━━━
5cm Taşyünü Fiyatları:

Senin Fiyatın : 150 TL/m²
Rakip A       : 145 TL ⚠️ (dün 155)
Rakip B       : 148 TL

Öneri: Piyasanın %3 üzerindesin
```

**Durum:** ⏳ Henüz uygulanmadı

### 3. 🚚 Lojistik Gamification: "İlerleme Çubuğu"

Müşteri 300 m² girdi, kamyon %85 dolu:

```
🚚 LOJİSTİK DURUMU: KAMYON %85
[████████████░░░]

💡 50 m² daha eklerseniz:
   • Araç tam dolacak
   • İskonto %14 → %18'e yükselir!

[OTOMATİK TAMAMLA VE İNDİRİMİ KAP]
```

**Bar Renkleri:**
- **%0-50:** 🔴 Kırmızı (Nakliye verimsiz)
- **%50-80:** 🟡 Sarı (İyi gidiyorsunuz)
- **%80-100:** 🟢 Yeşil (Harika! Az kaldı)
- **%100:** 🎉 Tam Tır Bonusu - %15 İlave İskonto!

**Durum:** ⏳ Henüz uygulanmadı

### 4. 🎯 SEO Dinamik Landing Pages

Google'da "500 m² mantolama fiyatı" arayanlar için:

**URL Örnekleri:**
- `/paketler/500-m2-dalmacyali-mantolama`
- `/paketler/1000-m2-fawori-paket-fiyati`
- `/paketler/250-m2-ekonomik-mantolama`

**Özellik:** Müşteri bu linkten geldiğinde 500 m² ZATEN GİRİLMİŞ, 3 paket kartı HAZIR!

**Durum:** ⏳ Henüz uygulanmadı

### 5. 📦 Sihirbazın İlk Sorusu

**Sorun:** Kullanıcılar "1 paket kaç m²?" diye kafayı yiyor

**Çözüm:**
```
Nasıl Hesaplamak İstersiniz?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔘 Metrekare Biliyorum
   (Örn: 500 m² yerim var)
   → Sistem pakete çevirir

🔘 Paket Sayısı Biliyorum
   (Örn: Usta 50 paket dedi)
   → Sistem m²'ye çevirir
```

**Hesaplama:**
- 50 paket × 1.8 m² = 90 m² (10cm için)
- 500 m² ÷ 1.8 = 278 paket

**Durum:** ⏳ Henüz uygulanmadı

---

## 8. Veritabanı Mimarisi

> ⚠️ Bu klasik e-ticaret veritabanı DEĞİL. **"Reçete" (Recipe)** odaklı yapı.

### Mevcut Tablolar (Supabase)

#### 1. `brands` - Markalar
```sql
CREATE TABLE brands (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  tier TEXT, -- 'premium', 'standard', etc.
  description TEXT
);
```

**Veriler:** Dalmaçyalı, Expert, Optimix, Fawori, Kaspor, OEM, Knauf, Tekno, Filli Boya

#### 2. `material_types` - Malzeme Tipleri
```sql
CREATE TABLE material_types (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE -- 'tasyunu', 'eps'
);
```

#### 3. `plates` - Levhalar
```sql
CREATE TABLE plates (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  brand_id BIGINT REFERENCES brands(id),
  category_id BIGINT,
  material_type_id BIGINT REFERENCES material_types(id),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  density NUMERIC,
  thickness_options INTEGER[],
  base_price_per_cm NUMERIC,
  base_price NUMERIC,
  package_m2 NUMERIC,
  discount_1 NUMERIC,
  discount_2 NUMERIC,
  is_kdv_included BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true
);
```

#### 4. `plate_prices` - Kalınlık Bazlı Fiyatlar ⭐
```sql
CREATE TABLE plate_prices (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  plate_id BIGINT REFERENCES plates(id),
  thickness INTEGER NOT NULL,
  base_price NUMERIC NOT NULL,
  is_kdv_included BOOLEAN DEFAULT false
);
```

**Önemi:** Kalınlık bazlı fiyatlandırma için kritik tablo!

#### 5. `accessories` - Toz Grubu
```sql
CREATE TABLE accessories (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  brand_id BIGINT REFERENCES brands(id),
  accessory_type_id BIGINT REFERENCES accessory_types(id),
  name TEXT NOT NULL,
  short_name TEXT,
  unit TEXT, -- 'KG', 'PKT', 'ADET', 'MT', 'M2'
  unit_content NUMERIC,
  base_price NUMERIC,
  is_for_eps BOOLEAN DEFAULT false,
  is_for_tasyunu BOOLEAN DEFAULT false,
  dowel_length NUMERIC, -- Dübel için
  discount_1 NUMERIC,
  discount_2 NUMERIC,
  discount_rate_2 NUMERIC,
  is_kdv_included BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true
);
```

#### 6. `accessory_types` - Aksesuar Tipleri
```sql
CREATE TABLE accessory_types (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER,
  consumption_rate_eps NUMERIC,
  consumption_rate_tasyunu NUMERIC
);
```

**Veriler:** yapistirici, siva, dubel, file, fileli-kose, astar, kaplama

#### 7. `package_definitions` - Paket Tanımları
```sql
CREATE TABLE package_definitions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  plate_brand_id BIGINT REFERENCES brands(id),
  accessory_brand_id BIGINT REFERENCES brands(id),
  tier TEXT, -- 'budget', 'balanced', 'premium'
  name TEXT NOT NULL,
  description TEXT,
  badge TEXT,
  sort_order INTEGER,
  warranty_years INTEGER,
  is_active BOOLEAN DEFAULT true
);
```

#### 8. `shipping_zones` - Coğrafi Fiyatlandırma
```sql
CREATE TABLE shipping_zones (
  city_code INTEGER PRIMARY KEY,
  city_name TEXT NOT NULL,
  base_shipping_cost NUMERIC DEFAULT 0,
  discount_kamyon NUMERIC DEFAULT 0,
  discount_tir NUMERIC DEFAULT 0,
  optimix_toz_discount NUMERIC DEFAULT 9,
  optimix_levha_discount NUMERIC DEFAULT 16,
  is_active BOOLEAN DEFAULT true
);
```

#### 9. `shipping_districts` - İlçe Detayları
```sql
CREATE TABLE shipping_districts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  city_code INTEGER REFERENCES shipping_zones(city_code),
  name TEXT NOT NULL,
  extra_cost NUMERIC DEFAULT 0,
  is_remote BOOLEAN DEFAULT false
);
```

### Gelecek Tablolar (Anayasa'dan)

#### `warehouse_inventory` - Depo Stok
```sql
CREATE TABLE warehouse_inventory (
  product_id BIGINT REFERENCES products(id),
  warehouse_location TEXT DEFAULT 'Tuzla',
  quantity_in_stock INTEGER,
  reserved_quantity INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (product_id, warehouse_location)
);
```

#### `payment_terms` - Vade Farkı
```sql
CREATE TABLE payment_terms (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  term_days INTEGER NOT NULL, -- 0, 30, 60, 90
  monthly_rate NUMERIC(5,4) NOT NULL, -- 0.04 = %4
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `competitor_prices` - Rakip İstihbarat
```sql
CREATE TABLE competitor_prices (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  competitor_name TEXT NOT NULL,
  competitor_url TEXT,
  product_category TEXT,
  price NUMERIC(10,2),
  scraped_at TIMESTAMP DEFAULT NOW(),
  is_alert_sent BOOLEAN DEFAULT false
);
```

---

## 9. UI/UX Tasarım Konsepti

### Kullanıcı Akışı

#### ADIM 1: Uygulama Alanı Seçimi (YENİ!)
```
┌─────────────────────────────┐
│  🏠 Uygulama Alanı          │
├─────────────────────────────┤
│  🏢 Dış Cephe (Mantolama)   │
│  🏠 Çatı (Teras & Çatı)     │
│  🧱 Ara Bölme (Giydirme)    │
└─────────────────────────────┘
```

#### ADIM 2: Levha Markası
```
[Dalmaçyalı]  [Expert]  [Optimix]
   (Logo)      (Logo)     (Logo)
```

#### ADIM 3: Lokasyon
```
📍 İl Seçin:   [İstanbul  ▼]
   İlçe Seçin: [Tuzla     ▼]

   TIR İsk: %8
```

#### ADIM 4: Malzeme & Kalınlık
```
Yalıtım Tipi:
[Taşyünü]  [EPS]

Kalınlık:
[3cm] [4cm] [5cm] [6cm] [8cm] [10cm⭐Popüler]

Dübel: 11.5cm (otomatik)
```

#### ADIM 5: Metraj
```
Metraj (m²): [_______]
Örn: 500
```

#### ADIM 6: [3 PAKETİ KARŞILAŞTIR]

### 3 Kart Ekranı

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  EN UCUZ     │  │  DENGELİ ⭐  │  │  1. KALİTE   │
│              │  │ EN ÇOK TERCİH│  │              │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ 196 TL/m²    │  │ 220 TL/m²    │  │ 250 TL/m²    │
│ 98.450 TL    │  │ 110.000 TL   │  │ 125.000 TL   │
│              │  │              │  │              │
│ Dalmaçyalı   │  │ Dalmaçyalı   │  │ Dalmaçyalı   │
│ + All Alçı   │  │ + Fawori     │  │ + Dalmaçyalı │
│              │  │              │  │              │
│ 2 Yıl        │  │ 5 Yıl        │  │ 10 Yıl       │
│              │  │              │  │              │
│ [TEKLİF AL]  │  │ [TEKLİF AL]  │  │ [TEKLİF AL]  │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Orta Kart (Dengeli):**
- %5 daha büyük (scale-105)
- "EN ÇOK TERCİH EDİLEN" badge
- Butonu daha belirgin

### Kritik UI Kuralları

✅ **Fiyatlar görünür** - "Teklif İste" formuna gömme!
✅ **Dengeli Sistem %5 büyük**
✅ **Dropdown'sız** - Paketler hazır gelsin
✅ **Responsive** - Mobilde kartlar dikey
⚠️ **"Nakliye Dahil/Hariç" ibaresi** - Şeffaf iletişim

---

## 10. Mevcut Durum & Tamamlananlar

### ✅ Tamamlanan (Faz 1-3)

- [x] Supabase projesi kuruldu
- [x] Veritabanı şeması oluşturuldu (9 tablo)
- [x] Next.js 16 projesi kuruldu
- [x] Ana sayfa wizard'ı (`app/page.tsx` - 1155 satır)
- [x] 3 paket kartı UI tasarımı
- [x] Fiyat hesaplama motoru (`calculateSalePrice`)
- [x] Bölge bazlı iskonto sistemi
- [x] KDV dahil/hariç mantığı
- [x] Kalınlık bazlı fiyatlandırma (`plate_prices`)
- [x] Dübel otomatik seçimi (kalınlığa göre)
- [x] Uygulama kategorileri (Dış Cephe, Çatı, Ara Bölme)
- [x] Console log raporları (Excel karşılaştırma)

### 🎨 Tasarım

- [x] Marka logoları (`public/images/markalogolar/`)
- [x] Hero arka plan (bina görseli)
- [x] Responsive tasarım (mobil uyumlu)
- [x] Top bar (TIR bazlı satış mesajı)

---

## 11. Bekleyen Görevler

### 🔥 Acil (Bu Hafta)

- [ ] Supabase credentials'ı environment variable'a taşı (güvenlik!)
- [ ] Fiyat hesaplama test senaryoları
- [ ] Excel ile karşılaştırma doğrulama

### 📅 Kısa Vade (1-2 Hafta)

#### Otomatik Fiyat Güncelleme
- [ ] WhatsApp → Google Drive entegrasyonu
- [ ] Excel okuma scripti (Python/Node.js)
- [ ] Otomatik Supabase güncelleme

#### Gamification
- [ ] Lojistik bar komponenti
- [ ] Tır/Kamyon doluluk hesaplaması
- [ ] "Otomatik tamamla" butonu
- [ ] Tam tır bonusu hesabı

#### Teklif Sistemi
- [ ] Teklif formu popup
- [ ] PDF oluşturma (Puppeteer)
- [ ] Email gönderimi (Resend)
- [ ] WhatsApp entegrasyonu (opsiyonel)

### 🚀 Orta Vade (3-4 Hafta)

- [ ] Vade farkı modülü (UI + hesaplama)
- [ ] Rakip istihbarat botu (Puppeteer + Cron)
- [ ] Admin paneli (vade oranı, iskonto ayarları)
- [ ] SEO dinamik landing pages
- [ ] Sadece levha satışı (minimum kontrolü ile)

### 🌐 Uzun Vade

- [ ] tasyunufiyatlari.com entegrasyonu (URL'leri koruyarak)
- [ ] Google Analytics & Hotjar kurulumu
- [ ] A/B testing (3 paket karşılaştırma)
- [ ] Kullanıcı özelleştirme modal'ı

---

## 12. Bilinen Sorunlar ve Çözümleri

### ✅ ÇÖZÜLDÜ: Sorun 1 - Fiyatlar düşük çıkıyordu

**Sebep:** Şehir bazlı TIR iskontosu yanlış uygulanıyordu.
**Çözüm:** Dalmaçyalı/Expert için ürün bazlı iskonto kullanıldı.
**Kod:** [`page.tsx:306-348`](tasyunu-front/app/page.tsx#L306-L348)

### ✅ ÇÖZÜLDÜ: Sorun 2 - Kalınlık bazlı fiyat yoktu

**Sebep:** `plate_prices` tablosu kullanılmıyordu.
**Çözüm:** `calculatePackage` fonksiyonu güncellendi.
**Kod:** [`page.tsx:403-407`](tasyunu-front/app/page.tsx#L403-L407)

### ✅ ÇÖZÜLDÜ: Sorun 3 - KDV dahil/hariç karışıklığı

**Sebep:** Taşyünü KDV hariç, EPS/Toz KDV dahil geliyor.
**Çözüm:** `is_kdv_included` sütunu eklendi, hesaplama düzeltildi.
**SQL:** `database_kdv_update.sql`

### ⚠️ AKTİF SORUN: Supabase Credentials

**Sorun:** API key'ler hardcoded [`lib/supabase.ts`](tasyunu-front/lib/supabase.ts#L3-L4)
**Risk:** Güvenlik açığı
**Çözüm:** `.env.local` kullan + `.gitignore` ekle

### ⚠️ AKTİF SORUN: Tarih Formatları

**Sorun:** AI modellerinde tarih karışıklığı (2024 vs 2025)
**Çözüm:** Manuel kontrol + dokümanda net belirtme
**Bugün:** 12 Aralık 2025 ✅

---

## 13. Yol Haritası

> ⏱️ **GÜNCELLEME:** Cursor + Vibe Coding ile 4x hızlandı!

### Faz 1-3: Temel Altyapı ✅ TAMAMLANDI
- Veritabanı
- Frontend wizard
- Paket kartları UI
- Fiyat hesaplama motoru

**Süre:** 5-7 gün (BAŞARILDI!)

### Faz 4: İş Kuralları Entegrasyonu (2-3 gün)

**Gün 1:**
- [ ] Minimum sipariş kontrolü (kamyon/tır doluluk)
- [ ] "Nakliye Dahil/Hariç" mantığı

**Gün 2:**
- [ ] Stok kontrolü (hibrit paketler)
- [ ] EPS zorunlu toz grubu mantığı
- [ ] Vade farkı hesaplayıcı (backend)

**Gün 3:**
- [ ] Edge case'ler (stokta yok, minimum yetersiz)
- [ ] Hata mesajları (user-friendly)

### Faz 5: Yeni Özellikler (3-4 gün)

**Gün 1:**
- [ ] Finans modülü (vade farkı UI)
- [ ] Admin panel (vade oranı ayarı)

**Gün 2:**
- [ ] Rakip istihbarat bot (Puppeteer)
- [ ] Cron job kurulumu
- [ ] Admin dashboard uyarıları

**Gün 3:**
- [ ] Lojistik gamification (ilerleme barı)
- [ ] Otomatik tamamla butonu
- [ ] Tam tır bonusu hesabı

**Gün 4:**
- [ ] SEO dinamik landing pages
- [ ] URL parametrelerinden veri çekme
- [ ] Metadata optimizasyonu

### Faz 6: Teklif Sistemi (2 gün)

**Gün 1:**
- [ ] Form popup (WhatsApp + Email)
- [ ] PDF oluşturma (Puppeteer)
- [ ] PDF template tasarımı

**Gün 2:**
- [ ] Email gönderimi (Resend)
- [ ] WhatsApp entegrasyonu (opsiyonel)
- [ ] Lead kaydı (CRM)

### Faz 7: Test & Optimizasyon (2-3 gün)

**Gün 1:**
- [ ] Lighthouse skorları (100/100 hedef)
- [ ] Farklı il/ilçe senaryoları
- [ ] Mobil cihaz testleri

**Gün 2:**
- [ ] Edge case'ler
- [ ] Load testing (yük testi)
- [ ] Security audit

**Gün 3:**
- [ ] Bug fixes
- [ ] UI polish (son rötuşlar)

### Faz 8: Deployment & Launch (1 gün)

- [ ] Vercel deploy
- [ ] Domain bağlama (tasyunufiyatlari.com)
- [ ] Google Analytics kurulum
- [ ] Sitemap & robots.txt
- [ ] Soft launch (beta test)

---

## 14. Hızlı Referans Tablosu

### Kritik Sayılar

| Parametre | Değer |
|-----------|-------|
| 1 Paket Taşyünü (3cm) | 6.0 m² (10 adet levha) |
| 1 Paket Taşyünü (5cm) | 3.6 m² (6 adet levha) |
| 1 Paket Taşyünü (8cm) | 1.8 m² (3 adet levha) |
| 1 Paket Taşyünü (10cm) ⭐ | 1.8 m² (3 adet levha) |
| Tır Kapasitesi (10cm) | 748,80 m² (416 paket) |
| Kamyon Kapasitesi (10cm) | 403,20 m² (224 paket) |
| EPS Minimum Sipariş | 250 m² + Toz Grubu |
| Yeşil Bölge İller | İst, Koc, Sak, Düz, Bol, Bal, Bur |
| Sarı Bölge (Tuzla Çemberi) | Tuz, Pen, Kar, Mal, Geb |
| Dengeli Sistem Satış % | 60% (Decoy Effect) |
| Aylık Vade Farkı Oranı | %4 (ayarlanır) |
| Kar Marjı | %10 |
| KDV Oranı | %20 |

### Paket Fiyat Örnekleri (500 m²)

| Paket | Fiyat | m² Fiyatı |
|-------|-------|-----------|
| En Ucuz Kombinasyon | 98.450 TL | 196 TL/m² |
| Dengeli Sistem ⭐ | 110.000 TL | 220 TL/m² |
| 1. Kalite | 125.000 TL | 250 TL/m² |

### Excel Fiyat Listeleri Formatı

#### Taşyünü Listesi (KDV HARİÇ)
```
MALZEME İSMİ | KDV HARİÇ LİSTE | İSK1 | İSK2 | KDV HARİÇ İSKONTOLU | M2 FİYATI
```

#### EPS/Toz Grubu Listesi (KDV DAHİL)
```
MALZEME İSMİ | KDV DAHİL LİSTE | İSK1 | İSK2 | KDV DAHİL İSKONTOLU | M2 FİYATI
```

### API Endpoint Planlama

#### `/api/calculate-packages`
- **Input:** `{ m2, city, district, plate_brand, insulation_type }`
- **Output:** `[budget_package, balanced_package, premium_package]`

#### `/api/check-stock`
- **Input:** `{ package_id }`
- **Output:** `{ available: boolean, message: string }`

#### `/api/generate-quote`
- **Input:** `{ package_id, customer_info, payment_term }`
- **Output:** `{ pdf_url, email_sent: boolean }`

#### `/api/competitor-scrape`
- **Input:** `{ competitor_url }`
- **Output:** `{ prices: [...], scraped_at: string }`

#### `/api/calculate-shipping`
- **Input:** `{ city_code, total_m2 }`
- **Output:** `{ cost, zone_type, free_shipping: boolean }`

### SQL Dosyaları

| Dosya | Açıklama |
|-------|----------|
| `database_schema_v3.sql` | Ana veritabanı şeması |
| `complete_plate_data.sql` | Tüm levha ve fiyat verileri |
| `database_kdv_update.sql` | KDV sütunları ekleme ⭐ |
| `database_update.sql` | Çeşitli güncellemeler |
| `database_update_v2.sql` | İskonto güncellemeleri |

### Marka Logoları

**Konum:** `public/images/markalogolar/`

- `dalmaçyalı taşyünü fiyatları.png`
- `fawori taşyünü fiyatları.png` (Expert ve Optimix için de)
- `filli boya.png`
- `Knauf Mineral yünleri.png`
- `Tekno Taşyünü ve EPs Fiyatları.png`
- `bina-dis-cephe-kaplama-4000x4000.png` (Hero)

---

## 15. Geliştirme Ortamı

### Proje Çalıştırma

```bash
# Klasöre git
cd c:\Users\Emrah\Desktop\Tasyunufİyatlari\tasyunu-front

# Geliştirme sunucusu
npm run dev

# Varsayılan: http://localhost:3000
# Eğer meşgulse: 3001
```

### Build & Deploy

```bash
# Production build
npm run build

# Production sunucu
npm start

# Lint kontrolü
npm run lint
```

### Supabase Bağlantı

**Konum:** `lib/supabase.ts`

⚠️ **GÜVENLİK:** URL ve ANON_KEY'i `.env.local` dosyasına taşı!

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://latlzskzemmdnotzpscc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### Hosting & Deploy

- **Önerilen:** Vercel (Next.js native support)
- **Alternatif:** Netlify / Railway
- **CDN:** Cloudflare (statik assetler)
- **Database:** Supabase Cloud (PostgreSQL)

### AI Araçları (Geliştirme)

- **Cursor IDE:** Ana geliştirme ortamı (AI-assisted coding)
- **Claude Sonnet 4.5:** Mimari tasarım & karmaşık kod
- **R1T2 Chimera:** Hızlı debug & basit tasklar
- **Vibe Coding:** Tab completion ile 4x hız artışı

---

## 📝 Notlar

### İletişim

- **Proje Sahibi:** Emrah
- **Geliştirme:** Claude Sonnet 4.5 AI
- **Son Çalışma:** 12 Aralık 2025, 17:40

### Önemli Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `PROJE_BAGLAM_v2.md` | Bu dosya (güncel özet) |
| `PROJE_BAGLAM.md` | Eski versiyon (arşiv) |
| `Taşyünü Fiyatları Projesi.txt` | Proje Anayasası (1092 satır) |
| `FIYAT_GUNCELLEME_SISTEMI.md` | Fiyat güncelleme yol haritası |
| `app/page.tsx` | Ana sayfa (1155 satır) |
| `lib/supabase.ts` | Supabase client |

### Yeni Chat Açarken

> **Bu dosyayı okuyarak bağlamı yakalayabilirsiniz.**
> Dosya yolu: `c:\Users\Emrah\Desktop\Tasyunufİyatlari\PROJE_BAGLAM_v2.md`

---

## 📊 Proje Özeti (Tek Bakış)

```
📦 TaşYünü Fiyatları v2.0
├── 🎯 Amaç: Lojistik tabanlı paket konfigüratörü
├── 🛠️ Stack: Next.js 16 + Supabase
├── 💰 Özellik: 3 paket sistemi (Decoy Effect)
├── 📍 Coğrafi: Bölge bazlı iskonto
├── 🚚 Lojistik: Tır/Kamyon doluluk optimizasyonu
├── ✅ Durum: MVP tamamlandı (Faz 1-3)
├── ⏳ Gelecek: Gamification, Vade, Rakip İstihbarat
└── 🚀 Hedef: 14-18 gün içinde production

📈 Başarı Metrikleri:
   • Fiyat görme: 30 saniye
   • Tır doluluk: %80+
   • Bounce rate: %15
   • Teklif süresi: 5 dakika
```

---

**Son Güncelleme:** 12 Aralık 2025, 17:40
**Versiyon:** 2.0 (Anayasa + PROJE_BAGLAM birleştirildi)
**Oluşturan:** Claude Sonnet 4.5

---

> 💡 **İpucu:** Bu dosyayı favori editörünüzde açıp `Ctrl+F` ile arama yapabilirsiniz.
> Örn: "kdv", "iskonto", "paket", "supabase", "ui", "api", etc.
