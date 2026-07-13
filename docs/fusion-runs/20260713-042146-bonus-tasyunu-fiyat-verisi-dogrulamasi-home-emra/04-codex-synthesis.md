# Bonus Taşyünü veri doğrulaması — Codex sentezi

## Kaynak kanıtı

- Kaynak PDF: `BONUS FİYAT LİSTESİ - Haziran 2026.pdf`; Adobe InDesign üretimi, 8 Haziran 2026 tarihli, 84 sayfa.
- PDF dipnotu: fiyatlar tavsiye edilen satış fiyatıdır ve KDV hariçtir.
- Yerel `bonus_products.json`, PDF metninden türetilmiş 47 fiyat tablosu içerir; bunların yalnız Taş Yünü bölümü ürün entegrasyonu için adaydır.
- `tasyunudepo.html` / `tasyunudepo.js`, Bonus bölge fiyatı üstüne `BONUS_SALE_FACTOR = 0.99` uygular. Bu %1 indirim PDF kaynağında yoktur; ayrı ticari karar olmadan canlı fiyatın parçası olamaz.

## Hüküm

Veri, Bonus Taşyünü için P1 hazırlık girdisi olarak kullanılabilir; doğrudan canlı aktivasyon için henüz yeterli değildir.

Canlıya alınmadan önce zorunlu doğrulamalar:

1. Cephe mantolama kapsamına girecek ürün aileleri açıkça seçilmeli. Endüstriyel şilte, marin, kapı paneli, dökme vb. ürünler mevcut Wizard’ın cephe setiyle otomatik eşleştirilmez.
2. Her aktif ürün/kalınlık için ürün adı, mm kalınlık, paket m², kamyon/TIR kapasitesi ve 1–7 bölge KDV hariç liste fiyatı PDF sayfasıyla satır bazında doğrulanmalı.
3. İstanbul Avrupa/Anadolu, Gebze ve 1–7 bölge eşlemesi satış ekibi tarafından onaylanmalı.
4. `%1` satış katsayısı kaldırılmalı veya yönetim panelinde kaynak/tarih/açıklamayla açık ticari kural olarak onaylanmalı.
5. Güncel iskonto, şehir sevkiyat ve Bonus+TEKNO kombinasyon kuralı olmadan kesin müşteri fiyatı üretilmemeli.

## Panel durumu

Fusion runner GLM/MiniMax/DeepSeek çıktısı üretmeden zaman aşımına uğradı; model raporu bu sentezde kanıt olarak kullanılmadı.
