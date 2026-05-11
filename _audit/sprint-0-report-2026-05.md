# Sprint 0 — Kapanış Raporu

**Tarih:** 2026-05-11
**Sprint tipi:** Yangın söndürme — KVKK uyumu, güvenlik, doorway temizliği
**Süre:** Tek oturum, 5 faz seri+paralel akış
**Durum:** ✅ Tüm fazlar yeşil. 4 yasal cevap dolduruldu, sayfa production-ready. Production deploy için kullanıcı onayı bekliyor.

---

## Bölüm 1 — Faz Durumları

| Faz | Konu | Durum | Not |
|---|---|:---:|---|
| 1 | `proxy.ts` Basic Auth (Next 16 convention) | ✅ | `middleware.ts` → `proxy.ts` rename (Next 16 deprecation), env'ler Vercel'de zaten ekli (kullanıcı doğruladı) |
| 2 | GA4 config sertleştirme | ✅ | **Sıfır kod değişikliği** — tüm sprint plan ayarları zaten yerinde, bonus `ads_data_redaction: true` da var |
| 3 | Yasal sayfalar + footer | ✅ | 2 sayfa eklendi, footer kırık linkler düzeldi, 4 [KULLANICIYA SOR] placeholder bekliyor |
| 4 | KVKK consent DB persist | ✅ | Migration **APPLIED**, kod patch'leri **APPLIED**, build temiz, backfill yapılmadı (Seçenek A) |
| 5 | MOCK temizlik + `/bolge` kapama | ✅ | `app/bolge/` silindi, 3 redirect eklendi (307 emit), roadmap dosyası yazıldı |

---

## Bölüm 2 — Dosya Değişiklikleri

### Eklenen (created)
| Dosya | Faz | Açıklama |
|---|---|---|
| `proxy.ts` | 1 | Basic Auth proxy (mevcut içerik korunmuş, sadece açıklama yorumu eklendi) |
| `.env.example` | 1 | Env şeması (Supabase, Admin, CallmeBot, GA, Sentry) |
| `app/cerez-politikasi/page.tsx` | 3 | 6 blok yasal sayfa |
| `app/kullanim-kosullari/page.tsx` | 3 | 10 blok yasal sayfa, 4 cevap kanonik metne dönüştürüldü (KDV hariç + %20 / 24 saat / sıkı iade / İstanbul Anadolu) |
| `scripts/migration-v13-kvkk-consent-persist.sql` | 4 | Migration referansı (zaten Supabase'de uygulandı) |
| `_audit/sprint-1-backlog.md` | 4 | Sprint 1 backlog (TS strict cleanup + NAP + 30 günlük audit maddeleri) |
| `_audit/sprint-4-5-bolge-roadmap.md` | 5 | Tier 1/Tier 2 bölge listesi + Sprint 4-5 mimari kararları |
| `_audit/sprint-0-report-2026-05.md` | – | Bu dosya |

### Değiştirilen (modified)
| Dosya | Faz | Değişim özeti |
|---|---|---|
| `.gitignore` | 1 | `!.env.example` istisnası eklendi |
| `app/sitemap.ts` | 3 | 2 yasal path eklendi (`/cerez-politikasi`, `/kullanim-kosullari`) |
| `components/shared/SiteFooter.tsx` | 3 | Çerez ve Kullanım Koşulları linkleri `/iletisim` → ilgili gerçek sayfalar |
| `lib/schemas/quote.schema.ts` | 4 | `apiQuoteSchema` sonuna `kvkkConsent: z.boolean().refine(...)` eklendi |
| `app/api/quotes/route.ts` | 4 | `mapQuotePayload` imzasına `req: NextRequest` eklendi + return objesine 3 alan + çağrıya `req` parametresi |
| `next.config.ts` | 5 | 3 yeni 302 (Next emit: 307) redirect — `/bolge/*` → `/iletisim` |
| `app/ofis/tabs/QuotesTab.tsx` | 4 (build doğrulaması) | 5 pre-existing TS hatası için cerrahi quick-fix (3× `Number(quote.id)`, 2× `?? ""`) — kalıcı fix Sprint 1'de |

### Silinen (deleted)
| Dosya/Klasör | Faz | Sebep |
|---|---|---|
| `app/bolge/[sehir]/[ilce]/page.tsx` (+klasör) | 5 | MOCK_TRANSACTIONS sahte referans + açık uçlu doorway. Sprint 4-5'te yeniden açılacak |
| `middleware.ts` (geçici) | 1 | Next 16 deprecation warning verdi; rename geri alındı, `proxy.ts` korundu |

### DB Migration (Supabase'de uygulandı)
| Migration | Faz | Etki |
|---|---|---|
| `kvkk_consent_persist_v13` | 4 | `quotes` tablosuna 3 kolon: `kvkk_consent BOOLEAN NOT NULL DEFAULT false`, `consent_timestamp TIMESTAMPTZ`, `consent_ip TEXT` |

---

## Bölüm 3 — Açık Kalan Bekleyenler (Kullanıcı Yapacak)

### Vercel — Env Değişkenleri
Kullanıcı doğruladı: **"envler vardı"** ✅
- [x] `ADMIN_USER` — Production + Preview + Development
- [x] `ADMIN_PASSWORD` — Production + Preview + Development
- [x] `PATRON_PASSWORD` — Production + Preview + Development

### Faz 3 — Yasal Sayfalar 4 Madde — ✅ TAMAMLANDI

`/kullanim-kosullari` sayfasındaki 4 [KULLANICIYA SOR] placeholder'ı kullanıcının onayı ile kanonik metne dönüştürüldü. `PendingAnswer` bileşeni ve `Warning` icon import'u kaldırıldı.

- [x] **KDV durumu:** "Sitedeki tüm fiyatlar KDV hariç gösterilir; %20 KDV ayrıca eklenir. Resmi PDF teklifte hem KDV hariç hem KDV dahil toplam tutar yer alır." (Sistem KDV-hariç hesaplıyor; copy bunu yansıtıyor.)
- [x] **Teklif geçerlilik süresi:** 24 saat (mevcut sistem ile uyumlu — `lib/utils/packageHelpers.ts` ve UI copy ile birebir tutarlı, kod değişmedi)
- [x] **İade/iptal politikası:** Sıkı — "Sevkiyat öncesi iptal kabul edilir; sevkiyat sonrası iade kabul edilmez. Üretici garantisi kapsamı bağımsız."
- [x] **Yetkili mahkeme:** "İstanbul Anadolu Mahkemeleri ve İcra Daireleri yetkilidir. Uygulanacak hukuk Türk Hukuku'dur."

Grep doğrulaması: `app/` ve `components/` altında **`PendingAnswer` veya `KULLANICIYA SOR`** kalmadı. Build exit 0 ile temiz geçti.

### Faz 4 — KVKK Persist
Tümü Sprint 0 içinde tamamlandı:
- [x] Migration SQL onaylandı → Supabase'de **APPLIED** ✅
- [x] `mapQuotePayload` patch onaylandı → API **APPLIED** ✅
- [x] `apiQuoteSchema` patch onaylandı → schema **APPLIED** ✅
- [x] `npm run build` → exit 0 ✅
- [x] Backfill: Seçenek A (hiç yapma) ✅ — mevcut kayıtlar `kvkk_consent = false` kalıyor

### Post-Deploy — Sentry İzleme (24 saat)
Kullanıcı talimatı: `/api/quotes` endpoint'inde beklenmedik 400 patlaması olursa üçüncü taraf entegrasyon var demek, bildir.

---

## Bölüm 4 — Production Deploy Öncesi Test Prosedürü

### Lokal (Next.js dev server)

| # | Test | Beklenen | Sonuç |
|---|---|---|---|
| 1 | `npm run build` | exit 0, typecheck temiz | ✅ |
| 2 | `/ofis` (no auth) | 401 + `WWW-Authenticate` header | ✅ |
| 3 | `/ofis` (doğru auth: `barbaros:...`) | 200 | ✅ |
| 4 | `/api/admin/me` (no auth) | 401 | ✅ |
| 5 | `/cerez-politikasi` | 200 + Türkçe karakter temiz + canonical doğru | ✅ |
| 6 | `/kullanim-kosullari` | 200, kanonik metin (KDV / 24 saat / iade / mahkeme), `PendingAnswer` ve `KULLANICIYA SOR` repo'da yok | ✅ |
| 7 | Footer linkleri | `/cerez-politikasi`, `/kullanim-kosullari`, `/kvkk` → doğru hedefler | ✅ |
| 8 | `/bolge/istanbul/tuzla` | 307 → `/iletisim` | ✅ |
| 9 | `/bolge/foo/bar` (random) | 307 → `/iletisim` | ✅ |
| 10 | `/bolge` | 307 → `/iletisim` | ✅ |
| 11 | `/sitemap.xml` | `/bolge` yok, `/cerez-politikasi` + `/kullanim-kosullari` var | ✅ |
| 12 | `/` | 200 | ✅ |

> **Not 1:** Beklenen 302, gözlenen 307. Next.js `permanent: false` redirect'lerinde 307 (Temporary Redirect, method-preserving) emit eder. SEO açısından 302 ile semantically eşdeğer — bot "geçici" sinyalini doğru okur. 301'den farklı, kalıcı değil → Sprint 4-5 reopen için temiz.

### Production (deploy sonrası elle yapılacak)

| # | Test | Beklenen |
|---|---|---|
| A | Browser DevTools → Network → `gtag` config | `anonymize_ip: true`, `ad_storage: 'denied'`, `allow_google_signals: false` payload'da görünüyor (Faz 2) |
| B | Test formu doldur → `SELECT id, kvkk_consent, consent_timestamp, consent_ip FROM quotes ORDER BY id DESC LIMIT 1;` | `kvkk_consent = true`, `consent_timestamp` not null, `consent_ip` IP value (Faz 4) |
| C | curl `POST /api/quotes` (consent'siz body) | 400 + Zod error: `KVKK rızası alınmadan teklif kaydedilemez` (Faz 4) |
| D | `/sitemap.xml` production | Yeni 2 path görünüyor |
| E | `/ofis` production | Browser Basic Auth pop-up |

---

## Bölüm 5 — Sprint 1'e Geçiş Koşulları

- [x] Tüm fazlar yeşil ✅
- [ ] Production deploy testi (A–E maddeleri) temiz
- [x] 4 yasal madde doldurulmuş + `PendingAnswer` bileşeni kaldırılmış ✅
- [x] KVKK migration applied ✅
- [x] KVKK kod patch'leri applied + build temiz ✅
- [ ] Kullanıcı onayı (Sprint 1 başlatma onayı)

> **Bu raporsuz ve kullanıcı onayı olmadan Sprint 1 başlamaz.**

---

## Bölüm 6 — Sprint 0 Hakkında Notlar

### Beklenmeyen Buluntular (her biri ayrıca rapor edildi, sprint plan onayı ile çözüldü)

1. **`middleware.ts` → `proxy.ts` Next 16 deprecation** — Audit raporumda yanlış varsayım yapmıştım; sprint plan'ın "middleware.ts oluştur" talimatı dev server'da warning verdiğinde geri döndük. Audit raporu §1'inin "middleware.ts yok" tespiti bu nedenle yanıltıcıydı, **proxy.ts dosyası zaten kuruluydu** ama Next 16 convention'ı bilmediğim için tespit edemedim.

2. **GA4 zaten KVKK-strict** — Sprint plan "Yoksa ekle" diye 4 ayar isterken hepsi zaten yerindeydi + bonus `ads_data_redaction: true`. Audit raporumda §10'da `ad_user_data` ve `ad_personalization`'a açıkça değinmemiştim — eksik tarama, kod ise zaten doğru.

3. **Pre-existing TS borçları** — `npm run build` ilk denemede QuotesTab.tsx'te 1 hata gösterdi; tam typecheck'te 5 hata çıktı. Hepsi aynı kategori (`bigint → number`, `enum | null → string`). Kullanıcı onayıyla 5'i de cerrahi cast'lerle düzeltildi; kalıcı tip senkronizasyonu Sprint 1 backlog'unda.

4. **Turbopack PostCSS panic** — Faz 3 sırasında `taskkill //IM node.exe` saldırgan çıktı, `.next` cache bozuldu, `0xc0000142` Windows hatası çıktı. `.next` temizliğiyle çözüldü. **Gelecekteki ders:** spesifik PID kullan, image-wide `taskkill` yapma.

### Sprint 0 Dışında Kalan, Audit'te İşaretli Kritik Maddeler

`_audit/sprint-1-backlog.md` dosyasına aktarıldı:
- **NAP tutarsızlığı** — 3 farklı adres formatı, Sprint 1 Acil 1
- **`@graph` + BUSINESS_REF entity zinciri** — Knowledge Graph füzyonu için
- **Schema zenginleştirme** — HowTo, Service, Person/Author, Speakable, Brand `sameAs`
- **TS strict cleanup** — Sprint 0'daki quick-fix'lerin kalıcı yerini alacak

---

## Bölüm 7 — Deploy Sırası (Hatırlatma)

Kullanıcı talimatı:
> Migration ŞİMDİ apply edilir (DB) ✅ tamam
> Kod patch'leri ŞİMDİ yazılır (repo) ✅ tamam
> Bu sprint sonunda topluca production'a deploy edilir (önce git push, Vercel build sırasında migration zaten DB'de hazır)

**Sıra:**
1. ✅ Migration apply edildi (Supabase'de canlı)
2. ✅ Tüm kod değişiklikleri repo'da, build temiz
3. ✅ 4 yasal madde dolduruldu → `PendingAnswer` temizliği yapıldı
4. ⏳ git commit + push → Vercel otomatik deploy
5. ⏳ Production smoke test (A–E)
6. ⏳ 24 saat Sentry izleme — `/api/quotes` 400 patlaması var mı kontrol

---

— Sprint 0 raporu sonu. Sprint 1 kick-off için backlog hazır: [`_audit/sprint-1-backlog.md`](sprint-1-backlog.md)
