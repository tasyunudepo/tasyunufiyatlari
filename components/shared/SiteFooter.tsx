import Image from 'next/image';
import Link from 'next/link';
import WhatsappLink from './WhatsappLink';
import { WHATSAPP_URL, MAILTO_URL } from '@/lib/business/info';

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
      { href: '/depomuz', label: 'Depomuz' },
      { href: '/marka/dalmacyali', label: 'Markalar' },
    ],
  },
  {
    eyebrow: 'İletişim',
    links: [
      { href: '/iletisim',  label: 'Telefon · WhatsApp · E-posta' },
      { href: WHATSAPP_URL, label: 'WhatsApp Destek', external: true },
      { href: MAILTO_URL,   label: 'E-posta Yaz' },
    ],
  },
  {
    eyebrow: 'Yasal',
    links: [
      { href: '/kvkk', label: 'KVKK Aydınlatma' },
      { href: '/cerez-politikasi', label: 'Çerez Politikası' },
      { href: '/kullanim-kosullari', label: 'Kullanım Koşulları' },
    ],
  },
];

export default function SiteFooter({ tone = 'dark' }: SiteFooterProps) {
  // Footer hem dark hem warm sayfalarda KOYU kalır (kimlik tutarlılığı, logo yutulmasın).
  // tone prop'u şimdilik geriye-uyumluluk için duruyor; warm = dark ile aynı koyu zemin.
  void tone;

  const surface    = 'bg-hub-dark border-t border-hub-rule-strong';
  const eyebrow    = 'text-hub-warm/55';
  const linkText   = 'text-hub-warm/75 hover:text-hub-gold-soft';
  const sloganText = 'text-hub-warm/60';
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
              Türkiye geneli taşyünü ve EPS fiyatları. Lojistik dahil mantolama maliyetinizi hesaplayın.
            </p>
          </div>

          {/* 4 grup */}
          {GROUPS.map((group) => (
            <div key={group.eyebrow}>
              <div
                className={`eyebrow ${eyebrow} mb-4`}
                style={{ color: 'currentColor' }}
              >
                {group.eyebrow}
              </div>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={`${group.eyebrow}-${link.label}`}>
                    {('external' in link && link.external) ? (
                      link.href.startsWith('https://wa.me/') ? (
                        <WhatsappLink
                          href={link.href}
                          source="footer_link"
                          className={`${linkText} text-sm transition-colors`}
                        >
                          {link.label}
                        </WhatsappLink>
                      ) : (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${linkText} text-sm transition-colors`}
                        >
                          {link.label}
                        </a>
                      )
                    ) : (
                      <Link
                        href={link.href}
                        prefetch={false}
                        className={`${linkText} text-sm transition-colors`}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={`mt-12 pt-6 border-t ${ruleSoft} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
          <p className={`${copyText} text-xs`}>
            © {new Date().getFullYear()} Taşyünü Fiyatları. Tüm hakları saklıdır.
          </p>
          <p className={`${copyText} text-xs`}>
            Fabrika çıkışlı satış · İstanbul / Tuzla depo
          </p>
        </div>
      </div>
    </footer>
  );
}
