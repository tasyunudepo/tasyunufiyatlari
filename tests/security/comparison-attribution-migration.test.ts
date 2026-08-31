import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const migrationPath = fileURLToPath(
  new URL('../../scripts/migration-v26-comparison-attribution.sql', import.meta.url),
)

describe('v26 karşılaştırma atfı göç sözleşmesi', () => {
  const migration = readFileSync(migrationPath, 'utf8')

  it('nested oturumu sorgulanabilir generated kolon ve kısmi indeks olarak ekler', () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS comparison_session_id\s+TEXT[\s\S]*GENERATED ALWAYS AS/u)
    expect(migration).toContain("package_items #>> '{attribution,comparison_session_id}'")
    expect(migration).toContain('idx_quotes_comparison_session_id')
  })

  it('mevcut atomik RPC sözleşmesini yeniden tanımlamadan korur', () => {
    expect(migration).not.toContain('CREATE OR REPLACE FUNCTION public.submit_quote_guarded')
    expect(migration).toContain('source_channel <> \'comparison\'')
  })

  it('CRM kaynağına comparison ekler ve trigger eşlemesini korur', () => {
    expect(migration).toMatch(/origin IN \([^)]*'comparison'/u)
    expect(migration).toMatch(/NEW\.source_channel IN \([^)]*'comparison'/u)
  })
})
