# Faz 3 — Teklif listesi ve teknik dosya

Tamamlandı. Masaüstünde liste ve dosya yan yana; 1200 px altında detay tam ekran. Listeye dönüş ve Escape, aramayı/filtreleri/kaydırmayı korur. Kayıtlı görünümler yalnız bu tarayıcıda saklanır. Teklif serileri, CSV, PDF, Revize et ve Çoğalt korunur. Teklif belgelerinin tutarı ile tamamlanmış kayıtların cirosu açıkça ayrı gösterilir; alternatif belge toplamı proje fırsatına karışmaz.

Teknik föy kayıtlı metraj, araç/doluluk, birim fiyat, KDV hariç/dahil toplam, nakliye ve geçerliliği gösterir. Araç karşılığı yalnız kayıt destekliyorsa belirtilir. Revizyon karşılaştırması metraj, birim fiyat, nakliye ve toplamları gösterir; geçmiş kayıtta eksik alan bugünkü fiyatla doldurulmaz.

9 tarayıcı görünümü geçti: 375/390/768/1440 px liste ve detay, %200 yakınlaştırma. 14 px altı metin, 4,5:1 altı kontrast, 44 px altı kontrol veya taşan ana eylem bulunmadı. Kayıtlı görünüm yenileme sonrası korundu; mobil dönüşte kaydırma farkı 4 px altında. TypeScript geçti; lint 0 hata, mevcut çıkış bağlantısında 1 uyarı. Kanıt: evidence/phase3-browser.json, phase3-types.log, phase3-lint.log.

Son inceleme: teknik föy en üste alındı; eski ayrıntılar kapatılabilir bölümde korunuyor. Liste temas rozeti de proje dosyasıyla aynı görüşme geçmişini kullanır; eski kolon boşluğundan temassızlık türetilmez.
