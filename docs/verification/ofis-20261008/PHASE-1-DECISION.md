> Güncel durum: A/B kararları kullanıcı tarafından onaylandı; migration ve altı kabul kontrolü yalnız ayrı yerel test DB’de tamamlandı. Bu dosyanın aşağıdaki içeriği onay öncesi tarihsel kayıttır; bekleyen A/B kararı yoktur. Güncel sonuç: [PHASE-1-ACCEPTANCE.md](PHASE-1-ACCEPTANCE.md).

# Faz 1 — Uygulamadan önce karar

Durum: mevcut alanlarla yapılabilen yerel okuma ekranı ve sayaç düzeltmeleri tamamlandı. Şema taslağı hazır; uygulanmadı, kayıt yazılmadı. Kod/SQL sözleşmeleri ile çalışan uygulamanın hedefindeki REST şema metadatası karşılaştırıldı. Tablo/kolon varlığı doğrulandı; PostgreSQL constraint, trigger ve RLS kataloğu çalıştırılarak denetlenmiş değildir.

## Yalnız karara bağlı işlerin sınırı

Kullanıcının esas aldığı `ofis-uygulama-talimati (1).md`, Çalışma kuralları 5: **“şema değişikliği gerekiyorsa”** dur. Faz 1: **“Proje başına hangi tutarın sayılacağına dair bir kural öner ve onay bekle.”** Ayrıca doğrulanmış ayrı test veritabanı olmadan hiçbir kayıt veya migration testi yapılmaz.

Bu iki kural keşfi veya mevcut alanlarla yapılan yerel okumaları durdurmuyor. Görüşme geçmişi, başarı/son girişim ayrımı ve aynı filtrelenmiş teklif kümesinden ayrışık durum sayaçları uygulandı. Faz 2–4'ün kalıcı proje/görev yazma davranışı aşağıdaki iki karara bağlı; tamamlanmış sayılmıyor.

“Önceki karar onayı” ile kastedilen somut olarak **A: kalıcı proje + görev + işlem kayıt modeli**, **B: proje tutarı seçme kuralı**. Mevcut şemayı inceleme veya mevcut alanları okuma izni kastedilmiyor; bunlar zaten onaylı.

Canlı hedefte yalnız `GET /rest/v1/` şema okuması ve `customer_interactions` için `limit=0` kolon/projection kontrolü yapıldı: ikisi de HTTP 200. Müşteri satırı okunmadı; yazma ve migration yok. `quotes`, `customers`, `customer_interactions`, `quote_funnel_events` alanları mevcut. Önerilen üç yeni tablo REST'e açılan şemada görünmüyor. Kanıt: [phase1-live-schema.json](evidence/phase1-live-schema.json). Bu okuma, hedefin üretimden ayrı test ortamı olduğunu kanıtlamaz.

## Mevcut model ve korunacaklar

| Kaynak | Mevcut imkân | Sınır / karar |
|---|---|---|
| `scripts/migration-v22-satis-sonucu-modeli.sql` | `pending`, `contacted`, `quoted`, `approved`, `completed`, `rejected`; kayıp nedeni, satış tutarı, brüt kâr, kapanış zamanı | Altı durum aynen korunur. `completed` kazanılan, `rejected` kaybedilen. Bilinmeyen değer ayrıca sayılır. |
| `app/api/admin/quotes/[id]/route.ts` | Teklifte son temas, başarı, takip tarihi ve satış alanları | PATCH son değeri değiştiriyor; ardışık temasların geçmişi değil. |
| `scripts/migration-v24-musteri-varligi.sql` | `customers`, `quotes.customer_id`, `customer_interactions`; görüşme zamanı, kanal, sonuç, not, sonraki iş tarihi | Yeni bir görüşme tablosu kurmaya gerek yok. Müşteri kimliği proje kimliği değildir. |
| `app/api/admin/customers/[id]/interactions/route.ts` | Görüşmeler ayrı satır olarak ekleniyor | İstek anahtarı yok; eşzamanlı/tekrar denenen POST iki kayıt oluşturabilir. `last_contact_at` başarısız denemede de ilerleyebilir; başarılı temas metriği olarak kullanılamaz. |
| `customer_interactions.next_action_*` | Sonraki iş zamanı/notu ve tamamlanma zamanı | Bir görüşmeye bağlı tek iş; proje bazlı ilk iş, atanan kişi, iptal ve ayrı görev tarihçesi eksik. Görüşme ile görev farklı varlıklardır. |
| `lib/admin/groupQuotesIntoSeries.ts` | Telefon + 15 dakika + şehir/malzeme/isim koşullarıyla görüntüleme serisi | Kalıcı proje bağı değil. Mevcut seri görünümü korunur; bu gruplama proje oluşturmaz, fırsat toplamına payda olmaz. |
| `quotes.comparison_session_id`, `scripts/migration-v26-comparison-attribution.sql` | Karşılaştırma yüzeyinden başlayan anonim yolculuk; `package_items.attribution` üzerinden generated kolon | Ofis projesi değildir; manuel tekliflerde genel proje bağı olarak kullanılamaz. Kaynak atfını yeniden adlandırarak proje anlamı yüklenmez. |
| `quote_submission_keys`, `scripts/migration-v17-quote-submission-guard.sql` | Public teklif oluşturma isteği için idempotency ve kısa dönem tekrar önleme | Anahtar 24 saat sonra tekrar kullanılabilir; aktör/görev/işlem türü/sonuç sözleşmesi yok. Kalıcı görev ve görüşme işlem defterinin yerine geçmez. Bu tablo değiştirilmez. |
| `app/api/admin/quotes/manual/route.ts` | `package_items.manual.revisions` altında eski metraj, net/brüt tutar ve PDF yolu var | Ayrı bir revizyon tablosu varsayılan olarak gerekmiyor. Kalem birim fiyatı ve nakliye anlık görüntüsü mevcut JSON sözleşmesine eklenebilir; eski kayıtta eksik bilgi “kayıtlı değil” gösterilir. Eşzamanlı revizyon için sürüm kontrolü ayrıca gerekir. |
| `app/ofis/tabs/QuotesTab.tsx` | `quote_funnel_events` akış zaman çizgisi | Pazarlama akışı ile müşteri görüşme defteri birleştirilmez; yan yana farklı anlamlarla sunulur. |

`SalesOutcomePanel` içindeki mevcut görüşme, takip, ilgilenen kişi ve kayıp nedeni alanları kullanılacak. Yeni model bu alanların işlevini silmeyecek. Kimlikler dış sözleşmede ondalık string olarak taşınmalı; güvenli tam sayı sınırı doğrulanmadan `Number()` kullanılmamalı.

### Mevcut geçmişteki belirsizlik

v24 aktarımı `contact_successful = NULL` değerini de `ulasilamadi` yapıyor ve kanalı `arama_giden` varsayıyor. Bu nedenle `created_by = backfill-v24` kayıtlarında olumsuz sonuç kesin başarısızlık sayılmıyor; “Sonuç doğrulanamadı” olarak gösteriliyor, kanalın teyitli olmadığı belirtiliyor. Olumlu eski kayıt başarı kanıtı olarak korunuyor. Aktarımın zamanı, ilk gerçek görüşme zamanı olarak sunulmuyor. Eski veri düzeltilmedi veya yeniden aktarılmadı.

## Karar A — Önerilen en küçük kalıcı genişleme

SQL dosyaları artık hazırdır: [ileri migration](../../../scripts/migrations-proposed/20261008_ofis_phase1.sql) ve [boş test şemasını geri alma](../../../scripts/migrations-proposed/20261008_ofis_phase1.rollback.sql). **İkisi de uygulanmadı.** PostgreSQL sözdizimi çözümleyicisi ileri dosyada 32, geri almada 13 ifadeyi kabul etti; bu, veritabanında migration/FK/RLS/transaction çalıştırma testi değildir. Ayrı test hedefi doğrulanmadan böyle bir test yapılmaz.

1. **`sales_projects`**: UUID `id`, nullable `customer_id`, ad, sorumlu, satış durumu (mevcut altı anahtar + nullable eski belirsizlik), `valuation_quote_id`, `valuation_revision`, `valuation_net_amount`, `valuation_selected_at/by`, oluşturma ve güncelleme zamanı. Seçilen tutar kararı aşağıda. Teklif durumu ayrı kalır; teklif alternatifinin durum değişimi projeyi otomatik kapatmaz.
2. **`quotes.project_id`**: nullable FK. Public teklif INSERT'leri yeni alan istemez. Aynı telefon/isim için arka planda proje birleştirme veya geçmiş toplu otomatik bağlama yok. Bağ seçimi operatörce yapılır ve kaydı tutulur. Yeni bağımsız talep bir başlangıç projesi açabilir; alternatif/revizyon açıkça mevcut proje üzerinden oluşturulur.
3. **`customer_interactions.project_id`**: nullable FK. Eski `quote_id` ve `customer_id` korunur. Yeni görüşmede seçili projenin müşterisi/teklifi transaction içinde doğrulanır. Eski müşteri genelindeki başarı, o müşterinin tüm projelerine kopyalanmaz. Bağlantısı kesin olmayan görüşme ayrı görünür.
4. **`sales_tasks`**: UUID `id`, `project_id`, tür (`initial_contact` / `followup`), `due_at` timestamptz, `owner`, durum (`open` / `done` / `cancelled`), planlama/tamamlama/iptal zamanları, tamamlayan, sonuç görüşmesi bağlantısı, iptal nedeni. İlk temas için proje başına benzersiz kısıt: alternatif/revizyon ikinci ilk iş oluşturamaz. Bir projenin birden çok ayrı takip işi olabilir. Görev tamamlaması ve sonuç kaydı aynı transaction içinde yapılır.
5. **`office_operations`**: UUID işlem anahtarı, aktör, işlem türü, istek özeti hash'i, proje FK'sı, sonuç kimliklerini taşıyan JSON ve zaman. İşlem anahtarı benzersiz. Yeni atomik yazma yolu aynı anahtar + aynı aktör/tür/yük için önceki sonucu döndürecek; farklı yük 409 olacak. Bu kayıt temas defterinin yerine geçmez. Bağlantı tıklama/kopyalama olayları farklı türdür; temas başarısı üretmez. **DDL dosyası mevcut endpoint'lere atomiklik veya idempotency kazandırmaz.** İşlem kaydı, görüşme ve görev geçişi aynı DB transaction'ında uygulanacak; ayrı commit edilmiş boş rezervasyon kullanılmayacak. Bu yazma yolu henüz uygulanmadı.

Yeni tablolar mevcut admin modeliyle uyumlu: RLS/FORCE RLS, anon/authenticated erişimi yok; yalnız yetki kapısından geçen server işlemleri. `patron` hiçbir yeni yazma yoluna erişemez. Yeni proje/işlem UUID; mevcut bigint müşteri/teklif kimlikleri kayıpsız korunur. Tanınmayan eski durumlar toplamdan düşürülmez.

SQL, değerlenen teklifin ve sonuç görüşmesinin aynı projede olmasını bileşik FK ile sınırlar. Yeni görüşmenin `customer_id` ve `quote_id` değerlerinin seçili projeyle uyumu ayrıca yeni transaction içinde doğrulanmalıdır; yalnız bu DDL'nin bunu sağladığı iddia edilmez.

### Temasın türetilmesi

- Görüştüm / Yanıt aldım → mevcut `ulasildi` sonucuyla yeni görüşme satırı.
- Ulaşamadım → mevcut `ulasilamadi`; Mesaj gönderdim → mevcut `mesaj_birakildi`.
- Başarı: projeye açıkça bağlanan görüşmelerde en az bir `ulasildi`; ilk başarı `min(occurred_at)`. Son girişim bundan ayrı, zaman + kimlik sırasıyla seçilir.
- Kayıt yok → “Temas kaydı yok”. Önceden kayıtlı başarılı temas alanı varsa eski bilgi olarak korunur; sonraki başarısız kayıt bunu silmez. Eski `randevu`/`fiyat_verildi` gibi sonuçlardan doğrulanmamış yeni görüşme geçmişi uydurulmaz.
- Not, kopyalama, bağlantı tıklama, işlem yapmadım veya boş sonuç başarı sayılmaz. Kaydetme başarısızsa kullanıcı girişi ve istek anahtarı korunur.

## Karar B — Onaya sunulan tutar kuralı

**Öneri: operatörün seçtiği tek teklif + revizyonun KDV hariç tutarı.**

- Bir proje, onaylanan tek bir alternatifi ve revizyonu referans alır. Diğer tekliflerin tutarları açık fırsata eklenmez.
- Revize edilen teklif otomatik olarak fırsat değerini değiştirmez. Yeni revizyon, farkı gösterilerek tekrar seçilir. Değerleme anında net tutar ve revizyon numarası saklanır.
- Seçim yoksa “Tutar seçilmedi” gösterilir; proje adet sayacında kalır, parasal toplamın altında tutarı eksik proje adedi ayrıca belirtilir. Sıfır tutarlı proje gibi sunulmaz.
- Kazanılan/kaybedilen proje açık fırsat toplamından çıkar. `approved` açık kalır; mevcut `completed` ile aynı sayılmaz.
- “Toplam teklif tutarı”, belge toplamıdır; alternatif içerdiği açıkça yazılır. “Açık fırsat tutarı”, tekil ve açık projelerin seçili net tutarlarıdır. Aynı filtre/dönem/veri anı tüm dağılımlarda ortak kullanılır.
- Sentetik örnek: aynı proje için 219.744 ₺ ve 231.000 ₺ net iki alternatif var. Operatör ilkini seçerse fırsat **219.744 ₺**; 450.744 ₺ değil. Seçim yoksa fırsat değeri belirsizdir.

Alternatif karar: her projedeki son revizyon otomatik sayılabilir; ancak müşteriye sunulmamış bir revizyon fırsat değerini değiştirir. Bu nedenle önerilmiyor.

## Sonraki fazların hazır uygulama sınırı

- `Europe/Istanbul` gün sınırı; günlük küme açık gecikmiş işler + bugün hedeflenen işler + bugün tamamlanan işlerdir. İptal ayrı gösterilir. Üç açık grup ayrışıktır. Bitirilen görev aynı gün toplamında kalır.
- İş takvimi ve ilk temas hedefi için mevcut, doğrulanmış bir işletme ayarı bulunamadı. Alanlar yapılandırılabilir tasarlanır; gerçek mesai/yanıt hedefi uydurulmaz. Sentetik önizleme ayarı açıkça örnek olarak etiketlenir.
- Eski kayıtlar için sabit aktarım partisi/kesim anı saklanır; kayan yaş eşiği kullanılmaz. Yeni cevapsız talepler eski kuyruğa itilmez. Mevcut planlı görev günlük iş akışında kalır.
- Faz 2 Sevk Masası ve Faz 3 Teknik Föy, bu onaylanan kaynaklardan okunur. Faz 0 önizlemesindeki eski huni/sayaç metinleri yeni görev/proje modeli olarak onaylanmış değildir.
- Faz 4'te hesaplama motoru, tek ödeme kuralı, nakliye koşulları, Excel, aksesuar ve iç marj davranışı korunur; müşteri PDF'sine iç marj eklenmez.

## Mevcut veriye etkisi ve geri dönüş

1. Önce doğrulanmış test DB'nin gerçek tablo/constraint/trigger envanteri alınır. Repo v24'ün uygulanmış olduğu varsayılmaz.
2. Nullable kolonlar ve üç yeni tablo eklenir; mevcut teklif ve etkileşimlerde yeni bağlantılar NULL kalır. Geçmiş teklif tutarları/durumları/telefonları güncellenmez. Yeni sütunlar eski INSERT'lere zorunlu alan eklemez. UNIQUE/FK/index eklemeleri mevcut tabloları tarayabilir ve kilit gerektirebilir; taslakta 5 saniye lock, 120 saniye statement timeout var. Hedef envanteri ve tablo boyutu testte ayrıca değerlendirilir.
3. Yeni akış başlangıçta kapalı bir feature flag ile uygulanmalıdır; bu dosya henüz flag veya yeni yazma endpoint'i eklemiyor. Eski etkileşim ve revizyon JSON'u korunur; otomatik telefon/proje backfill'i yoktur. Yeni ilişkiler kullanıldıktan sonra seçili teklif/proje/sonuç görüşmesini silmek RESTRICT nedeniyle reddedilebilir; buna göre arşivleme/bağ çözme akışı ayrıca uygulanmalıdır. Bağlantısız mevcut satırlar bu yeni FK'lerden etkilenmez.
4. Eski kayıt aktarımı ayrı, sabit partide ve gözden geçirilerek yapılır. Kaynak kimliğiyle tekilleştirilir; kaynaklar silinmez.
5. Geri dönüşte flag kapatılır ve eski uygulamaya dönülür. Yeni iş verisi varsa tablolar/kolonlar silinmez; admin erişimli korunur. Hazır rollback dosyası yeni tablolarda veri veya eski tablolarda yeni bağlantı varsa silmeyi reddeder. Boş test ortamındaki çalışma davranışı ayrıca doğrulanmalıdır.

## Ayrı test ortamında bekleyen kabul

- Aynı işlem anahtarıyla iki eşzamanlı istek → tek olay/tek görev geçişi; cevap kaybı + retry aynı sonucu döndürür.
- Başarılı görüşme → başarısız görüşme → yenileme: ilk başarı korunur, son deneme başarısız görünür.
- Aynı proje iki alternatif → tek ilk temas işi; iki farklı proje aynı müşteri → iki ayrı iş.
- Görüşme/task transaction ortasında hata → kısmi kayıt yok; tekrar deneme güvenli.
- İstanbul gece yarısı, mesai dışı süre, hafta sonu, iptal/tamamlama/günlük sayaç eşitliği.
- Seçili revizyon ve alternatife göre tek fırsat tutarı; seçim olmayanların sayısı görünür.
- Admin yazabilir; patron/anon/bilinmeyen rol reddedilir. PDF upload yalnız ayrı test bucket'ına gider.

**İstenen iki karar:** A — Üç yeni tablo ve nullable proje/işlem bağlantılarıyla bu kalıcı model kabul ediliyor mu? B — Operatörün seçtiği tek teklif/revizyonun KDV hariç tutarı proje değeri olsun mu? Şema uygulaması ve kayıt yazan doğrulama ancak bu kararlar ve üretimden ayrı test hedefi doğrulaması sonrasında yapılacak. Güvenli mevcut-alan okuma işi bu kararlara bağlanmadı ve tamamlandı; üretim hedefine yazılmayacak.
