import { permanentRedirect } from 'next/navigation';
import { formatThicknessSegment, parseThicknessQueryValue } from '@/lib/catalog/thickness-url';

interface Props {
  params: Promise<{ slug: string }>;
}

// Eski (verbose) ürün slug prefix'i → yeni kanonik ürün URL'i.
// Sıra önemli: en uzun/spesifik prefix önce.
const PREFIX_MAP: Array<[string, string]> = [
  // Dalmaçyalı
  ['dalmacyali-stonewool-sw035',         '/urunler/tasyunu-levha/dalmacyali-sw035-tasyunu'],
  ['dalmacyali-cs60',                    '/urunler/tasyunu-levha/dalmacyali-cs60-tasyunu'],
  ['dalmacyali-double-carbon',           '/urunler/eps-levha/dalmacyali-double-carbon-eps'],
  ['dalmacyali-ideal-carbon',            '/urunler/eps-levha/dalmacyali-ideal-carbon-eps'],

  // Expert (Fawori Expert) — taşyünü
  ['expert-hd150',                       '/urunler/tasyunu-levha/expert-hd150-tasyunu'],
  ['expert-ld125',                       '/urunler/tasyunu-levha/expert-ld125-tasyunu'],
  ['expert-premium',                     '/urunler/tasyunu-levha/expert-premium-tasyunu'],
  ['expert-pw50',                        '/urunler/tasyunu-levha/expert-pw50-tasyunu'],
  ['expert-rf150',                       '/urunler/tasyunu-levha/expert-rf150-tasyunu'],
  ['expert-vf80',                        '/urunler/tasyunu-levha/expert-vf80-tasyunu'],

  // Expert — EPS
  ['expert-035-eps',                     '/urunler/eps-levha/expert-eps-035-beyaz-eps'],
  ['expert-eps-karbonlu',                '/urunler/eps-levha/expert-eps-karbonlu-eps'],
  ['expert-eps-beyaz',                   '/urunler/eps-levha/expert-eps-beyaz-eps'],

  // Expert — aksesuar
  ['expert-siva',                        '/urunler/siva/expert-siva'],

  // Optimix
  ['optimix-isi-yalitim-levhasi-karbon', '/urunler/eps-levha/optimix-optimix-karbonlu-eps'],
  ['optimix-donati-filesi',              '/urunler/file/optimix-file-f160'],
];

// Prefix eşleşmezse: kategori sayfasına yönlendir
function keywordFallback(slug: string): string {
  if (/tasyunu|tas-yunu|tas_yunu/i.test(slug))                              return '/urunler/tasyunu-levha';
  if (/eps|karbonlu-isi|polistiren/i.test(slug))                            return '/urunler/eps-levha';
  if (/dubel/i.test(slug))                                                  return '/urunler/dubel';
  if (/yapistirici/i.test(slug))                                            return '/urunler/yapistirici';
  if (/file(?!li)/i.test(slug))                                             return '/urunler/file';
  if (/profil|fileli-kose/i.test(slug))                                     return '/urunler/fileli-kose-profilleri';
  if (/siva/i.test(slug))                                                   return '/urunler/siva';
  if (/astar/i.test(slug))                                                  return '/urunler/astar';
  if (/kaplama/i.test(slug))                                                return '/urunler/kaplama';
  if (/boya/i.test(slug))                                                   return '/marka/filli-boya';
  return '/urunler';
}

// "...-10-cm" / "...-5cm" / "...-7-5-cm-levha" → "10-cm" / "5-cm" / "7-5-cm"
function extractKalinlikSegment(slug: string): string | null {
  const match = slug.match(/(\d+(?:[.,-]\d+)?)-?cm/i);
  const thickness = parseThicknessQueryValue(match?.[1]?.replace('-', '.') ?? null);
  return thickness == null ? null : formatThicknessSegment(thickness);
}

export default async function EskiUrunRedirect({ params }: Props) {
  const { slug } = await params;
  const lower = slug.toLowerCase();

  for (const [prefix, dest] of PREFIX_MAP) {
    if (lower.startsWith(prefix)) {
      const kalinlikSegment = extractKalinlikSegment(lower);
      const isPlatePath =
        dest.includes('/urunler/tasyunu-levha/') || dest.includes('/urunler/eps-levha/');
      const url = isPlatePath && kalinlikSegment ? `${dest}/${kalinlikSegment}` : dest;
      permanentRedirect(url);
    }
  }

  permanentRedirect(keywordFallback(lower));
}
