# Ofis — Sevk Masası temel sistemi

Kaynak: kullanıcının 08.10.2026 uygulama talimatı Faz 0. Public sitenin kök DESIGN.md dosyasındaki Barlow/Geist ve altın sistemi Ofis için geçerli değildir.

Zemin #F3F4F2; yüzey #FFFFFF; ana metin #14181F; ikincil metin #4A5261. Vurgu #C2410C yalnız ana işlem, aktif menü ve gecikme; WhatsApp #1E7A46. Durumlar yazılı etiketle ve düşük doygunlukta yeşil/kırmızı/mavi/mor yardımcı tonlarla ayrılır; bu renkler ikinci marka vurgusu değildir. Odak #235A91, sınır #D5D9D4 / #949D96. Durum metni kendi açık yüzeyinde en az 4,5:1.

Atkinson Hyperlegible Next gövde ve fiyat; Mono yalnız kod/teknik kimlik. Orijinal dosyada ₺ glifi olmadığı için mevcut yerel yüklenen Barlow yalnız bu glifi tamamlar. Türkçe harfler Atkinson'da kalır. Sıfır glifi değiştirilmez. Tabular nums; gövde/hücre 16, yardımcı 14, başlık 19/26/40 px; satır yüksekliği 1,5 (başlık 1,45).

Kontrol min 44×44 px; köşe 8 px, panel 10 px. Süs amaçlı degrade/parlama yok. Satırda Detay; diğer işlemler erişilebilir açılır grupta. Gölge yalnız açılır katmanın sınırını ayırır. Mobil taşma gizlenmez; satır/filtre gerçek genişliğe yeniden akar.

Eski koyu utility sınıfları ofis.css içindeki kapsamlı uyumluluk katmanıyla yeniden eşlenir. Yeni bileşenler `ofis-*` semantik sınıfları kullanır. Mevcut alanlarla okuma ve sayaç iyileştirmeleri sürer; Faz 2–4'ün kalıcı proje/görev davranışı veri/şema kararına bağlıdır.

Tasarım hook'u: kart sanılan aktif menü kenarı kaldırıldı; 6 px köşe 8 px'e çekildi. Kullanıcı ölçüleri ve açık tema için bilinçli yardımcı tonlar yalnız `app/ofis/ofis.css` ve tekil değer kapsamında istisnalandı. Genel kural veya dosya muafiyeti verilmedi.


## Onaylı 14 px adımı

Kullanıcı onayı: 8 Ekim 2026. **14 px yalnız yardımcı metin ve rozetlerde** kullanılır: alan açıklaması, tarih/kaynak etiketi, ikincil tablo başlığı ve durum rozeti. Gövde, fiyat ve tablo hücresinin 16–17 px ölçüsünü küçültmek için kullanılmaz. Satır yüksekliği 1,5; gerçek zemin üzerinde kontrast en az 4,5:1. Dokunma hedefi yazıdan bağımsız en az 44×44 px kalır.

Hook istisnası tek değere ve tek CSS dosyasına bağlıdır: `design-system-font-size = 14px`, `app/ofis/ofis.css`. Kök checkout'tan çalışan hook aynı dosyayı `.worktrees/ofis-redesign-20261008/app/ofis/ofis.css` yoluyla görür; bunun kaydı kök `.impeccable/config.json` içindedir. Bu onay başka dosyaları veya diğer font ölçülerini kapsamaz; wildcard/genel kural istisnası oluşturulmaz.

Faz 2 başlık tokenları: `--ofis-type-heading-small` 19 px (alt başlık/legend), `--ofis-type-heading-medium` 26 px (bölüm ve mobil sayfa başlığı), `--ofis-type-display` 40 px (masaüstü sayfa başlığı ve günlük sayaç). Yeni bileşenler bu tanımlı adımları tekrar literal ölçü eklemeden kullanır. 14 px hook istisnası genişletilmedi.
