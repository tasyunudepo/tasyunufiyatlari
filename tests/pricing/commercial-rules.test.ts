import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  buildFullVehicleSuggestions,
  formatVehicleAreaInput,
  isValidFullVehicleArea,
  getShippingPresentation,
  resolveVehicleTypeFromPackages,
  validateMinimumOrder,
  resolveEpsShippingDecision,
} from '@/lib/pricing/commercialRules'

describe('Tam araç metraj önerileri', () => {
  const capacities = {
    lorryCapacityM2: 967.68,
    truckCapacityM2: 1774.08,
  }

  it('kamyon altı ihtiyaçta gerçek hassasiyetle kamyon ve TIR seçeneği üretir', () => {
    expect(buildFullVehicleSuggestions({ requestedAreaM2: 500, ...capacities })).toEqual([
      { m2: 967.68, label: '1 Kamyon' },
      { m2: 1774.08, label: '1 TIR' },
    ])
  })

  it('ihtiyacın belirgin biçimde altında kalan aracı önermez', () => {
    expect(buildFullVehicleSuggestions({ requestedAreaM2: 1000, ...capacities })).toEqual([
      { m2: 1774.08, label: '1 TIR' },
    ])
  })

  it('yüksek ara metraj için geçerli TIR ve kamyon kombinasyonlarını üretir', () => {
    expect(buildFullVehicleSuggestions({ requestedAreaM2: 2000, ...capacities })).toEqual([
      { m2: 2741.76, label: '1 TIR + 1 Kamyon' },
      { m2: 3548.16, label: '2 TIR' },
    ])
  })

  it('input değerini kayan nokta artığı olmadan kapasite hassasiyetinde yazar', () => {
    expect(formatVehicleAreaInput(967.6800000001)).toBe('967.68')
    expect(formatVehicleAreaInput(1774.1)).toBe('1774.1')
  })

  it.each([
    { lorryCapacityM2: 967.68, truckCapacityM2: 1774.08, packageSizeM2: 2.88 },
    { lorryCapacityM2: 1120, truckCapacityM2: 2080, packageSizeM2: 5 },
    { lorryCapacityM2: 806.4, truckCapacityM2: 1497.6, packageSizeM2: 5.04 },
  ])('üretilen her öneri doğrulayıcının kabul ettiği tam araç kombinasyonudur: $lorryCapacityM2/$truckCapacityM2', capacities => {
    for (const requestedAreaM2 of [1, 500, 1000, 2000, 5000]) {
      const suggestions = buildFullVehicleSuggestions({ requestedAreaM2, ...capacities })
      expect(suggestions.length).toBeGreaterThan(0)
      for (const suggestion of suggestions) {
        expect(suggestion.m2).toBeGreaterThanOrEqual(requestedAreaM2 - 0.05)
        expect(isValidFullVehicleArea({ areaM2: suggestion.m2, ...capacities })).toBe(true)
      }
    }
  })
})

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

  it('iki ondalıklı üretici kapasitesini aynen kabul eder, yuvarlanmış komşuları reddeder', () => {
    const capacities = {
      lorryCapacityM2: 967.68,
      truckCapacityM2: 1774.08,
      packageSizeM2: 2.88,
    }

    expect(isValidFullVehicleArea({ areaM2: 967.68, ...capacities })).toBe(true)
    expect(isValidFullVehicleArea({ areaM2: 967.6, ...capacities })).toBe(false)
    expect(isValidFullVehicleArea({ areaM2: 967.7, ...capacities })).toBe(false)
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
    expect(wizardSource).toContain('!requiredAccessoriesComplete || items.length !== 8')
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
