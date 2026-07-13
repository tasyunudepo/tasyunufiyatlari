// Wizard akış GA4 event'leri.
// 3 adımlı funnel:
//   1. Fiyat_Gosterildi      → kullanıcı fiyat ekranına ulaştı
//   2. Pdf_Teklif_Talebi     → PDF teklif formu submit (server-side quote insert da olur)
//   3. Whatsapp_Siparis      → WhatsApp sipariş akışı tamamlandı (server-side quote insert da olur)
//
// Conversion = (Pdf_Teklif_Talebi + Whatsapp_Siparis) / Fiyat_Gosterildi
// Abandoned  = Fiyat_Gosterildi olup 2 ve 3'ü tetiklemeyenler
//
// CallMeBot bildirimi GA4'ten BAĞIMSIZ çalışır — server-side quote insert
// sonrası /api/quotes route'unda sendNotification() çağrılır. Buradaki
// gtag çağrıları sadece GA4 client-side event'lerini yollar; CallMeBot
// üzerinde çift bildirim üretmez.

const GA_EVENT_SHOW_PRICES = 'Fiyat_Gosterildi';
const GA_EVENT_PDF_QUOTE   = 'Pdf_Teklif_Talebi';
const GA_EVENT_WHATSAPP    = 'Whatsapp_Siparis';
const GA_EVENT_RESULT_CTA_CLICK = 'Wizard_Result_CTA_Click';
const GA_EVENT_RESULT_FORM_OPEN = 'Wizard_Result_Form_Open';
const GA_EVENT_RESULT_FORM_ERROR = 'Wizard_Result_Form_Error';
const GA_EVENT_PDP_PRICE_VIEW = 'PDP_Price_View';
const GA_EVENT_PDP_CTA_CLICK = 'PDP_CTA_Click';
const GA_EVENT_PDP_FORM_OPEN = 'PDP_Form_Open';
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-VCHRKVJCEN';

export type WizardResultCtaType = 'pdf' | 'whatsapp' | 'phone';
export type WizardResultFormType = 'pdf' | 'whatsapp';
export type WizardResultCtaLocation = 'result_summary' | 'result_card' | 'sticky_mobile';
export type ProductDetailCtaType = 'pdf' | 'whatsapp' | 'phone';
export type ProductDetailCtaLocation = 'product_detail_summary' | 'product_detail_card' | 'sticky_mobile';

// ─── Ortak event params (3 event aynı taksonomiye sahip) ─────────────
export interface WizardBasePayload {
  material_type: 'tasyunu' | 'eps' | string;
  brand_name: string;
  model_name?: string | null;
  thickness_cm: number;
  city_code: number;
  city_name: string;
  area_m2: number;
  total_m2?: number;
  package_count?: number;
  result_session_id?: string;
}

// 1) Fiyat_Gosterildi
export interface WizardShowPricesPayload extends WizardBasePayload {
  results_count?: number;
  cheapest_total?: number | null;
  cheapest_per_m2?: number | null;
  special_order_required?: boolean;
  recommended_package_name?: string | null;
}

// 2) Pdf_Teklif_Talebi
export interface PdfQuoteRequestedPayload extends WizardBasePayload {
  /** "Orijinal Sistem" / "Dengeli Sistem" / "Ekonomik Sistem" */
  selected_package_name: string;
  /** Müşterinin seçtiği paketin toplam fiyatı (KDV dahil ₺) */
  selected_package_total: number;
  /** ₺/m² */
  selected_per_m2: number;
  /** Customer kanal (kullanıcının formdaki firma adı varsa "company" yoksa "individual") */
  customer_type?: 'company' | 'individual';
  /** Kaynak kanal: wizard veya katalog/PDP */
  source_channel?: 'wizard' | 'catalog';
}

// 3) Whatsapp_Siparis (form submit + WA pencere açıldı)
export interface WhatsappOrderRequestedPayload extends WizardBasePayload {
  selected_package_name: string;
  selected_package_total: number;
  selected_per_m2: number;
  source_channel?: 'wizard' | 'catalog';
}

export interface WizardResultCtaPayload {
  cta_type: WizardResultCtaType;
  cta_location: WizardResultCtaLocation;
  package_name: string;
  package_tier: string;
  result_session_id?: string;
}

export interface WizardResultFormOpenPayload {
  form_type: WizardResultFormType;
  cta_location: WizardResultCtaLocation;
  package_name: string;
  package_tier: string;
  result_session_id?: string;
}

export interface WizardResultFormErrorPayload {
  form_type: WizardResultFormType;
  field_name?: string;
  error_type: string;
  package_name?: string;
  package_tier?: string;
  result_session_id?: string;
}

export interface ProductDetailBasePayload {
  product_name: string;
  brand_name: string;
  category_name?: string | null;
  material_type?: 'tasyunu' | 'eps' | string;
  thickness_cm?: number | null;
  city_code?: number | null;
  city_name?: string | null;
  area_m2?: number | null;
  total_m2?: number | null;
  package_count?: number | null;
  price_per_m2?: number | null;
  total_price?: number | null;
  vehicle_type?: 'lorry' | 'truck' | 'depot' | 'mixed' | null;
  product_slug?: string | null;
  result_session_id?: string;
}

export interface ProductDetailPriceViewPayload extends ProductDetailBasePayload {
  source_channel?: 'catalog';
}

export interface ProductDetailCtaPayload extends ProductDetailBasePayload {
  cta_type: ProductDetailCtaType;
  cta_location: ProductDetailCtaLocation;
}

export interface ProductDetailFormOpenPayload extends ProductDetailBasePayload {
  form_type: 'pdf';
  cta_location: ProductDetailCtaLocation;
}

type GtagWindow = Window & {
  gtag?: (
    command: 'event',
    eventName: string,
    eventParams: Record<string, unknown>
  ) => void;
};

function getEmptyParamNames(params: Record<string, unknown>): string[] {
  return Object.entries(params)
    .filter(([, value]) => (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    ))
    .map(([name]) => name);
}

function debugGaEvent(stage: string, eventName: string, params: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'development') return;

  const emptyFields = getEmptyParamNames(params);
  console.groupCollapsed(`[GA4 debug] ${eventName} - ${stage}`);
  console.log('event_name', eventName);
  console.log('param_names', Object.keys(params));
  console.log('empty_fields', emptyFields);
  console.log('payload', params);
  console.groupEnd();
}

function emit(eventName: string, params: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const w = window as GtagWindow;

  const finalPayload = {
    ...params,
    page_path: window.location.pathname,
    send_to: GA_MEASUREMENT_ID,
  };

  debugGaEvent('emit final payload', eventName, finalPayload);

  if (process.env.NODE_ENV === 'development' && typeof w.gtag !== 'function') {
    console.warn(`[GA4 debug] gtag yüklenmemiş - event="${eventName}" gönderilemedi.`);
  }

  if (typeof w.gtag !== 'function') return;
  w.gtag('event', eventName, finalPayload);
}

// ─── 1. Fiyatları Göster ──────────────────────────────────────────────
export function notifyWizardShowPrices(p: WizardShowPricesPayload): void {
  debugGaEvent(
    'notifyWizardShowPrices received payload',
    GA_EVENT_SHOW_PRICES,
    p as unknown as Record<string, unknown>
  );

  const payload = {
    material_type:           p.material_type,
    brand_name:              p.brand_name,
    model_name:              p.model_name ?? null,
    thickness_cm:            p.thickness_cm,
    city_code:               p.city_code,
    city_name:               p.city_name,
    area_m2:                 p.area_m2,
    total_m2:                p.total_m2 ?? null,
    package_count:           p.package_count ?? null,
    result_session_id:       p.result_session_id ?? null,
    results_count:           p.results_count ?? null,
    cheapest_total:          p.cheapest_total ?? null,
    cheapest_per_m2:         p.cheapest_per_m2 ?? null,
    special_order_required:  p.special_order_required ?? false,
    recommended_package_name: p.recommended_package_name ?? null,
  };

  emit(GA_EVENT_SHOW_PRICES, payload);
}

// ─── 2. PDF Teklif Talebi ────────────────────────────────────────────
export function notifyPdfQuoteRequested(p: PdfQuoteRequestedPayload): void {
  emit(GA_EVENT_PDF_QUOTE, {
    material_type:           p.material_type,
    brand_name:              p.brand_name,
    model_name:              p.model_name ?? null,
    thickness_cm:            p.thickness_cm,
    city_code:               p.city_code,
    city_name:               p.city_name,
    area_m2:                 p.area_m2,
    total_m2:                p.total_m2 ?? null,
    package_count:           p.package_count ?? null,
    result_session_id:       p.result_session_id ?? null,
    selected_package_name:   p.selected_package_name,
    selected_package_total:  p.selected_package_total,
    selected_per_m2:         p.selected_per_m2,
    customer_type:           p.customer_type ?? 'individual',
    source_channel:          p.source_channel ?? 'wizard',
  });
}

// ─── 3. WhatsApp Sipariş Talebi ──────────────────────────────────────
export function notifyWhatsappOrderRequested(p: WhatsappOrderRequestedPayload): void {
  emit(GA_EVENT_WHATSAPP, {
    material_type:           p.material_type,
    brand_name:              p.brand_name,
    model_name:              p.model_name ?? null,
    thickness_cm:            p.thickness_cm,
    city_code:               p.city_code,
    city_name:               p.city_name,
    area_m2:                 p.area_m2,
    total_m2:                p.total_m2 ?? null,
    package_count:           p.package_count ?? null,
    result_session_id:       p.result_session_id ?? null,
    selected_package_name:   p.selected_package_name,
    selected_package_total:  p.selected_package_total,
    selected_per_m2:         p.selected_per_m2,
    source_channel:          p.source_channel ?? 'wizard',
  });
}

// ─── Sonuç Ekranı CTA Etkileşimleri ──────────────────────────────────
export function notifyWizardResultCtaClick(p: WizardResultCtaPayload): void {
  emit(GA_EVENT_RESULT_CTA_CLICK, {
    cta_type:          p.cta_type,
    cta_location:      p.cta_location,
    package_name:      p.package_name,
    package_tier:      p.package_tier,
    result_session_id: p.result_session_id ?? null,
  });
}

export function notifyWizardResultFormOpen(p: WizardResultFormOpenPayload): void {
  emit(GA_EVENT_RESULT_FORM_OPEN, {
    form_type:         p.form_type,
    cta_location:      p.cta_location,
    package_name:      p.package_name,
    package_tier:      p.package_tier,
    result_session_id: p.result_session_id ?? null,
  });
}

export function notifyWizardResultFormError(p: WizardResultFormErrorPayload): void {
  emit(GA_EVENT_RESULT_FORM_ERROR, {
    form_type:         p.form_type,
    field_name:        p.field_name ?? null,
    error_type:        p.error_type,
    package_name:      p.package_name ?? null,
    package_tier:      p.package_tier ?? null,
    result_session_id: p.result_session_id ?? null,
  });
}

// ─── Ürün Detay Sayfası Etkileşimleri ───────────────────────────────
function buildProductDetailPayload(p: ProductDetailBasePayload): Record<string, unknown> {
  return {
    product_name:      p.product_name,
    brand_name:        p.brand_name,
    category_name:     p.category_name ?? null,
    material_type:     p.material_type ?? null,
    thickness_cm:      p.thickness_cm ?? null,
    city_code:         p.city_code ?? null,
    city_name:         p.city_name ?? null,
    area_m2:           p.area_m2 ?? null,
    total_m2:          p.total_m2 ?? null,
    package_count:     p.package_count ?? null,
    price_per_m2:      p.price_per_m2 ?? null,
    total_price:       p.total_price ?? null,
    vehicle_type:      p.vehicle_type ?? null,
    product_slug:      p.product_slug ?? null,
    result_session_id: p.result_session_id ?? null,
  };
}

export function notifyProductDetailPriceView(p: ProductDetailPriceViewPayload): void {
  emit(GA_EVENT_PDP_PRICE_VIEW, {
    ...buildProductDetailPayload(p),
    source_channel: p.source_channel ?? 'catalog',
  });
}

export function notifyProductDetailCtaClick(p: ProductDetailCtaPayload): void {
  emit(GA_EVENT_PDP_CTA_CLICK, {
    ...buildProductDetailPayload(p),
    cta_type:     p.cta_type,
    cta_location: p.cta_location,
  });
}

export function notifyProductDetailFormOpen(p: ProductDetailFormOpenPayload): void {
  emit(GA_EVENT_PDP_FORM_OPEN, {
    ...buildProductDetailPayload(p),
    form_type:    p.form_type,
    cta_location: p.cta_location,
  });
}

// ─── 4. Situation Selected (Sprint 2 — Karar Yardımı) ────────────────
const GA_EVENT_SITUATION_SELECTED = 'Situation_Selected';

export type SituationKey =
  | 'isi_yalitimi'
  | 'ses_yalitimi'
  | 'cati_yalitimi'
  | 'emin_degilim';

export interface SituationSelectedPayload {
  situationKey: SituationKey;
  situationLabel: string;
}

export function notifySituationSelected(p: SituationSelectedPayload): void {
  emit(GA_EVENT_SITUATION_SELECTED, {
    situation_key:   p.situationKey,
    situation_label: p.situationLabel,
  });
}
