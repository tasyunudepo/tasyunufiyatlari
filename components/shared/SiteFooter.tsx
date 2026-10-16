import Image from 'next/image';
import Link from 'next/link';
import { GENERATOR_PAGE_PATH } from '@/lib/portfolio/offers';
import { AUTHORIZED_DEALER_LABEL } from '@/lib/business/info';
import { COMPARISON_PATH, DENSITY_120_PATH, DENSITY_150_PATH, HUB_THICKNESSES, thicknessHubPath } from '@/lib/compare/hubs';

type Tone = 'dark' | 'warm';

interface SiteFooterProps {
  tone?: Tone;
}

const GROUPS = [
  {
    eyebrow: 'Ürünler',
    links: [
      { href: '/', label: 'Hesap Makinesi' },
      { href: '/urunler', label: 'Ürün Kataloğu' },
      { href: '/urunler/tasyunu-levha', label: 'Taşyünü Levha' },
      { href: '/urunler/eps-levha', label: 'EPS Levha' },
    ],
  },
  {
    eyebrow: 'Kurumsal',
    links: [
      { href: '/hakkimizda', label: 'Hakkımızda' },
      { href: '/hakkimizda#kanallar', label: 'Satış Kanalları' },
      { href: '/iletisim', label: 'Görüşme Noktası' },
      { href: '/marka/dalmacyali', label: 'Markalar' },
    ],
  },
  {
    eyebrow: 'İletişim',
    links: [
      { href: '/#mantolama-hesaplayici', label: 'Fiyatımı Hesapla' },
      { href: '/iletisim', label: 'Teklif referansıyla iletişim' },
    ],
  },
  {
    eyebrow: 'Yasal',
    links: [
      { href: '/kvkk', label: 'KVKK Aydınlatma' },
      { href: '/cerez-politikasi', label: 'Çerez Politikası' },
      { href: '/kullanim-kosullari', label: 'Kullanım Koşulları' },
      { href: '/iade-ve-iptal', label: 'İade ve İptal' },
    ],
  },
];

export default function SiteFooter({ tone = 'dark' }: SiteFooterProps) {
  // Footer hem dark hem warm sayfalarda KOYU kalır (kimlik tutarlılığı, logo yutulmasın).
  // tone prop'u şimdilik geriye-uyumluluk için duruyor; warm = dark ile aynı koyu zemin.
  void tone;

  const surface    = 'bg-hub-dark border-t border-hub-rule-strong';
  // Saydamlık oranları KALDIRILDI (27 Tem 2026). /55 ve /60 seviyeleri
  // koyu zeminde metni WCAG AA eşiğinin (4.5) altına düşürüyordu; footer
  // dışarıda, gündüz, telefonda okunan bir yer. Renkler artık tam güçte.
  const eyebrow    = 'text-hub-gold-soft';
  const linkText   = 'text-hub-warm hover:text-hub-gold-soft';
  const sloganText = 'text-hub-warm/85';
  const ruleSoft   = 'border-hub-rule-strong/60';
  const copyText   = 'text-hub-warm/55';

  return (
    <footer className={`${surface} mt-16`}>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-10">
          {/* Logo + slogan — 2 kolon */}
          <div className="col-span-2 md:col-span-1">
            <Image
              src="/tasyunu-logo.webp"
              alt="Taşyünü Fiyatları"
              width={260}
              height={54}
              className="h-7 w-auto mb-4"
            />
            <p className={`${sloganText} text-sm leading-relaxed max-w-xs`}>
              Taşyünü ve EPS fiyatlarını, tam araç ve set nakliye koşullarıyla hesaplayın.
            </p>
            <p className="mt-3 text-sm font-semibold text-hub-gold-soft" data-testid="footer-authorized-dealer">
              ÖzerGrup, {AUTHORIZED_DEALER_LABEL}dir.
            </p>
          </div>

          {/* 4 grup */}
          {GROUPS.map((group) => (
            <div key={group.eyebrow}>
              {/* `style={{ color: 'currentColor' }}` KALDIRILDI (27 Tem 2026).
                  Satır içi stil sınıf rengini eziyordu ve `currentColor`
                  rengi ebeveynden miras alınana eşitliyordu; sonuç, footer
                  başlıklarının koyu zeminde koyu renkle basılmasıydı —
                  ölçülen kontrast 1,03 (görünmez sayılır). */}
              <div className={`eyebrow ${eyebrow} mb-4`}>
                {group.eyebrow}
              </div>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={`${group.eyebrow}-${link.label}`}>
                    <Link
                      href={link.href}
                      prefetch={false}
                      className={`${linkText} text-sm transition-colors`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Hub bandı (14 Ekim 2026): her sayfadan kalınlık ve yoğunluk hub'larına düz bağlantı; yazı aramayla aynı. */}
        <nav aria-label="Taşyünü fiyatları" className={`mt-12 pt-6 border-t ${ruleSoft}`} data-testid="footer-hub-links">
          <div className={`eyebrow ${eyebrow} mb-3`}>Taşyünü fiyatları</div>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {HUB_THICKNESSES.map((t) => (
              <li key={t}>
                <Link href={thicknessHubPath(t)} prefetch={false} className={`${linkText} text-sm transition-colors`}>
                  {t} cm taş yünü
                </Link>
              </li>
            ))}
            <li>
              <Link href={DENSITY_150_PATH} prefetch={false} className={`${linkText} text-sm transition-colors`}>
                150 yoğunluk taş yünü
              </Link>
            </li>
            <li>
              <Link href={DENSITY_120_PATH} prefetch={false} className={`${linkText} text-sm transition-colors`}>
                120 yoğunluk taş yünü
              </Link>
            </li>
            <li>
              <Link href={COMPARISON_PATH} prefetch={false} className={`${linkText} text-sm transition-colors`}>
                Taşyünü karşılaştırma
              </Link>
            </li>
          </ul>
        </nav>

        <div className={`mt-6 pt-6 border-t ${ruleSoft} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
          <p className={`${copyText} text-xs`}>
            © {new Date().getFullYear()} Taşyünü Fiyatları. Tüm hakları saklıdır.
          </p>
          <p className={`${copyText} text-xs`}>
            Fabrika çıkışlı satış · Tuzla görüşme noktası
            {' · '}
            {/* Ayrı bir işletmenin sayfasına giden tek bağlantı; ürün ve
                teklif ekranlarında yer almaz (yuvarlak masa, 13 Ekim 2026). */}
            <Link
              href={GENERATOR_PAGE_PATH}
              prefetch={false}
              className={`${linkText} transition-colors`}
            >
              Kiralık Jeneratör
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
