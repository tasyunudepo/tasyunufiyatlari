import type {
    MatchCandidate,
    MatchResult,
    NormalizedImportRow,
} from '../importTypes';
import {
    BRAND_ALIAS_RULES,
    FAMILY_ALIAS_RULES,
    PRODUCT_CLASS_RULES,
    VARIANT_ALIAS_RULES,
} from '../importAliasDictionary';
import type {
    MatchAccessoryRecord,
    MatchAccessoryTypeRecord,
    MatchBrandRecord,
    MatchPlatePriceRecord,
    MatchPlateRecord,
} from '../importMatcher';
import type { CanonicalMeasurement, ProductClass } from '../importTypes';

export const KDV_RATE = 1.20;
export const CONFIDENCE_MATCH_MIN = 0.70;
export const CONFIDENCE_AMBIGUOUS = 0.45;

const ACCESSORY_TYPE_SLUG_TO_CLASS: Record<string, ProductClass> = {
    yapistirici: 'adhesive',
    siva: 'render',
    dubel: 'dowel',
    file: 'mesh',
    'fileli-kose': 'corner_profile',
    astar: 'primer',
    kaplama: 'coating',
};

const ACCESSORY_TYPE_SLUG_TO_FAMILY: Record<string, string> = {
    yapistirici: 'yapistirici',
    siva: 'siva',
    dubel: 'dubel',
    file: 'donati_filesi',
    'fileli-kose': 'fileli_kose',
    astar: 'astar',
    kaplama: 'kaplama',
};

export interface AccessoryMatchMetadata {
    productClass?: ProductClass;
    familyCanonical?: string;
    variantCanonical?: string;
    sizeToken?: string;
    materialScope: 'eps' | 'tasyunu' | 'both' | 'unknown';
}

export type MaterialScopeMatch = 'exact' | 'unknown' | 'mismatch';

const STOP_WORDS = new Set([
    've', 'ile', 'icin', 'en', 'bir', 'panel', 'urun', 'malzeme', 'adet', 'paket', 'kg',
]);

export function normalizeTextForMatch(text: string): string {
    return text
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'i')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\d+kg/g, ' ')
        .replace(/[^\w\s.*]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function tokenize(text: string): string[] {
    return normalizeTextForMatch(text)
        .split(' ')
        .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

export function computeNameSimilarity(importName: string, dbName: string): number {
    const importToks = tokenize(importName);
    const dbToks = tokenize(dbName);

    if (dbToks.length === 0 && importToks.length === 0) return 1.0;
    if (dbToks.length === 0 || importToks.length === 0) return 0.0;

    const importSet = new Set(importToks);
    const dbSet = new Set(dbToks);

    let hits = 0;
    for (const t of dbSet) {
        if (importSet.has(t)) hits++;
    }

    const dbRecall = hits / dbSet.size;
    const unionSize = importSet.size + dbSet.size - hits;
    const jaccard = hits / unionSize;
    return dbRecall * 0.70 + jaccard * 0.30;
}

function normalizeBrandName(name: string): string {
    let normalized = name
        .replace(/[ıİ]/g, 'i')
        .replace(/[çÇ]/g, 'c')
        .replace(/[ğĞ]/g, 'g')
        .replace(/[öÖ]/g, 'o')
        .replace(/[şŞ]/g, 's')
        .replace(/[üÜ]/g, 'u')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\w\s.*]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (normalized.includes('dalma') && normalized.includes('yali')) {
        normalized = 'dalmacyali';
    }

    const rule = BRAND_ALIAS_RULES.find(item =>
        item.patterns.some(pattern => normalized.includes(normalizeTextForMatch(pattern))),
    );
    return rule?.canonical ?? normalized;
}

export function resolveBrandId(
    brandCanonical: string | undefined,
    hint: string | undefined,
    brands: MatchBrandRecord[],
): number | undefined {
    const key = brandCanonical ?? (hint ? normalizeBrandName(hint) : undefined);
    if (!key) return undefined;

    for (const b of brands) {
        if (normalizeBrandName(b.name) === key) return b.id;
    }
    if (key === 'dalmacyali') {
        const direct = brands.find(b => b.name.toLowerCase().includes('dalma'));
        if (direct) return direct.id;
    }
    if (key === 'optimix') {
        const direct = brands.find(b => {
            const lower = b.name.toLowerCase();
            return lower.includes('optimix') || lower.includes('fawori');
        });
        if (direct) return direct.id;
    }
    if (key === 'oem') {
        const direct = brands.find(b => b.name.toLowerCase().includes('oem'));
        if (direct) return direct.id;
    }
    for (const b of brands) {
        const normBrand = normalizeBrandName(b.name);
        if (normBrand.includes(key) || key.includes(normBrand)) return b.id;
    }
    return undefined;
}

export function normalizeCanonicalKey(value: string | undefined): string | undefined {
    return value?.replace(/_/g, ' ');
}

export function textIncludesCanonical(text: string, canonical: string | undefined): boolean {
    if (!canonical) return false;
    const key = normalizeCanonicalKey(canonical);
    return key ? normalizeTextForMatch(text).includes(key) : false;
}

export function classifyAccessoryText(text: string): string | undefined {
    const normalized = normalizeTextForMatch(text);
    for (const rule of PRODUCT_CLASS_RULES) {
        if (rule.patterns.some(pattern => normalized.includes(normalizeTextForMatch(pattern)))) {
            return rule.productClass;
        }
    }
    return undefined;
}

export function findFamilyCanonicalInText(text: string): string | undefined {
    const normalized = normalizeTextForMatch(text);
    return FAMILY_ALIAS_RULES.find(rule =>
        rule.patterns.some(pattern => normalized.includes(normalizeTextForMatch(pattern))),
    )?.canonical;
}

/**
 * Levha kaydının ailesi. short_name tek başına bir aile kuralına uymazsa
 * markayla birlikte denenir: Optimix Karbonlu'nun short_name'i "Karbonlu",
 * aile kuralı ise "optimix karbonlu" metnini bekler (16 Ekim 2026).
 */
export function findPlateFamilyCanonical(plate: MatchPlateRecord, brands: MatchBrandRecord[]): string {
    const own = findFamilyCanonicalInText(plate.short_name);
    if (own) return own;
    const brandName = brands.find(b => b.id === plate.brand_id)?.name;
    const withBrand = brandName ? findFamilyCanonicalInText(`${brandName} ${plate.short_name}`) : undefined;
    return withBrand ?? plate.short_name;
}

export function findVariantCanonicalInText(text: string): string | undefined {
    const normalized = normalizeTextForMatch(text);
    return VARIANT_ALIAS_RULES.find(rule =>
        rule.patterns.some(pattern => normalized.includes(normalizeTextForMatch(pattern))),
    )?.canonical;
}

export function inferSizeTokenFromText(text: string, productClass?: ProductClass): string | undefined {
    const normalized = normalizeTextForMatch(text);

    if (productClass === 'dowel') {
        const cmMatch = normalized.match(/(\d+(?:[.]\d+)?)\s*cm/);
        if (cmMatch) return `${cmMatch[1]}cm`;
    }

    if (productClass === 'coating') {
        const mmMatch = normalized.match(/(\d+(?:[.]\d+)?)\s*mm/);
        if (mmMatch) return `${mmMatch[1]}mm`;
    }

    if (productClass === 'corner_profile' || productClass === 'fuga_profile' || productClass === 'pvc_profile') {
        const profileMatch = normalized.match(/(\d+(?:[.]\d+)?)\s*[x*]\s*(\d+(?:[.]\d+)?)\s*cm/);
        if (profileMatch) return `${profileMatch[1]}x${profileMatch[2]}cm`;
    }

    return undefined;
}

export function normalizeSizeToken(sizeToken: string | undefined): string | undefined {
    if (!sizeToken) return undefined;

    const normalized = normalizeTextForMatch(sizeToken)
        .replace(/\s+/g, '')
        .replace(/\*/g, 'x');

    if (!normalized) return undefined;

    if (/^\d+(?:\.\d+)?cm$/.test(normalized)) {
        return normalized;
    }
    if (/^\d+(?:\.\d+)?mm$/.test(normalized)) {
        return normalized;
    }
    if (/^\d+(?:\.\d+)?x\d+(?:\.\d+)?cm$/.test(normalized)) {
        return normalized;
    }

    return normalized;
}

export function compareMaterialScope(
    materialType: string,
    materialScope: AccessoryMatchMetadata['materialScope'],
): MaterialScopeMatch {
    if (materialType === 'unknown' || materialScope === 'unknown' || materialScope === 'both') {
        return 'unknown';
    }
    return materialType === materialScope ? 'exact' : 'mismatch';
}

export function isMeasurementCompatible(
    rowMeasurement: CanonicalMeasurement | undefined,
    accessory: MatchAccessoryRecord,
): boolean {
    if (!rowMeasurement?.unitContent || !accessory.unit_content) return true;

    const delta = Math.abs(rowMeasurement.unitContent - accessory.unit_content);
    return delta < 0.01;
}

export function buildAccessoryMetadata(
    accessory: MatchAccessoryRecord,
    accessoryTypesById: Map<number, MatchAccessoryTypeRecord>,
): AccessoryMatchMetadata {
    const targetText = [accessory.short_name, accessory.name].filter(Boolean).join(' ');
    const accessoryTypeSlug = accessory.accessory_type_id !== undefined
        ? accessoryTypesById.get(accessory.accessory_type_id)?.slug
        : undefined;

    const inferredClass = accessoryTypeSlug
        ? ACCESSORY_TYPE_SLUG_TO_CLASS[accessoryTypeSlug]
        : classifyAccessoryText(targetText) as ProductClass | undefined;

    const inferredFamily = accessoryTypeSlug
        ? ACCESSORY_TYPE_SLUG_TO_FAMILY[accessoryTypeSlug]
        : findFamilyCanonicalInText(targetText);

    let materialScope: AccessoryMatchMetadata['materialScope'] = 'unknown';
    if (accessory.material_scope) {
        materialScope = accessory.material_scope;
    } else if (accessory.is_for_eps && accessory.is_for_tasyunu) {
        materialScope = 'both';
    } else if (accessory.is_for_eps) {
        materialScope = 'eps';
    } else if (accessory.is_for_tasyunu) {
        materialScope = 'tasyunu';
    }

    return {
        productClass: (accessory.product_class as ProductClass | undefined) ?? inferredClass,
        familyCanonical: accessory.family_canonical ?? inferredFamily,
        variantCanonical: accessory.variant_canonical ?? findVariantCanonicalInText(targetText),
        sizeToken: accessory.size_token ?? inferSizeTokenFromText(targetText, inferredClass),
        materialScope,
    };
}

export function isGenericVariantCanonical(value: string | undefined): boolean {
    return value === undefined || value === 'generic';
}

export function calculatePriceChangePct(best: MatchCandidate | undefined, proposedPrice: number): number | undefined {
    if (!best?.currentPrice || best.currentPrice <= 0) return undefined;
    const currentNet = best.currentKdvIncluded ? best.currentPrice / KDV_RATE : best.currentPrice;
    return ((proposedPrice - currentNet) / currentNet) * 100;
}

export function finalizeMatchResult(
    row: NormalizedImportRow,
    status: MatchResult['status'],
    candidates: MatchCandidate[],
    bestCandidate?: MatchCandidate,
): MatchResult {
    const priceChangePct = status === 'matched'
        ? calculatePriceChangePct(bestCandidate, row.base_price_net)
        : undefined;
    const requiresReview = priceChangePct !== undefined && Math.abs(priceChangePct) > 30;

    return {
        rowIndex: row.rowIndex,
        status,
        candidates,
        bestCandidate,
        proposedPrice: row.base_price_net,
        priceChangePct,
        requiresReview,
    };
}

export function chooseStatusFromConfidence(
    matchedCandidate: MatchCandidate | undefined,
    ambiguousCandidateCount: number,
    fallbackWhenLow: MatchResult['status'],
): MatchResult['status'] {
    if (!matchedCandidate) return fallbackWhenLow;
    if (ambiguousCandidateCount > 1) return 'ambiguous';
    if (matchedCandidate.confidence >= CONFIDENCE_MATCH_MIN) return 'matched';
    if (matchedCandidate.confidence >= CONFIDENCE_AMBIGUOUS) return 'ambiguous';
    return fallbackWhenLow;
}

export function buildPlatePriceMap(platePrices: MatchPlatePriceRecord[]): Map<string, MatchPlatePriceRecord> {
    const map = new Map<string, MatchPlatePriceRecord>();
    for (const pp of platePrices) {
        map.set(`${pp.plate_id}_${pp.thickness}`, pp);
    }
    return map;
}

export function buildPlateCandidate(
    plate: MatchPlateRecord,
    platePrice: MatchPlatePriceRecord | undefined,
    confidence: number,
    matchMethod: MatchCandidate['matchMethod'],
): MatchCandidate {
    return {
        plateId: plate.id,
        platePriceId: platePrice?.id,
        confidence,
        matchMethod,
        currentPrice: platePrice?.base_price,
        currentKdvIncluded: platePrice?.is_kdv_included,
    };
}

export function buildAccessoryCandidate(
    accessory: MatchAccessoryRecord,
    confidence: number,
    matchMethod: MatchCandidate['matchMethod'],
): MatchCandidate {
    return {
        accessoryId: accessory.id,
        confidence,
        matchMethod,
        currentPrice: accessory.base_price,
        currentKdvIncluded: accessory.is_kdv_included ?? true,
    };
}
