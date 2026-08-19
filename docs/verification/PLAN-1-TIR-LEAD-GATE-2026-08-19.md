# Proje Ölçekli Lead Kapısı — Uygulama ve Doğrulama Sözleşmesi

> Durum: Uygulamada
> Tarih: 2026-08-19
> Kaynak: Emrah'ın paket/adet, düşük metraj ve ürününü bilmeyen talepleri insan temasından çıkarma kararı
> Risk: R3 — kritik lead, teklif ve iletişim akışı

## Beklenen sonuç

Public site; ürününü, kalınlığını ve teslimat ilini seçmiş, en az bir tam kamyon veya TIR sipariş edecek ziyaretçiye teklif üretir. Bu koşulları sağlamayan ziyaretçi ürünleri inceleyebilir fakat telefon, WhatsApp veya teklif kaydına ulaşamaz.

## Kapsam

- Taşyünü ve EPS public tekliflerinde dinamik tam kamyon/TIR minimumu.
- Yalnız geçerli tam araç veya tam araç kombinasyonları.
- İlk giriş niyet kapısı: `1 TIR istiyorum` / `Ürünleri kendim inceleyeceğim`.
- Header, footer, ana sayfa, iletişim, katalog/PDP ve wizard temas kaçışlarının kapatılması.
- Teklif referansı oluştuktan sonra bağlamsal WhatsApp/telefon erişimi.
- GA4 uygunluk/ret/temas-kilidi olayları.
- Ana sayfa, FAQ, SEO ve hata metinlerinin yeni ticari kuralla hizalanması.

## Kapsam dışı

- Ofis panelindeki yetkili manuel teklif akışının kaldırılması.
- WhatsApp Business API veya telefon santrali kurulumu.
- Fiyat, iskonto, marj ya da nakliye hesabının yeniden tasarlanması.
- Canlıya otomatik deployment.

## Fonksiyonel gereksinimler

| ID | Gereksinim |
|---|---|
| FR-001 | Public teklif için seçili ürün/marka, kalınlık, il ve en az bir tam araç kapasitesi zorunludur. |
| FR-002 | Taşyününde yalnız tam kamyon/TIR ve bunların geçerli kombinasyonları kabul edilir. |
| FR-003 | EPS'te tam kamyon/TIR düzenine uymayan düşük veya ara metraj reddedilir. |
| FR-004 | İlk girişte ticari kapsam ve iki niyet yolu gösterilir. |
| FR-005 | Araştırma yolunda doğrudan telefon/WhatsApp açılmaz. |
| FR-006 | Teklif referansı oluşturulmadan sonuç dışı public temas CTA'sı açılmaz. |
| FR-007 | Public API, istemci atlatılsa bile yetersiz metrajı reddeder. |
| FR-008 | Ret olayları kişisel veri olmadan ölçülür. |

## Kabul kriterleri

| ID | Başlangıç | Eylem | Beklenen sonuç | Kanıt |
|---|---|---|---|---|
| AC-001 | Taşyünü, geçerli lojistik | 10 m² veya 1 paketle teklif istenir | İstemci ve API reddeder; kayıt oluşmaz | Unit + API entegrasyon |
| AC-002 | Taşyünü, geçerli lojistik | 1 kamyon veya 1 TIR alanıyla teklif istenir | Teklif akışı açılır | Unit + E2E |
| AC-003 | Taşyünü, geçerli lojistik | 1 TIR + 1 kamyon alanıyla teklif istenir | Geçerli kombinasyon kabul edilir | Unit |
| AC-004 | EPS, geçerli lojistik | Tam araç düzenine uymayan düşük/ara metrajla teklif istenir | İstemci ve API reddeder | Unit + API entegrasyon |
| AC-005 | İlk site ziyareti | Sayfa açılır | Kapsam ve `1 TIR istiyorum` kararı görünür | E2E desktop/mobile |
| AC-006 | Araştırma niyeti | `Ürünleri kendim inceleyeceğim` seçilir | Site gezilir; public temas CTA'ları kilitli kalır | E2E |
| AC-007 | Eksik ürün/kalınlık/il | Temasa geçme denenir | Telefon/WhatsApp açılmaz | E2E |
| AC-008 | Geçerli 1 TIR+ teklif | PDF/WhatsApp kaydı tamamlanır | Referanslı temas yolu açılır | Mevcut kritik E2E + yeni E2E |
| AC-009 | Raw public sayfalar | Header/footer/PDP/iletişim incelenir | Doğrudan `tel:` ve `wa.me` satış kaçağı yoktur | Contract testi |
| AC-010 | Ofis paneli | Manuel teklif hazırlanır | Mevcut yetkili akış etkilenmez | Mevcut ofis E2E |

## Doğrulama katmanları

1. Kırmızı-önce unit: ticari uygunluk ve en az bir TIR kombinasyonu.
2. API entegrasyon: taşyünü/EPS düşük metraj reddi ve RPC yan etkisizliği.
3. Contract: belirsizlik/iletişim metni ve doğrudan link kaçağı.
4. Playwright: giriş kapısı, araştırma yolu, 1 TIR wizard/PDP yolu.
5. `npm run verify:fast`.
6. `npm run verify:full`.
7. `npm run verify:release` ve kabul kilidi.
8. `npm run verify:visitor-copy` ve `/home/emrah/.codex/bin/web-copy-gate <repo-root>`.
9. Seçilmiş masaüstü/mobil ekran görüntüsü ve erişilebilirlik kontrolü.

## Geri dönüş

- DB migration planlanmıyor; TIR kapasitesi mevcut lojistik kayıtlarından dinamik okunur.
- Yayın sonrası nitelikli tekliflerde kritik düşüş görülürse önce giriş kapısı geri alınır; sunucu tarafı 1 TIR ticari kuralı Emrah'ın yeni kararı olarak korunur.
- Önceki Vercel deployment'ı geri dönüş noktasıdır; deployment bu görev kapsamında değildir.

## Definition of Done

- [ ] AC-001–AC-010 kanıtlandı.
- [ ] Public düşük/ara metraj teklifi üretilemiyor.
- [ ] Direct telefon/WhatsApp kaçakları kapalı.
- [ ] Teklif API'si fail-closed.
- [ ] Kritik teklif ve ofis regresyon testleri geçiyor.
- [ ] Türkçe ziyaretçi metni, kırmızı-kalem ve web-copy kapıları geçti.
- [ ] Build ve release doğrulaması başarılı.
