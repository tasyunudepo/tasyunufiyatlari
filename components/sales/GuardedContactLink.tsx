'use client'

// İletişim sayfasındaki telefon ve WhatsApp düğmeleri: basınca önce "siparişiniz en az 1 tam
// kamyon mu?" penceresi açılır (Emrah kararı, 14 Ekim 2026). "Evet" denince asıl bağlantı
// çalışır ve ölçüm (Telefon_Aramalari / Whatsapp_Yazanlar, WhatsApp bildirimi) o anda gider;
// "Hayır, daha az" denince arama ve bildirim olmaz.

import { useRef, useState, type ReactNode } from 'react'

import MinimumOrderDialog from '@/components/sales/MinimumOrderDialog'
import PhoneCallLink from '@/components/shared/PhoneCallLink'
import WhatsappLink from '@/components/shared/WhatsappLink'
import { notifyMinimumOrderAnswer, notifyMinimumOrderShown } from '@/lib/analytics/leadQualification'
import type { PhoneSource, WhatsappSource } from '@/lib/analytics/whatsappSource'
import { readMinimumOrder, type MinimumOrderRow, type MinimumOrderSelection } from '@/lib/sales/minimumOrder'

type Props =
  | { channel: 'phone'; href: string; source: PhoneSource; rows: MinimumOrderRow[]; className?: string; children: ReactNode }
  | { channel: 'whatsapp'; href: string; source: WhatsappSource; rows: MinimumOrderRow[]; className?: string; children: ReactNode }

export default function GuardedContactLink(props: Props) {
  const { channel, rows, className, children } = props
  const [open, setOpen] = useState(false)
  const [selection, setSelection] = useState<MinimumOrderSelection | null>(null)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const allowNextRef = useRef(false)
  // Pencere başına tek cevap: "Hayır"dan sonra "Kapat" ayrıca "vazgeçti" sayılmaz.
  const answeredRef = useRef(false)
  const surface = channel === 'phone' ? 'iletisim_telefon' : 'iletisim_whatsapp'

  const handleClickCapture = (event: React.MouseEvent<HTMLSpanElement>) => {
    if (allowNextRef.current) {
      allowNextRef.current = false
      return
    }
    // Bağlantının kendi ölçümü ve gezinmesi "Evet"e kadar bekler.
    event.preventDefault()
    event.stopPropagation()
    const remembered = readMinimumOrder()
    setSelection(remembered)
    answeredRef.current = false
    setOpen(true)
    notifyMinimumOrderShown(surface, remembered?.minimumM2 ?? null)
  }

  const confirm = () => {
    answeredRef.current = true
    notifyMinimumOrderAnswer(surface, 'evet', selection?.minimumM2 ?? null)
    setOpen(false)
    allowNextRef.current = true
    wrapperRef.current?.querySelector('a')?.click()
  }

  return (
    <>
      <span ref={wrapperRef} onClickCapture={handleClickCapture} className="contents">
        {props.channel === 'phone' ? (
          <PhoneCallLink href={props.href} source={props.source} className={className}>
            {children}
          </PhoneCallLink>
        ) : (
          <WhatsappLink href={props.href} source={props.source} className={className}>
            {children}
          </WhatsappLink>
        )}
      </span>
      <MinimumOrderDialog
        open={open}
        mode="contact"
        channel={channel}
        selection={selection}
        rows={rows}
        onClose={() => {
          if (open && !answeredRef.current) notifyMinimumOrderAnswer(surface, 'vazgecti', selection?.minimumM2 ?? null)
          setOpen(false)
        }}
        onConfirm={confirm}
        onDecline={() => {
          answeredRef.current = true
          notifyMinimumOrderAnswer(surface, 'az', selection?.minimumM2 ?? null)
        }}
      />
    </>
  )
}
