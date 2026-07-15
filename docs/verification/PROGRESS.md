# Doğrulama ilerleme kaydı — Bonus / yoğunluk karşılaştırması

## 2026-07-13 — Bonus ticari aktivasyon paketi, Adım 0-4 (Claude Fable 5)

**Kapsam:** A-002 kapanışının kod tarafı — karar günlüğü Tur 4 kararlarının uygulanması. Canlı aktivasyon (Adım 5'in release kısmı) bilinçli olarak ayrı pencereye bırakıldı.

### Yapılanlar

1. **Adım 0 — Doğrulanmış fiyat verisi:** `lib/pricing/bonus/bonus-region-prices.json` — F 150 (13 kalınlık), F 120 (12), F 150 Pro (8) satırlarının 7'şer bölge fiyatı + paket/kamyon/TIR kapasiteleri, PDF sayfa görüntülerinden (s.57-61) satır satır okunarak yazıldı. Bölge→il haritası s.83'ten gözle doğrulandı. `bonus_products.json` otomatik çıkarımı kolon kayması nedeniyle reddedildi. Üretici tablosundaki iki tutarsızlık not düşüldü (F 120 70 mm paket adedi; fiyat listesi kalınlıkları ile föy aralıklarının farkı).
2. **Adım 1 — Migration v19 + v19b:** `plate_region_prices` (FORCE RLS, anon erişemez — taban fiyattan marj geri hesaplanmasın), `shipping_zones.bonus_region` (79 il eşlendi; 34/41 bilinçli NULL), `brands.margin_pct` (yalnız Bonus=5). v19b seed dosyası elle yazılmaz: `scripts/generate-bonus-region-price-seed.mjs` JSON'dan üretir (231 hücre).
3. **Adım 2 — Fiyat modülü:** `lib/pricing/bonus/regionPricing.ts` — bölge çözümü (İstanbul yaka: Avrupa 3 / Anadolu 2; Kocaeli: Gebze 2 / diğer 1; çözülemezse null, fail-closed) + taban fiyat (liste × 0,90, tamsayı-kuruş aritmetiğiyle PostgreSQL ile birebir). `lib/pricing/margin.ts` → `resolveBrandMarginPctStrict`: marka marjı doluysa malzeme kuralını ezer.
4. **Adım 3 — Wizard:** `WizardStep3` şehir seçiminde yalnız İstanbul/Kocaeli'de alt-bölge sorusu gösterir; şehir değişince seçim sıfırlanır. Soru şimdilik opsiyoneldir — Bonus pasifken müşteriyi bloklamaz; Bonus fiyat motoru bölge çözülmeden zaten fiyat üretmez (aktivasyonda zorunluluk işaretlenecek).
5. **Adım 4 — Admin:** Ayarlar'daki ölü "Kar Marjı/KDV" alanları kaldırıldı (yalnız localStorage'a yazıyordu, hiçbir hesap okumuyordu); yerine gerçek kuralların haritası kondu. Yeni **Markalar** sekmesi: marka bazlı marj yönetimi (`/api/admin/brands` GET + `[id]` PATCH, `requireAdminMutationAuth` korumalı, zod doğrulamalı).

### Kanıt

| Kontrol | Komut | Sonuç |
|---|---|---|
| Unit + kontrat + golden | `npm run test:run` | 32 dosya / **252 test geçti** (31'i yeni Bonus golden'ları) |
| Tip + hedefli lint | `typecheck` + `eslint` (11 dosya) | 0 hata (mevcut `<img>` uyarıları kapsam dışı) |
| DB sözleşmesi | `bash scripts/verify-bonus-pricing-db.sh` | 231 hücre, golden fiyatlar, taban=liste×0,90 hücre bazında, marka marjı, şehir eşlemesi, anon RLS engeli, idempotency (2× uygulama), v18 regresyonu |
| E2E | 3 spec | **11/11**: alt-bölge soruları (3), wizard-katalog ayrımı (3), P0 kritik akış regresyonu (5) |
| Metin kapısı + kabul kilidi | `verify:visitor-copy` + `verify:acceptance` | Geçti (8 korunan dosya değişmedi) |
| Görsel | `.screens/step3-istanbul-yaka.png`, `step3-kocaeli-gebze.png` | Gözle doğrulandı |

Yakalanan gerçek hata: kuruş yuvarlamada JS float sapması (224,75 × 0,90 → 202,27 vs PostgreSQL 202,28) DB sözleşme testinde 3 hücrede yakalandı; üretici ve TS modülü tamsayı-kuruş aritmetiğine çevrildi, yarım-kuruş golden testi eklendi.

### Canlı aktivasyon için kalanlar (kontrollü release penceresi)

1. v18 → v19 → v19b migration'larının canlı Supabase'e sırayla uygulanması (her birinin kendi RAISE EXCEPTION kapısı var; eşleşmezse transaction geri döner).
2. Bonus levhalarının aktifleştirilmesi (`is_active=true`) — ancak fiyat motoru wizard'a bağlandıktan sonra.
3. Wizard fiyat hesabına Bonus dalının bağlanması (bölge fiyatı × marka marjı; TEKNO kombinasyon kuralı `separate_quote_required` — kilitli karar 13) — bu dal henüz YAZILMADI; Bonus aktivasyonunun ön şartıdır.
4. İstanbul/Kocaeli alt-bölge seçiminin Bonus seçiliyken zorunlu kılınması.
5. Satış teyidi: bölge haritası sayfasındaki "OCAK 2026" başlığı.



## 2026-07-13 — Faz 2: wizard ve katalog ayrımı (Claude Fable 5)

**Kapsam:** PRD P2 fazı — `DIS_CEPHE_MODELLER` sabitinin teknik profil verisine bağlanması, wizard prefill kapısı, Playwright koruması (FR-002, FR-007, AC-002).

### Yapılanlar

1. **Uygunluk modülü:** `lib/wizard/eligibility.ts` — taşyünü uygunluğu `lib/technical-profiles` üzerinden (`wizard_eligible`), EPS mantolama modelleri ayrı açık listede (teknik profil havuzu EPS'yi kapsamıyor; ayrı iş kalemi). Malzeme çapraz geçişi engellenir (SW035 EPS'de görünmez, İdeal Carbon taşyününde görünmez).
2. **Prefill kapısı:** `lib/catalog/prefill.ts` — `buildWizardPrefill()` mantolama-uygun olmayan levhaya (çatı/ara bölme/giydirme/endüstriyel; RF150, PW50, VF80) `null` döner. `lib/catalog/server.ts` `buildPlateView` artık prefill'i inline kurmuyor, modüle bırakıyor.
3. **Bileşen kablolaması:** `WizardStep1.tsx` ve `Step1ProductSelection.tsx` sabit listeyi bıraktı, `filterMantolamaWizardModels(selectedMalzeme, availableModels)` kullanıyor.
4. **Kırmızı-önce kanıt:** kablolama taramaları (3 test) mevcut koda karşı kırmızı çalıştırıldı, bağlama sonrası yeşile döndü.

### Kanıt

| Kontrol | Komut | Sonuç |
|---|---|---|
| Unit + kontrat | `npm run test:run` | 31 dosya / **221 test geçti** (23'ü yeni) |
| Tip kontrolü | `npm run typecheck` | Hatasız |
| Hedefli lint (7 dosya) | `npx eslint …` | 0 hata (5 mevcut `<img>` uyarısı, kapsam dışı) |
| Ayrım E2E | `npx playwright test tests/e2e/wizard-catalog-separation.spec.ts` | 3/3: üç taşyünü markasında yasaklı model yok, EPS/taşyünü sızıntısı yok, akış kalınlık adımına ilerliyor |
| Kritik akış regresyonu | `npx playwright test tests/e2e/quote-flows/critical-quote-flows.spec.ts` | **5/5 geçti** (P0 korunan spec, değiştirilmedi) |
| Görsel | `screens.mjs http://localhost:3005/` | Konsol temiz; wizard davranışı korunmuş (Dalmaçyalı→SW035) |

### Notlar / bilinçli sınırlar

- **CTA hedefi kararı Faz 3'e:** prefill'i olmayan levhanın ürün sayfası CTA'sı (`WizardLinkButton`) hâlâ `/` sayfasına gidiyor (aksesuar davranışıyla aynı). Prefill kapısı sayesinde uygun olmayan ürün wizard'da SEÇİLEMEZ (model listesine düşmez, otomatik seçim oluşmaz) — yani yanlış teklif üretilemez; fakat "wizard yerine iletişime yönlendir" UX kararı ürün kararı olarak Faz 3'te ele alınmalı (AC-007 tam kapanışı orada).
- `Step1ProductSelection.tsx` hiçbir yerden import edilmiyor (ölü kod); yine de yasaklı deseni taşımasın diye modüle bağlandı. Kaldırma kararı P3 mimari sadeleştirme işine bırakıldı.
- Wizard modeli listesi canlı `plates` tablosundan gelir; Bonus modelleri profilde `wizard_eligible=true` olsa da canlıda `is_active=false` + fiyatsız oldukları için listeye düşmez (A-002 kapısı).



## 2026-07-13 — Faz 1: veri ve hatalı metin güvenliği (Claude Fable 5)

**Kapsam:** PRD P1 fazı — teknik profil şeması, sekiz ürün seed'i, kaynak alanları, yanlış wizard yoğunluk etiketlerinin kaldırılması.

### Yapılanlar

1. **Kırmızı test önce:** `tests/contracts/wizard-density-claims.test.ts` yazıldı; mevcut `WizardStep1.tsx` içindeki sabit `120 kg/m³` metinlerine karşı kırmızı olduğu çalıştırılarak kanıtlandı (2/2 fail), wizard düzeltmesinden sonra yeşile döndü.
2. **Teknik profil modülü:** `lib/technical-profiles/index.ts` — sekiz ürün, yoğunluk değer/aralık + kaynak türü (`datasheet` / `manufacturer_verbal`) + kaynak tarihi + müşteri etiketi ("Föy beyanı" / "Üretici sözlü beyanı — değişken"). İç kaynak notu bu modülde bilinçli olarak YOK; yalnız DB private tablosunda.
3. **Migration:** `scripts/migration-v18-plate-technical-profiles.sql` — `plate_technical_profiles` (public SELECT policy) + `plate_technical_profile_private_notes` (FORCE RLS, policy yok → yalnız service_role) + Bonus marka/3 pasif levha (`is_active=false`, `plate_prices` yazılmaz) + 8 profil UPSERT + sessiz eksik kayıt yasağı (8 değilse RAISE EXCEPTION). Rollback: `migration-v18b-rollback-plate-technical-profiles.sql` (yalnız pasif ve fiyatsız Bonus verisini siler).
4. **Wizard düzeltmesi:** `components/wizard/WizardStep1.tsx` `MODEL_META` sabit yoğunluk metinleri kaldırıldı (SW035/Premium/TR7.5 için föy beyanı olmayan "120 kg/m³" iddiası dahil). Yoğunluk, teknik profil verisi kaynak etiketiyle bağlanana kadar wizard'da gösterilmez.

### Kanıt

| Kontrol | Komut | Sonuç |
|---|---|---|
| Unit + kontrat | `npm run test:run` | 30 dosya / 198 test geçti (yeni 32 test dahil) |
| Tip kontrolü | `npm run typecheck` | Hatasız |
| Hedefli lint | `npx eslint <değişen 4 dosya>` | 0 hata (2 mevcut `<img>` uyarısı, kapsam dışı) |
| Ziyaretçi metni | `npm run verify:visitor-copy` | Geçti |
| DB sözleşmesi | `bash scripts/verify-technical-profiles-db.sh` | Geçti: v18 idempotent (2× uygulama), RLS anon iç notu okuyamıyor, v18b temiz geri dönüş, yeniden kurulabilirlik |
| Görsel doğrulama | `node ~/.claude/tools/screens.mjs http://localhost:3005/` | 4 viewport çekildi, konsol temiz; wizard model chip'i yoğunluk metni olmadan doğru render ediyor (`.screens/localhost_3005__1280px.png`) |

Tam repo lint bilinçli koşulmadı: 89 hata / 15 uyarı P2 borcu olarak kayıtlıdır (konsensus dosyası, kapı listesi 4. madde).

### Korunan dosya değişikliği gerekçesi

`verify:acceptance` kilidi `kanonik-konsensus-fable-sol.md` değişikliğini işaretledi. Değişiklik bu oturumda Emrah'ın açık talebiyle yapılan **durum metni temizliğidir** (bayat "P0 canlıya alınmayı bekliyor" satırlarının, bölüm 8.1'deki 13 Temmuz canlı kapanış kanıtıyla uyumlu hâle getirilmesi). Kabul kriterleri, test dosyaları ve migration'lar değişmedi; kilitteki diğer yedi dosyanın hash'i aynen doğrulandı. Kilit bu gerekçeyle güncellendi.

### Kalan riskler / açık işler

- **v18 canlıya uygulanmadı.** Kontrollü release penceresi gerektirir (P0'daki gibi: migration + canlı smoke aynı pencerede). Uygulama öncesi canlıdaki `plates.short_name` / `brands.name` eşleşmesi v18'in kendi RAISE EXCEPTION kapısıyla doğrulanır; eşleşmezse transaction geri döner.
- **A-002 açık:** Bonus ticari fiyat/iskonto yok → Bonus levhaları pasif, fiyat sütunu kapalı (PRD sınırı korunuyor).
- **Faz 2 bekliyor:** `DIS_CEPHE_MODELLER` sabitinin profil verisine bağlanması (iki wizard dosyasında hâlâ sabit liste var; Faz 1 kapsamı dışı).
- Wizard modeli chip'lerinde artık yoğunluk görünmüyor; kaynak etiketli gösterim Faz 3 karşılaştırma sayfasıyla gelecek.

---

## 2026-07-13 (gece) — Bonus canlı aktivasyon + metraj/harman paketi fazı

### Canlıya alınanlar

1. **Bonus aktivasyonu:** `canli-bonus-adim1-migrationlar.sql` (v18+v19+v19b) ve `canli-bonus-adim2-aktivasyon.sql` canlıda uygulandı (Supabase Management API, Emrah onayıyla). Doğrulama: marka %5 marj, 3 aktif levha, 231 bölge fiyatı, 79 şehir eşleşmesi, 8 teknik profil; canlı API smoke F 150/5cm/34-avrupa = 370,03 TL/m², alt-bölgesiz 34 → 422.
2. **Katalog temizliği:** TEKNO altındaki mantolama dışı 6 Chelfix ürünü silindi (2 fayans, 2 granit yapıştırıcı, 2 yüzey sertleştirici; id 159-162, 167-168). Statik sayfalar redeploy ile düştü (404 doğrulandı).
3. **Migration v20:** Bonus için 3 paket tanımı (Expert/Optimix/TEKNO toz) canlıya uygulandı; eski kod bu satırları okumadığı için site etkilenmedi.

### Karar 13 revizyonu (Emrah, 13 Temmuz 2026)

"Bonus + TEKNO toz kombinasyonuna kesin SET fiyatı verilmez; yalnız levha teklifi" kuralı kaldırıldı. Yeni kural: Bonus levha, üç harman paketiyle komple set olarak satılır (1. Expert "Premium Sistem", 2. Optimix "Dengeli Sistem", 3. TEKNO "Ekonomik Sistem"). TEKNO tozlu pakette sevkiyat `separate_quote_required` uyarısıyla sunulur (marka kuralı değişmedi). Toz marjı: Emrah toz gruplarını daha önce 5'e indirdi; Bonus akışı üzerine İKİNCİ marj bindirmez — toz kalemleri diğer markalarla aynı tek kod yolundan (`buildAccessoryItemsForDefinition`) hesaplanır, levha fiyatı sunucudan marjlı gelir ve değiştirilmez (`buildBonusPlateOrder`, kilit testi `tests/pricing/bonus-package-assembly.test.ts`).

### Yapılanlar

1. **A1 — Kapasite yüzeyi:** `computeBonusCapacity` (lib) + `GET /api/bonus-price/capacity` (yalnız paket m²/adet + kamyon/TIR m²; fiyat alanı YOK). Golden testler üretici listesi değerleriyle: `tests/pricing/bonus-capacity.test.ts`.
2. **A2 — Metraj adımı:** Bonus'ta Step4 preset/prefill/doğrulama gerçek Bonus kapasiteleriyle çalışır (`bonusLogistics` sentezi); `isBonusSelected` doğrulama bypass'ları kaldırıldı; fiyat anındaki alert savunma katmanına indi. Lojistik verisi yokken 480/1200 uydurma preset üretimi tüm markalar için kapatıldı.
3. **B — Harman paketleri:** `handleShowBonusPrices` paket motoruna bağlandı; aksesuar hesabı tek koda çekildi (`buildAccessoryItemsForDefinition`), standart akış da aynı fonksiyonu kullanır.
4. **Metraj pakete oturtma:** Üretici araç kapasitesi paket katının yuvarlanmışı olduğundan (TIR 1.774,1 ≈ 616×2,88) yarım m² toleranslı snap eklendi; 617. paket taşması üretilmez.
5. **Yanlış iddia temizliği:** Bonus'ta bölge kamyon/TIR iskonto rozetleri/nudge'ları bastırıldı (`suppressZoneDiscounts`); sonuç başlığındaki "iskonto hesaplanmış" ifadesi Bonus'ta "nakliye hesaplanmış" oldu.
6. **Aksesuar seçim determinizmi:** `accessories` sorgusuna `.order("id")` eklendi — paket motoru her tipte İLK eşleşeni seçer; sırasız sonuç TEKNO setinde Chelfix'i seçip "Ekonomik" paketi en pahalı yapıyordu (748→590 TL/m² KDV dahil düzeldi).
7. **404 gürültüsü:** marka değişimi sırasında eski modelin kapasite isteği atması engellendi (model-markaya aitlik şartı).

### Kanıt

| Kontrol | Komut | Sonuç |
|---|---|---|
| Unit + kontrat | `npm run verify:fast` | 36 dosya / 274 test + typecheck geçti |
| Hedefli lint | `npx eslint <değişen 6 dosya>` | 0 hata (6 mevcut uyarı, kapsam dışı) |
| E2E (tam paket) | `npx playwright test` | 12/12 geçti (kilitli kritik teklif akışları dahil) |
| Bonus E2E | `tests/e2e/wizard-bonus-flow.spec.ts` | Kapasiteli metraj + inline uyarı + 3 kart + TEKNO sevkiyat uyarısı + 370,03 sunucu fiyatı |
| Build + copy-gate | `npm run build` + `copy-gate.mjs .next` | 293 HTML temiz |
| Görsel | Playwright ekran görüntüleri (step4, uyarı, kartlar) | Konsol hatası yok; iskonto iddiası yok; kartlar doğru |
| Kabul kilidi | `npm run verify:acceptance` | (commit öncesi koşulacak) |

### Kalan riskler / açık işler

- Bonus E2E kartlarda kalem birim fiyatı göremez (kart yalnız ad+miktar basar); çifte marj kilidi unit + kod yolu tekliği ile sağlanıyor.
- `bonus-karsilastirma-fikir-turlari.md` karar bölümüne revizyon notu eklendi; karşılaştırma/SEO sayfaları (P1 kalan kalem) hâlâ açık.
- Aksesuar seçimi artık deterministik (id sırası) ama "en ucuz uygun ürün" gibi açık bir kural değil; ürün ekleme sırası değişirse gözden geçirilmeli.

---

## 2026-07-14 — Bonus teklif kaydı 400 uyarısı + EPS'te Bonus sızıntısı

### Kök nedenler

1. **"Taşyünü teklifi yalnız tam Kamyon..." uyarısı (PDF indikten sonra):** PDF tarayıcıda teklif kaydından ÖNCE iniyor; `/api/quotes` tam araç doğrulamasını genel `logistics_capacity` kaydıyla yapıyordu. Bonus'un kamyonu (F 150/5 cm: 967,7 m²) genel gride uymadığından kayıt 400 dönüyor, istemci alert gösteriyordu — PDF inmiş, kayıt oluşmamış oluyordu.
2. **EPS'te Bonus markası:** marka listesi malzeme tipine bakmıyordu; Bonus'un EPS ürünü olmadığından seçilince akış modelsiz tıkanıyordu.

### Düzeltmeler

1. `/api/quotes`: `brandName === 'Bonus'` ise kapasite `computeBonusCapacity`'den (model+kalınlık); genel `logistics_capacity` HİÇ sorgulanmaz. Kapasite çözülemezse fail-closed 400 ("Bonus araç kapasitesi doğrulanamadı"). `vehicleType` minimum metraj baremi de aynı kaynaktan.
2. Wizard: `wizardSelectableBrands` malzeme tipine duyarlı — Bonus yalnız seçili malzemede aktif levhası varsa listelenir; Bonus seçiliyken EPS'e geçilirse seçim Dalmaçyalı'ya döner (tıkanma yok).

### Kanıt

| Kontrol | Komut | Sonuç |
|---|---|---|
| Yeni route testleri | `tests/api/quotes-route-bonus.integration.test.ts` | 4/4: tam kamyon/TIR kabul (genel lojistik sorgulanmadan), ara metraj 400 + RPC yan etkisiz, bilinmeyen kalınlık fail-closed |
| Unit + kontrat | `npm run verify:fast` | 37 dosya / 278 test + typecheck geçti |
| E2E | Bonus akışı (2 test) + kilitli `quote-flows` (5 test) | 7/7 geçti; yeni: EPS'te Bonus listelenmez, geçişte akış tıkanmaz |
| Kilitli test dosyaları | değiştirilmedi | Bonus senaryoları AYRI dosyada (`quotes-route-bonus`) |

---

## 2026-07-14 — Bonus PDP entegrasyonu (Faz 1, fiyatsız) + prefill köprüsü onarımı

### Yapılanlar

1. **Görseller:** bonusyalitim.com.tr resmî Premium F ailesi render'ı (1000×1000 webp) üç slug adıyla `product-images` bucket'ına yüklendi (üretici üç varyantı tek görselle sunuyor; Emrah onayı).
2. **Migration v21 (canlıda):** 3 Bonus levhasına slug + `quote_only`/`quote_required`/`requires_city_for_pricing` + föy-kaynaklı SEO meta ve katalog açıklaması + görsel. Kalınlıklar üretici listesiyle hizalandı: F 150 Pro'dan listede olmayan 3 cm çıktı (fiyat API'si 404 veriyordu), üç ürüne listede olan 15 cm eklendi (wizard'ı da düzeltir).
3. **Faz 1 fiyatsız (Emrah kararı):** PDP fiyat kutusu "Teklif ile belirlenir"; fiyat yolu wizard CTA'sı. Faz 2'de PDP'ye bölge seçici + canlı /api/bonus-price gelecek.
4. **Prefill köprüsü onarımı (site geneli bug):** `WizardLinkButton` store'un hiçbir bileşen tarafından okunmayan `markaId/modelAdi` alanlarına yazıyordu → PDP→wizard prefill TÜM ürünlerde sessizce çalışmıyordu. Yeni `setProductPreset` aksiyonu hesaplayıcının tükettiği `situationPreset` köprüsüne yazar. İkinci kök neden: `fetchData` varsayılan markayı koşulsuz atıyordu ve geç gelen fetch preset seçimini eziyordu → varsayılan artık yalnız seçim yokken atanır (`prev ?? dalmacyali.id`).

### Kanıt

| Kontrol | Komut | Sonuç |
|---|---|---|
| Unit + kontrat | `npm run verify:fast` | 37 dosya / 278 test + typecheck geçti |
| E2E (tam paket) | `npx playwright test` | 14/14 (yeni `catalog-bonus-pdp.spec.ts`: içerik + fiyatsızlık + 15cm/14cm hizası + prefill köprüsü Bonus+F 150 açıyor) |
| Build + copy-gate | `npm run build` + copy-gate | 329 HTML temiz; 3 PDP + kalınlık sayfaları SSG üretildi |
| Görsel doğrulama | Playwright ekran görüntüleri (PDP, kategori, prefill) | Konsol hatası yok; kategoride 3 Bonus kartı "Teklif" rozetiyle |
| Canlı DB durumu | v21 sonrası salt-okunur sorgu | 3 slug, kalınlık adetleri 13/8/12, görseller bağlı |

### Kalan işler

- Faz 2: PDP'de bölge seçici + canlı bölge fiyatı (`/api/bonus-price`, istemci fetch — SSG bozulmaz).
- PDP'lerde "Sistem halinde %10-15 daha uygun" bandı genel şablon metni; Bonus için ayrıca doğrulanmadı (düşük risk, Faz 2'de gözden geçirilecek).
- PDP'de yapılandırılmış teknik tablo yok (açıklama metniyle veriliyor); karşılaştırma sayfası işiyle (P1) birlikte ele alınacak.

---

## 2026-07-14 — Bonus PDP Faz 2: canlı bölge fiyatı

### Yapılanlar

1. **`BonusRegionPrice` bileşeni:** PDP fiyat panelinde şehir seçimine bağlı canlı levha m² fiyatı. İstanbul/Kocaeli'de yaka/Gebze sorusu sorulur (fail-closed: seçim yapılmadan fiyat gösterilmez); fiyat tarayıcıdan `/api/bonus-price` ile çekilir — sunucuda hesaplanır, taban/iskonto/marj istemciye inmez. Kalınlık çipi ve şehir değişiminde fiyat reaktif güncellenir. Sayfa SSG kalır (revalidate yok, Vercel read artmaz).
2. **"%10-15 daha uygun" bandı:** Bonus'ta doğrulanmamış iddia — Bonus PDP'lerinde nötr metinle değiştirildi ("Komple set fiyatı hesaplayıcıda"); diğer markalarda aynen duruyor.
3. Panel kalınlık kaynağı düzeltmesi: Bonus'ta (thickness_prices yok) canlı fiyat bileşeni `effectiveThickness` (interaktif çip seçimi) kullanır; ilk sürümde statik prop okunuyor, çip değişimi fiyata yansımıyordu — lokalde yakalanıp düzeltildi.

### Kanıt

| Kontrol | Sonuç |
|---|---|
| `npm run verify:fast` | 37 dosya / 278 test + typecheck |
| `npx playwright test` | 14/14 — `catalog-bonus-pdp.spec.ts` genişletildi: yaka sorusu → Avrupa → 370,03 golden fiyat, KDV hariç etiketi, %10-15 iddiasının yokluğu |
| Lokal akış (Playwright) | İstanbul yaka sorusu ✓, Avrupa 370,03 ✓, Ankara doğrudan fiyat ✓, 8 cm reaktif ✓, konsol temiz |
| Build + copy-gate + kabul kilidi | 329 HTML temiz, kilit 8 dosya geçti |

---

## 2026-07-14 — Bonus marka logoları (beyaz/kırmızı) ilgili yüzeylere bağlandı

1. **Beyaz versiyon (`bonus-logo.svg`, koyu zemin):** wizard marka butonu (çift "Bonus" metni yerine logo), ana sayfa "Çalıştığımız Markalar" şeridi (grid 6'ya çıkarıldı), BrandTrustLogos (ana sayfa hero rayı + PDP "Bayilikler").
2. **Kırmızı versiyon (`bonus-logo-red.svg`, açık zemin):** PDF teklifin "Seçilen Sistem" alanı — yalnız Bonus tekliflerinde görünür, diğer markalar etkilenmez.
3. **Yol üstü düzeltme:** PDF sistem tanımındaki model tekrarı ("Bonus F 150 F 150") giderildi — plateBrandName zaten model içeriyor; tüm markaları etkileyen kozmetik bug'dı.
4. Kanıt: 278 unit + 14/14 E2E + build/copy-gate temiz; PDF, mock API ile canlıya kayıt atmadan üretilip görsel doğrulandı (kırmızı logo + düzgün metin), wizard/şerit ekran görüntüleri koyu zeminde beyaz logoyla kontrol edildi.

---

## 2026-07-14 — Wizard: Bonus önde + varsayılan seçili + marka kartı shimmer

1. **Sıra ve varsayılan (Emrah kararı):** Marka butonları `WIZARD_BRAND_ORDER` ile diziliyor (Bonus → Dalmaçyalı → Expert → Optimix); varsayılan seçili marka Bonus (aktif levhası yoksa Dalmaçyalı'ya düşer, malzeme-uyum effect'i korunuyor). PDP prefill üstünlüğü değişmedi (`prev ??` kuralı).
2. **Görsel:** `.brand-card` — radyal ışık degradesi + 5,5 sn'de bir shimmer süpürmesi (globals.css); `prefers-reduced-motion`'da süpürme kapalı, degrade kalır.
3. **UX kapısı:** Bonus + İstanbul/Kocaeli'de yaka/bölge seçilmeden "Metraj Gir" aktif olmaz — fiyat aşamasındaki alert'e düşme senaryosu kapandı (fail-closed, satır içi).

### Korunan dosya değişikliği gerekçesi

`critical-quote-flows.spec.ts` (kilitli) helper'ı varsayılan markayla akıyordu; varsayılan Bonus olunca Dalmaçyalı sayılarıyla kurgulanmış akış kırıldı. Testin kabul niyeti (atomik teklif kaydı + idempotency + capability) DEĞİŞMEDİ; helper artık markayı açıkça seçiyor (`Dalmaçyalı` tıklaması eklendi) ve gelecekteki varsayılan değişimlerinden bağımsız. Kilit hash'i bu gerekçeyle güncellendi; diğer 7 dosya aynen doğrulandı.

### Kanıt

278 unit + 14/14 E2E + build/copy-gate temiz + kabul kilidi geçti. Ekran görüntüleri: masaüstü tek sıra (Bonus seçili, F 150 otomatik), mobil 2×2, degrade/shimmer görünür.

---

## 2026-07-14 — Sprint 0: Kırmızılar + ölçüm sözleşmesi

### Yapılanlar

1. **0.1 WhatsApp izin listesi:** `wizard_result_summary` / `wizard_result_card` kaynakları `/api/whatsapp-intent` izin listesine eklendi — sonuç ekranındaki en yüksek niyetli sinyal artık 400'e düşmüyor. Şemaya `resultSessionId`/`ctaLocation` alanları eklendi (ölçüm zinciri). Yeni test: `tests/api/whatsapp-intent-route.test.ts` (3 senaryo).
2. **0.2 Doğrulanmamış iddia temizliği:** "Sistem halinde %10-15 daha uygun" TÜM markalarda nötr metinle değiştirildi (yalnız Bonus'ta değildi). Proje köküne `copy-gate.json` eklendi: oran iddiaları + "taban fiyat"/"bayi iskonto" müşteri HTML'inde yasak (build kapısı doğruladı: 6 yasak yüklendi, 329 HTML temiz).
3. **0.3 Migration v22 (canlıda):** quotes'a satış sonucu alanları — `loss_category` (7 kategorili kısıt), `loss_reason`, `sales_final_price`, `gross_profit`, `quoted_by`, `closed_at`. Durum sözlüğü DB kısıtıyla sabitlendi (pending→contacted→quoted→approved→completed|rejected; completed=KAZANILDI, rejected=KAYBEDİLDİ). Kapanış anı trigger ile otomatik. Admin PATCH tüm alanları kabul ediyor (camelCase→snake_case eşleme). Canlı trigger doğrulaması: kontrollü test kaydı TY5026578 `rejected/diger` olarak kapatıldı, `closed_at` otomatik damgalandı — huniyi kirleten test verisi de temizlenmiş oldu.
4. **0.4 Ölçüm sözleşmesi:** `docs/verification/OLCUM-SOZLESMESI.md` — ana metrik kazanılmış brüt kâr; olay zinciri, bağ anahtarları (result_session_id/quote_id/quote_code), mevcut GA4 olay eşlemesi, Sprint 1-2 yüzeyleri için rezerve olay adları, gizlilik sınırları, hipotez sözleşmesi şablonu.
5. **0.5 Admin düzeltmesi:** "Toplam Ciro" → "Toplam Teklif Tutarı (ciro değildir)"; yeni kart "Gerçek Ciro (kazanılan)" = completed kayıtların `sales_final_price ?? total_price` toplamı.

### Kanıt

| Kontrol | Sonuç |
|---|---|
| `npm run verify:fast` | 38 dosya / 281 test + typecheck |
| `npx playwright test` | 14/14 |
| Build + copy-gate | 329 HTML temiz (proje yasakları aktif) |
| Kabul kilidi | 8 dosya geçti |
| v22 canlı doğrulama | 6 kolon + 2 kısıt + 1 trigger; trigger canlı kayıtta çalıştı |

---

## 2026-07-14 — Sprint 1: Bonus Meydan Okuma yüzeyleri

### Yapılanlar

1. **1.1 Hakem çekirdeği** (`lib/pricing/comparison/bonusChallenge.ts`): rakip eşleştirme teknik profillerin yoğunluk bandından (HD150→F 150, SW035/TR7.5→F 120; profili olmayan çatı/endüstriyel ürünler otomatik dışarıda); fark yalnız aynı şehir+yaka+kalınlık+toz grubu+kapsam+KDV koşulunda ve Bonus gerçekten düşükse üretilir (fail-closed, "özür kartı yok"). Fiyat verisi taşımaz. 11 unit test.
2. **1.2 Wizard meydan okuma kartı:** Filli grubu sonucunun altında — Bonus rakip set (aynı Optimix tozuyla) m² fiyatı + m² farkı + Bonus'un kendi tam araç siparişi ve toplamı + koşul satırı. İstanbul/Kocaeli'de önce yaka/bölge sorar (fail-closed). "Bonus ile hesapla" mevcut prefill hattıyla akışı Bonus'a çevirir (metraj Bonus tam aracına çekilir, yaka taşınır).
3. **1.3 Filli PDP alternatif kartı** (`BonusAlternativeCard`): iki levha m² fiyatı yan yana (Filli tarafı tam araç istemci hesabı, Bonus tarafı sunucu bölge fiyatı), fark rozeti yalnız Bonus düşükse, yaka seçici, föy etiketli yoğunluk; CTA hesaplayıcıya Bonus prefill.
4. **1.4 Bonus PDP araç toplamları:** bölge fiyat kutusuna 1 Kamyon / 1 TIR levha toplamları — paket katına oturtulmuş metrajla, wizard/PDF ile kuruşu kuruşuna aynı (`buildBonusPlateOrder`).
5. **1.5 Ana sayfa bandı** (`BonusChallengeBanner`): hero altı, rakamsız/iddiasız metin; buton hesaplayıcıyı Bonus F 150 seçili açar.
6. **Ölçüm:** sözleşmedeki rezerve adlar bağlandı — `Bonus_Meydan_Okuma_Gosterildi` / `Bonus_Karsilastirmadan_Secildi` (surface, rakip, bonus_model, unit_diff_tl, result_session_id).

### Kanıt

| Kontrol | Sonuç |
|---|---|
| `npm run verify:fast` | 39 dosya / 292 test + typecheck |
| `npx playwright test` | 18/18 — yeni `bonus-challenge.spec.ts` (4 senaryo: Ankara kartı+geçiş, İstanbul yaka fail-closed, PDP kartı+köprü, ana sayfa bandı) |
| Build + copy-gate + kabul kilidi | 329 HTML temiz; kilit 8 dosya |
| Lokal akış (Playwright) | 5 yüzey tek turda; konsol hatasız. Örnek gerçek fark: Ankara/SW035 5cm → Bonus F 120 495,39 ₺/m², 34,47 ₺/m² düşük; PDP HD150 → F 150 8,87 ₺/m² |

### Kalan işler (Sprint 1 kapsam dışı)

- Karşılaştırma merkezi sayfaları (Sprint 2) — PDP kartındaki "Karşılaştır" bağlantısı şimdilik hesaplayıcıya gidiyor.
- Meydan okuma kartının PDF/WhatsApp teklif çıktısına yansıması yok (bilinçli: teklif her zaman seçilen markadan).

---

## 2026-07-14 — Sprint 2: Karşılaştırma Merkezi

### Yapılanlar

1. **`/tasyunu-karsilastir` (SSG):** 8 ürünlük teknik tablo (yoğunluk kaynak etiketli — föy beyanı / "üretici sözlü beyanı — değişken", λD, dik çekme, basma, yangın, kalınlık aralığı; satırlar PDP'lere linkli) + "Aynı koşulda levha fiyatları" bölümü: şehir(+yaka)+kalınlık seçici, 8 ürünün tam araç levha m² fiyatı canlı; koşulu sağlamayan ürün "bu koşulda fiyat yok" (fail-closed). Koşul satırı her zaman görünür.
2. **`/tasyunu-yogunluk/150-kg-m3` (SSG):** ana tablonun 150 filtresi açık görünümü — föy-beyanlı üç 150'lik (F 150, F 150 Pro, HD150) önce ve vurgulu, diğer beş ürün bağlamda; "150 yoğunluk daha iyi ısı yalıtımı iddiası değildir" + "Pro otomatik üstünlük değildir" nötr metinleri (kilitli karar 3 ve 6).
3. **Tek kaynaklı fiyat formülü:** `lib/pricing/plateUnitPrice.ts` — tam araç levha m² hesabı saf fonksiyon (fail-closed). Parite kanıtı: HD150 İstanbul 5 cm karşılaştırma sayfasında 378,90 = PDP paneliyle birebir.
4. **Çapraz linkler + SEO:** taşyünü PDP'lerinde "aynı koşulda karşılaştır" linki; iki rota sitemap'te; meta başlık/açıklama buildMetadata ile.
5. **Ölçüm:** `Karsilastirma_Acildi` (surface genel/yogunluk_150, urun_sayisi); satır CTA'ları hesaplayıcıya prefill ile gider (Bonus satırlarında `Bonus_Karsilastirmadan_Secildi`).
6. Fiyat verisi gizliliği değişmedi: Bonus fiyatı sunucudan; Filli formül girdileri zaten anon-görünür katalog verisi; taban/iskonto/marj müşteri yüzeyine yazılmıyor (copy-gate).

### Kanıt

| Kontrol | Sonuç |
|---|---|
| `npm run verify:fast` | 40 dosya / 295 test + typecheck |
| `npx playwright test` | 21/21 (yeni `karsilastirma.spec.ts`: teknik tablo+etiketler, 370,03/378,90 canlı fiyat, kalınlık reaktifliği, 150 sıralaması+nötr uyarı, PDP çapraz link) — ilk koşudaki 8 hata soğuk derleme zaman aşımıydı, ısınmış iki tur art arda yeşil |
| Build + copy-gate + kabul kilidi | /tasyunu-karsilastir + /tasyunu-yogunluk/150-kg-m3 SSG üretildi; 331 HTML temiz |

---

## 2026-07-14 — Sprint 3: Satış Operasyon Merkezi

### Yapılanlar

1. **Satış Sonucu paneli** (`app/ofis/tabs/SalesOutcomePanel.tsx`, teklif detayında): "Ulaştım/Ulaşamadım" temas butonları (temas anı + ilk temas süresi otomatik), takip tarihi, ilgilenen kişi, satışçı nihai fiyatı, satış notu; **KAZANILDI** kapanışı brüt kâr girişiyle (boşsa uyarı — ana metrik brüt kâr), **KAYBEDİLDİ** kapanışı zorunlu kayıp kategorisi (7 seçenek) + serbest notla. Kapanmış teklif özet satırıyla gösterilir.
2. **Temas SLA rozetleri:** listede açık+temassız her teklifte "X saattir/gündür temassız" (24 saat üstü kırmızı); kazanılanlarda kâr rozeti.
3. **Satış hunisi paneli:** Teklif → Temas → Fiyat verildi → Teyit → Kazanıldı/Kaybedildi adım sayaçları; ortalama ilk temas süresi, kazanılan brüt kâr toplamı, kayıp nedeni dağılımı; "N açık teklif temassız" uyarı rozeti; **Bugünkü takipler** listesi (vadesi gelen follow_up_date → tıkla-aç).
4. **Test:** `tests/api/admin-quotes-patch.test.ts` — camelCase→snake_case eşleme, kazanıldı/kaybedildi kapanışları, sözlük dışı durum/kategori reddi (4 senaryo).

### Kanıt

| Kontrol | Sonuç |
|---|---|
| `npm run verify:fast` | 41 dosya / 299 test + typecheck |
| `npx playwright test` | 21/21 |
| Build + copy-gate + kabul kilidi | 331 HTML temiz (satış alanları müşteri yüzeyine sızmıyor) |
| Görsel (lokal, admin girişiyle) | Huni: 15 teklif → 0 temas → 1 kaybedildi (Diğer·1 = kontrollü test kaydı); "14 açık teklif temassız" rozeti; Satış Sonucu paneli tüm alanlarıyla render |

### Not

Konsoldaki tek 400 dashboard sekmesinden gelen eski bir kaynak isteği; bu sprintten bağımsız, sunucu logunda karşılığı yok (izlemeye alındı).

---

## 2026-07-15 — Sprint 4A: Satış Hipotez Motoru — gözlem + deney defteri katmanı

### Yapılanlar

1. **Migration v24 değil v23 (canlıda):** `sales_experiments` tablosu — hipotez sözleşmesi alanları (problem/hedef/yüzey/metrik/koruma/karar/sonuç), durum ve karar sözlükleri CHECK'li, RLS açık (anon policy yok). 14 Temmuz yüzeyleri geriye dönük 3 deney olarak tohumlandı (öncesi/sonrası çizgisi bulanıklaşmadan).
2. **Auth'lu API:** `/api/admin/experiments` (GET: `requireOfficeReadAuth`, POST: `requireAdminMutationAuth`) + `[id]` PATCH — mevcut bazı admin route'larının aksine bilinçli olarak handler seviyesinde kapılı doğdu (audit bulgusuyla uyumlu). 4 senaryolu test: auth reddi, snake_case eşleme, eksik sözleşme reddi, kapanış kararı sözlüğü.
3. **"Satış Deneyleri" sekmesi:** deney kartları (sözleşme alanları + durum/karar rozetleri), gerçek veriden öncesi/sonrası penceresi (deney başlangıcından bugüne Bonus/tüm teklif sayısı vs eşit uzunlukta önceki dönem), duraklat/yayınla, kapanış (karar zorunlu + sonuç özeti — öğrenme belleği), yeni deney formu.
4. **4B bilinçli ertelendi:** teşhis/öneri/otomasyon beyni yeterli kapanmış teklif (~20-30) birikince; sekmedeki açıklama bunu kullanıcıya da söylüyor.

### Kanıt

| Kontrol | Sonuç |
|---|---|
| verify:fast | 42 dosya / 303 test + typecheck |
| E2E | 21/21 (bir turda 1 flake: kritik akış canlı RPC oran limitine denk geldi — bugünkü değişikliklerden bağımsız, tekrar turunda yeşil) |
| Build + copy-gate + kabul kilidi | 331 HTML temiz |
| v23 canlı | 3 tohum deney doğrulandı; sekme lokalde girişli sürüldü — pencere gerçek veriyi gösteriyor (14 Temmuz'dan beri 2 teklifin 1'i Bonus) |

### İlgili

Admin panel audit raporu ayrı ajanla üretildi (bkz. sohbet, 15 Temmuz) — kırmızılar: 4 mutasyon route'unda handler-seviyesi auth eksik (patron yazabiliyor), PricesTab bayat/işlevsiz. Audit uygulaması ayrı sprint olarak planlanacak.
