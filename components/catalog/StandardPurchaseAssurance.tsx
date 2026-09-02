import { Building2, CreditCard, FileCheck2 } from 'lucide-react'
import { BUSINESS_INFO } from '@/lib/business/info'

const items = [
  {
    Icon: Building2,
    title: 'Satıcı kimliği',
    body: `${BUSINESS_INFO.legalName} üzerinden satış ve teklif görüşmesi.`,
  },
  {
    Icon: CreditCard,
    title: 'Ödeme yöntemi',
    body: 'Kredi kartı veya banka havalesi; toplam tutar sipariş onayında tek seferde alınır.',
  },
  {
    Icon: FileCheck2,
    title: 'Tekliften sonra',
    body: 'Referanslı PDF; ürün, kalınlık, teslimat bölgesi ve tam araç planını satış görüşmesine taşır.',
  },
] as const

export default function StandardPurchaseAssurance() {
  return (
    <section
      data-testid="pdp-purchase-assurance"
      aria-labelledby="pdp-purchase-assurance-title"
      className="overflow-hidden rounded-[16px] border border-[#ddcfba] bg-[#fffdf8] shadow-[0_16px_36px_rgba(39,31,17,0.08)]"
    >
      <div className="border-b border-[#ded2c0] px-5 py-4 sm:px-7 lg:px-8">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.12em] text-[#765621]">Sipariş süreci</p>
        <h2 id="pdp-purchase-assurance-title" className="mt-1 font-heading text-xl font-extrabold text-[#282219]">
          Kiminle, nasıl ve hangi kayıtla ilerlersiniz?
        </h2>
      </div>
      <ul className="grid md:grid-cols-3">
        {items.map(({ Icon, title, body }, index) => (
          <li
            key={title}
            className={`grid min-h-[126px] grid-cols-[24px_1fr] gap-3 px-5 py-5 sm:px-7 lg:px-8 ${index < 2 ? 'border-b border-[#ded2c0] md:border-b-0 md:border-r' : ''}`}
          >
            <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 text-[#8a5f1d]" />
            <div>
              <h3 className="font-heading text-base font-extrabold text-[#282219]">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-[#625a4f]">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
