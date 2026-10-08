# Faz 4 — Teklif oluşturma, revizyon ve PDF

Excel’den çok satır yapıştırma, toz grubu, marj göstergeleri, şehir/araç ve nakliye kontrolleri mevcut hesap motoruyla korundu. Form yeni tipografi ve renk sistemini kullanır. Fiyat/PDF hesap motoru yeniden yazılmadı.

Gerçek tarayıcı + gerçek endpoint + ayrı PostgreSQL ile: 300 m², iki Excel satırı, %10 iskonto ve 500 TL nakliye; sunucu 33.080 TL KDV hariç / 39.696 TL KDV dahil hesapladı. PDF üretildi, yerel depo adaptörüne yüklendi, gerçek PDF endpoint’inden indirildi. Müşteri PDF çizim kaynağında iç maliyet ve marj yok; mevcut PDF sözleşme testleri de korunuyor.

Mobilde aynı numarayla revizyon, eski PDF’nin korunması ve önce/güncel karşılaştırma doğrulandı. Yeni snapshotlar kayıtlı birim/m² fiyatını ve nakliyeyi de saklar. Eski eksik alanlar bugünkü veriden türetilmez. Çoğaltma revizyon kipine girmez; müşteri ve kalemleri taşır. 375/390/768/1440 px + %200 yakınlaştırma, ayrıca mobil revizyon: 6 görünüm.

200 satırlı Excel teklifi de gerçek endpoint ile oluşturulup revize edildi. Tam teklif JSON’u sorgu adresine konmaz. Altı eşzamanlı gerçek PUT isteğinde 1 kayıt, 5 adet 409 çatışma oluştu. Önceki revizyon silinmedi. Açılan sürüm numarası, sıradaki revizyon dizisi konumu, güncelleme zamanı ve PDF yolu güncelleme önkoşuludur; eşzamanlı değişiklikte girdiler korunarak yeniden inceleme istenir. Değerlemeye esas eski net tutar otomatik değişmedi. Sahte istemci tutarı reddedildi.

Numara düzeltmesi açık görüşmeyle sınırlıdır: ham numara ve müşteri bağı korunur; farklı numara sonuç notuna yazılır. Projeye bağlı teklifin telefonunu revizyonla değiştirip var olan müşteri bağıyla çelişmesi engellenir. Kalıcı müşteri kimliği birleştirme/değiştirme akışı eklenmedi.

Kanıt: evidence/phase4-browser.json, phase4-endpoints.json. Üretim yazması/migration/push/merge/deploy yok. Son birleşik kontroller ve mevcut repo kabul kilidinin eski uyumsuzluğu teslim raporunda açıklanır.
