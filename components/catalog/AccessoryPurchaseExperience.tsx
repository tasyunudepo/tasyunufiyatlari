import Image from 'next/image'
import { Layers3, PackageOpen, ReceiptText } from 'lucide-react'
import type {
  CatalogProductView,
  DecisionContext,
  WizardPrefill,
} from '@/lib/catalog/types'
import { resolveBrandMark } from '@/lib/brandLogo'
import ProductImage from './ProductImage'
import ProductPricePanel, {
  type ProductLogisticsCapacity,
  type ProductShippingZone,
} from './ProductPricePanel'

interface AccessoryPurchaseExperienceProps {
  product: CatalogProductView
  decision: DecisionContext
  prefill: WizardPrefill | null
  shippingZones: ProductShippingZone[]
  logisticsCapacity: ProductLogisticsCapacity[]
}

const FILLI_GROUP_BRANDS = new Set(['dalmaçyalı', 'expert', 'optimix', 'fawori'])

const SALES_MODE_LABELS: Record<CatalogProductView['rules']['sales_mode'], string> = {
  single_only: 'Tek ürün olarak sipariş edilebilir',
  quote_only: 'Ürün teklifiyle ilerler',
  single_or_quote: 'Tek ürün veya sistem teklifiyle ilerler',
  system_only: 'Komple sistem içinde sunulur',
}

export default function AccessoryPurchaseExperience({
  product,
  decision,
  prefill,
  shippingZones,
  logisticsCapacity,
}: AccessoryPurchaseExperienceProps) {
  const brandMark = resolveBrandMark(product.brand.name)
  const isFilliGroup = FILLI_GROUP_BRANDS.has(product.brand.name.toLocaleLowerCase('tr-TR'))

  return (
    <main className="flex-1 bg-hub-warm text-hub-ink">
      <div className="mx-auto max-w-[1240px] px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <section
          data-testid="pdp-accessory-summary"
          aria-labelledby="accessory-product-title"
          className="grid items-start gap-5 xl:grid-cols-[1.03fr_0.97fr]"
        >
          <article className="overflow-hidden rounded-[14px] border border-hub-rule bg-white shadow-[0_20px_46px_rgba(39,31,17,0.13)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hub-rule bg-[#fffaf0] px-5 py-4 sm:px-7">
              <div data-testid="pdp-accessory-brand" className="flex min-w-0 items-center gap-3">
                {brandMark.logo ? (
                  <Image
                    src={brandMark.logo.src}
                    alt={brandMark.accessibleName}
                    width={brandMark.logo.width}
                    height={brandMark.logo.height}
                    className="h-10 w-auto max-w-[145px] object-contain object-left"
                  />
                ) : (
                  <strong className="font-heading text-xl text-[#211c15]">{brandMark.displayName}</strong>
                )}
                <span className="sr-only">{brandMark.displayName}</span>
              </div>

              {isFilliGroup && (
                <div className="flex items-center gap-2 border-l border-hub-rule pl-4">
                  <Image
                    src="/images/markalogolar/filli-boya-mantolama.webp"
                    alt="Filli Boya"
                    width={126}
                    height={34}
                    className="h-7 w-auto object-contain"
                  />
                  <span className="max-w-[92px] text-[10px] font-semibold leading-4 text-[#6b6557]">
                    Filli Boya ürün grubu
                  </span>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-hub-rule bg-[#fffaf0] p-5 sm:p-7 md:border-b-0 md:border-r">
                <p className="text-sm font-semibold text-[#7d5d20]">{product.category.name}</p>
                <h1
                  id="accessory-product-title"
                  className="mt-3 text-balance font-heading text-[2rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-[#17140f] sm:text-[2.45rem]"
                >
                  {product.name}
                </h1>

                <dl className="mt-7 grid gap-4 border-t border-hub-rule pt-5">
                  <div className="grid grid-cols-[22px_1fr] gap-3">
                    <ReceiptText aria-hidden="true" className="mt-0.5 h-5 w-5 text-[#7d5d20]" />
                    <div>
                      <dt className="text-[11px] text-[#6b6557]">Satış biçimi</dt>
                      <dd className="mt-0.5 text-[13px] font-bold leading-5 text-[#282219]">
                        {SALES_MODE_LABELS[product.rules.sales_mode]}
                      </dd>
                    </div>
                  </div>
                  {product.minimum_order.has_minimum && product.minimum_order.label && (
                    <div className="grid grid-cols-[22px_1fr] gap-3">
                      <PackageOpen aria-hidden="true" className="mt-0.5 h-5 w-5 text-[#7d5d20]" />
                      <div>
                        <dt className="text-[11px] text-[#6b6557]">Minimum sipariş</dt>
                        <dd className="mt-0.5 text-[13px] font-bold leading-5 text-[#282219]">
                          {product.minimum_order.label}
                        </dd>
                      </div>
                    </div>
                  )}
                  {product.rules.requires_system_context && (
                    <div className="grid grid-cols-[22px_1fr] gap-3">
                      <Layers3 aria-hidden="true" className="mt-0.5 h-5 w-5 text-[#7d5d20]" />
                      <div>
                        <dt className="text-[11px] text-[#6b6557]">Sistem kullanımı</dt>
                        <dd className="mt-0.5 text-[13px] font-bold leading-5 text-[#282219]">
                          Uyumlu levha ve tamamlayıcı ürünlerle birlikte hesaplanabilir
                        </dd>
                      </div>
                    </div>
                  )}
                </dl>
              </div>

              <div className="min-w-0 bg-[radial-gradient(circle_at_50%_42%,#fff_0%,#f7f0e2_50%,#eee4d2_100%)] p-5 sm:p-7">
                {product.image_cover ? (
                  <ProductImage
                    src={product.image_cover}
                    alt={product.name}
                    priority
                    className="min-h-[300px] w-full sm:min-h-[390px]"
                  />
                ) : (
                  <div className="flex min-h-[300px] flex-col items-center justify-center text-center sm:min-h-[390px]">
                    <PackageOpen aria-hidden="true" className="h-12 w-12 text-[#8a6727]" />
                    <p className="mt-4 text-sm font-bold text-[#332c22]">Ürün bilgisi hazır</p>
                    <p className="mt-1 max-w-[28ch] text-xs leading-5 text-[#6b6557]">
                      Görsel bulunmadığında fiyat ve sistem bilgileriyle işlem yapabilirsiniz.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {product.catalog_description && (
              <div className="border-t border-hub-rule px-5 py-5 sm:px-7">
                <h2 className="font-heading text-base font-bold text-[#282219]">Ürün hakkında</h2>
                <p className="mt-2 max-w-[72ch] text-sm leading-6 text-[#625b50]">
                  {product.catalog_description}
                </p>
              </div>
            )}
          </article>

          <aside
            aria-label="Fiyat ve teklif işlemleri"
            className="min-w-0 rounded-[14px] bg-[#171612] p-3 shadow-[0_20px_46px_rgba(39,31,17,0.18)] xl:sticky xl:top-5"
          >
            <ProductPricePanel
              product={product}
              decision={decision}
              prefill={prefill}
              shippingZones={shippingZones}
              logisticsCapacity={logisticsCapacity}
              selectedThickness={null}
            />
          </aside>
        </section>
      </div>
    </main>
  )
}
