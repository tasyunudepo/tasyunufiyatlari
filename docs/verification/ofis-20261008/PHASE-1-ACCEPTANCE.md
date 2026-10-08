# Faz 1 — A/B onayı sonrası gerçek endpoint kabulü

A/B kararları kullanıcı tarafından onaylandı. Değerleme seçimi müşteri onayı veya kazanılmış satış değildir; kayıtlı revizyonun KDV hariç tutarı sunucuda doğrulanır. İstemci tutarı kabul edilmez. Önceki salt okunur aşamanın raporu PHASE-1-RESULT.md içinde tarihsel olarak korunur.

Test hedefi sıfırdan `initdb` ile oluşturuldu: `/tmp/ofis-test-20261008/data`, yerel socket, localhost 55438, DB `ofis_acceptance`. Gerçek uygulama endpoint'leri → yerel PostgREST → bu PostgreSQL zinciri kullanılır. Launcher gerçek ortam dosyalarını reddeder, ortamı allowlist ile kurar ve dış socket/DNS/fetch erişimini engeller. Üretim DB veya müşteri export'u kopyalanmadı.

Repo ham v17/v22/v24/v26 dosyaları boş sentetik legacy şemaya uygulanarak mevcut trigger/constraint sözleşmesi kuruldu. Onaylı yeni migration'dan önce constraint, trigger, RLS, rol üyelikleri, tablo ACL ve etkin izinler kaydedildi: `evidence/phase1-test-before.json`. Yeni migration sonrası: `phase1-test-after.json`.

Test baseline'ı yeni tablolara kasıtlı olarak geniş default ACL verir. Migration yalnız üç yeni tabloda PUBLIC/anon/authenticated/**service_role** izinlerini önce REVOKE eder, sonra gerekli GRANT'leri verir. Etkin izinler migration içinde de doğrulanır; beklenmeyen kalıtılmış izin varsa transaction durur. `office_operations`: SELECT/INSERT; UPDATE/DELETE/TRUNCATE yok. Eski tablo ACL'leri öncesi/sonrası aynıdır.

Gerçek HTTP endpoint + DB kabulü: `scripts/ofis-test/accept-phase1.mjs`, kanıt `evidence/phase1-endpoints.json`.

- 8 eşzamanlı aynı anahtar → tek journal, tek görüşme, tek görev geçişi; aynı anahtarla farklı içerik 409.
- Commit sonrası HTTP cevabı bağlantı kesilerek kaybedildi; aynı anahtar önceki görevi döndürdü.
- Journal/görüşme INSERT sonrası görev UPDATE'inde yerel test trigger'ı hata verdi; bütün iş kayıtları rollback oldu. Tekrar deneme aynı anahtarla çalıştı. Test trigger'ı kaldırıldı.
- Anonim, tanımsız ve patron yazamaz; anon/authenticated RPC çağırmaz; service_role işlem defterini değiştiremez/silemez/truncate edemez.
- Başarıdan sonra başarısız girişim ayrı satır olur; ilk başarı korunur.
- İki alternatif bir proje ve bir ilk temas görevi paylaşır. Değer kayıtlı revizyondan gelir; sahte istemci tutarı, bulunmayan revizyon reddedilir. Revizyon ve değerleme satış aşamasını değiştirmez.
- Boş şemada ham rollback geçti; yeni iş verisi olan şemada rollback bütün silmelerden önce reddedildi.

Test düzeltmesi: ilk çalışmada yetkisiz proxy yanıtının JSON olduğu varsayılmıştı; gerçek proxy düz metin 401 döndürüyor. Test yanıt okuyucusu içerik türünden bağımsız hâle getirildi; 401/403 beklentisi değiştirilmedi, testler gevşetilmedi. İkinci çalıştırma başarılı.

Faz 2'ye geçiş: kabul kontrolleri geçti. Üretim migration'ı, üretim yazması, push/merge/deploy yapılmadı. PDF için test launcher'ında `/tmp` altında ayrı nesne deposu adaptörü vardır; gerçek Supabase Storage sunucusu değildir. Katalog/analiz önizleme kaynaklarının sentetik olduğu banner'da belirtilir; quote/office yazma endpoint'leri gerçek uygulama kodudur.

PostgREST statik çalıştırma kaynağı: https://postgrest.org/en/stable/explanations/install.html ; indirilen resmî release ve SHA-256 `/tmp/ofis-postgrest-bin/source.json` içindedir.
