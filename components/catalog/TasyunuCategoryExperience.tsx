'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  FileText,
  MapPin,
  SlidersHorizontal,
  Truck,
} from '@phosphor-icons/react'

import ProductCard from '@/components/catalog/ProductCard'
import {
  TASYUNU_SECTIONS,
  getDensityBadge,
  resolveTasyunuSection,
} from '@/lib/catalog/sections'
import type { CatalogProductView } from '@/lib/catalog/types'
import {
  getOrCreateCatalogJourneyId,
  notifyCategoryCtaClick,
  notifyCategoryCtaViewed,
  notifyCategoryFilterChanged,
  notifyCategoryProductClick,
  notifyCategorySectionSelected,
} from '@/lib/analytics/catalogJourney'
import { buildCategoryProductQuery } from '@/lib/catalog/category-entry-context'
import { ICON_WEIGHT } from '@/lib/design/tokens'
import { useWizardStore } from '@/lib/store/wizardStore'

interface ShippingZoneOption {
  city_code: number
  city_name: string
}

interface TasyunuCategoryExperienceProps {
  products: CatalogProductView[]
  shippingZones: ShippingZoneOption[]
}

type DensityFilter = 'all' | 'declared' | 'gte150'

interface FilterState {
  brand: string
  thickness: string
  density: DensityFilter
}

const DEFAULT_SECTION = 'mantolama'
const EMPTY_FILTERS: FilterState = {
  brand: 'all',
  thickness: 'all',
  density: 'all',
}
const VALID_DENSITY_FILTERS = new Set<DensityFilter>(['all', 'declared', 'gte150'])
const DIRECTION_CONTRACT = `<!--
THESIS: Ürün listesini teslim fiyatına giden üç bilgilik bir karar masasına dönüştür; yatay katalog şeridini reddet.
OWN-WORLD: Sıcak mimari numune masası; koyu karar paneli, kâğıt zemin, gerçek ürün kapakları.
STORY: Niyeti tanı; uygulamayı seç; teknik kartı tara; fiyatı hesapla veya karşılaştır.
FIRST VIEWPORT: Büyük karar başlığı solda, çalışan mini fiyat başlangıcı sağda, yedi kullanım alanı hemen altında.
FORM: Guided selector rail + responsive product workbench; mode persuade; seed ee562c3c; brief-pinned Karar Masası.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`

function parseArea(rawValue: string): number | null {
  const compact = rawValue.trim().replace(/\s/g, '')
  if (!compact) return null

  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(compact)
      ? compact.replace(/\./g, '')
      : compact
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

function densityMaximum(product: CatalogProductView): number | null {
  const badge = getDensityBadge(product.model)
  if (!badge) return null
  const values = badge.match(/\d+(?:[.,]\d+)?/g)
    ?.map((value) => Number(value.replace(',', '.')))
    .filter(Number.isFinite) ?? []
  return values.length > 0 ? Math.max(...values) : null
}

function productMatchesFilters(product: CatalogProductView, filters: FilterState): boolean {
  if (filters.brand !== 'all' && product.brand.name !== filters.brand) return false
  if (filters.thickness !== 'all') {
    const target = Number(filters.thickness)
    if (!product.thickness_options?.includes(target)) return false
  }
  const maximumDensity = densityMaximum(product)
  if (filters.density === 'declared' && maximumDensity === null) return false
  if (filters.density === 'gte150' && (maximumDensity === null || maximumDensity < 150)) return false
  return true
}

export default function TasyunuCategoryExperience({
  products,
  shippingZones,
}: TasyunuCategoryExperienceProps) {
  const router = useRouter()
  const heroCtaRef = useRef<HTMLButtonElement>(null)
  const catalogJourneyIdRef = useRef('')
  const [activeSection, setActiveSection] = useState(DEFAULT_SECTION)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [area, setArea] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedCityCode, setSelectedCityCode] = useState(() => (
    shippingZones.find((zone) => zone.city_code === 34)?.city_code
      ?? shippingZones[0]?.city_code
      ?? 0
  ))

  const groupedProducts = useMemo(() => TASYUNU_SECTIONS.map((section) => ({
    section,
    items: products.filter((product) => resolveTasyunuSection(product.model) === section.key),
  })).filter((group) => group.items.length > 0), [products])

  const allBrands = useMemo(
    () => new Set(products.map((product) => product.brand.name)),
    [products],
  )

  const allThicknesses = useMemo(
    () => [...new Set(products.flatMap((product) => product.thickness_options ?? []))]
      .sort((a, b) => a - b),
    [products],
  )

  const readUrlState = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    const section = params.get('uygulama')
    const brand = params.get('marka')
    const thickness = params.get('kalinlik')
    const density = params.get('yogunluk') as DensityFilter | null

    const requestedSection = groupedProducts.find(
      (group) => group.section.key === section,
    )?.section.key
    setActiveSection(requestedSection ?? DEFAULT_SECTION)
    setFilters({
      brand: brand && allBrands.has(brand) ? brand : 'all',
      thickness: thickness && allThicknesses.includes(Number(thickness)) ? thickness : 'all',
      density: density && VALID_DENSITY_FILTERS.has(density) ? density : 'all',
    })
  }, [allBrands, allThicknesses, groupedProducts])

  const currentCatalogJourneyId = useCallback(() => {
    if (!catalogJourneyIdRef.current) {
      catalogJourneyIdRef.current = getOrCreateCatalogJourneyId()
    }
    return catalogJourneyIdRef.current
  }, [])

  useEffect(() => {
    const catalogJourneyId = currentCatalogJourneyId()
    const initialStateTimer = window.setTimeout(readUrlState, 0)
    window.addEventListener('popstate', readUrlState)
    const payload = {
      category_slug: 'tasyunu-levha',
      catalog_journey_id: catalogJourneyId,
      cta_type: 'price_calculator' as const,
      cta_location: 'hero' as const,
    }
    if (typeof IntersectionObserver === 'undefined') {
      notifyCategoryCtaViewed(payload)
      return () => {
        window.clearTimeout(initialStateTimer)
        window.removeEventListener('popstate', readUrlState)
      }
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      notifyCategoryCtaViewed(payload)
      observer.disconnect()
    }, { threshold: 0.45 })
    if (heroCtaRef.current) observer.observe(heroCtaRef.current)
    return () => {
      observer.disconnect()
      window.clearTimeout(initialStateTimer)
      window.removeEventListener('popstate', readUrlState)
    }
  }, [currentCatalogJourneyId, readUrlState])

  const writeUrlState = useCallback((
    nextSection: string,
    nextFilters: FilterState,
    mode: 'push' | 'replace' = 'replace',
  ) => {
    const url = new URL(window.location.href)
    if (nextSection === DEFAULT_SECTION) url.searchParams.delete('uygulama')
    else url.searchParams.set('uygulama', nextSection)

    if (nextFilters.brand === 'all') url.searchParams.delete('marka')
    else url.searchParams.set('marka', nextFilters.brand)
    if (nextFilters.thickness === 'all') url.searchParams.delete('kalinlik')
    else url.searchParams.set('kalinlik', nextFilters.thickness)
    if (nextFilters.density === 'all') url.searchParams.delete('yogunluk')
    else url.searchParams.set('yogunluk', nextFilters.density)

    window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', url)
  }, [])

  const activeGroup = groupedProducts.find((group) => group.section.key === activeSection)
    ?? groupedProducts[0]
  const activeItems = activeGroup?.items ?? []
  const filteredItems = activeItems.filter((product) => productMatchesFilters(product, filters))
  const selectSection = (sectionKey: string, scrollToCatalog: boolean) => {
    const group = groupedProducts.find((candidate) => candidate.section.key === sectionKey)
    if (!group) return
    setActiveSection(sectionKey)
    setFilters(EMPTY_FILTERS)
    setFormError(null)
    writeUrlState(sectionKey, EMPTY_FILTERS, 'push')
    notifyCategorySectionSelected({
      category_slug: 'tasyunu-levha',
      catalog_journey_id: currentCatalogJourneyId(),
      section_key: sectionKey,
      section_position: groupedProducts.findIndex(
        (candidate) => candidate.section.key === sectionKey,
      ) + 1,
      result_count: group.items.length,
    })
    if (scrollToCatalog) {
      window.requestAnimationFrame(() => {
        document.getElementById('urunler')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  const changeFilter = (
    filterName: keyof FilterState,
    value: string,
  ) => {
    const nextFilters = { ...filters, [filterName]: value } as FilterState
    setFilters(nextFilters)
    writeUrlState(activeSection, nextFilters)
    notifyCategoryFilterChanged({
      category_slug: 'tasyunu-levha',
      catalog_journey_id: currentCatalogJourneyId(),
      section_key: activeSection,
      filter_name: filterName,
      filter_value: value,
      result_count: activeItems.filter((product) => productMatchesFilters(product, nextFilters)).length,
    })
  }

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS)
    writeUrlState(activeSection, EMPTY_FILTERS)
  }

  const handleDecisionSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (activeSection !== DEFAULT_SECTION) {
      notifyCategoryCtaClick({
        category_slug: 'tasyunu-levha',
        catalog_journey_id: currentCatalogJourneyId(),
        cta_type: 'product_discovery',
        cta_location: 'hero',
        section_key: activeSection,
      })
      selectSection(activeSection, true)
      return
    }

    const areaM2 = parseArea(area)
    if (!selectedCityCode) {
      setFormError('Teslim ilini seçin.')
      return
    }
    if (areaM2 === null || areaM2 < 1 || areaM2 > 10_000) {
      setFormError('1 ile 10.000 m² arasında yaklaşık proje metrajı girin.')
      return
    }

    const catalogJourneyId = currentCatalogJourneyId()
    notifyCategoryCtaClick({
      category_slug: 'tasyunu-levha',
      catalog_journey_id: catalogJourneyId,
      cta_type: 'price_calculator',
      cta_location: 'hero',
      section_key: activeSection,
    })

    const store = useWizardStore.getState()
    store.reset()
    store.setProductPreset({
      material: 'tasyunu',
      thicknessCm: 5,
      cityCode: selectedCityCode,
      areaM2,
      entrySurface: 'category',
      catalogJourneyId,
      sectionKey: activeSection,
    })
    router.push('/#mantolama-hesaplayici')
  }

  const selectedSectionTitle = activeGroup?.section.title ?? 'Taşyünü Levhaları'
  const isMantolama = activeSection === DEFAULT_SECTION
  const brandOptions = [...new Set(activeItems.map((product) => product.brand.name))]
    .sort((a, b) => a.localeCompare(b, 'tr-TR'))

  return (
    <main
      className="min-w-0 overflow-x-clip"
      data-testid="tasyunu-category"
      data-impeccable-seed="ee562c3c"
    >
      <span hidden aria-hidden="true" dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
      <div className="mx-auto w-full max-w-[1240px] min-w-0 px-4 pb-20 pt-5 sm:px-6 sm:pt-8 lg:pb-28">
        <nav aria-label="İçerik yolu" className="mb-7 flex flex-wrap items-center gap-2 text-xs text-hub-muted sm:mb-10">
          <Link href="/" prefetch={false} className="min-h-11 content-center hover:text-hub-gold">Ana Sayfa</Link>
          <span aria-hidden="true">/</span>
          <Link href="/urunler" prefetch={false} className="min-h-11 content-center hover:text-hub-gold">Ürünler</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="font-semibold text-hub-ink-2">Taşyünü Levha</span>
        </nav>

        <section className="grid items-center gap-10 pb-12 lg:grid-cols-[minmax(0,1.04fr)_minmax(420px,.96fr)] lg:gap-16 lg:pb-16">
          <div className="min-w-0">
            <h1 className="max-w-[760px] text-balance font-heading text-[43px] font-extrabold leading-[1.01] tracking-[-0.035em] text-hub-ink sm:text-[58px] lg:text-[72px]">
              Doğru levhayı bulun. Teslim fiyatına geçin.
            </h1>
            <p className="mt-5 max-w-[650px] text-base leading-7 text-hub-ink-2 sm:mt-6 sm:text-lg sm:leading-8">
              {products.length} taşyünü levhayı uygulama, yoğunluk ve kalınlığa göre daraltın.
              Mantolama ürünlerinde il ve metrajı seçerek proje ölçeğindeki fiyat hesabını başlatın.
            </p>

            <a
              href="#proje-hesabi"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#e7c77d] px-5 text-sm font-extrabold text-[#17130b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hub-gold focus-visible:ring-offset-2 sm:hidden"
            >
              Fiyat hesabını başlat
              <ArrowRight size={17} weight={ICON_WEIGHT} aria-hidden="true" />
            </a>

            <div className="mt-7 grid border-y border-hub-rule sm:grid-cols-3 lg:mt-9" aria-label="Satış ve fiyat koşulları">
              <div className="flex min-h-[76px] items-start gap-3 py-4 pr-4 text-sm leading-5 text-hub-ink-2">
                <Truck size={20} weight={ICON_WEIGHT} className="mt-0.5 shrink-0 text-hub-gold" aria-hidden="true" />
                <span>Tam araç koşulunda nakliye fiyata dahildir.</span>
              </div>
              <div className="flex min-h-[76px] items-start gap-3 border-t border-hub-rule py-4 text-sm leading-5 text-hub-ink-2 sm:border-l sm:border-t-0 sm:px-4">
                <FileText size={20} weight={ICON_WEIGHT} className="mt-0.5 shrink-0 text-hub-gold" aria-hidden="true" />
                <span>Teknik değerlerin kaynağı ürün bazında gösterilir.</span>
              </div>
              <div className="flex min-h-[76px] items-start gap-3 border-t border-hub-rule py-4 text-sm leading-5 text-hub-ink-2 sm:border-l sm:border-t-0 sm:pl-4">
                <MapPin size={20} weight={ICON_WEIGHT} className="mt-0.5 shrink-0 text-hub-gold" aria-hidden="true" />
                <span>Fiyat; il, kalınlık ve tam araç metrajıyla netleşir.</span>
              </div>
            </div>
          </div>

          <form
            id="proje-hesabi"
            data-testid="category-decision-form"
            onSubmit={handleDecisionSubmit}
            className="scroll-mt-20 rounded-[14px] bg-[#171612] p-5 text-[#f8f4eb] shadow-[0_20px_46px_rgba(39,31,17,0.16)] sm:p-7"
          >
            <h2 className="font-heading text-2xl font-bold tracking-[-0.02em]">
              {isMantolama ? 'Projenin ilk 3 bilgisini seçin' : 'Uygulamaya uygun levhaları görün'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#b7afa1]">
              {isMantolama
                ? 'Bu alan fiyat sonucunu üretmez; doğru hesap akışını hazırlar.'
                : 'Bu uygulama henüz komple set hesaplayıcısında değil; doğru ürün grubuna geçin.'}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-2 text-xs font-bold text-[#d1c8b9]">
                Uygulama
                <select
                  value={activeSection}
                  onChange={(event) => selectSection(event.target.value, false)}
                  className="min-h-12 w-full rounded-[10px] border border-[#4a453c] bg-[#24211c] px-3 text-base font-medium text-white focus:border-[#e7c77d] focus:outline-none focus:ring-2 focus:ring-[#e7c77d]/25"
                >
                  {groupedProducts.map(({ section }) => (
                    <option key={section.key} value={section.key}>{section.title}</option>
                  ))}
                </select>
              </label>

              {isMantolama && (
                <label className="flex min-w-0 flex-col gap-2 text-xs font-bold text-[#d1c8b9]">
                  Teslim ili
                  <select
                    value={selectedCityCode}
                    onChange={(event) => setSelectedCityCode(Number(event.target.value))}
                    disabled={shippingZones.length === 0}
                    className="min-h-12 w-full rounded-[10px] border border-[#4a453c] bg-[#24211c] px-3 text-base font-medium text-white focus:border-[#e7c77d] focus:outline-none focus:ring-2 focus:ring-[#e7c77d]/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {shippingZones.map((zone) => (
                      <option key={zone.city_code} value={zone.city_code}>{zone.city_name}</option>
                    ))}
                  </select>
                </label>
              )}

              {isMantolama && (
                <label className="flex min-w-0 flex-col gap-2 text-xs font-bold text-[#d1c8b9] sm:col-span-2">
                  Yaklaşık metraj
                  <span className="relative">
                    <input
                      value={area}
                      onChange={(event) => setArea(event.target.value)}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="Örn. 1200"
                      aria-describedby="category-area-note"
                      className="min-h-12 w-full rounded-[10px] border border-[#4a453c] bg-[#24211c] px-3 pr-12 text-base font-medium text-white placeholder:text-[#9e9689] focus:border-[#e7c77d] focus:outline-none focus:ring-2 focus:ring-[#e7c77d]/25"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[#aaa295]">m²</span>
                  </span>
                </label>
              )}
            </div>

            {formError && (
              <p role="alert" className="mt-4 rounded-lg bg-[#4b231f] px-3 py-2 text-sm text-[#ffe0da]">
                {formError}
              </p>
            )}

            <button
              ref={heroCtaRef}
              type="submit"
              className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[10px] bg-[#e7c77d] px-5 text-base font-extrabold text-[#17130b] transition-colors hover:bg-[#d9b75f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff0bd] focus-visible:ring-offset-2 focus-visible:ring-offset-[#171612]"
            >
              {isMantolama ? 'Fiyatımı hesapla' : 'Uygun ürünleri göster'}
              <ArrowRight size={18} weight={ICON_WEIGHT} aria-hidden="true" />
            </button>
            <p id="category-area-note" className="mt-3 text-xs leading-5 text-[#aaa295]">
              {isMantolama
                ? 'Fiyatlar sonuçta KDV hariç gösterilir. Hesap, geçerli tam Kamyon/TIR metrajına yönlendirir.'
                : 'Ürün detayında satış biçimi, minimum sipariş ve teklif yolu ayrıca gösterilir.'}
            </p>
          </form>
        </section>

        <nav
          aria-label="Kullanım alanları"
          data-testid="category-usage-nav"
          className="min-w-0 rounded-[14px] bg-white p-5 shadow-[0_10px_30px_rgba(39,31,17,0.07)] sm:p-6"
        >
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="font-heading text-2xl font-bold tracking-[-0.02em] text-hub-ink">
              Hangi yüzeyi yalıtıyorsunuz?
            </h2>
            <p className="text-sm text-hub-muted">{products.length} ürün · {groupedProducts.length} kullanım alanı</p>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
            {groupedProducts.map(({ section, items }) => {
              const isActive = section.key === activeSection
              return (
                <button
                  key={section.key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => selectSection(section.key, true)}
                  className={`flex min-h-[76px] min-w-0 flex-col justify-between gap-2 rounded-[11px] px-3 py-3 text-left transition-[background-color,border-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hub-gold focus-visible:ring-offset-2 ${
                    isActive
                      ? 'border border-[#171612] bg-[#171612] text-white'
                      : 'border border-hub-rule bg-white text-hub-ink-2 hover:border-[#a98a53]'
                  }`}
                >
                  <strong className="text-sm leading-5">{section.title.replace(' Levhaları', '')}</strong>
                  <span className={isActive ? 'text-xs text-[#d7c9ad]' : 'text-xs text-hub-muted'}>{items.length} ürün</span>
                </button>
              )
            })}
          </div>
        </nav>

        <section id="urunler" className="scroll-mt-20 pt-14 sm:pt-16" aria-labelledby="category-products-title">
          <div className="border-b border-hub-rule pb-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-[720px]">
                <h2 id="category-products-title" className="font-heading text-3xl font-bold tracking-[-0.025em] text-hub-ink sm:text-4xl">
                  {selectedSectionTitle}
                </h2>
                <p className="mt-2 text-sm leading-6 text-hub-ink-2 sm:text-base">
                  {activeGroup?.section.desc}
                  {isMantolama && ' Yoğunluk tek başına kalite sırası değildir; uygulama ve mekanik değerlerle birlikte değerlendirin.'}
                </p>
              </div>
              {isMantolama && (
                <Link
                  href="/tasyunu-karsilastir?entry=category"
                  prefetch={false}
                  onClick={() => notifyCategoryCtaClick({
                    category_slug: 'tasyunu-levha',
                    catalog_journey_id: currentCatalogJourneyId(),
                    cta_type: 'comparison',
                    cta_location: 'catalog_header',
                    section_key: activeSection,
                  })}
                  className="inline-flex min-h-12 w-fit items-center gap-2 rounded-[10px] border border-[#a98a53] px-4 text-sm font-bold text-hub-gold transition-colors hover:bg-[#e8dfcf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hub-gold focus-visible:ring-offset-2"
                >
                  8 mantolama levhasını karşılaştır
                  <ArrowRight size={17} weight={ICON_WEIGHT} aria-hidden="true" />
                </Link>
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_auto_auto_1fr]" aria-label="Ürün filtreleri">
              <label className="flex min-w-0 flex-col gap-1.5 text-xs font-bold text-hub-ink-2">
                Marka filtresi
                <select
                  value={filters.brand}
                  onChange={(event) => changeFilter('brand', event.target.value)}
                  className="min-h-11 rounded-[10px] border border-hub-rule bg-white px-3 text-sm font-semibold text-hub-ink focus:border-hub-gold focus:outline-none focus:ring-2 focus:ring-hub-gold/20"
                >
                  <option value="all">Tüm markalar</option>
                  {brandOptions.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1.5 text-xs font-bold text-hub-ink-2">
                Kalınlık filtresi
                <select
                  value={filters.thickness}
                  onChange={(event) => changeFilter('thickness', event.target.value)}
                  className="min-h-11 rounded-[10px] border border-hub-rule bg-white px-3 text-sm font-semibold text-hub-ink focus:border-hub-gold focus:outline-none focus:ring-2 focus:ring-hub-gold/20"
                >
                  <option value="all">Tüm kalınlıklar</option>
                  {allThicknesses.map((thickness) => (
                    <option key={thickness} value={String(thickness)}>{String(thickness).replace('.', ',')} cm</option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1.5 text-xs font-bold text-hub-ink-2">
                Yoğunluk filtresi
                <select
                  value={filters.density}
                  onChange={(event) => changeFilter('density', event.target.value)}
                  className="min-h-11 rounded-[10px] border border-hub-rule bg-white px-3 text-sm font-semibold text-hub-ink focus:border-hub-gold focus:outline-none focus:ring-2 focus:ring-hub-gold/20"
                >
                  <option value="all">Tüm beyanlar</option>
                  <option value="declared">Yoğunluk beyanı olanlar</option>
                  <option value="gte150">En az 150 kg/m³</option>
                </select>
              </label>
              <div className="flex items-end justify-between gap-3 lg:justify-end">
                <p data-testid="category-results-count" aria-live="polite" className="min-h-11 content-center text-sm font-semibold text-hub-ink-2">
                  {filteredItems.length} ürün gösteriliyor
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={filters.brand === 'all' && filters.thickness === 'all' && filters.density === 'all'}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-sm font-bold text-hub-gold hover:bg-[#e8dfcf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hub-gold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <SlidersHorizontal size={17} weight={ICON_WEIGHT} aria-hidden="true" />
                  Filtreleri temizle
                </button>
              </div>
            </div>
          </div>

          {groupedProducts.map(({ section, items }) => {
            const isActive = section.key === activeSection
            const visibleItems = items.filter((product) => productMatchesFilters(product, filters))
            return (
              <div
                key={section.key}
                hidden={!isActive}
                data-testid={isActive ? 'category-product-grid' : undefined}
                className="pt-6"
              >
                {visibleItems.length > 0 ? (
                  <div
                    key={`${section.key}-${filters.brand}-${filters.thickness}-${filters.density}`}
                    className="grid min-w-0 grid-cols-1 gap-5 motion-safe:animate-[category-workbench-in_240ms_cubic-bezier(0.22,1,0.36,1)] sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {visibleItems.map((product, index) => (
                      <div
                        key={product.id}
                        className="min-w-0"
                        onClickCapture={(event) => {
                          const target = event.target as Element
                          if (target.closest('[data-category-compare-link]')) {
                            notifyCategoryCtaClick({
                              category_slug: 'tasyunu-levha',
                              catalog_journey_id: currentCatalogJourneyId(),
                              cta_type: 'comparison',
                              cta_location: 'product_card',
                              section_key: section.key,
                            })
                            return
                          }
                          if (!target.closest('[data-category-product-link]')) return
                          notifyCategoryProductClick({
                            category_slug: 'tasyunu-levha',
                            catalog_journey_id: currentCatalogJourneyId(),
                            product_slug: product.slug,
                            brand_name: product.brand.name,
                            model_name: product.model,
                            section_key: section.key,
                            card_position: index + 1,
                            price_visibility: product.rules.pricing_visibility_mode,
                          })
                        }}
                      >
                        <ProductCard
                          product={product}
                          kategori="tasyunu-levha"
                          tone="warm"
                          query={buildCategoryProductQuery(section.key)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[14px] bg-white px-5 py-12 text-center shadow-[0_10px_28px_rgba(39,31,17,0.07)]">
                    <SlidersHorizontal size={30} weight={ICON_WEIGHT} className="mx-auto text-hub-gold" aria-hidden="true" />
                    <h3 className="mt-4 font-heading text-xl font-bold text-hub-ink">Bu filtrelerle eşleşen levha yok.</h3>
                    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-hub-muted">
                      Marka, kalınlık veya yoğunluk filtresini kaldırarak bu kullanım alanındaki ürünlere dönün.
                    </p>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[10px] bg-[#171612] px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hub-gold focus-visible:ring-offset-2"
                    >
                      Filtreleri temizle
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </section>

        <section className="mt-16 overflow-hidden rounded-[14px] bg-[#171612] text-white shadow-[0_20px_46px_rgba(39,31,17,0.15)] sm:mt-20">
          <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
            <div className="relative min-h-[280px] lg:min-h-[380px]">
              <Image
                src="/depo/tasyunu-depo.webp"
                alt="ÖzerGrup taşyünü depo ve yükleme alanı"
                fill
                sizes="(max-width: 1024px) 100vw, 46vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col justify-center px-5 py-9 sm:px-9 sm:py-12 lg:px-12">
              <h2 className="max-w-[620px] font-heading text-3xl font-bold leading-tight tracking-[-0.025em] sm:text-4xl">
                Levha seçimi, sevkiyat planından ayrı değildir.
              </h2>
              <p className="mt-4 max-w-[620px] text-base leading-7 text-[#c8c0b3]">
                ÖzerGrup satışı; ürün, kalınlık, teslim ili ve tam araç metrajını aynı hesapta birleştirir.
                Uygun tam Kamyon/TIR düzeninde nakliye fiyata dahil gösterilir; KDV sonuçta ayrıca belirtilir.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#proje-hesabi"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-[#e7c77d] px-5 text-sm font-extrabold text-[#17130b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#171612]"
                >
                  Proje hesabına dön
                  <ArrowRight size={17} weight={ICON_WEIGHT} aria-hidden="true" />
                </a>
                <Link
                  href="/tasyunu-karsilastir?entry=category"
                  prefetch={false}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] border border-[#6d6048] px-5 text-sm font-bold text-[#f2e8d5] hover:border-[#e7c77d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#171612]"
                >
                  Teknik karşılaştırmayı aç
                  <ArrowRight size={17} weight={ICON_WEIGHT} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
