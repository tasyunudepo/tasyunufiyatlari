# Ofis: ayrı yerel test DB ve çalışan önizleme

Güncel önizleme: http://127.0.0.1:3210/ . Kök ekran yönetici ve salt okunur rol arasında geçiş sağlar. Kayıtlar sentetiktir. Üretim ortam dosyası, müşteri export'u veya uzak servis anahtarı kullanılmaz.

Tarayıcıda bu kök bağlantıyı açın; yerel önizleme şifre istemeden açılır. Seçilen demo rolü, tarayıcıda kalmış Basic giriş bilgisinden önceliklidir. `/ofis` adresine doğrudan ve demo çerezi olmadan girişte yalnız yerel hesaplar geçerlidir: `preview` / `preview-only`, salt okunur için `patron` / `preview-readonly`. Üretim parolası bu izole ortamda kullanılmaz.

- PostgreSQL 18: `/tmp/ofis-test-20261008/data`, socket `/tmp/ofis-test-20261008/socket`, port 55438, DB `ofis_acceptance`. Test betikleri yazmaya başlamadan, `apply()` her ham SQL dosyasından önce `verifyTarget()` ile gerçek data_directory/port/owner ve initdb kanıtını denetler.
- PostgREST: port 3212; config ve yalnız bu cluster için üretilmiş anahtarlar `/tmp/ofis-test-20261008/` içindedir. Anahtarlar git'e alınmaz.
- Geçit: port 3211. Ofis/teklif/görüşme verileri ve RPC gerçek PostgreSQL'e gider. İlgisiz katalog/analiz okumaları sentetik fixture'dır. PDF nesneleri yerel dosya adaptöründe tutulur; bu bir Supabase Storage sunucusu değildir.
- Next uygulaması: port 3210, gerçek auth/proxy/endpoint'ler. Node/worker dış socket ve DNS erişimi kapalıdır. Otomasyon tarayıcısı da loopback dışını engeller; gerçek arama/WhatsApp gönderimi yapılmaz.

## Mevcut ortamı yeniden açma

Cluster çalışıyorsa yeniden başlatmayın. Durum: `pg_ctl -D /tmp/ofis-test-20261008/data status`.

Gerekirse aynı doğrulanmış cluster: `pg_ctl -D /tmp/ofis-test-20261008/data -l /tmp/ofis-test-20261008/postgres.log start`.

PostgREST kapalıysa: `/tmp/ofis-postgrest-bin/postgrest /tmp/ofis-test-20261008/postgrest.conf`.

Bu worktree'de: `node scripts/ofis-test/start.mjs`.

Launcher `.env.example` dışındaki ortam dosyalarını reddeder. Node ortamını allowlist ile kurar. Mesai ayarı açıkça örnektir: hafta içi 09:00–18:00, 30 mesai dakikası. Geçmiş kayıt kesimi test örneği olarak 08.10.2026 00:00 İstanbul'dur. Üretim iş takvimi/kesimi yapılandırılmadan bunlar üretim kuralı sayılmaz.

`setup.mjs` ilk kurulum içindir: var olan test DB'yi sıfırlamaz, reddeder. Migration'lar repodaki ham SQL'den uygulanır. Kabul testleri yeni sentetik kayıtlar ekler; mevcut test kayıtlarını topluca temizlemez.

## Kontroller

- `node scripts/ofis-test/verify-entry.mjs`: tarayıcı girişi, eski Basic bilgisiyle rol geçişleri, oturumsuz ve salt okunur yazma reddi; kayıt oluşturmaz.
- `node scripts/ofis-test/accept-phase1.mjs`: concurrency, cevap kaybı, transaction rollback, ACL/rol, geçmiş başarı, alternatifler, dolu rollback reddi.
- `node scripts/ofis-test/accept-phase4.mjs`: eşzamanlı revizyon, tutar doğrulama, değerleme snapshotı, müşteri bağının korunması.
- `node scripts/ofis-test/verify-phase2.mjs`, `verify-phase3.mjs`, `verify-phase4.mjs`: gerçek UI ve gerçek test DB.
- `node scripts/ofis-preview/check.mjs alltests`, `types`, `lint`, `build`: steril ortam; build sentetik boş katalog kullanır.

`compare-tasks.mjs` için eski kaynak `/tmp/ofis-before-20261008` altında `716f6bd` commitinden arşivlenmiştir. `start.mjs --baseline` bunu 3213'te aynı yerel DB ile çalıştırır. Eski kaynakta olmayan görev/iletişim/sürüm karşılaştırması adımları tamamlanmış sayılmaz. Ölçümler insan performansı değildir.

`../ofis-preview/start.mjs` önceki Faz 0–1 salt okunur fixture önizlemesidir; yeni kalıcı görev akışı için güncel launcher yukarıdakidir. Ortam /tmp altında olduğundan yeniden başlatmada silinebilir; yeniden kurulumda yeni yerel cluster ve anahtar gerekir, üretime yönlendirme yapılmaz.

Kabul testleri açık işleri tamamladıysa inceleme örnekleri: `node scripts/ofis-test/seed-demo.mjs`. Açık iş varsa yeni örnek eklemez; yoksa yalnız ayrı test DB’de gerçek endpoint’lerle örnek ilk temas ve takip işleri hazırlar.
