import { Suspense } from 'react'
import type { CatalogProductView, DecisionContext, WizardPrefill } from '@/lib/catalog/types'
import { resolveBrandMark } from '@/lib/brandLogo'
import {
  APPLICATION_SCOPE_LABELS,
  densitySourceLabel,
  getProfileByModel,
  type TechnicalProfile,
} from '@/lib/technical-profiles'
import ProductImage from './ProductImage'
import PlatePackageDetails from './PlatePackageDetails'
import ProductPricePanel, {
  type ProductLogisticsCapacity,
  type ProductShippingZone,
} from './ProductPricePanel'
import StandardPlateCommercialHeader from './StandardPlateCommercialHeader'
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

function ProductVisual({ product, prefill }: { product: CatalogProductView; prefill: WizardPrefill | null }) {
  const thicknessOptions = product.thickness_options ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#fffdf8] p-5 sm:p-7">
      <ProductImage
        src={product.image_cover}
        alt={product.name}
        priority
        className="min-h-[230px] w-full flex-1 sm:min-h-[390px]"
      />
      {thicknessOptions.length > 0 && (
        <div className="mt-5 border-t border-[#ded2c0] pt-5">
          <h2 className="mb-3 font-heading text-xl font-bold text-[#282219]">Kalınlığı seçin</h2>
          <Suspense fallback={null}>
            <ThicknessSelector
              thicknessOptions={thicknessOptions}
              popularThickness={prefill?.kalinlik ?? null}
              presentation="warm"
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}

function ProductTradeFacts({ product, profile, thicknessRange }: { product: CatalogProductView; profile: TechnicalProfile | null; thicknessRange: string }) {
  if (!profile) {
    const epsFacts = [
      ['Malzeme', 'EPS ısı yalıtım levhası'],
      ['Kalınlık', thicknessRange],
      ...(product.catalog_description?.includes('TS EN 13163') ? [['Ürün standardı', 'TS EN 13163']] : []),
    ]
    return (
      <dl data-testid="pdp-product-quick-facts" className={`grid border-t border-[#ded2c0] bg-[#fffaf5] ${epsFacts.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {epsFacts.map(([label, value], index) => (
          <div key={label} className={`min-w-0 px-4 py-4 sm:px-5 ${index > 0 ? 'border-l border-[#ded2c0]' : ''}`}>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#625a4f] sm:text-xs">{label}</dt>
            <dd className="mt-1 text-sm font-extrabold leading-5 text-[#282219] sm:text-base">{value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  const primaryFact = profile.density
    ? ['Yoğunluk', profile.density.display]
    : ['Isı iletkenliği', profile.lambdaDisplay]

  return (
    <dl data-testid="pdp-product-quick-facts" className="grid grid-cols-3 border-t border-[#ded2c0] bg-[#fffaf5]">
      {[
        primaryFact,
        ['Yangına tepki', `${profile.fireClass} sınıfı`],
        ['Kalınlık', thicknessRange],
      ].map(([label, value], index) => (
        <div key={label} className={`min-w-0 px-4 py-4 sm:px-5 ${index > 0 ? 'border-l border-[#ded2c0]' : ''}`}>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#625a4f] sm:text-xs">{label}</dt>
          <dd className="mt-1 text-sm font-extrabold leading-5 text-[#282219] sm:text-base">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ProductDetails({
  product,
  profile,
  thicknessRange,
  commercialTitle,
}: {
  product: CatalogProductView
  profile: TechnicalProfile | null
  thicknessRange: string
  commercialTitle: string
}) {
  const descriptionParts = product.catalog_description
    ? product.catalog_description.split(/\s*ÖZELLİKLER\s*/i)
    : []
  const descriptionIntro = descriptionParts[0]?.trim() ?? ''
  const descriptionBullets = descriptionParts.length > 1
    ? Array.from(new Set(descriptionParts.slice(1).join(' ').split(/\s*•\s*/).map(item => item.trim()).filter(Boolean)))
    : []
  const applicationLabel = profile ? APPLICATION_SCOPE_LABELS[profile.applicationScope] : null
  const fallbackDescription = profile
    ? `${commercialTitle}, ${applicationLabel?.toLocaleLowerCase('tr-TR')} uygulamalarına yönelik taşyünü ısı yalıtım levhasıdır. Seçtiğiniz kalınlığa ait paket içeriği ve tam araç kapasitesi satın alma alanında birlikte hesaplanır.`
    : ''
  const aboutCopy = descriptionIntro || fallbackDescription

  if (!profile && !aboutCopy) return null

  return (
    <section
      aria-label="Ürün teknik bilgileri"
      className="overflow-hidden rounded-[14px] border border-hub-rule bg-white shadow-[0_16px_36px_rgba(39,31,17,0.1)]"
    >
      <div className="grid lg:grid-cols-[1.25fr_0.75fr]">
        <article className="px-5 py-6 sm:px-7 lg:px-8">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.12em] text-[#765621]">Ürün açıklaması</p>
          <h2 className="mt-2 font-heading text-2xl font-extrabold tracking-[-0.02em] text-[#282219]">
            {commercialTitle} hakkında
          </h2>
          {aboutCopy && <p className="mt-3 max-w-[72ch] text-base leading-7 text-[#625b50]">{aboutCopy}</p>}
          {descriptionBullets.length > 0 && (
            <ul className="mt-4 grid gap-2 text-sm leading-6 text-[#625b50] sm:grid-cols-2">
              {descriptionBullets.map(item => (
                <li key={item} className="grid grid-cols-[8px_1fr] gap-2">
                  <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 rounded-full bg-[#9a762f]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <aside className="border-t border-hub-rule bg-[#fffaf0] px-5 py-6 sm:px-7 lg:border-l lg:border-t-0">
          <h3 className="font-heading text-lg font-extrabold text-[#282219]">Kullanım ve seçim</h3>
          <dl className="mt-4 grid gap-4">
            {applicationLabel && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#625c51]">Kullanım alanı</dt>
                <dd className="mt-1 text-base font-bold text-[#282219]">{applicationLabel}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#625c51]">Kalınlık aralığı</dt>
              <dd className="mt-1 text-base font-bold text-[#282219]">{thicknessRange}</dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-[#ded2c0] pt-4 text-sm leading-6 text-[#625b50]">
            Kalınlık seçimi paket içeriğini ve tam araçta taşınan toplam metrajı değiştirir.
          </p>
        </aside>
      </div>

      {profile && (
        <div className="border-t border-hub-rule bg-[#fffdf8]">
          <dl className="grid sm:grid-cols-3">
            {[
              ['Isı iletkenliği', profile.lambdaDisplay],
              ['Çekme dayanımı', profile.tensileDisplay],
              ['Basma dayanımı', profile.compressiveDisplay],
            ].map(([label, value], index) => (
              <div
                key={label}
                className={`min-w-0 px-5 py-4 sm:px-7 ${index < 2 ? 'border-b border-hub-rule sm:border-b-0 sm:border-r' : ''}`}
              >
                <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-[#625c51]">{label}</dt>
                <dd className="mt-1 text-base font-bold leading-6 text-[#282219] [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
          {profile.density && (
            <p className="border-t border-hub-rule px-5 py-3 text-xs leading-5 text-[#625c51] sm:px-7">
              Yoğunluk bilgisinin kaynağı: {densitySourceLabel(profile)}.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

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
  const rawDisplayTitle = profile?.displayName ?? product.name
  const commercialTitle = ['Expert', 'Optimix'].includes(brandMark.displayName)
    ? rawDisplayTitle.replace(/^Fawori\s+/i, '')
    : rawDisplayTitle
  const commercialCategoryName = product.material_type === 'eps'
    ? 'EPS ısı yalıtım levhası'
    : 'Taşyünü ısı yalıtım levhası'

  return (
    <main className="flex-1 bg-[#f7f2e9] text-hub-ink">
      <div className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <section
          data-testid="pdp-standard-plate-summary"
          aria-labelledby="standard-plate-title"
          className="grid gap-5 xl:grid-cols-[1.04fr_0.96fr]"
        >
          <StandardPlateCommercialHeader
            title={commercialTitle}
            categoryName={commercialCategoryName}
            brandMark={brandMark}
            isFilliGroup={isFilliGroup}
            cityOptions={shippingZones.map((zone) => ({ code: zone.city_code, name: zone.city_name }))}
            fallbackThickness={selectedThickness ?? prefill?.kalinlik ?? null}
          />

          <article className="order-1 flex min-h-0 flex-col overflow-hidden rounded-[16px] border border-[#ddcfba] bg-white shadow-[0_18px_44px_rgba(58,43,22,0.1)]">
            <ProductVisual product={product} prefill={prefill} />
            <ProductTradeFacts product={product} profile={profile} thicknessRange={thicknessRange} />
          </article>

          <div
            id="pdp-commercial-planner"
            role="region"
            aria-label="Fiyat ve teklif işlemleri"
            className="order-2 min-w-0 scroll-mt-5 rounded-[16px] border border-[#ddcfba] bg-[#fffdf8] shadow-[0_18px_44px_rgba(58,43,22,0.1)]"
          >
            <ProductPricePanel
              product={product}
              decision={decision}
              prefill={prefill}
              shippingZones={shippingZones}
              logisticsCapacity={logisticsCapacity}
              selectedThickness={selectedThickness}
              hideHeroPrice
              presentation="warm-commercial"
            />
          </div>

          <div className="order-3 min-w-0 space-y-5 xl:col-span-2">
            <PlatePackageDetails
              product={product}
              logisticsCapacity={logisticsCapacity}
              fallbackThickness={selectedThickness ?? prefill?.kalinlik ?? thicknessOptions[0] ?? null}
            />
            <ProductDetails
              product={product}
              profile={profile}
              thicknessRange={thicknessRange}
              commercialTitle={commercialTitle}
            />
          </div>
        </section>
      </div>
    </main>
  )
}
