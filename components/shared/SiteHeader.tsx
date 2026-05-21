'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { List, X, Phone, WhatsappLogo, ArrowRight } from '@phosphor-icons/react';
import { ICON_WEIGHT } from '@/lib/design/tokens';
import { notifyWhatsappIntent } from '@/lib/notifyWhatsappIntent';
import { notifyPhoneCall } from '@/lib/notifyPhoneCall';
import { BUSINESS_INFO, WHATSAPP_URL } from '@/lib/business/info';

type Tone = 'dark' | 'warm';

interface SiteHeaderProps {
  /** dark: ürün/teknik sayfalar (/, /urunler/*, /marka/*, /urun/*, /depomuz)
   *  warm: kurumsal sayfalar (/hakkimizda, /iletisim) */
  tone?: Tone;
  /** Geriye dönük uyumluluk: önceki adı `theme`, kademeli geçiş için */
  theme?: Tone;
}

const NAV = [
  { href: '/urunler', label: 'Ürün Kataloğu' },
  { href: '/hakkimizda', label: 'Hakkımızda' },
  { href: '/iletisim', label: 'İletişim' },
];

const NAV_MOBILE = [
  { href: '/', label: 'Anasayfa' },
  ...NAV,
];

const PHONE_TEL = BUSINESS_INFO.phone.tel;

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function SiteHeader({ tone, theme }: SiteHeaderProps) {
  const resolvedTone: Tone = tone ?? theme ?? 'dark';
  const isWarm = resolvedTone === 'warm';
  const pathname = usePathname();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Route değişince drawer'ı kapat
  useEffect(() => {
    const closeDrawer = window.setTimeout(() => {
      setMobileOpen(false);
    }, 0);
    return () => window.clearTimeout(closeDrawer);
  }, [pathname]);

  // Drawer açıkken body scroll lock
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

  // ESC ile kapat
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // ─── Sticky scroll arka plan + alt çizgi reaksiyonu ────────────
  // Hem dark hem warm sayfalarda header KOYU kalır (logo yutulmasın, kimlik tutarlı).
  // Warm = hub-dark (warm-siyah, footer ile aynı dil); dark = fe-surface.
  const headerBg = isWarm
    ? scrolled
      ? 'bg-hub-dark/92 backdrop-blur-md border-b border-hub-warm/15 shadow-[0_1px_0_rgba(255,255,255,0.04)]'
      : 'bg-hub-dark border-b border-transparent'
    : scrolled
      ? 'bg-fe-surface/92 backdrop-blur-md border-b border-fe-border shadow-[0_1px_0_rgba(255,255,255,0.04)]'
      : 'bg-fe-surface border-b border-fe-border/40';

  // ─── Top bar — sadece dark theme'da render edilir ───────────────
  const showTopBar = !isWarm;

  return (
    <>
      {showTopBar && (
        <div className="hidden bg-fe-surface border-b border-fe-border text-center sm:block sm:py-2 sm:text-sm sm:px-4">
          <span className="font-semibold text-white">Fabrika Çıkışlı Satış</span>
          <span className="hidden sm:inline mx-2 sm:mx-4 text-fe-muted">|</span>
          <span className="hidden sm:inline text-fe-text/80">Depo: İstanbul / Tuzla</span>
          <span className="mx-2 sm:mx-4 text-fe-muted">|</span>
          <span className="text-hub-gold-soft font-semibold">Bölgeye Göre İskonto</span>
        </div>
      )}

      <header
        className={`sticky top-0 z-50 transition-[background-color,border-color,box-shadow] duration-200 ease-out ${headerBg}`}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-11 sm:h-16">
            {/* Logo */}
            <Link
              href="/"
              prefetch={false}
              className="flex items-center shrink-0"
              aria-label="Taşyünü Fiyatları — Anasayfa"
            >
              <Image
                src="/tasyunu-logo.webp"
                alt="Taşyünü Fiyatları"
                width={260}
                height={54}
                priority
                className="h-6 sm:h-9 w-auto"
              />
            </Link>

            {/* Nav */}
            <nav className="flex items-center gap-1 sm:gap-2">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                const linkBase   = 'text-fe-text/85 hover:text-hub-gold-soft';
                const activeText = 'text-hub-gold-soft';
                const underline  = 'bg-hub-gold-soft';
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium transition-colors ${
                      active ? activeText : linkBase
                    }`}
                  >
                    <span>{item.label}</span>
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute left-3 right-3 -bottom-0.5 h-[2px] origin-left transition-transform duration-200 ${underline} ${
                        active ? 'scale-x-100' : 'scale-x-0'
                      }`}
                    />
                  </Link>
                );
              })}

              {/* Desktop iletişim CTA'ları — WhatsApp + Hemen Ara (sürekli görünür) */}
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => notifyWhatsappIntent({ source: 'header_desktop' })}
                className="hidden sm:inline-flex items-center gap-1.5 ml-2 px-3 py-2 rounded-lg bg-[#25D366]/15 border border-[#25D366]/35 text-[#25D366] hover:bg-[#25D366]/25 text-sm font-semibold transition-colors"
                aria-label="WhatsApp ile yazın"
              >
                <WhatsappLogo weight="fill" size={16} />
                <span>WhatsApp</span>
              </a>
              {/* Desktop CTA */}
              <Link
                href="/"
                prefetch={false}
                className="btn-primary !py-2 !px-4 !text-sm ml-1 sm:ml-2 hidden sm:inline-flex"
              >
                Hesap Makinesi
              </Link>

              {/* Mobile hamburger */}
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-fe-text/90 hover:text-hub-gold-soft hover:bg-fe-surface-raised/50 transition-colors"
                aria-label="Menüyü aç"
                aria-expanded={mobileOpen}
                aria-controls="mobile-drawer"
              >
                <List weight={ICON_WEIGHT} size={26} />
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-black/65 backdrop-blur-sm transition-opacity duration-300 sm:hidden ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      {/* Mobile Drawer Panel */}
      <aside
        id="mobile-drawer"
        className={`fixed top-0 right-0 z-[70] h-dvh w-[88%] max-w-sm bg-hub-dark text-fe-text flex flex-col shadow-[-8px_0_32px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-out sm:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobil menü"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-fe-border/40 shrink-0">
          <Image
            src="/tasyunu-logo.webp"
            alt="Taşyünü Fiyatları"
            width={200}
            height={42}
            className="h-7 w-auto"
          />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-fe-text/85 hover:text-hub-gold-soft hover:bg-fe-surface-raised/50 transition-colors"
            aria-label="Menüyü kapat"
          >
            <X weight={ICON_WEIGHT} size={22} />
          </button>
        </div>

        {/* Links */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-1">
          {NAV_MOBILE.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-3.5 rounded-lg text-base font-medium transition-colors ${
                  active
                    ? 'text-hub-gold-soft bg-hub-gold-soft/10 ring-1 ring-hub-gold-soft/20'
                    : 'text-fe-text/90 hover:text-hub-gold-soft hover:bg-fe-surface-raised/40'
                }`}
              >
                <span>{item.label}</span>
                <ArrowRight
                  weight={ICON_WEIGHT}
                  size={16}
                  className={active ? 'text-hub-gold-soft' : 'text-fe-text/40'}
                />
              </Link>
            );
          })}
        </nav>

        {/* Footer shortcuts */}
        <div className="border-t border-fe-border/40 px-4 py-5 space-y-3 shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <a
              href={`tel:${PHONE_TEL}`}
              onClick={() => notifyPhoneCall({ source: 'header_mobile' })}
              className="inline-flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-fe-border text-fe-text/90 hover:text-hub-gold-soft hover:border-hub-gold-soft/50 text-sm font-medium transition-colors min-h-[44px]"
            >
              <Phone weight={ICON_WEIGHT} size={16} /> Ara
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => notifyWhatsappIntent({ source: 'header_mobile' })}
              className="inline-flex items-center justify-center gap-2 px-3 py-3 rounded-lg bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/25 text-sm font-medium transition-colors min-h-[44px]"
            >
              <WhatsappLogo weight="fill" size={16} /> WhatsApp
            </a>
          </div>
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="btn-primary w-full"
          >
            Hesap Makinesi
            <ArrowRight weight={ICON_WEIGHT} size={18} className="btn-arrow" />
          </Link>
        </div>
      </aside>
    </>
  );
}
