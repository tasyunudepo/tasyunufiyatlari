'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, BookOpen, Truck } from '@phosphor-icons/react'

import {
  notifyLeadGateSelection,
  notifyLeadGateViewed,
  readSalesIntent,
  saveSalesIntent,
  type SalesIntent,
} from '@/lib/analytics/leadQualification'
import { ICON_WEIGHT } from '@/lib/design/tokens'

const EXCLUDED_PREFIXES = [
  '/ofis',
  '/kvkk',
  '/cerez-politikasi',
  '/kullanim-kosullari',
  '/tasyunu-karsilastir',
  '/tasyunu-yogunluk',
]

export default function SalesIntentGate() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Ana sayfa artık kendi içinde tek dönüşüm yolunu kuruyor. Girişteki iki
  // seçenekli modal bu yolu bölmemeli; diğer yüzeylerde mevcut davranış sürer.
  const isExcluded = pathname === '/'
    || EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  useEffect(() => {
    if (isExcluded || readSalesIntent()) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    const openGate = window.setTimeout(() => {
      setIsOpen(true)
      notifyLeadGateViewed()
    }, 0)
    return () => window.clearTimeout(openGate)
  }, [isExcluded])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    primaryRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  const selectIntent = (intent: SalesIntent) => {
    saveSalesIntent(intent)
    notifyLeadGateSelection(intent)
    setIsOpen(false)

    if (intent === 'project_scale') {
      // Gate ana sayfa dışında gösterilir; bulunduğu sayfada olmayan bir
      // çapaya scroll denemek kullanıcıyı olduğu yerde bırakıyordu.
      router.push('/#mantolama-hesaplayici')
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      selectIntent('research_only')
      return
    }

    if (event.key !== 'Tab') return
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
    )
    if (buttons.length === 0) return

    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!isOpen || isExcluded) return null

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-end justify-center bg-black/85 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sales-intent-title"
      aria-describedby="sales-intent-description sales-intent-note"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-xl rounded-t-2xl border border-fe-border bg-fe-bg px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:rounded-2xl sm:px-8 sm:py-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
            <Truck size={26} weight="fill" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2
              id="sales-intent-title"
              className="font-heading text-3xl font-extrabold tracking-[-0.025em] text-white sm:text-4xl"
            >
              Proje ölçekli satış
            </h2>
            <p
              id="sales-intent-description"
              className="mt-3 text-base leading-relaxed text-fe-text"
            >
              Satışlarımız proje ölçeğinde, tam kamyon veya TIR bazında yapılır.
            </p>
            <p id="sales-intent-note" className="mt-2 text-sm leading-relaxed text-fe-muted">
              Paket, adet ve düşük metrajlı taleplere destek veremiyoruz.
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
          <button
            ref={primaryRef}
            type="button"
            onClick={() => selectIntent('project_scale')}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-base font-bold text-fe-bg transition-colors hover:bg-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-fe-bg"
          >
            1 TIR istiyorum
            <ArrowRight size={18} weight={ICON_WEIGHT} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => selectIntent('research_only')}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-fe-border bg-fe-surface px-5 py-3 text-sm font-semibold text-fe-text transition-colors hover:border-brand-500/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-fe-bg"
          >
            <BookOpen size={18} weight={ICON_WEIGHT} aria-hidden="true" />
            Ürünleri inceleyeceğim
          </button>
        </div>
      </div>
    </div>
  )
}
