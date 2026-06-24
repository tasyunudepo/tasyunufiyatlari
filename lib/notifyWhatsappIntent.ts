// WhatsApp tıklama niyetini sunucuya bildir + GA4 event yolla.
// Tarayıcı sayfa değiştirse bile fetch tamamlansın diye `keepalive: true`.
// Hata sessiz: WA linkinin çalışmasını engellemez.

import {
  GA_EVENT_WHATSAPP,
  type WhatsappIntentPayload,
} from './analytics/whatsappSource';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-VCHRKVJCEN';

export function notifyWhatsappIntent(payload: WhatsappIntentPayload): void {
  if (typeof window === 'undefined') return;

  const fullPayload: WhatsappIntentPayload = {
    ...payload,
    page: payload.page ?? window.location.pathname,
  };

  // 1) Sunucuya bildirim (CallMeBot zinciri tetiklenir)
  try {
    fetch('/api/whatsapp-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPayload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* sessiz */
  }

  // 2) GA4 event — Türkçe isim "Whatsapp_Yazanlar"
  type GtagWindow = Window & {
    gtag?: (
      command: 'event',
      eventName: string,
      eventParams: Record<string, unknown>
    ) => void;
  };
  const w = window as GtagWindow;
  if (typeof w.gtag === 'function') {
    w.gtag('event', GA_EVENT_WHATSAPP, {
      source: fullPayload.source,
      page_path: fullPayload.page,
      product_name: fullPayload.productName,
      result_session_id: fullPayload.resultSessionId ?? null,
      cta_location: fullPayload.ctaLocation ?? null,
      send_to: GA_MEASUREMENT_ID,
    });
  }
}
