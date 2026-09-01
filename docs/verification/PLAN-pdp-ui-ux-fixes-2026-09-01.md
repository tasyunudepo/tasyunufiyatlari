# Levha PDP UI/UX düzeltmeleri — doğrulama sözleşmesi

> Risk: R3 — fiyat/teklif sunumu ve kritik PDF lead akışı

## Beklenen sonuç

Filli Boya grubu ve EPS levha PDP'lerinde ürün kimliği korunurken mobil kullanıcı
büyük m² fiyatını ilk ekranda görür. Geçerli tam araç hesabı değişmeden Kamyon/TIR
kapasitesi ile araç toplamı satın alma kararına uygun büyüklükte sunulur; final
teklif aksiyonu araç kararından sonra gelir. Alternatif ürünler ve ayrıntılı
lojistik açıklamaları birincil aksiyonu kesmez.

## Kabul kriterleri

| ID | Başlangıç ve eylem | Beklenen sonuç | Kanıt |
|---|---|---|---|
| AC-PDP-001 | 390×844 levha PDP açılır | Büyük ticari m² fiyatı ilk 844 px içindedir; yatay taşma yoktur | Playwright ölçümü |
| AC-PDP-002 | 1440×1000 PDP açılır | Üstte teslimat hesabına götüren aksiyon görünür; final teklif CTA'sı araç sonuçlarından sonra ve Bonus alternatifinden öncedir | Playwright ölçümü |
| AC-PDP-003 | Mobil sayfa açılır ve CTA geçilir | Sticky teklif başlangıçta yoktur; ana CTA geçilince görünür, footer'da kapanır | Playwright |
| AC-PDP-004 | Mobil kalınlık ve araç kontrolleri kullanılır | Görünür dokunma hedefleri en az 44×44 px, seçim fiyat state'ini korur | Playwright |
| AC-PDP-005 | Expert/Optimix PDP açılır | Jenerik Fawori işaretinin yanında görünür alt marka adı ve Filli Boya grup ilişkisi vardır | Playwright |
| AC-PDP-006 | EPS PDP açılır | Malzeme, kalınlık ve varsa ürün standardı karar alanında yapılandırılmış görünür | Playwright |
| AC-PDP-007 | Teklif CTA'sı açılır | Mevcut fiyat, KDV, araç, şehir ve metraj payload'ı değişmez | Mevcut unit/contract + kritik E2E |
| AC-PDP-008 | Temsilci PDP'ler taranır | Console error, kırık görsel, yatay taşma ve otomatik axe ihlali yoktur | Browser audit |
| AC-PDP-009 | Kamyon ve TIR sonucu oluşur | Özel SVG silüetleri oranlarıyla ayrışır; araçların optik yüksekliği eşittir, yönleri sağa bakar, kasa içi kapasite en az 24 px ve araç toplamı en az 32 px görünür | Playwright ölçümü |
| AC-PDP-010 | 320 px ve masaüstü araç kartları açılır | Kartlar aynı yüksekliktedir; rozet kırılmaz ve kart tıklamasının erişilebilir adı gerçek artırma/azaltma davranışını söyler | Playwright + manuel ölçüm |
| AC-PDP-011 | Teknik profil bulunan levha PDP açılır | Hızlı özet yoğunluk, yangın ve kalınlığı; ayrıntılı şerit ısı iletkenliği, çekme ve basma dayanımını gösterir; aynı teknik değer yinelenmez | Playwright |
| AC-PDP-012 | Optimix 5 cm açılır ve kalınlık değiştirilir | Levha ölçüsü, paket içi adet, paket m² ve seçili araçtaki paket/levha toplamı doğrulanmış lojistik veriden anında güncellenir | Unit + Playwright |
| AC-PDP-013 | `catalog_description` alanı boş teknik profilli ürün açılır | Kaynaklı teknik profil ve kullanım kapsamından doğal bir “ürün hakkında” açıklaması oluşur; fiziksel veri bulunmuyorsa ölçü uydurulmaz | Unit + Playwright |

## Sınırlar

- Fiyat, iskonto, marj, KDV ve araç kapasitesi formülleri değişmez.
- Teklif yalnız geçerli tam Kamyon/TIR planıyla açılır.
- Fiyatlar `KDV hariç` görünür; koşulsuz ücretsiz nakliye veya teslim süresi vaadi eklenmez.
- Kredi kartı veya banka havalesi ve tek seferde ödeme gerçeği korunur.
- Supabase şeması, migration ve API sözleşmesi değişmez.

## Doğrulama

- Hedefli: `npx playwright test tests/e2e/pdp-a2-order-desk.spec.ts`
- Fiyat/teklif regresyonu: ilgili Vitest contract ve pricing testleri
- Tam kapı: `npm run verify:full`
- Görsel/erişilebilirlik: 1440×1000 ve 390×844 temsilci ekranları, kontrast ve browser audit

## Tamamlanma kaydı — 1 Eylül 2026

AC-PDP-001–010 uygulanıp doğrulandı. 390×844 görünümünde büyük m² fiyatı 387 px'de
başladı. Araç kartları 1440 px'de 267/267 px, 390 px'de 247,8/247,8 px ve
320 px'de 251,8/251,8 px ölçüldü; yatay taşma oluşmadı. Tam Playwright paketi
tek işçiyle 79/79 geçti. Beş rota × iki viewport
browser audit'inde axe, console ve yatay taşma sayıları sıfırdı. `verify:full`,
`verify:acceptance` ve `verify:visitor-copy` kapıları da geçti.

AC-PDP-011–013 ile ürün/paket ayrıntısı ikinci fazda eklendi. Optimix 5 cm için
60×100 cm levha, 6 levha/paket, 3,60 m²/paket ve seçili 1 Kamyon için
224 paket/1.344 levha ilişkisi aynı kalınlık state'inden üretilir. 6 cm seçimi
5 levha/paket ve 3,00 m²/paket değerlerine sayfa yenilenmeden geçer.
