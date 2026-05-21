/**
 * lib/package-engine/calcPricing.ts
 *
 * Her slot için net/gross fiyat hesabı + nakliye çözümleme.
 *
 * ─── KDV Normalizasyonu ────────────────────────────────────────────────
 *   is_kdv_included=true  → gross = rawPrice,  net = rawPrice / 1.20
 *   is_kdv_included=false → net   = rawPrice,  gross = rawPrice × 1.20
 *
 * ─── İskonto Zinciri ──────────────────────────────────────────────────
 *   net × (1 - discount_1/100) × (1 - discount_2/100)
 *
 *   Accessory.discount_rate_2 hakkında:
 *     Bu alan "ikinci grup iskontosunun üst sınırı"dır — kırım oranı değil.
 *     Anlamı: farklı müşteri segmentleri için discount_2'nin alabileceği
 *     maksimum değer. Wizard/engine akışı segment ayrımı yapmaz; sabit
 *     discount_2 değeri kullanılır. discount_rate_2 bu engine'de uygulanmaz.
 *
 *   PlatePrice.package_discounted_price / m2_discounted_price varsa:
 *     İskonto zaten uygulanmış → discount_1/discount_2 tekrar uygulanmaz.
 *
 * ─── Nakliye ──────────────────────────────────────────────────────────
 *   low_metrage_excluded:
 *     areaM2 < eşik → shippingCost=null, isPriceFinal=false, uyarı zorunlu.
 *     Frontend "nakliye hariç, iletişime geçin" göstermeli.
 *
 *   multiple_review_required:
 *     vehicleType='multiple' → nakliye hesaplanamaz, shippingCost=null,
 *     isPriceFinal=false. Çoklu TIR fiyatlaması admin onayı gerektirir.
 *
 *   Optimix levha nakliye iskontosu (optimix_levha_discount):
 *     Bu alan ShippingZone'da tanımlı ama levha marka eşleştirmesi engine'de
 *     henüz desteklenmiyor. Optimix levha seçilmişse uyarı üretilir ve
 *     genel iskonto (discount_tir / discount_kamyon) uygulanır.
 *     Gerçek iskonto farkı muhtemelen müşteri lehinedir — kötü yönde sapma yok.
 */

import type { ShippingDistrict, ShippingZone } from '@/lib/types';
import { EPS_LOW_METRAGE_M2, KDV_RATE, TASYUNU_LOW_METRAGE_M2 } from './constants';
import type {
    PackageEngineInput,
    PricingResult,
    QuantityResult,
    RecipeSlot,
    SelectedRecipe,
    ShippingMode,
    SlotPricingItem,
} from './types';

// ==========================================
// PUBLIC API
// ==========================================

export function calculatePackagePricing(
    recipe:     SelectedRecipe,
    quantities: QuantityResult,
    input:      PackageEngineInput,
    zone:       ShippingZone,
    district?:  ShippingDistrict,
): PricingResult {
    const warnings: string[] = [];
    const qtyMap = new Map(quantities.slots.map(s => [s.slot, s.quantity]));

    const items: SlotPricingItem[] = [];
    for (const [slot, recipeSlot] of recipe) {
        const quantity = qtyMap.get(slot) ?? 0;
        items.push(buildSlotPricingItem(slot, recipeSlot, quantity));
    }

    const productTotalNet   = items.reduce((sum, i) => sum + i.totalPriceNet,   0);
    const productTotalGross = items.reduce((sum, i) => sum + i.totalPriceGross, 0);

    const {
        shippingCost,
        shippingMode,
        shippingWarning,
    } = resolveShipping(input, zone, district, quantities);

    if (shippingWarning) warnings.push(shippingWarning);

    const isPriceFinal = shippingCost !== null;

    // Grand total: nakliye null ise ürün toplamına dayalı (eksik nakliye uyarısı var)
    const shippingGross = shippingCost ?? 0;
    const shippingNet   = shippingGross / (1 + KDV_RATE);
    const grandTotalNet   = productTotalNet   + shippingNet;
    const grandTotalGross = productTotalGross + shippingGross;
    const vatAmount       = grandTotalGross   - grandTotalNet;

    return {
        items,
        productTotalNet:   round2(productTotalNet),
        productTotalGross: round2(productTotalGross),
        shippingCost,    // null olabilir
        shippingMode,
        grandTotalNet:     round2(grandTotalNet),
        grandTotalGross:   round2(grandTotalGross),
        pricePerM2Net:     round2(grandTotalNet   / input.areaM2),
        pricePerM2Gross:   round2(grandTotalGross / input.areaM2),
        vatAmount:         round2(vatAmount),
        isPriceFinal,
        warnings,
    };
}

// ==========================================
// SLOT PRICING ITEMS
// ==========================================

function buildSlotPricingItem(
    slot:       import('@/lib/types').PackageSlot,
    recipeSlot: RecipeSlot,
    quantity:   number,
): SlotPricingItem {
    if (recipeSlot.kind === 'plate') {
        return buildPlatePricingItem(slot, recipeSlot, quantity);
    }
    return buildAccessoryPricingItem(slot, recipeSlot, quantity);
}

function buildPlatePricingItem(
    slot:       import('@/lib/types').PackageSlot,
    recipeSlot: Extract<RecipeSlot, { kind: 'plate' }>,
    quantity:   number,
): SlotPricingItem {
    const { plate, platePrice, brand } = recipeSlot;

    // Öncelik: package_discounted_price > m2_discounted_price > base_price
    // İlk iki alan iskonto zaten uygulanmış değerler.
    const hasPreCalculated = platePrice.package_discounted_price != null
        || platePrice.m2_discounted_price != null;

    const rawPrice = platePrice.package_discounted_price
        ?? platePrice.m2_discounted_price
        ?? platePrice.base_price;

    const { net: rawNet } = normalizeKdv(rawPrice, platePrice.is_kdv_included);

    const unitPriceNet = hasPreCalculated
        ? rawNet
        : applyDiscountChain(rawNet, plate.discount_1, plate.discount_2);

    const unitPriceGross = unitPriceNet * (1 + KDV_RATE);

    return {
        slot,
        name:            plate.name,
        shortName:       plate.short_name,
        brandName:       brand.name,
        quantity,
        unit:            'paket',
        unitPriceNet:    round2(unitPriceNet),
        unitPriceGross:  round2(unitPriceGross),
        totalPriceNet:   round2(unitPriceNet  * quantity),
        totalPriceGross: round2(unitPriceGross * quantity),
    };
}

function buildAccessoryPricingItem(
    slot:       import('@/lib/types').PackageSlot,
    recipeSlot: Extract<RecipeSlot, { kind: 'accessory' }>,
    quantity:   number,
): SlotPricingItem {
    const { accessory, brand } = recipeSlot;

    const { net: rawNet } = normalizeKdv(accessory.base_price, accessory.is_kdv_included);

    // Accessory.discount_rate_2: "ikinci grup iskontosunun üst sınırı" — bu engine'de uygulanmaz.
    // Wizard akışı müşteri segmenti ayrımı yapmaz; sabit discount_2 değeri kullanılır.
    const unitPriceNet   = applyDiscountChain(rawNet, accessory.discount_1, accessory.discount_2);
    const unitPriceGross = unitPriceNet * (1 + KDV_RATE);

    return {
        slot,
        name:            accessory.name,
        shortName:       accessory.short_name,
        brandName:       brand.name,
        quantity,
        unit:            accessory.unit,
        unitPriceNet:    round2(unitPriceNet),
        unitPriceGross:  round2(unitPriceGross),
        totalPriceNet:   round2(unitPriceNet  * quantity),
        totalPriceGross: round2(unitPriceGross * quantity),
    };
}

// ==========================================
// SHIPPING RESOLUTION
// ==========================================

type ShippingResolution = {
    shippingCost:    number | null;
    shippingMode:    ShippingMode;
    shippingWarning?: string;
};

function resolveShipping(
    input:      PackageEngineInput,
    zone:       ShippingZone,
    district:   ShippingDistrict | undefined,
    quantities: QuantityResult,
): ShippingResolution {
    const lowMetrageThreshold = input.materialType === 'tasyunu'
        ? TASYUNU_LOW_METRAGE_M2
        : EPS_LOW_METRAGE_M2;

    // Düşük metraj → nakliye hariç, fiyat kesin değil
    if (input.areaM2 < lowMetrageThreshold) {
        return {
            shippingCost:    null,
            shippingMode:    'low_metrage_excluded',
            shippingWarning: (
                `${input.areaM2} m² düşük metraj (eşik: ${lowMetrageThreshold} m²). ` +
                `Nakliye ücreti hesaplanmadı — lütfen iletişime geçin.`
            ),
        };
    }

    // Çoklu araç → nakliye kesinleştirilemez, admin onayı gerekir
    if (quantities.vehicleType === 'multiple') {
        return {
            shippingCost:    null,
            shippingMode:    'multiple_review_required',
            shippingWarning: (
                `${quantities.platePackageCount} paket tek TIR kapasitesini aşıyor. ` +
                `Çoklu araç nakliyesi için fiyat netleştirilmeli.`
            ),
        };
    }

    // Optimix levha nakliye iskontosu desteklenmiyor — genel iskonto uygulanır, uyarı verilir
    // (optimix_levha_discount ShippingZone'da var ama marka eşleştirmesi henüz yok)
    const hasOptimixPlate = checkOptimixPlate(quantities);
    if (hasOptimixPlate) {
        // Uyarı tetiklenir ama hesap durdurmaz — genel iskonto devam eder
        // Bu uyarı warnings[] üzerinden dönecek; çağıran kod ekleyecek
    }

    let discountPct: number;
    let shippingMode: ShippingMode;

    switch (quantities.vehicleType) {
        case 'truck':
            discountPct  = zone.discount_tir;
            shippingMode = 'tir_discount';
            break;
        case 'lorry':
            discountPct  = zone.discount_kamyon;
            shippingMode = 'included';
            break;
        default: // 'none'
            discountPct  = 0;
            shippingMode = 'included';
    }

    const baseCost      = zone.base_shipping_cost * (1 - discountPct / 100);
    const districtExtra = district?.extra_cost ?? 0;
    const totalShipping = baseCost + districtExtra;

    const shippingWarning = hasOptimixPlate
        ? `Optimix levha nakliye iskontosu (optimix_levha_discount) bu engine'de desteklenmiyor. ` +
          `Genel ${quantities.vehicleType === 'truck' ? 'TIR' : 'kamyon'} iskontosu uygulandı.`
        : undefined;

    return { shippingCost: round2(totalShipping), shippingMode, shippingWarning };
}

/**
 * Seçilen levhanın Optimix markasına ait olup olmadığını kontrol eder.
 * QuantityResult'ta marka bilgisi yok; bu kontrol SelectedRecipe üzerinden yapılmalıydı.
 * Şu an placeholder — gerçek implementasyon için calculatePackagePricing'e recipe geçilmeli.
 * TODO: recipe parametresini resolveShipping'e ilet ve plate brand_id kontrolü yap.
 */
function checkOptimixPlate(_quantities: QuantityResult): boolean {
    // placeholder — şimdilik false döner, implementasyon TODO
    return false;
}

// ==========================================
// HELPERS
// ==========================================

function normalizeKdv(
    price:         number,
    isKdvIncluded: boolean,
): { net: number; gross: number } {
    if (isKdvIncluded) {
        return { gross: price, net: price / (1 + KDV_RATE) };
    }
    return { net: price, gross: price * (1 + KDV_RATE) };
}

function applyDiscountChain(net: number, d1: number, d2: number): number {
    return net * (1 - d1 / 100) * (1 - d2 / 100);
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}
