// ============================================================
// Karar Motoru — getDecisionContext() + paylaşılan helper'lar
// Pure function: server ve client'ta çalışır.
// Tek otorite: liste kartı, detay paneli, admin preview hep buradan beslenir.
// ============================================================

import type {
  ProductRules,
  DecisionContext,
  CtaPrimary,
  CtaSecondary,
  WizardPrefill,
} from './types';

// ─── Fiyat görünürlüğü kararı (liste + detay tek kaynak) ────────────
export interface PriceDisplay {
  /** Fiyat etiketi gösterilsin mi? */
  visible: boolean;
  /** Listede / kart üstünde gösterilecek metin (örn. "850 ₺ / paket'ten") */
  label: string | null;
  /** Müşteriye gösterilen alt-not (örn. "fiyat şehre göre değişir") */
  note: string | null;
}

/**
 * Fiyat gösterim kararını tek yerden alır. ProductCard, ProductPricePanel
 * ve admin preview aynı çıktı üzerinden çalışır.
 */
export function getPriceDisplay(
  rules: ProductRules,
  basePrice: number | null,
  unitLabel = 'paket'
): PriceDisplay {
  const fmt = (n: number) =>
    `${n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ / ${unitLabel}`;

  switch (rules.pricing_visibility_mode) {
    case 'hidden':
      return { visible: false, label: null, note: 'Fiyat gizli, teklif ile öğrenin.' };

    case 'quote_required':
      return { visible: false, label: null, note: 'Bu ürünün fiyatı teklif ile belirlenmektedir.' };

    case 'from_price':
      return {
        visible: basePrice != null,
        label: basePrice != null ? `${fmt(basePrice)}'ten başlayan` : null,
        note: rules.requires_city_for_pricing
          ? 'Fiyat şehir ve miktara göre değişir.'
          : 'Fiyat miktara göre değişir.',
      };

    case 'exact_price':
    default:
      return {
        visible: basePrice != null,
        label: basePrice != null ? fmt(basePrice) : null,
        note: null,
      };
  }
}

// ─── Admin form validation (geçersiz kombinasyon engeli) ────────────
export interface ValidationIssue {
  field: 'sales_mode' | 'pricing_visibility_mode' | 'minimum_order_type';
  message: string;
}

/**
 * sales_mode × pricing_visibility_mode kombinasyon kuralları.
 * Mantıksız kombinasyonları yakalar (örn. "Sadece Teklif" + "Net fiyat" çelişki).
 */
export function validateRules(rules: Partial<ProductRules>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sm = rules.sales_mode;
  const pv = rules.pricing_visibility_mode;

  // Quote-only ile net fiyat çelişir
  if (sm === 'quote_only' && pv === 'exact_price') {
    issues.push({
      field: 'pricing_visibility_mode',
      message: '"Sadece Teklif" satış modunda "Net fiyat" gösterilemez. "Başlangıç fiyatı" veya "Teklif ile belirlenir" seçin.',
    });
  }

  // Direkt alım için fiyat görünür olmalı
  if (sm === 'single_only' && (pv === 'hidden' || pv === 'quote_required')) {
    issues.push({
      field: 'pricing_visibility_mode',
      message: '"Direkt Alım" modunda fiyat gösterilmek zorunda. "Net fiyat" veya "Başlangıç fiyatı" seçin.',
    });
  }

  // Sistem ürünü → fiyat zaten gizli olmalı
  if (sm === 'system_only' && pv !== 'hidden' && pv !== 'quote_required') {
    issues.push({
      field: 'pricing_visibility_mode',
      message: '"Sistem Ürünü" tek başına satılmıyor; fiyat "Gizli" veya "Teklif ile belirlenir" olmalı.',
    });
  }

  // Min. sipariş tipi seçildiyse değer girilmeli
  if (rules.minimum_order_type && rules.minimum_order_type !== 'none' &&
      (rules.minimum_order_value == null || rules.minimum_order_value <= 0)) {
    issues.push({
      field: 'minimum_order_type',
      message: 'Minimum sipariş tipi seçildiğinde değer 0\'dan büyük olmalı.',
    });
  }

  return issues;
}

// ─── Admin preview (modal altında "ne görünür?" özeti) ──────────────
export interface RulesPreview {
  /** Liste kartında ne görünür */
  cardSummary: string;
  /** Detay sayfasında CTA */
  detailCta: string;
  /** Detay sayfasında fiyat alanı */
  detailPrice: string;
  /** Min. sipariş notu */
  minOrderNote: string | null;
}

export function getRulesPreview(
  rules: ProductRules,
  basePrice: number | null = null
): RulesPreview {
  const decision = getDecisionContext(rules, null);
  const price = getPriceDisplay(rules, basePrice);

  // Liste kartı özeti
  let cardSummary: string;
  if (rules.sales_mode === 'system_only') {
    cardSummary = 'Sistem ürünü · Sayfada görünmez';
  } else if (price.visible && price.label) {
    cardSummary = `${price.label} · [${decision.cta_label_primary}]`;
  } else {
    cardSummary = `Fiyat: Teklif · [${decision.cta_label_primary}]`;
  }

  // Detay sayfası fiyat alanı
  let detailPrice: string;
  if (rules.pricing_visibility_mode === 'hidden') {
    detailPrice = 'Fiyat gizli — teklif gerekli';
  } else if (price.visible && price.label) {
    detailPrice = price.label;
  } else {
    detailPrice = 'Teklif ile belirlenir';
  }

  // Min. sipariş notu
  let minOrderNote: string | null = null;
  if (rules.minimum_order_type !== 'none' && rules.minimum_order_value) {
    const unitMap: Record<string, string> = {
      m2: 'm²', package: 'paket', pallet: 'palet', quantity: 'adet',
    };
    const unit = unitMap[rules.minimum_order_type] ?? rules.minimum_order_type;
    minOrderNote = `Minimum: ${rules.minimum_order_value} ${unit}`;
  }

  return {
    cardSummary,
    detailCta: decision.cta_label_primary,
    detailPrice,
    minOrderNote,
  };
}

export function getDecisionContext(
  rules: ProductRules,
  prefill?: WizardPrefill | null
): DecisionContext {
  // pricing_visibility_mode = quote_required → tüm diğer kuralları override et
  if (rules.pricing_visibility_mode === 'quote_required') {
    return {
      cta_primary: 'teklif',
      cta_secondary: null,
      cta_label_primary: 'Teklif Al',
      cta_label_secondary: null,
      info_note: buildInfoNote(rules),
      price_note: 'Bu ürünün fiyatı teklif ile belirlenmektedir.',
      force_quote: true,
      wizard_target_step: prefill?.markaId ? 2 : 1,
    };
  }

  // price_note — pricing_visibility_mode bazlı
  const price_note = buildPriceNote(rules.pricing_visibility_mode);

  // CTA kararı: sales_mode × requires_city_for_pricing
  let cta_primary: CtaPrimary;
  let cta_secondary: CtaSecondary = null;
  let cta_label_primary: string;
  let cta_label_secondary: string | null = null;
  let wizard_target_step: 1 | 2 = 1;

  switch (rules.sales_mode) {
    case 'single_only':
      if (!rules.requires_city_for_pricing) {
        cta_primary = 'siparis';
        cta_label_primary = 'Teklif teyidi iste';
        wizard_target_step = 2;
      } else {
        cta_primary = 'hesapla';
        cta_label_primary = 'Şehir Seç ve Sipariş Ver';
        wizard_target_step = 1;
      }
      break;

    case 'single_or_quote':
      if (!rules.requires_city_for_pricing) {
        cta_primary = 'siparis';
        cta_label_primary = 'Sipariş Talebi Oluştur';
        cta_secondary = 'detayli_teklif';
        cta_label_secondary = 'Detaylı Teklif Al';
        wizard_target_step = 2;
      } else {
        cta_primary = 'hesapla';
        cta_label_primary = 'Fiyat Hesapla';
        cta_secondary = 'detayli_teklif';
        cta_label_secondary = 'Teklif Al';
        wizard_target_step = 1;
      }
      break;

    case 'system_only':
      cta_primary = 'sistem_teklifi';
      cta_label_primary = 'Sistem Teklifi Oluştur';
      wizard_target_step = 1;
      break;

    case 'quote_only':
    default:
      cta_primary = 'teklif';
      cta_label_primary = 'Teklif Al';
      wizard_target_step = prefill?.markaId ? 2 : 1;
      break;
  }

  // hidden fiyat → CTA'yı override et (ama force_quote değil)
  if (rules.pricing_visibility_mode === 'hidden' && cta_primary === 'siparis') {
    cta_primary = 'fiyat_teklifi';
    cta_label_primary = 'Fiyat İçin Teklif Alın';
  }

  return {
    cta_primary,
    cta_secondary,
    cta_label_primary,
    cta_label_secondary,
    info_note: buildInfoNote(rules),
    price_note,
    force_quote: false,
    wizard_target_step,
  };
}

// ─── Yardımcı fonksiyonlar ───────────────────────────────────

function buildPriceNote(mode: ProductRules['pricing_visibility_mode']): string | null {
  switch (mode) {
    case 'hidden':
      return 'Bu ürünün fiyatı görüntülenmemektedir.';
    case 'from_price':
      return 'Gösterilen fiyat başlangıç fiyatıdır; kalınlık ve miktara göre değişir.';
    case 'quote_required':
      return 'Bu ürünün fiyatı teklif ile belirlenmektedir.';
    case 'exact_price':
    default:
      return null;
  }
}

function buildInfoNote(rules: ProductRules): string | null {
  const notes: string[] = [];

  if (rules.minimum_order_type !== 'none' && rules.minimum_order_value !== null) {
    const unitMap: Record<string, string> = {
      m2: 'm²', package: 'paket', pallet: 'palet', quantity: 'adet',
    };
    const unit = unitMap[rules.minimum_order_type] ?? rules.minimum_order_type;
    notes.push(`Bu ürün minimum ${rules.minimum_order_value} ${unit} için sunulur.`);
  }

  if (rules.requires_city_for_pricing) {
    notes.push('Fiyat şehre göre farklılık gösterir.');
  }

  if (rules.requires_system_context) {
    notes.push('Bu ürün genellikle sistem içinde kullanılır.');
  }

  return notes.length > 0 ? notes.join(' ') : null;
}
