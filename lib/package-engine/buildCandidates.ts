/**
 * lib/package-engine/buildCandidates.ts
 *
 * DB verisinden tier bazlı aday havuzları üretir.
 *
 * Levha ve aksesuar seçim yolları kasıtlı olarak ayrılmıştır:
 *   - Levha: plates + plate_prices tabanlı, ayrı fonksiyon
 *   - Aksesuar: package_slot tabanlı, ayrı fonksiyon
 *   PackageSlot='plate' yalnızca engine output (SelectedRecipe) seviyesinde ortaktır.
 *
 * Eligibility:
 *   Levha:    is_package_eligible && quality_band !== null && seçilen kalınlık için platePrice var
 *   Aksesuar: commercial_mode='core' && is_package_eligible && wizard_visible
 *             && package_slot !== null && quality_band !== null && malzeme uyumluluğu
 *
 * Sıralama: sales_priority ASC → id ASC (deterministik, stabil)
 */

import { WIZARD_TIERS } from './constants';
import type {
    AccessoryCandidateItem,
    AccessorySlot,
    PackageEngineContext,
    PackageEngineInput,
    PlateCandidateItem,
    TierAccessoryPools,
    TierCandidatePools,
    TierPlatePools,
    WizardTier,
} from './types';

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Levha ve aksesuar aday havuzlarını ayrı yollarla üretir.
 * İki havuz ayrı Record yapılarında döner; engine içinde mutate edilmez.
 */
export function buildPackageCandidates(
    ctx:   PackageEngineContext,
    input: PackageEngineInput,
): TierCandidatePools {
    const matKey: 'is_for_tasyunu' | 'is_for_eps' =
        input.materialType === 'tasyunu' ? 'is_for_tasyunu' : 'is_for_eps';

    return {
        plates:      buildTierPlatePools(ctx, input),
        accessories: buildTierAccessoryPools(ctx, matKey),
    };
}

// ==========================================
// LEVHA HAVUZU — plates + plate_prices tabanlı
// ==========================================

function buildTierPlatePools(
    ctx:   PackageEngineContext,
    input: PackageEngineInput,
): TierPlatePools {
    const allPlateCandidates = collectPlateCandidates(ctx, input);

    const pools = {} as TierPlatePools;
    for (const tier of WIZARD_TIERS) {
        pools[tier] = sortPlateCandidates(
            allPlateCandidates.filter(c => c.qualityBand === tier),
        );
    }
    return pools;
}

function collectPlateCandidates(
    ctx:   PackageEngineContext,
    input: PackageEngineInput,
): PlateCandidateItem[] {
    const candidates: PlateCandidateItem[] = [];

    for (const plate of ctx.plates) {
        if (!plate.is_package_eligible) continue;
        if (plate.quality_band === null)  continue;

        // Seçilen kalınlık için fiyat kaydı zorunlu
        const platePrice = ctx.platePrices.find(
            pp => pp.plate_id === plate.id && pp.thickness === input.thicknessCm,
        );
        if (!platePrice) continue;

        const brand = ctx.brands.find(b => b.id === plate.brand_id);
        if (!brand) continue;

        candidates.push({
            kind:        'plate',
            plate,
            platePrice,
            brand,
            qualityBand: plate.quality_band as WizardTier,
            priority:    plate.sales_priority,
        });
    }

    return candidates;
}

function sortPlateCandidates(candidates: PlateCandidateItem[]): PlateCandidateItem[] {
    return [...candidates].sort((a, b) => {
        const pDiff = a.priority - b.priority;
        return pDiff !== 0 ? pDiff : a.plate.id - b.plate.id;
    });
}

// ==========================================
// AKSESUAR HAVUZU — package_slot tabanlı
// ==========================================

function buildTierAccessoryPools(
    ctx:    PackageEngineContext,
    matKey: 'is_for_tasyunu' | 'is_for_eps',
): TierAccessoryPools {
    const allAccessoryCandidates = collectAccessoryCandidates(ctx, matKey);

    const pools = {} as TierAccessoryPools;
    for (const tier of WIZARD_TIERS) {
        pools[tier] = buildAccessorySlotMap(
            allAccessoryCandidates.filter(c => c.qualityBand === tier),
        );
    }
    return pools;
}

function collectAccessoryCandidates(
    ctx:    PackageEngineContext,
    matKey: 'is_for_tasyunu' | 'is_for_eps',
): AccessoryCandidateItem[] {
    const candidates: AccessoryCandidateItem[] = [];

    for (const acc of ctx.accessories) {
        if (acc.commercial_mode     !== 'core') continue;
        if (!acc.is_package_eligible)            continue;
        if (!acc.wizard_visible)                 continue;
        if (acc.package_slot  === null)          continue;
        if (acc.quality_band  === null)          continue;
        if (!acc[matKey])                        continue;
        // 'plate' slotuna aksesuar atanmamalı — veri kalitesi guard
        if (acc.package_slot === 'plate')        continue;

        const accessoryType = ctx.accessoryTypes.find(t => t.id === acc.accessory_type_id);
        if (!accessoryType) continue;

        const brand = ctx.brands.find(b => b.id === acc.brand_id);
        if (!brand) continue;

        candidates.push({
            kind:          'accessory',
            accessory:     acc,
            accessoryType,
            brand,
            qualityBand:   acc.quality_band as WizardTier,
            priority:      acc.sales_priority,
        });
    }

    return candidates;
}

function buildAccessorySlotMap(
    candidates: AccessoryCandidateItem[],
): Map<AccessorySlot, AccessoryCandidateItem[]> {
    const slotMap = new Map<AccessorySlot, AccessoryCandidateItem[]>();

    for (const acc of candidates) {
        const slot = acc.accessory.package_slot as AccessorySlot;
        const existing = slotMap.get(slot) ?? [];
        existing.push(acc);
        slotMap.set(slot, existing);
    }

    // Her slot kendi içinde deterministik sıralı
    for (const [slot, list] of slotMap) {
        slotMap.set(slot, [...list].sort((a, b) => {
            const pDiff = a.priority - b.priority;
            return pDiff !== 0 ? pDiff : a.accessory.id - b.accessory.id;
        }));
    }

    return slotMap;
}
