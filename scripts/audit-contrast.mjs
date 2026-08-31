#!/usr/bin/env node
// Okunabilirlik denetçisi — WCAG kontrast oranını EKRANDAKİ GERÇEK PİKSEL
// üzerinden ölçer.
//
// NEDEN VAR: 27 Temmuz 2026'da kullanıcı hem /ofis panelinde hem ana sayfada
// "OKUNMUYOR" dedi ve haklıydı. O ana kadar yazılmış 578 birim testinin ve
// 36 E2E testinin hiçbiri bir yazının okunup okunmadığını sormuyordu.
// Kaynak dosyada sınıf adı aramak da yetmez: gerçek renk, devralınan renk,
// saydam katmanlar ve punto ancak tarayıcıda birleşince ortaya çıkar.
//
// Kullanım:
//   node scripts/audit-contrast.mjs [url...]        # varsayılan: ana sayfa + /ofis
//   node scripts/audit-contrast.mjs --json          # makine okunur çıktı
//
// Çıkış kodu 1 = AA altında metin var.

import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const TABAN = process.env.AUDIT_BASE_URL || 'http://localhost:3000'

function envOku() {
  try {
    return Object.fromEntries(
      readFileSync('.env.local', 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
        }),
    )
  } catch {
    return {}
  }
}

/** Sayfada çalışır: görünür her metin düğümünün rengini ve zeminini ölçer. */
const TARAYICI_OLCUMU = () => {
  // Renk çözümlemesini TARAYICIYA yaptır, elle ayrıştırma.
  //
  // 27 Temmuz 2026 bulgusu: Tailwind v4 renkleri `lab()` / `oklab()` /
  // `oklch()` olarak üretiyor. Yalnız `rgb(...)` arayan bir ayrıştırıcı
  // bunları tanımayıp ATLIYORDU — panelin bütün soluk etiketleri denetimden
  // görünmez geçti. Canvas'a boyayıp pikseli okumak her CSS renk
  // sözdizimini çözer ve gelecekte eklenecekleri de kapsar.
  const _cvs = document.createElement('canvas')
  _cvs.width = 1
  _cvs.height = 1
  const _ctx = _cvs.getContext('2d', { willReadFrequently: true })
  const _bellek = new Map()

  const ayrıştır = (renk) => {
    if (!renk) return null
    if (_bellek.has(renk)) return _bellek.get(renk)
    let sonuc = null
    try {
      _ctx.clearRect(0, 0, 1, 1)
      _ctx.fillStyle = '#000'
      _ctx.fillStyle = renk
      // Tanınmayan değerde fillStyle değişmez; '#000' kalırsa şüphelen.
      _ctx.globalCompositeOperation = 'copy'
      _ctx.fillRect(0, 0, 1, 1)
      const d = _ctx.getImageData(0, 0, 1, 1).data
      sonuc = d[3] === 0
        ? { r: 0, g: 0, b: 0, a: 0 }
        : { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }
    } catch {
      sonuc = null
    }
    _bellek.set(renk, sonuc)
    return sonuc
  }

  const harmanla = (ust, alt) => ({
    r: ust.r * ust.a + alt.r * (1 - ust.a),
    g: ust.g * ust.a + alt.g * (1 - ust.a),
    b: ust.b * ust.a + alt.b * (1 - ust.a),
    a: 1,
  })

  const lin = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const parlaklik = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)

  /**
   * Gradient zeminden EN AÇIK durağı çıkarır.
   *
   * `.nx-shell` gibi katmanların zemini `background-color` değil
   * `background-image: linear-gradient(...)`. Bu okunmazsa zemin beyaz
   * sanılıyor ve açık renkli yazılar yanlışlıkla "okunmuyor" çıkıyordu.
   * En açık durak seçilir: koyu temada açık zemin en kötü durumdur.
   */
  const gradientZemini = (bgImage) => {
    if (!bgImage || bgImage === 'none') return null
    const duraklar = bgImage.match(/rgba?\([^)]+\)/g)
    if (!duraklar || duraklar.length === 0) return null
    let enAcik = null
    for (const d of duraklar) {
      const c = ayrıştır(d)
      if (!c || c.a < 0.9) continue
      if (!enAcik || parlaklik(c) > parlaklik(enAcik)) enAcik = c
    }
    return enAcik
  }

  /**
   * Zemin: ilk saydam olmayan ata renge kadar katmanları harmanlar.
   * Gradient katmanları da hesaba katılır (yukarıdaki not).
   * Zemin hiç çözülemezse null döner — o düğüm "belirsiz" sayılır ve
   * hata olarak raporlanmaz; uydurma zeminle yanlış alarm üretmek,
   * denetçiye olan güveni bitirir.
   */
  const zeminBul = (el) => {
    const katmanlar = []
    let n = el
    let taban = null
    while (n) {
      const st = getComputedStyle(n)
      const grad = gradientZemini(st.backgroundImage)
      const bg = ayrıştır(st.backgroundColor)
      if (bg && bg.a > 0) {
        katmanlar.push(bg)
        if (bg.a >= 1) { taban = bg; break }
      }
      if (grad) { taban = grad; break }
      n = n.parentElement
    }
    if (!taban) {
      for (const kok of [document.body, document.documentElement]) {
        const c = ayrıştır(getComputedStyle(kok).backgroundColor)
        const g = gradientZemini(getComputedStyle(kok).backgroundImage)
        if (g) { taban = g; break }
        if (c && c.a >= 1) { taban = c; break }
      }
    }
    if (!taban) return null
    let sonuc = taban
    for (let i = katmanlar.length - 1; i >= 0; i -= 1) sonuc = harmanla(katmanlar[i], sonuc)
    return sonuc
  }
  const oran = (a, b) => {
    const x = parlaklik(a)
    const y = parlaklik(b)
    const [hi, lo] = x > y ? [x, y] : [y, x]
    return (hi + 0.05) / (lo + 0.05)
  }

  const bulgular = []
  const hepsi = document.querySelectorAll('body *')

  // ── Placeholder'lar ──
  // Ayrı ölçülmek zorunda: metin düğümü değiller, `::placeholder` sözde
  // öğesinden okunurlar. Formun en çok okunan yazısı bunlar olduğu hâlde
  // hiçbir denetimden geçmiyorlardı.
  for (const el of document.querySelectorAll('input[placeholder], textarea[placeholder]')) {
    const kutu = el.getBoundingClientRect()
    if (kutu.width < 1 || kutu.height < 1) continue
    const ph = getComputedStyle(el, '::placeholder')
    const renk = ayrıştır(ph.color)
    if (!renk || renk.a === 0) continue
    const zemin = zeminBul(el)
    if (!zemin) continue
    const etkin = harmanla({ ...renk, a: renk.a }, zemin)
    const punto = parseFloat(ph.fontSize || getComputedStyle(el).fontSize)
    const esik = punto >= 24 ? 3.0 : 4.5
    const r = oran(etkin, zemin)
    if (r < esik) {
      const yuvarla = (c) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`
      bulgular.push({
        metin: `[placeholder] ${el.getAttribute('placeholder').slice(0, 45)}`,
        renk: yuvarla(etkin),
        zemin: yuvarla(zemin),
        punto: Math.round(punto * 10) / 10,
        kalin: false,
        oran: Math.round(r * 100) / 100,
        esik,
        etiket: el.tagName.toLowerCase(),
        sinif: 'placeholder',
      })
    }
  }

  for (const el of hepsi) {
    // Yalnız KENDİ metni olan düğümler — kapsayıcılar iki kez sayılmasın.
    const kendiMetni = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim()
    if (kendiMetni.length < 2) continue

    const kutu = el.getBoundingClientRect()
    // 1px'lik kutular ekran okuyucu metnidir (`sr-only`): görsel olarak
    // gizlidir, kontrast şartına tabi değildir.
    if (kutu.width < 2 || kutu.height < 2) continue

    const st = getComputedStyle(el)
    if (st.visibility === 'hidden' || st.display === 'none') continue
    if (st.clipPath && st.clipPath !== 'none' && kutu.width <= 2) continue
    if (parseFloat(st.opacity) < 0.15) continue
    // WCAG devre dışı kontrolleri kontrast şartından muaf tutar; soluk
    // görünmeleri zaten kasıtlı ve anlam taşıyor.
    if (el.closest('[disabled], [aria-disabled="true"], fieldset[disabled]')) continue
    // Görsel üstündeki yazıyı ölçemeyiz — zemini piksel değil.
    if (st.backgroundImage && st.backgroundImage !== 'none') continue

    const renk = ayrıştır(st.color)
    if (!renk || renk.a === 0) continue
    const zemin = zeminBul(el)
    if (!zemin) continue // zemin çözülemedi — yanlış alarm üretme
    // Yazının kendi saydamlığı da rengi zayıflatır.
    const etkinRenk = harmanla(
      { ...renk, a: renk.a * parseFloat(st.opacity || '1') },
      zemin,
    )

    const punto = parseFloat(st.fontSize)
    const kalin = parseInt(st.fontWeight, 10) >= 700
    // WCAG "büyük metin": >=24px, veya kalınsa >=18.66px
    const buyuk = punto >= 24 || (kalin && punto >= 18.66)
    const esik = buyuk ? 3.0 : 4.5
    const r = oran(etkinRenk, zemin)

    if (r < esik) {
      const yuvarla = (c) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`
      bulgular.push({
        metin: kendiMetni.slice(0, 60),
        renk: yuvarla(etkinRenk),
        zemin: yuvarla(zemin),
        punto: Math.round(punto * 10) / 10,
        kalin,
        oran: Math.round(r * 100) / 100,
        esik,
        etiket: el.tagName.toLowerCase(),
        sinif: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 90),
      })
    }
  }
  return bulgular
}

// argv[0] node, argv[1] betik yolu — ikisi de '/' ile başlar, sayfa sanılmasın.
const ARGS = process.argv.slice(2)
const SAYFALAR = ARGS.filter((a) => a.startsWith('/') || a.startsWith('http'))
const JSON_CIKTI = ARGS.includes('--json')
/**
 * Bazı ekranlar tıklamadan görünmez. Denetim yalnız ilk açılan sekmeye
 * bakarsa asıl çalışılan ekranlar hiç ölçülmez — 27 Temmuz'da okunmayan
 * ekran tam olarak buydu (teklif yazma).
 */
// Her hedef KENDİ gerçek genişliğinde ölçülür: ön yüz mobilde okunuyor
// (şikâyet oradan geldi), /ofis paneli masaüstünde kullanılıyor.
const SENARYOLAR = {
  '/': { url: '/', ad: '/ (mobil 390px)', viewport: { width: 390, height: 900 } },
  '/ofis': { url: '/ofis', ad: '/ofis (masaüstü)', viewport: { width: 1600, height: 1100 } },
  '/ofis#teklif-yaz': {
    url: '/ofis',
    ad: '/ofis › Yeni Teklif (masaüstü)',
    viewport: { width: 1600, height: 1100 },
    async hazirla(page) {
      await page.getByRole('button', { name: 'Teklifler' }).first().click()
      await page.waitForTimeout(600)
      await page.getByRole('button', { name: 'Yeni Teklif' }).click()
      await page.waitForTimeout(1800)
    },
  },
}

// Varsayılan kapsam: müşterinin gördüğü ana yüzeyler + operatörün
// çalıştığı ekranlar. Dar kapsam, hatanın başka sayfada saklanmasına
// izin verir — 27 Temmuz'da tam olarak bu oldu.
const hedefler =
  SAYFALAR.length > 0
    ? SAYFALAR
    : [
        '/',
        '/urunler',
        '/urunler/tasyunu-levha',
        '/iletisim',
        '/hakkimizda',
        '/ofis',
        '/ofis#teklif-yaz',
      ]

const env = envOku()
const tarayici = await chromium.launch()
const ctx = await tarayici.newContext({
  viewport: { width: 390, height: 900 }, // mobil önce — asıl şikâyet oradan geldi
  httpCredentials: env.ADMIN_PASSWORD
    ? { username: env.ADMIN_USER || 'admin', password: env.ADMIN_PASSWORD }
    : undefined,
})

const rapor = []
let toplamHata = 0
let toplamOkumaHatasi = 0

for (const yol of hedefler) {
  const senaryo = SENARYOLAR[yol]
  const rota = senaryo ? senaryo.url : yol
  const url = rota.startsWith('http') ? rota : `${TABAN}${rota}`
  const etiket = senaryo ? senaryo.ad : url
  const page = await ctx.newPage()
  try {
    if (senaryo?.viewport) await page.setViewportSize(senaryo.viewport)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
    await page.waitForTimeout(1200)
    if (senaryo?.hazirla) await senaryo.hazirla(page)
    const bulgular = await page.evaluate(TARAYICI_OLCUMU)

    // Aynı renk+zemin+punto birleşimini tek satırda topla.
    const gruplar = new Map()
    for (const b of bulgular) {
      const anahtar = `${b.renk}|${b.zemin}|${b.punto}|${b.kalin}`
      if (!gruplar.has(anahtar)) gruplar.set(anahtar, { ...b, adet: 0, ornekler: [], siniflar: new Set() })
      const g = gruplar.get(anahtar)
      g.adet += 1
      if (g.ornekler.length < 3) g.ornekler.push(b.metin)
      // Suçlu sınıfı yaz: düzeltmenin nereye yapılacağı tahmine kalmasın.
      const renkSinifi = (b.sinif.match(/(?:^|\s)(text-\S+|[a-z-]*muted\S*)/g) || [])
        .map((x) => x.trim())
        .filter((x) => !/^text-\[?\d/.test(x) && !/text-(left|right|center)/.test(x))
      for (const rs of renkSinifi) g.siniflar.add(rs)
    }
    const sirali = [...gruplar.values()].sort((a, b) => a.oran - b.oran)
    toplamHata += bulgular.length
    rapor.push({ url: etiket, adet: bulgular.length, gruplar: sirali })
  } catch (e) {
    toplamOkumaHatasi += 1
    rapor.push({ url: etiket, hata: String(e.message ?? e) })
  } finally {
    await page.close()
  }
}

await tarayici.close()

if (JSON_CIKTI) {
  console.log(JSON.stringify({ toplamHata, toplamOkumaHatasi, rapor }, null, 2))
} else {
  for (const r of rapor) {
    console.log(`\n━━ ${r.url}`)
    if (r.hata) {
      console.log(`   OKUNAMADI: ${r.hata}`)
      continue
    }
    if (r.adet === 0) {
      console.log('   ✓ AA altında metin yok')
      continue
    }
    console.log(`   ${r.adet} düğüm AA eşiğinin altında\n`)
    console.log('   oran  eşik  punto  renk                  sınıf                           örnek')
    console.log('   ' + '─'.repeat(104))
    for (const g of r.gruplar) {
      const sinifMetni = [...(g.siniflar ?? [])].join(' ') || g.sinif || '—'
      console.log(
        `   ${String(g.oran).padStart(5)}  ${g.esik.toFixed(1)}  ${String(g.punto).padStart(5)}  ` +
          `${g.renk.padEnd(20)}  ${sinifMetni.slice(0, 30).padEnd(30)}  ${g.ornekler[0]?.slice(0, 28) ?? ''} (×${g.adet})`,
      )
    }
  }
  console.log(
    toplamHata === 0 && toplamOkumaHatasi === 0
      ? '\n✓ Tüm sayfalar AA geçti'
      : `\n✗ ${toplamHata} düğüm okunabilirlik eşiğinin altında; ${toplamOkumaHatasi} sayfa okunamadı`,
  )
}

process.exit(toplamHata === 0 && toplamOkumaHatasi === 0 ? 0 : 1)
