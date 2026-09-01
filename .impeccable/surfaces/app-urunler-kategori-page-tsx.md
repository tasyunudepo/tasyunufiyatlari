---
version: 1
slug: "app-urunler-kategori-page-tsx"
primary_target: "app/urunler/[kategori]/page.tsx"
related_targets: ["components/catalog/TasyunuCategoryExperience.tsx","route:/urunler/tasyunu-levha"]
---

# Taşyünü Levha — Karar Masası

## Kapsam ve mod

`app/urunler/[kategori]/page.tsx` içindeki `tasyunu-levha` dalı için dönüşüm odaklı **Persuade** yüzeyi. Onaylı kompozisyon **01 — Karar Masası**, üretim seed’i `ee562c3c`. Birincil uygulama gövdesi `components/catalog/TasyunuCategoryExperience.tsx`; canlı rota `/urunler/tasyunu-levha`.

## Tez ve görsel dünya

Ürün listesini teslim fiyatına giden üç bilgilik bir karar masasına dönüştür; yatay katalog şeridini reddet. Dünya sıcak bir mimari numune masasıdır: kâğıt zemin, gerçek ürün kapakları, ince teknik cetveller ve fiyat başlangıcını taşıyan koyu karar paneli. Bu kompozisyon yüzeye özeldir; global tasarım sistemi için zorunlu sayfa şablonu değildir.

## Ziyaretçi hikâyesi ve ana eylem

Profesyonel alıcı önce niyetini tanır, sonra uygulama alanını seçer, marka/kalınlık/yoğunlukla teknik kartları tarar ve ürün fiyatına ya da teknik karşılaştırmaya geçer. Mantolama için ilk ana eylem “Fiyatımı hesapla”dır; form fiyat sonucu üretmez, uygulama, teslim ili ve yaklaşık metrajı ana hesap akışına hazır taşır. Karşılaştırma, ana fiyat yoluna rakip olmayan ikincil eylemdir.

## İlk görünüm

Masaüstünde solda büyük “Doğru levhayı bulun. Teslim fiyatına geçin.” başlığı ve üç satış gerçeği; sağda çalışan üç bilgilik mini fiyat başlangıcı bulunur. Yedi kullanım alanı ilk sahnenin hemen altında eksiksiz görünür ve ürün çalışma masasını kontrol eder.

Mobilde sıra başlık → tam genişlik fiyat CTA’sı → satış ve fiyat gerçekleri → koyu karar paneli → kullanım alanlarıdır. Masaüstü iki kolon tek kolona çözülür; kritik eylem ve 44 px hedefler korunur. Yatay ürün şeridi, kesilmiş teknik içerik ve gizli temel eylem kullanılmaz.

## Guided selector rail ve product workbench

- Kullanım alanı seçimi aktif bölümü, sayaçları ve URL’deki `uygulama` durumunu birlikte günceller; tarayıcı geri/ileri davranışı korunur.
- Rail mobilde iki, orta ekranda dört, geniş ekranda yedi sütundur. Aktif seçim koyu panel, beyaz metin ve açık ürün sayacıyla belirginleşir; yalnız renge güvenmeyen `aria-pressed` durumu korunur.
- Workbench seçili uygulamanın başlığını ve açıklamasını gösterir; marka, kalınlık ve yoğunluk filtreleri paylaşılabilir URL durumuna yazılır.
- Sonuç sayısı `aria-live` ile güncellenir. Filtre sonucu boşsa açıklayıcı boş durum ve tek “Filtreleri temizle” kurtarma eylemi görünür.
- Ürünler mobilde tek, orta ekranda iki, geniş ekranda üç sütun olur. Filtre değişiminde yalnız kısa, azaltılmış harekete saygılı giriş animasyonu kullanılır.
- Kart, gerçek ürün kapağını; teknik veri kaynağını; marka/modeli; yoğunluk ve kalınlık özetini; fiyat bağlamını ve minimum sipariş notunu aynı tarama yüzeyinde tutar.
- Kartın birincil eylemi ürün ve fiyat incelemesidir. Teknik profili uygun levhalarda “Karşılaştır” ikinci eylem olarak görünür ve odak modeli karşılaştırma rotasına taşır.

## CRO ve doğruluk sınırları

- Fiyat, ürün ve lojistik birbirinden koparılmaz; formun hazırlık adımı olduğu açıkça söylenir.
- Her fiyat bağlamında “KDV hariç” görünür kalır. Tam araç koşulunda nakliye fiyata dahildir; ara metrajda nakliye alıcıya ait olabilir ve uygun tam Kamyon/TIR metrajına yönlendirme korunur.
- “Ücretsiz nakliye”, “fiyatı kilitle”, “garanti fiyat”, kesin teslim süresi, kapora, taksit, sanal POS veya altyapısı olmayan ödeme vaadi kullanılmaz.
- Ödeme sipariş onayında tek seferde alınır. Ürün veya sevkiyat gerçeği kullanıcıyı hızlandırmak için sadeleştirilebilir; değiştirilemez.
- Teknik yoğunluk tek başına kalite sırası gibi sunulmaz. Kaynak etiketi ve beyan niteliği ürün bazında görünür kalır.
- Doğrulanmamış stok, satış adedi, müşteri sözü, performans yüzdesi veya teslim tarihi üretilmez.
- Fiyat sonucu öncesinde zorunlu olmayan kişisel veri istenmez; kişisel veri işlenen PDF veya WhatsApp akışında KVKK onayı korunur.

## Kanıt, içerik ve bitiş durumu

Gerçek ürün kapakları ana kanıttır. Alt kanıt paneli `public/depo/tasyunu-depo.webp` ile ürün, kalınlık, teslim ili ve tam araç metrajının aynı hesapta birleştiğini gösterir; güven soyut sıfatlarla değil ÖzerGrup operasyonu ve açık ticari koşullarla kurulur.

Üretim incelemesinin disposition’ı **ship**; kalan durum **clear**. Masaüstü akış, masaüstü katalog ve mobil kart kanıtları sırasıyla `production-verdict-desktop-flow.png`, `production-verdict2-desktop-catalog.png` ve `production-verdict2-mobile-card.png` artefaktlarında kayıtlıdır.
