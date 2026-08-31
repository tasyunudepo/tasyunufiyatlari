import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { useWizardStore as WizardStoreHook } from '@/lib/store/wizardStore'

let useWizardStore: typeof WizardStoreHook

beforeAll(async () => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size
    },
  })
  ;({ useWizardStore } = await import('@/lib/store/wizardStore'))
})

beforeEach(() => {
  useWizardStore.getState().reset()
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('karşılaştırma → wizard preset köprüsü', () => {
  it('ticari bağlamı bir kez döndürür ve sonra temizler', () => {
    useWizardStore.getState().setProductPreset({
      material: 'tasyunu',
      thicknessCm: 8,
      brandName: 'Bonus',
      modelShortName: 'F 150',
      cityCode: 6,
      citySubRegion: null,
      entrySurface: 'comparison',
      comparisonSessionId: 'cmp_test_1',
    })

    expect(useWizardStore.getState().consumeSituationPreset()).toEqual({
      key: 'urun_sayfasi',
      material: 'tasyunu',
      thicknessCm: 8,
      brandName: 'Bonus',
      modelShortName: 'F 150',
      cityCode: 6,
      citySubRegion: null,
      entrySurface: 'comparison',
      comparisonSessionId: 'cmp_test_1',
    })
    expect(useWizardStore.getState().consumeSituationPreset()).toBeNull()
  })
})
