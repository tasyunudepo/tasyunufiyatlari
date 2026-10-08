# Eski / yeni görev karşılaştırması

Eski kaynak: `716f6bd`, `/tmp` kopyası; üretime bağlı değildir. Her iki uygulama aynı ayrı yerel PostgreSQL üzerinde sentetik kayıtlarla çalıştırıldı. 1440 px, bir otomasyon geçişi; alan odaklama tıklamaları sayılır, metinler `fill` ile girilir. Bunlar insan görev süreleri veya dönüşüm oranı ölçümü değildir; hız artışı yüzdesi çıkarılmaz.

| Görev | Eski: tıklama / süre | Eski kapsam | Yeni: tıklama / süre | Yeni kapsam |
|---|---|---|---|---|
| 1. Talebi bul / iletişime geçiş | 3 / 0.46 sn | Kısmi | 3 / 0.13 sn | Tamamlandı |
| 2. Görüşme sonucu / takip planı | 5 / 1.32 sn | Tamamlandı | 3 / 0.59 sn | Tamamlandı |
| 3. Geciken takibi tamamla | 3 / 0.34 sn | Kısmi | 3 / 0.14 sn | Tamamlandı |
| 4. Teklif / PDF / revizyon / karşılaştırma | 18 / 6.07 sn | Kısmi | 19 / 4 sn | Tamamlandı |

Eski arayüzde telefon görüntüleniyor ancak iletişim bağlantısı yok; ayrı takip görevi tamamlama ve sürüm karşılaştırması da yok. Bu yüzden 1, 3 ve 4. görevlerin eski süreleri yalnız ulaşılabilen adımlardır; aynı kapsamın performansı gibi karşılaştırılmaz. 2. görev eski teklif alanlarını, yeni akış ayrı görüşme ve görev kayıtlarını kullanır. Yeni form akışında bir ek tıklama “Diğer” menüsünden gelir; satırın ana eylemi Detay olarak sadeleştirilmiştir.

Eski seri anahtarı çakışması ayrı regresyon olarak kaydedildi. Karşılaştırma birbirinden bağımsız sentetik telefonlar/saatlerle yapıldı; eski kaynak değiştirilmedi. Son geçiş başarılı: `evidence/task-comparison.json`. Betik: `scripts/ofis-test/compare-tasks.mjs`.
