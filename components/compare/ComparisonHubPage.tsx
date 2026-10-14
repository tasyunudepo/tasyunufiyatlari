// Merkez (hub) sayfa düzeni: kalınlık ve yoğunluk sayfaları (Emrah onayı, 14 Ekim 2026).
// Aramayla aynı başlayan başlık → özet → aynı koşulda tablo (fiyat sunucu HTML'inde) → soru-cevap →
// tek ürüne, set hesabına ve kardeş hub'lara bağlantılar. Fiyat hesabı sayfa dosyasında (sunucu) yapılır;
// bu bileşen Bonus fiyat modüllerini içe aktarmaz (tests/contracts/bonus-price-privacy).

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import SiteHeader from '@/components/shared/SiteHeader'
import SiteFooter from '@/components/shared/SiteFooter'
import MinimumOrderBanner from '@/components/sales/MinimumOrderBanner'
import ComparisonCenter from '@/components/compare/ComparisonCenter'
import { buildBreadcrumbList } from '@/lib/seo/buildBreadcrumbList'
import { SITE_ORIGIN } from '@/lib/seo/siteConfig'
import type { ComparisonSnapshot } from '@/lib/compare/vehiclePrices'
import type { HubCopy, HubFacts } from '@/lib/compare/hubCopy'

export interface HubLinkGroup {
  title: string
  links: Array<{ label: string; href: string; current?: boolean }>
}

interface Props {
  variant: 'kalinlik' | 'yogunluk_150_kalinlik'
  path: string
  copy: HubCopy
  facts: HubFacts
  snapshot: ComparisonSnapshot
  thicknessLinks: Record<number, string>
  breadcrumbs: Array<{ name: string; path: string }>
  linkGroups: HubLinkGroup[]
}

export default function ComparisonHubPage({
  variant,
  path,
  copy,
  facts,
  snapshot,
  thicknessLinks,
  breadcrumbs,
  linkGroups,
}: Props) {
  const breadcrumbNode = buildBreadcrumbList(breadcrumbs, SITE_ORIGIN)
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: copy.listName,
    url: `${SITE_ORIGIN}${path}`,
    numberOfItems: facts.priced.length,
    itemListElement: facts.priced
      .filter((item) => item.href)
      .map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: `${item.profile.displayName} ${facts.thicknessCm} cm`,
        url: `${SITE_ORIGIN}${item.href}`,
      })),
  }

  return (
    <div className="flex min-h-screen flex-col bg-hub-warm">
      <SiteHeader />
      <MinimumOrderBanner remember={false} fallbackDetail="Her üründe 1 kamyonun m²’si ve tutarı yazar." />

      <main className="flex-1">
        <section className="border-b border-hub-rule">
          <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6 sm:py-8">
            <nav aria-label="Sayfa yolu" className="mb-3">
              <ol className="flex flex-wrap items-center gap-1 text-xs text-hub-muted">
                {breadcrumbs.map((crumb, index) => (
                  <li key={crumb.path} className="flex items-center gap-1">
                    {index > 0 && <ChevronRight aria-hidden="true" className="h-3 w-3" />}
                    {index < breadcrumbs.length - 1 ? (
                      <Link href={crumb.path} className="underline-offset-2 hover:text-hub-gold hover:underline">
                        {crumb.name}
                      </Link>
                    ) : (
                      <span aria-current="page" className="font-semibold text-hub-ink-2">{crumb.name}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-hub-gold">{copy.eyebrow}</p>
            <h1 className="font-heading text-2xl font-bold text-hub-ink first-letter:uppercase sm:text-4xl">{copy.h1}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-hub-ink-2 sm:text-[15px] sm:leading-7" data-testid="hub-summary">
              {copy.summary}
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
          <ComparisonCenter
            variant={variant}
            fixedThicknessCm={facts.thicknessCm}
            thicknessLinks={thicknessLinks}
            snapshot={snapshot}
          />
        </section>

        <section aria-labelledby="hub-sss" className="mx-auto w-full max-w-[1200px] px-4 pb-6 sm:px-6">
          <h2 id="hub-sss" className="font-heading text-xl font-bold text-hub-ink sm:text-2xl">Sık sorulanlar</h2>
          <dl className="mt-3 divide-y divide-hub-rule rounded-2xl border border-hub-rule bg-hub-card" data-testid="hub-faq">
            {copy.faq.map((item) => (
              <div key={item.q} className="px-4 py-4 sm:px-5">
                <dt className="font-heading text-base font-bold text-hub-ink">{item.q}</dt>
                <dd className="mt-1 text-sm leading-6 text-hub-ink-2">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="hub-baglantilar" className="mx-auto w-full max-w-[1200px] px-4 pb-10 sm:px-6">
          <h2 id="hub-baglantilar" className="sr-only">İlgili sayfalar</h2>
          <div className="grid gap-4 md:grid-cols-3" data-testid="hub-links">
            {linkGroups.filter((group) => group.links.length > 0).map((group) => (
              <nav key={group.title} aria-label={group.title} className="rounded-2xl border border-hub-rule bg-hub-card p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-hub-muted">{group.title}</p>
                <ul className="mt-2 space-y-1">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      {link.current ? (
                        <span aria-current="page" className="block py-1.5 text-sm font-semibold text-hub-ink">{link.label}</span>
                      ) : (
                        <Link
                          href={link.href}
                          className="block py-1.5 text-sm font-medium text-hub-gold underline-offset-2 hover:underline"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbNode, itemList]) }}
      />
    </div>
  )
}
