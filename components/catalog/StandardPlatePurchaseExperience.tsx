import Image from 'next/image'
import { Suspense } from 'react'
import { Building2, Flame, Ruler, ShieldCheck } from 'lucide-react'
import type {
  CatalogProductView,
  DecisionContext,
  WizardPrefill,
} from '@/lib/catalog/types'
import { resolveBrandMark } from '@/lib/brandLogo'
import {
  APPLICATION_SCOPE_LABELS,
  densitySourceLabel,
  getProfileByModel,
} from '@/lib/technical-profiles'
import ProductImage from './ProductImage'
import ProductPricePanel, {
  type ProductLogisticsCapacity,
  type ProductShippingZone,
} from './ProductPricePanel'
import ThicknessSelector from './ThicknessSelector'

interface StandardPlatePurchaseExperienceProps {
  product: CatalogProductView
  decision: DecisionContext
  prefill: WizardPrefill | null
  shippingZones: ProductShippingZone[]
  logisticsCapacity: ProductLogisticsCapacity[]
  selectedThickness: number | null
}

const FILLI_GROUP_BRANDS = new Set(['dalmaçyalı', 'expert', 'optimix', 'fawori'])

export default function StandardPlatePurchaseExperience({
  product,
  decision,
  prefill,
  shippingZones,
  logisticsCapacity,
  selectedThickness,
}: StandardPlatePurchaseExperienceProps) {
  const profile = product.model ? getProfileByModel(product.model) : null
  const brandMark = resolveBrandMark(product.brand.name)
  const isFilliGroup = FILLI_GROUP_BRANDS.has(product.brand.name.toLocaleLowerCase('tr-TR'))
  const thicknessOptions = product.thickness_options ?? []
  const thicknessRange = thicknessOptions.length > 0
    ? `${Math.min(...thicknessOptions)}–${Math.max(...thicknessOptions)} cm`
    : 'Kalınlık bilgisi ürün seçimine göre belirlenir'

  return (
    <main className="flex-1 bg-hub-warm text-hub-ink">
      <div className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <section
          data-testid="pdp-standard-plate-summary"
          aria-labelledby="standard-plate-title"
          className="grid items-start gap-5 xl:grid-cols-[1.06fr_0.94fr]"
        >
          <article className="overflow-hidden rounded-[14px] border border-hub-rule bg-white shadow-[0_20px_46px_rgba(39,31,17,0.13)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hub-rule bg-[#fffaf0] px-5 py-4 sm:px-7">
              <div data-testid="pdp-standard-plate-brand" className="flex min-w-0 items-center gap-3">
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
                <div
                  data-testid="pdp-filli-group-mark"
                  className="flex items-center gap-2 border-l border-hub-rule pl-4"
                >
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

            <div className="grid md:grid-cols-[0.84fr_1.16fr]">
              <div className="min-w-0 border-b border-hub-rule bg-[#fffaf0] p-5 sm:p-7 md:border-b-0 md:border-r">
                <h1
                  id="standard-plate-title"
                  className="text-balance font-heading text-[2rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-[#17140f] sm:text-[2.45rem]"
                >
                  {profile?.displayName ?? product.name}
                </h1>
                <p className="mt-3 text-sm font-medium leading-6 text-[#6b6557]">
                  {product.category.name}
                </p>

                <dl className="mt-6 grid gap-3 border-t border-hub-rule pt-5">
                  {profile?.density && (
                    <div className="grid grid-cols-[20px_1fr] gap-2.5">
                      <ShieldCheck aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] text-[#7d5d20]" />
                      <div>
                        <dt className="text-[11px] leading-4 text-[#6b6557]">Yoğunluk</dt>
                        <dd className="text-[13px] font-bold leading-5 text-[#282219]">
                          {profile.density.display}
                        </dd>
                        <dd className="text-[10px] leading-4 text-[#6b6557]">{densitySourceLabel(profile)}</dd>
                      </div>
                    </div>
                  )}
                  {profile && (
                    <div className="grid grid-cols-[20px_1fr] gap-2.5">
                      <Flame aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] text-[#7d5d20]" />
                      <div>
                        <dt className="text-[11px] leading-4 text-[#6b6557]">Yangına tepki</dt>
                        <dd className="text-[13px] font-bold leading-5 text-[#282219]">{profile.fireClass} sınıfı</dd>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-[20px_1fr] gap-2.5">
                    <Ruler aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] text-[#7d5d20]" />
                    <div>
                      <dt className="text-[11px] leading-4 text-[#6b6557]">Kalınlık aralığı</dt>
                      <dd className="text-[13px] font-bold leading-5 text-[#282219]">{thicknessRange}</dd>
                    </div>
                  </div>
                  {profile && (
                    <div className="grid grid-cols-[20px_1fr] gap-2.5">
                      <Building2 aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] text-[#7d5d20]" />
                      <div>
                        <dt className="text-[11px] leading-4 text-[#6b6557]">Kullanım alanı</dt>
                        <dd className="text-[13px] font-bold leading-5 text-[#282219]">
                          {APPLICATION_SCOPE_LABELS[profile.applicationScope]}
                        </dd>
                      </div>
                    </div>
                  )}
                </dl>
              </div>

              <div className="min-w-0 bg-[radial-gradient(circle_at_50%_42%,#fff_0%,#f7f0e2_50%,#eee4d2_100%)] p-5 sm:p-7">
                <ProductImage
                  src={product.image_cover}
                  alt={product.name}
                  priority
                  className="min-h-[280px] w-full sm:min-h-[360px]"
                />
                {thicknessOptions.length > 0 && (
                  <div className="mt-5 border-t border-hub-rule pt-5">
                    <h2 className="mb-3 font-heading text-sm font-bold text-[#282219]">Kalınlığı seçin</h2>
                    <Suspense fallback={null}>
                      <ThicknessSelector
                        thicknessOptions={thicknessOptions}
                        popularThickness={prefill?.kalinlik ?? null}
                      />
                    </Suspense>
                  </div>
                )}
              </div>
            </div>

            {profile && (
              <dl className="grid border-t border-hub-rule bg-[#fffdf8] sm:grid-cols-3">
                {[
                  ['Isı iletkenliği', profile.lambdaDisplay],
                  ['Çekme dayanımı', profile.tensileDisplay],
                  ['Basma dayanımı', profile.compressiveDisplay],
                ].map(([label, value], index) => (
                  <div
                    key={label}
                    className={`min-w-0 px-5 py-4 ${index < 2 ? 'border-b border-hub-rule sm:border-b-0 sm:border-r' : ''}`}
                  >
                    <dt className="text-[11px] font-medium text-[#6b6557]">{label}</dt>
                    <dd className="mt-1 text-xs font-bold leading-5 text-[#282219] [overflow-wrap:anywhere]">{value}</dd>
                  </div>
                ))}
              </dl>
            )}

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
              selectedThickness={selectedThickness}
            />
          </aside>
        </section>
      </div>
    </main>
  )
}
