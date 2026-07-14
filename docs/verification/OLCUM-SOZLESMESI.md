# Ölçüm Sözleşmesi — Satış Zinciri (Sprint 0.4)

Tarih: 14 Temmuz 2026 · Sahip: Emrah · Uygulayan: tüm ajanlar ve satış yüzeyleri

## Amaç ve ana metrik

Ana metrik **form gönderimi DEĞİLDİR**. Ana metrik:

> **Kazanılmış siparişlerden oluşan toplam brüt kâr** (`quotes.status='completed'` kayıtlarının `gross_profit` toplamı)

Form/PDF sayıları yalnız ara metriklerdir. "Bonus'u gören müşteri neden almadı?" sorusu bu sözleşmedeki zincirle cevaplanır.

## Bağ anahtarları

| Anahtar | Üretildiği yer | Taşındığı yerler |
|---|---|---|
| `result_session_id` | Wizard fiyat gösterimi / PDP oturumu (`createResultSessionId`) | Tüm GA4 sonuç olayları, whatsapp-intent payload'ı |
| `quote_id` | `/api/quotes` (submit_quote_guarded RPC) | quotes tablosu, admin akışı, bildirimler |
| `quote_code` (TY…) | istemci ref kodu | PDF, WhatsApp mesajı, müşteri iletişimi → admin'de kayıtla eşleşir |

Kural: **her yeni satış yüzeyi bu üç anahtardan uygun olanları taşıyarak doğar.** Anahtarsız olay, zincire bağlanamaz ve ölçüm borcu sayılır.

## Olay zinciri (kanonik)

```
bonus_gosterildi → karsilastirma_acildi → bonus_secildi → fiyat_goruldu
→ teklif_olusturuldu → temas_edildi → nitelikli → teyit → kazanildi/kaybedildi
→ satis_tutari + brut_kar kaydi
```

### Mevcut olaylar (GA4 — canlıda akıyor)

| Zincir adımı | GA4 olayı | Kaynak |
|---|---|---|
| fiyat_goruldu (wizard) | `Fiyat_Gosterildi` | `notifyWizardShowPrices` (brand_name='Bonus' ayrımı var) |
| fiyat_goruldu (PDP) | `PDP_Price_View` | PDP fiyat paneli |
| niyet (sonuç CTA) | `Wizard_Result_CTA_Click`, `Whatsapp_Yazanlar`, `Telefon_Aramalari` | sonuç ekranı + whatsapp-intent (izin listesi Sprint 0.1'de onarıldı) |
| form | `Wizard_Result_Form_Open`, `PDP_Form_Open`, `Pdf_Teklif_Talebi` | teklif formları |
| giriş niyeti | `Situation_Selected` | ana sayfa niyet kartları |

### Rezerve olay adları (Sprint 1-2 yüzeyleri bunlarla doğar)

| Zincir adımı | GA4 olayı | Zorunlu parametreler |
|---|---|---|
| bonus_gosterildi | `Bonus_Meydan_Okuma_Gosterildi` | surface (wizard_result/pdp/anasayfa), rakip_marka, result_session_id |
| karsilastirma_acildi | `Karsilastirma_Acildi` | surface, urun_sayisi, result_session_id |
| bonus_secildi | `Bonus_Karsilastirmadan_Secildi` | onceki_marka, fark_tl (işaretli), result_session_id |

### Satış sonucu adımları (DB — v22, GA4 değil)

| Zincir adımı | Kayıt | Alan |
|---|---|---|
| temas_edildi | quotes | `contact_attempted_at`, `contact_successful`, `status='contacted'` |
| nitelikli | quotes | `status='quoted'` (satışçı fiyat verdi: `sales_final_price`, `quoted_by`) |
| teyit | quotes | `status='approved'` |
| kazanildi | quotes | `status='completed'`, `gross_profit`, `closed_at` (trigger) |
| kaybedildi | quotes | `status='rejected'`, `loss_category`, `loss_reason`, `closed_at` |
| takip | quotes | `follow_up_date`, `admin_notes` |

Durum sözlüğü sabit: `pending → contacted → quoted → approved → completed|rejected`. **completed = kazanıldı, rejected = kaybedildi.** Serbest metin durum DB kısıtıyla engellidir (v22).

## Alt metrikler (huni)

1. Bonus karşılaştırma görüntüleme oranı = `Bonus_Meydan_Okuma_Gosterildi` / oturum
2. Karşılaştırma → teklif geçişi = teklif_olusturuldu / `Karsilastirma_Acildi`
3. Teklif → temas oranı ve ortalama ilk temas süresi (`contact_attempted_at - created_at`)
4. Temas → satış oranı = completed / contacted
5. Kayıp nedeni dağılımı = `loss_category` kırılımı
6. Teklif başına / sipariş başına brüt kâr

## Gizlilik sınırları (değişmez)

- `gross_profit`, `sales_final_price`, `loss_*` alanları **yalnız admin** yüzeyindedir; müşteri HTML/PDF/WhatsApp çıktısına asla yazılmaz (quotes RLS + copy-gate proje yasakları).
- GA4 olaylarına kişisel veri (isim/telefon) yazılmaz; yalnız anahtarlar ve kategorik alanlar.
- Fiyat farkı iddiaları yalnız gerçek hesap sonucundan üretilir; sabit oran iddiası yasak (copy-gate: "%10-15 daha uygun" kaldırıldı, Sprint 0.2).

## Hipotez sözleşmesi şablonu (Sprint 4 motoru bunu tüketir)

Her satış hipotezi şu alanlarla kaydedilir: kanıtlanan problem · hedef ziyaretçi · değiştirilecek yüzey · ana karar metriği · brüt kâr koruması · müşteri kalitesi koruması · başlangıç/bitiş tarihi · sonuç · karar (yayınla/geri al/geliştir/veri yetersiz). Sonuç ilan etme eşiği: yeterli örneklem olmadan "kazanan" ilan edilmez; başarısız fikir tekrar yayınlanmaz.
