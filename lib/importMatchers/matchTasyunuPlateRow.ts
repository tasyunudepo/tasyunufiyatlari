import type { MatchResult, NormalizedImportRow } from '../importTypes';
import type {
    MatchBrandRecord,
    MatchMaterialTypeRecord,
    MatchPlatePriceRecord,
    MatchPlateRecord,
} from '../importMatcher';
import {
    buildPlateCandidate,
    buildPlatePriceMap,
    chooseStatusFromConfidence,
    computeNameSimilarity,
    finalizeMatchResult,
    findPlateFamilyCanonical,
    resolveBrandId,
} from './shared';

export function matchTasyunuPlateRow(
    row: NormalizedImportRow,
    plates: MatchPlateRecord[],
    platePrices: MatchPlatePriceRecord[],
    brands: MatchBrandRecord[],
    materialTypes: MatchMaterialTypeRecord[],
): MatchResult {
    const materialTypeId = materialTypes.find(m => m.slug === 'tasyunu')?.id;
    const hintBrandId = resolveBrandId(row.brandCanonical, row.brandNameHint, brands);
    const priceMap = buildPlatePriceMap(platePrices);

    // Brand-aware ambiguous count: familyMatch(+0.45) + thicknessMatch(+0.20) = 0.75 her zaman
    // 0.70 eşiğini geçer — brand olmadan bile. 3 marka × N kalınlık → count≥2 → ambiguous.
    // Çözüm: best marka+kalınlık eşleşmeliyse, yalnızca aynı marka+kalınlık adayları sayılır.
    const brandedPlateIds = hintBrandId !== undefined
        ? new Set(plates.filter(p => p.brand_id === hintBrandId).map(p => p.id))
        : undefined;

    const candidates = plates
        .filter(plate => materialTypeId === undefined || plate.material_type_id === materialTypeId)
        .map(plate => {
            const dbFamily = findPlateFamilyCanonical(plate, brands);
            const familyMatch = row.familyCanonical !== undefined && dbFamily === row.familyCanonical;
            const brandMatch = hintBrandId !== undefined && plate.brand_id === hintBrandId;
            const thicknessMatch = row.thicknessCm !== undefined
                ? priceMap.get(`${plate.id}_${row.thicknessCm}`)
                : undefined;
            const nameSim = computeNameSimilarity(row.rawProductName, plate.short_name);

            // Rule-first: canonical alanlar temel skoru belirler.
            // nameSim sadece tie-breaker (maks +0.05); similarity tek başına eşleşme üretmez.
            let confidence = 0.10 + nameSim * 0.05;
            let matchMethod: 'exact' | 'fuzzy' | 'brand_thickness' | 'name_only' = 'name_only';

            if (familyMatch) {
                confidence += 0.45;
                matchMethod = 'exact';
            }
            if (brandMatch) {
                confidence += 0.20;
                matchMethod = familyMatch ? 'exact' : 'fuzzy';
            }
            if (thicknessMatch) {
                confidence += 0.20;
                matchMethod = familyMatch || brandMatch ? 'brand_thickness' : matchMethod;
            }

            return buildPlateCandidate(plate, thicknessMatch, Math.min(confidence, 0.99), matchMethod);
        })
        .filter(candidate => candidate.confidence >= 0.20)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

    const best = candidates[0];

    // Brand-aware ambiguous count:
    // best marka-eşleşmeli VE kalınlık-eşleşmeli ise → yalnızca aynı marka+kalınlık sayılır.
    // best sadece marka-eşleşmeli ise → yalnızca aynı marka sayılır.
    // brand bilinmiyorsa → tüm adaylar sayılır (gerçekten belirsiz).
    const topCandidates = candidates.filter(c => c.confidence >= 0.70);
    const bestIsBranded = brandedPlateIds !== undefined && best?.plateId !== undefined && brandedPlateIds.has(best.plateId);
    const bestHasThickness = best?.platePriceId !== undefined;

    let ambiguousCandidateCount: number;
    if (bestIsBranded && bestHasThickness) {
        ambiguousCandidateCount = topCandidates.filter(c =>
            c.plateId !== undefined && brandedPlateIds!.has(c.plateId) && c.platePriceId !== undefined,
        ).length;
    } else if (bestIsBranded) {
        ambiguousCandidateCount = topCandidates.filter(c =>
            c.plateId !== undefined && brandedPlateIds!.has(c.plateId),
        ).length;
    } else {
        ambiguousCandidateCount = topCandidates.length;
    }

    const baseStatus = chooseStatusFromConfidence(best, ambiguousCandidateCount, 'new_product');

    // Levha kalınlığı bulundu ama platePriceId yoksa → variant_missing
    const statusAfterVariant = baseStatus === 'matched' && row.thicknessCm !== undefined && !best?.platePriceId
        ? 'variant_missing'
        : baseStatus;

    // Hard guard — score'dan bağımsız kesin engeller:
    //   1. familyCanonical yoksa matched olamaz: hangi levha ailesi olduğu belirsiz
    //   2. thicknessCm yoksa matched olamaz: kalınlık bilinmeden fiyat satırı seçilemez
    const status = statusAfterVariant === 'matched' && (
        row.familyCanonical === undefined || row.thicknessCm === undefined
    ) ? 'ambiguous' : statusAfterVariant;

    return finalizeMatchResult(row, status, candidates, best);
}
