export type LeadEventType =
  | 'package_pdf_quote'
  | 'package_whatsapp_order'
  | 'single_product_pdf'
  | 'single_product_whatsapp'
  | 'catalog_whatsapp'
  | 'whatsapp_intent';

const CHANNEL_LABELS: Record<LeadEventType, string> = {
  package_pdf_quote:        'Mantolama Seti PDF Teklifi',
  package_whatsapp_order:   'Mantolama Seti WhatsApp Sipariş',
  single_product_pdf:       'Tekil Levha PDF Teklifi',
  single_product_whatsapp:  'Tekil Levha WhatsApp',
  catalog_whatsapp:         'Katalog WhatsApp',
  whatsapp_intent:          'WhatsApp Niyet (form yok)',
};

export interface NotificationData {
  refCode?: string;
  customerName?: string;
  customerPhone?: string;
  productName?: string;
  thicknessCm?: number;
  areaM2?: number;
  cityName?: string;
  totalPrice?: number;
  pdfUrl?: string;
  /** WhatsApp niyet bildirimleri için kaynak (header_mobile, footer_link, ...) */
  source?: string;
  /** WhatsApp niyet bildirimleri için sayfa yolu */
  page?: string;
}

function buildMessage(event: LeadEventType, data: NotificationData): string {
  const lines: string[] = [
    '🔔 Yeni Talep',
    '',
    `Kanal: ${CHANNEL_LABELS[event]}`,
  ];

  if (data.refCode)      lines.push(`Kod: ${data.refCode}`);
  if (data.customerName) lines.push(`Müşteri: ${data.customerName}`);
  if (data.customerPhone) lines.push(`Tel: ${data.customerPhone}`);
  if (data.productName || data.thicknessCm) {
    const product = [data.productName, data.thicknessCm ? `${data.thicknessCm}cm` : '']
      .filter(Boolean).join(' — ');
    lines.push(`Ürün: ${product}`);
  }
  if (data.areaM2 || data.cityName) {
    const loc = [
      data.areaM2 ? `${data.areaM2.toLocaleString('tr-TR')} m²` : '',
      data.cityName ?? '',
    ].filter(Boolean).join(' · ');
    lines.push(`Metraj/Konum: ${loc}`);
  }
  if (data.totalPrice) {
    lines.push(`Tutar: ${data.totalPrice.toLocaleString('tr-TR')} ₺`);
  }
  if (data.pdfUrl) {
    lines.push(`PDF: ${data.pdfUrl}`);
  }
  if (data.source) {
    lines.push(`Kaynak: ${data.source}`);
  }
  if (data.page) {
    lines.push(`Sayfa: ${data.page}`);
  }

  return lines.join('\n');
}

async function callCallMeBot(phone: string, apiKey: string, message: string): Promise<void> {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    await res.text();
    if (!res.ok) {
      console.warn(`[CallMeBot] HTTP ${res.status}`);
    }
  } catch {
    // Fetch hata nesnesi istek URL'sini içerebilir. URL; alıcı telefonu,
    // API anahtarı ve müşteri mesajını taşıdığı için hata ayrıntısını loglama.
    console.error('[CallMeBot] fetch error');
  }
}

/**
 * Env değerlerini sanitize et:
 * - Baştaki/sondaki boşluk
 * - "<value>" placeholder parantezleri (yaygın copy-paste hatası)
 * - Tırnak işaretleri ("value" / 'value')
 */
function cleanEnv(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let v = raw.trim();
  // <...> placeholder parantezleri
  if (v.startsWith('<') && v.endsWith('>')) v = v.slice(1, -1).trim();
  // Tırnaklar
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v || undefined;
}

export async function sendNotification(
  event: LeadEventType,
  data: NotificationData
): Promise<void> {
  const phone1  = cleanEnv(process.env.CALLMEBOT_PHONE_1);
  const apiKey1 = cleanEnv(process.env.CALLMEBOT_APIKEY_1);
  const phone2  = cleanEnv(process.env.CALLMEBOT_PHONE_2);
  const apiKey2 = cleanEnv(process.env.CALLMEBOT_APIKEY_2);

  if (!phone1 && !phone2) {
    console.warn('[sendNotification] No phone configured — env CALLMEBOT_PHONE_1/2 missing');
    return;
  }

  const message = buildMessage(event, data);

  const sends: Promise<void>[] = [];
  if (phone1 && apiKey1) sends.push(callCallMeBot(phone1, apiKey1, message));
  if (phone2 && apiKey2) sends.push(callCallMeBot(phone2, apiKey2, message));

  await Promise.all(sends);
}
