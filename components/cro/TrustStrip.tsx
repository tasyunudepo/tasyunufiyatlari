import { Truck, ShieldCheck, FileText } from '@phosphor-icons/react/dist/ssr';
import { ICON_WEIGHT } from '@/lib/design/tokens';

const ITEMS = [
  {
    Icon: Truck,
    title: '81 ile sevkiyat',
    body: 'Kısmi yük + tam araç, tüm Türkiye.',
  },
  {
    Icon: ShieldCheck,
    title: 'TSE & CE uyumlu sistem',
    body: 'Tüm kalemler standartlara uygun, raporlu.',
  },
  {
    Icon: FileText,
    title: 'Resmi PDF teklif',
    body: 'Teklif referans kodu ve güncel hesap bilgileri.',
  },
] as const;

export function TrustStrip() {
  return (
    <section
      aria-label="Güven göstergeleri"
      className="border-y border-fe-border/40 bg-fe-surface/60"
    >
      <div className="max-w-[1200px] mx-auto px-4 py-4 sm:py-5">
        <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
          {ITEMS.map(({ Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <Icon
                size={20}
                weight={ICON_WEIGHT}
                className="mt-0.5 shrink-0 text-brand"
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold text-fe-text leading-snug">{title}</p>
                <p className="mt-0.5 text-xs text-fe-muted leading-relaxed">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
