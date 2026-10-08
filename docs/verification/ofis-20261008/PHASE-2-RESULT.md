# Faz 2 — Bugün / Sevk Masası

Tamamlandı. Genel Bakış grafiklerden ayrıldı; tekil görev kuyruğu, günlük sayaç, seçili proje dosyası ve sonuç/takip alanı aynı veri anından besleniyor. İlk temas, geciken takip ve bugünkü takip ayrışık; önerilen sıra bütün gruplarda hedef zamanıdır. Tamamlanan günlük toplamda kalır; iptal ayrı sayılır. Proje/teklif/fırsat metrikleri görev sayacına karıştırılmaz.

Mesai takvimi `OFIS_WORK_CALENDAR` ayarıdır; yoksa yeni ilk temas işinin oluşturulması görünür hatayla durur. Yerel ayar açıkça örnektir. Mesai dışı ve hafta sonu süresi tüketilmez. Eski kayıt kuyruğu `OFIS_LEGACY_CUTOFF` sabit sınırını kullanır; kayan yaş eşiği yok. Var olan temas veya planlı iş eski kaydı bu kuyruğa sokmaz.

Temas sonuçları ve takip planlama gerçek endpoint üzerinden yazılır. Telefon gösterme/kopyalama/arama uygulamasında açma ayrıldı. WhatsApp taslağı kayıtlı teklifin nakliye/geçerliliğinden gelir; düzenlenebilir, maliyet/marj içermez. Gerçek telefon/mesaj gönderilmedi.

Doğrulama: 167 birim/güvenlik testi, TypeScript ve 0 hatalı ESLint. 375/390/768/1440 px ve %200 yakınlaştırmada 5 tarayıcı görünümü geçti. Kopyalama/İşlem yapmadım etkisizliği, kalıcı görev tamamlama, toplam eşitliği, hata sonrası not ve aynı işlem anahtarıyla retry, mobil patron rolü doğrulandı. Kanıt: `evidence/phase2-browser.json`, `phase2-tests.log`, `phase2-types.log`.

İncelemede WhatsApp linkinin eski renk kuralı yeni yeşil düğmenin yazısını da yeşile çeviriyordu; özgüllük düzeltilip beyaz yazı kontrastı doğrulandı. Textarea'nın değişen içeriği örtük etiketini değiştiriyordu; görünür metinle eşleşen sabit erişilebilir ad verildi. Ölçütler gevşetilmedi.

19/26/40 px başlıklar ve mevcut yardımcı durum tonları tanımlı Ofis tokenlarına toplandı; yeni hook muafiyeti eklenmedi. 14 px istisnasının dosya/değer kapsamı değişmedi.

Görseller: `evidence/phase2-today-1440.png`, `phase2-today-375.png`. Üretim, push/merge/deploy yok.
