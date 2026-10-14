'use client'

// "Lütfen vaktimizi almayalım" penceresi: en az sipariş 1 tam kamyon (14 Ekim 2026).
// mode="contact": aramadan / yazmadan önce "siparişiniz en az 1 kamyon mu?" sorusu.
// mode="calculator": hesaplayıcıda kamyondan az metrajla "Fiyatımı Hesapla"ya basıldığında.

import { useEffect, useRef, useState } from 'react'
import { Truck } from '@phosphor-icons/react'

import { formatMinimumM2, type MinimumOrderRow, type MinimumOrderSelection } from '@/lib/sales/minimumOrder'

type ContactChannel = 'phone' | 'whatsapp'

interface BaseProps {
  open: boolean
  onClose: () => void
}

interface ContactProps extends BaseProps {
  mode: 'contact'
  channel: ContactChannel
  /** Ziyaretçinin baktığı son ürün ve kalınlık (varsa). */
  selection: MinimumOrderSelection | null
  /** Seçim yoksa gösterilecek örnek kalınlıklar. */
  rows: MinimumOrderRow[]
  onConfirm: () => void
  onDecline: () => void
}

interface CalculatorProps extends BaseProps {
  mode: 'calculator'
  selection: MinimumOrderSelection
  onUseMinimum: () => void
}

type Props = ContactProps | CalculatorProps

export default function MinimumOrderDialog(props: Props) {
  const [declined, setDeclined] = useState(false)
  const { open } = props
  // Kapanırken "Hayır" durumu sıfırlanır; pencere bir sonraki açılışta yine soruyla başlar.
  const onClose = () => {
    setDeclined(false)
    props.onClose()
  }
  const firstButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
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

  const primaryClass =
    'inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-base font-bold text-fe-bg transition-colors hover:bg-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300'
  const secondaryClass =
    'inline-flex min-h-14 items-center justify-center rounded-xl border border-fe-border bg-fe-surface px-5 py-3 text-sm font-semibold text-fe-text transition-colors hover:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300'

  let body: React.ReactNode
  if (props.mode === 'calculator') {
    const m2 = formatMinimumM2(props.selection.minimumM2)
    body = (
      <>
        <p className="mt-3 text-lg leading-relaxed text-fe-text">
          {props.selection.label} için en az sipariş 1 tam kamyondur:{' '}
          <strong className="whitespace-nowrap text-white">{m2} m²</strong>.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-fe-muted">
          Paket, adet ve düşük metrajlı taleplere destek veremiyoruz.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
          <button ref={firstButtonRef} type="button" onClick={props.onUseMinimum} className={primaryClass}>
            {m2} m² ile hesapla
          </button>
          <button type="button" onClick={onClose} className={secondaryClass}>
            Vazgeç
          </button>
        </div>
      </>
    )
  } else if (declined) {
    body = (
      <>
        <p className="mt-3 text-lg leading-relaxed text-fe-text">
          Bu ölçekteki taleplere destek veremiyoruz. Anlayışınız için teşekkür ederiz.
        </p>
        <div className="mt-7">
          <button ref={firstButtonRef} type="button" onClick={onClose} className={secondaryClass}>
            Kapat
          </button>
        </div>
      </>
    )
  } else {
    const { selection, rows, channel } = props
    const examples = rows.filter((r) => r.thicknessCm === 5 || r.thicknessCm === 10)
    body = (
      <>
        <p className="mt-3 text-lg leading-relaxed text-fe-text">
          Satışlarımız en az 1 tam kamyon üzerinden yapılır.
        </p>
        {selection ? (
          <p className="mt-2 text-base leading-relaxed text-fe-text">
            Baktığınız ürün: <strong className="text-white">{selection.label}</strong> — en az{' '}
            <strong className="whitespace-nowrap text-white">{formatMinimumM2(selection.minimumM2)} m²</strong>.
          </p>
        ) : examples.length > 0 ? (
          <p className="mt-2 text-base leading-relaxed text-fe-text">
            Taşyünü levhada 1 kamyon:{' '}
            {examples.map((r, i) => (
              <span key={r.thicknessCm} className="whitespace-nowrap">
                {i > 0 ? ', ' : ''}
                {r.thicknessCm} cm&apos;de yaklaşık {formatMinimumM2(r.minimumM2)} m²
              </span>
            ))}
            .
          </p>
        ) : null}
        <p className="mt-5 text-xl font-bold text-white">Siparişiniz en az 1 tam kamyon mu?</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1.25fr_0.75fr]">
          <button ref={firstButtonRef} type="button" onClick={props.onConfirm} className={primaryClass}>
            {channel === 'phone' ? 'Evet, en az 1 kamyon — Ara' : 'Evet, en az 1 kamyon — Yaz'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDeclined(true)
              props.onDecline()
            }}
            className={secondaryClass}
          >
            Hayır, daha az
          </button>
        </div>
      </>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-end justify-center bg-black/85 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="minimum-order-title"
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      data-testid="minimum-order-dialog"
    >
      <div className="w-full max-w-xl rounded-t-2xl border border-fe-border bg-fe-bg px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:rounded-2xl sm:px-8 sm:py-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
            <Truck size={26} weight="fill" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="minimum-order-title" className="font-heading text-3xl font-extrabold tracking-[-0.025em] text-white sm:text-4xl">
              Lütfen vaktimizi almayalım
            </h2>
            {body}
          </div>
        </div>
      </div>
    </div>
  )
}
