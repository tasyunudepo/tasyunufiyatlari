# Codex Hakem Sentezi

## Panel durumu

- GLM 5.2 zaman aşımına uğradı; teknik karar kaynağı olarak kullanılmadı.
- MiniMax M3 kota/429 nedeniyle yanıt veremedi; CRO kararı üretmedi.
- DeepSeek V4 Pro tamamlandı; bulguları güncel repo koduna karşı yeniden doğrulandı.

## Kabul edilen bulgular

1. Import ve bulk mutasyonlarının handler seviyesinde auth kontrolü yoktur.
2. PDF yükleme rotası public URL, tahmin edilebilir dosya adı ve `upsert:true` kullanmaktadır.
3. Quote rotasında dağıtık rate-limit ve idempotency bulunmamaktadır.
4. Wizard WhatsApp/PDF toplamı KDV hariç tutarı ikinci kez `1.2`ye bölmektedir.
5. PDP, quote API başarısızlığını yutup başarı durumuna geçmektedir.
6. Wizard ve PDP payload’ları gerçek `kvkkConsent` değerini API’ye taşımamaktadır.
7. Wizard canlı marjı kullanırken PDP/katalog/admin önizleme sabit `%10` kullanmaktadır.
8. Mock piyasa verisi gerçek veri gibi yayınlanmamalıdır.

Bu maddelerin ilk test-first dilimi uygulamaya alındı: Vitest omurgası, KVKK payload kontratı, ortak marj/toplam/ticari kural modülleri, yanlış `/1.2` düzeltmesi, PDP sahte başarı düzeltmesi, telefon doğrulaması ve GA4 PII hijyeni.

## İhtiyatla ele alınan bulgu

Next.js sürüm yükseltmesi yalnız model özetine dayanarak uygulanmayacaktır. Resmî advisory ve mevcut `npm audit` çıktısı ayrı doğrulanarak P0-B02’de ele alınacaktır.

## Uygulama sırası

1. Saf fiyat/KVKK/telefon/GA4 testleri ve istemci düzeltmeleri.
2. Supabase atomik quote guard RPC + route idempotency/rate-limit.
3. Handler-level admin mutation auth.
4. Private PDF capability ve signed URL akışı.
5. Marjın Wizard/PDP/katalog/admin yüzeylerinde tek kaynağa bağlanması; EPS 400 canlı kuralı.
6. Hedefli E2E, build, lint, RLS/storage ve web-copy-gate release kanıtı.

## Hakem hükmü

DeepSeek’in doğrulanabilen bulguları kanonik P0 ile uyumludur. GLM ve MiniMax çıktısı olmadığı için panel çoğunluk konsensüsü üretmemiştir; uygulama kararları Codex’in güncel kod, test ve canlı salt-okunur doğrulamasına dayanmaktadır.
