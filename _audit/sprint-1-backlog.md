# Sprint 1 — Backlog

**Hazırlık tarihi:** 2026-05-11 (Sprint 0 / Faz 4 sırasında oluşturuldu)

> Bu dosya Sprint 0 sırasında yan yola düşen ama Sprint 0 kapsamı dışındaki teknik
> borçları toplar. Sprint 1 planlamada bu liste önceliklendirilip işe dönüştürülecek.

---

## 1. TypeScript Strict Cleanup

Sprint 0 / Faz 4 build doğrulamasında ortaya çıkan pre-existing TS hataları, en hızlı
yolla cerrahi cast'lerle düzeltildi (`Number()`, `?? ""`). Bu **quick fix**, kalıcı doğru
fix değil — Sprint 1'de bu cast'ler kaldırılıp tip tutarlılığı temin edilmelidir.

### 1.1 Supabase generated types tutarlılığı

[app/ofis/tabs/QuotesTab.tsx](app/ofis/tabs/QuotesTab.tsx)'de 5 quick-fix uygulandı:

| Satır | Quick fix (Sprint 0) | Kalıcı fix önerisi (Sprint 1) |
|---|---|---|
| 541 | `Number(quote.id)` | Supabase generated types'tan gelen `bigint → string` yerine `quote.id: number` interface (`useState<Quote[]>` tipini düzelt; muhtemelen `Quote` arayüzünde `id: number` set edilmemiş ve API response `string` dönüyor) |
| 551 | `Number(quote.id)` | aynı |
| 574 | `Number(quote.id)` | aynı |
| 647 | `selectedQuote.request_type ?? ""` | `request_type` enum tipinde olmalı (`'pdf_quote' \| 'whatsapp_order'`); null değil. Default value DB'de `NOT NULL DEFAULT 'whatsapp_order'` (DB schema doğrulandı, query'den dönen değer optional). API tip tanımını düzelt. |
| 680 | `event.event_type ?? ""` | `event_type` aynı şekilde non-null enum olmalı |

**Kök sebep:** Supabase MCP'den dönen tipler ya da elle yazılmış `Quote` arayüzü
DB schema ile senkronize değil. `mcp__supabase__generate_typescript_types` aracını
kullanıp `lib/types/database.types.ts` üretilebilir, ardından bu type'lar import edilir.

### 1.2 Tüm projeyi `tsc --noEmit` ile tara

Sprint 0'da yalnızca QuotesTab hataları çıktı. Sprint 1'de `strict` modu açılıp
(tsconfig.json) tüm dosyalarda tarama yapılmalı. Bulunan hatalar Sprint 1 backlog'a
eklenir.

### 1.3 `tsconfig.json` strict mode kontrolü

Mevcut `tsconfig.json` `strict: true` mi `strict: false` mı? Sprint 1 başlangıcında
denetlenmeli; `false` ise aşamalı `strict: true`'ya geçiş planlanmalı.

---

## 2. NAP (Name-Address-Phone) Tutarlılığı — Schema Entity Füzyonu

Audit raporu (`_audit/seo-baseline-2026-05.md`) §1 — **Acil Müdahale, madde 1** olarak
işaretlendi. Sprint 0'da fiziksel olarak yapılmadı çünkü Sprint 0 yangın söndürme
sprint'iydi (KVKK + güvenlik + doorway).

### Mevcut durum

Üç farklı adres formatı:
- [app/page.tsx:57](app/page.tsx#L57): `Mescit Mah. Ulugüney Sk. Harman Plaza Blok K2 No:15`
- [lib/seo/buildLocalBusiness.ts:41](lib/seo/buildLocalBusiness.ts#L41): `Orhanlı Mescit Mh. Demokrasi Cd. No:5`
- [app/depomuz/page.tsx:30](app/depomuz/page.tsx#L30), [app/iletisim/page.tsx:30](app/iletisim/page.tsx#L30): `Orhanlı Mescit Mh. Demokrasi Cd. No:5`
- [app/kullanim-kosullari/page.tsx:11](app/kullanim-kosullari/page.tsx#L11) (Sprint 0 / Faz 3): `Mescit Mah. Ulugüney Sk. Harman Plaza A1 Blok K2 No:15` (sprint plan'ın yazdırdığı adres = ana sayfa Org schema'sıyla uyumlu)

**Karar gerekiyor:** Hangi adres ofis, hangisi depo? Google Business Profile + Knowledge
Graph senkronize olabilmesi için bu cevap netleşmeli.

### Önerilen Sprint 1 işleyişi

1. **Karar:** Ofis adresi A1, depo adresi B mi? İkisi de aynı mı?
2. `lib/business/info.ts` (yeni dosya) — tek canonical `BUSINESS_INFO` ve `WAREHOUSE_INFO` sözlüğü
3. Tüm hardcoded adres referansları (telefon ve e-mail dahil) bu sözlükten çekilsin
4. `lib/seo/buildBusinessNode.ts` — `@graph` ile canonical `LocalBusiness` entity'si
5. Tüm publisher/provider/seller alanlarda `BUSINESS_REF` pointer kullan
6. Audit raporundaki "30 Gün İçinde" madde 8 ile birleştirilir

---

## 3. Yasal Sayfa Pending Cevapları — ✅ TAMAMLANDI (Sprint 0)

Sprint 0 / Faz 3'te 4 [KULLANICIYA SOR] placeholder'ı bırakılmıştı; kapanış öncesi kullanıcının onayı ile kanonik metne dönüştürüldü.

- [x] **KDV durumu:** "Sitedeki tüm fiyatlar KDV hariç gösterilir; %20 KDV ayrıca eklenir. Resmi PDF teklifte hem KDV hariç hem KDV dahil toplam tutar yer alır."
- [x] **Teklif geçerlilik süresi:** 24 saat (mevcut sistemle uyumlu — kod değişmedi).
- [x] **İade/iptal politikası:** "Sevkiyat öncesi iptal kabul edilir; sevkiyat sonrası iade kabul edilmez. Üretici garantisi kapsamı bağımsız."
- [x] **Yetkili mahkeme:** "İstanbul Anadolu Mahkemeleri ve İcra Daireleri."

`PendingAnswer` bileşeni ve `Warning` icon import'u kaldırıldı. Sprint 1'e bu maddeden bir iş kalmadı.

---

## 4. Sentry Monitoring — 24 Saat İzleme

Sprint 0 deploy'u sonrası kullanıcı talimatı:

> **Deploy sonrası Sentry monitoring:** 24 saat içinde `/api/quotes` endpoint'inde
> beklenmedik 400 patlaması olursa, üçüncü taraf entegrasyon var demek. O zaman bana bildir.

Sebep: Faz 4 patch'leri `apiQuoteSchema`'ya `kvkkConsent` zorunlu validation ekledi.
Bot/API client'lar consent olmadan POST atarsa 400 dönecek. Üçüncü taraf entegrasyonu
varsa (audit'te bulgu yok ama yine de) onlara da `kvkkConsent: true` field'ı eklemek
gerekecek.

---

## 5. Audit Raporundan Aktarılanlar

Sprint 0 dışı kalan, audit raporunda işaretli maddeler — Sprint 1+ için:

### 30 Gün İçinde (audit §"30 Gün")
- 8. `@graph` pattern + entity zinciri (madde 2'nin bir parçası)
- 9. HowTo schema (home page 3 adımlı flow için)
- 10. Service schema
- 11. Person/Author schema (E-E-A-T)
- 12. Speakable işaretleme
- 13. Brand schema + `sameAs`
- 14. Marka × kategori sitemap eksik
- 15. Marka hub footer eksik
- 16. Home page `"use client"` ayrıştırması (LCP/TBT)
- 17. Robots `?utm_*`, `?fbclid` Disallow
- 18. Production 404 telemetrisi
- 20. `unstable_cache` tag invalidation doğrulaması

### Roadmap (audit §"90+ gün")
- 21–30. ImageObject, Review/AggregateRating, `/piyasa` gerçek veri kararı, vs.

---

## Sprint 1 Hedef Sıralaması (taslak)

1. **TypeScript Strict Cleanup** (madde 1) — temel temizlik, sonraki tüm refactor'ları kolaylaştırır
2. **NAP + `@graph` + BUSINESS_REF** (madde 2 + audit §"30 Gün" #8) — kritik SEO/Knowledge Graph kaybı
3. **Yasal cevaplar** (madde 3) — Sprint 0 ürününün production-ready hâle gelmesi için zorunlu
4. **Schema zenginleştirme** (audit §"30 Gün" #9–13) — AIO sinyalleri
5. **Marka × kategori sitemap + footer hub** (audit §"30 Gün" #14–15)

---

— Backlog sonu. Sprint 1 kick-off'ta önceliklendirme yapılacak.
