// ============================================================
// Paket ve levha bilgisi — teklif belgesi, ofis ve ürün sayfası için tek kural
//
// Emrah, 26 Ekim 2026: "Paket miktar ve ölçüleri PDF'te, teklifte
// belirtilsin." Müşteri kaç paket, pakette kaç levha ve levhanın ölçüsünü
// belgede görür.
//
// Kaynaklar (değer uydurulmaz; bilinmeyen alan boş kalır):
//   - Filli taşyünü (Dalmaçyalı, Expert, Optimix): 600 × 1000 mm
//     (Filli Eylül 2026 maliyet analizi, YÜKLEME sayfası; 1,67 levha/m²).
//   - Filli EPS: 500 × 1000 mm (aynı dosya, 2 levha/m²).
//   - Bonus: üretici fiyat listesi (Haziran 2026). Levhalar 600 × 1200 mm;
//     rabitz telli şilte rulo 1000 × 3000 / 1000 × 5000 mm. Paket içi adet
//     listeden gelir; levha alanı listedeki ölçüye uymayan satırda ölçü
//     yazılmaz.
// ============================================================

export interface PackageSpec {
  /** Paketteki levha/rulo adedi; bilinmiyorsa null. */
  piecesPerPackage: number | null
  pieceLabel: 'levha' | 'rulo'
  /** "60 × 120 cm" gibi; bilinmiyorsa null. */
  sizeLabel: string | null
}

const FILLI_BRANDS = ['dalmaçyalı', 'expert', 'optimix', 'fawori']

const BONUS_BOARDS: ReadonlyArray<{ areaM2: number; label: string; roll: boolean }> = [
  { areaM2: 0.72, label: '60 × 120 cm', roll: false },
  { areaM2: 3, label: '100 × 300 cm', roll: true },
  { areaM2: 5, label: '100 × 500 cm', roll: true },
]

function near(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance
}

export function resolvePackageSpec(input: {
  brandName: string | null | undefined
  materialSlug: string | null | undefined
  modelShortName?: string | null
  packageM2: number | null | undefined
  /** Üretici listesindeki paket içi adet (Bonus). */
  packagePieces?: number | null
}): PackageSpec | null {
  const packageM2 = Number(input.packageM2)
  if (!Number.isFinite(packageM2) || packageM2 <= 0) return null
  const brand = (input.brandName ?? '').trim().toLocaleLowerCase('tr-TR')

  if (brand === 'bonus') {
    const roll = (input.modelShortName ?? '').startsWith('Endüstriyel Şilte')
    const pieces = Number(input.packagePieces)
    if (!Number.isFinite(pieces) || pieces <= 0) {
      return { piecesPerPackage: null, pieceLabel: roll ? 'rulo' : 'levha', sizeLabel: null }
    }
    const pieceArea = packageM2 / pieces
    const board = BONUS_BOARDS.find((b) => b.roll === roll && near(b.areaM2, pieceArea, 0.005))
    return { piecesPerPackage: pieces, pieceLabel: roll ? 'rulo' : 'levha', sizeLabel: board?.label ?? null }
  }

  if (!FILLI_BRANDS.some((name) => brand.includes(name))) return null
  const board = input.materialSlug === 'eps'
    ? { areaM2: 0.5, label: '50 × 100 cm' }
    : input.materialSlug === 'tasyunu'
      ? { areaM2: 0.6, label: '60 × 100 cm' }
      : null
  if (!board) return null

  const ratio = packageM2 / board.areaM2
  const pieces = Math.round(ratio)
  if (pieces <= 0 || !near(ratio, pieces, 0.01)) {
    return { piecesPerPackage: null, pieceLabel: 'levha', sizeLabel: board.label }
  }
  return { piecesPerPackage: pieces, pieceLabel: 'levha', sizeLabel: board.label }
}

const m2Format = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Belge satırı: "Paket: 4 levha · 2,88 m² · Levha 60 × 120 cm". */
export function formatPackageSpecNote(packageM2: number | null | undefined, spec: PackageSpec | null): string | null {
  const m2 = Number(packageM2)
  if (!Number.isFinite(m2) || m2 <= 0) return null
  const parts = [
    spec?.piecesPerPackage ? `${spec.piecesPerPackage} ${spec.pieceLabel}` : null,
    `${m2Format.format(m2)} m²`,
    spec?.sizeLabel ? `${spec.pieceLabel === 'rulo' ? 'Rulo' : 'Levha'} ${spec.sizeLabel}` : null,
  ].filter(Boolean)
  return `Paket: ${parts.join(' · ')}`
}

/** Metrajı tam pakete yukarı yuvarlar: 1.200 m² / 2,88 → 417 paket = 1.200,96 m². */
export function roundAreaToPackages(
  areaM2: number,
  packageM2: number | null | undefined,
): { packageCount: number; quantityM2: number } | null {
  const pkg = Number(packageM2)
  if (!(areaM2 > 0) || !Number.isFinite(pkg) || pkg <= 0) return null
  // Kayan nokta payı: 2.496 / 1,2 = 2079,9999… tam paket sayılır.
  const packageCount = Math.ceil(areaM2 / pkg - 1e-9)
  return { packageCount, quantityM2: Math.round(packageCount * pkg * 100) / 100 }
}
