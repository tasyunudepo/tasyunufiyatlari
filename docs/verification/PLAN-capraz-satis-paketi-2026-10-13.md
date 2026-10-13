# Çapraz satış ve güven belgesi paketi — doğrulama planı

Tarih: 13 Ekim 2026 · Karar kaynağı: `reports/capraz-satis-seo-geo-2026-10-09/yuvarlak-masa.md` (Emrah, Fable, Astra, Opus) · Dal: `feat/capraz-satis-paketi`

## Sonuç (bittiğinde doğru olacak)

1. Teklif PDF'i havale anında müşteriye tek bir satıcı kimliği gösterir.
2. Alçı ve alçıpan, fiyatı gören ve teklifini alan müşteriye görünür biçimde sunulur; üç SW035 sayfasında Google'ın gördüğü ilk HTML'de düz bağlantı olarak durur.
3. "Kiralık Jeneratör" footer bağlantısı site içi ayrı sayfayı açar; jeneratör ürün ve teklif ekranlarında yoktur.
4. Ofisten, bir teklif için tek sayfalık Sipariş Onay Formu üretilir.
5. Gazbeton, alçı ve GCR tarafındaki karşılıklar kendi depolarında hazırdır.

## Risk sınıfı ve seçilen kanıt

| Adım | Yüzey | Risk | Kanıt |
|---|---|---|---|
| 1 | Teklif PDF'i (müşteri belgesi), footer, yeni sayfa | R2 | Saf HTML kurucular için birim testi; mevcut `pdf-screen-consistency` sözleşmesi değişmeden; üretilen PDF'in gözle incelenmesi; yerel prod build'de sayfa HTML'i |
| 2 | Ürün sayfası, teklif sonrası, ana sayfa, hakkımızda; GA4 olayları | R2 | Birim testi (bağlantı ve UTM kuralı), sunucu HTML sözleşmesi, Playwright (blok var/yok, ana eylem konumu, olaylar), ölçüm bekçisi, ekran görüntüleri |
| 3 | Sipariş Onay Formu (para içeren belge), ofis | R3 | Saf kurucu ve "1. araç" hesabı için birim testi; yasak vaat taraması; ofiste üretim denemesi |
| 4 | Diğer depolar | R2 | Her deponun kendi testleri |

## Kabul kriterleri

### Adım 1 — PDF kimliği ve jeneratör sayfası

- **AC-101** PDF'in banka bölümünde "Hesap sahibi" satırı `BUSINESS_INFO.legalName` değerini gösterir.
- **AC-102** PDF'in üst ve alt bilgisinde web satırı iki etiketli adres taşır: "Teklif: www.tasyunufiyatlari.com" ve "Kurumsal: www.ozeryapiinsaat.com".
- **AC-103** Vergi dairesi, vergi numarası ve MERSİS alanları `BUSINESS_INFO` içinde tanımlıdır; boşken PDF'te satır çizilmez, doluyken çizilir.
- **AC-104** `tests/contracts/pdf-screen-consistency.test.ts` değiştirilmeden geçer.
- **AC-105** Footer'da "Kiralık Jeneratör" bağlantısı `/kiralik-jenerator` sayfasına gider.
- **AC-106** `/kiralik-jenerator` statik ve indekslenebilirdir, sitemap'tedir; `https://www.xn--kiralkjeneratr-7pb94g.com/` (çıpa "kiralık jeneratör") ve `/kullanim-alanlari/santiye` (çıpa "şantiye için jeneratör kiralama") adreslerine `nofollow` taşımayan düz bağlantı verir.
- **AC-107** Sayfa jeneratör kiralamayı ÖzerGrup hizmeti gibi sunmaz; "grup siteleri" ve "web projeleri" ifadeleri geçmez.

### Adım 2 — Alçı ve alçıpan

- **AC-201** `dalmacyali-sw035-tasyunu` ürününün 5, 8 ve 10 cm sayfalarında sunucu HTML'i "Alçı ve alçıpan da lazım mı?" bloğunu ve iki düz bağlantıyı (UTM'siz, `nofollow`'suz) içerir: `https://alcifiyatlari.com/urun-kategori/makina-alcisi/`, `https://alcipanfiyatlari.net/urunler/alcipan-fiyatlari/`.
- **AC-202** Listede olmayan ürün sayfasında blok yoktur; liste tek dosyadadır (`lib/portfolio/offers.ts`).
- **AC-203** Kartlar fiyat satırı, koşul (KDV, nakliye) ve liste tarihi taşır.
- **AC-204** Blok fiyat panelinden sonra gelir; 390 px genişlikte ana eylemin sayfadaki konumu blok eklenmeden önceki haliyle aynıdır.
- **AC-205** Hesap sonucu altında ve teklif teslim kartında blok görünür; bu iki yüzeyde ve PDF'te bağlantılar UTM taşır (`utm_source=tasyunufiyatlari.com`, `utm_medium=referral`, `utm_campaign=portfoy`, `utm_content=<yerleşim>`).
- **AC-206** PDF'te alçı ve alçıpan bölümü vardır; bağlantı alanları tıklanabilir.
- **AC-207** Ana sayfada ve `/hakkimizda#kanallar` bölümünde alçı, alçıpan ve gazbeton düz bağlantıdır; jeneratör yoktur.
- **AC-208** `portfolio_offer_view` blok en az %35 göründüğünde yerleşim başına bir kez, `portfolio_offer_click` her tıklamada (offer, placement, target_host ile) gider; tıklama gezinmeyi engellemez; kişisel veri taşımaz.
- **AC-209** `public-contact-gate`, `customer-promises` ve `kdv-labels` sözleşmeleri geçer.
- **AC-210** Ölçüm bekçisi yerel prod build'de geçer.

### Adım 3 — Sipariş Onay Formu

- **AC-301** Ofiste bir teklif için tek sayfalık Sipariş Onay Formu PDF'i üretilir.
- **AC-302** Belge şunları taşır: teklif numarası, ürün, metraj, tutar; satıcı unvanı; hesap sahibi ve IBAN; (doluysa) vergi ve MERSİS; üretici yetkili bayi teyidi; "ödemeniz ulaştığında siparişiniz üreticiye girilir, üreticinin sipariş teyidi size iletilir" satırı (gün taahhüdü editör turunda çıkarıldı); sevkiyat aşamaları.
- **AC-303** Birden çok araca tam oturan teklifte "1. araç" metrajı ve tutarı plan toplamıyla birlikte gösterilir ve formun yalnız 1. aracı onayladığı açıkça yazar; tek araçlıda ve araca tam oturmayan metrajda gösterilmez.
- **AC-304** Teslim ili İstanbul ise görüşme noktası satırı vardır; başka ilde yoktur.
- **AC-305** Belgede kesin teslim süresi, iade ya da garanti, kapora ya da taksit vaadi yoktur.
- **AC-306** Belgede marj, maliyet, iskonto oranı gibi iç alanlar yoktur.

### Adım 4 — Diğer depolar

- **AC-401** Gazbeton hesaplama sonucunda taşyününe giden düz bağlantı.
- **AC-402** Alçı sitesinin teklif çıktısında taşyünü satırı; Emrah'ın elle gönderdiği teslim mesajı için hazır cümle.
- **AC-403** GCR: `Whatsapp_Siparis` eşlemede; WhatsApp ve form kanalı ayrı; `portfolio_offer_*` olayları temas sayılmaz.

## Sınırlar

- Fiyat, marj, ödeme kuralı, lead kapısı ve tam araç kuralı değişmez.
- `lib/pdfGenerator.ts` içinde "Toplam Metraj … Tablo" kutusuna ve kalem satırı mantığına dokunulmaz (sözleşme testi).
- Kilitli kabul dosyaları (`.goal-verify/acceptance-lock.json`) değiştirilmez.
- Vergi numarası, MERSİS ve referans alanları boş doğar; hiçbir adım bunları beklemez.
- Canlıya çıkış ve push Emrah'ın sözüyle; diğer depolarda süren işin üstüne yazılmaz.

## Komutlar

| Katman | Komut |
|---|---|
| Hızlı | `npm run verify:fast` |
| Tam | `npm run verify:full` |
| Metin | `npm run verify:visitor-copy`, `node ~/.claude/tools/copy-gate.mjs .next` |
| Kilit | `npm run verify:acceptance` |
| Tarayıcı | `npx playwright test <ilgili dosya>`; `node ~/.claude/tools/screens.mjs <yol>` |
| Ölçüm | `node ~/.claude/skills/olcum-bekcisi/scripts/olcum-denetim.mjs <yerel-prod-url> --yol / --yol <ürün sayfası>` |

## Durma koşulu

Geçerli yol kalmazsa (kilitli test gerçek bir davranış değişikliğiyle çelişirse, başka depoda süren iş aynı dosyadaysa) değişiklik yapılmaz; engel ve kanıtı `PROGRESS.md`'ye yazılır.
