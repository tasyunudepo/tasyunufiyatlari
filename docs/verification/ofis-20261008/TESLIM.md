# Ofis — yerel teslim

**Faz 1–4 tamamlandı; A/B için bekleyen onay yok.** Çalışan önizleme: http://127.0.0.1:3210/ . Yönetici/salt okunur rol seçimi kök ekranda. [Tam sayfa görseller ve kısa inceleme](index.html).

Dal: `codex/ofis-redesign-20261008`. Kök: `.worktrees/ofis-redesign-20261008`. Üretime migration/yazma, push, merge veya deploy yapılmadı. Mevcut kayıtlar otomatik birleştirilmedi; yeni bağlantılar operatör seçimiyle kurulur.

## Tamamlanan fazlar

- [Faz 1](PHASE-1-ACCEPTANCE.md): ayrı PostgreSQL + gerçek endpoint’ler. Yeni üç tabloda önce REVOKE, sonra gerekli GRANT; service_role dahil etkin izinler kontrol edildi. İşlem defterinde UPDATE/DELETE/TRUNCATE yok. Eski tablo ACL’leri aynı. Kullanıcının altı kabul grubu geçti: eşzamanlılık/cevap kaybı, transaction ortasında tam geri alma, yetki, geçmiş başarı, alternatiflerin tek işi/değeri paylaşması, boş rollback ve dolu rollback reddi.
- [Faz 2](PHASE-2-RESULT.md): günlük görev kümesi, ilk temas/geciken/bugünkü takip, sabit kesimli eski kayıtlar, proje dosyası, sonuç/takip kaydı. Başarılı temas son başarısız denemeyle silinmez; link/kopya görevi bitirmez.
- [Faz 3](PHASE-3-RESULT.md): masaüstü liste–teknik föy, mobil tam ekran detay, dönüşte filtre/kaydırma koruma, kayıtlı görünümler, revizyon farkı. Seri gruplaması korundu; aynı saat/telefonlu ayrı serilerin React anahtarı çakışması düzeltildi.
- [Faz 4](PHASE-4-RESULT.md): mevcut hesap motoruyla Excel/form/PDF/revizyon; 200 satırlı teklif ve 6 eşzamanlı revizyon denendi. Tek kayıt güncellenir; eski sürüm/PDF korunur. Seçili proje değeri kayıtlı revizyonun KDV hariç tutarıdır, müşteri onayı/satış değildir ve revizyonla otomatik değişmez.

## Son doğrulama

| Kontrol | Sonuç / kanıt |
|---|---|
| Birim, sözleşme, güvenlik, fiyat | **85 dosyada 765 test geçti** — `evidence/final-tests.log` |
| TypeScript | Geçti — `evidence/final-types.log` |
| ESLint | 0 hata; mevcut çıkış yönlendirmesinde 1 uyarı — `evidence/final-lint.log` |
| Üretim derlemesi | Geçti; dış ağ kapalı, salt okunur boş yerel katalog — `evidence/final-build.log` |
| Mobil/masaüstü | Son fazlarda 20 geometri görünümü + mobil telefon/görüşme testi. 375/390/768/1440 px ve %200; taranan metin en az 14 px/4,5:1, eylemler en az 44 px. `phase2-browser.json`, `phase3-browser.json`, `phase4-browser.json`, `contact-browser.json` |
| Yazma kabulü | Gerçek endpoint/PostgreSQL: `phase1-endpoints.json`, `phase4-endpoints.json` |
| Test zayıflatma taraması | Belirgin bypass/gevşetme alarmı yok. Düzeltme gerekçeleri `PROGRESS.md` içinde. |
| Bu teslimin kabul dosyaları | `sha256sum -c docs/verification/ofis-20261008/evidence/acceptance-sha256.txt` |
| Repo genelindeki eski kabul kilidi | **Geçmiyor:** `tests/e2e/pdp-product-information.spec.ts` için önceden var olan hash uyumsuzluğu. Dosyanın mevcut, HEAD ve başlangıç `716f6bd` hash’leri aynı; bu çalışma dosyayı/kilidi değiştirmedi. `evidence/existing-lock-mismatch.json`. Bu yüzden bütün repo release kapıları geçti denmiyor. |

[Görev karşılaştırması](TASK-COMPARISON.md): görüşme sonucu/takip planlama 5 yerine 3 tıklama; süreler tek otomasyon geçişidir, insan hızı veya lead artışı değildir. Eski arayüzde olmayan bağlantı/görev tamamlama/sürüm karşılaştırması adımları kısmi olarak raporlandı.

## Ortam ve kapsam sınırları

Test DB sıfırdan initdb ile kuruldu; üretim dump’ı veya müşteri export’u alınmadı. Quote/office/temas endpoint’leri gerçek; katalog/analiz okumaları sentetik fixture. PDF üretim/yükleme/erişim uygulama yolları gerçektir, nesne deposu yerel dosya adaptörüdür; Supabase Storage entegrasyon testi sayılmaz. Mesai 09:00–18:00 / 30 dakika ve eski kayıt kesimi açıkça örnek test ayarıdır. Okuma görünümü 1000 proje/2000 teklif sınırına ulaşırsa uyarı gösterir.

Telefon düzeltmesi açık görüşme içindir. Ham numara ve müşteri bağı korunur; farklı numara sonuç notuna eklenir. Kalıcı müşteri birleştirme/kimlik değiştirme akışı eklenmedi. Gerçek arama veya WhatsApp mesajı gönderilmedi.

[Başlatma ve kullanım](../../../scripts/ofis-test/README.md). Ortam `/tmp` altında; makine temizliği sonrası yeniden kurulması gerekebilir. SQL ham dosyaları `scripts/migrations-proposed/` altında; üretime uygulanmadı.

## 14 px istisnası

Kayıt: `/home/emrah/projeler/aktif/tasyunufiyatlari/.impeccable/config.json`. Yalnız `design-system-font-size = 14px`, yalnız `.worktrees/ofis-redesign-20261008/app/ofis/ofis.css`. Kapsam genişletilmedi, bu tur yeni istisna eklenmedi. Kullanım amacı `app/ofis/DESIGN.md` içinde yardımcı metin/rozet olarak belgeli. Daha önceki worktree renk/başlık kayıtları değiştirilmedi.
