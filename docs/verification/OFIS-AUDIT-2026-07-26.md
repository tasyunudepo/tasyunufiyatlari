# /ofis Paneli — Kapsamlı Audit ve Düzeltme Planı

**Tarih:** 26 Temmuz 2026
**Kapsam:** `app/ofis/**` (14 dosya, 4.122 satır), `components/admin/**`, bağlı `app/api/admin/**` rotaları, `proxy.ts` yetki katmanı
**Yöntem:** kod okuması + çalışan panelde tarayıcı gezintisi (Chromium 1440/768/375), gerçek veriyle ağ ve konsol ölçümü, mevcut test paketi
**Taban çizgisi:** `vitest run` → **377/377 geçti (46 dosya)** · `tsc --noEmit` → **0 hata**

---

## 0. Yönetici özeti

Panel iskeleti sağlam: yetki katmanı gerçekten kapalı, veri gerçek, geçmiş audit'lerin temizlediği sahte göstergeler (sabit `pct:68`, hayalet bölge sınıflandırması, sahte "sistem durumu" ışıkları) geri gelmemiş. Sorun **doğruluk** değil, **operasyonel kullanılabilirlik**.

Üç cümlede durum:

1. **Sessiz başarısızlık** paneldeki en büyük güven açığı — `patron` hesabı 23 silme butonu ve 23 durum menüsü görüyor, tıklayınca API 403 dönüyor, **ekranda hiçbir şey yazmıyor**.
2. **Panel mobilde kullanılamıyor** — 240px sabit kenar çubuğu ve `marginLeft:240px` hiçbir medya sorgusuyla karşılanmıyor; 375px'te içeriğe 135px kalıyor.
3. **Panel bilgi veriyor ama karar verdirmiyor** — 34 teklifin 22'si temassız, ortalama ilk temas 1.674 saat; bu sayılar ekranda var ama hiçbiri sıralanabilir/filtrelenebilir bir iş listesine bağlı değil.

| Kategori | Adet | En ağır örnek |
|---|---|---|
| Çalışmayan / yanlış davranan | 7 | Patron 403'ü sessiz yutuluyor |
| Gereksiz / yanıltıcı | 6 | "Kaba m² Tahmini (+%10)" sütunu |
| Eksik (pratiklik) | 9 | Sayfalama, dışa aktarım, tarih filtresi yok |
| Görsel / bilgi mimarisi | 6 | Mobil kırılma, oransız çubuklar |

---

## 1. Çalışmayan veya yanlış davranan işlevler

| # | Bulgu | Kanıt | Etki | Öncelik |
|---|---|---|---|---|
| **B1** | **Patron hesabı mutasyon kontrollerini görüyor, hata sessizce yutuluyor.** `patron` ile giriş yapıldığında 23 silme butonu + 23 durum menüsü render ediliyor. Durum değiştirilince `PATCH /api/admin/quotes/127` → **403**, ekranda uyarı yok, menü eski değerine geri dönüyor. Kullanıcı ne olduğunu anlamıyor. | Tarayıcı koşusu: `patronSeesDeleteButtons: 23`, `patronMutationCalls: [{PATCH, 403}]`, `patronErrorShownOnScreen: false` | Patron "sildim" sanıp silmemiş olabilir; güven kaybı | **P0** |
| **B2** | **`QuotesTab` mutasyonları hata durumunu hiç göstermiyor.** `updateQuoteStatus`, `updateQuotePriority`, `deleteQuote` üçü de `if (res.ok && payload?.ok)` ile sarılı; `else` dalı yok. Ağ hatası, 403, 500 — hepsi sessiz. | [QuotesTab.tsx:90-138](app/ofis/tabs/QuotesTab.tsx#L90-L138) | Her başarısız işlem kayıp; B1'in kök nedeni | **P0** |
| **B3** | **Panelde rol ayrımı yok.** `/api/admin/me` yalnızca kullanıcı **adını** döndürüyor, rol/yetki döndürmüyor. Arayüz admin ile patronu ayırt edemiyor. | [me/route.ts](app/api/admin/me/route.ts), `AdminTopbar` yalnız `d.user` okuyor | B1'i yapısal olarak çözmenin önkoşulu | **P0** |
| **B4** | **Satış Deneyleri "öncesi/sonrası" penceresi her deney için Bonus sayıyor.** Marka filtresi sabit kodlu: `brand_name.includes("bonus")`. EPS veya Optimix üzerine kurulmuş bir deney de Bonus rakamlarını gösterir. | [ExperimentsTab.tsx:107](app/ofis/tabs/ExperimentsTab.tsx#L107) | Deney sonuçları yanlış okunur → yanlış ticari karar | **P1** |
| **B5** | **Deney silinemiyor.** `/api/admin/experiments/[id]` yalnızca `PATCH` ihraç ediyor; `DELETE` yok, arayüzde de buton yok. Yanlış girilen deney kalıcı. | `grep "export async function"` → yalnız `PATCH` | Defter kirlenir | **P2** |
| **B6** | **Recharts gizli kapsayıcıda ölçüm uyarısı veriyor.** Sekme geçişlerinde 4 adet `width(-1) and height(-1)` uyarısı; grafikler `display:none` kapsayıcıda ölçülüyor. | Konsol yakalama, 4 uyarı | Grafik ilk render'da boş çizilebilir | **P2** |
| **B7** | **Analiz'de boş marka "-" olarak ilk sırada listeleniyor.** "Toz Grubu Markaları" #1 = `-` (8 teklif). Markasız kayıtlar gerçek marka gibi sıralanıyor. | Ekran görüntüsü `analytics.png` | Sıralama yanıltıcı | **P2** |

> **Yanlış alarm olarak elenenler** (kod okumasıyla şüphelendim, doğrulayınca temiz çıktı): `/api/admin/logout` rotası eksik değil — `proxy.ts` içinde ele alınıyor ve 401 dönüyor. `closed_at` arayüzden yazılmıyor ama `migration-v22` içindeki `trg_quotes_set_closed_at` trigger'ı damgalıyor. Kimliksiz erişim gerçekten kapalı: `/ofis` → 401, `/api/admin/quotes` → 401.

---

## 2. Gereksiz veya yanıltıcı olanlar

| # | Öğe | Neden gereksiz | Öneri |
|---|---|---|---|
| **G1** | `ProductsTab` — **"Kaba m² Tahmini (+%10)"** sütunu | Gerçek satış fiyatı Marj Kuralları + marka marjı + KDV ile hesaplanıyor. Bu sütun sabit %10 ekleyen, hiçbir yerde kullanılmayan bir sayı. Başlıktaki "gösterge" notu sorunu çözmüyor; ekranın en dikkat çekici (yeşil, kalın) sütunu. | **Kaldır.** Yerine gerçek marj kuralını uygulayan tek bir "Güncel satış fiyatı" sütunu koy veya sütunu tamamen çıkar. |
| **G2** | `QuotesTab` — **KPI ilerleme çubukları** | "Toplam Talep" çubuğu `Math.min(100, total * 4)` ile doluyor. 25 teklifte %100 olur ve orada kalır. Ölçtüğü bir şey yok. | **Kaldır.** Sayı zaten orada; çubuk yalnızca gürültü. |
| **G3** | `QuotesTab` — **"Talep Türleri" çubukları** | Genişlik `Math.max(4, Math.min(100, value * 8))`. PDF 33 → %100, WhatsApp 1 → %8. Ortak bir ölçek yok, çubuklar birbiriyle kıyaslanamaz. | Ortak maksimuma normalize et veya çubuğu kaldırıp sayı + yüzde göster. |
| **G4** | `DashboardTab` — **çift "TALEP AKIŞI" başlığı** | Aynı etiket iki farklı kartta (24 saatlik grafik ve son kayıtlar listesi). | Alttakini **"Son Talepler"** yap. |
| **G5** | `ProductsTab` — **`StatCard.onClick` ölü prop** | Dört çağrının hiçbiri `onClick` geçmiyor; `cursor-pointer`/hover mantığı hiç çalışmıyor. | Prop'u kaldır ya da kartları ilgili filtreye bağla. |
| **G6** | `ProductsTab` — **emoji ikonlar** (`🧱 📏 🧰 🗂️`) | Panelin geri kalanı Lucide SVG kullanıyor; emoji platforma göre değişiyor ve tasarım dilini bozuyor. | Lucide karşılıklarıyla değiştir. |

---

## 3. Eksik olanlar — pratiklik (ui-ux-pro-max)

Referans: `Data-Dense Dashboard` deseni (yoğunluk 8/10). Panel bu desenin **veri yoğunluğu** kısmını tutturmuş, **filtreleme ve eylem** kısmını tutturamamış. Veritabanındaki anti-desen zaten şu: *"Ornate design + No filtering"*.

| # | Eksik | Neden gerekli | Öncelik |
|---|---|---|---|
| **E1** | **Mobil/tablet düzeni** — kenar çubuğu 240px sabit, `@media` kuralı yok | 375px'te içeriğe 135px kalıyor, panel kullanılamıyor. Saha/telefon kullanımı imkânsız. | **P0** |
| **E2** | **Sayfalama veya sanallaştırma** | Teklifler sekmesi 34 kayıtta **4.410px**, Katalog **19.222px**. Her kayıt DOM'da. 300 teklifte panel donar. | **P0** |
| **E3** | **Tarih aralığı filtresi** | Teklifler yalnız duruma, türe ve metne göre filtreleniyor. "Bu ay ne oldu?" sorusunun cevabı yok. | **P1** |
| **E4** | **Dışa aktarım (CSV/Excel)** | Panelde hiçbir dışa aktarım yok — yalnız tek tek PDF indirme. Muhasebe/rapor akışı elle. | **P1** |
| **E5** | **Toplu işlem** | 22 temassız teklif var; hepsini tek tek açıp işaretlemek gerekiyor. | **P1** |
| **E6** | **"Bugün yapılacaklar" iş listesi** | Veri zaten hesaplanıyor (`uncontactedOpen`, `dueFollowUps`) ama Genel Bakış'ta değil, Teklifler'in ortasında gömülü. Panel açılışında ilk görülen şey dört sıfır. | **P1** |
| **E7** | **İskonto ve lojistik düzenleme** | `DiscountsTab` ve `LogisticsTab` salt-okunur. Şehir iskontosu değiştirmek için veritabanına girmek gerekiyor. | **P2** |
| **E8** | **Otomatik yenileme / son güncelleme damgası** | Yalnız elle "Yenile". Ekranın ne kadar bayat olduğu belli değil. | **P2** |
| **E9** | **Klavye erişimi ve odak yönetimi** | Teklif detay modalı odak tuzağı kurmuyor, `Esc` ile kapanmıyor; `KpiTile` `role="button"` alıyor ama `tabIndex`/`onKeyDown` yok → klavyeyle tıklanamıyor. | **P1** |

---

## 4. Performans ve veri katmanı

| Ölçüm | Değer | Yorum |
|---|---|---|
| 4 sekme gezintisinde `/api/admin/quotes` çağrısı | **7 kez** | `DashboardTab`, `QuotesTab`, `ExperimentsTab` üçü de aynı tam tabloyu bağımsız çekiyor |
| Tek yanıt boyutu | **114.552 bayt** (34 kayıt × 62 alan) | Kayıt başına ~3,4 KB; 500 teklifte ~1,7 MB / istek |
| Yanıttaki PII | `customer_name`, `customer_email`, `customer_phone`, `customer_company`, `customer_address` | Grafik çizmek için tam PII çekiliyor |
| `@tanstack/react-query` | Kurulu ve **projede kullanılıyor** (`lib/hooks/*`), ama `/ofis` içinde **hiç kullanılmıyor** | Her sekme ham `useEffect + fetch` |
| İlk yükleme | 2.029 ms | Kabul edilebilir, ama veri büyüdükçe doğrusal artacak |

**Sonuç:** `/ofis` panelinin tamamı, projenin zaten sahip olduğu önbellek altyapısını atlıyor. Tek bir `useQuery` anahtarı bu 7 çağrıyı 1'e indirir.

---

## 5. Güvenlik notları

Yetki katmanı **çalışıyor** — bunu kanıtladım, spekülasyon değil:

- `/ofis` kimliksiz → **401**, `/api/admin/quotes` kimliksiz → **401**
- `proxy.ts` hem sayfayı hem `/api/admin/*` ağacını kapsıyor, `x-auth-user` başlığını enjekte ediyor
- Mutasyon rotaları ayrıca `requireAdminMutationAuth` ile ikinci kapıdan geçiyor; patron mutasyonu 403 alıyor

İki **sertleştirme** (açık değil, savunma derinliği):

| # | Konu | Not |
|---|---|---|
| **S1** | `GET /api/admin/quotes` handler seviyesinde yetki kontrolü yok | Tam müşteri PII'si yalnızca proxy ile korunuyor. `experiments` GET ve `quotes/[id]/pdf` GET zaten `requireOfficeReadAuth` kullanıyor — tutarlılık için aynısı buraya da eklenmeli. Matcher'da ileride yapılacak bir düzenleme bu ucu sessizce açar. |
| **S2** | `proxy.ts` kimlik karşılaştırması `===` ile yapılıyor | `lib/security/adminMutationAuth.ts` `timingSafeEqual` kullanıyor; proxy düz karşılaştırma yapıyor. Ayrıca bozuk base64'te `atob()` istisna fırlatır → 401 yerine 500. |

---

## 6. Görsel tasarım ve bilgi mimarisi

Panelin görsel dili (koyu zemin + altın vurgu, `nx-*` token sistemi) tutarlı ve iyi. Sorun estetik değil, **hiyerarşi**.

| # | Bulgu | Düzeltme |
|---|---|---|
| **V1** | **Mobil kırılma** (E1 ile aynı kök) | `@media (max-width: 1024px)` altında kenar çubuğunu çekmece yap, `marginLeft`'i sınıfa taşı |
| **V2** | **Genel Bakış açılışta dört sıfır gösteriyor** — bugün teklif yoksa panel boş hissettiriyor, oysa 34 teklif, 22 temassız, 7 kayıp var | Üst şeridi "bugün" yerine **eyleme dönük** hale getir: `Temassız 22` · `Bugün takip 0` · `Açık teklif 27` · `Bu ay 24` |
| **V3** | **Ortalama ilk temas "1674 saat"** ham gösteriliyor | Gün/hafta olarak biçimlendir ve eşik rengi ver (>48s kırmızı). 70 gün bir metrik değil, alarm. |
| **V4** | **Dönüşüm göstergesi %0'da boş halka** | 0 onay + 7 kayıp + 26 fiyat verildi durumunda huni daha bilgilendirici; göstergeyi huniyle değiştir |
| **V5** | **Teklif satırları çok yüksek** — satır başına 2 açılır menü + PDF + Detay + Sil, 34 kayıt = 4.410px | Yoğun tablo düzenine geç; ikincil eylemleri satır içi menüye al |
| **V6** | **Analiz sekmesinde dengesiz sütunlar** — EPS listesi 5 satır, Taşyünü 9 satır, altta büyük boşluk | Eşit yükseklik veya tek birleşik tablo + malzeme filtresi |

---

## 7. Düzeltme planı

Fazlar bağımsız teslim edilebilir; her fazın kendi bitiş kanıtı var. **Kod değişikliği bu raporla birlikte yapılmadı** — plan onay bekliyor.

### Faz 1 — Sessiz başarısızlıkları kapat (P0, ~yarım gün)

| Adım | Dosya | İş |
|---|---|---|
| 1.1 | `app/api/admin/me/route.ts` | Yanıta `role: 'admin' \| 'patron'` ekle (kullanıcı adından türet) |
| 1.2 | yeni `lib/admin/useAdminRole.ts` | Rolü tek yerden okuyan hook |
| 1.3 | `QuotesTab`, `SalesOutcomePanel`, `BrandsTab`, `MarginRulesTab`, `ProductsTab`, `ExperimentsTab` | Patron rolünde mutasyon kontrollerini gizle/devre dışı bırak + "salt okunur hesap" rozeti |
| 1.4 | `QuotesTab` | Üç mutasyonun `else` dalına görünür hata bildirimi ekle (403 → "Bu hesabın değiştirme yetkisi yok") |
| 1.5 | — | Tekrar üretim testi: patron durum değiştirmeyi dener → ekranda hata görünür |

**Bitiş kanıtı:** `tests/e2e/ofis-patron-readonly.spec.ts` — patron girişinde silme butonu görünmez; admin girişinde görünür ve çalışır.

### Faz 2 — Mobil ve ölçek (P0, ~1 gün)

| Adım | İş |
|---|---|
| 2.1 | `app/globals.css` + `AdminShell`: `<1024px` çekmece kenar çubuğu, hamburger, `marginLeft` sınıfa taşınır |
| 2.2 | `QuotesTab`: sunucu taraflı sayfalama (`?limit=&offset=`) + "daha fazla yükle" |
| 2.3 | `ProductsTab`: marka grubu başına katlanır bölüm (varsayılan kapalı) |
| 2.4 | `/api/admin/quotes`: `?fields=summary` modu — grafikler için PII'siz hafif yanıt |

**Bitiş kanıtı:** `tests/e2e/ofis-responsive.spec.ts` — 375/768/1440'ta yatay kaydırma yok, gezinme erişilebilir; Teklifler sekmesi yüksekliği < 3.000px.

### Faz 3 — Önbellek ve tekrarlı çekim (P1, ~yarım gün)

| Adım | İş |
|---|---|
| 3.1 | `lib/hooks/useAdminQuotes.ts` — `useQuery`, `staleTime: 60_000` |
| 3.2 | `DashboardTab`, `QuotesTab`, `ExperimentsTab` aynı anahtarı paylaşır |
| 3.3 | Mutasyon sonrası `invalidateQueries` (tam yeniden çekim yerine) |

**Bitiş kanıtı:** aynı tarayıcı koşusu tekrar — `/api/admin/quotes` çağrısı **7 → ≤2**.

### Faz 4 — Karar verdiren panel (P1, ~1 gün)

| Adım | İş |
|---|---|
| 4.1 | Genel Bakış üst şeridini eyleme dönük metriklere çevir (V2) |
| 4.2 | "Bugün yapılacaklar" kartı: temassız + vadesi gelen takipler, tıklayınca ilgili teklife gider |
| 4.3 | Teklifler'e tarih aralığı filtresi + CSV dışa aktarım |
| 4.4 | Süre biçimlendirme yardımcısı + eşik renkleri (V3) |
| 4.5 | Deney öncesi/sonrası penceresini deneyin kendi markasına bağla (B4) — `experiments` tablosuna `brand_filter` kolonu |

**Bitiş kanıtı:** `tests/pricing/` altına saat biçimlendirme birim testi; `tests/e2e/ofis-worklist.spec.ts` — temassız teklif kartına tıklayınca ilgili teklif açılır.

### Faz 5 — Temizlik ve sertleştirme (P2, ~yarım gün)

| Adım | İş |
|---|---|
| 5.1 | G1–G6 kaldırma/düzeltme |
| 5.2 | `GET /api/admin/quotes` → `requireOfficeReadAuth` (S1) |
| 5.3 | `proxy.ts` → sabit süreli karşılaştırma + `atob` hata yakalama (S2) |
| 5.4 | Modal odak tuzağı + `Esc`, `KpiTile` klavye erişimi (E9) |
| 5.5 | Recharts kapsayıcı ölçüm uyarısı (B6), boş marka gizleme (B7) |

**Bitiş kanıtı:** `tests/security/admin-routes-auth.test.ts` genişletilir; konsol uyarısı sayısı 0.

---

## 8. Doğrulama matrisi

| Kabul kriteri | Kanıt komutu | Şu anki durum |
|---|---|---|
| AC-01 Patron mutasyon kontrolü görmez | `playwright test ofis-patron-readonly` | ✗ (23 buton görüyor) |
| AC-02 Başarısız mutasyon ekranda görünür | aynı spec | ✗ (sessiz) |
| AC-03 375px'te panel kullanılabilir | `playwright test ofis-responsive` | ✗ (içerik 135px) |
| AC-04 Teklifler sekmesi < 3.000px | aynı spec | ✗ (4.410px) |
| AC-05 `/api/admin/quotes` ≤ 2 çağrı | ağ sayımı betiği | ✗ (7 çağrı) |
| AC-06 Kimliksiz erişim 401 | `verify:release` | ✓ **geçiyor** |
| AC-07 Mevcut 377 test bozulmaz | `npm run verify:fast` | ✓ **geçiyor** |
| AC-08 Konsol hata/uyarı yok | tarayıcı koşusu | ✗ (4 Recharts uyarısı) |

---

## 9. Kalan belirsizlikler

- **Katalog sekmesi (19.222px)** tam olarak incelenmedi; ekran görüntüsü alındı ama satır satır doğrulanmadı. Faz 2.3 öncesi ayrıca bakılmalı.
- **Excel içe aktarma akışı** uçtan uca denenmedi (gerçek fiyat listesi yüklemek üretim verisini değiştirir). Kod okumasıyla tutarlı görünüyor; ayrı bir staging koşusu gerekir.
- **Süre tahminleri** kaba; her faz kendi içinde bölünebilir.
- Ölçümler **yerel dev sunucusunda, 34 teklifle** yapıldı. Üretimde kayıt sayısı farklıysa E2/performans bulguları daha da ağırlaşır.
