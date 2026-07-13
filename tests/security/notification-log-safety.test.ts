import { afterEach, describe, expect, it, vi } from 'vitest'

import { sendNotification } from '@/lib/notifications'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('bildirim log güvenliği', () => {
  it('ağ hatasında URL, API anahtarı, telefon veya müşteri PII verisini loglamaz', async () => {
    process.env.CALLMEBOT_PHONE_1 = '905551112233'
    process.env.CALLMEBOT_APIKEY_1 = 'super-secret-callmebot-key'

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(
        new Error(
          'request failed: https://api.callmebot.com/whatsapp.php?phone=905551112233&apikey=super-secret-callmebot-key',
        ),
      ),
    )
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await sendNotification('package_whatsapp_order', {
      customerName: 'Gizli Müşteri',
      customerPhone: '05321234567',
    })

    const logged = errorSpy.mock.calls
      .flat()
      .map((value) => value instanceof Error ? `${value.message}\n${value.stack}` : String(value))
      .join('\n')
    expect(logged).toContain('CallMeBot')
    expect(logged).not.toContain('super-secret-callmebot-key')
    expect(logged).not.toContain('905551112233')
    expect(logged).not.toContain('05321234567')
    expect(logged).not.toContain('Gizli Müşteri')
  })
})
