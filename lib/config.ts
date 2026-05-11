// Sipariş ve teklif WhatsApp numarası (tüm wa.me linkleri buradan okur).
// Env override edilmezse BUSINESS_INFO sözlüğünden gelir — tek doğruluk kaynağı.
import { BUSINESS_INFO } from '@/lib/business/info';

export const WHATSAPP_ORDER =
  process.env.NEXT_PUBLIC_WHATSAPP_ORDER ?? BUSINESS_INFO.phone.whatsapp;
