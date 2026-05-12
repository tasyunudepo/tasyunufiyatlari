// ============================================================
// HowTo node üreticisi
//
// Sıralı, zaman gerektiren kullanıcı akışları için Schema.org HowTo.
// Sprint 1 / Madde 3 — home page HOW_STEPS bunu kullanır.
//
// Voice search ve Google Discover'da "X nasıl yapılır?" sorularına
// doğrudan cevap verebilmek için kritik schema türü.
// ============================================================

import { BUSINESS_INFO } from '@/lib/business/info';

export interface HowToStepInput {
  /** Adım başlığı (kısa, eylem-bazlı). */
  name: string;
  /** Adımın detay açıklaması. */
  text: string;
  /** Opsiyonel: bu adımın detay sayfasına link (anchor veya tam URL). */
  url?: string;
  /** Opsiyonel: adım için görsel URL. */
  image?: string;
}

export interface BuildHowToNodeOptions {
  /** HowTo başlığı (örn. "Mantolama Hesaplaması Nasıl Yapılır?"). */
  name: string;
  /** Genel açıklama. */
  description: string;
  /** Sıralı adımlar. */
  steps: HowToStepInput[];
  /** Opsiyonel: tamamlanma için ortalama süre (ISO 8601 duration, örn. 'PT2M'). */
  totalTime?: string;
  /** Schema @id — @graph içinde referans için. */
  id?: string;
  /** Tahmini maliyet (varsa). */
  estimatedCost?: { currency: string; value: string };
}

export function buildHowToNode(opts: BuildHowToNodeOptions) {
  return {
    '@type': 'HowTo' as const,
    '@id':   opts.id ?? `${BUSINESS_INFO.url}/#howto-${slugify(opts.name)}`,
    name:        opts.name,
    description: opts.description,
    step: opts.steps.map((s, i) => ({
      '@type': 'HowToStep' as const,
      position: i + 1,
      name:  s.name,
      text:  s.text,
      ...(s.url   ? { url:   s.url }   : {}),
      ...(s.image ? { image: s.image } : {}),
    })),
    ...(opts.totalTime     ? { totalTime: opts.totalTime } : {}),
    ...(opts.estimatedCost ? {
      estimatedCost: {
        '@type':         'MonetaryAmount' as const,
        currency:        opts.estimatedCost.currency,
        value:           opts.estimatedCost.value,
      },
    } : {}),
  };
}

function slugify(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
