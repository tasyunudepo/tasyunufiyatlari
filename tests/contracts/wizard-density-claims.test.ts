import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// Karar kaynağı: bonus-karsilastirma-fikir-turlari.md (Tur 3) + PRD FR-006.
// Yoğunluk değeri müşteri yüzeyine yalnız teknik profil verisinden, kaynak
// etiketiyle ("Föy beyanı" / "Üretici sözlü beyanı — değişken") çıkabilir.
// Wizard bileşenlerine gömülü sabit "NNN kg/m³" metni bu sözleşmeyi ihlal eder:
// SW035, Expert Premium ve Fawori TR7.5 föylerinde yoğunluk beyanı yoktur;
// sabit "120 kg/m³" metinleri doğrulanmamış kesin değer gösteriyordu.

const ROOT = process.cwd()
const WIZARD_DIR = resolve(ROOT, 'components/wizard')

const wizardSources = readdirSync(WIZARD_DIR)
  .filter((file) => file.endsWith('.tsx') || file.endsWith('.ts'))
  .map((file) => ({
    file: `components/wizard/${file}`,
    content: readFileSync(resolve(WIZARD_DIR, file), 'utf8'),
  }))

describe('wizard yoğunluk beyanı sözleşmesi', () => {
  it('wizard bileşenlerinde sabit "kg/m³" yoğunluk metni yoktur', () => {
    const offenders = wizardSources
      .filter(({ content }) => /\d+\s*kg\/m(?:³|3|\^3)/iu.test(content))
      .map(({ file }) => file)

    expect(offenders).toEqual([])
  })

  it('föyünde yoğunluk beyanı olmayan modeller için "120 kg/m³" iddiası yoktur', () => {
    const joined = wizardSources.map(({ content }) => content).join('\n')

    // TR7.5 adındaki 7.5, TS EN 1607 dik çekme sınıfıdır (kPa); yoğunluk değildir.
    expect(joined).not.toMatch(/'(?:SW035|Premium|TR7\.5)'[^\n]*120\s*kg/iu)
  })
})
