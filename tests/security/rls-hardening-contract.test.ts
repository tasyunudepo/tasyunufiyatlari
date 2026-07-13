import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  fileURLToPath(
    new URL('../../scripts/migration-v14-rls-public-hardening.sql', import.meta.url),
  ),
  'utf8',
)

describe('public schema RLS hardening sözleşmesi', () => {
  it('bütün public tablolarında RLS açar ve anon DML yetkisini geri alır', () => {
    expect(migration).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon, authenticated',
    )
    expect(migration).toContain('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public')
  })

  it('yalnız açık katalog allowlistine public SELECT policy kurar', () => {
    for (const table of [
      'brands',
      'material_types',
      'shipping_zones',
      'logistics_capacity',
      'plates',
      'accessories',
      'plate_prices',
    ]) {
      expect(migration).toContain(`'${table}'`)
    }

    expect(migration).not.toContain(
      "__tmp_create_public_select_policy('quotes'",
    )
    expect(migration).not.toContain(
      "__tmp_create_public_select_policy('quote_funnel_events'",
    )
  })
})
