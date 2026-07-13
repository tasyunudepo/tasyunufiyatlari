# Codex → Fable 5 devir raporu: Bonus ve yoğunluk karşılaştırması

**Devir tarihi:** 13 Temmuz 2026  
**Durum:** Karar ve doğrulama hazırlığı tamamlandı; uygulama kodu/migration henüz başlatılmadı.  
**Talimat:** Emrah, ek soru beklemeden aşağıdaki sırayla uygulamaya geçilmesini istiyor.

## 1. Kesin iş kararları

1. **Katalog ile mantolama wizard'ı ayrı kapsamdır.**
   - Teras çatı, ara bölme, giydirme cephe ve endüstriyel taş yünü levhaları katalog ürünü olarak kalır/eklenir.
   - Mantolama wizard'ı yalnız sıvalı dış cephe mantolamasına uygun levhaları gösterir.

2. **Ana karşılaştırma tablosu sekiz üründür.**

| Ürün | Yoğunluk | Müşteri kaynak etiketi |
|---|---|---|
| Bonus Premium F 150 | 150 kg/m³ | Föy beyanı |
| Bonus Premium F 150 Pro | 150 kg/m³ | Föy beyanı |
| Expert HD150 | ≥150 kg/m³ | Föy beyanı |
| Bonus Premium F 120 | 120 kg/m³ | Föy beyanı |
| Expert LD125 | ≥125 kg/m³ | Föy beyanı |
| Dalmaçyalı SW035 | 110–120 kg/m³ | Üretici sözlü beyanı — değişken |
| Expert Taşyünü Premium | 100–110 kg/m³ | Üretici sözlü beyanı — değişken |
| Fawori Optimix TR7.5 | 100–120 kg/m³ | Üretici sözlü beyanı — değişken |

3. **150 yoğunluk sayfası**, ana karşılaştırma tablosunun 150 filtresi açık görünümüdür. Föy-beyanlı üç 150 ürünü önce gelir; diğer beş ürün karşılaştırma bağlamında görünür kalır.

4. Sözlü değerler müşteri tarafında mutlaka **“Üretici sözlü beyanı — değişken”** olarak görünür. İç sistemde kaynak kaydı “Filli Boya bayi ticari bilgisi” olarak tutulur; kullanıcıdan kişi/tarih sorulmayacak ve kişisel bilgi müşteriye/API’ye açılmayacak.

5. Fiyat sütunu tasarımda yer alacak, fakat **Bonus için doğrulanmış ticari fiyat/iskonto kuralı gelmeden kesin fiyat gösterilmeyecek.** Eski GLM HTML’indeki `0,99` çarpanı kaynaklı değildir; kullanılmayacak.

6. “150 yoğunluk” daha iyi ısı yalıtımı iddiası değildir. Teknik açıklama, föydeki mekanik değerleri nötr biçimde kıyaslar. “Pro” adı da otomatik üstünlük olarak pazarlanmayacak.

## 2. Kaynaklar

### Teknik föyler

| Ürün grubu | Dosya |
|---|---|
| Expert HD150 | `docs/ExpertTaşyünüHD150IsiYalitimLevhasiTDS.pdf` |
| Expert LD125 | `docs/6.ExpertTaşyünüLD125IsiYalitimLevhasiTDS.pdf` |
| Expert Premium | `docs/4-1ExpertTaşyünüPremiumIsiYalitimLevhasiTDS_Rev.pdf` |
| Fawori TR7.5 | `docs/Fawori_Tasyuenue_TR_7_5_Isi_Yalitim_Levhasi_TDS_4b4e64b7ab.pdf` |
| Dalmaçyalı SW035 | `docs/dalmacyali_stonewool_sw_035_tasyuenue_isi_yalitim_levhasi_68f039f652.pdf` |
| Bonus Premium F / 120 / 150 / 150 Pro | `_audit/teknik-foyler/2026-07/` |

### Karar ve doğrulama belgeleri

- `bonus-karsilastirma-fikir-turlari.md`: Fable Tur 2 ve Emrah’ın kesin Tur 3 kararları burada.
- `docs/verification/bonus-yogunluk-karsilastirma-prd.md`: Codex’in kabul kriterleri ve test yüzeyi. Fable uygulamaya başlamadan bunu güncel gerçek plan olarak kullanmalı.

## 3. Mevcut kod durumu ve acil düzeltme

### Yanlış müşteri metni

`components/wizard/WizardStep1.tsx` satır 39–43, aşağıdaki ürünler için sabit ve doğrulanmayan yoğunluk metinleri gösteriyor:

```ts
SW035   → 120 kg/m³
Premium → 120 kg/m³
TR7.5   → 120 kg/m³
```

Bu, kesin kararla çelişir. İlk kod fazında bu sabit `MODEL_META` yoğunlukları kaldırılmalı veya teknik profil verisinden, kaynak etiketiyle üretilmelidir. Özellikle TR7.5 ürün adındaki `7.5`, yoğunluk değil **dik çekme sınıfıdır**.

### Wizard filtresi

- `components/wizard/WizardStep1.tsx` ve `components/wizard/Step1ProductSelection.tsx` içinde `DIS_CEPHE_MODELLER` adlı sabit liste var.
- Bu liste şu an mantolama uygunluğunun tek kaynağıdır.
- Hedef: ürün teknik profilindeki `wizard_eligible` / uygulama alanı ile filtrelemek. Böylece RF150, PW50, VF80 gibi katalog ürünleri wizard’a girmez; katalogda kalır.

### Katalog altyapısı

- Ürün rotası: `app/urunler/[kategori]/[slug]/page.tsx`
- Katalog veri okuma: `lib/catalog/server.ts`
- Ortak ürün tipi: `lib/catalog/types.ts` → `CatalogProductView`
- Katalog fiyat/CTA: `lib/catalog/pricing.ts`, `lib/catalog/decision.ts`, `components/catalog/`
- Mevcut `plates.density` tek sayı alanı, aralık + kaynak türü + kaynak tarihi için yetersizdir.

## 4. Önerilen uygulama sırası

### Faz 1 — Veri ve hatalı metin güvenliği

1. Eklemeli, geri alınabilir bir migration oluştur. Tercihen `plate_technical_profiles` adında, `plate_id` ile bire bir bağlı tablo kullan:
   - `application_scope`, `wizard_eligible`, `comparison_eligible`
   - `density_min`, `density_max`, `density_display`
   - `density_source_type` (`datasheet` / `manufacturer_verbal`)
   - `density_source_label`, `density_source_date`
   - yalnız admin için `internal_source_note` = “Filli Boya bayi ticari bilgisi”
   - λ, çekme, basma, yangın, kalınlık ve NPD verileri.
2. Sekiz ürün için seed/UPSERT yaz; Bonus ürünleri yeni ise önce `brands → plates → plate_prices → technical profile` zincirini güvenli kur.
3. Sözlü üçlü için yoğunluk aralığını ve görünür etiketi gir; iç notu public select/API’ye dahil etme.
4. Wizard’daki sabit yoğunluk metinlerini veri gelene kadar kaldır; yanlış kesin değer gösterme.
5. Önce unit/contract testini yaz: sözlü kaynak etiketi, TR7.5 yoğunluk değil çekme sınıfı, wizard dışı ürün bloklama.

### Faz 2 — Wizard ve katalog ayrımı

1. `DIS_CEPHE_MODELLER` sabitini DB destekli filtreyle değiştir.
2. Katalog listesi tüm aktif taş yünü levhalarını göstermeye devam etsin.
3. Wizard prefill yalnız `wizard_eligible=true` profilde oluşsun.
4. Çatı/ara bölme/giydirme ürünlerinin katalogda göründüğünü, wizard’da görünmediğini Playwright ile koru.

### Faz 3 — Karşılaştırma sayfası

1. Önerilen rota: `/tasyunu-yogunluk/150-kg-m3`.
2. Sayfa veri kaynağı, sekiz ürünün profilleri olsun; 150 föy-beyanlı ürünler önce sıralansın.
3. Kalınlık seçilince satır silinmesin; uyumsuz satır “Bu kalınlıkta yok” olsun.
4. Şehir seçimi teklif CTA’sına geçsin. Ticari verisi olmayan Bonus için kesin fiyat üretmesin.
5. Mobil ilk görünümde: ürün, yoğunluk + kaynak etiketi, λ, yangın sınıfı, seçilen kalınlık. Ayrıntılı teknik değerler açılır bölümde.
6. Başlık/SEO metni “daha iyi ısı yalıtımı” vaat etmeyecek; mekanik özellik/fark anlatacak. Müşteri görünen metin değiştiğinde `web-copy-gate` çalıştır.

### Faz 4 — Fiyat sütunu

Bu faz, ancak Bonus için net satış, iskonto ve şehir/tam araç kuralı kodlanabilir hâle gelince yapılacak. Doğrulanmamış fiyat veya çarpanla açılmayacak.

## 5. Zorunlu doğrulama

Mevcut araçlar: Vitest, Playwright, TypeScript, ESLint, Next build.

- Unit/contract: teknik profil normalizasyonu, kaynak etiketi, wizard uygunluk filtresi, yoğunluk sıralaması.
- Route/API entegrasyonu: iç kaynak notunun public yanıta çıkmaması; fiyat yoksa fiyat üretmemesi.
- Playwright: 150 rotası, kalınlık/şehir etkileşimi, katalog–wizard ayrımı, CTA.
- Faz sonu: `npm run verify:full`.
- Müşteri metni değiştiğinde: `bash /home/emrah/.codex/bin/web-copy-gate .`.

Kritik kabul kriterlerinin tamamı `docs/verification/bonus-yogunluk-karsilastirma-prd.md` içinde yer alır.

## 6. Çalışma ağacı uyarısı

Repo zaten kirli. Aşağıdaki değişiklikler Codex’in bu devrinde oluşturuldu ve henüz commit edilmedi:

- `bonus-karsilastirma-fikir-turlari.md`
- `docs/verification/bonus-yogunluk-karsilastirma-prd.md`
- bu handoff dosyası

`app/urun/[slug]/page.tsx` silinmiş görünmektedir; bu Codex değişikliği değildir. Diğer mevcut untracked dosyaları/repoları silme, geri alma veya commit’e zorla dahil etme.

## 7. Codex’in bıraktığı nokta

- Kod, migration, canlı veri değişikliği, deploy veya commit yapılmadı.
- Teknik kaynaklar ve iş kuralları doğrulandı/derlendi.
- Uygulamanın ilk somut işi: yanlış wizard yoğunluk etiketlerini koruyan testleri yazmak ve teknik profil migration’ını kurmaktır.
