import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('dübel boyu için levha kalınlığı uçtan uca taşınır', () => {
  it('ofis ekranı kalınlığı API parametresine ekler', () => {
    const source = readFileSync('app/ofis/tabs/quotes/QuoteBuilder.tsx', 'utf8')

    expect(source).toContain('params.set("plateThicknessCm", String(plateThicknessCm))')
    expect(source).toMatch(/queryKey:[\s\S]{0,150}plateThicknessCm/)
  })

  it('admin API kalınlığı set kurucuya verir', () => {
    const source = readFileSync('app/api/admin/accessory-sets/route.ts', 'utf8')

    expect(source).toContain('plateThicknessCm: z.coerce.number()')
    expect(source.match(/plateThicknessCm,/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('müşteri hesaplayıcısı seçili kalınlığı ortak seçiciye verir', () => {
    const source = readFileSync('components/wizard/WizardCalculator.tsx', 'utf8')

    expect(source).toContain('selectAccessoryForSet({')
    expect(source).toContain('plateThicknessCm: Number(selectedKalinlik)')
  })
})
