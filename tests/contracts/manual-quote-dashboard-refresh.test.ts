import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('manuel teklif sonrası genel bakış yenilenir', () => {
  it('kayıt başarılı olunca teklif ve dashboard metrik önbellekleri geçersiz kılınır', () => {
    const source = readFileSync('app/ofis/tabs/quotes/QuoteBuilder.tsx', 'utf8')

    expect(source).toContain('ADMIN_DASHBOARD_METRICS_KEY')
    expect(source).toMatch(/invalidateQueries\(\{ queryKey: ADMIN_DASHBOARD_METRICS_KEY \}\)/)
  })
})
