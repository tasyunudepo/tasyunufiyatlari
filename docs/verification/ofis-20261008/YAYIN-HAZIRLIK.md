# Ofis paneli: canlıya geçiş hazırlığı

Durum (9 Ekim 2026, 17:20): **uygulandı.** Emrah'ın "uygula" sözüyle şema canlıya işlendi, kod yayına alındı, ilk aktarım yapıldı. Ayrıntı: bölüm 0. Aşağıdaki bölümler hazırlık kaydı olarak duruyor.

## 0. Uygulama kaydı (9 Ekim 2026)

| Adım | Ne yapıldı | Doğrulama |
|---|---|---|
| Yedek | `~/yedekler/tasyunufiyatlari/2026-10-09-uygulama-oncesi/` (veritabanı dökümü + git paketi, 17:00) | Dökümde 133 teklif, 75 müşteri; `git bundle verify` geçti |
| Şema | `01_ofis_tablolar.sql`, `02_ofis_islevler.sql` canlıya uygulandı | 3 tablo, 3 kolon, 2 işlev; `anon`/`authenticated` erişemiyor; 133 teklifin içerik özeti öncekiyle aynı |
| Ayarlar | Vercel API anahtarı geçersiz çıktı; üç ayar `next.config.ts` içinde taşınıyor (Vercel'de aynı adla değişken tanımlanırsa o geçerli) | Canlı `/api/admin/office` takvimi ve sınırı döndürüyor |
| Yayın | `main` → `2ff60cf`, push; Vercel yayını tamamladı | Site sayfaları 200; oturumsuz yazma 401, salt okunur hesap yazma 403; ölçüm denetimi yerelde ve canlıda GEÇTİ; metin kapısı 455 sayfada temiz |
| İlk aktarım | `run.mjs --uygula` (canlı) | 8 proje, 15 teklif bağlandı, 8 proje değeri; 6 açık ilk temas, 2 açık takip, 2 iptal; ikinci koşu kayıt eklemedi |

Ayarların değeri: mesai Pazartesi–Cumartesi 08:00–18:00 (`lib/business/info.ts` ile aynı); ilk temas hedefi 30 mesai dakikası (**geçici**, Emrah'ın kararı bekleniyor); eski kayıt sınırı 9 Ekim 2026 00:00.

Tekliflerde değişen iki alan: bağlanan 15 teklifte `project_id` ve tetikleyicinin güncellediği `updated_at`. Yedekteki eski `updated_at` değerleri yerine konup `project_id` boşaltıldığında 133 teklifin özeti şema öncesiyle birebir aynı çıkıyor.

Not: canlıda tarayıcıyla otomatik kontrol yaparken Vercel güvenlik duvarı HeadlessChrome kimliğini 403 ile engeller; normal tarayıcı kimliği gerekir.

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
5. İlk aktarım (bölüm 4a): son günlerin açık tekliflerini projeye çevirir; iş sırası ilk gün dolu açılır.
6. Canlıda kontrol: Genel Bakış açılıyor ve aktarılan işler sırada, teklif listesi ve yeni teklif çalışıyor, salt okunur hesap yazamıyor.

## 4a. İlk aktarım

Neden: taşımadan hemen sonra 0 proje ve 0 iş vardır; mevcut teklifler kendiliğinden işe dönüşmez. Bu adım bir kereye mahsus son 14 günün açık tekliflerini projeye çevirir (Emrah'ın 9 Ekim 2026 kararı).

Betik veritabanına doğrudan yazmaz; panelde elle yapılan işlemin aynısını panelin kendi uçlarına sırayla gönderir (`scripts/ofis-aktarim/run.mjs`, kurallar `plan.mjs`).

```bash
# 1) Kuru çalışma: yalnız okur, planı tablo olarak yazar
OFIS_AKTARIM_USER=… OFIS_AKTARIM_PASSWORD=… node scripts/ofis-aktarim/run.mjs --taban https://www.tasyunufiyatlari.com
# 2) Uygulama
OFIS_AKTARIM_USER=… OFIS_AKTARIM_PASSWORD=… node scripts/ofis-aktarim/run.mjs --taban https://www.tasyunufiyatlari.com --uygula
```

Seçenekler: `--gun 14` (pencere), `--sorumlu ad` (teklifte yazan kişi yoksa işin sorumlusu; varsayılan giriş yapan kullanıcı).

| Kural | Karşılığı |
|---|---|
| Hangi teklifler | Son 14 takvim gününde gelen, kapanmamış (tamamlandı/reddedildi olmayan), projeye bağlı olmayan |
| Proje | Aynı müşteri kaydının teklifleri tek proje. Müşteri kaydı telefonun birebir eşleşmesidir; ad ya da telefon benzerliğiyle birleştirme yok |
| Proje değeri | En son verilen teklif (panelden değiştirilebilir) |
| Proje aşaması | Müşterinin tekliflerindeki en ileri aşama |
| Sorumlu | Teklifi yazan kişi; yoksa `--sorumlu` |
| Temas kaydı yok, ofis teklifi yazılmamış | İlk temas işi; hedef = ilk geliş + mesai takvimindeki ilk temas süresi (eski talepte gecikmiş görünür) |
| Kayıtlı takip tarihi var | O güne 09:00 takip işi |
| Temas kaydı var ya da ofis elle teklif yazmış, tarih yok | Aktarım gününün mesai sonuna takip işi. Ofisin teklif yazdığı müşteriyle zaten görüşülmüştür; "ilk temas gecikti" yanlış alarm olurdu |
| Görüşme kaydı | Uydurulmaz. Kendiliğinden açılan ilk temas işi "İlk aktarım: …" nedeniyle iptal edilir; o günün "iptal" sayacında görünür |
| Yeniden koşma | Güvenli: işlem anahtarları sabit, aynı kayıt ikinci kez yazılmaz; yarıda kalan aktarım tamamlanır |
| Üzerinde çalışılmış proje | Dokunulmaz; o müşterinin sonradan gelen teklifini bağlamak operatörün kararıdır |

Canlı tekliflerle kuru çalışma (9 Ekim 2026, yalnız okuma): 133 teklifin 15'i kapsamda → 8 proje; 6 ilk temas işi, 1 kayıtlı tarihe takip, 1 aktarım gününe takip. Pencere 30 gün olsaydı 34 teklif → 19 proje.

Prova (`bash scripts/ofis-aktarim/prova.sh`, yerel sentetik veritabanı; kanıt `evidence/aktarim-prova.txt`):

| Sınanan | Sonuç |
|---|---|
| Temiz koşu | 30 teklif → 13 proje; 5 ilk temas, 8 takip; 13 proje değeri ve aşaması |
| İkinci koşu | Kayıt eklenmedi, durum aynı |
| Kesinti: 71 işlemin her birinden sonra süreç öldürülüp yeniden koşuldu | 71 noktanın 71'inde son durum temiz koşuyla birebir aynı |
| Operatörün görüşme kaydettiği proje + aynı müşteriden yeni teklif | Projeye dokunulmadı; teklif bağlanmadı, operatöre bırakıldı |
| Prova sonrası | Veritabanı yedekten geri yüklendi, sayılar prova öncesiyle aynı |

## 5. Geri dönüş

| Ne zaman | Yol |
|---|---|
| Adım 2'den sonra, kod yayına girmeden | `99_geri_al.sql`; şema eski hâline döner (provada doğrulandı) |
| Kod yayındayken sorun | Vercel'de bir önceki yayına dön (commit `716f6bd`); eski kod yeni tabloları kullanmaz, boş kolonlar zarar vermez |
| İlk aktarımdan sonra | Açılan projeler kalır (proje silme işlemi yoktur). Yanlış açılan proje panelden kapatılır; hepsinden vazgeçilecekse veritabanı dökümünden dönülür |
| Ekip yeni tabloları kullanmaya başladıktan sonra | Şema silinmez (geri alma dosyası bunu reddeder). `OFIS_WORKFLOW_ENABLED` kapatılır, veri korunur |
| En kötü durum | Veritabanı dökümünden geri yükleme. Yedekten sonra girilen kayıtlar kaybolur; bu yüzden yedek adım 1'de tazelenir |

## 6. Emrah'tan beklenenler

- **"Uygula" sözü** (adım 2–5 bu söz olmadan yapılmaz).
- **Mesai takvimi ve ilk temas hedefi:** çalışma günleri, saatler ve yeni talebe kaç mesai dakikasında dönülmesi gerektiği. Önizlemedeki "hafta içi 09:00–18:00, 30 dakika" yalnız örnektir.
- **Eski kayıt sınırı:** hangi tarihten önceki temassız teklifler günlük sayaca girmeyip "İncelenecek eski kayıtlar"a düşsün (öneri: geçiş günü).
- **Vercel erişimi:** ortam değişkenlerini eklemek için panelden giriş ya da yeni erişim anahtarı.
