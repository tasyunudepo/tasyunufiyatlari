// Kullanıcı niyet event'leri için kaynak (source) taksonomisi.
// Hem CallMeBot bildirimi hem GA4 event'leri aynı string ile akar.

// ─── WhatsApp tıklama kaynakları ─────────────────────────────────
export type WhatsappSource =
  | 'header_desktop'        // SiteHeader masaüstü görünür WhatsApp butonu
  | 'header_mobile'         // SiteHeader mobile drawer içindeki WA butonu
  | 'header_mobile_topbar'  // SiteHeader mobile üst bar (drawer dışı) ikon
  | 'wizard_help_step1'     // Wizard Step 1 erken yardım linki
  | 'wizard_result_summary' // Wizard sonuç üst karar paneli WhatsApp CTA
  | 'wizard_result_card'    // Wizard sonuç paket kartı WhatsApp CTA
  | 'footer_link'           // SiteFooter "WhatsApp Destek" link
  | 'iletisim_card'         // /iletisim sayfası WhatsApp kartı
  | 'depomuz_cta'           // /depomuz "WhatsApp ile yazışın"
  | 'product_detail_cta'    // ürün detay sayfası WhatsApp CTA
  | 'product_detail_summary' // ürün detay karar özeti WhatsApp CTA
  | 'product_detail_card'   // ürün detay kart içi WhatsApp CTA
  | 'site_general';         // fallback / belirsiz

// ─── Telefon tıklama kaynakları ──────────────────────────────────
export type PhoneSource =
  | 'header_desktop'        // SiteHeader masaüstü görünür Hemen Ara
  | 'header_mobile'         // SiteHeader mobile drawer "Ara" butonu
  | 'header_mobile_topbar'  // SiteHeader mobile üst bar (drawer dışı) ikon
  | 'topbar_phone'          // hub TrustStrip telefon link
  | 'wizard_result_phone'   // Wizard sonuç ekranı telefon CTA
  | 'product_detail_phone'  // ürün detay sayfası telefon CTA
  | 'iletisim_phone'        // /iletisim telefon kartı / "Hemen Ara"
  | 'depomuz_phone'         // /depomuz telefon link
  | 'kvkk_phone'            // /kvkk başvuru kartı telefon
  | 'site_general';

export interface WhatsappIntentPayload {
  source: WhatsappSource;
  productName?: string;
  /** Otomatik doldurulur (window.location.pathname) */
  page?: string;
  /** PDP session zinciri için — aynı oturumdaki event'leri bağlar */
  resultSessionId?: string;
  /** Masaüstü / sticky mobil ayrımı için */
  ctaLocation?: string;
  /** Fiyat çözüldükten sonraki anonim ticari bağlam; kişisel veri içermez. */
  pricedContext?: PricedWhatsappContext;
  /** Deney varyantı; A/B sonuçlarını aynı event zincirinde ayırır. */
  experienceVariant?: 'a_whatsapp_first';
}

export interface PricedWhatsappContext {
  refCode: string;
  modelName: string;
  thicknessCm: number;
  cityCode: number;
  cityName: string;
  subRegionName?: string;
  areaM2: number;
  packageCount: number;
  vehicleType: 'lorry' | 'truck' | 'mixed';
  vehicleLabel: string;
  pricePerM2: number;
  totalExVat: number;
  shippingMode: 'included_in_sale_price' | 'buyer_responsible' | 'separate_quote_required';
}

export interface PhoneCallPayload {
  source: PhoneSource;
  productName?: string;
  /** Otomatik doldurulur */
  page?: string;
  /** PDP session zinciri için — aynı oturumdaki event'leri bağlar */
  resultSessionId?: string;
  /** Masaüstü / sticky mobil ayrımı için */
  ctaLocation?: string;
}

// ─── İnsan-okur etiketler (CallMeBot mesajında ve GA4 dashboard'da) ─
export const WHATSAPP_SOURCE_LABEL: Record<WhatsappSource, string> = {
  header_desktop:        'Masaüstü header',
  header_mobile:         'Mobil menü',
  header_mobile_topbar:  'Mobil header ikon',
  wizard_help_step1:     'Hesaplayıcı yardım (Step 1)',
  wizard_result_summary: 'Wizard sonuç karar paneli',
  wizard_result_card:    'Wizard sonuç paket kartı',
  footer_link:           'Footer linki',
  iletisim_card:         'İletişim sayfası kartı',
  depomuz_cta:           'Depomuz sayfası',
  product_detail_cta:    'Ürün detay sayfası',
  product_detail_summary:'Ürün detay karar özeti',
  product_detail_card:   'Ürün detay kart içi',
  site_general:          'Site geneli',
};

export const PHONE_SOURCE_LABEL: Record<PhoneSource, string> = {
  header_desktop:        'Masaüstü header',
  header_mobile:         'Mobil menü',
  header_mobile_topbar:  'Mobil header ikon',
  topbar_phone:          'Üst şerit',
  wizard_result_phone:   'Wizard sonuç telefon',
  product_detail_phone:  'Ürün detay telefon',
  iletisim_phone:        'İletişim sayfası',
  depomuz_phone:         'Depomuz sayfası',
  kvkk_phone:            'KVKK sayfası',
  site_general:          'Site geneli',
};

// ─── GA4 Event isimleri (Türkçe, anlaşılır) ──────────────────────
export const GA_EVENT_WHATSAPP = 'Whatsapp_Yazanlar';
export const GA_EVENT_PHONE    = 'Telefon_Aramalari';
