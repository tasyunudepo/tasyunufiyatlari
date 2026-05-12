# Sprint 2 ve Sonrası — Yol Haritası

**Hazırlık:** 2026-05-12 (Sprint 1 / Madde 1-3 tamamlandıktan sonra)

Bu dosya Sprint 1'in **kalan** (4, 5) maddelerinden ve audit raporundaki tüm **30-gün/90-gün** kalan maddelerden sonraki süreci kapsar. İçindekiler:

- [Sprint 1 kalanı](#sprint-1-kalan%C4%B1) → maddeler 4 ve 5 (`_audit/sprint-1-backlog.md`'de detay)
- [Sprint 2 — Performance & UX](#sprint-2--performance--ux)
- [Sprint 3 — Marka Entity Zenginleştirme](#sprint-3--marka-entity-zenginle%C5%9Ftirme)
- [Sprint 4-5 — Bölge Sayfaları](#sprint-4-5--b%C3%B6lge-sayfalar%C4%B1) → `_audit/sprint-4-5-bolge-roadmap.md`'de detay
- [Roadmap (90+ gün)](#roadmap-90-g%C3%BCn)
- [CachyOS'a geçiş notları](#cachyosa-ge%C3%A7i%C5%9F-notlar%C4%B1)

---

## Sprint 1 Kalanı

İki madde, [_audit/sprint-1-backlog.md](sprint-1-backlog.md) §6 ve §7'de detaylı.

### Madde 4 — Marka × Kategori Sitemap + Footer Hub
- `app/sitemap.ts`: BRAND × KATEGORI matrix'i, DB doğrulamasıyla
- `components/shared/SiteFooter.tsx`: 4 marka tam liste
- Opsiyonel: `/marka` hub index sayfası

### Madde 5 — Robots + Audit 30 Gün Kalanları
- Robots `?utm_*`, `?fbclid`, `?gclid` disallow
- 404 telemetrisi Sentry'ye
- `unstable_cache` revalidateTag kontrolü admin update flow'unda
- Depo `openingHoursSpecification` (warehouse node)
- (opsiyonel/büyük) home page `"use client"` ayrıştırması

---

## Sprint 2 — Performance & UX

Audit raporunun "30 Gün İçinde" kalan performans odaklı maddeleri + UX iyileştirmeler.

### 2.1 Home page RSC ayrıştırması (audit 30 gün #16)
- `app/page.tsx` tamamen `"use client"` → server component'e çevir
- Calculator + interactive island'lar ayrı client component dosyalara
- LCP/TBT'de **somut iyileşme** beklenir; Vercel Speed Insights'tan ölç
- Refactor scope: 200+ satır, dikkatli test gerekli (FAQ, RevealOnScroll, BrandStrip, ProofBlock hepsi client mi yoksa server mı?)

### 2.2 Image pipeline yeniden değerlendirme (audit §7)
- `next.config.ts` `unoptimized: true` (Vercel Hobby tier 5K/ay limit kararı)
- Vercel Pro tier maliyeti vs AVIF + responsive image kazancı analizi
- Karar: ya Pro'ya geç + `unoptimized: false`, ya CDN tarafına Cloudflare Images / Imgix entegrasyonu

### 2.3 Loading durumları (Suspense)
- Ürün detay `Suspense` boundary'leri var ama skeleton yetersiz
- WizardCalculator data fetching → suspense + streaming pattern
- /urunler hub data fetching async server component, loading.tsx ekleyebiliriz

### 2.4 Mobile UX iteration
- Sprint 1 sonu yaptığımız Step1 chip + HeroSystemVisual + SituationSelector cleanup gerçek kullanıcıda nasıl çalışıyor — heatmap (Microsoft Clarity önerisi audit dışı eklenmiş olabilir)
- Click-through funnel: GA4 `quote_funnel_events` analizi → conversion bottleneck'leri

---

## Sprint 3 — Marka Entity Zenginleştirme

Sprint 1 / Madde 3'te Brand sameAs'lar eklendi. Bir sonraki katman:

### 3.1 Brand `logo`, `slogan`, `parentOrganization`
- BRAND_INFO'ya logo URL'i ekle (`public/images/markalogolar/*.webp`)
- `parentName: 'Filli Boya'` → `parentOrganization: { '@type': 'Organization', name: 'Filli Boya' }` schema'ya
- Brand `description`: marka sayfasındaki özet metin

### 3.2 Product → Brand pointer her sayfada
- ProductCard render'larında ld+json yok şu an
- Marka sayfası `/marka/[brand]` ürün listesi → her ProductCard altında micro-schema (`itemListElement` pattern)
- Schema.org `OfferCatalog` veya `ItemList`

### 3.3 Founder LinkedIn / Person sameAs
- Sprint 1'de atlanmıştı (kullanıcı kararı)
- LinkedIn URL'i alınınca `BUSINESS_INFO.founder` + ayrı `founderSameAs` array
- `buildPersonNode({ sameAs: [linkedin] })` zaten plumbed

### 3.4 OEM/Ekonomik brand entity
- Şu an inline fallback (sadece `name`). 2. kalite ürünler için meaningful brand entity gerekiyor mu?
- Karar: bu bir marka değil bir tier — Brand schema'ya almak doğru mu?
- Alternatif: ProductGroup veya Offer eligibleCustomerType pattern

---

## Sprint 4-5 — Bölge Sayfaları

Detay: [_audit/sprint-4-5-bolge-roadmap.md](sprint-4-5-bolge-roadmap.md)

Sprint 0'da `/bolge/*` route'u 302 → `/iletisim` redirect ile geçici kapatıldı. Tier 1 (18 ilçe) + Tier 2 (9 niş) gerçek içerikle açılacak.

Önkoşullar:
- Sprint 1 madde 4 (sitemap) tamamlanmış olmalı
- BUSINESS_REF entity zinciri kurulmuş (Sprint 1 / Madde 2) ✅
- 800-1200 kelime özgün içerik per bölge (kullanıcı yazacak)

---

## Roadmap (90+ gün)

Audit raporu §"Roadmap" + Sprint 1 backlog "Audit Aktarılanlar":

| # | Konu | Sebep |
|---|---|---|
| R1 | ImageObject zenginleştirme | Tüm `image` string'leri `{ '@type': 'ImageObject', url, width, height, caption }` objelerine |
| R2 | Review / AggregateRating | Müşteri yorumları (Google Business Profile sync) → Product schema |
| R3 | `/cerez-politikasi`, `/kullanim-kosullari` periyodik review | Yıllık güncelleme + KVKK regülasyon takibi |
| R4 | `/piyasa` gerçek veri vs sayfayı kaldır | MOCK_TRANSACTIONS hâlâ var (Sprint 0'da `/bolge` temizlendi ama `/piyasa` robots disallow ile bırakıldı) |
| R5 | PROOF BLOCK gerçek görseller | `app/page.tsx:370` TODO placeholder, sahada çekilmiş depo/teslimat fotoğrafları |
| R6 | AVIF / Vercel Pro image optimization | Sprint 2 madde 2.2 ile birleşik |
| R7 | Cache-Control immutable headers | `public/` statik dosyalar için explicit |
| R8 | PRICING_HIDDEN_REASON micro-copy | Sprint 0 audit'te işaretli |
| R9 | Build çıktısında bundle size ölçümü | Vercel Analytics + size limit alerts |
| R10 | Supabase generated types migration | `mcp__supabase__generate_typescript_types` ile `lib/types/database.types.ts` üret; mevcut manuel `lib/types/index.ts`'i bundan derive et. 2-3 günlük dedike iş |

---

## CachyOS'a Geçiş Notları

Win10 → CachyOS (Arch tabanlı) geçiş yaparken devamlılık için:

### 1. Repo
```bash
git clone https://github.com/stratejist34/tasyunufiyatlari.git
cd tasyunufiyatlari
git log --oneline -5   # Son commit'ler senkron mu kontrolü
```

Son commit: `1efa09c` — schema enrichment + Gebze copy cleanup.

### 2. Node.js + npm
Next.js 16 → **Node 20+ gerekli**. CachyOS'ta:
```bash
# Resmi paket
sudo pacman -S nodejs npm

# Veya nvm üzerinden (sürüm yönetimi için daha esnek)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
```

Sürüm kontrolü:
```bash
node --version   # v20.x bekleniyor
npm --version    # v10.x bekleniyor
```

### 3. Bağımlılıklar
```bash
npm install
```

### 4. `.env.local` (manuel oluştur)
Win10'da kalan `.env.local` Linux'a otomatik gelmez — `.gitignore`'da. Aynı içeriği Linux'ta yeniden oluştur:

```bash
# Linux'ta proje kökünde
nano .env.local
```

Şablon `.env.example` dosyasında. Gerçek değerler için:
- **Supabase URL + ANON_KEY + SERVICE_ROLE_KEY** → Supabase dashboard → Project Settings → API
- **ADMIN_USER, ADMIN_PASSWORD, PATRON_PASSWORD** → Vercel dashboard → Settings → Environment Variables
- **CALLMEBOT_PHONE_1/2 + APIKEY_1/2** → kullanıcının kişisel notlarında olmalı
- **NEXT_PUBLIC_GA_ID** → `G-VCHRKVJCEN` (sabit)

### 5. Supabase MCP (`.mcp.json`)
Win10'da `.mcp.json` `.gitignore`'da, repo'ya gelmedi. Linux'ta yeniden oluştur:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token", "<TOKEN>", "--project-ref", "latlzskzemmdnotzpscc"]
    }
  }
}
```

`<TOKEN>` Supabase dashboard → Access Tokens.

### 6. Geliştirme komutları (Linux'ta aynı)
```bash
npm run dev          # localhost:3000
npm run build        # typecheck + production build
npm run start        # production server (build sonrası)
```

### 7. Vercel deploy
GitHub push'lar otomatik Vercel deploy tetikler. Linux'tan da aynı şekilde çalışır — `git push origin main` yeterli.

### 8. Karşılaşılan Win10-spesifik sorunlar (Linux'ta yaşanmamalı)
Win10 üzerinde gördüğümüz sorunlar muhtemelen Linux'ta çıkmayacak:
- **`taskkill //IM node.exe` yan etkileri** → Linux'ta `pkill -f "next dev"` çok daha cerrahi
- **`.next/dev/lock` Windows file lock'ları** → Linux fs locking daha temiz, fdspr sorun yok
- **Turbopack PostCSS `0xc0000142` Windows DLL hatası** → Linux'ta yok
- **CRLF/LF warning'leri her commit'te** → `git config --global core.autocrlf input` (Linux default)
- **Türkçe karakterli path (Tasyunufİyatlari)** → next.config.ts'te webpack resolver override var ([next.config.ts:11-22](next.config.ts#L11-L22)), Linux'ta da gerekli (klasör adı korunur, encoding tutarlı)

### 9. İlk Linux dev çalıştırması checklist
- [ ] `git clone` + `npm install` ✓
- [ ] `.env.local` doldur ✓
- [ ] `npm run dev` → http://localhost:3000 açılıyor mu ✓
- [ ] `/ofis` → Basic Auth pop-up çıkıyor mu (env'ler yüklü mü)
- [ ] `npm run build` → exit 0 (typecheck dahil)
- [ ] Supabase MCP `.mcp.json` ile Claude Code session başlat → `mcp__supabase__execute_sql` ile test sorgusu

---

## Mevcut Repo Durumu — 2026-05-12

| Sprint / Madde | Durum | Son commit |
|---|:---:|---|
| Sprint 0 (5 faz) | ✅ | `d68b3dd` (deploy edildi) |
| Sprint 1 / Madde 1 | ✅ | `5fa0a8e` |
| Sprint 1 / Madde 2 | ✅ | `799c7dd` |
| Sprint 1 / Madde 3 | ✅ | `1efa09c` |
| Sprint 1 / Madde 4 | ⏳ | — |
| Sprint 1 / Madde 5 | ⏳ | — |
| Sprint 2 | 📋 plan | — |
| Sprint 3 | 📋 plan | — |
| Sprint 4-5 | 📋 plan | — |

**Production:** `https://www.tasyunufiyatlari.com` — son deploy commit `1efa09c` (Vercel otomatik).

**Yapılacak smoke test (deploy sonrası, manuel — fırsat bulunca):**
- Google Rich Results Test → `/`, `/marka/dalmacyali`, `/urunler/tasyunu-levha/<slug>` validation
- Browser DevTools → ld+json scriptlerinin Schema.org @graph'a sahip olduğunu teyit
- `https://search.google.com/test/rich-results` üç sayfa için clean validation
- Sentry'de `/api/quotes` 400 patlaması var mı (Sprint 0 sonu 24h izleme)

— Roadmap sonu. CachyOS'tan devam ederken bu dosya + `sprint-1-backlog.md` + `sprint-4-5-bolge-roadmap.md` üç açık plan dosyası olarak hazır.
