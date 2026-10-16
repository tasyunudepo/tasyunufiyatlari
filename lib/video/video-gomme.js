// video-gomme.js — bağımlılıksız video gömme + bağlam ölçümü (ES modülü, tek dosya).
//
// Ne yapar
//   - Kaynağı tarayıcı seçer: <video> içindeki <source media=…> (mobil 9:16 / 1:1, masaüstü 16:9), WebM önce, MP4 yedek.
//     Seçim yükleme anında bir kez yapılır; sayfa genişliği sonradan değişirse yeniden seçilmez (gerekçe README'de).
//     Eski tarayıcı media'yı yok sayıp yanlış kaynağı seçtiyse doğru kaynak `src` ile zorlanır.
//   - Poster <picture> ile gelir (aynı media sorgusu, kaynak başına width/height → yerleşim kayması yok, JS gerekmez).
//     Bağlanınca seçilen poster <video poster> olarak da yazılır ve kutu seçilen biçimin oranına kilitlenir.
//   - data-vg-mode="loop": görünür alana girince (%50) sessiz oynar, çıkınca / sekme gizlenince durur.
//     prefers-reduced-motion: reduce ise kendiliğinden oynamaz; poster + oynat düğmesi.
//   - data-vg-mode="click": kendiliğinden oynamaz, yerel kontroller açık, ortada oynat düğmesi.
//   - Olaylar (bağlam olayı, dönüşüm DEĞİL): video_start (ilk oynatma), video_progress (%50, bir kez),
//     video_complete (bir kez; döngüde ilk başa sarma), video_cta_click ([data-vg-cta] tıklaması).
//     Parametreler: video_id, page_type, variant (ör. "16x9", "1x1", "9x16"); CTA'da isteğe bağlı cta_id.
//   - Olaylar tek köprüden çıkar: track(eventName, params). Her site kendi olay yardımcısını buraya bağlar
//     (kopru/ klasörü). Köprü verilmezse defaultTrack: gtag('event', …) varsa o, yoksa dataLayer.push.
//
// Kullanım
//   import { init } from './video-gomme.js';
//   init({ track: (ad, p) => …, pageType: 'urun' });     // sayfadaki bütün [data-vg] öğeleri
//   const c = mount(figureEl, { track });  c.destroy();   // tek öğe (React useEffect)

/**
 * @typedef {(eventName: string, params: Record<string, string>) => void} TrackFn
 * @typedef {{ track?: TrackFn, pageType?: string, threshold?: number, injectCss?: boolean }} Secenek
 * @typedef {{ id: string, el: HTMLElement, video: HTMLVideoElement, variant: () => string,
 *             cta: (el?: Element) => void, destroy: () => void }} Denetleyici
 */

const KAYIT = new Map(); // video_id → denetleyici (CTA tıklaması için)
/** @type {Secenek} */
let genel = { track: undefined, pageType: '', threshold: 0.5, injectCss: true };
let hazir = false;

const CSS = `
.vg{position:relative;overflow:hidden}
.vg>picture>img{display:block;width:100%;height:auto}
.vg>video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:transparent}
.vg[data-vg-kilit]>picture>img{position:absolute;inset:0;height:100%;object-fit:cover}
.vg-btn{position:absolute;z-index:2;display:flex;align-items:center;justify-content:center;border:0;padding:0;cursor:pointer;
  color:#fff;background:rgba(17,17,17,.68);border-radius:999px;box-shadow:0 2px 10px rgba(0,0,0,.25)}
.vg-btn[hidden]{display:none}
.vg-btn[data-durum=oynat]{left:50%;top:50%;width:68px;height:68px;transform:translate(-50%,-50%)}
.vg-btn[data-durum=duraklat]{right:10px;bottom:10px;width:34px;height:34px;opacity:.6}
.vg-btn[data-durum=duraklat]:hover,.vg-btn[data-durum=duraklat]:focus-visible{opacity:1}
.vg[data-vg-mode=loop]>video{cursor:pointer}
.vg-btn:focus-visible{outline:3px solid #fff;outline-offset:2px}
.vg-btn svg{width:42%;height:42%;fill:currentColor}
.vg-gizli{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;
/** @type {Record<string, string>} */
const IKON = {
  oynat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
  duraklat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/></svg>',
};

/** Varsayılan köprü: gtag varsa GA4 olayı, yoksa dataLayer kaydı. Site köprüsü verilirse kullanılmaz.
 * @type {TrackFn} */
export function defaultTrack(eventName, params) {
  const w = /** @type {any} */ (window);
  if (typeof w.gtag === 'function') { w.gtag('event', eventName, params); return; }
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event: eventName, ...params });
}

/** @param {boolean | undefined} css */
function hazirla(css) {
  if (hazir) return;
  hazir = true;
  if (css !== false && !document.getElementById('vg-stil')) {
    const s = document.createElement('style');
    s.id = 'vg-stil';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  // Yakalama aşamasında dinlenir: sitenin kendi tıklama yöneticisi stopPropagation yapsa da olay kaçmaz.
  document.addEventListener('click', ctaTiklama, true);
}

/** @param {MouseEvent} ev */
function ctaTiklama(ev) {
  const hedef = ev.target instanceof Element ? ev.target.closest('[data-vg-cta]') : null;
  if (!hedef) return;
  const id = hedef.getAttribute('data-vg-cta');
  let d = id ? KAYIT.get(id) : null;
  if (!d) {
    const kap = hedef.closest('[data-vg]');
    d = kap ? /** @type {any} */ (kap).__vg : null;
  }
  if (d) d.cta(hedef);
}

/** Tarayıcının seçmesi gereken <source>: media eşleşen (ya da media'sız) ve oynatılabilir ilk kaynak. */
/** @param {HTMLVideoElement} video @returns {HTMLSourceElement | null} */
function hedefKaynak(video) {
  for (const s of video.querySelectorAll('source')) {
    const m = s.getAttribute('media');
    if (m && !window.matchMedia(m).matches) continue;
    const t = s.getAttribute('type');
    if (t && !video.canPlayType(t)) continue;
    return s;
  }
  return null;
}

/** @param {HTMLSourceElement | null} s @param {HTMLVideoElement} video @returns {string} */
function bicimAdi(s, video) {
  const v = s && s.getAttribute('data-variant');
  if (v) return v;
  const m = String((s && s.src) || video.currentSrc || '').match(/(\d+)x(\d+)/);
  return m ? `${m[1]}x${m[2]}` : 'bilinmiyor';
}

/**
 * Tek bir video kabını (<figure data-vg="ID">) bağlar.
 * @param {HTMLElement} el
 * @param {Secenek} [secenek]
 * @returns {Denetleyici | null}
 */
export function mount(el, secenek = {}) {
  if (!el) return null;
  const mevcut = /** @type {any} */ (el).__vg;
  if (mevcut) return mevcut;
  const o = { ...genel, ...secenek };
  hazirla(o.injectCss);

  const video = /** @type {HTMLVideoElement|null} */ (el.querySelector('video'));
  if (!video) return null;
  const id = el.getAttribute('data-vg') || video.id || 'video';
  const dongu = el.getAttribute('data-vg-mode') === 'loop';
  const sayfa = el.getAttribute('data-vg-page') || o.pageType || '';
  const esik = Number(o.threshold) || 0.5;
  const track = typeof o.track === 'function' ? o.track : defaultTrack;
  const azHareket = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Oynatma için gerekenler; React `muted`ı öznitelik olarak basmadığı için özellik olarak da yazılır.
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  if (!video.getAttribute('preload')) video.preload = 'none';
  if (dongu) { video.loop = true; video.controls = false; } else { video.loop = false; video.controls = true; }

  // ── Kaynak seçimi ──────────────────────────────────────────────
  const hedef = hedefKaynak(video);
  let secilen = hedef;
  const kaynakDogrula = () => {
    if (!video.currentSrc || video.getAttribute('src')) return;
    if (hedef && video.currentSrc !== hedef.src) { secilen = hedef; video.src = hedef.src; return; } // media'yı yok sayan eski tarayıcı
    secilen = [...video.querySelectorAll('source')].find((s) => s.src === video.currentSrc) || hedef;
  };
  kaynakDogrula();
  const bicim = () => bicimAdi(secilen, video);

  // Kutuyu seçilen biçimin oranına kilitle: genişlik sonradan değişse de yüklü video bozulmadan durur.
  const oran = bicim().match(/^(\d+)x(\d+)$/);
  if (oran) { el.style.aspectRatio = `${oran[1]} / ${oran[2]}`; el.setAttribute('data-vg-kilit', ''); }

  // ── Poster ─────────────────────────────────────────────────────
  const img = /** @type {HTMLImageElement|null} */ (el.querySelector('picture img, img[data-vg-poster]'));
  const posterYaz = () => { if (img && img.currentSrc && !video.getAttribute('poster')) video.poster = img.currentSrc; };
  if (img) { if (img.complete) posterYaz(); else img.addEventListener('load', posterYaz, { once: true }); }
  else if (!video.getAttribute('poster')) console.warn(`[video-gomme] ${id}: poster yok (zorunlu).`);

  // ── Düğme ──────────────────────────────────────────────────────
  let dugme = /** @type {HTMLButtonElement|null} */ (el.querySelector('[data-vg-btn]'));
  const dugmeBizim = !dugme;
  if (!dugme) {
    dugme = document.createElement('button');
    dugme.type = 'button';
    dugme.setAttribute('data-vg-btn', '');
    el.appendChild(dugme);
  }
  dugme.classList.add('vg-btn');

  // ── Durum ──────────────────────────────────────────────────────
  let basladi = false, yarim = false, tamam = false;
  let gorunur = false, kullaniciBaslatti = false, kullaniciDurdurdu = false, otomatikEngel = false;
  let son = 0;

  /** @param {string} ad @param {Record<string, string>} [ek] */
  const gonder = (ad, ek) => {
    const p = { video_id: id, page_type: sayfa, variant: bicim(), ...(ek || {}) };
    try { track(ad, p); } catch (e) { console.warn('[video-gomme] ölçüm köprüsü hata verdi:', e); }
  };
  const bitti = () => {
    if (tamam) return;
    if (!yarim) { yarim = true; gonder('video_progress'); } // sona varan %50'yi geçmiştir; sıra korunur
    tamam = true;
    gonder('video_complete');
  };

  const dugmeGuncelle = () => {
    const oynuyor = !video.paused && !video.ended;
    let durum = '';
    if (dongu) {
      if (oynuyor) durum = 'duraklat';
      else if (kullaniciDurdurdu || otomatikEngel || (azHareket.matches && !kullaniciBaslatti)) durum = 'oynat';
    } else if (!basladi && !oynuyor) durum = 'oynat';
    if (!durum) { dugme.hidden = true; return; }
    dugme.hidden = false;
    if (dugme.getAttribute('data-durum') !== durum) {
      dugme.setAttribute('data-durum', durum);
      const etiket = durum === 'oynat' ? 'Videoyu oynat' : 'Videoyu duraklat';
      dugme.setAttribute('aria-label', etiket);
      dugme.innerHTML = IKON[durum] + `<span class="vg-gizli">${etiket}</span>`;
    }
  };

  const oynat = () => {
    const p = video.play();
    if (p && typeof p.catch === 'function') {
      p.then(() => { otomatikEngel = false; dugmeGuncelle(); }).catch((err) => {
        if (err && err.name === 'AbortError') return; // pause() araya girdi; hata değil
        otomatikEngel = true; // ör. iOS düşük güç modu: düğme görünür kalır
        dugmeGuncelle();
      });
    }
  };

  const karar = () => {
    if (!dongu) return;
    const izin = (!azHareket.matches || kullaniciBaslatti) && !kullaniciDurdurdu && document.visibilityState !== 'hidden';
    if (gorunur && izin) { if (video.paused) oynat(); }
    else if (!video.paused) video.pause();
    dugmeGuncelle();
  };

  // ── Dinleyiciler ───────────────────────────────────────────────
  const onPlaying = () => { if (!basladi) { basladi = true; gonder('video_start'); } dugmeGuncelle(); };
  const onIlerleme = () => {
    const d = video.duration, t = video.currentTime;
    if (basladi && Number.isFinite(d) && d > 0) {
      if (dongu && son >= d * 0.8 && t + 0.5 < son) bitti(); // döngü başa sardı = ilk tamamlanma
      else if (!yarim && t >= d * 0.5) { yarim = true; gonder('video_progress'); }
    }
    son = t;
  };
  const onEnded = () => { if (!video.loop) bitti(); dugmeGuncelle(); };
  const onDugme = () => {
    if (video.paused || video.ended) { kullaniciDurdurdu = false; kullaniciBaslatti = true; oynat(); }
    else { kullaniciDurdurdu = true; video.pause(); }
    dugmeGuncelle();
  };
  const onGorunurluk = () => karar();

  video.addEventListener('playing', onPlaying);
  video.addEventListener('play', dugmeGuncelle);
  video.addEventListener('pause', dugmeGuncelle);
  video.addEventListener('timeupdate', onIlerleme);
  video.addEventListener('seeking', onIlerleme);
  video.addEventListener('ended', onEnded);
  video.addEventListener('loadstart', kaynakDogrula);
  dugme.addEventListener('click', onDugme);
  if (dongu) video.addEventListener('click', onDugme); // döngüde videoya dokunmak da durdurur / oynatır
  document.addEventListener('visibilitychange', onGorunurluk);
  if (azHareket.addEventListener) azHareket.addEventListener('change', karar);

  let io = null;
  if (dongu && 'IntersectionObserver' in window) {
    const esikler = Array.from({ length: 21 }, (_, i) => i / 20);
    io = new IntersectionObserver((kayitlar) => {
      for (const k of kayitlar) {
        const kok = k.rootBounds;
        // Ekrandan uzun öğe %50'ye hiç ulaşamaz: ekranın yarısını doldurması da "görünür" sayılır.
        gorunur = k.isIntersecting && (k.intersectionRatio >= esik || (!!kok && k.intersectionRect.height >= kok.height * esik));
      }
      karar();
    }, { threshold: esikler });
    io.observe(el);
  }

  /** @type {Denetleyici} */
  const d = {
    id, el, video,
    variant: bicim,
    cta(hedefEl) {
      const ctaId = hedefEl && hedefEl.getAttribute ? hedefEl.getAttribute('data-vg-cta-id') : null;
      gonder('video_cta_click', ctaId ? { cta_id: ctaId } : undefined);
    },
    destroy() {
      if (io) io.disconnect();
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('play', dugmeGuncelle);
      video.removeEventListener('pause', dugmeGuncelle);
      video.removeEventListener('timeupdate', onIlerleme);
      video.removeEventListener('seeking', onIlerleme);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('loadstart', kaynakDogrula);
      dugme.removeEventListener('click', onDugme);
      video.removeEventListener('click', onDugme);
      document.removeEventListener('visibilitychange', onGorunurluk);
      if (azHareket.removeEventListener) azHareket.removeEventListener('change', karar);
      if (dugmeBizim) dugme.remove();
      if (KAYIT.get(id) === d) KAYIT.delete(id);
      delete /** @type {any} */ (el).__vg;
    },
  };
  /** @type {any} */ (el).__vg = d;
  KAYIT.set(id, d);
  dugmeGuncelle();
  return d;
}

/**
 * Sayfadaki (ya da `kok` içindeki) bütün [data-vg] kaplarını bağlar. Tekrar çağrılabilir; bağlı olanı atlar.
 * @param {Secenek & { root?: ParentNode }} [secenek]
 * @returns {{ items: Denetleyici[], destroy: () => void }}
 */
export function init(secenek = {}) {
  const { root, ...geri } = secenek;
  genel = { ...genel, ...geri };
  /** @type {Denetleyici[]} */
  const items = [];
  (root || document).querySelectorAll('[data-vg]').forEach((el) => {
    const d = mount(/** @type {HTMLElement} */ (el));
    if (d) items.push(d);
  });
  return { items, destroy: () => items.forEach((d) => d.destroy()) };
}

if (typeof window !== 'undefined') /** @type {any} */ (window).VideoGomme = { init, mount, defaultTrack };
