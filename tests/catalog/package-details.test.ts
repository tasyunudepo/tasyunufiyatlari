import { describe, expect, it } from 'vitest'
import type { CatalogProductView } from '@/lib/catalog/types'
import {
  parseBoardSizeLabel,
  resolvePlatePackageDetail,
  type ProductLogisticsCapacity,
} from '@/lib/catalog/package-details'

const product = {
  thickness_options: [5, 6],
  thickness_prices: [
    { thickness: 5, base_price: 1, is_kdv_included: false, discount_2: 0, stock_tuzla: 0, package_m2: 3.6 },
    { thickness: 6, base_price: 1, is_kdv_included: false, discount_2: 0, stock_tuzla: 0, package_m2: null },
  ],
} as CatalogProductView

const logistics: ProductLogisticsCapacity[] = [
  {
    thickness: 50,
    items_per_package: 6,
    package_size_m2: 9.9,
    lorry_capacity_m2: 806.4,
    truck_capacity_m2: 1497.6,
    lorry_capacity_packages: 224,
    truck_capacity_packages: 416,
    is_popular: true,
    notes: 'Levha boyutu: 600×1000mm, Paket içi: 6 adet',
  },
  {
    thickness: 60,
    items_per_package: 5,
    package_size_m2: 3,
    lorry_capacity_m2: 672,
    truck_capacity_m2: 1248,
    lorry_capacity_packages: 224,
    truck_capacity_packages: 416,
    is_popular: false,
    notes: 'Levha boyutu: 600x1000mm, Paket içi: 5 adet',
  },
]

describe('levha paket detayları', () => {
  it('ürüne özel paket m² değerini genel lojistik değerinden önce kullanır', () => {
    const detail = resolvePlatePackageDetail(product, logistics, 5)

    expect(detail).toMatchObject({
      thicknessCm: 5,
      packageM2: 3.6,
      itemsPerPackage: 6,
      boardSizeLabel: '60 × 100 cm',
      lorryPackages: 224,
      truckPackages: 416,
    })
  })

  it('ürün satırında paket m² yoksa mevcut lojistik yedeğini korur', () => {
    expect(resolvePlatePackageDetail(product, logistics, 6)?.packageM2).toBe(3)
  })

  it('doğrulanmış ölçü kalıbı yoksa fiziksel ölçü uydurmaz', () => {
    expect(parseBoardSizeLabel('Paket içi: 6 adet')).toBeNull()
  })
})
