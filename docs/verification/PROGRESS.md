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

---

## 2026-07-15 — Admin audit kırmızıları kapatıldı

1. **Handler-seviyesi mutasyon kapısı:** `quotes/[id]` (PATCH+DELETE), `plates/[id]`, `accessories/[id]`, `material-types/[id]` route'larına `requireAdminMutationAuth` eklendi — salt-okunur "patron" hesabı artık teklif silemez, katalog/fiyat verisi değiştiremez (markalar route'uyla aynı sözleşme). Test: kimliksiz PATCH 401 senaryosu eklendi (`admin-quotes-patch.test.ts`, 5/5).
2. **Fiyatlar sekmesi kaldırıldı:** 404 veren CSV linki, handler'sız "Toplu İşlemler" ve bayat talimatlar içeriyordu; menü (Sidebar+Topbar), page.tsx ve dosya temizlendi. Fiyat güncelleme tek kapıda: Excel Yükle.

Kanıt: 304 unit + typecheck + build/copy-gate/kabul kilidi temiz. Audit'in kalan turuncu/sarıları (menü gruplama, mükerrer fetch/stil, ölü bileşenler) "Admin Yenileme" işi olarak bekliyor.

---

## 2026-07-15 — Admin Yenileme sprinti (menü + panel sadeleştirme)

Audit'in kalan turuncu/sarıları uygulandı. Müşteri yüzeyine hiçbir dokunuş yok; salt admin (`/ofis`) yüzeyi.

### Yapılanlar

1. **Menü 11 → 6 gruba indi, tek kaynak:** `AdminSidebar.tsx` içindeki `NAV_ITEMS` artık tek kaynak; `SECTION_LABELS` ondan türetiliyor ve `AdminTopbar` bu türetilmişi import ediyor (etiketler iki dosyada kopyalanmıştı → tutarsızlık riski gitti). Yeni yapı: Genel Bakış · Teklifler · Satış Deneyleri · Analiz · **Fiyatlandırma** (çatı) · **Katalog** (çatı).
2. **İki çatı sekmesi:** `PricingTab` (alt: Excel ile Güncelle / Marj Kuralları / Markalar / İskontolar) + başına eski Ayarlar'daki "kural haritası" bilgi kutusu; `CatalogTab` (alt: Ürünler / Lojistik Kapasite). `page.tsx` 11 dallı render'dan 6'ya indi.
3. **Ayarlar sekmesi eritildi:** bilgi kutusu → PricingTab başlığına; sürüm bilgisi → sidebar footer'a; sahte "Sistem Durumu" ışıkları (hiçbir gerçek durumu ölçmüyordu) kaldırıldı. `SettingsTab.tsx` silindi.
4. **Dashboard sadeleştirme:** ölü `stats` prop'u ve onu besleyen 4 sayım fetch'i (`page.tsx`) kaldırıldı; `metricsError` artık sessiz `void` değil, kullanıcıya kırmızı uyarı bandı basıyor; mükerrer "Malzeme Dengesi" gauge'i (pasta grafik zaten var) ve "EPS/Taşyünü Markaları (7g)" listeleri (Analiz sekmesinde birebir var) kaldırıldı — Ürün Kırılımı tek kart olarak kaldı.
5. **QuotesTab sadeleştirme:** "Onay Oranı" KPI'ı kaldırıldı (satış hunisi zaten kazanılan/kaybedileni gösteriyor) → KPI 4→3; uydurma sabit `pct:68` ilerleme çubuğu gerçek orana (`kazanılan ciro / teklif toplamı`) bağlandı; "En Çok Talep Alan" ve statik "Anlık İçgörü" blokları (Analiz'le örtüşüyor / dinamik değil) kaldırıldı; yerel `fmtCompact` yerine lib `formatAmount`; ölü `buildBrandRanking` import'u temizlendi.
6. **AdminTopbar:** işlevsiz arama kutusu ve zil (badge'li) kaldırıldı; saniyelik `setInterval` → dakikalık (gereksiz her-saniye re-render gitti).
7. **ProductsTab dürüstlük:** ölü `calculateSalePrice` + `roundToKurus` temizlendi; sabit +%10 kâr varsayan "m² Satış" / "Satış Fiyatı" başlıkları "Kaba m² Tahmini (+%10, gösterge)" ve "Kaba Satış Tahmini" olarak dürüstleştirildi (gerçek satış fiyatı marka/malzeme marj kuralına göre değişir — tooltip'te açıklandı).
8. **Ölü bileşenler silindi:** `MetricCard.tsx`, `ParticleBackground.tsx`, `AdminLoadingScreen.tsx`, `SettingsTab.tsx`.

### Kanıt

| Kontrol | Sonuç |
|---|---|
| verify:fast (vitest + tsc) | 42 dosya / 304 test + typecheck temiz |
| Build | başarılı (331 sayfa) |
| copy-gate (.next) | 331 HTML temiz (6 proje yasağı) |
| Görsel (lokal :3000, admin girişiyle) | 6 sekme de render, **0 konsol hatası**; menü/topbar/çatılar/dashboard/quotes doğrulandı (screenshot) |

### Ertelenen yapısallar (bilinçli)

Sekme başına yeniden fetch (SWR cache yok), quotes sayfalama, `plate_prices` anon okunabilirliği (site geneli ayrı iş), üç admin stil sisteminin (`nx-*`, `ofis*`, `admin-nexus-*`) tam birleşimi. Sprint 4B (teşhis/öneri beyni) hâlâ ~20-30 kapanmış teklif şartını bekliyor.

---

## 2026-07-27 — F0: Ofis rol ayrımı + sessiz mutasyon hatalarının kapatılması

**Sözleşme:** `docs/verification/GOAL-teklif-crm-2026-07-27.md` §5 (F0)
**Kaynak audit:** `docs/verification/OFIS-AUDIT-2026-07-26.md` (B1, B2, B3)

### Neden

26 Temmuz audit'i `/ofis` panelinde tarayıcı ölçümüyle şunu kanıtladı: `patron`
salt-okunur hesabı **23 silme butonu** ve **23 durum menüsü** görüyordu; durum
değiştirilince `PATCH /api/admin/quotes/:id` **403** dönüyor, ekranda **hiçbir
açıklama çıkmıyor**, menü sessizce eski değerine dönüyordu. Kök neden: panelin
rol kavramı yoktu (`/api/admin/me` yalnız kullanıcı adı dönüyordu) ve QuotesTab'in
üç mutasyonu da `if (res.ok && payload?.ok)` ile sarılıydı — `else` dalı yoktu.

### Yapılan

1. **Rol sinyali:** `/api/admin/me` artık `{ user, role: 'admin' | 'patron' | null }`
   dönüyor (`Cache-Control: no-store`). Rol bir yetki kapısı değil, arayüz
   sinyalidir; asıl kapı her mutasyonda `requireAdminMutationAuth` olarak duruyor.
2. **Tek kaynak:** `lib/admin/roles.ts` (`AdminRole`, `canMutate`, `READ_ONLY_HINT`)
   + `lib/admin/useAdminRole.ts` (react-query, `queryKey: ['admin','me']`).
   Fail-closed: rol yüklenmemiş/bilinmiyorsa `canMutate` false.
3. **Sessiz hatalar kapatıldı:** `QuotesTab`'e `readMutationResult()` yardımcısı;
   403/401/diğer HTTP ve ağ hatası için ayrı Türkçe mesaj, `role="alert"` bandı
   (`data-testid="quote-action-error"`).
4. **Patron kontrolleri kaldırıldı:** QuotesTab (durum/öncelik menüleri, silme),
   SalesOutcomePanel (tamamen salt-okunur özet), BrandsTab (marj girişi+kaydet),
   MarginRulesTab (`fieldset disabled` + kaydet gizli), ExperimentsTab (yeni deney,
   duraklat/kapat), ProductsTab (katalog kuralı düzenleme butonları).
5. **Görünürlük:** Topbar'da "Salt okunur" rozeti; Teklifler sekmesinde bilgi notu.
   Topbar'ın kendi `/api/admin/me` fetch'i kaldırıldı → hook ile tek istek.

### Kanıt

| Kontrol | Öncesi | Sonrası |
|---|---|---|
| Patron: silme butonu | 23 | **0** |
| Patron: durum menüsü | 23 | **0** |
| Patron: öncelik menüsü | 23 | **0** |
| Patron: salt-okunur uyarısı | yok | **topbar rozeti + sekme notu** |
| Admin: silme butonu / durum menüsü | 23 / 23 | **23 / 23** (değişmedi) |
| 403'te ekranda hata | **false** | **true** — "Bu hesabın veri değiştirme yetkisi yok — işlem uygulanmadı." |
| `npm run verify:fast` | 377 test | **383 test + tsc temiz** |
| `npx eslint` | 0/0 | **0/0** |
| `npx playwright test tests/e2e/ofis-patron-readonly.spec.ts` | — | **3/3 geçti** |

Yeni testler: `tests/security/admin-role-signal.test.ts` (6 test, rol türetimi +
fail-closed + no-store), `tests/e2e/ofis-patron-readonly.spec.ts` (AC-01 patron,
AC-01 admin, AC-02 görünür hata).

### Not

AC-02 specinde patron kimliğiyle değil, admin kimliğiyle girip PATCH yanıtı
route interception ile 403'e çevriliyor. Gerekçe: patron artık kontrolü hiç
görmediği için o yoldan 403 tetiklenemiyor; testin ölçmek istediği şey ise
"403 geldiğinde arayüz ne yapıyor" — bu kurgu onu doğrudan ölçüyor.

### Kalan

F1 (müşteri varlığı + mobil kabuk) başlamadı. Audit'in diğer kırmızıları
(mobil düzen E1, sayfalama E2, react-query retrofit) sözleşme gereği F1/Hat B
içine gömülü olarak ilerleyecek.

---

## 2026-07-27 — F1: Müşteri varlığı + mobil kabuk

**Sözleşme:** `docs/verification/GOAL-teklif-crm-2026-07-27.md` §5 (F1)

### Yapılan

1. **Mobil kabuk (audit E1/V1).** `.nx-sidebar` sabit 240px + AdminShell'de inline
   `marginLeft:240px` vardı, hiçbir medya sorgusu yoktu; 375px'te içeriğe 135px
   kalıyordu. Artık `<1024px`'te kenar çubuğu çekmece: `.nx-content`, `.nx-drawer-toggle`,
   `.nx-sidebar-backdrop` sınıfları + `prefers-reduced-motion`. Çekmece Esc ile ve
   sekme seçilince kapanır (effect'te setState yerine gezinme olayında).
2. **v24 migration yazıldı** (`scripts/migration-v24-musteri-varligi.sql`):
   `customers` (doğal anahtar: `business_unit` + `phone_normalized`),
   `customer_interactions` (append-only defter), `quotes`'a 7 NULL kolon,
   `normalize_phone_tr()`, geriye dönük eşleştirme (5a-5e), `trg_quotes_link_customer`,
   RLS + FORCE + REVOKE, 8 doğrulama kapısı.
3. **Müşteri API'leri:** `GET/POST /api/admin/customers`,
   `GET/PATCH /api/admin/customers/[id]`,
   `GET/POST /api/admin/customers/[id]/interactions`.
   Okuma uçları baştan `requireOfficeReadAuth` kullanıyor — audit S1'deki açık
   (`/api/admin/quotes` GET'inde handler kapısı yok) yeni yüzeyde tekrarlanmadı.
   Liste ilk günden sunucu taraflı sayfalı (audit E2).

### Kararlar

- **Trigger ciro yolunu düşüremez.** `quotes_link_customer()` gövdesi
  `EXCEPTION WHEN OTHERS` ile sarılı; bağlanamayan teklif `customer_link_status='failed'`
  damgalanır ve yine yazılır. CRM eksikliği < ciro kaybı.
- **quotes'a eklenen 7 kolonun hiçbiri NOT NULL değil.** `submit_quote_guarded`
  açık kolon listesiyle INSERT ettiği için bu kural bozulursa RPC kırılır;
  testle kilitlendi.
- **KVKK'da sahte rıza yok.** Ofis kaynaklı kayıtta `kvkk_consent=false`,
  `consent_basis='sozlesme_hazirligi'` (m.5/2-c). Saklama/imha politikası
  bilinçli ertelendi (kullanıcı kararı) — `retention_until` kolonu boş durur,
  migration hiçbir otomatik silme kurmaz.
- **Telefon PATCH ile değiştirilemez** — doğal anahtar ve teklif bağı ona dayanıyor;
  düzeltme ayrı bir birleştirme işi.
- **POST /customers kopya üretmez:** aynı normalize telefon varsa mevcut müşteriyi
  `existing: true` ile döner.

### Kanıt

| Kontrol | Sonuç |
|---|---|
| `npm run verify:fast` | **49 dosya / 419 test + tsc temiz** (F0 öncesi 377) |
| `npx eslint` | **0/0** |
| `tests/e2e/ofis-responsive.spec.ts` | **6/6** — 375/768/1440'ta yatay kaydırma yok, çekmece çalışıyor |
| `tests/e2e/ofis-patron-readonly.spec.ts` | **3/3** |
| `tests/security/phone-normalize-parity.test.ts` | **25 test** — TS↔SQL dal paritesi + migration güvenlik sözleşmesi |
| `tests/security/customer-routes-auth.test.ts` | **11 test** — 6 uçta kimliksiz 401, patron 403, DB'ye dokunulmuyor |
| Mobil görsel (375px) | içerik 135px → **tam genişlik** (ekran görüntüsüyle doğrulandı) |

### Açık

**v24 migration üretime UYGULANMADI** — sözleşme gereği ayrı onay bekliyor.
Uygulanana kadar müşteri API'leri canlıda 500 döner (tablolar yok); hiçbir
mevcut yüzey bu uçları henüz çağırmadığı için canlı davranış etkilenmiyor.

---

## 2026-07-27 — Katalog + Analiz düzeltmeleri (audit G5/G6/E2/B7 + model tekrarı)

### Ürün adı tekrarı — kök neden bulundu ve tek yerde çözüldü

Kullanıcı hem `/ofis` Analiz sekmesinde hem müşteriye giden **PDF'lerde**
"Optimix Optimix" tekrarını gördü. Canlı veriyle izlendi:

- `plates.short_name` bazı ürünlerde markayı ZATEN içeriyor:
  `brand_name="Optimix"`, `short_name="Optimix Karbonlu"`.
- `WizardCalculator.tsx:1651` kalem adını `${marka} ${short_name}` diye koşulsuz
  birleştiriyordu → PDF'te **"Optimix Optimix Karbonlu 5 cm EPS"**
  (gerçek `quotes.package_items` kaydında doğrulandı).
- Analiz sekmesinde ikinci bir kat vardı: RPC `plate_brand`i bazı satırlarda
  zaten "marka + model" döndürüyor, arayüz modeli bir kez daha ekliyordu →
  "Bonus F 150 Pro F 150 Pro × TEKNO".

**Çözüm:** `lib/catalog/productLabel.ts` (yeni, saf):
`joinBrandAndModel`, `composePlateLabel`, `buildPlateItemName`.
Üç yüzey de bu tek kaynağı kullanıyor — wizard kalem adı (PDF'e giden),
Bonus dalı ve Analiz. Veri değiştirilmedi: `short_name` katalog sayfalarında
ve PDP başlıklarında da kullanılıyor, oradaki adı değiştirmek SEO'yu etkilerdi.

### "-" toz grubu markası değilmiş

Analiz'de "Toz Grubu Markaları" sıralamasında 2. sırada `-` görünüyordu
(6 teklif, 2,5M ₺). Canlı veri: 6 kaydın **6'sı da `source_channel='catalog'`**
— katalogdan tek ürün teklifi, toz grubu seçilmiyor. `apiQuoteSchema`
`accessoryBrandName`i zorunlu tuttuğu için (`min(1)`) boş yazılamıyor, yerine
tire konuyor. Artık "Toz grubu yok" olarak etiketleniyor, italik/soluk
gösteriliyor ve sıralamanın sonuna alınıyor.

### Katalog sekmesi 19.222px → 1.250px

Marka ve aksesuar türü grupları katlanır yapıldı (varsayılan kapalı,
`aria-expanded` + `aria-controls`). 261 varyant + 134 aksesuar artık tek
seferde DOM'a basılmıyor.

### Diğer

- **G6:** emoji ikonlar (🧱 📏 🧰 🗂️) → Lucide SVG (Layers/Ruler/Package/FolderTree)
- **G5:** `StatCard.onClick` ölü prop'u kaldırıldı (dört çağrının hiçbiri geçmiyordu)

### Kanıt

| Kontrol | Sonuç |
|---|---|
| `npm run verify:fast` | **50 dosya / 442 test** + tsc temiz |
| `npx eslint` | 0/0 |
| `tests/contracts/analytics-labels.test.ts` | **23 test** — canlı RPC satırlarıyla |
| Katalog sayfa yüksekliği | 19.222px → **1.250px** (tarayıcıda ölçüldü) |
| Analiz ekranı | tekrar gitti, "Toz grubu yok" sonda (ekran görüntüsü) |

### Yan bulgu

`get_combination_metrics` RPC'sinin SQL tanımı **repoda yok** — yalnız
Supabase'de yaşıyor, migration dosyası bulunmuyor. Bu yüzden `plate_brand`
bileşiminin neden satır bazında değiştiği kaynaktan doğrulanamadı; düzeltme
arayüzde yapıldı. RPC'nin bir migration dosyasına çıkarılması açık iş.

---

## 2026-07-27 — Audit Faz 3 ve Faz 5 tamamlandı

### Güvenlik sertleştirmesi

**S1 — admin okuma uçlarına handler kapısı.** Altı uç yalnızca `proxy.ts` ile
korunuyordu; kardeş uçlar (experiments GET, quotes/[id]/pdf GET) zaten
`requireOfficeReadAuth` kullanıyordu. Matcher'da yapılacak bir düzenleme bu
uçları sessizce açardı. Kapatılanlar ve ne döndürdükleri:

| Uç | İçerik |
|---|---|
| `quotes` | tam müşteri PII'si (ad, e-posta, telefon, adres) |
| `dashboard-metrics` | ciro ve teklif hacmi |
| `combination-metrics` | marka/kombinasyon kırılımı |
| `brands` | `margin_pct` — kâr marjı |
| `material-types` | `tier1/2/3_margin_pct` — kademe marjları |
| `storage-images` | yayımlanmamış görsel listesi |

**S2 — proxy.** Kimlik karşılaştırması `===` yerine sabit süreli `safeEqual`
(handler katmanı zaten `timingSafeEqual` kullanıyordu, proxy geride kalmıştı).
`atob()` artık `parseBasicCredentials` içinde korunuyor: bozuk base64 gönderen
istemci 500 yerine normal 401 alıyor.

### Yanıltıcı göstergeler kaldırıldı

- **G1** — "Kaba m² Tahmini (+%10)" ve "Kaba Satış Tahmini" sütunları silindi.
  Sabit %10 ekleyen, hiçbir yerde kullanılmayan sayılardı; ekranın en dikkat
  çekici (yeşil, kalın) sütunuydu. Gerçek fiyat marj kuralı + KDV ile hesaplanır.
- **G2** — KPI ilerleme çubukları kaldırıldı. "Toplam Talep" çubuğu
  `Math.min(100, total * 4)` ile doluyordu; 25 teklifte %100 olup orada kalıyordu.
- **G3** — "Talep Türleri" çubukları ortak ölçeğe bağlandı. Genişlik `value * 8`
  ile hesaplanıyordu, çubuklar birbiriyle kıyaslanamıyordu.
- **G4** — Genel Bakış'ta iki farklı kart aynı "Talep Akışı" başlığını
  taşıyordu; alttaki "Son Talepler / Gelen Kayıtlar" oldu.

### Kalan hatalar

- **B5** — Deney silme yoktu (`DELETE /api/admin/experiments/[id]` + arayüz
  düğmesi eklendi). Tamamlanmış deney silinemez, sunucu 409 döner —
  sonucu öğrenme belleğinin parçası.
- **B6** — Recharts `width(-1)` uyarısı: `initialDimension` ile ilk render'a
  geçerli boyut verildi. Konsol artık temiz.
- **E9** — Teklif detay penceresi `Esc` ile kapanıyor, odak tuzağı kuruyor,
  arka plan kaydırması kilitleniyor, kapanışta odak geri veriliyor
  (`role="dialog"`, `aria-modal`). KPI kartları `tabIndex` + Enter/Space aldı.

### Faz 3 — ortak önbellek

`lib/hooks/useAdminQuotes.ts` ve `lib/hooks/useAdminMetrics.ts` eklendi;
Dashboard/Quotes/Experiments/Analytics artık tek anahtarı paylaşıyor
(`staleTime` 60 sn, mutasyon sonrası `invalidateQueries`).

`Date.now()` render içinde çağrılıyordu (React saflık kuralı ihlali);
react-query'nin `dataUpdatedAt` damgasına geçildi.

### Kanıt

Yeni ölçüm aracı: `node scripts/verify-ofis-network.mjs`

| Ölçüm | Öncesi | Sonrası |
|---|---|---|
| `/api/admin/quotes` çağrısı | **7** | **1** |
| `dashboard-metrics` | 3 | 1 |
| `combination-metrics` | 2 | 1 |
| Toplam admin isteği | 13 | **6** |
| Konsol hata/uyarı | 1 (Recharts) | **0** |
| `verify:fast` | 377 | **458 test** + tsc temiz |
| `eslint` | 0/0 | **0/0** |
| E2E (patron + responsive) | — | **9/9** |

---

## 2026-07-27 — Hat A: Elle teklif yazma ekranı (ilk sürüm çalışıyor)

### Migration olmadan çalışır hâle getirildi

Plan v25 tabloları (`quote_items`, `quote_revisions`) öngörüyordu ama `quotes`
tablosu incelendiğinde bunlara gerek olmadığı görüldü: `status` dışında CHECK
kısıtı yok, kalemler zaten `package_items JSONB` kolonunda duruyor. Böylece
ekran **onay bekleyen hiçbir migration'a bağlı olmadan** teslim edildi.

### Neden ayrı yazma yolu

`submit_quote_guarded` RPC'si operatör akışıyla bağdaşmıyor:
IP başına 5/10dk ve telefon başına 3/30dk hız limiti, 30 dk dedupe, zorunlu
`kvkk_consent=true`, 25 zorunlu anahtar. Bunun yerine
`POST /api/admin/quotes/manual` → service-role insert + kendi doğrulaması.
**Public ciro yolu (`app/api/quotes`) hiç değişmedi.**

### Eklenenler

| Dosya | İş |
|---|---|
| `app/api/admin/catalog-items/route.ts` | Ürün kaynağı — İSK1 (şehir/araç), İSK2 (ürün/Optimix) ve marka/malzeme marjı **sunucuda** uygulanıp `suggestedUnitPrice` döner. Ham `base_price`/`discount_*` tarayıcıya inmez. |
| `app/api/admin/quotes/manual/route.ts` | Kayıt yolu. Toplam sunucuda yeniden hesaplanır; 2 kuruştan fazla sapmada 409. |
| `lib/schemas/manualQuote.schema.ts` | Ürün alanları opsiyonel, para alanları katı. `apiQuoteSchema`'yı import etmez. |
| `components/admin/quote-editor/*` | Satır tablosu, katalog seçici, editör durumu + Excel yapıştırma ayrıştırıcısı. |
| `app/ofis/tabs/quotes/ManualQuoteEditor.tsx` | Ekran. |
| `app/ofis/tabs/QuotesShell.tsx` | Teklifler çatı sekmesi (Liste / Yeni Teklif). |

### Kararlar

- **Sistem fiyat önerir, operatör ezer.** Birim fiyat katalogdan marj+iskonto
  uygulanmış gelir; üstüne yazılırsa satırda rozet çıkar, tek tıkla geri alınır.
- **Tarayıcının hesabına güvenilmez.** Ekran ve sunucu aynı `buildQuoteTotals`
  fonksiyonunu kullanır (KDV %20 tek kaynak), sunucu yine de yeniden hesaplar.
  Denemede bilerek yanlış toplam gönderildi → 409 ile reddedildi.
- **KVKK'da sahte rıza yok.** `kvkk_consent=false`,
  `consent_basis='sozlesme_hazirligi'` (m.5/2-c), temas kanalı operatörden.
- **Ticari kural engellemez, uyarır.** Min sipariş ihlalinde 422 + `needsOverride`;
  operatör gerekçe yazarak geçer, gerekçe `admin_notes`'a kaydedilir.
- **Teklif kodu sunucuda üretilir:** `TE-2026-000128`. Wizard'ın istemci
  ürettiği `TY…` önekinden ayrı — çakışma uzayı bağımsız.
- `upload-pdf` kapısı `manual_quote` kanalını da tanıyor (plan R6);
  açılmasaydı elle teklifin PDF'i sessizce 403 alacaktı.

### Kanıt — uçtan uca çalıştırıldı

| Adım | Sonuç |
|---|---|
| `GET /api/admin/catalog-items?cityCode=34&areaM2=1000` | **251 ürün**, marj ve iskonto uygulanmış (ör. Dalmaçyalı CS60 5 cm: net 382,83 → satış 401,97 ₺/m², marj %5) |
| Yanlış toplamla `POST` | **409** — "sunucu 431.378,40 ₺ hesapladı, ekran 430.386,75 ₺ gönderdi" |
| Doğru toplamla `POST` | **201** — `TE-2026-000128`, kanal `ofis`, tip `manual_quote`, durum `quoted` |
| Kayıt doğrulaması | kalemler `package_items.items` içinde satır satır; `quoted_by`, `consent_channel`, iskonto meta doğru |
| Tarayıcıda tam akış | müşteri → şehir → metraj → katalogdan ürün → serbest satır → %3 iskonto → **1.347.655,92 ₺**, konsol hatası yok |
| Test kaydı | temizlendi (DELETE 200) |

### Yan bulgu — veri bozukluğu

Katalogdaki **251 üründen 18'inde** karakter bozulması var:
`"Dalmaçyalı ?elik D?bel 11.5"` → olması gereken "Çelik Dübel". Bozukluk
veritabanındaki `accessories` kayıtlarında; bu ekran yalnız görünür kıldı.
Aynı adlar müşteriye giden PDF'e de girer. Ayrı bir veri düzeltme işi.

### Kalan (Hat A)

Revizyon/iskonto senaryoları (aynı teklifin %3 / %4 varyantı), PDF şablonuna
ayrı iskonto satırı, `private-pdf-client` sözleşme listesine yeni ekranın
eklenmesi, teklif listesi sayfalaması.

---

## 2026-07-27 — Ürün adı onarımı + Bonus'un katalogda görünmesi

### 1. Bozuk Türkçe karakterler onarıldı (canlı veri)

`accessories.short_name` içinde 18 kayıt bozuktu: `"?elik D?bel 11.5"`.
Bu adlar teklif ekranında ve **müşteriye giden PDF'te** görünüyordu.

**Tahminle düzeltilmedi:** aynı satırın `name` kolonu sağlamdı
("Dalmaçyalı Taşyünü Dübeli Çelik Çivili 11,5cm 200 adet"). Onarım scripti
(`scripts/fix-accessory-mojibake.mjs`) her düzeltmeyi `name` kolonuyla
doğruluyor; doğrulayamadığı satıra dokunmuyor. Varsayılan mod kuru çalışma.

| | Sonuç |
|---|---|
| Bozuk kayıt | 18 / 134 |
| Doğrulanan düzeltme | **18** |
| Atlanan (şüpheli) | 0 |
| Uygulandı | **18/18** |
| Kalan bozuk | **0** |

`?elik → Çelik`, `D?bel → Dübel`, `D?beli → Dübeli`. `plates` tablosunda
bozuk kayıt yok (0/43).

### 2. Bonus ürünleri katalogda görünmüyordu

Elle teklif ekranının ürün listesinde **251 üründen 0'ı Bonus'tu.**

**Kök neden:** Bonus levhalarının `base_price` ve `base_price_per_cm` değerleri
NULL ve `plate_prices` tablosunda hiç satırı yok (27 levha ailesi, **0 fiyat
satırı**). Bonus fiyatı bölge bazlı listede yaşıyor
(`lib/pricing/bonus/bonus-region-prices.json`) ve yalnız `computeBonusUnitSale()`
ile hesaplanabiliyor. Genel hesap yolu `basePrice <= 0` kontrolünde hepsini
atlıyordu.

**Çözüm:** `catalog-items` rotasına ayrı Bonus dalı. Fail-closed kaldı: şehir
seçilmeden, fiyat çözülemeyince veya marj yoksa ürün listelenmiyor. Bonus taban
fiyatı istemciye inmiyor (`netCost: 0`).

Alt-bölge kuralı da bağlandı: İstanbul yaka / Kocaeli Gebze ayrımı seçilmeden
Bonus fiyatı üretilemiyor; ekran artık bunu sessizce yutmak yerine uyarı
gösterip seçim kutusu açıyor.

| Sorgu | Bonus | Toplam | Not |
|---|---|---|---|
| İstanbul, yaka seçilmemiş | 0 | 251 | "Bonus fiyatı bölge seçimi ister" uyarısı |
| İstanbul + Anadolu yakası | **117** | 368 | F 150 5cm → 359,37 ₺/m² |
| Ankara | **117** | 368 | F 150 5cm farklı bölge fiyatı |

Tarayıcı doğrulaması: "Bonus F 150" araması **21 sonuç**, marj %5 (marka
kuralı), konsol hatası yok. "Dübel" araması → "Dalmaçyalı Çelik Dübel 11.5".

### Kanıt

| Kontrol | Sonuç |
|---|---|
| `npm run verify:fast` | **52 dosya / 468 test** + tsc temiz |
| `npx eslint` | 0/0 |
| `tests/contracts/catalog-items-bonus.test.ts` | 10 test — Bonus dalı, fail-closed kapılar, taban fiyat sızıntısı yok, onarım scriptinin doğrulama zorunluluğu |

---

## 2026-07-27 — Elle teklifte PDF üretimi bağlandı

### Akış

Sıra wizard'ın tersi ve bu daha güvenli: **önce teklif kaydı** (kodu sunucu
verir) → **sonra PDF** → **sonra private storage'a yükleme**. Wizard'da kod
istemcide üretildiği için PDF önce basılıyor; burada kod sunucudan geldiğinden
bu sıra zorunlu.

PDF üretimi veya yüklemesi başarısız olsa bile **teklif kayıtlıdır**; ekran
uyarı gösterip tarayıcıda üretilen kopyayı indirmeye açar.

`lib/quote/buildManualPdfData.ts` (yeni, saf) editör durumunu `PDFQuoteData`
sözleşmesine çeviriyor. Wizard ile **aynı şablon** kullanılıyor — müşteri iki
kanaldan da aynı belgeyi görüyor.

### Sözleşme testi kapsamı yapısal olarak kapatıldı

`tests/contracts/private-pdf-client.test.ts` iki dosyayı **sabit listede**
tutuyordu; yeni bir PDF üreten ekran eklendiğinde test yeşil kalıyor ama ekran
hiç denetlenmiyordu (audit riski R1).

Eklenen meta-test: `generateQuotePDF` import eden **her** dosya listede olmak
zorunda. Liste bayatlamasın diye ters yön de kontrol ediliyor (listede olup
artık PDF üretmeyen dosya).

Kasten bozularak doğrulandı — `ManualQuoteEditor` listeden çıkarıldığında test
kırılıyor:
```
Bu dosyalar PDF üretiyor ama private-pdf-client sözleşmesinde yok:
  app/ofis/tabs/quotes/ManualQuoteEditor.tsx
```

Sözleşme ayrıca kanal bazlı ayrıldı: public akış `Idempotency-Key` göndermek
zorunda (guard'lı RPC bunu istiyor), ofis akışı zorunda değil (o RPC'yi
kullanmıyor). Ortak değişmez kural her ikisinde de aynı: **PDF, kaydedilmiş bir
teklife bağlanmadan yüklenemez.**

### PDF şablonunda iki görüntü hatası düzeltildi

Üretilen ilk PDF'te iskonto satırı tutar yerine "📦 Paket İçeriği" gösteriyor,
TUTAR sütununa "-" basıyordu. Kök neden `lib/pdfGenerator.ts:290`:

```ts
const isZeroPrice = (it.unitPrice === 0 || it.unitPrice < 0.01) && !it.isPlate
```

`< 0.01` kontrolü **negatif fiyatı da** kapsıyordu. Ofis teklifinde toplu alım
iskontosu negatif kalem satırı olarak basıldığı için müşteriye giden belgede
iskonto görünmüyordu. `it.unitPrice >= 0 && it.unitPrice < 0.01` oldu.

İkincisi: levha satırında paket bilgisi yokken "(0 PKT)" yazılıyordu — yanlış
bilgi; artık `packageCount > 0` değilse hiç yazılmıyor.

**Güvenlik notu:** bu değişiklikler `pdf-screen-consistency` testinin koruduğu
bölgenin (satır 399–421, "Toplam Metraj" ↔ "&lt;!-- Tablo --&gt;") DIŞINDA
(satır 284–312). Test değiştirilmeden geçmeye devam ediyor; ayrıca bu iki
davranış aynı dosyaya yeni assertion olarak eklendi.

### Kanıt — uçtan uca

| Adım | Sonuç |
|---|---|
| Bonus levha + Dübel + %3 iskonto | ekranda **446.767,87 ₺** |
| Kayıt | `TE-2026-000131`, kanal `ofis` |
| PDF üretimi | başarılı, tarayıcıdan indirildi |
| PDF içeriği | iskonto satırı **−11.514,64 ₺**, "(0 PKT)" yok, toplam ekranla birebir |
| Ürün adları | "Dalmaçyalı Çelik Dübel 11.5" — mojibake onarımı belgede görünüyor |
| Konsol | hata yok |
| Test kayıtları | temizlendi (34 gerçek teklife dönüldü) |

### Düzeltilen UX hatası

`QuotesShell` kayıttan sonra otomatik olarak listeye geçiyordu; operatör başarı
ekranını ve PDF indirme düğmesini hiç göremiyordu. Sekme değişimi kaldırıldı.

### Kanıt

| Kontrol | Sonuç |
|---|---|
| `npm run verify:fast` | **52 dosya / 475 test** + tsc temiz |
| `npx eslint` | 0/0 |
| `node scripts/verify-ofis-network.mjs` | AC-05 ✓ (1 çağrı), AC-08 ✓ (konsol temiz) |

### Açık

- **`PDF_CAPABILITY_SECRET` lokalde tanımlı değil** — bu yüzden arşivleme
  denenmedi, ekran "yapılandırılmamış" uyarısı gösterip indirmeye açtı.
  Üretimde tanımlıysa arşivleme de çalışır; canlıda bir kez doğrulanmalı.
- Kaydet düğmesi kayıt sırasında devre dışı kalıyor (çift tıklama koruması);
  sunucu tarafı idempotency anahtarı yok — ofis rotası bilerek guard'sız.

---

## 2026-07-27 — Pazarlık senaryoları + açık kalan doğrulamalar kapatıldı

### Açık #1 kapandı: PDF arşivlemesi

Önceki turda "lokalde `PDF_CAPABILITY_SECRET` yok, arşivleme denenmedi"
notu bırakılmıştı. Kapatıldı:

1. **Canlı veri kontrolü:** 33 `pdf_quote` kaydının **32'sinde**
   `pdf_storage_path` dolu → üretimde arşivleme zaten çalışıyor.
2. **Elle teklif yolu ayrıca doğrulandı:** dev sunucusu ortam değişkeni
   enjekte edilerek çalıştırıldı (kullanıcının `.env.local` dosyasına
   dokunulmadı). Sonuç: PDF `132/33a4a548-….pdf` yoluna yüklendi,
   `GET /api/admin/quotes/132/pdf` → **302** (imzalı URL yönlendirmesi).

### Pazarlık senaryoları

alcifiyatlari'nda elle yapılan iş (`AFM-Teklif_..._3-Iskonto.pdf` /
`_4-Iskonto.pdf` — **aynı teklif no**, farklı oran) artık ekranda.

**Model: tek kayıt, N belge.** Senaryo değiştirmek kaydı değiştirmez;
yalnız PDF varyantı üretir. Şema değişikliği gerekmedi.

- Kaydetmeden önce: "Pazarlık senaryoları (iskonto %)" alanına `4, 5`
  yazılınca karşılaştırma tablosu çıkıyor — her oran için genel toplam ve
  ana orandan farkı.
- Kaydettikten sonra: her senaryo için tek tıkla PDF
  (`TE-2026-000133-iskonto-4.pdf`).

`useQuoteEditor.totalsFor(pct)` saf fonksiyona çıkarıldı; ekran, senaryo
tablosu ve PDF üretimi aynı hesabı kullanıyor (KDV tek kaynak:
`buildQuoteTotals`).

### Kanıt — uçtan uca

| Adım | Sonuç |
|---|---|
| Ana teklif (%3) | 393.560,04 ₺ |
| Senaryo %4 | 389.502,72 ₺ (−4.057,32 ₺) |
| Senaryo %5 | 385.445,40 ₺ (−8.114,64 ₺) |
| İndirilen belge | `TE-2026-000133-iskonto-4.pdf` |
| PDF içeriği | aynı teklif no, "Toplu alım iskontosu (%4) −13.524,40 ₺", toplam 389.502,72 ₺ |
| Konsol | hata yok |
| Test kaydı | temizlendi (34 gerçek teklife dönüldü) |

`tests/pricing/quote-scenarios.test.ts` (11 test) davranışı kilitliyor:
senaryo satır toplamını etkilemez, iskonto arttıkça toplam düşer, KDV her
senaryoda %20 kalır, **nakliye iskontodan sonra eklenir** (iskonto nakliyeye
uygulanmaz), %100 ve %0 sınır durumları.

### Kanıt — tam doğrulama

| Kontrol | Sonuç |
|---|---|
| `npm run verify:fast` | **53 dosya / 486 test** + tsc temiz |
| `npx eslint` | 0/0 |
| `npm run build` | başarılı (457 sayfa) |
| `copy-gate .next` | **457 HTML temiz** (6 proje yasağı) |
| `scripts/verify-ofis-network.mjs` | AC-05 ✓ · AC-08 ✓ |

### Hat A durumu

Tamamlanan: katalog ucu (marj+iskonto sunucuda), kayıt yolu (guard'sız,
toplam doğrulamalı), satır editörü (Excel yapıştırma dahil), Bonus bölge
fiyatı + yaka seçimi, PDF üretimi + arşivleme, sözleşme meta-testi,
pazarlık senaryoları.

Kalan: teklif listesi sayfalaması (Faz 2.2) ve karar verdiren panel (Faz 4).

---

## 2026-07-27 — Faz 2.2 + Faz 4 + kullanıcı geri bildirimi + bayat E2E onarımı

### Kullanıcı geri bildirimi: "Teklif alamıyorum, ne istediğini anlamadım"

Ekran katalogdan ürün seçince miktarı boş bırakıyor, "Eksik: en az bir kalem"
diyordu. Oysa satır VARDI — yalnız miktarı boştu. Operatör neyi düzelteceğini
anlayamıyordu. Üç düzeltme:

1. **Miktar otomatik dolar.** m² birimli ürün seçilince miktar = iş metrajı
   (operatör zaten yazmıştı, ikinci kez istemek gereksizdi). Dolmadıysa imleç
   miktar kutusuna gider.
2. **Eksik mesajı satır satır söyler:** "1. satırda miktar girin" —
   "en az bir kalem" yerine.
3. **İki iskonto kutusunun farkı yazıldı.** Alt kutu "Alternatif iskonto
   oranları (isteğe bağlı)" oldu; ana orana eşit değer yazılınca
   "ana iskontoyla aynı — alternatif üretilmedi" uyarısı çıkıyor
   (eskiden sessizce hiçbir şey olmuyordu).

Kullanıcının senaryosu birebir tekrarlandı: miktar **6652,8** otomatik doldu,
tutar hesaplandı, "Teklifi kaydet" açıldı.

### Faz 2.2 — teklif listesi sayfalaması

KPI ve huni panelleri TÜM tekliflere ihtiyaç duyduğu için veri tek seferde
çekilmeye devam ediyor; sayfalanan yalnız RENDER edilen liste (12 seri).
Filtre/arama değişince başa döner.

**4.410px → 2.771px** (kabul kriteri < 3.000px).

### Faz 4 — karar verdiren panel

- **Süre biçimlendirme** (`lib/admin/formatDuration.ts`): "1674 saat" → **"2 ay"**,
  eşik renkleriyle (≤24s iyi, ≤48s uyarı, üstü kritik).
  Türkçe ek uyumu ayrı fonksiyonda: düz birleştirme "13 güntir" üretiyordu,
  artık **"13 gündür"**.
- **Bugün yapılacaklar kartı**: Genel Bakış'ın üst şeridi "Bugünkü Teklif 0 ·
  Bekleyen 0 · PDF 0 · WhatsApp 0" gösteriyordu — gün boş geçince panel bomboş
  hissettiriyordu, oysa 22 teklif temassız bekliyordu. Şerit artık
  **Temassız · Bugün Takip · Açık Teklif · Bugün Gelen**; altında en uzun
  bekleyen 5 teklif tıklanabilir liste hâlinde.
- **Tarih aralığı filtresi**: Tüm zamanlar / 7 / 30 / 90 gün.
- **CSV dışa aktarım** (`lib/admin/quotesCsv.ts`): Türkçe Excel uyumlu
  (";" ayraç, "," ondalık, UTF-8 BOM). **Formül enjeksiyonuna karşı korumalı** —
  `=`, `+`, `-`, `@` ile başlayan değerler tırnaklanır.
  **Brüt kâr bilinçli olarak dışarıda**: dosya elden ele dolaşabilir.

### Bayat E2E testleri onarıldı (benim değişikliklerimden ÖNCE kırıktı)

Tam paket koşulunca 2 hata çıktı. Git ile kaynağı bulundu — ikisi de
davranış değişip testin güncellenmemesinden:

| Test | Kırılma sebebi | Commit |
|---|---|---|
| `wizard-bonus-flow` | "sevkiyat verisi henüz kesinleşmedi" metni koddan kaldırıldı, test güncellenmedi | `8a48608` |
| `catalog-bonus-pdp` | Bonus PDP fiyatlı hâle geldi ama test "Teklif ile belirlenir" bekliyordu; ayrıca "Takım Fiyatını Gör" CTA'sı kaldırılmıştı | `277a876`, `7e27a73` |

`catalog-bonus-pdp` kendi içinde ÇELİŞİYORDU: hem "fiyat yok" hem "fiyat
370,03" bekliyordu. Her iki test de güncel sözleşmeye uyarlandı ve kaldırma
kararları artık `toHaveCount(0)` ile kilitli.

**Yan bulgu:** koşularda görünen `Catalog PDF quote save failed: { status: 503 }`
bir ortam sorunu DEĞİL — `critical-quote-flows` testi API hatasını bilerek
tetikliyor. Bu, önceki turlarda yanlış teşhise yol açmıştı.

`critical-quote-flows` bir koşuda düştü, tek başına 5/5 geçti — kararsızlık,
tam pakette tekrar geçti.

### Kanıt

| Kontrol | Sonuç |
|---|---|
| `npm run verify:fast` | **55 dosya / 532 test** + tsc temiz |
| `npx eslint` | 0/0 |
| `npx playwright test` | **31/31 geçti** |
| `npm run build` | başarılı |
| `copy-gate .next` | **457 HTML temiz** |
| Teklifler sayfa yüksekliği | 4.410px → **2.771px** |
| `verify-ofis-network.mjs` | AC-05 ✓ · AC-08 ✓ |

---

## 27 Temmuz 2026 · QuoteBuilder — yarı otomatik teklif ekranı

Sözleşme: `docs/verification/GOAL-quote-builder-2026-07-27.md`
Kaynak: 27 Temmuz canlı kullanımı (Mahmut Balcı teklifi, TE-2026-000140).

Ekran "manuel" kurgulanmıştı; gerçek iş yarı otomatikti. Kullanıcı kararı:
**"manuel demeyeyim de yarı otomatik"** — sistem doldurur, operatör ince
ayar yapar.

### Bulunan ve düzeltilen kusurlar

| # | Kusur | Kök neden | Kanıt |
|---|---|---|---|
| 1 | Toz grubu **yanlış ürün** seçiyordu (CHELFIX + 155 mm dübel) | `accessories` **sırasız** çekiliyordu; paket motoru her tipte İLK eşleşeni alır ve wizard `.order('id')` ile çeker (`WizardCalculator.tsx:521`) | `accessory-set-parity.test.ts` AC-01 |
| 2 | Marj kadranı fiyatı **1 kuruş kaydırıyordu** (145,11 → 145,12) | Maliyet satıra kuruşa yuvarlanmış yazılıyordu; marj yuvarlanmış sayının üstüne biniyordu | aynı dosyada regresyon testi |
| 3 | Toz grubu diyaloğunda **13 kart**, çoğu ayırt edilemez ("Dengeli Sistem" ×4) | Set içeriği yalnız aksesuar markasına bağlı; aynı markayı gösteren paket tanımları birebir aynı seti üretiyordu | marka başına tek kart → **5 kart** |
| 4 | Kart başlığı marka yerine paket adını gösteriyordu; kalem listesi ürün yerine **tip adını** ("Yapıştırıcı") | — | marka başlıkta, kalemde ürün adı |
| 5 | Aksesuar marjı **marka marjından** çözülüyordu | Wizard aksesuarda HER ZAMAN malzeme kademe kuralını kullanır; aynı ürün iki yoldan farklı fiyat verirdi | `catalog-items` malzeme kuralına çekildi |
| 6 | Ticari adla arama **hiç sonuç vermiyordu** ("teknoizofix") | Katalog etiketi marka + KISA ad ("TEKNO Yapıştırıcı"); ticari ad ("TEKNOİZOFİX") etikette geçmiyor | `CatalogItem.fullName` eklendi, arama onu da tarar |

### Eklenen yetenekler

- **Marj kadranı** — asıl kontrol artık marj. %5→%3 ile "%2 iskonto"nun aynı
  şey olmadığı (fiyatta %1,90) 27 Temmuz'da gerçek bir teklifte yanlış fiyat
  üretmişti.
- **Canlı göstergeler** — m² (KDV hariç/dahil), brüt kâr, site fiyatına göre
  fark, paket artığı. Son ikisi o gün elle hesaplanmıştı.
- **Toz grubu tek tık** — 7 satır elle yazmak yerine komple set.
- **Araç ↔ metraj** — "3 TIR" → 6.652,8 m². Kapasite levhaya bağlı
  (Bonus 4 cm 2.217,6 m², genel taşyünü 4 cm 1.872 m²).
- **Teklif çoğaltma** — sepet gelir, metraj değişince sarfiyata bağlı
  miktarlar yeniden hesaplanır (asıl iş buydu, o gün betikle yapıldı).
- **Satır içi arama** — yazdıkça, Türkçe klavye ve isim farkına dayanıklı.
- **Kayıt artık marjı saklıyor** (`package_items.manual.appliedMarginPct`) ve
  satır maliyet dayanağını taşıyor — "bu fiyatı neden verdik" cevaplanabilir.

`ManualQuoteEditor` → `QuoteBuilder` olarak yeniden adlandırıldı.

### Kanıt

| Kontrol | Sonuç |
|---|---|
| `npx vitest run` | **58 dosya / 574 test** geçti |
| `npx tsc --noEmit` | temiz |
| `npx eslint .` | 0/0 |
| `npm run build` | başarılı |
| `npx playwright test` | **36/36 geçti** (5 yeni spec dahil) |
| `copy-gate .next` | **457 HTML temiz** — marj/kâr sızıntısı yok |
| Canlı doğrulama (gerçek veri) | %3 marjda **145,11 · 159,96 · 1466,28 · 986,33 · 1265,93 · 935,03 · 201,18** — TY7002193 ile birebir |
| Paket artığı | canlı **2.337,85 ₺** = birim testin sayısı |
| Konsol | temiz |

Canlı doğrulama sırasında üretim veritabanına yazılan tek test teklifi
(`TE-2026-000141`) silindi; E2E specleri kayıt YAPMAZ.

### Kalan açık — KAPATILDI (aynı gün, kullanıcı onayıyla)

Bkz. bir sonraki kayıt.

---

## 27 Temmuz 2026 · Bonus maliyeti /ofis'e açıldı — yanlış okunan bir kural düzeltildi

### Ne olmuştu

`/ofis` katalog ucunda Bonus levhasının net alışı `netCost: 0` yazılıyordu ve
gerekçe olarak `tests/contracts/bonus-price-privacy.test.ts` gösteriliyordu.
Kullanıcı bunu sorguladı: *"kural benim kuralım koyan ben isem bu kuralı nasıl
bozamıyorum"*.

**Sorgu haklıydı. O sözleşme bunu yasaklamıyor.** Testin yaptığı tek şey,
`components/**` (müşteri tarayıcısına inen kod) altından Bonus fiyat
modüllerinin import edilmesini engellemek. `app/api/admin/catalog-items`
sunucu rotasıdır, `requireOfficeReadAuth` arkasındadır ve **diğer TÜM
markaların** net alışı oradan zaten /ofis'e iniyordu. Bonus'un sıfırlanması,
kuralın olduğundan geniş okunmasından doğan tutarsız bir fazladan kısıttı.

Bedeli: teklifin en büyük kalemi brüt kârdan düşüyor, marj kadranı o satıra
dokunamıyor, ekranda "1 satırın maliyeti bilinmiyor" uyarısı duruyordu.

### Yapılan

| Değişiklik | Dosya |
|---|---|
| `computeBonusUnitSale` net alışı da döndürüyor (`netCostPerM2`) | `lib/pricing/bonus/sale.ts` |
| Ofis kataloğu `netCost: 0` yerine gerçek maliyeti taşıyor | `app/api/admin/catalog-items/route.ts` |
| **Public rota açık beyaz listeye çevrildi** | `app/api/bonus-price/route.ts` |

### Alan eklerken yakalanan gerçek sızıntı riski

Public `/api/bonus-price` ucu `NextResponse.json(result)` ile **nesnenin
tamamını** döndürüyordu. `netCostPerM2` eklendiği anda net alış her müşterinin
tarayıcısına düşecekti — yani korunması gereken şey tam da buydu. Rota alan
alan yazan açık beyaz listeye çevrildi; artık yeni bir alan bilinçli
eklenmedikçe dışarı çıkamaz. Kilit: `bonus-price-privacy.test.ts` içinde
üç yeni test (`NextResponse.json(result)` yasak, `...result` yasak,
`netCostPerM2` yanıtta geçmez).

### Değiştirilen test — gerekçesi

`tests/contracts/catalog-items-bonus.test.ts` içindeki
`expect(bonusBlok).toContain('netCost: 0')` **yanlış kuralı kodluyordu**.
Gevşetilmedi; doğru sınırı kilitleyecek şekilde yeniden yazıldı:
ham fiyat modülleri (`getBonusBasePrice` / `bonus-region-prices`) hâlâ yasak,
fiyat yalnız `computeBonusUnitSale` üzerinden gelir, ve rota
`requireOfficeReadAuth` taşımak zorunda.

### 1 kuruşluk bulgu — cumartesiki teklifin fiyatı

Bonus levhası artık kadranla hareket ediyor: %5'te 322,48 → %3'te **316,33**.
Gönderilen TY7002193'te ise **316,34** yazıyor.

Sebep: o teklif üretilirken taban fiyat veritabanından okunmak yerine
yuvarlanmış satış fiyatından geri hesaplanmıştı
(`322,48 ÷ 1,05 = 307,1238` → `× 1,03 = 316,3375` → 316,34).
Sistemin kendi verisindeki taban **307,12** ve doğru sonuç **316,33**.
Fark m²'de 1 kuruş, 6.652,8 m²'de 66,53 ₺ (KDV hariç). Ekran artık geri
hesaplama yapmıyor, tabanı doğrudan okuyor.

### Kanıt

| Kontrol | Sonuç |
|---|---|
| `npx vitest run` | **578 test** geçti |
| `npx playwright test` | **36/36** |
| `npx tsc --noEmit` · `npx eslint .` | temiz · 0/0 |
| `npm run build` | başarılı |
| `copy-gate .next` | 457 HTML temiz |
| Public uç canlı yanıtı | `{ok,region,thicknessMm,salePricePerM2,packageM2,packagePieces,kamyonM2,tirM2}` — **net alış yok** |
| /ofis brüt kâr | 149.181,51 ₺ (%5) → 89.471,27 ₺ (%3); "eksik ölçüm" uyarısı **kalktı** |
| Site farkı | %3'te **−59.710,24 ₺** — 27 Tem'de elle hesaplanan 59.643,71 ₺ ile aynı büyüklük |

---

## 27 Temmuz 2026 · Okunabilirlik — sistemik kontrast onarımı ve kalıcı kapı

### Şikâyet

Kullanıcı hem `/ofis` panelinden hem ana sayfadan (dışarıda, gündüz,
telefondan) ekran görüntüleri gönderip **"OKUNMUYOR"** dedi. Haklıydı ve
daha önce de söylenmişti.

**Neden görülmedi:** o ana kadar 578 birim testi ve 36 E2E testi vardı;
hiçbiri bir yazının okunup okunmadığını sormuyordu. Boşluk buradaydı.

### Önce ölçüm, sonra düzeltme

`scripts/audit-contrast.mjs` yazıldı: WCAG kontrast oranını **ekrandaki
gerçek piksel** üzerinden ölçer. Kaynak dosyada sınıf aramak yetmez —
gerçek renk, devralınan renk, saydam katmanlar ve punto ancak tarayıcıda
birleşir.

Denetçinin kendisinde bulunan ve düzeltilen üç kör nokta:

| Kör nokta | Sonucu |
|---|---|
| Renkler `rgb()` sanılıyordu; Tailwind v4 **`lab()` / `oklab()`** üretiyor | Panelin bütün soluk etiketleri denetimden GÖRÜNMEZ geçiyordu. Renk çözümlemesi canvas'a devredildi — her CSS sözdizimini çözer. |
| Zemin `background-color` sanılıyordu; `.nx-shell` **gradient** | Açık renkli yazılar yanlışlıkla "okunmuyor" çıkıyordu |
| Devre dışı kontroller ve `sr-only` metin sayılıyordu | Yanlış alarm |

Placeholder'lar da ayrıca ölçülür (metin düğümü değiller, `::placeholder`
sözde öğesinden okunurlar) — formun en çok okunan yazısı oldukları hâlde
hiçbir denetimden geçmiyorlardı.

### Bulunan ve düzeltilen kusurlar

| Yer | Ölçülen | Kök neden | Düzeltme |
|---|---|---|---|
| **Footer başlıkları** (ÜRÜNLER, KURUMSAL…) | **1,03** — görünmez | `style={{ color: 'currentColor' }}` satır içi stil sınıf rengini eziyor, `currentColor` rengi ebeveyne eşitliyordu | satır içi stil kaldırıldı |
| Ön yüz ikincil metin | 3,65–3,95 | `--fe-muted: #6f6f78` | **#94949e** (~6,3) |
| Ön yüz saydamlık kırıntıları (`/55`, `/70`, `/80`) | 2,45–2,79 | soluk rengin üstüne ayrıca opaklık | tam güce çekildi |
| Panel etiketleri, tablo başlıkları | 3,59–3,98 | `text-slate-500` | `--nx-text-muted` (yükseltildi) |
| Panel ipucu metni | 2,50 | `text-slate-600` | aynı jetona çekildi |
| Panel jetonu | 4,01 | `--nx-text-muted: #6e7582` | **#9096a2** |
| Açık zeminli sayfalarda altın | 3,51 | `--hub-gold: #a07a2c` | **#7d5d20** (ton ailesi korundu) |
| `btn-ghost` / `btn-secondary` | 2,49 | açık zeminde `--hub-gold-soft` | `--hub-gold` |
| Katalog CTA | 3,95 | altın zeminde beyaz yazı | koyu yazı (7,4) |
| `/iletisim` etiketleri | 4,44 | `text-hub-ink-2/65` | tam güç |

Düzeltmeler **jeton seviyesinde** yapıldı; 159 kullanım tek tek yamanmadı.

### Kalıcı kapı

- `npm run verify:contrast` eklendi
- `scripts/verify-p0-release.sh` içine **9/9 adımı** olarak bağlandı
- Kapsam: `/`, `/urunler`, `/urunler/tasyunu-levha`, `/iletisim`,
  `/hakkimizda`, `/ofis`, `/ofis › Yeni Teklif`
- Her hedef kendi gerçek genişliğinde ölçülür (ön yüz 390px mobil, panel masaüstü)

### Kanıt

| Kontrol | Önce | Sonra |
|---|---|---|
| `verify:contrast` (7 sayfa) | **104 düğüm AA altı** | **0 — hepsi geçti** |
| `npx vitest run` | 578 | **578 geçti** |
| `npx playwright test` | 36/36 | **36/36** |
| `tsc` · `eslint` · `build` | — | temiz · 0/0 · başarılı |
| `copy-gate .next` | — | 457 HTML temiz |

Ekran görüntüsüyle doğrulandı: panel etiketleri ve footer başlıkları artık
okunuyor.

---

## 29 Temmuz 2026 · EPS/taşyünü karışması — gerçek teklifte 14.229,93 ₺ hata

### Olay

Operatör aynı gün iki teklif çıkardı (Muammer Erdal, 300 m², 8 cm):

| Teklif | Ürün | `material_type` | Sonuç |
|---|---|---|---|
| TE-2026-000142 | Dalmaçyalı İdeal Carbon (EPS) | `eps` | **doğru** |
| TE-2026-000143 | Optimix Karbonlu (EPS) | **`karma`** | **hatalı** |

Operatör "Optimix'te torba miktarı Dalmaçyalı'ya göre çok fazla geldi" diye
sordu. Haklıydı.

### Kök neden

`QuoteBuilder.tsx` içinde toz grubunun malzemesi şöyle çözülüyordu:

```
const tozMalzeme = materialType === "eps" ? "eps" : "tasyunu"
```

Malzeme kutusu varsayılan **"Karma"**da kalınca EPS levha **sessizce taşyünü**
sayıldı. Sonuçları:

| Kalem | Uygulanan | Doğrusu |
|---|---|---|
| Yapıştırıcı | 6 kg/m² → **72 PKT** | 4 kg/m² → **48 PKT** |
| Sıva | 6 kg/m² → **72 PKT** | 4 kg/m² → **48 PKT** |
| Dübel | **Taşyünü Çelik Çivili 11,5cm**, 9 kutu | **Plastik Dübel 9,5cm**, 3 kutu |

Gönderilen: 144.680,10 ₺ (KDV hariç) · Doğrusu: **130.450,17 ₺**
→ **14.229,93 ₺ fazla**, m² 482,27 yerine **434,83**.

### Düzeltme

- Toz grubunun malzemesi artık **seçilen levhadan** türetiliyor
  (`plateMaterialSlug`); levha seçilince Malzeme kutusu da onunla hizalanıyor.
- Malzeme çözülemeden toz grubu sorgusu **çalışmıyor** ve buton kapalı
  (fail-closed) — "karma" bir daha sessizce taşyünü sayılamaz.
- Buton başlığı sebebini yazıyor; yardım metni hangi sarfiyatın uygulandığını
  söylüyor ("EPS sarfiyatı" / "taşyünü sarfiyatı").

### Nakliye hariç seçeneği

Operatör nakliye hariç teklif vermek istedi, veremedi: belge nakliye tutarı
sıfırsa otomatik "DAHİL" yazıyordu. Artık açık seçim var
(`shippingMode`: fiyata dahil / alıcıya ait / görüşmede netleşir) ve PDF'e
doğru yansıyor. Nakliye ayrı kalem olarak eklendiyse "dahil" denemez — bu
kural korundu.

### EPS minimum sipariş

`material_types.eps.min_order_m2` **370 → 250** (kullanıcı kararı).
Panelden de düzenlenebilir: Fiyatlandırma › Marj Kuralları.

### Kanıt

| Kontrol | Sonuç |
|---|---|
| `npx vitest run` | **59 dosya / 586 test** geçti (8 yeni regresyon testi) |
| `npx playwright test` | 36/36 |
| `tsc` · `eslint` · `build` · `copy-gate` | temiz · 0/0 · başarılı · 457 HTML |
| Canlı doğrulama | Optimix Karbonlu seçilince malzeme `eps`'e geçti; set **48 · 48 · 3 kutu plastik dübel** üretti |

---

## 1 Eylül 2026 · Levha PDP mobil karar sırası ve Filli marka hiyerarşisi

- Mobil fiyat paneli beş temsilci üründe 801–840 px başlangıcına çekildi.
- Masaüstü ana PDF teklif alanı 1440×1000 görünümünde 794 px'de biter ve
  alternatif ürün kartından önce gelir.
- Sticky teklif özeti başlangıçta render edilmez; ana CTA geçildikten sonra
  görünür ve footer görünürken kapanır.
- Expert ve Optimix, ortak Fawori logosunun yanında görünür alt marka adıyla
  ayrıldı; grup metni dilbilgisel olarak “Filli Boya ürün grubudur” oldu.
- Test guard'ın işaretlediği eski `Filli Boya ürün grubu` assertion'ı davranışı
  gevşetmek için kaldırılmadı. AC-PDP-005'in yeni ve daha kesin metniyle
  değiştirildi; aynı test ayrıca görünür Expert/Optimix alt marka adını doğrular.
- Kabul sözleşmesi: `PLAN-pdp-ui-ux-fixes-2026-09-01.md`.

### Son kanıt

| Kontrol | Sonuç |
|---|---|
| Hedefli Playwright | 13/13 geçti |
| Kontrast | 4 temsilci rota AA geçti |
| Browser audit | 5 rota × 2 viewport; axe 0, console 0, overflow 0, kırık görsel 0 |
| Tam Playwright paketi | **79/79 geçti** (`workers=1`, 60 sn yükleme toleransı) |
| Kritik teklif ve modal | 7/7 kritik teklif; 2/2 klavye/odak testi geçti |
| `verify:full` | **77 dosya / 680 test**, TypeScript, ESLint ve üretim build'i geçti |
| Kabul ve ziyaretçi metni | `verify:acceptance` ve `verify:visitor-copy` geçti |

---

## 1 Eylül 2026 · Levha PDP A+B ticari hiyerarşi

- B seçeneğinin sıcak ticari ürün/fiyat bandı, A seçeneğinin iki sütunlu ürün
  ve teklif mimarisiyle birleştirildi; C seçeneğindeki 1-2-3 wizard dili
  kullanılmadı.
- m² fiyatı, araç kapasitesi ve araç toplamı satış kararına uygun biçimde
  büyütüldü. Kamyon ve TIR için oranları belirgin, arayüze özgü SVG silüetleri
  çizildi.
- Araç kartları masaüstünde yan yana, mobilde alt alta; 320 px dahil eşit
  yükseklikte ve taşmasız çalışıyor. Kartın erişilebilir adı gerçek artırma /
  azaltma davranışıyla eşleştirildi.
- Üst aksiyon “Teslimat fiyatını hesapla”, final aksiyon “Teklifimi hazırla”
  olarak ayrıldı; PDF çıktı formatı ana CTA vaadinden çıkarıldı.
- Korunan kritik E2E dosyasında yalnız ziyaretçi etiketi değişti; teklif modalı,
  payload, idempotency ve fail-closed kabul davranışı değişmedi. Kabul kilidi
  gerekçesi ve hash'i görünür biçimde güncellendi.

### Son kanıt

| Kontrol | Sonuç |
|---|---|
| `verify:full` | 77 dosya / 680 test; TypeScript, ESLint ve production build geçti |
| Kabul / metin | `verify:acceptance` ve `verify:visitor-copy` geçti |
| Tam Playwright | Tek işçiyle **79/79 geçti** |
| Görsel ölçüm | 1440, 390 ve 320 px'te yatay taşma 0; araç kartı çiftleri eşit yükseklikte |
| Erişilebilirlik | 5 temsilci rota × 2 viewport axe A/AA ihlali 0; console error 0 |
