import { describe, expect, it } from 'vitest'

import { CUSTOMER_ORIGINS, customerCreateSchema } from '@/lib/schemas/customer.schema'

describe('müşteri kıyaslama kaynağı', () => {
  it('karşılaştırmayı birinci sınıf müşteri kaynağı olarak kabul eder', () => {
    expect(CUSTOMER_ORIGINS).toContain('comparison')
    expect(customerCreateSchema.safeParse({
      phone: '0532 123 45 67',
      displayName: 'Test Müşteri',
      origin: 'comparison',
    }).success).toBe(true)
  })
})
