# Goal Sözleşmesi — QuoteBuilder (yarı otomatik teklif ekranı)

**Tarih:** 27 Temmuz 2026 · **Risk:** R3 (fiyat / teklif / gelir)
**Kaynak:** 27 Temmuz canlı kullanım — Mahmut Balcı teklifi (TE-2026-000140)

---

## 0. Neden

Ekran "manuel" kurgulanmıştı: boş sayfa, operatör doldurur. Gerçek iş bunun
tersi çıktı. Canlı bir teklif çıkarırken şunlar görüldü:

| Gözlem | Kanıt |
|---|---|
| Operatör **marjla** düşünüyor, ekran **iskonto** soruyor | "%2 iskonto yap deyip marjı 5'ten 3'e düşürmek ile aynı şey sandım" — ikisi aynı değil (%5→%3 = fiyatta %1,90) |
| Asıl iş "sıfırdan yaz" değil, **"kopyala, metrajı değiştir"** | 7002 m² teklifi 6652,8 m²'ye çevirmek gerekti; elle betikle yapıldı |
| Metraj birimi **araç**, m² değil | "3 TIR" deniyor, 6.652,8 elle hesaplanıyor |
| Toz grubu 8 satır elle giriliyor | Sitenin kuruluş amacı bu zahmeti kaldırmaktı |
| **Kâr ve indirim görünmüyor** | "Site fiyatından ne kadar indirim yaptık?" sorusu ancak sonradan, elle hesapla cevaplandı (59.643,71 ₺ / %1,90) |
| **Paket artığı görünmüyor** | 7002 m²'de 4.869 ₺, 6.652,8'de 2.337 ₺ — görünse metraj optimize edilebilirdi |
| Teklif hangi marjla üretildiğini saklamıyor | Cumartesiki fiyatın %3 marj olduğu tersine mühendislikle bulundu |

**Yeni kurgu: yarı otomatik.** Sistem doldurur, operatör ince ayar yapar.
Elle yazmak istisna, varsayılan değil.

---

## 1. Outcome — bittiğinde ne doğru olacak?

1. **Marj kadranı var.** Operatör marjı çevirir, tüm satır fiyatları anlık
   yeniden hesaplanır. İskonto ayrı bir kavram olarak da durur ama ana kadran marjdır.
2. **Canlı göstergeler** kaydetmeden görünür: m² fiyatı (KDV hariç/dahil),
   uygulanan marj, brüt kâr, site fiyatına göre fark (₺ ve %), paket artığı (₺).
3. **Toz grubu tek tıkla** eklenir ve wizard'ın ürettiği setle **birebir aynıdır**.
4. **Araç ↔ m²** dönüşümü çalışır: "3 TIR" girilince metraj hesaplanır.
5. **Teklif çoğaltılabilir:** var olan teklif açılır, metraj değiştirilir,
   sarfiyata bağlı miktarlar kendiliğinden yeniden hesaplanır.
6. **Kayıt, hangi marjla üretildiğini saklar** — "bu fiyatı neden verdik" cevaplanabilir.
7. Müşteriye giden hiçbir yüzeyde marj/kâr/maliyet görünmez.
8. Mevcut testler bozulmaz; `verify:release` yeşil.

---

## 2. Verification surface

| Katman | Komut | Neyi ispatlar |
|---|---|---|
| Birim | `npx vitest run tests/pricing tests/quote` | Marj→fiyat, paket artığı, araç→m², set kurma |
| **Parite** | `npx vitest run tests/contracts/wizard-parity.test.ts` | Set kurucu wizard ile birebir aynı ürün ve miktarı seçiyor |
| Rota | `npx vitest run tests/api tests/security` | Yetki, toplam doğrulaması, sızıntı yok |
| E2E | `npx playwright test tests/e2e/ofis-quote-builder.spec.ts` | Uçtan uca: set ekle → marj çevir → kaydet → PDF |
| Gizlilik | `node ~/.claude/tools/copy-gate.mjs .next` | Marj/kâr müşteri yüzeyinde yok |
| Tam | `npm run verify:full` + `npx playwright test` | Regresyon yok |

**Altın kanıt (AC-01):** Set kurucu, TY7002193 teklifinin 8 kalemini
(TEKNOİZOFİX, TEKNOİZOSIVA, **Çelik Çivili Dübel 115 mm**, FİLE 4X4,
FİLELİ PVC KÖŞE, TEKNOLATEX 400, TEKNODEKO İNCE) doğru miktar ve fiyatla
üretmeli. Bugünkü ilk deneme **yanlış ürün** seçti (CHELFIX ve **155 mm** dübel)
— bu düzelmeden hiçbir şey teslim edilmez.

---

## 3. Constraints — neler bozulmayacak?

- **Wizard fiyat motoruna dokunulmaz.** `components/wizard/**` ve
  `lib/pricing/**` davranışı değişmez; `tests/pricing/*` aynen geçer.
- **`submit_quote_guarded` (v17) değişmez.** Public ciro yolu aynen kalır.
- **KDV tek kaynak:** `buildQuoteTotals` (%20).
- **İskonto birim fiyatlara işlenir**, belgeye ayrı eksi satır yazılmaz
  (27 Tem kararı).
- **Marj/kâr/maliyet müşteri yüzeyine çıkmaz** — copy-gate kapısı.
- `lib/pdfGenerator.ts` hero kutusuna dokunulmaz (`pdf-screen-consistency`).
- Korunan testler silinmez, `skip`/`only` yapılmaz.

---

## 4. Boundaries

**Serbest:** `app/ofis/tabs/quotes/**` · `components/admin/quote-editor/**` ·
`app/api/admin/{catalog-items,accessory-sets,quotes/manual}/**` ·
`lib/quote/**` · `lib/schemas/manualQuote.schema.ts` · `app/globals.css`
(yalnız `nx-*`) · `tests/**`

**Yasak:** `components/wizard/**` · `lib/pricing/**` (mevcut fonksiyon
davranışı) · `scripts/migration-v17-*` · `app/api/quotes/route.ts` ·
müşteriye görünen `app/` rotaları

**Veri:** üretim veritabanına yazma yok (migration yok — bu iş şema
değişikliği gerektirmiyor).

---

## 5. Fazlar

### F1 — Motor doğruluğu (görünmez ama şart)
Set kurucu wizard ile birebir aynı ürünü seçmeli.
- Kök neden: `accessories` sorgusu **sırasız** çekiliyor; wizard `id` sırasına
  güveniyor. Ayrıca dübel seçimi kalınlığa bağlı olabilir — doğrulanacak.
- **Kanıt:** `tests/contracts/wizard-parity.test.ts` — TY7002193'ün 8 kalemi
  birebir (ürün adı + miktar + birim fiyat).

### F2 — Marj kadranı ve göstergeler
- `netCost` üzerinden marj çevrimi (katalog ucu zaten `netCost` döndürüyor)
- Göstergeler: m² (KDV hariç/dahil) · marj % · brüt kâr ₺ · site farkı ₺/% ·
  paket artığı ₺
- **Kanıt:** birim testler + E2E'de marj değişince toplamın değişmesi

### F3 — Yarı otomatik akış
- Araç ↔ m² (logistics_capacity)
- Toz grubu tek tık (F1'in üstüne)
- Satır içi ürün arama (yazdıkça)
- **Kanıt:** `ofis-quote-builder.spec.ts`

### F4 — Teklif çoğaltma
- Var olan tekliften aç, metraj değiştir, miktarlar yeniden hesaplansın
- **Kanıt:** E2E — TE-2026-000140'ı çoğalt, metrajı 7002 yap, miktarlar
  1597→1681 olsun

### F5 — Görsel + release
- Gösterge paneli tasarımı, mobil, erişilebilirlik
- **Kanıt:** `verify:full` + playwright + copy-gate + ekran görüntüsü

---

## 6. Iteration policy

1. Kök nedeni oku, çıktıyı `PROGRESS.md`'ye yaz.
2. Tek odaklı değişiklik → hedefli test.
3. **Her adımda tam paket koşma** (27 Tem kullanıcı kararı); faz sonunda toplu doğrula.
4. Aynı hatada iki tur ilerleme yoksa dur, engeli kanıtla bildir.

---

## 7. Blocked stop

- Wizard'ın ürün seçim kuralı koddan çıkarılamazsa (F1 kanıtı sağlanamazsa) —
  yanlış ürünle teklif üretmektense dur.
- `lib/pricing/**` davranışını değiştirmek gerekirse.
- Şema değişikliği gerekirse (bu iş için gerekmemeli).

---

## 8. Bitiş kapısı

- [x] AC-01: set kurucu TY7002193'ün kalemlerini birebir üretiyor (birim test + canlı)
- [x] Marj kadranı çalışıyor, göstergeler doğru (paket artığı canlıda 2.337,85 ₺)
- [x] Araç→m², toz grubu tek tık, teklif çoğaltma çalışıyor
- [x] 574 birim test · tsc temiz · eslint 0/0 · build başarılı
- [x] `npx playwright test` — 36/36
- [x] `copy-gate` temiz — 457 HTML, marj/kâr sızıntısı yok
- [x] Ekran görüntüsüyle görsel teslim

**Kalan açık (kapatılmadı, gizlendi de değil):** Bonus levhasının maliyeti
`bonus-price-privacy` sözleşmesi gereği tarayıcıya inmiyor; marj kadranı o
satırı değiştirmez ve brüt kâr yalnız toz kalemlerini ölçer. Ekran bunu
"1 satırın maliyeti bilinmiyor — eksik ölçüm" diye yazıyor. Kapatmak ayrı
bir gizlilik kararı gerektirir. Ayrıntı: `PROGRESS.md`, 27 Temmuz kaydı.
