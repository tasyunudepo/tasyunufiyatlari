# Ofis paneli: canlıya geçiş hazırlığı

Durum (9 Ekim 2026): **hazırlık tamam, hiçbir şey uygulanmadı.** Canlı veritabanına yazılmadı, push ve yayın yapılmadı. Uygulama Emrah'ın "uygula" sözünü bekliyor.

## 1. Alınan yedekler

Yer: `~/yedekler/tasyunufiyatlari/2026-10-09-ofis-migration-oncesi/` (depo dışında, yalnız sahibi okuyabilir; müşteri verisi içerdiği için git'e girmez).

| Yedek | Dosya | Doğrulama |
|---|---|---|
| Canlı veritabanı şeması | `db/schema.sql` | 34 tablo, 10 işlev, 11 RLS kuralı, 5 tetikleyici |
| Canlı veritabanı verisi | `db/data.sql` | 34 tablonun hepsinde dökümdeki satır sayısı canlıyla aynı (ör. 133 teklif, 75 müşteri) |
| Roller | `db/roles.sql` | |
| Git: tüm dallar ve stash | `git/tasyunufiyatlari-tum-dallar.bundle` | `git bundle verify` geçti |
| Git: main'in yayındaki hâli | etiket `yedek/2026-10-09-ofis-migration-oncesi` → `716f6bd` | yerel etiket; main zaten GitHub'da aynı commit'te |
| Main'deki izlenmeyen dosyalar | `git/main-izlenmeyen-dosyalar.tgz` | |
| Vercel: yayın kayıtları | `vercel/yayinlar.tsv`, `vercel/canli-yayin.json` | canlıdaki yayın: commit `716f6bd` |
| Yerel ortam dosyası | `vercel/env.local.yerel-kopya` | |

**Alınamayanlar**

- Vercel'deki ortam değişkenleri: komut satırı oturumu ve `.env.local`'deki anahtar yetkisiz (403). Vercel panelinden dışa aktarılmalı ya da yeni bir erişim anahtarı gerekir.
- Depolama (teklif PDF'leri): veritabanı dökümünde yalnız kayıtları var, dosyaların kendisi yok. Bu değişiklik depolamaya dokunmuyor.

## 2. Prova

Canlı yedek yerel geçici bir veritabanına geri yüklendi, üretim kopyaları üzerinde denendi, sonra geçici veritabanı silindi (betik: yedek klasöründe `db/prova-uretim.sh`).

| Adım | Sonuç |
|---|---|
| Yedeğin geri yüklenmesi | 34 tablo ve satırlar geldi (yalnız Supabase'e özgü eklenti ve auth/storage şemaları yerelde yok, beklenen) |
| Bayraksız çalıştırma | Reddedildi, tablo oluşmadı |
| `01_ofis_tablolar.sql` + `02_ofis_islevler.sql` | Temiz uygulandı |
| Mevcut veri | Satır sayıları ve teklif içeriği değişmedi; bağlı teklif 0 |
| Yeni tablolara dışarıdan erişim | `anon` ve `authenticated` erişemiyor |
| `ofis_workbench()` | 133 teklif, 0 proje, 0 görev döndü |
| `99_geri_al.sql` (tablolar boşken) | Uygulandı; şema öncekiyle birebir aynı (135.922 baytlık döküm, fark yok) |

## 3. Değişiklik ne ekliyor

- Üç yeni tablo: `sales_projects`, `sales_tasks`, `office_operations`.
- İki tabloya boş bırakılabilir kolon: `quotes.project_id`; `customer_interactions.project_id`, `operation_id`.
- İki işlev: `ofis_operation`, `ofis_workbench`. Yalnız `service_role` çalıştırabilir.
- Mevcut satırlara dokunmaz, veri taşımaz, depolamaya dokunmaz.

Dosyalar: `scripts/migrations-production/`. Gövdeleri Codex'in test edilmiş taslaklarıyla birebir aynı; tek fark koruma kapısı (üretim onayı bayrağı olmadan çalışmaz).

## 4. Geçiş sırası

Sıra önemlidir: yeni kod, tablolar ve bayrak olmadan yayına girerse Genel Bakış yalnız "Proje ve görev akışı bu ortamda etkin değil" yazar.

1. Yedeği tazele (bu belgedeki dökümler 9 Ekim'e ait; uygulama gününde yeniden alınır).
2. Canlı veritabanına `01_ofis_tablolar.sql`, ardından `02_ofis_islevler.sql`. Yol: `npx supabase db query --linked` (salt okunur sorguyla erişim doğrulandı).
3. Vercel'e üç ortam değişkeni: `OFIS_WORKFLOW_ENABLED=1`, `OFIS_WORK_CALENDAR` (mesai takvimi), `OFIS_LEGACY_CUTOFF` (eski kayıt sınırı).
4. Dalı main'e birleştir ve push et; Vercel yayına alır.
5. Canlıda kontrol: Genel Bakış açılıyor, teklif listesi ve yeni teklif çalışıyor, salt okunur hesap yazamıyor.

## 5. Geri dönüş

| Ne zaman | Yol |
|---|---|
| Adım 2'den sonra, kod yayına girmeden | `99_geri_al.sql`; şema eski hâline döner (provada doğrulandı) |
| Kod yayındayken sorun | Vercel'de bir önceki yayına dön (commit `716f6bd`); eski kod yeni tabloları kullanmaz, boş kolonlar zarar vermez |
| Ekip yeni tabloları kullanmaya başladıktan sonra | Şema silinmez (geri alma dosyası bunu reddeder). `OFIS_WORKFLOW_ENABLED` kapatılır, veri korunur |
| En kötü durum | Veritabanı dökümünden geri yükleme. Yedekten sonra girilen kayıtlar kaybolur; bu yüzden yedek adım 1'de tazelenir |

## 6. Emrah'tan beklenenler

- **"Uygula" sözü** (adım 2–4 bu söz olmadan yapılmaz).
- **Mesai takvimi ve ilk temas hedefi:** çalışma günleri, saatler ve yeni talebe kaç mesai dakikasında dönülmesi gerektiği. Önizlemedeki "hafta içi 09:00–18:00, 30 dakika" yalnız örnektir.
- **Eski kayıt sınırı:** hangi tarihten önceki temassız teklifler günlük sayaca girmeyip "İncelenecek eski kayıtlar"a düşsün (öneri: geçiş günü).
- **Vercel erişimi:** ortam değişkenlerini eklemek için panelden giriş ya da yeni erişim anahtarı.
