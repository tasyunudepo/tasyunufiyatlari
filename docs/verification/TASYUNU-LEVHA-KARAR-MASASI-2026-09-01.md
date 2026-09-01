# Taşyünü Levha Karar Masası — doğrulama sözleşmesi

> Durum: Tamamlandı
> Tarih: 1 Eylül 2026
> Kaynak brief: `artifacts/tasyunu-levha-redesign-2026-09-01/audit-raporu.md`
> Risk: R3 — kritik fiyat/lead yönlendirmesi ve anonim kaynak atfı

## Beklenen sonuç

`/urunler/tasyunu-levha`, mobilde taşmayan bir ürün listesinden fazlası olacak:
ziyaretçi uygulamasını seçip ürünleri daraltabilecek; mantolama için teslim ili
ve yaklaşık metrajı ana hesaplayıcıya kayıpsız taşıyabilecek. Tam araç ve KDV
koşulları ilk karar alanında görünür kalacak, kategori yolculuğu kişisel veri
içermeyen bir kimlikle fiyat sonucuna ve teklif metadata'sına bağlanacak.

## Kapsam

### Dahil

- Sıcak ana sayfa/ürün hub dünyasıyla uyumlu Karar Masası arayüzü.
- Mobil yatay taşma ve sticky çakışmasının kaldırılması.
- Yedi kullanım alanı, URL ile paylaşılabilir marka/kalınlık/yoğunluk filtreleri.
- Mantolama için il + metrajın ana hesaplayıcıya aktarılması.
- Mantolama dışı uygulamalarda bağlamsal ürün keşfi; yanlış fiyat vaadi yok.
- Kategori eventleri, `entry_surface=category` ve `catalog_journey_id` zinciri.
- Kategori rotasında kesintisiz akış; genel `/urunler` gate davranışı korunur.

### Kapsam dışı

- Fiyat, iskonto, marj, araç kapasitesi ve paket formüllerinin değiştirilmesi.
- Yeni Supabase kolonu veya migration.
- Mantolama dışı ürünler için yeni fiyat motoru.
- Üç ürünlü shortlist'in karşılaştırma tablosunu filtrelemesi (sonraki faz).

## Kabul kriterleri

| ID | Başlangıç ve eylem | Beklenen sonuç | Kanıt |
|---|---|---|---|
| AC-TK-001 | Sayfa 320, 375, 390, 430 ve 767 px'de açılır | Belge ve kullanım alanı kontrolü yatay taşmaz | Playwright + ekran görüntüsü |
| AC-TK-002 | Temiz ziyaretçi kategoriye girer | Qualification modalı açılmaz; tam araç gerçeği inline görünür | Playwright |
| AC-TK-003 | Kullanım alanı, marka veya kalınlık seçilir | Sonuç sayısı güncellenir; seçim URL'de korunur; boş durum geri dönüş yolu sunar | Playwright |
| AC-TK-004 | Mantolama + Ankara + 1.200 m² ile CTA'ya basılır | Ana hesaplayıcı Ankara ve 1.200 m² ile açılır | Store unit + Playwright |
| AC-TK-005 | Çatı veya marin seçilip CTA'ya basılır | Kullanıcı ilgili ürün grubuna gider; hesaplayıcıya yönlenmez | Playwright |
| AC-TK-006 | Kategori CTA/bölüm/filtre/ürün etkileşimi oluşur | Olaylar aynı anonim journey kimliğini ve yalnız kategorik alanları taşır | Vitest |
| AC-TK-007 | Kategori kaynaklı hesap tamamlanır | Başlangıç, fiyat sonucu ve teklif metadata'sı `entry_surface=category` ile aynı journey ID'ye bağlanır | Vitest + E2E |
| AC-TK-008 | Klavye ve ekran okuyucuyla sayfa gezilir | Tek `<main>`, adlandırılmış nav/form, görünür focus ve basılı durum vardır | Playwright + detector |
| AC-TK-009 | Ürün kartı açılır | PDP URL'si `entry=category` taşır; ürün tıklaması kart konumuyla ölçülür | Playwright + Vitest |
| AC-TK-010 | Karşılaştırma açılır | `entry=category` korunur ve kategori journey kimliği comparison oturumuna bağlanır | Vitest + mevcut E2E |

## Sınırlar

- Her fiyat bağlamında `KDV hariç` dili korunur.
- Koşulsuz “ücretsiz nakliye”, kesin teslim/dönüş süresi, fiyat garantisi,
  kapora veya taksit vaadi eklenmez.
- Taşyünü fiyat hesabı geçerli tam Kamyon/TIR metrajına yönlendirir.
- `catalog_journey_id` biçimi `cat_<timestamp36>_<random36>` olur; telefon,
  e-posta, isim, adres ve serbest metin GA4'e veya URL'ye gönderilmez.
- `sourceChannel` şeması değişmez; kategori kökeni JSONB attribution içinde
  tutulur. Böylece mevcut CRM sınıflandırması ve quote guard korunur.

## Doğrulama matrisi

| Kabul ID | Risk | Kanıt katmanı | Test/komut |
|---|---:|---|---|
| AC-TK-001–005, 008–010 | R3 | İşlevsel E2E | `npx playwright test tests/e2e/tasyunu-category.spec.ts tests/e2e/lead-qualification-gate.spec.ts tests/e2e/karsilastirma.spec.ts` |
| AC-TK-004 | R3 | Unit | `tests/store/wizard-product-preset.test.ts` |
| AC-TK-006–007, 010 | R3 | Unit/contract | `tests/analytics/category-events.test.ts`, `tests/analytics/wizard-events.test.ts` |
| Tüm UI | R3 | Type/lint/build/detector | `npm run verify:full`; Impeccable detector |
| Görsel bitiş | R3 | Responsive/a11y | 1440×1050 ve 390×844 ekran görüntüsü + axe |

## Veri, geri dönüş ve gözlemlenebilirlik

- Veri/migration: Yok. Journey ID yalnız session storage, GA4 alanı ve mevcut
  `package_items.attribution` JSONB alanında taşınır.
- Geri dönüş: Yeni kategori client island'ı kaldırılıp eski server grid'e
  dönülebilir; fiyat ve DB şeması etkilenmez.
- Ana metrik: kategori kaynaklı tamamlanan brüt kâr / uygun kategori yolculuğu.
- Ara metrikler: hesap başlangıcı, fiyat sonucu, ürün keşfi ve nitelikli lead.
- Guardrail: ana wizard dönüşümü, uygunluk reddi, API hata oranı, LCP/INP,
  event duplicate ve yatay overflow.

## Definition of Done

- [x] Zorunlu kabul kriterleri otomatik kanıtla yeşil.
- [x] Hedefli ve tam doğrulama paketleri geçiyor.
- [x] 390 px ve 1440 px görsel inceleme tamamlandı.
- [x] Impeccable detector bir kez çalıştırıldı; bulgu sayısı `0`.
- [x] Finish reviewer nihai kararı: `disposition: ship`; açık materyal not yok.

## Son kanıt özeti

- `npm run verify:full`: 76 test dosyası, 666 test, TypeScript, ESLint ve
  production build geçti. Yalnız görev dışındaki iki mevcut lint uyarısı kaldı.
- Hedefli Playwright: kategori + karşılaştırma 13/13; gate ile birleşik ilk
  kabul turu 18/18 geçti.
- `verify:acceptance`, `verify:visitor-copy` ve kategori kontrast kapısı geçti.
- 1440 × 1050 ve 390 × 844: yatay taşma `0`, axe ihlali `0`, kırık görsel `0`,
  console error `0`.
- Ekran kanıtları: `artifacts/tasyunu-levha-redesign-2026-09-01/production-verdict-*`
  ve `production-verdict2-*`.
