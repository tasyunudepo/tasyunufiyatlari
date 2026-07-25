import { describe, expect, it } from 'vitest'

import { calculatePackagePricing } from '@/lib/package-engine/calcPricing'
import type {
  PackageEngineInput,
  QuantityResult,
  RecipeSlot,
  SelectedRecipe,
} from '@/lib/package-engine/types'
import type { Accessory, AccessoryType, Brand, PackageSlot, ShippingZone } from '@/lib/types'

// ─── Fixture'lar ─────────────────────────────────────────────

const teknoBrand: Brand = { id: 6, name: 'TEKNO' } as Brand

const yapistiriciType: AccessoryType = { id: 1, name: 'Yapıştırıcı' } as AccessoryType

function makeAccessory(overrides: Partial<Accessory>): Accessory {
  return {
    id: 1,
    brand_id: 6,
    accessory_type_id: 1,
    name: 'TEKNOİZOFİX',
    short_name: 'Yapıştırıcı',
    unit: 'PKT',
    unit_content: 25,
    base_price: 247.17,
    is_for_eps: true,
    is_for_tasyunu: true,
    dowel_length: null,
    discount_1: 40,
    discount_2: 5,
    discount_rate_2: 8,
    is_kdv_included: false,
    package_slot: 'yapistirici' as PackageSlot,
    commercial_mode: 'quote_only',
    quality_band: null,
    wizard_visible: true,
    is_package_eligible: true,
    brand_tier: null,
    sales_priority: 1,
    ...overrides,
  } as Accessory
}

function accessorySlot(accessory: Accessory): RecipeSlot {
  return { kind: 'accessory', accessory, accessoryType: yapistiriciType, brand: teknoBrand }
}

const zone: ShippingZone = {
  city_code: 34,
  city_name: 'İstanbul',
  base_shipping_cost: 12_000,
  discount_kamyon: 0,
  discount_tir: 10,
  optimix_toz_discount: 0,
  optimix_levha_discount: 0,
  is_active: true,
}

function makeInput(overrides: Partial<PackageEngineInput> = {}): PackageEngineInput {
  return { materialType: 'tasyunu', thicknessCm: 10, areaM2: 1000, cityCode: 34, ...overrides }
}

function makeQuantities(slotQty: Array<[PackageSlot, number]>, overrides: Partial<QuantityResult> = {}): QuantityResult {
  return {
    slots: slotQty.map(([slot, quantity]) => ({ slot, quantity, unit: 'PKT' })),
    platePackageCount: 0,
    packageSizeM2: 0,
    vehicleType: 'none',
    truckFillPct: 0,
    lorryFillPct: 0,
    logisticsWarnings: [],
    ...overrides,
  }
}

function priceOneAccessory(accessory: Accessory) {
  const recipe: SelectedRecipe = new Map([['yapistirici' as PackageSlot, accessorySlot(accessory)]])
  return calculatePackagePricing(recipe, makeQuantities([['yapistirici' as PackageSlot, 1]]), makeInput(), zone)
}

// ─── Testler ─────────────────────────────────────────────────

describe('İskonto zinciri + KDV normalizasyonu (aksesuar)', () => {
  it('KDV hariç liste fiyatını 1,20’ye BÖLMEZ — Tekno regresyonu (2026-07-23)', () => {
    // Tedarikçi PDF dipnotu: "Fiyatlarımıza KDV dahil değildir."
    // 247,17 × 0,60 × 0,95 = 140,89 net. Hatalı halde (bayrak true)
    // motor 247,17/1,2 üzerinden 113,70 üretiyordu → ~%16,7 zarar.
    const item = priceOneAccessory(makeAccessory({ is_kdv_included: false })).items[0]
    expect(item.unitPriceNet).toBeCloseTo(140.89, 2)
    expect(item.unitPriceGross).toBeCloseTo(169.06, 2)
    expect(item.unitPriceNet).not.toBeCloseTo(113.7, 1)
  })

  it('KDV dahil fiyatta önce KDV ayrılır, sonra zincir uygulanır', () => {
    // 120 dahil → 100 net → ×0,60×0,95 = 57,00
    const item = priceOneAccessory(
      makeAccessory({ base_price: 120, is_kdv_included: true }),
    ).items[0]
    expect(item.unitPriceNet).toBeCloseTo(57, 2)
    expect(item.unitPriceGross).toBeCloseTo(68.4, 2)
  })

  it('discount_rate_2 hesaba karışmaz (üst sınır bilgisidir, kırım değildir)', () => {
    const a = priceOneAccessory(makeAccessory({ discount_rate_2: 8 })).items[0]
    const b = priceOneAccessory(makeAccessory({ discount_rate_2: 50 })).items[0]
    expect(a.unitPriceNet).toBe(b.unitPriceNet)
  })

  it('miktar toplamları birim fiyatın kuruş yuvarlamasıyla tutarlıdır', () => {
    const accessory = makeAccessory({})
    const recipe: SelectedRecipe = new Map([['yapistirici' as PackageSlot, accessorySlot(accessory)]])
    const result = calculatePackagePricing(
      recipe,
      makeQuantities([['yapistirici' as PackageSlot, 37]]),
      makeInput(),
      zone,
    )
    const item = result.items[0]
    expect(item.totalPriceNet).toBeCloseTo(140.8869 * 37, 1)
    expect(item.totalPriceGross).toBeCloseTo(item.totalPriceNet * 1.2, 1)
  })
})

describe('Toplamlar ve nakliye', () => {
  it('KDV tutarı = brüt − net; nakliye matraha bir kez girer', () => {
    const result = priceOneAccessory(makeAccessory({}))
    // vehicleType 'none' → iskontosuz taban nakliye
    expect(result.shippingCost).toBe(12_000)
    expect(result.grandTotalGross - result.grandTotalNet).toBeCloseTo(result.vatAmount, 2)
    expect(result.grandTotalNet).toBeCloseTo(result.productTotalNet + 12_000 / 1.2, 2)
    expect(result.isPriceFinal).toBe(true)
  })

  it('TIR aracında bölge TIR iskontosu nakliyeye uygulanır', () => {
    const accessory = makeAccessory({})
    const recipe: SelectedRecipe = new Map([['yapistirici' as PackageSlot, accessorySlot(accessory)]])
    const result = calculatePackagePricing(
      recipe,
      makeQuantities([['yapistirici' as PackageSlot, 1]], { vehicleType: 'truck' }),
      makeInput(),
      zone,
    )
    expect(result.shippingCost).toBe(12_000 * 0.9)
    expect(result.shippingMode).toBe('tir_discount')
  })

  it('düşük metrajda fiyat kesinleşmez: nakliye null + uyarı', () => {
    const accessory = makeAccessory({})
    const recipe: SelectedRecipe = new Map([['yapistirici' as PackageSlot, accessorySlot(accessory)]])
    const result = calculatePackagePricing(
      recipe,
      makeQuantities([['yapistirici' as PackageSlot, 1]]),
      makeInput({ areaM2: 150 }),
      zone,
    )
    expect(result.shippingCost).toBeNull()
    expect(result.isPriceFinal).toBe(false)
    expect(result.shippingMode).toBe('low_metrage_excluded')
    expect(result.warnings.some((w) => w.includes('düşük metraj'))).toBe(true)
  })

  it('m² fiyatı brüt toplam / metraj ilişkisini korur', () => {
    const result = priceOneAccessory(makeAccessory({}))
    expect(result.pricePerM2Gross).toBeCloseTo(result.grandTotalGross / 1000, 2)
    expect(result.pricePerM2Net).toBeCloseTo(result.grandTotalNet / 1000, 2)
  })
})
