import { z } from 'zod'

// Müşteri kütüğü şeması (v24). Ofis yüzeyi içindir — public teklif akışının
// apiQuoteSchema'sından bağımsızdır ve onu import ETMEZ.
//
// KVKK: telefonla/ofisten gelen müşteride açık rıza yoktur. Sahte
// `kvkk_consent = true` yazılmaz; dayanak `sozlesme_hazirligi`dir (m.5/2-c).

export const CUSTOMER_TYPES = ['bireysel', 'kurumsal'] as const
export const CUSTOMER_ORIGINS = ['wizard', 'catalog', 'comparison', 'telefon', 'ofis', 'ithal'] as const
export const CUSTOMER_STATUSES = ['aktif', 'pasif', 'kara_liste'] as const
export const CONSENT_BASES = ['acik_riza', 'sozlesme_hazirligi', 'mesru_menfaat'] as const

export const INTERACTION_KINDS = [
  'arama_giden',
  'arama_gelen',
  'whatsapp',
  'eposta',
  'ziyaret',
  'not',
  'teklif_gonderildi',
  'kvkk_aydinlatma',
  'hatirlatma',
] as const

export const INTERACTION_OUTCOMES = [
  'ulasildi',
  'ulasilamadi',
  'mesaj_birakildi',
  'randevu',
  'ilgilenmiyor',
  'fiyat_verildi',
] as const

/** Ofis telefon girişi serbesttir; normalizasyonu sunucu yapar. */
const phoneInput = z
  .string()
  .trim()
  .min(7, 'Telefon numarası çok kısa')
  .max(24, 'Telefon numarası çok uzun')

export const customerCreateSchema = z.object({
  phone: phoneInput,
  displayName: z.string().trim().min(2, 'En az 2 karakter').max(120),
  companyName: z.string().trim().max(255).nullable().optional(),
  email: z.string().trim().email('Geçerli bir e-posta girin').nullable().optional().or(z.literal('')),
  cityCode: z.string().trim().max(10).nullable().optional(),
  cityName: z.string().trim().max(120).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  customerType: z.enum(CUSTOMER_TYPES).default('bireysel'),
  origin: z.enum(CUSTOMER_ORIGINS).default('telefon'),
  owner: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  consentBasis: z.enum(CONSENT_BASES).default('sozlesme_hazirligi'),
  consentChannel: z.string().trim().max(40).nullable().optional(),
})

export const customerUpdateSchema = customerCreateSchema
  .partial()
  .extend({ status: z.enum(CUSTOMER_STATUSES).optional() })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'En az bir alan güncellenmeli.',
  })

export const interactionCreateSchema = z.object({
  kind: z.enum(INTERACTION_KINDS),
  outcome: z.enum(INTERACTION_OUTCOMES).nullable().optional(),
  body: z.string().trim().max(4000).nullable().optional(),
  quoteId: z.number().int().positive().nullable().optional(),
  occurredAt: z.string().datetime().nullable().optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
  nextActionNote: z.string().trim().max(500).nullable().optional(),
})

export const customerListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  filter: z
    .enum(['hepsi', 'temassiz', 'vadesi_gelen', 'acik_teklif', 'kazanilan', 'kaybedilen'])
    .default('hepsi'),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
})

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>
export type InteractionCreateInput = z.infer<typeof interactionCreateSchema>
