# Goal Sözleşmesi — Elle Teklif Yazma + Müşteri Takibi + /ofis Onarımı

**Tarih:** 27 Temmuz 2026
**Kaynak audit:** `docs/verification/OFIS-AUDIT-2026-07-26.md`
**Önceki sözleşme:** `docs/verification/GOAL-ofis-2026-07-26.md` (F0 olarak bu belgeye devrildi)

---

## 0. Onaylanmış kararlar

| Konu | Karar |
|---|---|
| Teklif ekranı MVP | Boş satır editörü — wizard fiyat motoruna **dokunulmaz** |
| CRM yeri | `/ofis` içinde müşteri varlığı (`customers` + `customer_interactions`) |
| Sıralama | Önce F0 (audit Faz 1), sonra Hat A ve Hat B paralel |
| alcifiyatlari | Şimdilik kapsam dışı; `business_unit` kolonuyla ileride çıkarılabilir |

---

## 1. Outcome — bittiğinde ne doğru olacak?

1. `/ofis`'te **hiçbir mutasyon sessizce başarısız olmuyor**; `patron` salt-okunur
   hesabı değiştiremeyeceği hiçbir kontrolü görmüyor.
2. Operatör `/ofis` içinde **sıfırdan teklif yazabiliyor**: katalogdan ürün
   seçerek veya serbest satır girerek, istediği iskontoyu uygulayarak, istediği
   toz grubunu seçerek; satırlar canlı hesaplanıyor.
3. Yazılan teklif **kaydediliyor, PDF üretiyor, WhatsApp mesajı çıkarıyor** — PDF
   wizard ile aynı şablondan geliyor ve özel (private) depoya yükleniyor.
4. Aynı teklifin **iskonto senaryoları** (%3 / %4 gibi) revizyon olarak
   üretilebiliyor.
5. **Müşteri diye bir varlık var**: aynı kişinin bütün teklifleri ve
   görüşmeleri tek ekranda, tarih sıralı görünüyor.
6. **Telefonla gelip teklife dönüşmeyen talep kayda giriyor** — teklif
   oluşturmadan görüşme kaydedilebiliyor.
7. Vadesi gelen takipler için **işletmeye hatırlatma** gidiyor (CallMeBot).
8. `/ofis` **375px'te kullanılabilir**; müşteri ve teklif listeleri sayfalı;
   `/api/admin/quotes` bir oturumda en çok 2 kez çağrılıyor.
9. Mevcut **377 test bozulmadan** geçiyor, `tsc --noEmit` 0 hata,
   `npm run test:db:quote-guard` yeşil (v17 bozulmadı).

---

## 2. Verification surface

| Katman | Komut | Neyi ispatlar |
|---|---|---|
| Hızlı | `npm run verify:fast` | Regresyon yok (377 test + tsc) |
| Tam | `npm run verify:full` | + lint + build |
| Yayın | `npm run verify:release` | Bütünsel kapı |
| DB guard | `npm run test:db:quote-guard` | Her migration sonrası v17 bozulmadı |
| Rol | `npx playwright test tests/e2e/ofis-patron-readonly.spec.ts` | Outcome 1 |
| Düzen | `npx playwright test tests/e2e/ofis-responsive.spec.ts` | Outcome 8 |
| Elle teklif | `npx playwright test tests/e2e/ofis-manual-quote.spec.ts` | Outcome 2, 3 |
| CRM | `npx playwright test tests/e2e/ofis-crm.spec.ts` | Outcome 5, 6 |
| Ağ sayımı | `node scripts/verify-ofis-network.mjs` | Outcome 8 (≤2 çağrı) |

---

## 3. Constraints — neler bozulmayacak?

- **`submit_quote_guarded` (v17) hiç değiştirilmeyecek.** Elle teklif ayrı RPC
  (`create_manual_quote`) kullanır. Wizard/katalog ciro yolu aynen kalır.
- **`quotes`'a asla `NOT NULL` + DEFAULT'suz kolon eklenmeyecek** — RPC açık
  kolon listesiyle INSERT ediyor; bu kural bozulursa ciro yolu düşer.
- **Wizard'ın fiyat motoruna dokunulmayacak.** `WizardCalculator.tsx` içindeki
  hesap çekirdeği bu işin kapsamı dışında; `tests/pricing/*` aynen geçmeli.
- **`lib/pdfGenerator.ts`'e MVP'de dokunulmayacak.** Şablon değişikliği (A5) ancak
  `tests/contracts/pdf-screen-consistency.test.ts` **aynı commit'te** güncellenerek
  yapılır.
- **KVKK'da sahte rıza yazılmayacak.** Elle teklifte `kvkk_consent=false`,
  `consent_basis='sozlesme_hazirligi'`.
- **Kâr marjı / maliyet müşteriye görünen hiçbir yüzeye çıkmayacak.** Ham
  `base_price`/`discount_*` tarayıcıya inmez; `copy-gate` ve
  `bonus-price-privacy` çizgisi korunur.
- **Rol ayrımı gevşetilmeyecek.** Arayüzde kontrol gizlemek sunucu kapısının
  yerine geçmez; her mutasyonda `requireAdminMutationAuth` kalır.
- Korunan kabul testleri silinmeyecek, `skip`/`only` yapılmayacak, gevşetilmeyecek.

---

## 4. Boundaries

**Serbest:** `app/ofis/**` · `components/admin/**` · `app/api/admin/**` ·
`app/api/cron/follow-ups/**` · `lib/admin/**` · `lib/hooks/**` ·
`lib/schemas/manualQuote.schema.ts` (yeni) · `lib/quote/**` (yeni) ·
`app/globals.css` (yalnız `nx-*` blokları) · `scripts/migration-v24..v26*.sql` (yeni) ·
`tests/**` (yeni specler + genişletmeler) · `app/api/upload-pdf/route.ts` (yalnız
`request_type` kapısı) · `lib/notifications.ts` (yalnız katkısal event tipi) ·
`lib/utils/whatsapp.ts` (yalnız katkısal `buildWhatsAppLinkTo`)

**Yasak:** `scripts/migration-v17-quote-submission-guard.sql` · `app/api/quotes/route.ts`
(elle yol dışı davranış) · `components/wizard/**` · `lib/pricing/**` mevcut
fonksiyonların davranışı · `lib/pdfGenerator.ts` (A5 hariç) · müşteriye görünen
`app/` rotaları · mevcut migration dosyalarının düzenlenmesi

**Veri:** üretim veritabanına migration uygulanması **ayrı onaya bağlı**.
Migration dosyaları yazılır, önce salt-okunur ön-kontrol sorgusuyla doğrulanır.

---

## 5. Fazlar ve bitiş kanıtları

### F0 — Önkoşul: rol ayrımı + sessiz hatalar

| Adım | İş |
|---|---|
| 0.1 | `/api/admin/me` → `{ user, role: 'admin' \| 'patron' }` |
| 0.2 | `lib/admin/useAdminRole.ts` — rolü tek yerden okuyan hook |
| 0.3 | Patron rolünde mutasyon kontrolleri gizli/devre dışı + "salt okunur" rozeti |
| 0.4 | `QuotesTab` üç mutasyonunun `else` dalına görünür hata bildirimi |
| 0.5 | `tests/security/admin-routes-auth.test.ts` genişletmesi |

**Kanıt:** `tests/e2e/ofis-patron-readonly.spec.ts` yeşil + `verify:fast`

### F1 — Ortak temel

| Adım | İş |
|---|---|
| 1.1 | `scripts/migration-v24-musteri-varligi.sql` — `customers`, `customer_interactions`, `quotes` NULL kolonları, `normalize_phone_tr()`, RLS (service-role only) |
| 1.2 | Backfill: mevcut quotes → customers; dolu `admin_notes` → interaction |
| 1.3 | `trg_quotes_link_customer` — `EXCEPTION WHEN OTHERS` ile sarılı (CRM eksikliği ciro yolunu düşürmez) |
| 1.4 | `GET/POST /api/admin/customers` |
| 1.5 | **Audit 2.1** — AdminShell mobil çekmece (`<1024px`), `marginLeft` sınıfa taşınır |

**Kanıt:** `tests/db/customers-rls.test.ts` (anon erişemez) ·
`tests/pricing/phone-normalize-parity.test.ts` (SQL fn ↔ `normalizePhoneForGuard`, 30 fixture) ·
`tests/db/customer-link-trigger.test.ts` (bozuk telefonda quote yine yazılır) ·
`tests/e2e/ofis-responsive.spec.ts` · `npm run test:db:quote-guard`

### Hat A — Teklif yazma (F1 sonrası, Hat B ile paralel)

| Adım | İş | Kanıt |
|---|---|---|
| A1 | v25: `quote_items`, `quote_revisions`, `create_manual_quote` RPC + backfill | `tests/db/manual-quote-rpc.test.ts` |
| A2 | `manualQuoteSchema` + `POST /api/admin/quotes/manual` + `warnings`/override · `upload-pdf` `request_type` kapısı | `tests/api/manual-quote-route.test.ts` |
| A3 | `ManualQuoteEditor` + satır tablosu + `GET /api/admin/catalog-items` · QuotesTab çatı sekmeye dönüşür + sayfalanır | `tests/e2e/ofis-manual-quote.spec.ts` |
| A4 | PDF + WhatsApp akışı + `pdf-client-coverage.test.ts` meta-testi | `vitest run tests/contracts` yeşil |
| A5 | İskonto senaryoları/revizyonlar + PDF'te ayrı iskonto satırı | `tests/pricing/quote-revisions.test.ts` + consistency testi aynı commit'te güncel |
| A6 | v26 kısmi unique index (`source_channel='ofis'`) + yinelenen kod raporu | ön-kontrol 0 çakışma · `verify:release` |

### Hat B — CRM

| Adım | İş | Kanıt |
|---|---|---|
| B1 | interactions API + `admin_notes` migrasyonu | `tests/api/customer-interactions.test.ts` |
| B2 | `CustomersTab` (sayfalı) + `useAdminCustomers`/`useAdminQuotes` react-query — **audit Faz 3 retrofit'i** | ağ sayımı 7 → ≤2 |
| B3 | Müşteri detayı + birleşik zaman çizelgesi (`groupQuotesIntoSeries` yeniden kullanımı) | `tests/e2e/ofis-crm.spec.ts` |
| B4 | "Görüşme kaydet" + "Teklife dönüştür" (A3'e bağlanır) | aynı spec |
| B5 | Hatırlatma cron + CallMeBot `follow_up_due` | `tests/api/follow-ups-cron.test.ts` |

---

## 6. Iteration policy

1. Başarısızlığın kök nedenini oku, çıktıyı olduğu gibi `PROGRESS.md`'ye kaydet.
2. Hipotez → tek odaklı değişiklik → hedefli test → `verify:fast`.
3. Faz sonunda `verify:full`; hat sonunda `verify:release`.
4. Aynı hatada iki tur ilerleme yoksa dur, engeli kanıtla bildir.
5. Test yanlış çıkarsa sessizce değiştirme: gerekçe + kanıt + etkilenen kabul
   kriteri yazılmadan kilit güncellenmez.

---

## 7. Blocked stop — hangi durumda durulur

- Migration'ın **üretime uygulanması** gerektiğinde (ayrı onay).
- `submit_quote_guarded` veya wizard fiyat motoruna dokunmak gerekirse.
- Bir düzeltme `lib/pricing/**` davranışını değiştirmeyi gerektiriyorsa.
- İki tur üst üste aynı testte ilerleme yoksa.

---

## 8. Bilinen riskler

| # | Risk | Karşı önlem |
|---|---|---|
| R1 | Sözleşme testleri metin tabanlı, yeni ekranı otomatik kapsamaz | `pdf-client-coverage.test.ts` meta-testi: `generateQuotePDF` import eden her dosya `private-pdf-client` listesinde olmalı |
| R2 | `quotes`'a yanlış kolon eklemek RPC'yi kırar | Yalnız NULL/DEFAULT'lu kolon; her migration sonrası `test:db:quote-guard` |
| R3 | KVKK saklama borcu büyür | `retention_until` kolonu baştan var ama **boş bırakılır**; silme/anonimleştirme işi bilinçli olarak ertelendi (27 Tem 2026 kullanıcı kararı) — engelleyici kapı değil, açık borç |
| R4 | `package_items` JSONB kaldırılamaz (NOT NULL + RPC required) | Çift yazım: `quote_items` gerçek kaynak, JSONB türetilir; parite testi |
| R5 | `quote_code` unique index ciro yolunu düşürebilir | Tam unique değil, `source_channel='ofis'` kısmi index |
| R6 | `upload-pdf` `request_type` kapısı atlanırsa PDF sessizce 403 | A2 kabul kriterine yazılı |
| R7 | Müşteri bağlama trigger'ı public yolu düşürebilir | `EXCEPTION WHEN OTHERS` + `customer_link_status='failed'` + rapor |
| R8 | Elle teklifler analiz hunisini şişirir | `source_channel <> 'ofis'` filtresi + ayrı "Ofis üretimi" bloğu |

---

## 9. Ertelenen belirsizlikler (audit'ten devir)

- **Katalog sekmesi (19.222px)** — satır satır doğrulanmadı.
- **Excel içe aktarma akışı** — üretim fiyat verisini değiştireceği için uçtan
  uca denenmedi; ayrı staging koşusu gerekiyor.
