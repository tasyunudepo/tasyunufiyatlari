import { z } from 'zod'

const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Telefon numarası çok kısa')
  .max(20, 'Telefon numarası çok uzun')
  .regex(/^[\d+\s()-]+$/, 'Geçerli bir telefon numarası girin (örn: 0532 123 45 67 veya +7 900 123 45 67)')
  .refine((value) => {
    const digitCount = value.replace(/\D/g, '').length
    return digitCount >= 10 && digitCount <= 15
  }, 'Telefon numarası 10 ila 15 rakam içermelidir')

export const quoteSchema = z.object({
  customerName: z
    .string()
    .min(2, 'En az 2 karakter girin')
    .max(100, 'En fazla 100 karakter')
    .regex(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/, 'Sadece harf girişi yapın'),

  customerEmail: z
    .string()
    .email('Geçerli bir e-posta adresi girin')
    .toLowerCase()
    .trim()
    .optional()
    .or(z.literal('')),

  customerPhone: phoneSchema,

  customerCompany: z.string().max(255, 'En fazla 255 karakter').optional().or(z.literal('')),
  customerAddress: z.string().max(500, 'En fazla 500 karakter').optional().or(z.literal('')),

  kvkkConsent: z.boolean().refine(val => val === true, {
    message: 'Devam etmek için KVKK onayı gereklidir',
  }),
})

export type QuoteFormData = z.infer<typeof quoteSchema>

export const apiQuoteSchema = z.object({
  customerName: z.string().min(2).max(100),
  customerEmail: z
    .string()
    .email('Geçerli bir e-posta adresi girin')
    .toLowerCase()
    .trim()
    .optional()
    .or(z.literal('')),
  customerPhone: phoneSchema,
  customerCompany: z.string().max(255).optional().or(z.literal('')),
  customerAddress: z.string().max(500).optional().or(z.literal('')),
  submissionType: z.enum(['whatsapp_order', 'pdf_quote']),
  sourceChannel: z.enum(['wizard', 'catalog']).default('wizard'),

  materialType: z.enum(['tasyunu', 'eps'], {
    message: 'Geçerli bir levha tipi seçin',
  }),

  brandId: z.number().positive('Marka seçin'),
  brandName: z.string().min(1, 'Marka adı gerekli'),

  modelId: z.number().positive('Model seçin').optional().nullable(),
  modelName: z.string().optional().nullable(),

  thicknessCm: z.number().min(2, 'En az 2 cm').max(15, 'En fazla 15 cm'),
  areaM2: z.number().min(1, 'En az 1 m²').max(10000, 'En fazla 10.000 m²'),

  cityCode: z.string().min(1, 'Şehir seçin'),
  cityName: z.string().min(1, 'Şehir adı gerekli'),

  districtCode: z.string().optional().nullable(),
  districtName: z.string().optional().nullable(),

  packageName: z.string().min(1, 'Paket adı gerekli'),
  packageDescription: z.string().optional().nullable(),
  plateBrandName: z.string().min(1, 'Levha markası gerekli'),
  accessoryBrandName: z.string().min(1, 'Aksesuar markası gerekli'),

  totalPrice: z.number().positive('Geçerli fiyat girin'),
  pricePerM2: z.number().positive('Geçerli m² fiyatı girin'),
  shippingCost: z.number().min(0, 'Nakliye ücreti negatif olamaz').default(0),
  discountPercentage: z.number().min(0).max(100).default(0),
  priceWithoutVat: z.number().positive('KDV hariç fiyat gerekli'),
  vatAmount: z.number().min(0, 'KDV tutarı negatif olamaz'),

  packageCount: z.number().positive('Paket sayısı gerekli'),
  packageSizeM2: z.number().positive('Paket boyutu gerekli'),
  itemsPerPackage: z.number().positive('Paket başına ürün sayısı gerekli'),
  vehicleType: z.enum(['none', 'lorry', 'truck', 'multiple']).optional().nullable(),
  lorryCapacityPackages: z.number().optional().nullable(),
  truckCapacityPackages: z.number().optional().nullable(),
  // Large jobs can legitimately exceed 100% of a single vehicle capacity.
  // We still want to record the quote instead of rejecting the request.
  lorryFillPercentage: z.number().min(0).optional().nullable(),
  truckFillPercentage: z.number().min(0).optional().nullable(),

  packageItems: z.record(z.string(), z.any()),
  quoteCode: z.string().optional().nullable(),
  // KVKK rıza — frontend Zod (quoteSchema) zorunlu işaretliyor; API tarafı da
  // doğrulamalı ki bot/API client'lar consent'siz POST yapamasın.
  kvkkConsent: z.boolean().refine(val => val === true, {
    message: 'KVKK rızası alınmadan teklif kaydedilemez',
  }),
})

export type ApiQuoteData = z.infer<typeof apiQuoteSchema>

export const wizardStep1Schema = z.object({
  levhaTipi: z.enum(['tasyunu', 'eps'], {
    message: 'Levha tipi seçin',
  }),
  markaId: z.number().positive('Marka seçin'),
  modelId: z.number().positive().optional().nullable(),
  kalinlik: z.number().min(3, 'En az 3 cm').max(10, 'En fazla 10 cm'),
  metraj: z.number().min(1, 'En az 1 m²').max(10000, 'En fazla 10.000 m²'),
})

export const wizardStep2Schema = z.object({
  sehirKodu: z.number().positive('Şehir seçin'),
  ilceId: z.number().positive().optional().nullable(),
})

export type WizardStep1Data = z.infer<typeof wizardStep1Schema>
export type WizardStep2Data = z.infer<typeof wizardStep2Schema>
