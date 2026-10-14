// Kalınlık / yoğunluk hub'larına bağlantı bandı (14 Ekim 2026). Sunucu HTML'inde düz bağlantı; bağlantı
// yazısı aramayla aynıdır ("10 cm taş yünü fiyatları").

import Link from 'next/link'

export interface HubLinkBandGroup {
  title: string
  links: Array<{ label: string; href: string }>
}

export default function HubLinkBand({ groups, className = '' }: { groups: HubLinkBandGroup[]; className?: string }) {
  const visible = groups.filter((g) => g.links.length > 0)
  if (visible.length === 0) return null
  return (
    <div className={`space-y-3 ${className}`} data-testid="hub-link-band">
      {visible.map((group) => (
        <nav key={group.title} aria-label={group.title}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-hub-muted">{group.title}</p>
          <ul className="flex flex-wrap gap-1.5">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center rounded-lg border border-hub-rule bg-white px-3 text-sm font-medium text-hub-ink-2 transition-colors hover:border-hub-gold/60 hover:text-hub-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-gold"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>
  )
}
