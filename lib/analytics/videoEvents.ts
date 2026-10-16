// Taşyünü ölçüm köprüsü (video olayları). Yer: lib/analytics/videoEvents.ts
// Sitenin mevcut deseninin aynısı (lib/analytics/catalogJourney.ts → emit): gtag('event') + page_path + send_to.
// gtag yoksa (reklam engelleyici, yerel geliştirme) sessizce çıkar; video oynatmayı etkilemez.
// Bu olaylar BAĞLAM olayıdır: GA4'te key event / Ads dönüşümü olarak işaretlenmez.

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-VCHRKVJCEN'

type GtagWindow = Window & {
  gtag?: (command: 'event', eventName: string, eventParams: Record<string, unknown>) => void
}

export function trackVideo(eventName: string, params: Record<string, string>): void {
  if (typeof window === 'undefined') return
  const w = window as GtagWindow
  if (typeof w.gtag !== 'function') return
  w.gtag('event', eventName, {
    ...params,
    page_path: window.location.pathname,
    send_to: GA_MEASUREMENT_ID,
  })
}
