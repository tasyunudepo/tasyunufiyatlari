// ==========================================
// PACKAGE ENGINE — Enum Types (migration v4)
// ==========================================

/** 8-slot paket sistemindeki pozisyon */
export type PackageSlot =
    | 'adhesive'
    | 'render'
    | 'dowel'
    | 'mesh'
    | 'corner'
    | 'primer'
    | 'coating'
    | 'plate';

/** Ticari görünürlük ve akış modu */
export type CommercialMode = 'core' | 'optional' | 'special_order' | 'hidden';

/** Paket motoru seçim katmanı */
export type QualityBand = 'premium' | 'balanced' | 'economic' | 'special';

/**
 * Package engine aday filtresi — tüm koşullar AND'lı olmalı.
 *
 * Accessories için:
 *   acc.commercial_mode === 'core'   // birincil filtre; optional/special/hidden girmez
 *   && acc.is_package_eligible       // admin override koruması (core bile false olabilir)
 *   && acc.wizard_visible            // UI görünürlük kontrolü
 *   && acc.package_slot !== null     // slot atanmamış ürün aday olamaz
 *   && acc.quality_band !== null     // band belirsiz ürün aday olamaz
 *   && (acc.is_for_eps || acc.is_for_tasyunu)  // malzeme uyumluluğu
 *
 * Plates için:
 *   plate.is_package_eligible        // yalnızca mantolama kategorisi
 *   && plate.quality_band !== null
 *
 * commercial_mode tek başına yeterli DEĞİL — is_package_eligible çift kontrol.
 */
export type PackageEngineCandidate = Accessory & {
    commercial_mode:     'core';
    is_package_eligible: true;
    wizard_visible:      true;
    package_slot:        PackageSlot;   // null değil
    quality_band:        QualityBand;   // null değil
};

// ==========================================
// SHIPPING & LOCATION TYPES
// ==========================================

export interface ShippingZone {
    city_code: number;
    city_name: string;
    base_shipping_cost: number;
    discount_kamyon: number;
    discount_tir: number;
    optimix_toz_discount: number;
    optimix_levha_discount: number;
    eps_toz_region_discount?: number;
    is_active: boolean;
    // Bölge sınıflandırması — WizardStep3 ve DiscountsTab görselleştirir.
    zone?: 'green' | 'yellow' | 'red';
}

// ==========================================
// UI / CONSTANT TYPES
// ==========================================

export interface KalinlikOption {
    value: string;
    label: string;
    popular?: boolean;
}

export interface UygulamaKategorisi {
    id: string;
    name: string;
    icon: string;
    description: string;
    levhalar: string[];
}

export interface ShippingDistrict {
    id: number;
    city_code: number;
    name: string;
    extra_cost: number;
    is_remote: boolean;
}

// ==========================================
// PRODUCT TYPES
// ==========================================

export interface Brand {
    id: number;
    name: string;
    tier: string;
    description: string | null;
    // Marka stoktan toplama gerektiriyorsa true — set/paket bütünü tek noktadan
    // çıkamaz, dolayısıyla nakliye alıcıya ait olur (örn. TEKNO).
    requires_separate_shipping?: boolean;
}

export interface Plate {
    id: number;
    brand_id: number;
    category_id: number;
    material_type_id: number;
    name: string;
    short_name: string;
    density: number | null;
    thickness_options: number[];
    base_price_per_cm: number;
    base_price: number;
    package_m2: number;
    discount_1: number;
    discount_2: number;
    is_kdv_included: boolean;
    // Package engine fields — migration v4
    quality_band:        QualityBand | null;
    is_package_eligible: boolean;
    brand_tier:          string | null;
    sales_priority:      number;
}

export interface PlatePrice {
    id: number;
    plate_id: number;
    thickness: number;
    base_price: number;
    is_kdv_included: boolean;
    package_m2?: number;
    discount_1?: number;
    discount_2?: number;
    m2_discounted_price?: number;
    package_discounted_price?: number;
}

export interface AccessoryType {
    id: number;
    name: string;
    slug: string;
    sort_order: number;
    consumption_rate_eps: number;
    consumption_rate_tasyunu: number;
}

export interface Accessory {
    id: number;
    brand_id: number;
    accessory_type_id: number;
    name: string;
    short_name: string;
    unit: string;
    unit_content: number;
    base_price: number;
    is_for_eps: boolean;
    is_for_tasyunu: boolean;
    dowel_length: number | null;
    discount_1: number;
    discount_2: number;
    discount_rate_2: number;
    is_kdv_included: boolean;
    // Package engine fields — migration v4
    package_slot:        PackageSlot | null;
    commercial_mode:     CommercialMode;
    quality_band:        QualityBand | null;
    wizard_visible:      boolean;
    is_package_eligible: boolean;
    brand_tier:          string | null;
    sales_priority:      number;
}

export interface MaterialType {
    id: number;
    name: string;
    slug: string;
    // Marj kuralları (migration v12) — wizard tarafında okunur, admin'den düzenlenir
    min_order_m2: number | null;
    tier1_max_m2: number | null;
    tier1_margin_pct: number | null;
    tier2_max_m2: number | null;
    tier2_margin_pct: number | null;
    tier3_margin_pct: number | null;
    full_vehicle_only: boolean;
    special_order_threshold_m2: number | null;
    special_order_note: string | null;
}

// ==========================================
// PACKAGE TYPES
// ==========================================

export interface PackageDefinition {
    id: number;
    plate_brand_id: number;
    accessory_brand_id: number;
    tier: string;
    name: string;
    description: string;
    badge: string | null;
    sort_order: number;
    warranty_years: number;
}

export interface CalculatedPackageItem {
    name: string;
    shortName: string;
    brandName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    // Wizard specific fields added to global type
    isPlate?: boolean;
    packageCount?: number;
}

export interface CalculatedPackage {
    definition: PackageDefinition;
    plateBrandName: string;
    accessoryBrandName: string;
    items: CalculatedPackageItem[];
    totalProductCost: number;
    shippingCost: number;
    grandTotal: number;
    pricePerM2: number;
    // Hacim-bazlı marj snapshot — sonuç ekranı / PDF okuyabilir
    appliedMarginPct?: number;
    requiresSpecialOrder?: boolean;
    specialOrderNote?: string;
    logistics?: {
        packageCount: number;
        packageSizeM2: number;
        itemsPerPackage: number;
        truckCapacityPackages: number;
        lorryCapacityPackages: number;
        truckFillPercentage: number;
        lorryFillPercentage: number;
        vehicleType: 'none' | 'lorry' | 'truck' | 'multiple';
        lowMetrageSurcharge?: number;
        packagesNeededForOptimal?: number;
        isShippingIncluded?: boolean;
        shippingWarning?: string;
    };
}

// ==========================================
// LOGISTICS TYPES
// ==========================================

export interface LogisticsCapacity {
    thickness: number;
    items_per_package: number;
    package_size_m2: number;
    lorry_capacity_m2: number;
    truck_capacity_m2: number;
    lorry_capacity_packages: number;
    truck_capacity_packages: number;
    is_popular: boolean;
    notes: string | null;
}
