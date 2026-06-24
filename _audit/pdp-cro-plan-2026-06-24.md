# PDP CRO Planı — 24 Haziran 2026

## Amaç

Ürün detay sayfalarını sadece ürün/fiyat gösteren sayfalar olmaktan çıkarıp,
ziyaretçiyi hızlıca teklif kaydı, WhatsApp teyidi veya telefon görüşmesine
taşıyan karar yüzeyine çevirmek.

## Veriye Dayalı Baz Çizgi

- GA4 dönemi: 4 Mayıs 2026 - 23 Haziran 2026.
- PDP toplamı: 4.593 görüntüleme, 2.529 etkin kullanıcı, 29 önemli faaliyet.
- PDP kullanıcı başı önemli faaliyet oranı: %1,15.
- Ana sayfa kullanıcı başı önemli faaliyet oranı: %2,04.
- Kurumsal sayfalar kullanıcı başı önemli faaliyet oranı: %19,74.
- /iletisim: 95 etkin kullanıcı, 24 önemli faaliyet.

## Hipotezler

1. İletişim sayfasının yüksek dönüşümü adres, depo ve insan teyidi arayışından
   geliyor olabilir.
2. PDP kalınlık sayfalarındaki düşük oturum süresi tek başına başarısızlık
   değildir; mobilde hızlı fiyat kontrol davranışı olabilir.
3. PDP trafiği satış niyeti taşıyor, ancak karar özeti ve CTA görünürlüğü
   yeterince güçlü olmadığı için niyetin bir kısmı toplanmıyor.

## P0 Uygulama

1. PDP fiyat paneline seçili teklif özeti ekle:
   - araç tipi
   - hesaplanan m²
   - KDV hariç m² fiyatı
   - KDV hariç toplam
   - stok, ödeme ve sevkiyat teyidi metni
2. CTA üçlüsü kur:
   - PDF teklif kaydı oluştur
   - WhatsApp'tan teyit iste
   - Telefonla konuş
3. PDP özel event/source ayrımı ekle:
   - PDP_Price_View
   - PDP_CTA_Click
   - PDP_Form_Open
   - Whatsapp_Yazanlar source: product_detail_summary / product_detail_card
   - Telefon_Aramalari source: product_detail_phone
4. Nakliye/KDV metnini koşullu ve güvenli tut:
   - altyapısı olmayan ödeme, sevkiyat veya fiyat garantisi vaadi yok
   - nakliye durumu yalnızca koşulu doğruysa gösterilir

## P1 Uygulama

1. Mobilde PDP aksiyonlarını görünür tutan sticky alt bar ekle.
2. Kalınlık/metraj/şehir değişimlerini PDP_Interaction ile ölç.
3. Yüksek trafik sıfır dönüşümlü PDP'leri ayrıca izlemeye al.

## Doğrulama

- `web-copy-gate`
- `git diff --check`
- `npm run build`
- Desktop ve mobil Playwright screenshot
- GA4 debug console kontrolü
