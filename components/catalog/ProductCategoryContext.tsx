'use client'

import Link from 'next/link'
import { ArrowLeft, Layers3 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { getCategoryEntryContext } from '@/lib/catalog/category-entry-context'

export default function ProductCategoryContext() {
  const searchParams = useSearchParams()
  const context = getCategoryEntryContext(searchParams)

  if (!context) return null

  return (
    <aside
      aria-label="Kategori seçim bağlamı"
      data-testid="product-category-context"
      className="border-b border-fe-border/60 bg-fe-surface/45"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-500/35 bg-brand-500/10 text-brand-400">
            <Layers3 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-400">
              Karar Masası bağlamı
            </p>
            <p className="mt-0.5 text-sm leading-5 text-fe-text">
              Bu ürünü <strong>{context.sectionTitle}</strong> listesinden açtınız.
            </p>
          </div>
        </div>
        <Link
          href={context.returnHref}
          prefetch={false}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-fe-border px-3 text-sm font-semibold text-fe-text transition-colors hover:border-brand-500/60 hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {context.sectionShortTitle} ürünlerine dön
        </Link>
      </div>
    </aside>
  )
}
