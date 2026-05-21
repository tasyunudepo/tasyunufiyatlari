/**
 * lib/package-engine/index.ts
 *
 * Package Engine — Public Entry Point
 *
 * Tek fonksiyon: buildPackageCards(input, ctx) → PackageCardsResponse
 *
 * Akış (tüm adımlar pure function, DB çağrısı yok):
 *   1. buildPackageCandidates  → tier × slot aday havuzları
 *   2. for each tier:
 *      a. selectPackageRecipe  → deterministik slot seçimi (veya PackageUnavailableResult)
 *      b. calculatePackageQuantities → fiziksel birimler
 *      c. calculatePackagePricing    → KDV/iskonto/nakliye
 *   3. assemblePackageCards    → frontend output contract
 *
 * Kullanım (API route'ta):
 *   const ctx = await fetchPackageEngineContext(input);  // DB çağrıları
 *   const response = buildPackageCards(input, ctx);
 *   return NextResponse.json(response);
 */

import { assemblePackageCards, type TierResult } from './buildCards';
import { buildPackageCandidates } from './buildCandidates';
import { calculatePackagePricing } from './calcPricing';
import { calculatePackageQuantities } from './calcQuantities';
import { WIZARD_TIERS } from './constants';
import { selectPackageRecipe } from './selectRecipe';
import type {
    PackageCardsResponse,
    PackageEngineContext,
    PackageEngineInput,
    PackageUnavailableResult,
} from './types';

// ==========================================
// PUBLIC API
// ==========================================

export function buildPackageCards(
    input: PackageEngineInput,
    ctx:   PackageEngineContext,
): PackageCardsResponse {
    // Adım 1: Aday havuzları — tüm tier'lar paralel olarak hazırlanır
    const pools = buildPackageCandidates(ctx, input);

    // Adım 2: Her tier için recipe → quantities → pricing
    const results: Array<TierResult | PackageUnavailableResult> = [];

    for (const tier of WIZARD_TIERS) {
        const selectionWarnings: string[] = [];

        const recipeOrUnavailable = selectPackageRecipe(
            pools,
            tier,
            selectionWarnings,
        );

        if ('unavailable' in recipeOrUnavailable) {
            results.push(recipeOrUnavailable);
            continue;
        }

        const quantities = calculatePackageQuantities(
            recipeOrUnavailable,
            input,
            ctx.logisticsCapacity,
        );

        const pricing = calculatePackagePricing(
            recipeOrUnavailable,
            quantities,
            input,
            ctx.shippingZone,
            ctx.shippingDistrict,
        );

        // Fallback seçim uyarılarını pricing.warnings'e ekle
        pricing.warnings.unshift(...selectionWarnings);

        results.push({
            tier,
            recipe:     recipeOrUnavailable,
            quantities,
            pricing,
        } satisfies TierResult);
    }

    // Adım 3: Frontend kartları
    return assemblePackageCards(results, input);
}

// ==========================================
// RE-EXPORTS — API route ve component'lar için
// ==========================================

export type {
    PackageCard,
    PackageCardItem,
    PackageCardLogistics,
    PackageCardTotals,
    PackageCardsResponse,
    PackageEngineContext,
    PackageEngineInput,
    ShippingMode,
} from './types';
