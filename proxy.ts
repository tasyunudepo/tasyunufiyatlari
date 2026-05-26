import { NextRequest, NextResponse } from 'next/server';

const LEGACY_QUERY_PARAMS = [
  'add_to_wishlist',
  '_wpnonce',
  'orderby',
  'filter_paket_ici_m2',
  'gridcookie',
  'source_id',
  'source_tax',
  'pwb-brand',
  'pwb-brand-filter',
  'paged',
  'product-page',
  'min_price',
  'max_price',
  'wc-ajax',
];

const LEGACY_CATEGORY_DESTINATIONS: Record<string, string> = {
  'tasyunu-levhalar': '/urunler/tasyunu-levha',
  'eps-levhalar': '/urunler/eps-levha',
  dubeller: '/urunler/dubel',
  yapistiricilar: '/urunler/yapistirici',
  fileler: '/urunler/file',
  profiller: '/urunler/fileli-kose-profilleri',
  sivalar: '/urunler/siva',
  astarlar: '/urunler/astar',
  kaplamalar: '/urunler/kaplama',
  boyalar: '/marka/filli-boya',
  'yardimci-urunler': '/urunler',
};

const LEGACY_BRAND_DESTINATIONS: Record<string, string> = {
  dalmacyali: '/marka/dalmacyali',
  fawori: '/marka/filli-boya',
  'filli-boya': '/marka/filli-boya',
  optimix: '/marka/optimix',
  tekno: '/marka/tekno',
  oem: '/marka/oem',
};

function gone() {
  return new NextResponse('Gone', {
    status: 410,
    headers: {
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

function legacyDestination(pathname: string): string | null {
  if (
    pathname.startsWith('/wp-admin') ||
    pathname.startsWith('/wp-content') ||
    pathname.startsWith('/wp-includes') ||
    pathname === '/wp-login.php' ||
    pathname === '/xmlrpc.php' ||
    pathname.endsWith('.php') ||
    pathname.endsWith('/feed') ||
    pathname.includes('/feed/')
  ) {
    return 'GONE';
  }

  if (pathname.includes('//')) {
    return pathname.replace(/\/{2,}/g, '/');
  }

  const shopMatch = pathname.match(/^\/shop(?:\/page\/\d+)?\/?$/);
  if (shopMatch) return '/urunler';

  if (pathname === '/urunler/aksesuar' || pathname === '/urunler/aksesuar/') {
    return '/urunler';
  }

  if (pathname === '/tasyunu-eps-depo' || pathname.startsWith('/tasyunu-eps-depo/')) {
    return '/depomuz';
  }

  const categoryMatch = pathname.match(/^\/kategori\/([^/]+)(?:\/page\/\d+)?\/?$/);
  if (categoryMatch) {
    return LEGACY_CATEGORY_DESTINATIONS[categoryMatch[1]] ?? '/urunler';
  }

  if (pathname === '/marka/fawori' || pathname.startsWith('/marka/fawori/')) {
    return '/marka/filli-boya';
  }
  if (pathname === '/marka/filli-boya/expert' || pathname.startsWith('/marka/filli-boya/expert/')) {
    return '/marka/filli-boya';
  }

  const brandMatch = pathname.match(/^\/marka\/([^/]+)(?:\/page\/\d+)?\/?$/);
  if (brandMatch) {
    return LEGACY_BRAND_DESTINATIONS[brandMatch[1]] ?? `/marka/${brandMatch[1]}`;
  }

  const productBrandMatch = pathname.match(/^\/product-brands\/([^/]+)\/?$/);
  if (productBrandMatch) {
    return LEGACY_BRAND_DESTINATIONS[productBrandMatch[1]] ?? '/urunler';
  }

  return null;
}

function canonicalizeLegacyUrl(req: NextRequest): NextResponse | null {
  const destination = legacyDestination(req.nextUrl.pathname);
  if (destination === 'GONE') return gone();

  const hasLegacyQuery = LEGACY_QUERY_PARAMS.some((param) => req.nextUrl.searchParams.has(param));
  if (destination === req.nextUrl.pathname && !hasLegacyQuery) return null;
  if (!destination && !hasLegacyQuery) return null;

  const url = req.nextUrl.clone();
  if (destination) url.pathname = destination;
  for (const param of LEGACY_QUERY_PARAMS) {
    url.searchParams.delete(param);
  }

  return NextResponse.redirect(url, 301);
}

// HTTP Basic Auth — /ofis ve /api/admin/* rotalarını korur.
// Next.js 16'da "proxy" convention'ı kullanılır (eski adı: middleware).
// Edge runtime'da otomatik çalışır.
//
// Env değişkenleri:
//   - ADMIN_USER     (opsiyonel, default 'admin')
//   - ADMIN_PASSWORD (zorunlu — yoksa admin girişi imkânsız)
//   - PATRON_PASSWORD (opsiyonel — ikinci kullanıcı 'patron' için)
//
// /api/admin/logout endpoint'i her zaman 401 döner; tarayıcı cached
// basic-auth credential'larını bu sinyalle bırakır (logout pattern).
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const legacyResponse = canonicalizeLegacyUrl(req);
  if (legacyResponse) return legacyResponse;

  // Logout endpoint: yetkili olsa bile her zaman 401 döner.
  if (pathname === '/api/admin/logout') {
    return new NextResponse('Çıkış yapıldı', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Yönetim Paneli"',
        'Cache-Control': 'no-store',
      },
    });
  }

  // /ofis sayfası ve /api/admin/* rotalarını koru
  const isProtected =
    pathname.startsWith('/ofis') ||
    pathname.startsWith('/api/admin');

  if (!isProtected) {
    return NextResponse.next();
  }

  const authHeader = req.headers.get('authorization');

  if (authHeader) {
    const base64 = authHeader.replace('Basic ', '');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const decoded = new TextDecoder('utf-8').decode(bytes);
    const colonIdx = decoded.indexOf(':');
    const user = decoded.slice(0, colonIdx);
    const pass = decoded.slice(colonIdx + 1);

    const adminUser = process.env.ADMIN_USER ?? 'admin';
    const adminPass = process.env.ADMIN_PASSWORD;
    const patronPass = process.env.PATRON_PASSWORD;

    const isAdmin = !!adminPass && user === adminUser && pass === adminPass;
    const isPatron = !!patronPass && user === 'patron' && pass === patronPass;

    if (isAdmin || isPatron) {
      const headers = new Headers(req.headers);
      headers.set('x-auth-user', user);
      return NextResponse.next({ request: { headers } });
    }
  }

  return new NextResponse('Yetkisiz erişim', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Yönetim Paneli"',
    },
  });
}

export const config = {
  matcher: [
    '/ofis/:path*',
    '/api/admin/:path*',
    '/kategori/:path*',
    '/shop/:path*',
    '/tasyunu-eps-depo/:path*',
    '/marka/:brand/page/:page*',
    '/marka/fawori/:path*',
    '/marka/filli-boya/expert/:path*',
    '/product-brands/:path*',
    '/wp-admin/:path*',
    '/wp-content/:path*',
    '/wp-includes/:path*',
    '/wp-login.php',
    '/xmlrpc.php',
    '/:path*.php',
    '/:path*/feed',
    '/:path*/feed/:path*',
  ],
};
