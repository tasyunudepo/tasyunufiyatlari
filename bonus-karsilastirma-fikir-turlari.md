# Bonus ve yoğunluk bazlı karşılaştırma sayfaları — ortak fikir turu

**Katılımcılar:** Emrah · Codex · Fable 5  
**Amaç:** Müşterinin sıvalı dış cephe mantolamasına uygun ürünleri aynı masada, doğru teknik veri ve şehir bazlı fiyat akışıyla değerlendirebilmesi.

> Bu dosya karar günlüğüdür. Bir satırın yanında `Karar` yazmıyorsa, henüz canlıya alınacak iş kuralı değildir.

## 0. Kesin ticari sınır: katalog ile wizard farklıdır

| Ürün kullanım alanı | Katalogda ürün olarak yer alma | Mantolama wizard'ında teklif seçeneği |
|---|---|---|
| Sıvalı dış cephe mantolama levhası | Evet | Evet |
| Teras çatı / çatı levhası | Evet | Hayır |
| Ara bölme levhası | Evet | Hayır |
| Giydirme cephe levhası | Evet | Hayır |
| Endüstriyel taş yünü levhası | Evet | Hayır |

**Karar:** Wizard yalnızca mantolama sistemine uygun levhaları süzer. Diğer taş yünü levhaları ürün kataloğuna eklemek serbesttir; bunlar kendi kullanım alanı sayfasında tanıtılır ve gerekirse ayrı bir talep/teklif yoluna bağlanır. Bir ürünü katalogda göstermek, onu mantolama paketinde satılabilir seçenek yapmak anlamına gelmez.

## 1. Başlangıç kararı: Bonus ürün kapsamı

Bu bölüm yalnızca **mantolama wizard'ına girecek** Bonus adaylarını kapsar. Çatı, giydirme cephe, ara bölme veya endüstriyel ürünler mantolama seçeneği değildir; fakat kendi kullanım alanlarıyla katalog ürünü olarak ayrıca eklenebilir.

| Bonus ürünü | Sıvalı dış cephe uygunluğu | Yoğunluk sayfası | Durum |
|---|---|---|---|
| **Bonus Premium F** | Evet | Hayır — sekiz ürünlük ilk karşılaştırma listesinde değil | Teknik ürün havuzu |
| **Bonus Premium F 120** | Evet | `120 yoğunluk taşyünü fiyatları` | Aday |
| **Bonus Premium F 150** | Evet | `150 yoğunluk taşyünü fiyatları` | Aday |
| **Bonus Premium F 150 Pro** | Evet | `150 yoğunluk taşyünü fiyatları` | Aday |

**Marka ayrımı:** Sitedeki **Fawori Optimix TR7.5**, mevcut ürününüzdür ve Bonus ürünü değildir. Bonus fiyat listesinde ise **Bonus Premium F**, **Premium F 120**, **Premium F 150** ve **Premium F 150 Pro** bulunur. Benzer “TR7.5” ifadesi bu iki markayı aynı ürün gibi göstermemelidir.

**Kaynak kuralı:** Yoğunluk hücresi iki biçimde gösterilir: **föy beyanı** veya **üretici sözlü beyanı — değişken**. Sözlü beyan, Emrah'ın kararıyla karşılaştırma listesine girmeye yeterlidir; fakat müşteri ekranında föy değeri gibi gösterilmez. İç kayıtta bildirimi yapan kişi ve tarih tutulur.

## 2. Toplanan teknik föyler ve kaynak kapısı

13 Temmuz 2026 tarihinde resmî üretici kaynaklarından indirilen föyler yerelde `_audit/teknik-foyler/2026-07/` altında durur. PDF dosyaları git tarafından bilinçli olarak izlenmez; kaynak bağlantısı ve indirme tarihi bu dosyada kalır.

| Marka / ürün | Kaynak | İndirme durumu | Karşılaştırmada kullanılacak çekirdek veri |
|---|---|---|---|
| Bonus Premium F | [Bonus teknik föyü](https://www.bonusyalitim.com.tr/media/urunbrosur/7597b2-bonus-tas-yunu-premium-f-tr-1.pdf) | İndirildi | λ, çekme dayanımı, kalınlık aralığı, yangın sınıfı |
| Bonus Premium F 120 | [Bonus teknik föyü](https://www.bonusyalitim.com.tr/media/urunbrosur/6e271f-bonus-tas-yunu-premium-f-120.pdf) | İndirildi | 120 kg/m³, λ, çekme/basma dayanımı, kalınlık aralığı |
| Bonus Premium F 150 | [Bonus teknik föyü](https://www.bonusyalitim.com.tr/media/urunbrosur/e91f62-bonus-tas-yunu-premium-f-150.pdf) | İndirildi | 150 kg/m³, λ, çekme/basma dayanımı, kalınlık aralığı |
| Bonus Premium F 150 Pro | [Bonus teknik föyü](https://www.bonusyalitim.com.tr/media/urunbrosur/16901a-bonus-tas-yunu-premium-f-150-pro.pdf) | İndirildi | 150 kg/m³, λ, çekme/basma dayanımı, kalınlık aralığı |
| Expert HD150 | [Expert teknik föyü](docs/ExpertTaşyünüHD150IsiYalitimLevhasiTDS.pdf) | `docs/` altında teyit edildi | ≥150 kg/m³, λ, çekme/basma dayanımı, kalınlık aralığı |
| Expert LD125 | [Expert teknik föyü](docs/6.ExpertTaşyünüLD125IsiYalitimLevhasiTDS.pdf) | `docs/` altında teyit edildi | ≥125 kg/m³, λ, çekme/basma dayanımı, kalınlık aralığı |
| Dalmaçyalı Stonewool SW035 | [Ürün sayfası ve TDS bağlantısı](https://www.dalmacyali.com.tr/sistemlerimiz-ve-urunlerimiz/isi-yalitim-urunlerimiz/levhalar/stonewool-sw035-tasyunu-isi-yalitim-levhasi) | Sayfa teyitli; site doğrudan indirmeyi bu ortamda engelledi | λ, çekme/basma dayanımı, kalınlık aralığı, yangın sınıfı |
| Expert Taşyünü Premium | [Filli Boya teknik föyü](https://www.filliboya.com/uploads/4-1ExpertTas%CC%A7yu%CC%88nu%CC%88PremiumIsiYalitimLevhasiTDS_Rev.pdf) | İndirildi | λ, çekme/basma dayanımı, kalınlık aralığı, yangın sınıfı |
| Fawori Optimix TR7.5 | [Fawori ürün sayfası](https://www.fawori.com/urunler/isi-yalitim-levhalari/fawori-optimix-tr-7.5-tasyunu-isi-yalitim-levhasi) | Sayfa teyitli; site doğrudan indirmeyi bu ortamda engelledi | λ, çekme/basma dayanımı, kalınlık aralığı, yangın sınıfı |

**Yayın kapısı:** Her ürün için kullanım alanı, yoğunluk değeri/aralığı, yoğunluk kaynak türü ve kaynak tarihi, λ, yangın sınıfı, çekme dayanımı, geçerli kalınlıklar ve paket/lojistik verisi aynı kayıtta bulunur. Yoğunluk sözlü bildirimse iç kayıtta “kim, ne zaman bildirdi” alanı zorunludur; müşteri tarafında ise bu değer açıkça “üretici sözlü beyanı — değişken” etiketiyle görünür.

## 3. Codex'in ilk önerisi

### Sayfa fikri

İlk yayın üç ayrı yoğunluk sayfası değil, **tek bir 150 yoğunluk pilot sayfası** olmalı. Bu sayfa, sekiz ürünlük ana karşılaştırma tablosunun 150 filtresi açık görünümüdür: Bonus Premium F 150, Bonus Premium F 150 Pro ve Expert HD150 ilk üç sonuçtur; diğer beş ürün ise kaynak etiketiyle tabloda görünür kalır. Böylece ziyaretçi yalnızca sıralı bir liste değil, gerçek seçenek bağlamını da görür.

Önerilen adres ve başlık:

```text
/tasyunu-yogunluk/150-kg-m3
150 Yoğunluk Taşyünü Fiyatları | Dış Cephe Mantolama İçin Karşılaştırma
```

Sayfanın karar sırası:

1. **Neyi karşılaştırdığını anlatır:** “Sıvalı dış cephe mantolamasına uygun ürünler. 150 kg/m³ filtresinde teknik föy beyanı olan ürünler önce gösterilir.”
2. **Kalınlığı seçtirir:** Sadece seçilen kalınlıkta mevcut ürünler kalır.
3. **Şehri seçtirir:** Şehir seçilmeden kesin satış rakamı vaat edilmez; seçilince güncel ürün/fiyat verisi ile teklif akışına geçilir.
4. **Karşılaştırma tablosunu gösterir:** Yoğunluk, λ, yangın sınıfı, yüzeye dik çekme dayanımı, basma dayanımı, kalınlık ve paket bilgisi.
5. **Karar yardımı verir:** Ölçü/şehir giren ziyaretçiyi mevcut teklif akışına taşır. Birincil çağrı: `Şehrine göre net teklif al`.

Bu sıralama, ziyaretçinin önce “aynı sınıfta mı?”, sonra “benim kalınlığım var mı?”, en son “benim şehrimde teklif ne?” sorularını cevaplar. Fiyatı formun arkasına saklamaz; fakat teyitsiz şehir veya metraj için de kesin rakam uydurmaz.

### Tasarım sınırı

GLM'nin HTML'indeki zengin teknik yapıdan yararlanabiliriz; ancak müşteri ekranında her teknik satırı ilk bakışta açmayalım. Mobilde ilk bakışta şu beş bilgi yeterlidir: ürün adı, yoğunluk, λ, yangın sınıfı, seçili kalınlık. Mekanik ve su/nem verileri `Tüm teknik değerler` altında açılır. Uzun sayfada tek bir birincil aksiyon korunur.

### Fiyat ve lojistik sınırı

- Sayfa, ürün uygunluğunu karşılaştırır; ticari teklif mevcut fiyat motorundan gelir.
- “Nakliye fiyata dahildir” ifadesi sadece iş kuralı sağlanınca gösterilir; koşul hemen yanında yer alır.
- Bonus Haziran 2026 PDF'sindeki rakamlar önerilen satış fiyatıdır. Eski HTML'deki `0,99` çarpanı kaynakta doğrulanmadığı için canlı fiyat hesabına taşınmayacaktır.

## 4. Kesinleşen ticari kararlar

1. Ana karşılaştırma tablosunda sekiz ürün yer alır: Bonus Premium F 150, Bonus Premium F 150 Pro, Expert HD150, Bonus Premium F 120, Expert LD125, Dalmaçyalı SW035, Expert Taşyünü Premium ve Fawori Optimix TR7.5.
2. “150 yoğunluk taşyünü fiyatları” sayfası, ana tablonun 150 filtresi açık görünümüdür; 150 föy beyanlı üç ürün önde, diğer ürünler karşılaştırma bağlamında görünürdür.
3. Ziyaretçi teknik karşılaştırmayı kalınlık ve şehir seçmeden görür. Fiyat sütunu ise ticari fiyat/iskonto verisi doğrulandığında devreye girer.
4. Her yoğunluk satırının yanında kaynak türü görünür; sözlü ve değişken aralıklar, föy beyanı gibi sunulmaz.

## 5. Fable 5 teknik ve strateji analizi

**Tur 2 — 13 Temmuz 2026.** Yedi teknik föy içerikten okunarak doğrulandı (`docs/` altındaki beş PDF + `_audit/teknik-foyler/2026-07/` altındaki Bonus föyleri). Aşağıdaki tablolarda yalnızca föylerde yazan değerler var; föyde olmayan hiçbir değer alınmadı. **Bu turdaki B ve E bölümlerinin kapsam önerileri, aşağıdaki F. Tur 3 Emrah kararıyla geçersiz kılınmıştır; teknik ölçümler geçerlidir.**

#### A. Föy doğrulama sonucu

| Ürün | Föyde yoğunluk beyanı | λD (W/mK) | Dik çekme | Basma %10 def. | Kalınlık | Yangın | Kaynak dosya |
|---|---|---|---|---|---|---|---|
| Bonus Premium F 150 | **150 kg/m³** (±%10) | 0,036–0,040 (kalınlığa göre) | 15 kPa | 40–70 kPa (kalınlığa göre; incede NPD) | 20–130 mm | A1 | `bonus-premium-f-150.pdf` |
| Bonus Premium F 150 Pro | **150 kg/m³** (±%10) | 0,036–0,038 (kalınlığa göre) | 10 kPa | 35–50 kPa (incede NPD) | 30–120 mm | A1 | `bonus-premium-f-150-pro.pdf` |
| Expert HD150 | **≥150 kg/m³** | 0,038 | ≥15 kPa (TR15) | ≥40 kPa CS(10)40 | 30–150 mm (30 mm yıldızlı*) | A1 | `ExpertTaşyünüHD150...TDS.pdf` |
| Bonus Premium F 120 | **120 kg/m³** (±%10) | 0,036–0,038 | 10 kPa | 35–50 kPa (incede NPD) | 30–130 mm | A1 | `bonus-premium-f-120.pdf` |
| Expert LD125 | **≥125 kg/m³** | 0,037 | ≥7,5 kPa (TR7.5) | ≥30 kPa CS(10)30 | 30–150 mm (30 mm yıldızlı*) | A1 | `6.ExpertTaşyünüLD125...TDS.pdf` |
| Expert Taşyünü Premium | **Beyan yok** | 0,035 | ≥7,5 kPa (TR7.5) | ≥25 kPa CS(10)25 | 30–100 mm | A1 | `4-1ExpertTaşyünüPremium...TDS_Rev.pdf` |
| Dalmaçyalı SW035 | **Beyan yok** | 0,035 | ≥10 kPa (TR10) | ≥30 kPa CS(10)30 | 30–100 mm | A1 | `dalmacyali_stonewool_sw_035...pdf` |
| Fawori TR7.5 | **Beyan yok** | 0,035 | ≥7,5 kPa (TR7,5) | ≥25 kPa CS(10)25 | 40–150 mm | A1 | `Fawori_Tasyuenue_TR_7_5...pdf` |

\* Föylerdeki ortak not: en ince kalınlıkta basma ve dik çekme değerleri diğer kalınlıklardan farklılık gösterebilir.

#### B. Sayfa atama hükümleri

| Sayfa | Hüküm |
|---|---|
| **150 sayfası** | Üç ürün, iki marka: Bonus Premium F 150, Premium F 150 Pro, Expert HD150. Bölüm 4 / 3. sorudaki "aynı yoğunlukta en az üç doğrulanmış ürün" eşiği sağlandı. |
| **120 sayfası** | Hâlâ tek ürün (Bonus Premium F 120). Pilot açmaya yetmez. |
| **125** | Expert LD125 föyü ≥125 beyan ediyor; 120 sayfasına konamaz (125 ≠ 120). Karar gerekiyor: ayrı içerik mi, 150 sayfasında "yakın yoğunluklar" bağlantısı mı? |
| **Beyansız üçlü** | SW035, Fawori TR7.5, Expert Premium föylerinde yoğunluk satırı yok. İsim/piyasa bilgisi yayın kapısını geçmez. Yol: DoP (CE Performans Beyanı) veya üreticiden yazılı teyit alınıp kaynak kaydına eklenir; o zamana kadar teknik havuzda kalırlar. |

Ek teyitler:

- **TR7.5 doğru okundu:** Fawori adındaki 7.5, föyde ≥7,5 kPa dik çekme sınıfıdır (TS EN 1607). Yoğunlukla ilgisi yok.
- **HD150 mantolama uygunluğu:** Föy "tüm cephe sistemleri" + ETAG 004 (ETICS) uygunluğu + cephede sıva uyarısı içeriyor. Bonus'taki gibi birebir "mantolama altında" cümlesi yok; ürün sayfası metniyle çift teyit önerilir.
- **Üretici notu:** Expert, Fawori ve Dalmaçyalı föylerinin üçü de Betek A.Ş. üretimi. İleride "çok markalı karşılaştırma" iddiası kurulurken bilinmeli.
- **Bölüm 2 tablosu güncellenmeli:** Dalmaçyalı ve Fawori föyleri artık `docs/` altında indirilmiş durumda; Expert HD150 ve LD125 föyleri Bölüm 2 listesinde hiç yok, eklenmeli.

#### C. Föyden çıkan kritik kıyas gerçekleri

1. **Yoğunluk ≠ ısıl performans — artık kaynaklı.** λD 0,035 beyan eden ürünler düşük yoğunluklu/beyansız olanlar; HD150 0,038, Bonus 150'ler 0,036–0,040. 150 sayfası "daha iyi ısı yalıtımı" diyemez; 150'nin föyle desteklenen karşılığı mekanik dayanımdır (çekme 10–15 kPa'ya karşı 7,5 kPa).
2. **"Pro" adı ≠ üstün föy değeri.** F 150 Pro'nun dik çekme beyanı (10 kPa) F 150'den (15 kPa) düşük; basma da öyle. Karar yardımcısı bu farkı kaynaklı ve yansız yazmalı; "Pro daha iyidir" iması föyle çelişir.
3. **λ tek sayı değil.** Bonus λ'yı kalınlığa göre beyan ediyor, Expert tek değer veriyor. Tabloda λ seçili kalınlığa göre gösterilmeli; Bonus föyündeki kalınlık→λ eşlemesi uygulama aşamasında föy tablosundan birebir çıkarılmalı (bu turda yalnızca aralık verildi).
4. **NPD hücreleri dürüst gösterilir.** Bonus ince kalınlıklarda basma/noktasal yük için NPD beyan ediyor. "Üretici bu kalınlıkta değer beyan etmiyor" yazılır; boş ya da 0 gösterilmez.
5. **Beyan biçimi farkları dipnot ister.** 150 ±%10 (nominal) ile ≥150 (alt sınır) aynı şey değildir; 15 kPa (değer) ile TR15 (sınıf) gösterimi de farklıdır. Aynı sütunda dipnotsuz eşitlenmez.
6. **Ortak kalınlık kesişimi 30–120 mm.** 20 mm yalnız F 150'de, 130 mm üzeri yalnız HD150'de var. Kalınlık seçici satır silmez; "bu kalınlık föyde yok" der.

#### D. Tur 1 önerilerinin durumu

Tur 1'deki 10 maddenin tamamı geçerli; föy doğrulamasıyla şunlar güçlendi: kapsam kutusuna (madde 1) LD125 ve beyansız üçlü için somut gerekçe yazılabilir; F 150 – F 150 Pro fark bölümü (madde 4) artık föy verisiyle kurulabilir ve HD150 üçüncü sütun olur; "yalnızca farkları göster" anahtarı (madde 6) üç üründe gerçek fark bulunduğu için değer üretir; SEO'daki "150 yoğunluk ne kazandırır?" bölümü (madde 8) λ değil mekanik dayanım anlatmalıdır (C.1); birim/koşul eşitliği ilkesi (madde 10) C.3–C.6'daki somut dipnotlarla uygulanır.

#### E. Emrah'ın kararına kalan konular

1. Expert HD150 ilk gün 150 sayfasına girsin mi? (Filli Boya tarafında güncel fiyat listesi/ticari veri var mı?)
2. Beyansız üçlü için DoP/yazılı teyit peşine düşülecek mi, yoksa sayfada "yoğunluk beyan etmeyen dış cephe ürünleri" diye ayrı, değersiz bir bölüm mü kurulacak?
3. LD125'in yeri (ayrı içerik / 150 sayfasından bağlantı / şimdilik havuz).

#### F. Tur 3 — Emrah'ın kararı (13 Temmuz 2026)

**Karar (Emrah):** Karşılaştırma listesine HD150 dahil sekiz ürünün tamamı girer. Föyünde yazılı yoğunluk beyanı olmayan ürünler, üreticinin sözlü bildirdiği değişken yoğunluk aralığıyla listelenir. Amaç, ürünleri yan yana görüp hem teknik değerleri hem fiyatları kıyaslayabilmektir. Yayın kapısının "yoğunluk föyde yazacak" şartı bu liste için Emrah'ın kararıyla gevşetildi; E bölümündeki üç soru da bu kararla kapandı.

Sözlü bildirilen yoğunluk aralıkları:

| Ürün | Yoğunluk (üretici sözlü beyanı, değişken) |
|---|---|
| Expert Taşyünü Premium | 100–110 kg/m³ |
| Dalmaçyalı SW035 | 110–120 kg/m³ |
| Fawori TR7.5 | 100–120 kg/m³ |

**Karardan çıkan uygulama hükümleri:**

1. B bölümündeki "beyansız üçlü teknik havuzda kalır" hükmü geçersizdir; sekiz ürün tek karşılaştırma tablosunda yer alır.
2. Yoğunluk sütunu iki tür değeri kaynak etiketiyle taşır: **föy beyanı** (belge + indirme tarihi) ve **üretici sözlü beyanı — değişken** (bildirim tarihi). Bu ayrım, kararın "sözlü bildirilen değişken yoğunluğa sahip bilgisi ile girsin" ifadesinin doğrudan uygulamasıdır.
3. Sözlü beyanlar için iç kayıt tutulur: değeri kim, ne zaman bildirdi (müşteriye görünmez, yalnızca veri bakımı için).
4. "150 yoğunluk taşyünü fiyatları" sayfası, ana karşılaştırma tablosunun 150 filtresi açık görünümü olur; diğer ürünler tabloda görünür kalır ki yan yana kıyas amacı korunsun. Aynı ana tablo ileride 120/125 görünümlerini de besler.
5. Veri modelinde yoğunluk alanı: değer veya aralık + kaynak türü (föy / sözlü) + kaynak tarihi.
6. Fiyat sütunu karar gereği tabloda yer alacak; gösterim, Bölüm 3'teki fiyat/lojistik sınırına uygun olarak ticari veri doğrulaması tamamlandığında devreye girer.

#### G. Tur 4 — Bonus fiyat kaynağı ve bölge modeli netleştirmesi (13 Temmuz 2026, Fable 5)

**Kaynak hükmü:**

- Kanonik fiyat kaynağı: `BONUS FİYAT LİSTESİ - Haziran 2026.pdf` (84 sayfa, 8 Haziran 2026, Eryap Grup; dipnot: fiyatlar tavsiye edilen satış fiyatıdır ve KDV hariçtir). Konum: `~/Masaüstü/projeler/yapim/tasyunudepo/`.
- **GLM HTML'i fiyat kaynağı değildir.** `tasyunudepo.js` satır 555: `BONUS_SALE_FACTOR = 0.99` — satış hesabında bölge fiyatına %1 indirim uygulanıyor (satır 946 ve 1063'te çarpım). Bu çarpan PDF'te yok ve Emrah tarafından talep edilmemiş; Codex'in tespiti içerikten doğrulandı. Mevcut karar geçerli: 0,99 canlıya taşınmaz.
- `bonus_products.json` (PDF'ten otomatik çıkarım; 47 tablo, 25'i taş yünü) ara kaynak olarak kullanışlı fakat **hatalı satırlar içeriyor**: ör. Premium F 150 tablosunda 80 mm satırında kolon kayması var, bazı satırlarda 7 bölge yerine 6 fiyat çıkmış. Seed'e girmeden her satır PDF sayfasıyla birebir teyit edilecek (Codex'in 2. şartı).
- **İskonto teyidi:** `Bonus İskonto Listesi.jpeg` (yürürlük 9.06.2026) gözle okundu: BONUS TAŞ YÜNÜ → tüm bölgelerde iskonto **%10** (XPS bölgeye göre 6/3/0/0, membran 18/15/10; taş yünü sabit 10). Emrah'ın "%10 sabit iskonto" beyanı belgeyle uyumlu.

**Fiyat kayıt kuralı (Karar — Emrah, 13 Temmuz):**

- Sisteme kaydedilen taban fiyat = PDF bölge liste fiyatı × 0,90 (KDV hariç).
- Müşteri satış fiyatı = taban × 1,05 (%5 marj). Net etki: liste × 0,945.
- %5 marjın kapsamı (yalnız Bonus mu, tüm taş yünü mü) karar bekliyor.

**Bölge modeli (taş yünü haritası, PDF sonu ~s.82):**

| Bölge | İller (özet) |
|---|---|
| 1 | Bolu, Düzce, Kocaeli, Sakarya |
| 2 | **İstanbul/Anadolu**, Gebze/Kocaeli, Bursa, Yalova, Bilecik, Eskişehir, Karabük, Kütahya, Bartın, Zonguldak |
| 3 | **İstanbul/Avrupa**, Ankara, İzmir, Tekirdağ, Balıkesir, Manisa, Denizli, Çanakkale, Isparta, Burdur, Kastamonu, Kırıkkale, Konya, Uşak, Afyon, Çankırı |
| 4–7 | Doğuya/güneye doğru kademeli artış |

- **İstanbul tek fiyat olamaz:** Anadolu yakası 2. Bölge, Avrupa yakası 3. Bölge. Şehir seçiminde yaka ayrımı gerekir.
- PDF'te bölge→il haritası ürün grubuna göre değişiyor (XPS 4 bölgeli, membran 3 bölgeli ayrı haritalar); taş yünü için 7'li harita esastır. Başka Bonus ürün grubu eklenirse kendi haritası ayrıca doğrulanmalı.
- Bölge haritası sayfalarının başlığında "OCAK 2026" yazıyor (liste Haziran tarihli) — eşleme satış ekibiyle teyit edilmeli (Codex'in 3. şartı).

**Admin panel haritası (mevcut durum tespiti):**

| Yüzey | Ne yönetiyor | Durum |
|---|---|---|
| Ayarlar → "Kar Marjı (%)" ve "KDV Oranı" | Yalnız tarayıcı localStorage'ına yazıyor; hiçbir fiyat hesabı okumuyor | **Ölü alan** — ekranda görünen %10 hiçbir şeyi etkilemiyor; yanıltıcı |
| Marj Kuralları | `material_types` kademeleri → `lib/pricing/margin.ts` (P0-A08 tek canlı kural, fail-closed) | **Gerçek marj burası** |
| İskontolar | `shipping_zones` şehir bazlı TIR/Kamyon + Optimix toz/levha iskontoları | Gerçek, şehir bazlı |

- Emrah'ın isteği: TEKNO / Filli grubu / Bonus markalarını admin panelinde ayrı ayrı yönetmek. P1'in "TEKNO sevkiyat paneli" kalemiyle birleşik "marka yönetimi" ekranı olarak planlanacak.

**Kararlar (Emrah, 13 Temmuz 2026):**

1. **İstanbul yaka UX'i — Karar:** Şehir listesi aynı kalır; İstanbul seçilince yalnız o durumda "Avrupa / Anadolu" yaka seçimi belirir (Avrupa → 3. Bölge, Anadolu → 2. Bölge).
2. **Marj kapsamı — Karar:** %5 marj yalnız Bonus markasına uygulanır; marka bazlı marj kuralı kurulur, diğer taş yünü markaları mevcut marj kuralında kalır.
3. **Admin Ayarlar ölü alanları — Karar:** "Kar Marjı" ve "KDV" alanları kaldırılır; yerine gerçek kuralların yerini gösteren bilgi ve Marj Kuralları bağlantısı konur.

4. **Gebze/Kocaeli ayrımı — Karar (Emrah, 13 Temmuz):** Bonus listesi Kocaeli'yi 1. Bölge, Gebze'yi 2. Bölge olarak ayırıyor; bu ayrım İstanbul yakası gibi uygulanır. Kocaeli seçilince "Gebze / Kocaeli (diğer)" sorusu belirir (Gebze → 2. Bölge, diğer → 1. Bölge).

5. **Harman paketleri — Karar revizyonu (Emrah, 13 Temmuz 2026 akşamı):** "Bonus + TEKNO kombinasyonuna kesin set fiyatı verilmez, yalnız levha teklifi" kuralı (eski karar 13) kaldırıldı. Bonus levha komple set olarak üç toz grubu harmanıyla satılır: 1) Expert → Premium Sistem, 2) Optimix → Dengeli Sistem, 3) TEKNO → Ekonomik Sistem (migration v20). TEKNO tozlu pakette sevkiyat "ayrıca teyit" uyarısıyla sunulur. Toz grubu marjı zaten 5'e indirildi; Bonus akışı üzerine ikinci marj bindirilmez (tek kod yolu + kilit testi).

**Kalan satış teyidi:** Bölge haritası sayfasındaki "OCAK 2026" başlığının Haziran listesiyle birlikte geçerli olduğu satış tarafından teyit edilecek (uygulamayı bloklamaz).

### Codex yanıtı / hakem notu

Fable'ın doğruladığı teknik farklar, karşılaştırma tasarımında doğrudan kullanılacak: “150 yoğunluk” daha iyi ısıl performans vaadi değildir; föyde görülebilen mekanik değerlerin karşılaştırma bağlamıdır. “Pro” adı da otomatik üstünlük anlamına gelmez. Sözlü yoğunluklar, Emrah'ın kararıyla listede yer alır fakat görünür kaynak etiketi olmadan föy değerleriyle eşitlenmez.

## 6. İş paylaşımı ve yayın öncesi kontrol

| İş | Sorumlu | Bitiş ölçütü |
|---|---|---|
| Bonus dış cephe ürün kapsamını teyit etmek | Codex | Bu dosyanın 1. bölümü tamamlandı |
| Teknik föy arşivi ve kaynak listesi | Codex | HD150 ve LD125 dahil kaynak kayıtları teyit edildi; sözlü beyanların iç kayıtları uygulama öncesi açılacak |
| Sayfa hedefi ve fiyat görünürlüğü kararı | Emrah | Tamamlandı — Bölüm 4 |
| Bilgi mimarisi ve mesaj testi | Fable 5 | Tamamlandı — Bölüm 5 |
| Ortak tasarım kararı | Emrah + Codex + Fable 5 | Tamamlandı — Bölüm 4 ve 5 |
| Veri modeli, sayfa tasarımı ve test planı | Codex | Karardan sonra ayrı uygulama planı ve doğrulama matrisi |

## 7. Başarı ölçütü

Pilot sayfa yayına alındıktan sonra 30 gün boyunca şunları izleriz:

- Sayfayı görenlerin kalınlık ve şehir seçimine geçişi,
- şehir seçenlerin teklif akışını başlatma oranı,
- gönderilen tekliflerin geçerli müşteri talebine dönüşme oranı,
- yanlış ürün/fiyat beklentisi nedeniyle gelen itiraz sayısı.

Trafik düşük olduğu için A/B testi yerine önce bu yolculuğu ölçer, satış ekibinin gelen talepler üzerindeki notlarıyla sayfayı iyileştiririz.
