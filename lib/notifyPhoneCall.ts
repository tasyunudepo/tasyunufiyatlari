// Telefon tıklama niyeti — sadece GA4 event ("Telefon_Aramalari").
// CallMeBot bildirim YOK (telefon tıklayan kullanıcı zaten arıyorsa
// telefon çalacak; tıklama ≠ arama, çift bildirim spam yaratır).

import {
  GA_EVENT_PHONE,
  type PhoneCallPayload,
} from './analytics/whatsappSource';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-VCHRKVJCEN';

export function notifyPhoneCall(payload: PhoneCallPayload): void {
  if (typeof window === 'undefined') return;

  const fullPayload: PhoneCallPayload = {
    ...payload,
    page: payload.page ?? window.location.pathname,
  };

  type GtagWindow = Window & {
    gtag?: (
      command: 'event',
      eventName: string,
      eventParams: Record<string, unknown>
    ) => void;
  };
  const w = window as GtagWindow;
  if (typeof w.gtag === 'function') {
    w.gtag('event', GA_EVENT_PHONE, {
      source: fullPayload.source,
      page_path: fullPayload.page,
      product_name: fullPayload.productName,
      result_session_id: fullPayload.resultSessionId ?? null,
      cta_location: fullPayload.ctaLocation ?? null,
      send_to: GA_MEASUREMENT_ID,
    });
  }
}
