'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { getCategoryEntryContext } from '@/lib/catalog/category-entry-context'

interface ProductCategoryContextProps {
  warm?: boolean
}

export default function ProductCategoryContext({ warm = false }: ProductCategoryContextProps) {
  const searchParams = useSearchParams()
  const context = getCategoryEntryContext(searchParams)

  if (!context) return null

  return (
    <Link
      href={context.returnHref}
      prefetch={false}
      data-testid="product-category-context"
      className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        warm
          ? 'border-[#7d5d20]/35 bg-white/55 text-[#7d5d20] hover:border-[#7d5d20]/60 hover:bg-white focus-visible:ring-[#7d5d20] focus-visible:ring-offset-[#efe8da]'
          : 'border-fe-border bg-fe-raised/50 text-brand-300 hover:border-brand-500/60 hover:text-white focus-visible:ring-brand-400 focus-visible:ring-offset-fe-surface'
      }`}
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      {context.sectionTitle} listesine dön
    </Link>
  )
}
