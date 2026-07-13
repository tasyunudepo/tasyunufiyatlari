import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const route = readFileSync(`${repoRoot}app/api/quotes/route.ts`, 'utf8')
const migration = readFileSync(
  `${repoRoot}scripts/migration-v17-quote-submission-guard.sql`,
  'utf8',
)

describe('atomik teklif koruması sözleşmesi', () => {
  it('route process-içi sayaç yerine Postgres RPC kullanır', () => {
    expect(route).toContain("'submit_quote_guarded'")
    expect(route).toContain("result.outcome === 'created'")
    expect(route).toContain("result.outcome === 'rate_limited'")
    expect(route).toContain("'Retry-After'")
    expect(route).not.toMatch(/new Map\(|new LRU/)
  })

  it("istemci kimliklerini ham değil HMAC özetiyle RPC'ye taşır", () => {
    expect(route).toContain("hashGuardValue('ip', clientIp)")
    expect(route).toContain("hashGuardValue('phone', normalizedPhone)")
    expect(route).toContain("hashGuardValue('idempotency', idempotencyKey)")
    expect(migration).not.toMatch(/\bclient_ip\s+(TEXT|INET)/i)
  })

  it("migration RPC yetkisini yalnız service_role'e verir", () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.submit_quote_guarded')
    expect(migration).toContain('FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('TO service_role')
  })

  it('rıza sürüm, amaç ve kanalını DB kaydında zorunlu tutar', () => {
    for (const field of [
      'consent_version',
      'consent_purpose',
      'consent_channel',
    ]) {
      expect(route).toContain(`${field}:`)
      expect(migration).toContain(`'${field}'`)
    }
  })
})
