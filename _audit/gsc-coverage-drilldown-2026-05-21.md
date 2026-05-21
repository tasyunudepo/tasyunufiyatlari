# GSC Coverage Drilldown: Tarandı, Dizine Eklenmedi

**Tarih:** 2026-05-21
**Kaynak:** `/home/emrah/İndirilenler/https___www.tasyunufiyatlari.com_-Coverage-Drilldown-2026-05-21.zip`
**Sorun:** `Tarandı - şu anda dizine eklenmiş değil`
**GSC toplam:** `14.820` URL (`2026-05-18`)
**Export örneği:** İlk `1000` URL

## Kısa Teşhis

Bu 14,8 bin URL'nin büyük kısmı gerçek içerik sayfası değil; eski WordPress/WooCommerce parametre enkazı. Google bunları taramış ama dizine almamış. Bu yüzden doğrudan "14,8 bin sayfamız indekslenemedi" gibi okunmamalı. Asıl risk, bu enkazın crawl budget ve canonical sinyalini kirletmesi.

Örnek export sınıflandırması:

| Sınıf | Örnek sayısı / 1000 | Not |
|---|---:|---|
| Eski WP query/faceted URL | 889 | Çoğu `add_to_wishlist`, `_wpnonce`, `orderby`, `filter_paket_ici_m2`, `gridcookie` |
| Pagination | 86 | `/shop/page/2`, `/marka/.../page/3`, `/kategori/.../page/1` |
| `_next` font/static asset | 10 | Sayfa değil; GSC örneklerine girmiş |
| WP feed | 7 | `/feed/` uçları |
| WP asset/PHP endpoint | 3 | `/wp-includes`, `/wp-content` |
| Yeni ürün kalınlık query | 2 | `?kalinlik=...`; canonical ana ürüne işaret ettiği için beklenen |

## En Büyük Parametre Kaynakları

- `add_to_wishlist`: 779 örnek
- `_wpnonce`: 779 örnek
- `orderby`: 120 örnek
- `filter_paket_ici_m2`: 102 örnek
- `gridcookie`: 91 örnek
- `source_id` / `source_tax`: 42 örnek
- `pwb-brand`: 18 örnek

## Yapılan Düzeltme

`proxy.ts` eski WP URL temizliği için tek otorite haline getirildi:

- WooCommerce/WP query parametreleri temiz URL'ye `301` ile yönlenir.
- Eski kategori URL'leri yeni kategoriye `301` ile gider.
- Eski shop/pagination URL'leri `/urunler` veya ilgili canonical hedefe `301` ile gider.
- Eski marka pagination URL'leri canonical marka sayfasına `301` ile gider.
- WP feed, `wp-includes`, `wp-content`, `wp-admin`, `wp-login.php`, `xmlrpc.php`, `.php` uçları `410 Gone` + `X-Robots-Tag: noindex, nofollow` döner.
- `next.config.ts` içindeki eski WP redirect'leri kaldırıldı; çünkü Next redirect'leri query string'i koruyup faceted URL enkazını yaşatıyordu.

## Lokal Doğrulama

```txt
/kategori/eps-levhalar?filter_paket_ici_m2=4-0&gridcookie=list
=> 301 /urunler/eps-levha

/kategori/profiller/page/1?gridcookie=list
=> 301 /urunler/fileli-kose-profilleri

/marka/dalmacyali/page/3?orderby=date
=> 301 /marka/dalmacyali

/shop/page/2?orderby=price&gridcookie=list
=> 301 /urunler

/wp-includes/js/wp-emoji-release.min.js?ver=6.9
=> 410 Gone, X-Robots-Tag: noindex, nofollow

/shop/feed
=> 410 Gone, X-Robots-Tag: noindex, nofollow

/urunler/tasyunu-levha/expert-hd150-tasyunu?kalinlik=5cm
=> 200 OK
```

## GSC'de Nasıl Yorumlanmalı?

Bu sorun paniğe gerek olan bir indeks kaybı değil; eski WordPress keşif geçmişinin GSC'de hâlâ raporlanması. Sayı `2026-02-25` tarihinde `34.105` maksimumdan `2026-05-18` tarihinde `14.820` seviyesine inmiş. Yani enkaz zaten azalıyor; yeni redirect/410 kuralları düşüşü hızlandırmalı.

## Sonraki Adımlar

1. Deploy sonrası GSC'deki örnek URL'lerden 5-10 tanesinde Canlı URL Testi yap.
2. `Düzeltmeyi Doğrula` butonuna basmadan önce canlıda şu üç sınıfı kontrol et:
   - WP query URL: 301 temiz canonical
   - WP feed/asset/php: 410 + noindex
   - `?kalinlik=`: 200 OK + canonical ana ürün
3. GSC'de `Düzeltmeyi Doğrula` başlat.
4. 2-4 hafta boyunca sayı düşüşünü izle; ani sıfırlanma beklenmez.
