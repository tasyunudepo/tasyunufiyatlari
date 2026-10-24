# 11–15 cm kalınlık ve uzun dübel planı — 24 Ekim 2026

**Durum (24 Ekim 2026, aynı gün):** Faz 1–3 uygulandı; ayrıntı ve kanıt `docs/verification/PROGRESS.md` → "24 Ekim 2026 · 11–15 cm kalınlıklar". Faz 2b’de hesaplayıcıya 12 ve 15 cm eklendi; pul kuralı "markanın taşyünü dübeli yetecek boyda değilse" şeklinde uygulandı.

Kaynak: `~/İndirilenler/Filli Boya - 2026 EYLÜL MALİYET ANALİZİ.xlsx` (sayfalar: FİLLİ, FAWORİ, TAŞYÜNÜ, YÜKLEME).
Tetik: Sitede bir müşteri Optimix TR7.5 15 cm ile set kuramadı; ofiste toz grubu seti "Eksik: Dübel" verdi.

## Kök neden (üç katman)

| # | Katman | Durum | Etki |
|---|---|---|---|
| 1 | `plates.thickness_options` | 11 levhada 10 cm'de bitiyor; 11–15 cm fiyatları `plate_prices`'ta 18 Mart 2026'dan beri var (55 satır) | Katalog, ofis, sihirbaz 11–15'i hiç göstermiyor |
| 2 | `plate_prices.package_m2` | Bu 55 satırın hepsinde boş | Açılırsa sihirbaz/paket motoru `plates.package_m2 = 1.8`'e düşer → taşyünü 11–15'te m² fiyatı %33 düşük (SW035 15 cm: 788 yerine 1.182,50 TL/m²). Katalog `logistics_capacity`'ye (1.2) düşer → EPS'te yanlış (2.0/1.5 olmalı) |
| 3 | Dübel | Expert #136/#137 ve Optimix #144/#145 (17,5/19,5 cm) satırlarında `unit_content` boş; seçici paket içeriği olmayanı atlıyor | 12–15 cm'de Expert/Optimix toz grubu: "Eksik: Dübel". TEKNO'da 15,5'ten uzun dübel hiç yok |

Seçici kuralı: dübel boyu ≥ levha + 4 cm (`lib/quote/selectAccessoryForSet.ts`). 15 cm → en az 19 cm → 19,5 cm dübel.

## Dübel matrisi (simülasyon, canlı veriyle)

Şu an:

| Toz grubu | Malzeme | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|
| Dalmaçyalı | Taşyünü / EPS | 15,5 | 15,5 | 17,5 | 17,5 | 19,5 | 19,5 |
| Expert | Taşyünü / EPS | 15,5 | 15,5 | YOK | YOK | YOK | YOK |
| Optimix | Taşyünü / EPS | 15,5 | 15,5 | YOK | YOK | YOK | YOK |
| TEKNO | Taşyünü | 15,5 | 15,5 | YOK | YOK | YOK | YOK |
| TEKNO | EPS | YOK | YOK | YOK | YOK | YOK | YOK |

Faz 1 sonrası Expert ve Optimix satırları Dalmaçyalı ile aynı olur. TEKNO değişmez (veri yok).

Paket tanımları: Optimix levhası → Orijinal = Optimix toz, Dengeli = TEKNO. İkisi de 15 cm'de dübelsiz kaldığı için Optimix 15 cm'de hiçbir set kurulamıyor. Bonus → Expert / Optimix / TEKNO; üçü de 15 cm'de dübelsiz.

## Faz 1 — Veri (uzak DB; Emrah'ın sözüyle)

1a. Paket m² (canlıda görünür etkisi yok; kalınlıklar henüz kapalı):

```sql
UPDATE plate_prices SET package_m2 = 1.2
 WHERE plate_id IN (27,30,31,32,36) AND thickness BETWEEN 11 AND 15 AND package_m2 IS NULL;
UPDATE plate_prices SET package_m2 = 2.0
 WHERE plate_id IN (37,38,39,40,41,42) AND thickness IN (11,12,13) AND package_m2 IS NULL;
UPDATE plate_prices SET package_m2 = 1.5
 WHERE plate_id IN (37,38,39,40,41,42) AND thickness IN (14,15) AND package_m2 IS NULL;
```

Not: Excel'de Optimix Karbonlu 15 cm ve Optimix Beyaz 15 cm "4 adet / 2 m²" yazıyor; fiyat (922,50) ise 3 adet / 1,5 m²'ye denk geliyor (41 TL × 15 cm = 615 TL/m²). 1,5 kullanıldı.

1b. Uzun dübeller ve pul (fiyatlar Excel FİLLİ/FAWORİ, KDV hariç liste):

```sql
UPDATE accessories SET unit_content=200, unit='KUTU', short_name='Çelik Dübel 17.5', base_price=1250, slug='expert-celik-civili-dubel-175mm' WHERE id=136;
UPDATE accessories SET unit_content=200, unit='KUTU', short_name='Çelik Dübel 19.5', base_price=1340, slug='expert-celik-civili-dubel-195mm' WHERE id=137;
UPDATE accessories SET unit_content=200, unit='KUTU', short_name='Çelik Dübel 17.5', base_price=1080, slug='optimix-beton-dubeli-celik-civili-175mm' WHERE id=144;
UPDATE accessories SET unit_content=200, unit='KUTU', short_name='Çelik Dübel 19.5', base_price=1140, slug='optimix-beton-dubeli-celik-civili-195mm' WHERE id=145;
UPDATE accessories SET unit_content=200, unit='KUTU', short_name='Dübel Pulu', slug='optimix-tasyunu-dubel-pulu' WHERE id=146;
-- Dalmaçyalı beton dübeli 17,5/19,5'e Expert'in fiyatı girilmiş:
UPDATE accessories SET base_price=1280 WHERE id=114;
UPDATE accessories SET base_price=1380 WHERE id=115;
-- EPS 12–15 cm için (Expert/Optimix'te 15,5'ten uzun plastik dübel yok):
UPDATE accessories SET is_for_eps=true WHERE id IN (136,137,144,145);
```

#135 ve #140–#143 (9,5–15,5 cm beton dübeli, paket içeriği boş) bilerek dokunulmuyor: doldurulursa Expert/Optimix taşyünü 3–5 cm setleri 11,5 taşyünü dübelinden 9,5 beton dübeline kayar, canlı fiyat değişir.

1c. Teknik profil: `plate_technical_profiles` SW035 (27) ve Premium (30) `thickness_mm_max` 100 → 150.

## Faz 2 — Kod (yerel, test)

2a. Taşyünü dübel pulu: taşyününde seçilen dübel "taşyünü dübeli" değilse (beton/çelik çivili) aynı markanın "Dübel Pulu" satırı dübel adediyle eklenir. Dalmaçyalı (#120) ve Optimix (#146) pulu var; Expert listesinde pul yok.
 - Dikkat: sihirbaz seti `items.length !== 8` ise atıyor (`WizardCalculator.tsx:1406`, `:1867`). Pul 9. kalem olur; bu kontrol "zorunlu tipler tam mı" kontrolüne çevrilmeli.
 - Ortak yer: `lib/quote/buildAccessorySet.ts` + sihirbazdaki `buildAccessoryItemsForDefinition`.
2b. Sihirbaz kalınlık düğmeleri (`KALINLIKLAR`, `WizardCalculator.tsx:135`, `Step1ProductSelection.tsx:51`): 3, 4, 5, 6, 8, 10 → 12 ve 15 eklenir (hub ve en az sipariş tablosundaki liste: `lib/compare/hubs.ts`, `lib/sales/minimumOrder.ts`).
2c. Testler: Expert/Optimix 12 ve 15 cm taşyünü (17,5 / 19,5 + pul), EPS 15 cm (19,5), 4 cm taşyününde mevcut seçim korunur, TEKNO 15 cm eksik kalır.

## Faz 3 — Kalınlıkları aç

```sql
UPDATE plates SET thickness_options = thickness_options || '[11,12,13,14,15]'::jsonb
 WHERE id IN (27,30,31,32,36,37,38,39,40,41,42);
```

Sonuç: 55 yeni ürün-kalınlık sayfası, site haritası, 12 ve 15 cm hub sayfaları bu ürünleri gösterir, Merchant beslemesine 12/15 girer. Katalog `force-static` → derleme + yayın gerekir.

Doğrulama: `npm run build`, copy-gate, site haritası kökü `<urlset>`, ofiste Optimix TR7.5 15 cm + Optimix toz → set tam (19,5 + pul), sihirbazda 15 cm m² fiyatı = liste / 1,2 ile tutarlı, SW035 15 cm sayfa fiyatı.

## Faz 4 — Yayın (Emrah'ın "çık" sözüyle)

## Ayrı iş: fiyat güncellemesi (bu planın dışında)

| Bulgu | Ölçü |
|---|---|
| EPS levhaları (İdeal Carbon, Double Carbon, Expert EPS Karbonlu, EPS 035 Beyaz, Optimix Karbonlu) | DB, Excel listesinin ~%10 altında (tüm kalınlıklar) |
| Expert EPS Beyaz | DB 1.335, liste 875 (5 cm) — DB %52 üstte |
| PW50 paket m² | DB 3,6 / 3,0 / 1,8; liste 4,8 / 3,6 / 2,4 → m² fiyatı %20–33 yüksek görünüyor |
| Optimix Beyaz EPS, Optimix 035 Beyaz EPS | Listede var (2–15 cm), DB'de yok |
| Taşyünü levhaları (SW035, CS60, Premium, HD150, LD125, VF80, RF150, TR7.5) | Fiyatlar listeyle aynı |

`fiyat-kurallari.json` proje kökünde yok; fiyat güncelleme akışı için önce oluşturulmalı.
