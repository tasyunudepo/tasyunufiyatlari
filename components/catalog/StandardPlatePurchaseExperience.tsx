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
      <dl className={`grid border-t border-[#ded2c0] bg-[#fffaf5] ${epsFacts.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {epsFacts.map(([label, value], index) => (
          <div key={label} className={`min-w-0 px-4 py-4 sm:px-5 ${index > 0 ? 'border-l border-[#ded2c0]' : ''}`}>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#625a4f] sm:text-xs">{label}</dt>
            <dd className="mt-1 text-sm font-extrabold leading-5 text-[#282219] sm:text-base">{value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <dl className="grid grid-cols-3 border-t border-[#ded2c0] bg-[#fffaf5]">
      {[
        ['Isı iletkenliği', profile.lambdaDisplay],
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
}: {
  product: CatalogProductView
  profile: TechnicalProfile | null
  thicknessRange: string
}) {
  const descriptionParts = product.catalog_description
    ? product.catalog_description.split(/\s*ÖZELLİKLER\s*/i)
    : []
  const descriptionIntro = descriptionParts[0]?.trim() ?? ''
  const descriptionBullets = descriptionParts.length > 1
    ? Array.from(new Set(descriptionParts.slice(1).join(' ').split(/\s*•\s*/).map(item => item.trim()).filter(Boolean)))
    : []

  if (!profile && !product.catalog_description) return null

  return (
    <section
      aria-label="Ürün teknik bilgileri"
      className="overflow-hidden rounded-[14px] border border-hub-rule bg-white shadow-[0_16px_36px_rgba(39,31,17,0.1)]"
    >
      <dl className="grid border-b border-hub-rule bg-[#fffaf0] md:hidden">
        {profile?.density && (
          <div className="px-5 py-4">
            <dt className="text-xs font-medium text-[#625c51]">Yoğunluk</dt>
            <dd className="mt-1 text-sm font-bold text-[#282219]">{profile.density.display}</dd>
            <dd className="mt-1 text-xs leading-5 text-[#625c51]">Kaynak ayrıntısı: {densitySourceLabel(profile)}</dd>
          </div>
        )}
        <div className="border-t border-hub-rule px-5 py-4">
          <dt className="text-xs font-medium text-[#625c51]">Kalınlık aralığı</dt>
          <dd className="mt-1 text-sm font-bold text-[#282219]">{thicknessRange}</dd>
        </div>
        {profile && (
          <div className="border-t border-hub-rule px-5 py-4">
            <dt className="text-xs font-medium text-[#625c51]">Yangına tepki ve kullanım</dt>
            <dd className="mt-1 text-sm font-bold leading-5 text-[#282219]">
              {profile.fireClass} sınıfı · {APPLICATION_SCOPE_LABELS[profile.applicationScope]}
            </dd>
          </div>
        )}
        {!profile && product.material_type === 'eps' && (
          <>
            <div className="border-t border-hub-rule px-5 py-4">
              <dt className="text-xs font-medium text-[#625c51]">Malzeme</dt>
              <dd className="mt-1 text-sm font-bold text-[#282219]">EPS ısı yalıtım levhası</dd>
            </div>
            {product.catalog_description?.includes('TS EN 13163') && (
              <div className="border-t border-hub-rule px-5 py-4">
                <dt className="text-xs font-medium text-[#625c51]">Ürün standardı</dt>
                <dd className="mt-1 text-sm font-bold text-[#282219]">TS EN 13163</dd>
              </div>
            )}
          </>
        )}
      </dl>

      {profile && (
        <dl className="grid border-b border-hub-rule bg-[#fffdf8] sm:grid-cols-3">
          {[
            ['Isı iletkenliği', profile.lambdaDisplay],
            ['Çekme dayanımı', profile.tensileDisplay],
            ['Basma dayanımı', profile.compressiveDisplay],
          ].map(([label, value], index) => (
            <div
              key={label}
              className={`min-w-0 px-5 py-4 ${index < 2 ? 'border-b border-hub-rule sm:border-b-0 sm:border-r' : ''}`}
            >
              <dt className="text-xs font-medium text-[#625c51]">{label}</dt>
              <dd className="mt-1 text-sm font-bold leading-5 text-[#282219] [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {product.catalog_description && (
        <div className="px-5 py-5 sm:px-7">
          <h2 className="font-heading text-base font-bold text-[#282219]">Ürün hakkında</h2>
          {descriptionIntro && (
            <p className="mt-2 max-w-[72ch] text-sm leading-6 text-[#625b50]">{descriptionIntro}</p>
          )}
          {descriptionBullets.length > 0 && (
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#625b50]">
              {descriptionBullets.map(item => (
                <li key={item} className="grid grid-cols-[8px_1fr] gap-2">
                  <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 rounded-full bg-[#9a762f]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
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

          <div className="order-3 min-w-0 xl:col-span-2">
            <ProductDetails product={product} profile={profile} thicknessRange={thicknessRange} />
          </div>
        </section>
      </div>
    </main>
  )
}
