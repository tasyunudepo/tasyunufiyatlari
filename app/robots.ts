import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // İyi botları indekslenmeyecek/değersiz yüzeylerden uzak tut → gereksiz crawl edge isteğini azalt.
        // '/api' tüm API alt yollarını (admin dahil) kapsar.
        disallow: [
          '/api',
          '/ofis',
          '/piyasa',
          '/wp-admin',
          '/wp-content',
          '/wp-includes',
          '/wp-login.php',
          '/xmlrpc.php',
          '/*.php',
          '/*/feed',
          '/feed',
        ],
      },
    ],
    sitemap: 'https://www.tasyunufiyatlari.com/sitemap.xml',
  };
}
