# Bonus ve yoğunluk karşılaştırması — PRD ve doğrulama sözleşmesi

> Durum: Taslak — uygulama öncesi  
> Tarih: 13 Temmuz 2026  
> Kaynak: `bonus-karsilastirma-fikir-turlari.md`  
> Risk: **R4** — ürün verisi, fiyat/teklif yönlendirmesi, SEO ve wizard aynı anda etkilenir.

## 1. Problem ve sonuç

Ziyaretçi aynı uygulama alanına uygun taş yünü levhaları teknik değerleriyle yan yana göremiyor. Wizard ise bazı yoğunluk değerlerini sabit metinle gösteriyor; bu metinler teknik föy veya sözlü kaynak etiketi taşımıyor.

Bittiğinde sekiz sıvalı dış cephe mantolama ürünü tek karşılaştırma verisinden beslenecek; 150 yoğunluk sayfası bu tablonun filtresi olacak. Katalogtaki çatı, ara bölme, giydirme cephe ve endüstriyel levhalar ürün olarak kalacak, fakat mantolama wizard'ına girmeyecek.

## 2. Kapsam

### Dahil

- Sekiz ürün için yoğunluk, kaynak türü/tarihi, teknik değerler ve kullanım alanı kaydı.
- 150 yoğunluk karşılaştırma rotası; kalınlık ve şehir seçimi; mevcut teklif akışına yönlendirme.
- Wizard'ın yalnız mantolamaya uygun ürünleri göstermesi.
- Müşteri ekranında “föy beyanı” ve “üretici sözlü beyanı — değişken” ayrımı.
- Yeni teknik veri ve kullanıcı yolculuğu testleri.

### Kapsam dışı

- Bonus fiyat listesini doğrulanmamış satış çarpanıyla canlı hesapta kullanmak.
- Çatı, ara bölme, giydirme cephe veya endüstriyel levhaları mantolama wizard'ına eklemek.
- Sözlü kaydın kişi bilgisini müşteriye göstermek.
- Tüm yoğunluk/şehir sayfalarını ilk sürümde yayınlamak.

## 3. Veri kararı

Her levha için ayrı teknik profil tutulur. Profil en az şu alanları taşır:

- `application_scope` ve `wizard_eligible`
- `comparison_eligible`
- yoğunluk alt/üst sınırı veya tek değer
- `density_source_type`: `datasheet` veya `manufacturer_verbal`
- müşteriye gösterilecek kaynak etiketi ve kaynak tarihi
- yalnız yöneticiye açık bildirim kişi/kaynak kaydı
- λ, çekme, basma, yangın, kalınlık aralığı ve “NPD” durumu

Mevcut `plates.density` alanı tek başına kaynak ve aralık bilgisini taşımaz; karşılaştırma bunun üstüne kurulmayacaktır.

## 4. Fonksiyonel gereksinimler

| ID | Gereksinim | Öncelik |
|---|---|---:|
| FR-001 | Sekiz mantolama ürünü teknik profil ve kaynak etiketiyle kaydedilir. | Zorunlu |
| FR-002 | Wizard yalnız `wizard_eligible=true` olan mantolama levhalarını gösterir. | Zorunlu |
| FR-003 | 150 rotası üç föy-beyanlı 150 ürününü öne çıkarır; ana tablodaki diğer beş ürünü kaynak etiketiyle korur. | Zorunlu |
| FR-004 | Kalınlık seçilince o kalınlıkta olmayan ürün satırı silinmez; “bu kalınlıkta yok” gösterilir. | Zorunlu |
| FR-005 | Şehir seçimi fiyatı yalnız mevcut doğrulanmış ticari veri varsa gösterir; aksi halde teklif çağrısı sürer. | Zorunlu |
| FR-006 | Sözlü yoğunluk değeri müşteriye “üretici sözlü beyanı — değişken” etiketiyle görünür; iç irtibat kaydı API ile sızmaz. | Zorunlu |
| FR-007 | Çatı/ara bölme/giydirme cephe/endüstriyel levhalar katalogda kalır, wizard'a düşmez. | Zorunlu |
| FR-008 | 150 sayfasının başlık, canonical ve yapılandırılmış verisi gerçek teknik kapsamla uyumlu olur; “daha iyi ısı yalıtımı” gibi kanıtsız vaat içermez. | Zorunlu |

## 5. Açık ticari kayıt

| ID | Gereken kayıt | Durum |
|---|---|---|
| A-001 | SW035, Expert Premium ve Fawori TR7.5 için sözlü yoğunluk bilgisini veren üretici/bayi kişisi ve bildirim tarihi | Emrah'dan alınacak; yayın öncesi zorunlu |
| A-002 | Bonus ürünlerinin fiyat sütununda kullanılacak net ticari fiyat/iskonto ve şehir kuralı | Fiyat sütununu açmadan önce zorunlu |

## 6. Kabul kriterleri ve kanıt

| ID | Başlangıç / eylem | Beklenen sonuç | Negatif durum | Kanıt |
|---|---|---|---|---|
| AC-001 | Teknik profil verisi yüklenir | Sekiz ürünün her birinde kaynak türü ve tarih vardır | Kaynak türü/tarihi olmayan profil yayın verisine girmez | Şema + unit |
| AC-002 | Mantolama wizard'ı açılır | Yalnız uygun sekiz ürünün mevcut olanları seçilebilir | RF150, PW50, VF80 gibi ürünler seçilemez | Unit + E2E |
| AC-003 | 150 rotası açılır | HD150 + iki Bonus 150 ürün öndedir; diğer satırlar kaynak etiketlidir | Sözlü değer, föy değeri gibi görünmez | Route entegrasyon + E2E |
| AC-004 | Kalınlık seçilir | Uygun olmayan satır “bu kalınlıkta yok” durumuna geçer | Satır yanlış fiyat/teklif üretmez | Unit + E2E |
| AC-005 | Şehir seçilir | Yalnız ticari verisi olan ürün için fiyat görünür | Veri yoksa kesin fiyat görünmez | Entegrasyon |
| AC-006 | Sözlü kaynaklı ürün görüntülenir | Değişken kaynak etiketi görünür | Bildirim kişisi/iletişim bilgisi API ve HTML'de yoktur | API contract + E2E |
| AC-007 | Çatı veya ara bölme ürün sayfası açılır | Katalogda görünür | Mantolama wizard linki/prefill'i oluşmaz | Route + E2E |

## 7. Fazlar ve doğrulama

| Faz | Kapsam | Bitiş kanıtı |
|---|---|---|
| P1 | Teknik profil şeması, seed verisi, kaynak alanları; yanlış wizard yoğunluk etiketlerinin karakterizasyonu | Unit + migration/contract |
| P2 | Wizard uygunluk filtresi ve katalog ayrımı | Unit + hedefli Playwright |
| P3 | 150 karşılaştırma rotası, kalınlık/şehir UI, SEO | Route entegrasyonu + Playwright + copy gate |
| P4 | Ticari fiyat sütunu (yalnız A-002 tamamlanırsa) | Fiyat unit/entegrasyon + E2E |
| P5 | Tam doğrulama ve üretim öncesi kontrol | `npm run verify:full`, hedefli E2E, build |

## 8. Doğrulama komutları

```text
Hızlı: npm run test:run -- <hedef testler> && npm run typecheck
Tam:   npm run verify:full
E2E:   npm run test:e2e -- <karşılaştırma spec'i>
Metin: bash /home/emrah/.codex/bin/web-copy-gate .
```

## 9. Geri dönüş ve sınırlar

- Teknik profil migration'ı eklemeli ve geri alınabilir olmalı.
- Bonus fiyatı doğrulanmadan `pricing_visibility_mode` kesin fiyata açılmaz.
- Yayında hata varsa 150 rotası ve karşılaştırma menü bağlantısı geri alınabilir; mevcut katalog ve wizard teklif akışı çalışmaya devam eder.

## 10. Goal-ready özet

- **Outcome:** Sekiz dış cephe mantolama levhası kaynaklı teknik verilerle karşılaştırılır; wizard yalnız uygun ürünleri sunar.
- **Verification surface:** Unit, katalog/route entegrasyonu, hedefli Playwright, typecheck, lint ve build.
- **Constraints:** KDV, nakliye, mevcut teklif akışı ve katalog ürün rotaları bozulmaz; sözlü kaynak kişisi görünmez.
- **Boundaries:** Bonus fiyatı A-002 olmadan müşteri fiyatına dönüşmez.
- **Blocked stop:** A-001 olmadan sözlü yoğunluklu ürünler yayın verisine alınmaz; A-002 olmadan fiyat sütunu kapalı kalır.
