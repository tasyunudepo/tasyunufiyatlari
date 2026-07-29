# MemPalace Kontrollü Sıcak Hafıza Pilotu

> Durum: Uygulamada  
> Tarih: 27 Temmuz 2026  
> Kaynak brief: MemPalace aramasını iyileştirme veya günlük kullanımdan çıkarma kararı  
> Ana iş hedefi: Ham arşivi silmeden, kaynaklı proje kararlarını güvenli ve ölçülebilir biçimde geri çağırmak.

## 1. Problem

MemPalace deposunda pilot başlangıcında 141.662 drawer bulunuyor. Bunların
84.438'i `unknown`, 23.596'sı `sessions` kanadında. Global arama, güncel proje
kuralları yerine eski konuşma ve kod parçalarını döndürebiliyor. HNSW metadata
durumu `UNKNOWN`; proje araması SQLite BM25 yedeğine düşüyor. Haftalık global
`compress` bütün kayıtları tekrar işlediği için saatlerce CPU ve palace yazma
kilidi tüketiyor.

## 2. Beklenen sonuç

`tasyunufiyatlari` için kritik ve güncel kurallar, kaynak dosya bilgisiyle
`hot-memory` odasında tutulur. Varsayılan pilot sorgusu yalnız bu odayı arar.
Ödeme, nakliye, KDV, EPS ve uyumluluk soruları eski metinler yerine kanonik
cevabı döndürür. Ham arşiv korunur ve yalnız açıkça istenirse aranır.

## 3. Kapsam

### Dahil

- `mempalace-weekly.timer` ve `mempalace-nightly.timer` birimlerini kapalı tutmak.
- Kaynaklı, atomik sıcak hafıza manifesti.
- İdempotent seed aracı.
- Varsayılanı `tasyunufiyatlari/hot-memory` olan sorgu sarmalayıcısı.
- Her varsayılan sorgudan önce fail-closed kaynak ve drawer bütünlük teyidi.
- Gerçek görevlerde dengeli kol atayan, uçtan uca süreyi ölçen A/B sayacı.
- Kritik sorgu, timer, drawer sayısı ve bilgi grafiği doğrulaması.
- Geri dönüş ve kalan risklerin belgelenmesi.

### Kapsam dışı

- Mevcut 141 bin drawer'ı silmek veya topluca yeniden sınıflandırmak.
- `unknown`, `sessions`, eski closet ya da drift/corrupt klasörlerini temizlemek.
- Kurulu MemPalace paketinin `site-packages` kaynaklarını yamamak.
- HNSW indeksini yeniden kurmak.
- Web uygulamasının ziyaretçi veya yönetici davranışını değiştirmek.

## 4. Kaynak önceliği

1. `AGENTS.md` — güncel domain, ödeme, vaat ve uyumluluk kuralları.
2. Güncel kod ve testler — gerçek çalışan davranış.
3. `PROJE_BAGLAM_v2.md` ve `SYSTEM_ARCHITECTURE.md` — güncelliği kod ve
   `AGENTS.md` ile çelişmediği ölçüde bağlam.
4. Küratörlü `hot-memory` — yukarıdaki kaynakların geri çağırma indeksi.
5. Diary ve ham konuşmalar — yalnız geçmiş karar araştırmasında.

MemPalace hiçbir zaman canlı kodun veya proje kurallarının yerine geçen tek
doğruluk kaynağı değildir.

## 5. Gereksinimler

| ID | Gereksinim | Öncelik |
|---|---|---:|
| FR-001 | Bakım zamanlayıcıları yeniden başlatmalarda da kapalı kalmalı | Zorunlu |
| FR-002 | Seed işlemi mevcut drawer'ları silmeden çalışmalı | Zorunlu |
| FR-003 | Her sıcak hafıza kaydı kanonik kaynak dosyaya bağlı olmalı | Zorunlu |
| FR-004 | Seed tekrar çalıştırıldığında kayıt çoğaltmamalı | Zorunlu |
| FR-005 | Varsayılan sorgu yalnız `hot-memory` odasını aramalı | Zorunlu |
| FR-006 | Ham arşiv araması açık bir `--archive` tercihi gerektirmeli | Zorunlu |
| FR-007 | Kritik domain gerçekleri bilgi grafiğinde kaynak taşımalı | Zorunlu |
| FR-008 | Kaynak, manifest veya drawer sapmışsa varsayılan arama fail-closed durmalı | Zorunlu |
| FR-009 | Zaman etkisi tahminle değil gerçek görev başlangıcı–teyitli cevap süresiyle ölçülmeli | Zorunlu |
| NFR-001 | Pilot web uygulamasının build/runtime davranışını değiştirmemeli | Zorunlu |
| NFR-002 | Doğrulama internet veya harici API gerektirmemeli | Zorunlu |
| NFR-003 | Süre kaydı ham kullanıcı sorusunu saklamamalı | Zorunlu |

## 6. Kabul kriterleri ve kanıt

| ID | Başlangıç koşulu | Eylem | Beklenen sonuç | Kanıt |
|---|---|---|---|---|
| AC-001 | Kullanıcı servisi yeniden başlatabilir | Timer durumu okunur | Weekly ve nightly `disabled` + `inactive` | `scripts/verify-mempalace-pilot.py` |
| AC-002 | Baseline 141.662 drawer | Seed çalıştırılır | Toplam drawer sayısı azalmaz | Aynı doğrulayıcı |
| AC-003 | Manifest kaynak dosyaları mevcut | Seed çalıştırılır | Kaynak metni bulunmayan kayıt yazılmaz | Seed ön kontrolü |
| AC-004 | Seed bir kez tamamlanmış | Seed tekrar çalıştırılır | Sabit drawer kimlikleri güncellenir, çoğalmaz | İki seed + doğrulayıcı |
| AC-005 | Kritik sorgu seti hazır | Sıcak hafıza aranır | Her sorgu beklenen kanonik ifadeyi ilk sonuç kümesinde taşır | Aynı doğrulayıcı |
| AC-006 | Eski içerik arşivde duruyor | Varsayılan sorgu çalışır | Sonuçlar yalnız `[tasyunufiyatlari/hot-memory]` odasındandır | Aynı doğrulayıcı |
| AC-007 | KG seed'i tamamlanmış | KG SQLite okunur | Zorunlu gerçekler kaynak drawer ve dosya taşır | Aynı doğrulayıcı |
| AC-008 | Pilot tamamlanmış | Kapsam diff'i incelenir | Web uygulama kaynak dosyalarında pilot kaynaklı değişiklik yoktur | `git diff -- scripts/... docs/...` |
| AC-009 | Seed sonrası kanonik dosya veya manifest değişmiş | Varsayılan sorgu başlatılır | Arama çalışmaz; yeniden inceleme ve seed ister | Pozitif ve negatif sapma testi |
| AC-010 | Gerçek proje sorusu geliyor | `begin`, atanmış kol ve `complete` çalıştırılır | Otomatik geçen süre, sonuç ve kaynak teyidi kaydolur; ham soru kaydolmaz | Geçici JSONL kabul testi |
| AC-011 | Her kolda 5 teyitli doğru görevden az veri var | `report` çalıştırılır | Zaman kazancı üretmez, örneklemin yetersiz olduğunu söyler | Aynı doğrulayıcı |

## 7. Doğrulama komutları

```bash
# Seed
bash scripts/seed-mempalace-hot-memory.sh

# Güvenli varsayılan sorgu
bash scripts/mempalace-hot-search.sh "sipariş ödeme nasıl alınır"

# Gerçek görev A/B ölçümü
python3 scripts/mempalace-pilot-metrics.py begin "sipariş ödeme nasıl alınır"
# Çıktının atadığı yöntemi uygula ve kanonik kaynağı teyit et.
python3 scripts/mempalace-pilot-metrics.py complete <trial_id> \
  --outcome correct --source-verified yes
python3 scripts/mempalace-pilot-metrics.py report

# Pilot kabul paketi
python3 scripts/verify-mempalace-pilot.py
```

`begin` ile `complete` arasındaki duvar saati süresi gerçek görev süresidir.
Kayıt varsayılan olarak
`~/.mempalace/pilot-ab-metrics.jsonl` dosyasına yazılır. Soru metni yerine
SHA-256 özeti ve kelime sayısı tutulur. Kollar ikili bloklarda dengelenir.
Yalnız `correct` + `source-verified=yes` sonuçlar hız karşılaştırmasına girer.
Kol başına en az 5 böyle görev yoksa rapor fark veya kazanç hesaplamaz.

### Kaynak değişikliğini onaylama

Manifestteki `source_registry`, her kanonik dosya için incelemeden geçmiş
SHA-256 değerini ve onay dayanağını taşır. Dosya değişince sıradan seed komutu
da arama da durur. Devam etmek için:

1. `git diff -- AGENTS.md` ile değişikliğin domain kurallarına etkisini incele.
2. Etkilenen sıcak hafıza metnini ve kaynak işaretini gerekirse güncelle.
3. Ancak içerik doğru kabul edildikten sonra
   `source_registry.AGENTS.md.approved_sha256` değerini yeni dosya hash'iyle
   değiştir.
4. Seed'i çalıştır ve kabul paketini yeniden geçir.

Bu işlem otomatik yapılmaz; salt kaynak değişmiş olması yeni içeriği doğru
kabul etmeye yetmez.

## 8. Veri ve geri dönüş

- Seed yalnız manifestteki sabit `drawer_hot_tasyunufiyatlari_*` kimliklerine
  `upsert` yapar; başka drawer silmez.
- Bilgi grafiği eklemeleri idempotent geçerli triple olarak yazılır.
- Timer geri dönüşü gerekirse:

```bash
systemctl --user enable --now mempalace-nightly.timer
systemctl --user enable --now mempalace-weekly.timer
```

Haftalık timer, global sıkıştırma mimarisi düzelmeden yeniden açılmamalıdır.

## 9. Karar kapısı

Pilot ancak kritik sorguların tamamı kanonik cevabı verirse günlük kullanıma
adaydır. Kritik ödeme, KDV veya nakliye sorgularından biri eski/yanlış cevap
döndürürse varsayılan MemPalace araması kapalı kalır; depo salt okunur arşiv
olarak değerlendirilir.

## 10. Doğrulama ilerlemesi

### Tur 1

- Seed kaynak ön kontrolü geçti: 13 drawer ve 8 KG gerçeği.
- İlk seed 13 kayıt yazdı; ikinci seed `0 yazıldı / 13 değişmeden kaldı`.
- Arama çıktıları doğru `tasyunufiyatlari / hot-memory` odasından geldi.
- Kabul doğrulayıcısı CLI gösterimini yanlışlıkla `[wing/room]` beklediği için
  oda kontrolleri kırmızı oldu. Gerçek CLI çıktısıyla kanıtlanan biçim
  `wing / room`; yalnız çıktı ayrıştırıcısı buna göre düzeltildi.
- Ödeme drawer'ı eski yanlış cümleyi uyarı amacıyla aynen içerdiği için negatif
  kapı kırmızı oldu. Kabul kapısı gevşetilmedi; bayat cümle sıcak hafıza
  içeriğinden tamamen çıkarıldı.

### Tur 2

- `mempalace-weekly.timer` ve `mempalace-nightly.timer`:
  `disabled` + `inactive`.
- Kanonik kaynak dosya hash'i metadata'ya bağlandı. Onaylı hash manifestte
  sabit; içerik ve kaynak aynıysa ikinci seed koşusu yazmıyor.
- 13 sıcak hafıza drawer'ı `tasyunufiyatlari/hot-memory` odasında mevcut.
- 8 KG gerçeği `source_file` ve `source_drawer_id` provenance alanlarıyla
  mevcut.
- 10 kritik sorgunun tamamı geçti:
  ödeme, düşük metraj nakliye, tam araç nakliye, EPS minimum sipariş, KDV,
  KVKK, araç kombinasyonu, schema kaynağı, ondalıklı kalınlık borcu ve PDP
  analytics borcu.
- Varsayılan sorgu sarmalayıcısı yalnız sıcak hafızayı arıyor; `--archive`
  kullanımı açık bayat veri uyarısı veriyor.
- Son kabul komutu:
  `python3 scripts/verify-mempalace-pilot.py` → **BAŞARILI**.

### Tur 3

- İlk pilotta kaynak kontrolünün yalnız seed sırasında yapıldığı doğrulandı.
  Varsayılan sorgu bu nedenle seed sonrasındaki kaynak değişikliğini
  yakalamıyordu.
- `--verify-only` modu eklendi. Mod 13 sabit drawer'ın varlığını, içeriklerini,
  manifest metadata'sını, manifestteki onaylı kaynak hash'ini ve kanonik
  dosyanın tam SHA-256 hash'ini salt okunur biçimde karşılaştırıyor.
- Varsayılan sıcak hafıza sorgusu artık bu kontrolü önce çalıştırıyor. Kaynak
  işareti, manifest, drawer veya dosya hash'i saparsa arama sonuç üretmeden
  duruyor. Aynı sapma seed işlemini de durduruyor; böylece sıradan bir seed
  kaynağı sessizce yeniden “doğru” ilan edemiyor. Arşiv modu zaten açıkça
  güvenilmez olduğu için uyarılı ve ayrı.
- Gerçek zaman kazancı için dengeli A/B görev sayacı eklendi. Sayaç gerçek
  başlangıç–teyitli cevap süresini kaydediyor; öznel “kaç dakika kazandırdı”
  tahmini istemiyor.
- Kabul paketi, yapay kaynak sapmasının aramayı kapattığını; iki ardışık gerçek
  görev atamasının iki ayrı kola dağıldığını; küçük örneklemde kazanç
  hesaplanmadığını ve ham soru metninin kayda girmediğini denetliyor.
- Geçici 10 görevlik kabul verisiyle yeterli örneklem rapor dalı da sınandı;
  bu sentetik kayıtlar gerçek pilot ölçüm deposuna yazılmadı.
- Son kabul komutu:
  `python3 scripts/verify-mempalace-pilot.py` → **BAŞARILI**.
- Gerçek ölçüm deposu başlangıç durumu: `hot-memory=0`, `repo-first=0`;
  dolayısıyla şu anda zaman kazancı sonucu yok.

## 11. Pilot kararı

Pilot, kontrollü kullanım için kabul kapısını geçti. MemPalace:

- güncel repo gerçeğinin yerine geçmez,
- yalnız geri çağırma indeksi olarak kullanılır,
- varsayılan olarak `hot-memory` dışına çıkmaz,
- ham arşivi yalnız açık geçmiş araştırmasında kullanır,
- global otomatik bakım kapalıyken çalışır.

Diğer projelere genişletme bu pilotun gerçek oturumlarda sağladığı zaman
kazancı ölçülmeden yapılmaz.

Şu anda ölçüm mekanizması hazırdır; henüz gerçek görev örneklemi birikmediği
için “zaman kazandırıyor” sonucu çıkarılamaz. Karar, her kolda en az 5 kaynakça
teyitli doğru görev tamamlandıktan sonra A/B raporundaki gözlenen medyan süre,
doğruluk oranı ve bakım maliyeti birlikte değerlendirilerek verilir.
