import { z } from 'zod'

import { formatBrandProductName } from '@/lib/brandFormat'
import { resolvePackageSpec } from '@/lib/catalog/packageSpec'
import {
  APPLICATION_SCOPE_LABELS,
  densitySourceLabel,
  getProfileByModel,
} from '@/lib/technical-profiles'

// ============================================================
// Levha kimliği — teklif belgesindeki levha satırı için tek kural
//
// Emrah, 27 Ekim 2026: "Ürünün tam adı yazsın, türü yazsın… birinde var,
// öbüründe yok. Bu işler artık bir standarda bağlansın." Astra ile uzlaşılan
// standart: docs/standartlar/teklif-pdf-standardi.md (bölüm A).
//
// Levha satırı üç bilgi grubuyla yazılır:
//   Ad       Bonus Gold Plus 50 · 12 cm
//   Tür      Taşyünü levha · Giydirme cephe
//   Özellik  Yoğunluk 50 kg/m³ (föy beyanı) · Levha 60 × 120 cm · Pakette 3 levha = 2,16 m²
//
// Kimlik teklif KAYDEDİLİRKEN çıkarılır ve kalemle saklanır; belge yalnız
// saklanan kimliği biçimlendirir. Böylece katalog o an yüklü olmasa da,
// teklif revize ya da çoğaltılsa da belge aynı bilgiyi basar. Bilinmeyen
// değer uydurulmaz: o parça düşer, tür grubu her zaman kalır.
// ============================================================

export const plateIdentitySchema = z.object({
  /** Marka + model, kalınlık hariç: "Bonus Gold Plus 50". */
  name: z.string().trim().min(1).max(160),
  thicknessCm: z.number().min(0).max(100).nullable(),
  /** "Taşyünü levha · Giydirme cephe". */
  kind: z.string().trim().min(1).max(120),
  /** "Yoğunluk 50 kg/m³ (föy beyanı)"; föyde beyan yoksa null. */
  density: z.string().trim().max(120).nullable(),
  /** "60 × 120 cm"; bilinmiyorsa null. */
  boardSize: z.string().trim().max(40).nullable(),
  pieceLabel: z.enum(['levha', 'rulo']),
  piecesPerPackage: z.number().int().min(0).max(10_000).nullable(),
  packageM2: z.number().min(0).max(10_000).nullable(),
})

export type PlateIdentity = z.infer<typeof plateIdentitySchema>

export interface PlateIdentityInput {
  brandName: string | null | undefined
  /** plates.short_name; teknik profil bu adla eşleşir. */
  modelShortName: string | null | undefined
  /** Ad için kullanılacak hazır marka + model metni; yoksa marka ve modelden kurulur. */
  displayName?: string | null
  materialSlug: string | null | undefined
  thicknessCm: number | null | undefined
  packageM2: number | null | undefined
  /** Üretici listesindeki paket içi adet (Bonus). */
  packagePieces?: number | null
}

const MATERIAL_LABELS: Record<string, string> = { tasyunu: 'Taşyünü', eps: 'EPS' }

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLocaleLowerCase('tr-TR') + text.slice(1) : text
}

export function resolvePlateIdentity(input: PlateIdentityInput): PlateIdentity | null {
  // Ad, sitenin tek ad kuralıyla kurulur: marka tekrarlanmaz, Fawori alt
  // markalarına ana marka eklenir ("Fawori Optimix TR7.5").
  const name = (input.displayName?.trim() || formatBrandProductName(input.brandName, input.modelShortName)).trim()
  if (!name) return null

  const profile = input.modelShortName ? getProfileByModel(input.modelShortName.trim()) : null
  const spec = resolvePackageSpec({
    brandName: input.brandName,
    materialSlug: input.materialSlug,
    modelShortName: input.modelShortName,
    packageM2: input.packageM2,
    packagePieces: input.packagePieces,
  })
  const pieceLabel = spec?.pieceLabel ?? 'levha'

  const material = MATERIAL_LABELS[input.materialSlug ?? ''] ?? null
  const base = material ? `${material} ${pieceLabel === 'rulo' ? 'şilte' : 'levha'}` : 'Levha'
  const scope = profile ? APPLICATION_SCOPE_LABELS[profile.applicationScope] : null

  const density = profile?.density
    ? `Yoğunluk ${profile.density.display.replace(/[()]/g, '')} (${lowerFirst(densitySourceLabel(profile))})`
    : null

  const packageM2 = Number(input.packageM2)
  const thickness = Number(input.thicknessCm)

  return {
    name,
    thicknessCm: Number.isFinite(thickness) && thickness > 0 ? thickness : null,
    kind: [base, scope].filter(Boolean).join(' · '),
    density,
    boardSize: spec?.sizeLabel ?? null,
    pieceLabel,
    piecesPerPackage: spec?.piecesPerPackage ?? null,
    packageM2: Number.isFinite(packageM2) && packageM2 > 0 ? packageM2 : null,
  }
}

const m2Format = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const cmFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 })

export interface PlateLineText {
  /** Ad grubu: "Bonus Gold Plus 50 · 12 cm". */
  title: string
  /** Tür grubu: "Taşyünü levha · Giydirme cephe". */
  kind: string
  /** Tablo satırının başlığı, tür adın içinde: "Bonus Gold Plus 50 taşyünü levha · 12 cm". */
  rowTitle: string
  /** Özellik grubu; bilinen parça yoksa null. */
  specs: string | null
}

/**
 * Malzeme ve levha türü ("EPS levha", "taşyünü levha"), ad zaten
 * söylüyorsa null. Baştaki kelime kısaltma değilse küçük harfle başlar.
 */
export function plateTypeWords(kind: string, name: string): string | null {
  const base = kind.split(' · ')[0]?.trim() ?? ''
  if (!base || base === 'Levha') return null
  const lowerName = name.toLocaleLowerCase('tr-TR')
  const words = base.toLocaleLowerCase('tr-TR').split(' ')
  if (words.some((word) => lowerName.includes(word))) return null
  const [first, ...rest] = base.split(' ')
  return [first === first.toLocaleUpperCase('tr-TR') ? first : lowerFirst(first), ...rest].join(' ')
}

/**
 * Levha satırı (Emrah, 28 Ekim 2026: "30 m² mala üç satır bilgi çok
 * gereksiz"): tür başlığa girer, altında tek özellik satırı kalır. Uygulama
 * alanı, yoğunluğun tolerans ve kaynak etiketi ile paket karşılığı tabloya
 * basılmaz; paket sayısı miktar sütunundadır.
 */
export function formatPlateLine(identity: PlateIdentity): PlateLineText {
  const thickness = identity.thicknessCm ? ` · ${cmFormat.format(identity.thicknessCm)} cm` : ''
  const title = `${identity.name}${thickness}`
  const typeWords = plateTypeWords(identity.kind, identity.name)
  const rowTitle = `${identity.name}${typeWords ? ` ${typeWords}` : ''}${thickness}`

  const pieceWord = identity.pieceLabel === 'rulo' ? 'Rulo' : 'Levha'
  const packageText = identity.packageM2
    ? identity.piecesPerPackage
      ? `Pakette ${identity.piecesPerPackage} ${identity.pieceLabel} = ${m2Format.format(identity.packageM2)} m²`
      : `Paket ${m2Format.format(identity.packageM2)} m²`
    : null
  // "Yoğunluk 150 kg/m³ ±%10 (föy beyanı)" → "Yoğunluk 150 kg/m³".
  const density = identity.density
    ?.replace(/\s*\([^)]*\)\s*$/u, '')
    .replace(/\s*±\s*%?\s*[\d.,]+\s*%?/u, '')
    .trim() || null

  const parts = [
    density,
    identity.boardSize ? `${pieceWord} ${identity.boardSize}` : null,
    packageText,
  ].filter(Boolean)

  return { title, kind: identity.kind, rowTitle, specs: parts.length ? parts.join(' · ') : null }
}
