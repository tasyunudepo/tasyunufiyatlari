// Ürün sayfasının üstünde "N cm mantolama taşyünleri yan yana" kutusu (Emrah kararı, 14 Ekim 2026).
//
// NEDEN: "taş yünü fiyatları" araması (28 günde 3.521 gösterim) SW035 10 cm sayfasına geliyor; ziyaretçi
// aynı kalınlıktaki bütün levhaları görmek istiyor. Karşılaştırma Merkezi Temmuz'dan beri var ama yalnız
// fiyat panelinin içinden, kalınlıksız bağlantıyla açılıyordu. Kutu kalınlığı ve gelinen ürünü adresle taşır;
// karşılaştırma sayfası `entry=pdp_kalinlik` girişini Karsilastirma_Acildi olayında ayrı sayar.
//
// 14 Ekim 2026 (hub planı Faz 3, Emrah: "ürün sayfasının hemen altında 'dilerseniz diğer taşyünü
// ürünleriyle kıyaslayabilirsiniz' linki"): kutu o kalınlığın hub'ına gider ("10 cm taş yünü fiyatları");
// 150'lik ürünlerde altında 150/kalınlık hub'ına ikinci bağlantı vardır.

import { ArrowRight, Columns3 } from 'lucide-react'

import Link from 'next/link'

import ComparisonLink from '@/components/compare/ComparisonLink'
import { COMPARISON_PATH, HUB_THICKNESSES, thicknessHubPath } from '@/lib/compare/hubs'

import { getComparisonProfiles, getProfileByModel } from '@/lib/technical-profiles'

interface Props {
  model: string | null
  thicknessCm: number | null
  warm: boolean
  /** 150'lik ürünün bu kalınlıktaki 150 hub'ı (yoksa null). */
  density150Href?: string | null
}


/** Yalnız karşılaştırmadaki sıvalı dış cephe taşyünü levhalarında gösterilir. */
export function showsComparisonShortcut(model: string | null): boolean {
  return !!model && getProfileByModel(model)?.applicationScope === 'sivali_dis_cephe_mantolama'
}

export default function ComparisonThicknessShortcut({ model, thicknessCm, warm, density150Href = null }: Props) {
  if (!showsComparisonShortcut(model)) return null
  const count = getComparisonProfiles().length
  const hasHub = thicknessCm != null && (HUB_THICKNESSES as readonly number[]).includes(thicknessCm)
  const href = hasHub ? thicknessHubPath(thicknessCm!) : COMPARISON_PATH
  // "Bütün" denmez: karşılaştırma yalnız sıvalı dış cephe mantolamasına uygun levhaları kapsar (editör, 14 Ekim).
  const title = thicknessCm != null
    ? `Dilerseniz diğer ${thicknessCm} cm taşyünü levhalarla kıyaslayın`
    : 'Dilerseniz diğer taşyünü levhalarla kıyaslayın'

  return (
    // w-full: sayfa kökü flex-col; mx-auto tek başına kutuyu içerik genişliğine daraltıyordu.
    <div className="mx-auto w-full max-w-[1200px] px-4 pt-3 sm:px-6 sm:pt-4">
      {/* Adres temiz (Google sayfayı tek adresle tanısın); giriş, kalınlık ve ürün tıklamada taşınır. */}
      <ComparisonLink
        href={href}
        entry="pdp_kalinlik"
        thicknessCm={thicknessCm}
        focus={model}
        prefetch={false}
        data-testid="comparison-thickness-shortcut"
        className={`group flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors sm:gap-4 sm:px-5 sm:py-4 ${
          warm
            ? 'border-[#c9a54e] bg-[#fff6dc] text-hub-ink hover:border-hub-gold hover:bg-[#fdefc6]'
            : 'border-brand-500/50 bg-brand-500/10 text-white hover:border-brand-400 hover:bg-brand-500/15'
        }`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${warm ? 'bg-hub-gold/15 text-hub-gold' : 'bg-brand-500/20 text-brand-300'}`}>
          <Columns3 className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-base font-bold leading-snug sm:text-lg">{title}</span>
          <span className={`mt-0.5 block text-xs sm:text-sm ${warm ? 'text-hub-ink-2' : 'text-fe-muted'}`}>
            {thicknessCm != null ? `${thicknessCm} cm taş yünü fiyatları: ` : ''}sıvalı dış cephe mantolamasına uygun {count} levha yan yana, 1 kamyon fiyatı ve föy değerleriyle
          </span>
        </span>
        <span className={`hidden shrink-0 items-center gap-1.5 text-sm font-bold sm:inline-flex ${warm ? 'text-hub-gold' : 'text-brand-300'}`}>
          Karşılaştır
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
        <ArrowRight className={`h-5 w-5 shrink-0 sm:hidden ${warm ? 'text-hub-gold' : 'text-brand-300'}`} aria-hidden="true" />
      </ComparisonLink>
      {density150Href && thicknessCm != null && (
        <p className={`mt-2 flex flex-wrap items-center gap-2 px-1 text-sm ${warm ? 'text-hub-ink-2' : 'text-fe-muted'}`}>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${warm ? 'bg-hub-gold/15 text-hub-gold' : 'bg-brand-500/20 text-brand-300'}`}>
            150 yoğunluk
          </span>
          <Link
            href={density150Href}
            prefetch={false}
            data-testid="density-150-shortcut"
            className={`font-semibold underline-offset-2 hover:underline ${warm ? 'text-hub-gold' : 'text-brand-300'}`}
          >
            {thicknessCm} cm 150 yoğunluk taş yünü fiyatları →
          </Link>
        </p>
      )}
    </div>
  )
}
