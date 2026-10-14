'use client'

// Karşılaştırma sayfalarına temiz adresli bağlantı; giriş bilgisi tıklamada sekme hafızasına yazılır
// (lib/compare/entry.ts). Sunucu HTML'inde adres etiketsiz görünür, Google sayfayı tek adresle tanır.

import Link from 'next/link'
import type { ComponentProps } from 'react'

import { rememberComparisonEntry } from '@/lib/compare/entry'

type Props = Omit<ComponentProps<typeof Link>, 'href'> & {
  href?: string
  entry: string
  thicknessCm?: number | null
  focus?: string | null
}

export default function ComparisonLink({
  href = '/tasyunu-karsilastir',
  entry,
  thicknessCm = null,
  focus = null,
  onClick,
  ...rest
}: Props) {
  return (
    <Link
      {...rest}
      href={href}
      onClick={(event) => {
        rememberComparisonEntry({ entry, thicknessCm, focus, path: href.split(/[?#]/)[0] })
        onClick?.(event)
      }}
    />
  )
}
