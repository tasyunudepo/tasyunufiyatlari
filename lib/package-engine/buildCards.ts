/**
 * lib/package-engine/buildCards.ts
 *
 * Tier bazlı hesap sonuçlarından frontend'in doğrudan kullanabileceği
 * PackageCard[] çıktısını üretir.
 *
 * Her kart:
 *   - tier + title + badge + isRecommended (dengeli = true)
 *   - items[]: slot bazlı ürün satırları (KDV dahil fiyatlar)
 *   - totals: productTotal, shippingCost, grandTotal, pricePerM2, VAT ayrımı
 *   - logistics: araç tipi, doluluk, SmartAdvice
 *   - warnings[]: fallback kararları + nakliye uyarıları
 *   - rationale: kısa açıklama (TIER_CONFIG'den)
 */

import { TIER_CONFIG } from './constants';
import type {
    PackageCard,
    PackageCardItem,
    PackageCardLogistics,
    PackageCardsResponse,
    PackageEngineInput,
    PackageUnavailableResult,
    PricingResult,
    QuantityResult,
    SelectedRecipe,
    WizardTier,
} from './types';

// ==========================================
// INTERNAL TIER RESULT TYPE
// ==========================================

export interface TierResult {
    tier:       WizardTier;
    recipe:     SelectedRecipe;
    quantities: QuantityResult;
    pricing:    PricingResult;
}

// ==========================================
// PUBLIC API
// ==========================================

export function assemblePackageCards(
    tiers:             Array<TierResult | PackageUnavailableResult>,
    input:             PackageEngineInput,
): PackageCardsResponse {
    const cards:            PackageCard[] = [];
    const unavailableTiers: PackageCardsResponse['unavailableTiers'] = [];

    for (const result of tiers) {
        if ('unavailable' in result) {
            unavailableTiers.push({
                tier:         result.tier,
                reason:       result.reason,
                missingSlots: result.missingSlots,
            });
            continue;
        }

        cards.push(buildSingleCard(result, input));
    }

    // Dinamik recommended ataması:
    //   balanced tier varsa → o recommended=true
    //   yoksa → ilk available tier recommended=true
    //   unavailable tier asla recommended olamaz
    const recommendedTier: WizardTier | undefined =
        cards.find(c => c.tier === 'balanced')?.tier ?? cards[0]?.tier;

    for (const card of cards) {
        card.isRecommended = card.tier === recommendedTier;
    }

    return {
        cards,
        availableTiers:   cards.map(c => c.tier),
        unavailableTiers,
        generatedAt:      new Date().toISOString(),
    };
}

// ==========================================
// SINGLE CARD ASSEMBLY
// ==========================================

function buildSingleCard(
    result: TierResult,
    _input: PackageEngineInput,
): PackageCard {
    const { tier, quantities, pricing } = result;
    const config = TIER_CONFIG[tier];

    const items: PackageCardItem[] = pricing.items.map(pi => ({
        slot:       pi.slot,
        name:       pi.name,
        shortName:  pi.shortName,
        brandName:  pi.brandName,
        quantity:   pi.quantity,
        unit:       pi.unit,
        unitPrice:  pi.unitPriceGross,
        totalPrice: pi.totalPriceGross,
        isPlate:    pi.slot === 'plate',
    }));

    const logistics = buildLogisticsBlock(quantities, pricing);

    const warnings = [
        ...quantities.logisticsWarnings,
        ...pricing.warnings,
    ];

    return {
        tier,
        title:         config.title,
        badge:         config.badge,
        isRecommended: config.isRecommended,
        items,
        totals: {
            productTotal:    pricing.productTotalGross,
            shippingCost:    pricing.shippingCost,   // null olabilir
            shippingMode:    pricing.shippingMode,
            grandTotal:      pricing.grandTotalGross,
            pricePerM2:      pricing.pricePerM2Gross,
            priceWithoutVat: pricing.grandTotalNet,
            vatAmount:       pricing.vatAmount,
            isPriceFinal:    pricing.isPriceFinal,
        },
        logistics,
        warnings,
        rationale: config.rationale,
    };
}

// ==========================================
// LOGISTICS BLOCK
// ==========================================

function buildLogisticsBlock(
    quantities: QuantityResult,
    pricing:    PricingResult,
): PackageCardLogistics {
    const logCap = quantities.logCap;
    const isShippingIncluded =
        pricing.shippingMode !== 'low_metrage_excluded' &&
        pricing.shippingMode !== 'multiple_review_required';

    if (!logCap) {
        return {
            platePackageCount:      quantities.platePackageCount,
            packageSizeM2:          quantities.packageSizeM2,
            truckCapacityPackages:  0,
            lorryCapacityPackages:  0,
            truckFillPercentage:    0,
            lorryFillPercentage:    0,
            vehicleType:            quantities.vehicleType,
            isShippingIncluded,
            shippingWarning:        quantities.logisticsWarnings[0],
        };
    }

    const shippingWarning = pricing.warnings.find(
        w => w.includes('nakliye') || w.includes('metraj') || w.includes('TIR'),
    );

    return {
        platePackageCount:        quantities.platePackageCount,
        packageSizeM2:            quantities.packageSizeM2,
        truckCapacityPackages:    logCap.truck_capacity_packages,
        lorryCapacityPackages:    logCap.lorry_capacity_packages,
        truckFillPercentage:      quantities.truckFillPct,
        lorryFillPercentage:      quantities.lorryFillPct,
        vehicleType:              quantities.vehicleType,
        isShippingIncluded,
        packagesNeededForOptimal: quantities.packagesNeededForOptimal,
        shippingWarning,
    };
}
