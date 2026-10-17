import { describe, expect, it } from 'vitest'
import { notificationsEnabled } from '@/lib/notifications'

// 17 Ekim 2026: yerelde koşan otomatik testler gerçek CallmeBot numarasına mesaj atıyordu.
// Bildirim yalnız Vercel canlı yayınında gider; birim testi ortamı gönderimi taklitle sınar.
describe('bildirim yalnız canlı yayında', () => {
  it('yerel next start (NODE_ENV=production, VERCEL_ENV yok) göndermez', () => {
    expect(notificationsEnabled({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false)
  })
  it('Vercel önizlemesi göndermez', () => {
    expect(notificationsEnabled({ NODE_ENV: 'production', VERCEL_ENV: 'preview' } as NodeJS.ProcessEnv)).toBe(false)
  })
  it('Vercel canlı yayını gönderir; bilerek denemek için NOTIFY_IN_DEV=1', () => {
    expect(notificationsEnabled({ NODE_ENV: 'production', VERCEL_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true)
    expect(notificationsEnabled({ NODE_ENV: 'development', NOTIFY_IN_DEV: '1' } as NodeJS.ProcessEnv)).toBe(true)
  })
})
