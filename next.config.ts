import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Türkçe karakterli klasör yolu (Tasyunufİyatlari) Windows + Node + Webpack
// enhanced-resolve kombinasyonunda segment kaybına yol açıyor — resolver
// "tasyunu-front" parçasını düşürüp üst dizinde tailwindcss arıyor. Webpack'in
// modül arama köklerini sabit `tasyunu-front/node_modules` ile başlatarak
// bu davranışı engelliyoruz.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const projectNodeModules = path.join(projectRoot, "node_modules");

const nextConfig: NextConfig = {
  webpack(config) {
    config.resolve = config.resolve ?? {};
    const existingModules = Array.isArray(config.resolve.modules)
      ? config.resolve.modules
      : ["node_modules"];
    config.resolve.modules = [projectNodeModules, ...existingModules];
    return config;
  },
  turbopack: {
    root: projectRoot,
  },
  images: {
    // Supabase Storage'a yüklenen görseller zaten optimize boyut/format'ta
    // (WebP, doğru en-boy oranı). Vercel'in image optimization katmanı bu
    // durumda gereksiz transformasyon üretiyor — Hobby tier 5K/ay limit hızla
    // dolardı. unoptimized:true → orijinal URL'ler direkt servis edilir,
    // transformation sayılmaz.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async redirects() {
    return [
      // Eski WP kategori/shop/marka redirect'leri proxy.ts içinde query
      // temizliğiyle birlikte yönetilir; next.config redirects query string'i
      // koruduğu için burada tutmak faceted URL enkazını yaşatıyordu.

      // ─── /bolge geçici kapama (Sprint 0 / Faz 5) ───────
      // 302 (permanent: false) — Sprint 4-5'te Tier 1/2 bölge sayfaları
      // gerçek içerikle yeniden açılacak. 301 yapılırsa Google ileride
      // yeni sayfaları kabul ederken zorlanır.
      {
        source: '/urunler/:kategori/:slug',
        has: [{ type: 'query', key: 'kalinlik', value: '(?<kalinlik>.*)' }],
        destination: '/urunler/:kategori/:slug/:kalinlik',
        permanent: true,
      },
      { source: '/bolge/:sehir/:ilce', destination: '/iletisim', permanent: false },
      { source: '/bolge/:sehir',       destination: '/iletisim', permanent: false },
      { source: '/bolge',              destination: '/iletisim', permanent: false },
    ];
  },
};

// Sentry source map upload + tunneling — sadece SENTRY_AUTH_TOKEN varsa devreye girer.
// DSN yoksa sentry.{client,server,edge}.config.ts no-op çalışır, çakışma yok.
export default withSentryConfig(nextConfig, {
  // Sentry org + project — DSN'den otomatik çıkarılabilir ama explicit yazmak güvenli
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // CI'de auth token varsa source map upload edilir; yoksa sessizce atlanır
  silent: !process.env.CI,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Production source map'leri client'a bundle etme; sadece Sentry'ye yükle
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Reklam-engelleyici tunelı için /monitoring rewrite (ücretsiz tier'da opsiyonel)
  tunnelRoute: '/monitoring',

  // Telemetry kapalı (build-time hız)
  telemetry: false,
});
