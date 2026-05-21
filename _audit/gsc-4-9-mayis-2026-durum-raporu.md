# GSC Durum Raporu: 4-9 Mayıs 2026 Kırılımı

**Tarih:** 2026-05-21
**Kaynak:** `/home/emrah/İndirilenler/https___www.tasyunufiyatlari.com_-Performance-on-Search-2026-05-21.zip`
**Filtre:** Google Search Console, Web, son 28 gün (`2026-04-21` - `2026-05-18`)

> Not: Export'taki `Grafik.csv` günlük veri veriyor; `Sorgular.csv` ve `Sayfa sayısı.csv` ise 28 günlük toplam. Bu yüzden 4-9 Mayıs için sorgu/sayfa bazlı kesin günlük kırılım yok. Sayfa/sorgu yorumu 28 günlük toplam + GSC ekran görüntüsündeki son 7 gün yükselen/düşen içerik sinyalinden çıkarımdır.

## Yönetici Özeti

4-9 Mayıs kırılımı tek bir "gösterim kayboldu" olayı değil. İlk günlerde gösterimler korunuyor, hatta 4-6 Mayıs'ta önceki haftaya göre daha yüksek; asıl kayıp **TO/CTR düşüşü** ve hafif pozisyon zayıflamasıyla başlıyor. 8-9 Mayıs'ta buna gösterim düşüşü de ekleniyor.

En olası ana neden: **30 Nisan - 1 Mayıs civarı yapılan URL/canonical geçişinin Google tarafından yeniden konsolide edilmesi**. Eski `/kategori/...`, eski `/urun/...` ve slash'lı marka URL'leri düşerken yeni `/urunler/...` ve slash'sız marka URL'leri yükseliyor. Bu normal bir migrasyon dalgalanması; fakat net trafik kaybı, geçiş sırasında CTR'nin zayıflamasıyla büyümüş.

## Günlük Kırılım

| Tarih | Tıklama | Gösterim | TO | Pozisyon | Önceki hafta aynı güne göre |
|---|---:|---:|---:|---:|---|
| 2026-05-04 | 86 | 3219 | 2.67% | 7.0 | Tık -16.5%, gösterim +7.6%, TO -0.77 puan |
| 2026-05-05 | 61 | 3054 | 2.00% | 7.3 | Tık -48.3%, gösterim +1.5%, TO -1.92 puan |
| 2026-05-06 | 76 | 2828 | 2.69% | 7.0 | Tık -17.4%, gösterim +4.4%, TO -0.71 puan |
| 2026-05-07 | 60 | 2452 | 2.45% | 7.3 | Tık -27.7%, gösterim -10.1%, TO -0.59 puan |
| 2026-05-08 | 38 | 2339 | 1.62% | 7.3 | Tık -44.9%, gösterim -8.3%, TO -1.08 puan |
| 2026-05-09 | 27 | 1619 | 1.67% | 7.6 | Tık -71.6%, gösterim -37.0%, TO -2.03 puan |

## Dönem Karşılaştırması

| Dönem | Tıklama | Gösterim | TO | Pozisyon | Günlük tık. ort. |
|---|---:|---:|---:|---:|---:|
| 2026-04-28 - 2026-05-03 | 551 | 16262 | 3.39% | 6.84 | 91.8 |
| 2026-05-04 - 2026-05-09 | 348 | 15511 | 2.24% | 7.21 | 58.0 |
| 2026-05-10 - 2026-05-15 | 251 | 11392 | 2.20% | 7.45 | 41.8 |
| 2026-05-16 - 2026-05-18 | 85 | 5549 | 1.53% | 7.64 | 28.3 |

Kırılım döneminde önceki 6 güne göre:

- Tıklama: `551 -> 348` (**-203 / -36.8%**)
- Gösterim: `16262 -> 15511` (**-751 / -4.6%**)
- TO: `3.39% -> 2.24%` (**-1.15 puan**)
- Ortalama pozisyon: `6.84 -> 7.21` (**+0.37 kötüleşme**)

Bu tablo "talep tamamen düştü" demiyor. Gösterim sadece -4.6% iken tıklama -36.8%. Kayıp ağırlıklı olarak arama sonucunda daha az tıklanma ve küçük pozisyon kaybı.

## URL / İçerik Sinyali

28 günlük toplamda en büyük trafik taşıyan sayfalar:

- Ana sayfa: `370` tık, `18411` gösterim, `2.01%` TO, poz. `7.7`
- `dalmacyali-stonewool-sw035...10-cm` eski ürün URL'i: `128` tık, `4192` gösterim, `3.05%` TO
- `/kategori/eps-levhalar/`: `89` tık
- `/kategori/tasyunu-levhalar/`: `80` tık, `5688` gösterim, yalnız `1.41%` TO
- `/marka/dalmacyali/`: `58` tık
- `/urunler/...` yeni ürün/kategori sayfaları da görünürlük almaya başlamış

GSC ekran görüntüsündeki son 7 gün sinyali URL geçişini doğruluyor:

- Düşenlerde eski/canonical dışı URL'ler önde: `/kategori/tasyunu-levhalar/`, eski `/urun/expert-hd150...`, slash'lı `/marka/dalmacyali/`, `/marka/fawori/`.
- Yükselenlerde yeni canonical URL'ler önde: `/marka/dalmacyali`, `/marka/filli-boya`, `/urunler/tasyunu-levha`, `/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu`, `/urunler/.../expert-hd150-tasyunu`.

## Muhtemel Sebepler

1. **URL migrasyonu ve canonical konsolidasyonu**
   - 2026-04-30 commit'i eski WP kategori/ürün URL'leri için 301 yönlendirmeleri ve `/urun/[slug] -> /urunler/...` redirect katmanını ekledi.
   - 2026-05-01 commit'i canonical/sitemap/robots tarafını `https://www.tasyunufiyatlari.com` olarak hizaladı.
   - GSC, eski URL'lerden yeni URL'lere sinyali taşırken geçici düşüş ve rapor split'i görülebilir.
   - Levhalarda eski her kalınlığa özel URL yapısı tek ana ürün URL'ine ve `?kalinlik=9cm` parametresine konsolide edildi. Bu, duplication riskini azaltır; fakat Google'ın "10 cm taş yünü" gibi kalınlık niyetli eski landing sinyalini ana ürün sayfasına yeniden taşıması zaman alır.

2. **CTR düşüşü**
   - 4-6 Mayıs'ta gösterimler önceki haftadan yüksek/benzer olduğu halde tıklamalar düşüyor.
   - Ana sorgular "taş yünü fiyatları", "taşyünü fiyatları", "10 cm taş yünü fiyatları" fiyat niyetli. Hero/H1 ve snippet tarafında "PDF teklif / kapı teslim hesap" vurgusu, fiyat listesi arayan kullanıcı için daha az direkt görünebilir.

3. **Ürün snippet / Product schema hatası**
   - URL Denetimi ekranında `/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu` için Product rich result hatası göründü: `"offers", "review" veya "aggregateRating" belirtilmelidir`.
   - Kod kontrolünde Product JSON-LD `offers` alanının yalnızca `product.base_price` varsa yazıldığı görüldü. Levhalarda fiyatlar `thickness_prices` satırlarına taşındığı için ana Product node `offers` olmadan kalabiliyor.
   - Bu hata doğrudan klasik mavi link sıralamasını düşürmek zorunda değildir; fakat ürün snippet görünürlüğünü ve SERP'te tıklanabilirliği zayıflatabilir. CTR düşüşüyle uyumlu ek sinyaldir.

4. **Pozisyonun küçük ama etkili bozulması**
   - Ortalama pozisyon `6.84 -> 7.21`, sonraki dönemde `7.45`.
   - İlk sayfada 6-8 bandındaki 0.5 pozisyon kaybı CTR'yi ciddi etkileyebilir.

5. **Hafta sonu / talep etkisi**
   - 9 Mayıs Cumartesi günü hem gösterim hem CTR sert düştü. Fakat 5-8 Mayıs'taki CTR düşüşü sadece hafta sonuyla açıklanamaz.

## Risk Seviyesi

**Orta.** Bu veri migrasyon sonrası beklenebilir dalgalanma gösteriyor; ancak düşüş 10-18 Mayıs'ta da tam toparlamadığı için sadece "geçer" diye bırakılmamalı. Özellikle ana sayfa ve kategori sayfalarının düşük CTR'si müdahale istiyor.

## Önerilen Aksiyonlar

1. GSC'de eski URL'ler için URL Denetimi yap:
   - `/kategori/tasyunu-levhalar/`
   - `/urun/expert-hd150-tasyunu-isi-yalitim-levhasi-10-cm/`
   - `/marka/dalmacyali/`
   Beklenen: 301 -> yeni canonical URL, yeni URL indekslenebilir.

2. Yeni canonical URL'leri GSC'de "Dizine eklenmesini iste" ile hızlandır:
   - `/urunler/tasyunu-levha`
   - `/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu`
   - `/urunler/tasyunu-levha/expert-hd150-tasyunu`
   - `/marka/dalmacyali`
   - `/marka/filli-boya`

3. Snippet/CTR düzeltmesi yap:
   - Ana sayfa title/description içinde "2026", "m2 fiyatı", "10 cm / 5 cm", "taşyünü fiyat listesi" sinyalini artır.
   - Kategori sayfası H1/meta: "Taşyünü Levha Fiyatları 2026 - 5 cm, 8 cm, 10 cm" gibi fiyat niyetine daha net cevap versin.

4. GSC karşılaştırmasını tekrar export et:
   - `2026-05-04 - 2026-05-09` vs `2026-04-28 - 2026-05-03`
   - Sorgular ve Sayfalar sekmelerinde karşılaştırmalı export alınırsa kesin kayıp listesi çıkar.

5. Sitemap ve redirect sağlık kontrolü:
   - Sitemap sadece yeni canonical URL'leri içermeli.
   - Eski URL'ler 200 dönmemeli; zincirsiz tek adım 301 dönmeli.

6. Product schema düzeltmesi:
   - Levha ürünlerinde `thickness_prices` üzerinden `AggregateOffer` üret.
   - `lowPrice` / `highPrice` değerleri görünür m² fiyat mantığıyla uyumlu olmalı.
   - Düzeltmeden sonra GSC URL Denetimi > Canlı URL'yi Test Et > Ürün snippet'leri tekrar kontrol edilmeli.

## Sonuç

4-9 Mayıs kırılımı en güçlü biçimde **URL/canonical migrasyonu + CTR düşüşü + ürün snippet schema hatası** kombinasyonu olarak görünüyor. Teknik bir "site kapandı / noindex oldu" sinyali yok; gösterimler ilk günlerde korunmuş. Fakat Google yeni URL'leri toplarken eski URL'lerdeki tıklamalar düşmüş, yeni URL'ler henüz aynı CTR ve pozisyonla devralamamış. Product schema'daki `offers` eksikliği de yeni ürün URL'lerinin zengin sonuç potansiyelini zayıflatmış olabilir.
