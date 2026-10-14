'use client'

// Ana sayfada, sayfa kaydıkça başlığın altında kalan şerit: "En az sipariş: 1 tam kamyon".
// Hesaplayıcıda ürün ve kalınlık seçildikçe o seçimin kamyon metrajını yazar (14 Ekim 2026).

import { useEffect, useState } from 'react'
import { Truck } from '@phosphor-icons/react'

import {
  MINIMUM_ORDER_EVENT,
  formatMinimumM2,
  readMinimumOrder,
  type MinimumOrderSelection,
} from '@/lib/sales/minimumOrder'

interface Props {
  /** false: oturumda kalan son seçim okunmaz (karşılaştırma sayfası kendi kalınlığını gösterir). */
  remember?: boolean
  /** Seçim yokken alt satır. */
  fallbackDetail?: string
}

export default function MinimumOrderBanner({
  remember = true,
  fallbackDetail = 'Paket, adet ve düşük metrajlı taleplere destek veremiyoruz.',
}: Props = {}) {
  const [selection, setSelection] = useState<MinimumOrderSelection | null>(null)
  // Şerit başlığın hemen altına yapışır; başlık yüksekliği ekran genişliğine göre değiştiği için ölçülür.
  const [headerHeight, setHeaderHeight] = useState<number | null>(null)

  useEffect(() => {
    const header = document.querySelector('header')
    if (!header) return
    const measure = () => setHeaderHeight(Math.round(header.getBoundingClientRect().height))
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    // Oturumdaki son seçim sunucu çıktısından sonra okunur (hydration farkı olmasın).
    const restore = window.setTimeout(() => {
      if (remember) setSelection(readMinimumOrder())
    }, 0)
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<MinimumOrderSelection>).detail
      if (detail && remember) setSelection(detail)
    }
    window.addEventListener(MINIMUM_ORDER_EVENT, onChange)
    return () => {
      window.clearTimeout(restore)
      window.removeEventListener(MINIMUM_ORDER_EVENT, onChange)
    }
  }, [remember])

  return (
    <div
      className="sticky top-[45px] z-40 border-y border-[#7d5d20] bg-[#e0b736] text-[#1d1708] shadow-[0_6px_18px_rgba(60,40,0,0.18)] sm:top-[65px]"
      style={headerHeight !== null ? { top: headerHeight } : undefined}
      role="note"
      aria-label="En az sipariş"
      data-testid="minimum-order-banner"
    >
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
        <Truck size={28} weight="fill" aria-hidden="true" className="hidden shrink-0 sm:block" />
        <p className="min-w-0 flex-1 leading-tight">
          <span className="block font-heading text-[clamp(1.05rem,2.6vw,1.65rem)] font-extrabold uppercase tracking-[0.01em]">
            En az sipariş: 1 tam kamyon
          </span>
          <span className="mt-0.5 block text-[13px] font-semibold sm:text-sm" data-testid="minimum-order-banner-detail">
            {selection
              ? `${selection.label}: en az ${formatMinimumM2(selection.minimumM2)} m²`
              : fallbackDetail}
          </span>
        </p>
      </div>
    </div>
  )
}
