import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  isValidFullVehicleArea,
  getShippingPresentation,
  resolveVehicleTypeFromPackages,
  validateMinimumOrder,
  resolveEpsShippingDecision,
} from '@/lib/pricing/commercialRules'

describe('EPS ticari kuralları', () => {
  it('399,9 m² set teklifini reddeder, 400 m² teklifi kabul eder', () => {
    expect(validateMinimumOrder(399.9, 400)).toEqual({
      ok: false,
      minimumM2: 400,
    })
    expect(validateMinimumOrder(400, 400)).toEqual({ ok: true })
  })

  it('zorunlu set kalemleri tam olduğunda nakliyeyi fiyata dahil eder', () => {
    expect(
      resolveEpsShippingDecision({
        saleMode: 'complete_set',
        areaM2: 400,
        minimumSetM2: 400,
        requiredAccessoriesComplete: true,
        isFullVehicle: false,
        requiresSeparateShipping: false,
      }),
    ).toMatchObject({ mode: 'included_in_sale_price', isPriceFinal: true })
  })

  it('yalnız levhada tam araç altı nakliyeyi alıcıya bırakır', () => {
    expect(
      resolveEpsShippingDecision({
        saleMode: 'plate_only',
        areaM2: 400,
        minimumSetM2: 400,
        requiredAccessoriesComplete: false,
        isFullVehicle: false,
        requiresSeparateShipping: false,
      }),
    ).toMatchObject({ mode: 'buyer_pays', isPriceFinal: false })
  })

  it('TEKNO sevkiyat verisi net değilse kesin fiyat üretmez', () => {
    expect(
      resolveEpsShippingDecision({
        saleMode: 'complete_set',
        areaM2: 400,
        minimumSetM2: 400,
        requiredAccessoriesComplete: true,
        isFullVehicle: false,
        requiresSeparateShipping: true,
      }),
    ).toMatchObject({ mode: 'separate_quote_required', isPriceFinal: false })
  })

  it('netleşmeyen sevkiyatı PDF üzerinde alıcıya ait diye değiştirmez', () => {
    expect(getShippingPresentation('separate_quote_required')).toMatchObject({
      statusLabel: 'SATIŞ GÖRÜŞMESİNDE NETLEŞİR',
      footerLabel: 'TEYİT GEREKİR',
      isIncluded: false,
    })
  })

  it('taşyününde yalnız tam kamyon/TIR ve kombinasyonlarını kabul eder', () => {
    const capacities = {
      lorryCapacityM2: 806.4,
      truckCapacityM2: 1200,
      packageSizeM2: 5.04,
    }

    expect(isValidFullVehicleArea({ areaM2: 806.4, ...capacities })).toBe(true)
    expect(isValidFullVehicleArea({ areaM2: 1200, ...capacities })).toBe(true)
    expect(isValidFullVehicleArea({ areaM2: 2006.4, ...capacities })).toBe(true)
    expect(isValidFullVehicleArea({ areaM2: 804, ...capacities })).toBe(false)
    expect(isValidFullVehicleArea({ areaM2: 900, ...capacities })).toBe(false)
  })

  it('tam kamyonu TIR olarak etiketlemez', () => {
    const capacities = {
      lorryCapacityPackages: 224,
      truckCapacityPackages: 416,
    }

    expect(resolveVehicleTypeFromPackages({ packageCount: 224, ...capacities })).toBe('lorry')
    expect(resolveVehicleTypeFromPackages({ packageCount: 416, ...capacities })).toBe('truck')
    expect(resolveVehicleTypeFromPackages({ packageCount: 640, ...capacities })).toBe('multiple')
  })

  it('Wizard EPS setinde ortak nakliye kararını ve zorunlu aksesuar kapısını tüketir', () => {
    const wizardSource = readFileSync(
      fileURLToPath(
        new URL('../../components/wizard/WizardCalculator.tsx', import.meta.url),
      ),
      'utf8',
    )

    expect(wizardSource).toContain('resolveEpsShippingDecision({')
    expect(wizardSource).toContain('requiredAccessoriesComplete')
    expect(wizardSource).toContain("selectedMalzeme === 'eps' && !requiredAccessoriesComplete")
  })

  it('Wizard nakliyeyi aksesuar sevkiyat flag\'ine bağlamaz — Tekno her metrajda dahil', () => {
    // Karar (2026-07-25): requires_separate_shipping artık wizard nakliye
    // kararını etkilemez; TEKNO dahil aksesuar markalarında nakliye her
    // metrajda satış fiyatına dahildir. Flag okuması geri eklenirse bu test
    // kırılarak "satış görüşmesinde netleşir" regresyonunu yakalar.
    const wizardSource = readFileSync(
      fileURLToPath(
        new URL('../../components/wizard/WizardCalculator.tsx', import.meta.url),
      ),
      'utf8',
    )

    expect(wizardSource).not.toContain('requires_separate_shipping')
    expect(wizardSource).toContain('requiresSeparateShipping: false')
  })
})
