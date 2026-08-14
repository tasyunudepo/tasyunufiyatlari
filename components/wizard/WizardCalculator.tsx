"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { generateQuotePDF } from "@/lib/pdfGenerator";
import { TEL_URL } from "@/lib/business/info";
import { uploadPdfToStorage } from "@/lib/uploadPdfToStorage";
import {
  notifyWizardShowPrices,
  notifyPdfQuoteRequested,
  notifyWhatsappOrderRequested,
  notifyWizardResultCtaClick,
  notifyWizardResultFormOpen,
  notifyWizardResultFormError,
  notifyBonusChallengeShown,
  notifyBonusChallengePicked,
  type WizardResultCtaLocation,
} from "@/lib/notifyWizardEvent";
import { notifyWhatsappIntent } from "@/lib/notifyWhatsappIntent";
import { PackageCard } from "@/components/package/PackageCard";
import { PdfOfferModal } from "@/components/modal/PdfOfferModal";
import { PdfDeliveryCard } from "@/components/quote/PdfDeliveryCard";
import PhoneCallLink from "@/components/shared/PhoneCallLink";
import { WizardStep1 } from "@/components/wizard/WizardStep1";
import { WizardStep2 } from "@/components/wizard/WizardStep2";
import { WizardStep3 } from "@/components/wizard/WizardStep3";
import { citySubRegionQuestion, type BonusSubRegionChoice } from "@/lib/pricing/bonus/subRegions";
import { buildBonusPlateOrder } from "@/lib/pricing/bonus/packageAssembly";
import { buildPlateItemName } from "@/lib/catalog/productLabel";
import {
    getBonusChallengerModel,
    buildBonusChallenge,
    sameConditionLabel,
    type BonusChallengeResult,
} from "@/lib/pricing/comparison/bonusChallenge";
import { WizardStep4 } from "@/components/wizard/WizardStep4";
import {
    getOfferValidityDate,
    getTruckMeterColor,
} from "@/lib/utils/packageHelpers";
import { generateQuoteWhatsAppMessage, buildWhatsAppLink } from "@/lib/utils/whatsapp";
import { technicalConsumptionUnitForSlug } from "@/lib/quote/technicalConsumption";
import { resolveMarginPctStrict } from "@/lib/pricing/margin";
import { resolveAccessoryDiscounts } from "@/lib/pricing/accessoryDiscounts";
import { selectAccessoryForSet } from "@/lib/quote/selectAccessoryForSet";
import {
    buildQuoteSurfacePricing,
} from "@/lib/pricing/quoteTotals";
import {
    isValidFullVehicleArea,
    resolveEpsShippingDecision,
    resolveVehicleTypeFromPackages,
} from "@/lib/pricing/commercialRules";
import { useWizardStore } from "@/lib/store/wizardStore";
import type { PdfOfferFormData } from "@/lib/schemas/pdfOffer.schema";
import type {
    ShippingZone,
    Brand,
    Plate,
    Accessory,
    AccessoryType,
    PackageDefinition,
    MaterialType,
    PlatePrice,
    LogisticsCapacity,
    CalculatedPackage,
    CalculatedPackageItem
} from "@/lib/types";

// Kuruş hassasiyetinde yuvarlama (floating-point hataları önlemek için)
const roundToKurus = (value: number): number => Math.round(value * 100) / 100;

// ─── Bonus meydan okuma kartı durumu (Sprint 1.2) ───────────────────
// Kart, Filli grubu sonucunun altında yalnız hakem kuralları sağlanırsa
// görünür: aynı şehir/yaka/kalınlık/toz grubu, fark gerçek hesaptan ve
// Bonus gerçekten düşükse. İstanbul/Kocaeli'de önce yaka/bölge sorulur.
interface ChallengeContext {
    userNeedM2: number;
    challengerModel: string;
    rivalBrandName: string;
    rivalModel: string;
    currentUnit: number;
    currentOrderM2: number;
    currentTotal: number;
    thicknessCm: number;
    cityCode: number;
}
type BonusChallengeCardState =
    | { status: 'hidden' }
    | { status: 'need_sub'; context: ChallengeContext; options: BonusSubRegionChoice[] }
    | { status: 'ready'; context: ChallengeContext; sub: BonusSubRegionChoice | null; result: BonusChallengeResult };
const formatCurrency = (value: number): string =>
    value.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
const formatM2 = (value: number): string =>
    value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

const getPackageTotalM2 = (pkg: CalculatedPackage): number =>
    pkg.logistics?.packageCount && pkg.logistics?.packageSizeM2
        ? pkg.logistics.packageCount * pkg.logistics.packageSizeM2
        : 0;

const getShippingStatusText = (pkg: CalculatedPackage): string => {
    if (!pkg.logistics) return 'Nakliye koşulu teklif görüşmesinde netleşir';
    if (pkg.logistics.shippingMode === 'separate_quote_required') {
        return 'Nakliye satış görüşmesinde netleşir';
    }
    if (pkg.logistics.shippingMode === 'buyer_pays') return 'Nakliye alıcıya ait';
    return 'Nakliye fiyata dahil';
};

const createResultSessionId = (): string =>
    `wiz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// Kalınlık seçenekleri
export const KALINLIKLAR = [
    { value: "3", label: "3cm" },
    { value: "4", label: "4cm" },
    { value: "5", label: "5cm" },
    { value: "6", label: "6cm" },
    { value: "8", label: "8cm" },
    { value: "10", label: "10cm", popular: true },
];

interface WizardCalculatorProps {
    preSelectedCityName?: string;
}

interface PdfDeliveryState {
    refCode: string;
    pdfUrl: string;
    pdfFilename: string;
    whatsappUrl: string;
    emailUrl: string;
}

export default function WizardCalculator({ preSelectedCityName }: WizardCalculatorProps) {
    // Veritabanından gelen veriler
    const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [plates, setPlates] = useState<Plate[]>([]);
    const [accessories, setAccessories] = useState<Accessory[]>([]);
    const [accessoryTypes, setAccessoryTypes] = useState<AccessoryType[]>([]);
    const [packageDefinitions, setPackageDefinitions] = useState<PackageDefinition[]>([]);
    const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
    const [platePrices, setPlatePrices] = useState<PlatePrice[]>([]);
    const [logisticsCapacity, setLogisticsCapacity] = useState<LogisticsCapacity[]>([]);

    // Kullanıcı seçimleri
    const [selectedCityCode, setSelectedCityCode] = useState<number | null>(null);
    const [citySubRegion, setCitySubRegion] = useState<BonusSubRegionChoice | null>(null);
    // Bonus paket/araç kapasiteleri — /api/bonus-price/capacity yanıtı.
    // Fiyat içermez; metraj adımının tam araç önerileri bununla kurulur.
    const [bonusCapacity, setBonusCapacity] = useState<{
        packageM2: number;
        packagePieces: number;
        kamyonM2: number;
        tirM2: number;
    } | null>(null);
    const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [selectedMalzeme, setSelectedMalzeme] = useState<"tasyunu" | "eps">("tasyunu");
    const [selectedKalinlik, setSelectedKalinlik] = useState("5");
    const [metraj, setMetraj] = useState("");

    // Dynamic Slider State
    const [currentLogistics, setCurrentLogistics] = useState<LogisticsCapacity | null>(null);
    const [, setIsLoadingLogistics] = useState(false);

    // Sonuçlar
    const [calculatedPackages, setCalculatedPackages] = useState<CalculatedPackage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [resultSessionId, setResultSessionId] = useState("");

    // Wizard step
    const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);

    // Bonus'un kamyon/TIR kapasiteleri kendi bölge listesinden gelir;
    // genel logistics_capacity kaydıyla doğrulanamaz. Kapasite sunucudan
    // model+kalınlık ile çekilir ve metraj adımı bu sayılarla çalışır.
    const isBonusSelected = brands.find(b => b.id === selectedBrandId)?.name === 'Bonus';

    useEffect(() => {
        if (!isBonusSelected || !selectedModel || !selectedKalinlik) {
            setBonusCapacity(null);
            return;
        }
        // Marka değişiminin hemen ardından eski markanın modeli bir render
        // boyunca state'te kalabilir; yabancı modelle istek atılmaz.
        const modelBelongsToBrand = plates.some(
            p => p.brand_id === selectedBrandId && p.short_name === selectedModel,
        );
        if (!modelBelongsToBrand) {
            setBonusCapacity(null);
            return;
        }
        let cancelled = false;
        const params = new URLSearchParams({
            model: selectedModel,
            thicknessCm: selectedKalinlik,
        });
        fetch(`/api/bonus-price/capacity?${params.toString()}`)
            .then(res => (res.ok ? res.json() : null))
            .catch(() => null)
            .then(json => {
                if (cancelled) return;
                setBonusCapacity(
                    json?.ok && json.packageM2 > 0 && json.kamyonM2 > 0 && json.tirM2 > 0
                        ? {
                            packageM2: json.packageM2,
                            packagePieces: json.packagePieces ?? 0,
                            kamyonM2: json.kamyonM2,
                            tirM2: json.tirM2,
                        }
                        : null,
                );
            });
        return () => { cancelled = true; };
    }, [isBonusSelected, selectedModel, selectedKalinlik, plates, selectedBrandId]);

    // Kapasiteden LogisticsCapacity türet: Step4 preset'leri, tam araç
    // doğrulaması ve doluluk göstergeleri Bonus'ta bu nesneyle çalışır.
    const bonusLogistics: LogisticsCapacity | null = useMemo(() => {
        if (!isBonusSelected || !bonusCapacity) return null;
        const pkgM2 = bonusCapacity.packageM2;
        return {
            thickness: (parseInt(selectedKalinlik) || 0) * 10,
            items_per_package: bonusCapacity.packagePieces,
            package_size_m2: pkgM2,
            lorry_capacity_m2: bonusCapacity.kamyonM2,
            truck_capacity_m2: bonusCapacity.tirM2,
            lorry_capacity_packages: Math.round(bonusCapacity.kamyonM2 / pkgM2),
            truck_capacity_packages: Math.round(bonusCapacity.tirM2 / pkgM2),
            is_popular: false,
            notes: null,
        };
    }, [isBonusSelected, bonusCapacity, selectedKalinlik]);

    // Bonus butonu yalnız canlıda AKTİF ve seçili malzeme tipine uygun
    // Bonus levhası varken görünür: EPS'te Bonus ürünü yok, marka listesine
    // düşerse akış modelsiz tıkanır (plates zaten is_active=true ile çekilir).
    const activeMaterialTypeIdForBrands = materialTypes.find(m => m.slug === selectedMalzeme)?.id;
    const wizardSelectableBrands = brands.filter(
        b => b.name !== 'Bonus' || plates.some(p =>
            p.brand_id === b.id
            && (activeMaterialTypeIdForBrands == null || p.material_type_id === activeMaterialTypeIdForBrands)
        ),
    );

    // Bonus seçiliyken malzeme EPS'e çevrilirse seçim geçersizleşir;
    // varsayılan markaya (Dalmaçyalı) dön ki akış tıkanmasın.
    useEffect(() => {
        if (!isBonusSelected || activeMaterialTypeIdForBrands == null) return;
        const bonusHasPlatesForMaterial = plates.some(
            p => p.brand_id === selectedBrandId
                && p.material_type_id === activeMaterialTypeIdForBrands,
        );
        if (bonusHasPlatesForMaterial) return;
        const fallback = brands.find(b => b.name === 'Dalmaçyalı')
            ?? brands.find(b => b.name !== 'Bonus');
        setSelectedBrandId(fallback?.id ?? null);
    }, [isBonusSelected, activeMaterialTypeIdForBrands, plates, brands, selectedBrandId]);

    const isCurrentStepValid = (): boolean => {
        switch (activeStep) {
            case 1: return selectedBrandId != null;
            case 2: return !!selectedKalinlik;
            case 3: {
                if (selectedCityCode == null) return false;
                // Bonus'ta İstanbul/Kocaeli fiyatı yaka/bölge seçimine bağlıdır;
                // seçim yapılmadan metraj adımına geçilmez (alert yerine kapı).
                if (isBonusSelected && citySubRegionQuestion(selectedCityCode) && !citySubRegion) return false;
                return true;
            }
            case 4: {
                if (!metraj || Number(metraj) <= 0) return false;
                const m2 = Number(metraj);
                const matType = materialTypes.find(m => m.slug === selectedMalzeme);
                const minOrder = matType?.min_order_m2 ?? 0;
                if (minOrder > 0 && m2 < minOrder) return false;
                const fullVehicleLogistics = isBonusSelected ? bonusLogistics : currentLogistics;
                if (matType?.full_vehicle_only && fullVehicleLogistics
                    && !isValidFullVehicleMetraj(m2, fullVehicleLogistics)) return false;
                return true;
            }
        }
    };

    const goNext = () => {
        if (isCurrentStepValid() && activeStep < 4) setActiveStep(s => (s + 1) as 1 | 2 | 3 | 4);
    };
    const goBack = () => {
        if (activeStep > 1) setActiveStep(s => (s - 1) as 1 | 2 | 3 | 4);
    };

    // Araç tipini ve bölge iskontosunu bilen getSmartAdvice wrapper'ı
    const getSmartAdviceWithDiscount = (
        logistics: CalculatedPackage['logistics'],
    ): string | null => {
        if (!logistics || logistics.vehicleType === 'multiple') return null;
        const activeFill = logistics.vehicleType === 'lorry'
            ? logistics.lorryFillPercentage
            : logistics.truckFillPercentage;
        if (activeFill >= 86) {
            const isLorry = logistics.vehicleType === 'lorry';
            const zone = shippingZones.find(z => z.city_code === selectedCityCode);
            // Bölge kamyon/TIR iskontosu Bonus'un bölge-liste fiyatında yoktur;
            // müşteriye olmayan iskonto vaat edilmez.
            const discPct = isBonusSelected
                ? null
                : isLorry ? (zone?.discount_kamyon ?? null) : (zone?.discount_tir ?? null);
            const vehicleLabel = isLorry ? 'Kamyon' : 'TIR';
            return `✅ Mükemmel — ${vehicleLabel} tam kapasite kullanılıyor, nakliye fiyata dahildir${discPct != null ? ` + %${discPct} iskonto` : ''}!`;
        }
        const packagesNeededForOptimal = logistics.packagesNeededForOptimal ?? 0;
        if (packagesNeededForOptimal > 0) {
            const additionalM2 = (packagesNeededForOptimal * logistics.packageSizeM2).toFixed(1);
            return `💡 Sadece ${packagesNeededForOptimal} paket daha (${additionalM2} m²) eklerseniz araç tam dolacak ve nakliye farkı sıfırlanacak!`;
        }
        return null;
    };

    // Seçili plaka için gerçek paket m²'sini hesapla (Step4 gamification tutarlılığı)
    const effectiveLogistics = useMemo(() => {
        // Bonus: genel lojistik kaydı yerine üreticinin kendi kapasite verisi.
        if (isBonusSelected) return bonusLogistics;
        if (!currentLogistics || !selectedBrandId || !selectedKalinlik) return currentLogistics;
        const activeMaterialTypeId = materialTypes.find(m => m.slug === selectedMalzeme)?.id;
        const plate = (
            plates.find(p =>
                p.brand_id === selectedBrandId &&
                p.thickness_options.includes(parseInt(selectedKalinlik)) &&
                (selectedModel ? p.short_name === selectedModel : true) &&
                p.material_type_id === activeMaterialTypeId
            ) ?? plates.find(p =>
                p.brand_id === selectedBrandId &&
                p.thickness_options.includes(parseInt(selectedKalinlik)) &&
                p.material_type_id === activeMaterialTypeId
            )
        );
        if (!plate) return currentLogistics;
        const platePrice = platePrices.find(pp =>
            pp.plate_id === plate.id && pp.thickness === parseInt(selectedKalinlik)
        );
        const realPkgM2 = platePrice?.package_m2 || plate.package_m2 || currentLogistics.package_size_m2;
        if (!realPkgM2 || realPkgM2 === currentLogistics.package_size_m2) return currentLogistics;
        return {
            ...currentLogistics,
            package_size_m2: realPkgM2,
            lorry_capacity_m2: currentLogistics.lorry_capacity_packages * realPkgM2,
            truck_capacity_m2: currentLogistics.truck_capacity_packages * realPkgM2,
        };
    }, [isBonusSelected, bonusLogistics, currentLogistics, plates, platePrices, selectedBrandId, selectedModel, selectedKalinlik, selectedMalzeme, materialTypes]);

    // Teklif Formu
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [selectedPackageForQuote, setSelectedPackageForQuote] = useState<CalculatedPackage | null>(null);
    const [quoteForm, setQuoteForm] = useState({
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        customerCompany: "",
        customerAddress: "",
        kvkkConsent: false,
    });
    const [quoteFormError, setQuoteFormError] = useState<string | null>(null);
    const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
    const [expandedCards, setExpandedCards] = useState<number[]>([]);

    // PDF Teklif Modal
    const [showPdfOfferModal, setShowPdfOfferModal] = useState(false);
    const [selectedPackageForPdf, setSelectedPackageForPdf] = useState<CalculatedPackage | null>(null);
    const [pdfDelivery, setPdfDelivery] = useState<PdfDeliveryState | null>(null);
    const [isSubmittingPdf, setIsSubmittingPdf] = useState(false);

    // Scroll ref
    const resultsRef = useRef<HTMLDivElement>(null);

    // ============================================================
    // Niyet kartı preset → wizard pre-fill (iki fazlı uygulama)
    //
    // Faz 1 (situationPreset değişiminde):
    //   - material + thicknessCm hemen uygulanır.
    //   - brandName/modelShortName varsa pendingBrandModel state'ine alınır.
    //
    // Faz 2 (pendingBrandModel + brands + availableModels değişiminde):
    //   - Önce brand çözümlenip set edilir → bu re-render tetikler
    //   - Sonra availableModels güncellenince model set edilir, pending temizlenir.
    //
    // Pending state olarak tutulur (ref değil) — useEffect'in deps array'inin
    // pending değişimine reaktif olabilmesi için.
    // ============================================================
    const situationPresetFromStore = useWizardStore((state) => state.situationPreset);
    const [pendingBrandModel, setPendingBrandModel] = useState<{
        brandName?: string;
        modelShortName?: string;
    } | null>(null);
    const previousSelectionRef = useRef({
        brandId: selectedBrandId,
        material: selectedMalzeme,
    });

    // Faz 1: material + thickness anlık uygulama, brand/model'i pending'e al
    useEffect(() => {
        if (!situationPresetFromStore) return;
        setSelectedMalzeme(situationPresetFromStore.material);
        setSelectedKalinlik(String(situationPresetFromStore.thicknessCm));

        if (situationPresetFromStore.brandName || situationPresetFromStore.modelShortName) {
            setPendingBrandModel({
                brandName: situationPresetFromStore.brandName,
                modelShortName: situationPresetFromStore.modelShortName,
            });
        }

        // Preset'i tüket — bir sonraki render'da tekrar uygulanmasın
        useWizardStore.getState().consumeSituationPreset();
    }, [situationPresetFromStore]);

    // (Faz 2 effect'i availableModels declaration'ından SONRA tanımlandı — aşağıda)

    const PRIORITY_CITIES = ["İstanbul", "Kocaeli", "Bolu", "Sakarya", "Düzce", "Tekirdağ", "Yalova", "Bursa", "Balıkesir"];
    const sortShippingZones = (zones: ShippingZone[]) => {
        const priorityMap = new Map(
            PRIORITY_CITIES.map((name, idx) => [name.toLocaleLowerCase("tr-TR"), idx])
        );
        return [...zones].sort((a, b) => {
            const aKey = a.city_name.toLocaleLowerCase("tr-TR");
            const bKey = b.city_name.toLocaleLowerCase("tr-TR");
            const ai = priorityMap.get(aKey);
            const bi = priorityMap.get(bKey);
            if (ai != null && bi != null) return ai - bi;
            if (ai != null) return -1;
            if (bi != null) return 1;
            return a.city_name.localeCompare(b.city_name, "tr-TR");
        });
    };

    // Seçilen marka ve malzeme tipine göre mevcut modeller
    const availableModels = selectedBrandId
        ? Array.from(new Set(
            plates
                .filter(p => {
                    const materialType = materialTypes.find(m => m.id === p.material_type_id);
                    return p.brand_id === selectedBrandId &&
                        materialType?.slug === selectedMalzeme;
                })
                .map(p => p.short_name)
        ))
        : [];

    // Niyet preseti Faz 2: brand + model uygulama
    //
    // Önemli: WizardStep1'de child auto-select useEffect'i var (`!selectedModel`
    // ise availableModels[0]'ı atar). Bu, brand atandığı re-render'da bizim
    // Faz 2'mizden ÖNCE çalışırsa preset model'i ezer (örn. HD150 yerine LD125).
    //
    // Bypass stratejisi: brand atarken AYNI render'da preset model'i de set et.
    // Bir sonraki render'da `!selectedModel` false olduğu için child auto-select
    // skip eder. Faz 2 ikinci kez çalıştığında availableModels'i denetler:
    // preset model brand'de varsa dokunmaz, yoksa null'a çekip child'ın
    // geçerli bir modeli seçmesine izin verir.
    useEffect(() => {
        if (!pendingBrandModel) return;
        if (!brands.length) return;

        // 1) Brand henüz atanmadıysa: brand + (varsa) preset model'i AYNI ANDA set et
        if (pendingBrandModel.brandName) {
            const target = pendingBrandModel.brandName.toLocaleLowerCase('tr-TR');
            const found = brands.find(
                (b) => b.name.toLocaleLowerCase('tr-TR') === target
            );
            if (found && selectedBrandId !== found.id) {
                setSelectedBrandId(found.id);
                if (pendingBrandModel.modelShortName) {
                    // Child auto-select'i bypass etmek için pre-emptively model'i ata.
                    // Geçerli kombinasyon ise (Expert+HD150) sonraki render'da öyle kalır.
                    // Geçersizse aşağıdaki dal availableModels yenilenince null'a çeker.
                    setSelectedModel(pendingBrandModel.modelShortName);
                }
                return; // bir sonraki render'da doğrulama dalına gir
            }
        }

        // 2) Brand atandı — availableModels güncel; preset model'i doğrula
        if (pendingBrandModel.modelShortName && availableModels.length) {
            if (!availableModels.includes(pendingBrandModel.modelShortName)) {
                // Preset model bu brand'de yok — null'a çek, child auto-select
                // (filtered[0]) uygun modeli yerleştirsin
                setSelectedModel(null);
            }
            // Listede varsa zaten 1. dalda set edildi, dokunma
        }

        // Tüm faz işlendi — pending'i temizle
        setPendingBrandModel(null);
    // Bilinçli kısmi bağımlılık: efekt pendingBrandModel fazı işlerken dizi
    // referansları yerine length imzaları yeterli; tam diziler döngü tetikler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingBrandModel, brands.length, selectedBrandId, availableModels.length]);

    // Sayfa yüklendiğinde verileri çek
    useEffect(() => {
        async function fetchData() {
            const [
                zonesRes,
                brandsRes,
                platesRes,
                accessoriesRes,
                accessoryTypesRes,
                packagesRes,
                materialTypesRes,
                platePricesRes,
                logisticsRes
            ] = await Promise.all([
                supabase.from("shipping_zones").select("*").order("city_name"),
                supabase.from("brands").select("*"),
                supabase.from("plates").select("*").eq("is_active", true),
                // Sıra önemli: paket motoru her aksesuar tipinde İLK eşleşen
                // ürünü seçer; id sırası orijinal set ürünlerini önceler
                // (örn. TEKNOİZOFİX id 77, sonradan eklenen Chelfix 165+).
                supabase.from("accessories").select("*").eq("is_active", true).order("id"),
                supabase.from("accessory_types").select("*").order("sort_order"),
                supabase.from("package_definitions").select("*").eq("is_active", true).order("sort_order"),
                supabase.from("material_types").select("*"),
                supabase.from("plate_prices").select("*"),
                supabase.from("logistics_capacity").select("*").order("thickness"),
            ]);

            if (zonesRes.data) setShippingZones(sortShippingZones(zonesRes.data));
            if (brandsRes.data) setBrands(brandsRes.data);
            if (platesRes.data) setPlates(platesRes.data);
            if (accessoriesRes.data) setAccessories(accessoriesRes.data);
            if (accessoryTypesRes.data) setAccessoryTypes(accessoryTypesRes.data);
            if (packagesRes.data) setPackageDefinitions(packagesRes.data);
            if (materialTypesRes.data) setMaterialTypes(materialTypesRes.data);
            if (platePricesRes.data) setPlatePrices(platePricesRes.data);
            if (logisticsRes.data) setLogisticsCapacity(logisticsRes.data);

            if (brandsRes.data) {
                // Varsayılan marka Bonus (Emrah, 14 Temmuz 2026); Bonus aktif
                // değilse Dalmaçyalı. Yalnız henüz seçim yokken atanır; koşulsuz
                // atama, PDP prefill'inin (situationPreset) seçtiği markayı
                // geç gelen fetch'in ezmesine yol açıyordu. Bonus'un aktif
                // levhası yoksa malzeme-uyum effect'i Dalmaçyalı'ya düşürür.
                const defaultBrand = brandsRes.data.find((b: Brand) => b.name === 'Bonus')
                    ?? brandsRes.data.find((b: Brand) => b.name === 'Dalmaçyalı');
                if (defaultBrand) setSelectedBrandId(prev => prev ?? defaultBrand.id);
            }
        }
        fetchData();
    // Yalnız ilk yüklemede koşar; sortShippingZones saf yardımcı, bağımlılığa gerek yok.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Otomatik şehir seçimi: URL'den gelen şehir varsa onu kullan,
    // yoksa varsayılan İstanbul. Kullanıcı manuel seçtikten sonra dokunma.
    useEffect(() => {
        if (shippingZones.length === 0 || selectedCityCode != null) return;
        const target = preSelectedCityName ?? 'İstanbul';
        const matchedZone = shippingZones.find(
            z => z.city_name.toLowerCase() === target.toLowerCase()
        );
        if (matchedZone) {
            setSelectedCityCode(matchedZone.city_code);
        }
    }, [preSelectedCityName, shippingZones, selectedCityCode]);

    // Marka veya Malzeme tipi gerçekten değiştiğinde model seçimini sıfırla.
    // ÖNEMLİ: pendingBrandModel temizlenirken bu effect tekrar çalışır; o an
    // brand/material değişmemişse modeli null'a çekmemeliyiz, yoksa child
    // auto-select preset model'i ezer (örn. HD150 yerine LD125 atar).
    useEffect(() => {
        const previous = previousSelectionRef.current;
        const brandChanged = previous.brandId !== selectedBrandId;
        const materialChanged = previous.material !== selectedMalzeme;

        previousSelectionRef.current = {
            brandId: selectedBrandId,
            material: selectedMalzeme,
        };

        if (!brandChanged && !materialChanged) return;
        if (pendingBrandModel) return;
        setSelectedModel(null);
    }, [selectedBrandId, selectedMalzeme, pendingBrandModel]);

    // Kalınlık değiştiğinde lojistik verisini yükle
    useEffect(() => {
        if (!selectedKalinlik) {
            setCurrentLogistics(null);
            return;
        }

        setIsLoadingLogistics(true);
        const thicknessMm = parseInt(selectedKalinlik) * 10;
        const logistics = logisticsCapacity.find(lc => lc.thickness === thicknessMm);

        if (logistics) {
            setCurrentLogistics(logistics);
        } else {
            setCurrentLogistics(null);
        }

        setIsLoadingLogistics(false);
    }, [selectedKalinlik, logisticsCapacity]);


    const handleCityChange = (cityCode: number) => {
        setSelectedCityCode(cityCode);
        // Alt-bölge seçimi şehre bağlıdır; şehir değişince sıfırlanır
        // (İstanbul: Avrupa/Anadolu yakası, Kocaeli: Gebze/diğer).
        setCitySubRegion(null);
    };

    const isStepValid = (): boolean => {
        return !!(
            selectedBrandId &&
            selectedKalinlik &&
            metraj &&
            Number(metraj) > 0 &&
            selectedCityCode &&
            metrajValidation.isValid
        );
    };

    const getSelectedCity = (): ShippingZone | undefined => {
        return shippingZones.find((z) => z.city_code === selectedCityCode);
    };

    const buildPdfData = (pkg: CalculatedPackage, customer: PdfOfferFormData, externalRefCode?: string) => {
        const cityName =
            (selectedCityCode
                ? shippingZones.find(z => z.city_code === selectedCityCode)?.city_name
                : undefined) || "";

        const refCode = externalRefCode || `TY${Date.now().toString().slice(-7)}`;
        const validityDate = getOfferValidityDate();

        const metrajNumber = Number(metraj) || 0;
        const totalM2 =
            pkg.logistics?.packageCount && pkg.logistics?.packageSizeM2
                ? pkg.logistics.packageCount * pkg.logistics.packageSizeM2
                : (metrajNumber || 1);
        const {
            priceWithoutVat,
            vatAmount,
            totalPrice: grandTotal,
            pricePerM2WithoutVat,
        } = buildQuoteSurfacePricing(
            pkg.totalProductCost || 0,
            pkg.shippingCost || 0,
            totalM2,
        );
        // PDF içine gömülecek WhatsApp linki — müşteri teklif aldıktan sonra
        // sipariş onayı/iletişim için tıklar. Bağlamsal bilgiler içerir.
        const log = pkg.logistics;
        const vehicleLabel = log
            ? log.vehicleType === 'lorry'
                ? '1 Kamyon'
                : log.vehicleType === 'truck'
                    ? '1 TIR'
                    : log.vehicleType === 'multiple'
                        ? 'Kamyon + TIR kombinasyonu'
                        : `${formatM2(metrajNumber)} m²`
            : `${formatM2(metrajNumber)} m²`;
        const waMessage = generateQuoteWhatsAppMessage({
            productName: pkg.definition.name,
            thicknessCm: parseInt(selectedKalinlik) || null,
            metrajM2: metrajNumber,
            vehicleLabel,
            cityName: shippingZones.find(z => z.city_code === selectedCityCode)?.city_name ?? '',
            pricePerM2: pricePerM2WithoutVat,
            totalKdvHaric: priceWithoutVat,
            shippingMessage: pkg.logistics?.shippingMode === 'separate_quote_required'
                ? 'satış görüşmesinde netleşir'
                : pkg.logistics?.isShippingIncluded
                    ? 'fiyata dahil'
                    : 'alıcıya ait',
            refCode,
        });
        const whatsappOrderLink = buildWhatsAppLink(waMessage);

        const materialLabel = selectedMalzeme === "tasyunu" ? "Taşyünü" : "EPS";
        const materialLongName = materialTypes.find(m => m.slug === selectedMalzeme)?.name || materialLabel;

        const itemsForPdf = (pkg.items || []).map((it) => {
            return {
                description: it.name, // Orijinal uzun ismi kullan
                quantity: it.quantity,
                unit: it.unit,
                consumptionRate: it.consumptionRate ?? (it.isPlate ? 1 : 0),
                consumptionUnit: it.consumptionUnit ?? (it.isPlate ? 'm²/m²' : undefined),
                unitPrice: it.unitPrice,
                totalPrice: it.totalPrice,
                isPlate: it.isPlate,
                packageCount: it.packageCount,
            };
        });

        return {
            packageName: pkg.definition.name,
            packageDescription: pkg.definition.description,
            plateBrandName: pkg.plateBrandName,
            accessoryBrandName: pkg.accessoryBrandName,
            metraj: metraj, // Kullanıcının girdiği orijinal değeri koru (örn: "1497.6")
            // PDF tarafında birim ekleyip doğru isimlendireceğiz
            thickness: `${selectedKalinlik}`,
            materialType: selectedMalzeme,
            // plateBrandName zaten "Marka Model" biçimindedir; modeli tekrar
            // eklemek "Bonus F 150 F 150" gibi çift yazıma yol açıyordu.
            systemDescription: `${pkg.plateBrandName} ${materialLabel} ${selectedKalinlik}cm + ${pkg.accessoryBrandName} Toz Grubu`,
            cityName,
            city: customer.city || cityName,
            district: customer.district || "",
            materialLongName,
            grandTotal,
            pricePerM2: pricePerM2WithoutVat,
            totalProductCost: pkg.totalProductCost || 0,
            shippingCost: pkg.shippingCost || 0,
            priceWithoutVat,
            vatAmount,
            packageCount: pkg.logistics?.packageCount,
            vehicleType: pkg.logistics?.vehicleType,
            fillPercentage: pkg.logistics?.truckFillPercentage ?? pkg.logistics?.lorryFillPercentage,
            refCode,
            validityDate,
            whatsappOrderLink,
            customerCompany: customer.customerCompany || "",
            relatedPerson: customer.relatedPerson,
            deliveryAddress: `${customer.deliveryAddress} ${customer.district ? `/ ${customer.district}` : ''} ${customer.city ? `/ ${customer.city}` : ''}`,
            phone: customer.phone,
            email: customer.email || "",
            items: itemsForPdf,
            isShippingIncluded: pkg.logistics?.isShippingIncluded,
            shippingMode: pkg.logistics?.shippingMode,
            shippingWarning: pkg.logistics?.shippingWarning,
            specialOrderNote: pkg.requiresSpecialOrder ? pkg.specialOrderNote : undefined,
        };
    };

    const buildResultEventBase = (pkg: CalculatedPackage) => ({
        package_name: pkg.definition.name,
        package_tier: pkg.definition.tier,
        result_session_id: resultSessionId,
    });

    const trackResultCtaClick = (
        pkg: CalculatedPackage,
        ctaType: 'pdf' | 'whatsapp' | 'phone',
        ctaLocation: WizardResultCtaLocation
    ) => {
        notifyWizardResultCtaClick({
            ...buildResultEventBase(pkg),
            cta_type: ctaType,
            cta_location: ctaLocation,
        });
    };

    const handleOpenPdfOffer = (
        pkg: CalculatedPackage,
        ctaLocation: WizardResultCtaLocation = 'result_card'
    ) => {
        trackResultCtaClick(pkg, 'pdf', ctaLocation);
        notifyWizardResultFormOpen({
            ...buildResultEventBase(pkg),
            form_type: 'pdf',
            cta_location: ctaLocation,
        });
        setSelectedPackageForPdf(pkg);
        setShowPdfOfferModal(true);
    };

    const getSelectedCityName = () => {
        return selectedCityCode
            ? shippingZones.find(z => z.city_code === selectedCityCode)?.city_name
            : "";
    };

    const handleSubmitPdfOffer = async (data: PdfOfferFormData) => {
        if (!selectedPackageForPdf) return;
        setIsSubmittingPdf(true);
        let pdfOfferFailureStage: 'pdf' | 'quote' = 'pdf';
        try {
            const refCode = `TY${Date.now().toString().slice(-7)}`;
            const customerAddress = [data.deliveryAddress, data.district, data.city]
                .filter(Boolean)
                .join(' / ');

            const quotePayload = buildQuotePayload(selectedPackageForPdf, 'pdf_quote', {
                customerName: data.relatedPerson,
                customerEmail: data.email || '',
                customerPhone: data.phone,
                customerCompany: data.customerCompany || '',
                customerAddress,
                cityName: data.city || getSelectedCityName() || '',
                quoteCode: refCode,
                kvkkConsent: data.kvkkConsent,
            });

            // PDF tarayıcıda hazırlanır; private storage yüklemesi ancak
            // teklif kaydı ve server capability'si oluştuktan sonra yapılır.
            const pdfData = buildPdfData(selectedPackageForPdf, data, refCode);
            const pdfResult = await generateQuotePDF(pdfData);

            pdfOfferFailureStage = 'quote';
            const quoteRes = await fetch('/api/quotes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': crypto.randomUUID(),
                },
                body: JSON.stringify(quotePayload),
            });

            let quoteResult: {
                ok?: boolean;
                error?: string;
                quoteId?: string | number;
                pdfUploadCapability?: string;
            };
            try {
                quoteResult = await quoteRes.json() as {
                    ok?: boolean;
                    error?: string;
                    quoteId?: string | number;
                    pdfUploadCapability?: string;
                };
            } catch (_parseErr) {
                console.error('PDF quote save: response JSON parse failed', {
                    status: quoteRes.status,
                });
                throw new Error(`Sunucudan beklenen formatta yanıt alınamadı (HTTP ${quoteRes.status}).`);
            }
            if (!quoteRes.ok || !quoteResult.ok) {
                console.error('PDF quote save failed:', { status: quoteRes.status });
                throw new Error(
                    quoteResult.error
                    || "Teklif kaydı oluşturulamadı."
                );
            }

            if (!quoteResult.quoteId || !quoteResult.pdfUploadCapability) {
                throw new Error('PDF yükleme yetkisi oluşturulamadı.');
            }

            const uploaded = await uploadPdfToStorage(pdfResult.blob, {
                quoteId: quoteResult.quoteId,
                capability: quoteResult.pdfUploadCapability,
                filename: `${refCode}.pdf`,
            });
            if (!uploaded) {
                console.warn('[wizard-pdf] Private arşiv yüklemesi tamamlanamadı; yerel PDF korunuyor.');
            }

            // GA4 event — Pdf_Teklif_Talebi (server-side quote insert zaten oldu)
            const pdfCity = shippingZones.find(z => z.city_code === selectedCityCode);
            const pdfBrand = brands.find(b => b.id === selectedBrandId);
            if (pdfCity && pdfBrand) {
                const pdfPkg = selectedPackageForPdf.logistics;
                const pdfTotalM2 = pdfPkg ? pdfPkg.packageCount * pdfPkg.packageSizeM2 : undefined;
                notifyPdfQuoteRequested({
                    material_type:          selectedMalzeme,
                    brand_name:             pdfBrand.name,
                    model_name:             selectedModel,
                    thickness_cm:           parseInt(selectedKalinlik) || 0,
                    city_code:              pdfCity.city_code,
                    city_name:              pdfCity.city_name,
                    area_m2:                parseFloat(metraj) || 0,
                    total_m2:               pdfTotalM2,
                    package_count:          pdfPkg?.packageCount ?? undefined,
                    selected_package_name:  selectedPackageForPdf.definition.name,
                    selected_package_total: selectedPackageForPdf.grandTotal,
                    selected_per_m2:        selectedPackageForPdf.pricePerM2,
                    customer_type:          data.customerCompany ? 'company' : 'individual',
                    result_session_id:      resultSessionId,
                });
            }

            setShowPdfOfferModal(false);
            setSelectedPackageForPdf(null);
            const emailBody = `Merhaba,\n\n${refCode} referanslı fiyat teklifim hazır. PDF belgesini teklif ekranından indirebilirsiniz.`;
            setPdfDelivery({
                refCode,
                pdfUrl: pdfResult.blobUrl,
                pdfFilename: pdfResult.filename,
                whatsappUrl: pdfData.whatsappOrderLink,
                emailUrl: `mailto:${encodeURIComponent(data.email || '')}?subject=${encodeURIComponent(`Fiyat teklifi ${refCode}`)}&body=${encodeURIComponent(emailBody)}`,
            });
        } catch (error) {
            console.error('PDF teklif akışı tamamlanamadı.');
            notifyWizardResultFormError({
                ...buildResultEventBase(selectedPackageForPdf),
                form_type: 'pdf',
                error_type: 'submit_failed',
            });
            const customerMessage = pdfOfferFailureStage === 'pdf'
                ? 'PDF hazırlanamadı. Lütfen tekrar deneyiniz.'
                : error instanceof Error && error.message
                    ? error.message
                    : 'Teklif kaydı oluşturulamadı. Lütfen tekrar deneyiniz.';
            alert(customerMessage);
        } finally {
            setIsSubmittingPdf(false);
        }
    };

    // Optimix için bölge bazlı iskonto
    const getOptimixDiscount = (isLevha: boolean): number => {
        const selectedCity = getSelectedCity();
        if (isLevha) {
            return selectedCity?.optimix_levha_discount || 16;
        }
        return selectedCity?.optimix_toz_discount || 9;
    };

    // Satış fiyatı hesapla. Marj zorunlu olarak canlı material_types
    // kuralından gelir; eksik kuralda fiyat üretimi fail-closed durur.
    const calculateSalePrice = (
        basePrice: number,
        discount1: number,
        discount2: number,
        brandName: string,
        isLevha: boolean = false,
        isKdvIncluded: boolean = true,
        profitMarginPct: number
    ): number => {
        let isk2 = discount2;

        if (brandName === 'Optimix') {
            if (isLevha && discount2 >= 10) {
                isk2 = getOptimixDiscount(true);
            }
        }

        const kdvHaricListe = isKdvIncluded ? basePrice / 1.20 : basePrice;
        const iskontoluFiyat = kdvHaricListe * (1 - discount1 / 100) * (1 - isk2 / 100);
        const karliKdvHaric = iskontoluFiyat * (1 + profitMarginPct / 100);

        return roundToKurus(karliKdvHaric);
    };

    // Hacim-bazlı marj seçici — material_types kademe alanlarına göre.
    // EPS: tier1_max altı → tier1; tier2_max altı → tier2; üstü → tier3.
    // Taşyünü: tier'lar boş, tier3_margin_pct döner (sabit).
    const selectMarginPct = (
        matType: MaterialType | undefined,
        totalM2: number,
    ): number | null => resolveMarginPctStrict(matType, totalM2);

    // Taşyünü tam-araç kuralı: kullanıcı metrajı yalnızca N×Kamyon + M×TIR
    // kombinasyonlarına denk geliyorsa geçerli. Yalnız kayan nokta sapmasına izin verilir.
    const isValidFullVehicleMetraj = (
        m2: number,
        logistics: LogisticsCapacity | null
    ): boolean => {
        if (!logistics) return true;
        return isValidFullVehicleArea({
            areaM2: m2,
            lorryCapacityM2: logistics.lorry_capacity_m2,
            truckCapacityM2: logistics.truck_capacity_m2,
            packageSizeM2: logistics.package_size_m2 || 1,
        });
    };

    // Hedef metrajın yakınında geçerli tam-araç kombinasyonları üretir
    // (kullanıcıya snap-suggestion butonları için).
    //
    // Kural: TIR öncelikli. Kalan miktar 1 kamyona sığıyorsa +1 kamyon,
    // sığmıyorsa +1 TIR. Hiçbir zaman 1'den fazla kamyon önerilmez.
    // (TIR fiyatı kamyondan düşük → çoklu kamyon yerine her zaman +1 TIR mantıklı.)
    const getValidFullVehicleOptions = (
        m2: number,
        logistics: LogisticsCapacity | null
    ): { m2: number; label: string }[] => {
        if (!logistics) return [];
        const lorry = logistics.lorry_capacity_m2;
        const truck = logistics.truck_capacity_m2;
        if (!lorry || !truck) return [];

        const candidates: { m2: number; label: string }[] = [];

        // Aday A: pure TIR (en az ceil(m2/truck) TIR)
        const fullTirCount = Math.ceil(m2 / truck);
        candidates.push({
            m2: fullTirCount * truck,
            label: `${fullTirCount} TIR`,
        });

        // Aday B: TIR-öncelikli — floor(m2/truck) TIR + (kalan ≤ lorry ? 1 kamyon : +1 TIR)
        const baseTir = Math.floor(m2 / truck);
        const kalan = m2 - baseTir * truck;
        if (baseTir > 0 && kalan > 0 && kalan <= lorry) {
            // Kalan 1 kamyona sığıyor → "X TIR + 1 Kamyon"
            candidates.push({
                m2: baseTir * truck + lorry,
                label: `${baseTir} TIR + 1 Kamyon`,
            });
        } else if (baseTir > 0 && kalan > lorry) {
            // Kalan kamyondan büyük → +1 TIR (zaten Aday A ile aynı; duplicate önlemek için atla)
            // (fullTirCount = baseTir + 1 zaten Aday A'da var)
        }

        // Aday C: pure kamyon (küçük metrajlar için; sadece 1 kamyon mantıklı,
        // TIR'a eşit veya az metrajlarda göster)
        if (lorry <= truck) {
            candidates.push({
                m2: lorry,
                label: `1 Kamyon`,
            });
        }

        // Duplicate'leri kaldır (aynı m2 birden fazla adayda olabilir)
        const seen = new Set<number>();
        const unique = candidates.filter(c => {
            const key = Math.round(c.m2 * 10);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Mesafeye göre sırala, en yakın 3'ünü döndür
        return unique
            .sort((a, b) => Math.abs(a.m2 - m2) - Math.abs(b.m2 - m2))
            .slice(0, 3)
            .sort((a, b) => a.m2 - b.m2);
    };

    // Metraj input validasyonu — Step4 input UI'ı bu nesneyi okur.
    // EPS için: m² < min_order_m2 → kind:'min_order'.
    // Taşyünü için: full_vehicle_only && !isValid → kind:'full_vehicle' + öneri listesi.
    type MetrajValidation =
        | { isValid: true }
        | { isValid: false; kind: 'min_order'; minOrder: number }
        | { isValid: false; kind: 'full_vehicle'; suggestions: { m2: number; label: string }[] };

    const metrajValidation: MetrajValidation = useMemo(() => {
        const m2 = parseFloat(metraj);
        if (!metraj || isNaN(m2) || m2 <= 0) return { isValid: true };
        const matType = materialTypes.find(m => m.slug === selectedMalzeme);
        if (!matType) return { isValid: true };

        const minOrder = matType.min_order_m2 ?? 0;
        if (minOrder > 0 && m2 < minOrder) {
            return { isValid: false, kind: 'min_order', minOrder };
        }
        // Bonus'ta tam araç kuralı kendi kapasite verisiyle doğrulanır;
        // kapasite henüz yüklenmediyse fiyat anındaki sunucu kapısı korur.
        const fullVehicleLogistics = isBonusSelected ? bonusLogistics : currentLogistics;
        if (matType.full_vehicle_only && fullVehicleLogistics
            && !isValidFullVehicleMetraj(m2, fullVehicleLogistics)) {
            return {
                isValid: false,
                kind: 'full_vehicle',
                suggestions: getValidFullVehicleOptions(m2, fullVehicleLogistics),
            };
        }
        return { isValid: true };
    }, [metraj, selectedMalzeme, materialTypes, currentLogistics, isBonusSelected, bonusLogistics]);

    const selectRecommendedPackage = (packages: CalculatedPackage[]) =>
        packages.find(pkg => pkg.definition.name.toLocaleLowerCase('tr-TR').includes('dengeli')) ??
        packages.find(pkg => pkg.definition.tier === 'balanced') ??
        packages[1] ??
        packages[0] ??
        null;

    // Paket tanımındaki toz/aksesuar kalemlerini hesaplar. Bonus dahil TÜM
    // markalar bu ortak kod yolunu kullanır: marj (marginPct) bu fonksiyonda
    // yalnız bir kez uygulanır. Levha fiyatı bu fonksiyona girmez — Bonus levhası
    // sunucudan marjlı gelir ve değiştirilmeden kaleme yazılır.
    const buildAccessoryItemsForDefinition = (
        pkgDef: PackageDefinition,
        totalM2: number,
        marginPct: number,
        plateBrandNameForPricing: string,
    ): { items: CalculatedPackageItem[]; totalCost: number; requiredAccessoriesComplete: boolean } => {
        const selectedCity = shippingZones.find(z => z.city_code === selectedCityCode) ?? null;
        const accBrandName = brands.find(b => b.id === pkgDef.accessory_brand_id)?.name ?? '';
        const pkgAccessories = accessories.filter(acc => acc.brand_id === pkgDef.accessory_brand_id);
        const items: CalculatedPackageItem[] = [];
        let totalCost = 0;
        let requiredAccessoriesComplete = true;

        for (const accType of accessoryTypes) {
            const consumption = selectedMalzeme === 'eps'
                ? accType.consumption_rate_eps
                : accType.consumption_rate_tasyunu;
            if (consumption <= 0) continue;

            const acc = selectAccessoryForSet({
                accessories: pkgAccessories,
                type: accType,
                materialType: selectedMalzeme,
                plateThicknessCm: Number(selectedKalinlik),
            });
            if (!acc) {
                requiredAccessoriesComplete = false;
                continue;
            }

            const totalNeed = totalM2 * consumption;
            const itemQuantity = Math.ceil(totalNeed / acc.unit_content);

            const { isk1: accIsk1, isk2: accIsk2 } = resolveAccessoryDiscounts({
                accessoryBrandName: accBrandName,
                discount1: acc.discount_1,
                discount2: acc.discount_2,
                city: selectedCity,
            });

            const accUnitPrice = calculateSalePrice(
                acc.base_price,
                accIsk1,
                accIsk2,
                plateBrandNameForPricing,
                false,
                acc.is_kdv_included,
                marginPct
            );

            const accTotal = roundToKurus(accUnitPrice * itemQuantity);
            totalCost += accTotal;

            items.push({
                name: acc.name,
                shortName: acc.short_name,
                brandName: accBrandName,
                quantity: itemQuantity,
                unit: acc.unit,
                unitPrice: accUnitPrice,
                totalPrice: accTotal,
                isPlate: false,
                consumptionRate: consumption,
                consumptionUnit: technicalConsumptionUnitForSlug(accType.slug),
            });
        }

        return { items, totalCost, requiredAccessoriesComplete };
    };

    // Bonus harman paketleri (karar 13 revizyonu, 13 Temmuz 2026): levha
    // fiyatı sunucudan gelir (bölge + marka marjı; taban/iskonto istemciye
    // inmez), toz kalemleri paket motorunun ortak kod yolundan hesaplanır.
    // Sonuç, diğer markalarla aynı 3'lü paket kartı düzenidir.
    const handleShowBonusPrices = async () => {
        if (!selectedCityCode || !selectedModel) return;

        if (citySubRegionQuestion(selectedCityCode) && !citySubRegion) {
            alert('Bu il için teslimat bölgesi seçimi gerekli. Lütfen Konum adımından seçim yapın.');
            setActiveStep(3);
            return;
        }

        setIsLoading(true);
        setShowResults(false);
        setCalculatedPackages([]);

        try {
            const m2UserInput = parseFloat(metraj) || 0;
            const params = new URLSearchParams({
                model: selectedModel,
                thicknessCm: selectedKalinlik,
                cityCode: String(selectedCityCode),
            });
            if (citySubRegion) params.set('sub', citySubRegion);

            const res = await fetch(`/api/bonus-price?${params.toString()}`);
            const json = await res.json().catch(() => null);

            if (!res.ok || !json?.ok) {
                const reason = json?.reason as string | undefined;
                if (reason === 'thickness_unavailable') {
                    alert('Bu kalınlık, üreticinin Bonus fiyat listesinde yer almıyor. Farklı bir kalınlık seçin.');
                } else if (reason === 'sub_region_required') {
                    alert('Bu il için teslimat bölgesi seçimi gerekli. Lütfen Konum adımından seçim yapın.');
                    setActiveStep(3);
                } else {
                    alert('Bonus fiyatı şu anda hesaplanamıyor. Lütfen bizimle iletişime geçin.');
                }
                return;
            }

            // Kilitli karar 6 savunma kapısı: Step4 metraji Bonus kapasite
            // verisiyle doğrular; bu, gözden kaçan akışlar için son kontrol.
            if (!isValidFullVehicleArea({
                areaM2: m2UserInput,
                lorryCapacityM2: json.kamyonM2,
                truckCapacityM2: json.tirM2,
                packageSizeM2: json.packageM2 || 1,
            })) {
                const kamyonStr = json.kamyonM2.toLocaleString('tr-TR');
                const tirStr = json.tirM2.toLocaleString('tr-TR');
                alert(`Taşyünü parsiyel taşınamaz. Bonus için metraj tam araç olmalıdır: örn. ${kamyonStr} m² (1 Kamyon), ${tirStr} m² (1 TIR) veya kombinasyonları.`);
                return;
            }

            // Levha kalemi: sunucu fiyatı DEĞİŞTİRİLMEDEN kullanılır
            // (çifte marj kilidi: tests/pricing/bonus-package-assembly.test.ts).
            const order = buildBonusPlateOrder(
                { salePricePerM2: json.salePricePerM2, packageM2: json.packageM2 },
                m2UserInput,
            );
            if (!order) {
                alert('Bonus fiyatı şu anda hesaplanamıyor. Lütfen bizimle iletişime geçin.');
                return;
            }

            const bonusDefs = packageDefinitions
                .filter(pd => pd.plate_brand_id === selectedBrandId)
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
            if (bonusDefs.length === 0) {
                alert('Bonus paket seçenekleri henüz tanımlı değil. Lütfen bizimle iletişime geçin.');
                return;
            }

            const matType = materialTypes.find(m => m.slug === selectedMalzeme);
            const marginPct = selectMarginPct(matType, order.orderM2);
            if (marginPct === null) {
                alert('Fiyat marjı tanımlı olmadığı için teklif oluşturulamıyor. Lütfen satış ekibiyle görüşün.');
                return;
            }

            const specialThreshold = matType?.special_order_threshold_m2 ?? null;
            const requiresSpecialOrder = specialThreshold != null && order.orderM2 >= specialThreshold;
            const specialOrderNote = requiresSpecialOrder ? (matType?.special_order_note ?? null) : null;

            const pkgM2 = json.packageM2 || 1;
            const lorryPkgs = Math.max(1, Math.round(json.kamyonM2 / pkgM2));
            const truckPkgs = Math.max(1, Math.round(json.tirM2 / pkgM2));

            const calculated: CalculatedPackage[] = [];

            for (const pkgDef of bonusDefs) {
                const items: CalculatedPackageItem[] = [{
                    name: buildPlateItemName('Bonus', selectedModel, selectedKalinlik, 'Taşyünü'),
                    shortName: selectedModel,
                    brandName: 'Bonus',
                    quantity: order.orderM2,
                    unit: 'm²',
                    unitPrice: order.unitPricePerM2,
                    totalPrice: order.totalExVat,
                    isPlate: true,
                    packageCount: order.packageCount,
                    consumptionRate: 1,
                    consumptionUnit: 'm²/m²',
                }];
                let totalProductCost = order.totalExVat;

                const accResult = buildAccessoryItemsForDefinition(pkgDef, order.orderM2, marginPct, 'Bonus');
                items.push(...accResult.items);
                totalProductCost = roundToKurus(totalProductCost + accResult.totalCost);

                // Bölge fiyatı nakliye bölgesine göredir; tam araçta nakliye
                // satış fiyatına dahildir (kilitli karar 3) → ayrı nakliye 0.
                // Karar (2026-07-25): TEKNO dahil tüm aksesuar markalarında nakliye
                // her metrajda satış fiyatına dahildir; "ayrı teyit / satış
                // görüşmesinde netleşir" uyarısı kaldırıldı.
                const accBrand = brands.find(b => b.id === pkgDef.accessory_brand_id);
                const shippingMode = 'included_in_sale_price' as const;
                const shippingWarning = undefined;

                calculated.push({
                    definition: pkgDef,
                    plateBrandName: `Bonus ${selectedModel}`,
                    accessoryBrandName: accBrand?.name || '',
                    items,
                    totalProductCost,
                    shippingCost: 0,
                    grandTotal: totalProductCost,
                    pricePerM2: roundToKurus(totalProductCost / order.orderM2),
                    appliedMarginPct: marginPct,
                    requiresSpecialOrder,
                    specialOrderNote: specialOrderNote ?? undefined,
                    logistics: {
                        packageCount: order.packageCount,
                        packageSizeM2: pkgM2,
                        itemsPerPackage: json.packagePieces ?? 0,
                        truckCapacityPackages: truckPkgs,
                        lorryCapacityPackages: lorryPkgs,
                        truckFillPercentage: Math.min((order.packageCount / truckPkgs) * 100, 100),
                        lorryFillPercentage: Math.min((order.packageCount / lorryPkgs) * 100, 100),
                        vehicleType: resolveVehicleTypeFromPackages({
                            packageCount: order.packageCount,
                            lorryCapacityPackages: lorryPkgs,
                            truckCapacityPackages: truckPkgs,
                        }),
                        isShippingIncluded: true,
                        shippingMode,
                        shippingWarning,
                    }
                });
            }

            const cityName = shippingZones.find(z => z.city_code === selectedCityCode)?.city_name ?? '';

            setCalculatedPackages(calculated);
            setShowResults(true);

            const nextResultSessionId = createResultSessionId();
            setResultSessionId(nextResultSessionId);
            const cheapest = calculated.reduce((min, p) => p.grandTotal < min.grandTotal ? p : min, calculated[0]);
            const recommended = selectRecommendedPackage(calculated);
            notifyWizardShowPrices({
                material_type: selectedMalzeme,
                brand_name: 'Bonus',
                model_name: selectedModel,
                thickness_cm: parseInt(selectedKalinlik) || 0,
                city_code: selectedCityCode,
                city_name: cityName,
                area_m2: m2UserInput,
                total_m2: order.orderM2,
                package_count: order.packageCount,
                results_count: calculated.length,
                cheapest_total: cheapest?.grandTotal ?? null,
                cheapest_per_m2: cheapest?.pricePerM2 ?? null,
                special_order_required: requiresSpecialOrder,
                recommended_package_name: recommended?.definition.name ?? null,
                result_session_id: nextResultSessionId,
            });

            setTimeout(() => {
                resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Bonus meydan okuma (Sprint 1.2) ─────────────────────────────
    const [bonusChallenge, setBonusChallenge] = useState<BonusChallengeCardState>({ status: 'hidden' });
    const [pendingBonusRun, setPendingBonusRun] = useState<string | null>(null);
    const challengeRunRef = useRef(0);

    const finalizeBonusChallenge = async (context: ChallengeContext, sub: BonusSubRegionChoice | null) => {
        const runId = ++challengeRunRef.current;
        try {
            const params = new URLSearchParams({
                model: context.challengerModel,
                thicknessCm: String(context.thicknessCm),
                cityCode: String(context.cityCode),
            });
            if (sub) params.set('sub', sub);
            const res = await fetch(`/api/bonus-price?${params.toString()}`);
            const json = await res.json().catch(() => null);
            if (challengeRunRef.current !== runId) return;
            if (!res.ok || !json?.ok || !(json.packageM2 > 0)) {
                setBonusChallenge({ status: 'hidden' });
                return;
            }

            // Bonus tarafının siparişi: müşterinin ihtiyacını karşılayan en
            // küçük Bonus tam araç kombinasyonu (kendi kapasiteleriyle).
            const pkgM2 = json.packageM2;
            const bonusLog: LogisticsCapacity = {
                thickness: context.thicknessCm * 10,
                items_per_package: json.packagePieces ?? 0,
                package_size_m2: pkgM2,
                lorry_capacity_m2: json.kamyonM2,
                truck_capacity_m2: json.tirM2,
                lorry_capacity_packages: Math.max(1, Math.round(json.kamyonM2 / pkgM2)),
                truck_capacity_packages: Math.max(1, Math.round(json.tirM2 / pkgM2)),
                is_popular: false,
                notes: null,
            };
            const coveringOptions = getValidFullVehicleOptions(context.userNeedM2, bonusLog)
                .filter(o => o.m2 >= context.userNeedM2 - 0.05);
            const targetM2 = coveringOptions.length
                ? Math.min(...coveringOptions.map(o => o.m2))
                : bonusLog.lorry_capacity_m2;
            const order = buildBonusPlateOrder(
                { salePricePerM2: json.salePricePerM2, packageM2: pkgM2 },
                targetM2,
            );
            const matType = materialTypes.find(m => m.slug === 'tasyunu');
            const marginPct = order ? selectMarginPct(matType, order.orderM2) : null;
            const bonusBrand = brands.find(b => b.name === 'Bonus');
            const bonusDef = bonusBrand
                ? packageDefinitions.find(pd =>
                    pd.plate_brand_id === bonusBrand.id &&
                    brands.find(b => b.id === pd.accessory_brand_id)?.name === 'Optimix')
                : null;
            if (!order || marginPct === null || !bonusDef) {
                setBonusChallenge({ status: 'hidden' });
                return;
            }

            const acc = buildAccessoryItemsForDefinition(bonusDef, order.orderM2, marginPct, 'Bonus');
            const bonusTotal = roundToKurus(order.totalExVat + acc.totalCost);
            const bonusUnit = roundToKurus(bonusTotal / order.orderM2);

            const result = buildBonusChallenge(
                {
                    pricePerM2ExVat: context.currentUnit,
                    orderM2: context.currentOrderM2,
                    totalExVat: context.currentTotal,
                    thicknessCm: context.thicknessCm,
                    cityCode: context.cityCode,
                    subChoice: sub,
                    accessoryBrandName: 'Optimix',
                },
                {
                    pricePerM2ExVat: bonusUnit,
                    orderM2: order.orderM2,
                    totalExVat: bonusTotal,
                    thicknessCm: context.thicknessCm,
                    cityCode: context.cityCode,
                    subChoice: sub,
                    accessoryBrandName: 'Optimix',
                },
            );
            if (challengeRunRef.current !== runId) return;
            if (!result) {
                setBonusChallenge({ status: 'hidden' });
                return;
            }
            setBonusChallenge({ status: 'ready', context, sub, result });
            notifyBonusChallengeShown({
                surface: 'wizard_result',
                rakip_marka: context.rivalBrandName,
                rakip_model: context.rivalModel,
                bonus_model: context.challengerModel,
                unit_diff_tl: result.unitDiffTL,
                city_code: context.cityCode,
                thickness_cm: context.thicknessCm,
                result_session_id: resultSessionId || null,
            });
        } catch {
            if (challengeRunRef.current === runId) setBonusChallenge({ status: 'hidden' });
        }
    };

    const prepareBonusChallenge = (calculated: CalculatedPackage[], userNeedM2: number) => {
        setBonusChallenge({ status: 'hidden' });
        if (selectedMalzeme !== 'tasyunu') return;
        const rival = brands.find(b => b.id === selectedBrandId);
        if (!rival || rival.name === 'Bonus' || !selectedModel || !selectedCityCode) return;
        const challengerModel = getBonusChallengerModel(selectedModel);
        if (!challengerModel) return;
        // Aynı toz grubu şartı: kıyas iki tarafta da Optimix tozlu paketle.
        const currentPkg = calculated.find(p => p.accessoryBrandName === 'Optimix');
        if (!currentPkg?.logistics) return;
        const context: ChallengeContext = {
            userNeedM2,
            challengerModel,
            rivalBrandName: rival.name,
            rivalModel: selectedModel,
            currentUnit: currentPkg.pricePerM2,
            currentOrderM2: roundToKurus(currentPkg.logistics.packageCount * currentPkg.logistics.packageSizeM2),
            currentTotal: currentPkg.grandTotal,
            thicknessCm: parseInt(selectedKalinlik) || 0,
            cityCode: selectedCityCode,
        };
        const subInfo = citySubRegionQuestion(selectedCityCode);
        if (subInfo) {
            setBonusChallenge({
                status: 'need_sub',
                context,
                options: Object.keys(subInfo.options) as BonusSubRegionChoice[],
            });
            return;
        }
        void finalizeBonusChallenge(context, null);
    };

    // "Bonus ile hesapla": mevcut prefill hattını (pendingBrandModel) kullanır;
    // metraj Bonus'un kendi tam araç siparişine çekilir, yaka seçimi taşınır.
    const handleChallengePick = () => {
        if (bonusChallenge.status !== 'ready') return;
        notifyBonusChallengePicked({
            surface: 'wizard_result',
            rakip_marka: bonusChallenge.context.rivalBrandName,
            rakip_model: bonusChallenge.context.rivalModel,
            bonus_model: bonusChallenge.context.challengerModel,
            unit_diff_tl: bonusChallenge.result.unitDiffTL,
            city_code: bonusChallenge.context.cityCode,
            thickness_cm: bonusChallenge.context.thicknessCm,
            result_session_id: resultSessionId || null,
        });
        if (bonusChallenge.sub) setCitySubRegion(bonusChallenge.sub);
        setMetraj(String(bonusChallenge.result.bonusOrderM2));
        setPendingBrandModel({
            brandName: 'Bonus',
            modelShortName: bonusChallenge.context.challengerModel,
        });
        setPendingBonusRun(bonusChallenge.context.challengerModel);
    };

    useEffect(() => {
        if (!pendingBonusRun) return;
        if (pendingBrandModel) return; // marka/model henüz uygulanmadı
        if (!isBonusSelected || selectedModel !== pendingBonusRun) return;
        setPendingBonusRun(null);
        void handleShowPrices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingBonusRun, pendingBrandModel, isBonusSelected, selectedModel]);

    // Fiyatları Göster
    const handleShowPrices = async () => {
        setBonusChallenge({ status: 'hidden' });
        challengeRunRef.current++;
        const brandForFlow = brands.find(b => b.id === selectedBrandId);
        if (brandForFlow?.name === 'Bonus') {
            await handleShowBonusPrices();
            return;
        }

        setIsLoading(true);
        setShowResults(false);
        await new Promise(resolve => setTimeout(resolve, 600));

        if (!selectedBrandId || !selectedCityCode) return;

        const selectedBrand = brands.find(b => b.id === selectedBrandId);
        const selectedCity = shippingZones.find(z => z.city_code === selectedCityCode);
        const logistics = currentLogistics;

        if (!selectedBrand || !selectedCity || !logistics) return;

        const m2UserInput = parseFloat(metraj) || 1;
        const activeMaterialTypeId = materialTypes.find(m => m.slug === selectedMalzeme)?.id;

        // Defensive validation: Step4 zaten input'u bloklar; bu, gözden kaçan
        // bir akış için son kapı. Hatalı durumda alert + iptal.
        const matTypeForValidation = materialTypes.find(m => m.slug === selectedMalzeme);
        const minOrder = matTypeForValidation?.min_order_m2 ?? 0;
        if (minOrder > 0 && m2UserInput < minOrder) {
            setIsLoading(false);
            alert(`${matTypeForValidation?.name ?? 'Bu ürün'} için minimum sipariş ${minOrder} m².`);
            return;
        }
        if (matTypeForValidation?.full_vehicle_only && !isValidFullVehicleMetraj(m2UserInput, logistics)) {
            setIsLoading(false);
            alert(`Taşyünü parsiyel taşınamaz. Tam Kamyon (${Math.round(logistics.lorry_capacity_m2)} m²) veya tam TIR (${Math.round(logistics.truck_capacity_m2)} m²) ya da bunların kombinasyonu olmalıdır.`);
            return;
        }

        // Adım 1: Önce levhayı (plate) bul ki gerçek paket metrajını (package_m2) bilelim
        let mainPlate = plates.find(p =>
            p.brand_id === selectedBrandId &&
            p.thickness_options.includes(parseInt(selectedKalinlik)) &&
            p.short_name === selectedModel &&
            p.material_type_id === activeMaterialTypeId
        );

        // Fallback plate finding
        if (!mainPlate) {
            mainPlate = plates.find(p =>
                p.brand_id === selectedBrandId &&
                p.thickness_options.includes(parseInt(selectedKalinlik)) &&
                p.material_type_id === activeMaterialTypeId
            );
        }

        if (!mainPlate) {
            setIsLoading(false);
            alert("Seçilen kriterlere uygun ürün bulunamadı.");
            return;
        }

        // Adım 2: Bu ürüne ait fiyat kaydını ve kalınlığa özel paket metrajını bul
        const mainPlatePrice = platePrices.find(pp =>
            pp.plate_id === mainPlate!.id &&
            pp.thickness === parseInt(selectedKalinlik)
        );

        // Gerçek paket metrajı (Öncelik: kalınlığa özel > ürüne özel > lojistik varsayılanı)
        const realPackageM2 = mainPlatePrice?.package_m2 || mainPlate.package_m2 || logistics.package_size_m2 || 1;

        // Adım 3: Gerçek paket metrajına göre adet ve metraj hesapla
        const packageCount = Math.ceil(m2UserInput / realPackageM2);
        const totalM2 = packageCount * realPackageM2;

        // Adım 3a: Hacim-bazlı marj seçimi (EPS için kademe; Taşyünü için sabit tier3)
        const matType = materialTypes.find(m => m.slug === selectedMalzeme);
        const marginPct = selectMarginPct(matType, totalM2);
        if (marginPct === null) {
            setIsLoading(false);
            alert('Fiyat marjı tanımlı olmadığı için teklif oluşturulamıyor. Lütfen satış ekibiyle görüşün.');
            return;
        }

        // Adım 3b: ≥10.000 m² özel teklif kontrolü (sadece Taşyünü için seed'lendi)
        const specialThreshold = matType?.special_order_threshold_m2 ?? null;
        const requiresSpecialOrder = specialThreshold != null && totalM2 >= specialThreshold;
        const specialOrderNote = requiresSpecialOrder ? (matType?.special_order_note ?? null) : null;

        const calculated: CalculatedPackage[] = [];

        for (const pkgDef of packageDefinitions) {
            if (pkgDef.plate_brand_id !== selectedBrandId) continue;

            const items: CalculatedPackageItem[] = [];
            let totalProductCost = 0;
            let requiredAccessoriesComplete = true;

            // Bu paket içindeki levhayı belirle (Genelde seçilen ana levha ile aynı marka olur)
            // Not: Farklı levha markaları için pkgDef içindeki logic genişletilebilir
            const plate = mainPlate;

            if (plate) {
                const platePrice = mainPlatePrice;
                let plateBasePrice = platePrice ? platePrice.base_price : plate.base_price;

                // Fallback: Eğer base_price 0 veya yoksa ve base_price_per_cm varsa, kalınlık ile çarp
                if ((!plateBasePrice || plateBasePrice <= 0) && plate.base_price_per_cm) {
                    plateBasePrice = plate.base_price_per_cm * parseInt(selectedKalinlik);
                }
                const plateIsKdvIncluded = platePrice ? platePrice.is_kdv_included : plate.is_kdv_included;

                const plateBrand = brands.find(b => b.id === plate?.brand_id);
                // EPS için bayi iskontosu (İSK2) %8 fallback (Admin ile aynı)
                const plateDiscount2 = (platePrice?.discount_2 ?? plate.discount_2 ?? (selectedMalzeme === "eps" ? 8 : 0)) as number;

                const plateDiscount1 = (() => {
                    if (!selectedCity) return 0;
                    // Taşyünü kuralı: Kamyon/Tır dolmasa bile Tır fiyatı (İskontosu) verilsin ancak nakliye hariç olsun.
                    if (selectedMalzeme === 'tasyunu' && logistics && packageCount < logistics.lorry_capacity_packages) {
                        return selectedCity.discount_tir || 0;
                    }
                    if (logistics && packageCount >= logistics.truck_capacity_packages) return selectedCity.discount_tir || 0;
                    return selectedCity.discount_kamyon || 0;
                })();

                let effectivePlateDiscount1 = plateDiscount1;
                if (selectedMalzeme === "eps" && selectedCity) {
                    // Admin panelindeki logic ile sync: null ise %9 varsay
                    const cityIsk1 = selectedCity.eps_toz_region_discount ?? 9;
                    if (cityIsk1 > 0 && (plateBrand?.name === "Dalmaçyalı" || plateBrand?.name === "Expert" || plateBrand?.name === "Optimix")) {
                        effectivePlateDiscount1 = cityIsk1;
                    }
                }

                const platePackagePrice = calculateSalePrice(
                    plateBasePrice,
                    effectivePlateDiscount1,
                    plateDiscount2,
                    plateBrand?.name || '',
                    true,
                    plateIsKdvIncluded,
                    marginPct
                );

                // Paket fiyatını m² fiyatına çevir (Hata payı bırakmamak için tekrar realPackageM2 kullanıyoruz)
                const plateM2Price = roundToKurus(platePackagePrice / realPackageM2);

                const plateTotal = roundToKurus(plateM2Price * totalM2);
                totalProductCost += plateTotal;

                const materialSuffix = selectedMalzeme === "tasyunu" ? "Taşyünü" : "EPS";

                items.push({
                    // Marka, short_name içinde zaten geçiyorsa tekrar edilmez —
                    // "Optimix Optimix Karbonlu 5 cm EPS" hatası (lib/catalog/productLabel.ts).
                    name: buildPlateItemName(plateBrand?.name, plate.short_name, selectedKalinlik, materialSuffix),
                    shortName: plate.short_name,
                    brandName: plateBrand?.name || '',
                    quantity: totalM2,
                    unit: 'm²',
                    unitPrice: plateM2Price,
                    totalPrice: plateTotal,
                    isPlate: true,
                    packageCount: packageCount,
                    consumptionRate: 1,
                    consumptionUnit: 'm²/m²',
                });
            }

            const accResult = buildAccessoryItemsForDefinition(pkgDef, totalM2, marginPct, selectedBrand.name);
            items.push(...accResult.items);
            totalProductCost += accResult.totalCost;
            requiredAccessoriesComplete = accResult.requiredAccessoriesComplete;

            // Wizard yalnız komple sistem teklifi üretir. Zorunlu toz/aksesuar
            // kalemi eksikse kısmi ürün toplamını kesin teklif gibi göstermeyiz.
            if (selectedMalzeme === 'eps' && !requiredAccessoriesComplete) {
                continue;
            }

            // Tam-araç kuralı aktifken (yeni davranış) parsiyel taşıma kabul edilmediği için
            // step4'ten geçerli metraj zaten doğrulanmış olur — nakliye daima dahil.
            // full_vehicle_only=false (eski davranış) için düşük metrajlı taşyünü uyarısı korunur.
            const fullVehicleOnly = matType?.full_vehicle_only ?? false;
            const isLowMetrageTasyunu = !fullVehicleOnly
                && selectedMalzeme === 'tasyunu'
                && logistics
                && packageCount < logistics.lorry_capacity_packages;

            // Karar (2026-07-25): TEKNO dahil aksesuar markalarında sevkiyat
            // artık "ayrı teyit" yoluna girmez; nakliye kararı normal
            // EPS/taşyünü mantığından üretilir (Tekno her metrajda dahil).
            const epsShippingDecision = selectedMalzeme === 'eps'
                ? resolveEpsShippingDecision({
                    saleMode: 'complete_set',
                    areaM2: totalM2,
                    minimumSetM2: matType?.min_order_m2 ?? 400,
                    requiredAccessoriesComplete,
                    isFullVehicle: false,
                    requiresSeparateShipping: false,
                })
                : null;
            const shippingMode = epsShippingDecision?.mode
                ?? (isLowMetrageTasyunu
                    ? 'buyer_pays'
                    : 'included_in_sale_price');
            const isShippingIncluded = shippingMode === 'included_in_sale_price';
            const shippingWarning = isLowMetrageTasyunu
                ? "Metraj kamyon kapasitesinin altında olduğu için nakliye alıcıya aittir. Ancak fabrikadan en iyi 'Tır İskontosu' fiyatları uygulanmıştır."
                : epsShippingDecision && !epsShippingDecision.isPriceFinal
                    ? epsShippingDecision.customerMessage
                    : undefined;

            calculated.push({
                definition: pkgDef,
                plateBrandName: selectedModel ? `${selectedBrand.name} ${selectedModel}` : selectedBrand.name,
                accessoryBrandName: brands.find(b => b.id === pkgDef.accessory_brand_id)?.name || '',
                items,
                totalProductCost,
                shippingCost: 0,
                grandTotal: totalProductCost,
                pricePerM2: totalProductCost / totalM2,
                appliedMarginPct: marginPct,
                requiresSpecialOrder,
                specialOrderNote: specialOrderNote ?? undefined,
                logistics: {
                    packageCount,
                    packageSizeM2: realPackageM2,
                    itemsPerPackage: logistics.items_per_package,
                    truckCapacityPackages: logistics.truck_capacity_packages,
                    lorryCapacityPackages: logistics.lorry_capacity_packages,
                    truckFillPercentage: Math.min((packageCount / logistics.truck_capacity_packages) * 100, 100),
                    lorryFillPercentage: Math.min((packageCount / logistics.lorry_capacity_packages) * 100, 100),
                    vehicleType: resolveVehicleTypeFromPackages({
                        packageCount,
                        lorryCapacityPackages: logistics.lorry_capacity_packages,
                        truckCapacityPackages: logistics.truck_capacity_packages,
                    }),
                    isShippingIncluded,
                    shippingMode,
                    shippingWarning,
                }
            });
        }

        if (selectedMalzeme === 'eps' && calculated.length === 0) {
            setIsLoading(false);
            alert('Komple EPS setinin zorunlu ürünleri tamamlanmadan teklif oluşturulamıyor. Lütfen satış ekibiyle görüşün.');
            return;
        }

        setCalculatedPackages(calculated);
        setIsLoading(false);
        setShowResults(true);
        const nextResultSessionId = createResultSessionId();
        setResultSessionId(nextResultSessionId);

        // GA4 event — kullanıcı fiyat ekranına ulaştı (Fiyat_Gosterildi)
        // PDF/WhatsApp talep etmeden ayrılırsa "abandoned" lead izlemesi
        const cheapest = calculated.length > 0
            ? calculated.reduce((min, p) => p.grandTotal < min.grandTotal ? p : min, calculated[0])
            : null;
        const recommended = selectRecommendedPackage(calculated);
        notifyWizardShowPrices({
            material_type:          selectedMalzeme,
            brand_name:             selectedBrand.name,
            model_name:             selectedModel,
            thickness_cm:           parseInt(selectedKalinlik) || 0,
            city_code:              selectedCity.city_code,
            city_name:              selectedCity.city_name,
            area_m2:                m2UserInput,
            total_m2:               totalM2,
            package_count:          packageCount,
            results_count:          calculated.length,
            cheapest_total:         cheapest?.grandTotal ?? null,
            cheapest_per_m2:        cheapest?.pricePerM2 ?? null,
            special_order_required: requiresSpecialOrder,
            recommended_package_name: recommended?.definition.name ?? null,
            result_session_id:      nextResultSessionId,
        });

        // Bonus meydan okuma kartı (Sprint 1.2) — sonuçlar ekrana düştükten
        // sonra arka planda hesaplanır; koşullar sağlanmazsa hiç görünmez.
        prepareBonusChallenge(calculated, m2UserInput);

        setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    const handleGetQuote = (
        pkg: CalculatedPackage,
        ctaLocation: WizardResultCtaLocation = 'result_card'
    ) => {
        trackResultCtaClick(pkg, 'whatsapp', ctaLocation);
        notifyWhatsappIntent({
            source: ctaLocation === 'result_card' ? 'wizard_result_card' : 'wizard_result_summary',
            productName: pkg.definition.name,
        });
        notifyWizardResultFormOpen({
            ...buildResultEventBase(pkg),
            form_type: 'whatsapp',
            cta_location: ctaLocation,
        });
        setSelectedPackageForQuote(pkg);
        setShowQuoteModal(true);
    };

    const buildQuotePayload = (
        pkg: CalculatedPackage,
        submissionType: 'whatsapp_order' | 'pdf_quote',
        overrides?: {
            customerName?: string;
            customerEmail?: string;
            customerPhone?: string;
            customerCompany?: string;
            customerAddress?: string;
            cityName?: string;
            quoteCode?: string;
            kvkkConsent?: boolean;
        }
    ) => {
        const selectedBrand = brands.find(b => b.id === selectedBrandId);
        const selectedCity = selectedCityCode
            ? shippingZones.find(z => z.city_code === selectedCityCode)
            : null;

        const billableAreaM2 = pkg.logistics?.packageCount && pkg.logistics?.packageSizeM2
            ? pkg.logistics.packageCount * pkg.logistics.packageSizeM2
            : Number(metraj) || 1;
        const {
            priceWithoutVat,
            vatAmount,
            totalPrice,
            pricePerM2WithoutVat,
        } = buildQuoteSurfacePricing(
            pkg.totalProductCost || 0,
            pkg.shippingCost || 0,
            billableAreaM2,
        );

        return {
            customerName: overrides?.customerName ?? quoteForm.customerName.trim(),
            customerEmail: overrides?.customerEmail ?? quoteForm.customerEmail.trim().toLowerCase(),
            customerPhone: overrides?.customerPhone ?? quoteForm.customerPhone.trim(),
            customerCompany: overrides?.customerCompany ?? quoteForm.customerCompany.trim(),
            customerAddress: overrides?.customerAddress ?? quoteForm.customerAddress.trim(),
            submissionType,
            sourceChannel: 'wizard',
            materialType: selectedMalzeme,
            brandId: selectedBrandId!,
            brandName: selectedBrand?.name || pkg.plateBrandName,
            modelId: null,
            modelName: selectedModel || null,
            thicknessCm: Number(selectedKalinlik),
            areaM2: Number(metraj) || 0,
            cityCode: String(selectedCityCode || ""),
            cityName: overrides?.cityName ?? (selectedCity?.city_name || ""),
            districtCode: null,
            districtName: null,
            packageName: pkg.definition.name,
            packageDescription: pkg.definition.description || null,
            plateBrandName: pkg.plateBrandName,
            accessoryBrandName: pkg.accessoryBrandName,
            totalPrice,
            pricePerM2: pricePerM2WithoutVat,
            shippingCost: roundToKurus(pkg.shippingCost || 0),
            discountPercentage: 0,
            priceWithoutVat,
            vatAmount,
            packageCount: pkg.logistics?.packageCount || 0,
            packageSizeM2: pkg.logistics?.packageSizeM2 || 0,
            itemsPerPackage: pkg.logistics?.itemsPerPackage || 0,
            vehicleType: pkg.logistics?.vehicleType || 'none',
            lorryCapacityPackages: pkg.logistics?.lorryCapacityPackages || null,
            truckCapacityPackages: pkg.logistics?.truckCapacityPackages || null,
            lorryFillPercentage: pkg.logistics?.lorryFillPercentage || null,
            truckFillPercentage: pkg.logistics?.truckFillPercentage || null,
            packageItems: {
                items: pkg.items,
                logistics: pkg.logistics || null,
            },
            quoteCode: overrides?.quoteCode || null,
            kvkkConsent: overrides?.kvkkConsent ?? quoteForm.kvkkConsent,
        };
    };

    const handleSubmitQuote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPackageForQuote) return;

        setQuoteFormError(null);

        if (!quoteForm.kvkkConsent) {
            setQuoteFormError('Devam etmek için KVKK onayı gereklidir.');
            notifyWizardResultFormError({
                ...buildResultEventBase(selectedPackageForQuote),
                form_type: 'whatsapp',
                field_name: 'kvkkConsent',
                error_type: 'missing_consent',
            });
            return;
        }

        setIsSubmittingQuote(true);

        try {
            const refCode = `TY${Date.now().toString().slice(-7)}`;
            const quotePayload = buildQuotePayload(selectedPackageForQuote, 'whatsapp_order', {
                quoteCode: refCode,
            });
            const quoteRes = await fetch('/api/quotes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': crypto.randomUUID(),
                },
                body: JSON.stringify(quotePayload),
            });

            const quoteResult = await quoteRes.json();
            if (!quoteRes.ok || !quoteResult.ok) {
                throw new Error(quoteResult.error || "Teklif kaydı oluşturulamadı.");
            }

            // GA4 event — Whatsapp_Siparis (server-side quote insert zaten oldu)
            const waCity = shippingZones.find(z => z.city_code === selectedCityCode);
            const waBrand = brands.find(b => b.id === selectedBrandId);
            if (waCity && waBrand) {
                const waPkg = selectedPackageForQuote.logistics;
                const waTotalM2 = waPkg ? waPkg.packageCount * waPkg.packageSizeM2 : undefined;
                notifyWhatsappOrderRequested({
                    material_type:          selectedMalzeme,
                    brand_name:             waBrand.name,
                    model_name:             selectedModel,
                    thickness_cm:           parseInt(selectedKalinlik) || 0,
                    city_code:              waCity.city_code,
                    city_name:              waCity.city_name,
                    area_m2:                parseFloat(metraj) || 0,
                    total_m2:               waTotalM2,
                    package_count:          waPkg?.packageCount ?? undefined,
                    selected_package_name:  selectedPackageForQuote.definition.name,
                    selected_package_total: selectedPackageForQuote.grandTotal,
                    selected_per_m2:        selectedPackageForQuote.pricePerM2,
                    result_session_id:      resultSessionId,
                });
            }

            // Araç etiketi — logistics'ten türetilir (sipariş planı özetlenir)
            const log = selectedPackageForQuote.logistics;
            const vehicleLabel = log
                ? log.vehicleType === 'lorry'
                    ? '1 Kamyon'
                    : log.vehicleType === 'truck'
                        ? '1 TIR'
                        : log.vehicleType === 'multiple'
                            ? 'Kamyon + TIR kombinasyonu'
                            : `${formatM2(Number(metraj) || 0)} m²`
                : `${formatM2(Number(metraj) || 0)} m²`;

            const billableAreaM2 = selectedPackageForQuote.logistics?.packageCount
                && selectedPackageForQuote.logistics?.packageSizeM2
                ? selectedPackageForQuote.logistics.packageCount
                    * selectedPackageForQuote.logistics.packageSizeM2
                : Number(metraj) || 1;
            const surfacePricing = buildQuoteSurfacePricing(
                selectedPackageForQuote.totalProductCost || 0,
                selectedPackageForQuote.shippingCost || 0,
                billableAreaM2,
            );
            const message = generateQuoteWhatsAppMessage({
                productName: selectedPackageForQuote.definition.name,
                thicknessCm: parseInt(selectedKalinlik) || null,
                metrajM2: Number(metraj) || 0,
                vehicleLabel,
                cityName: selectedCityCode ? shippingZones.find(z => z.city_code === selectedCityCode)?.city_name || "" : "",
                pricePerM2: surfacePricing.pricePerM2WithoutVat,
                totalKdvHaric: surfacePricing.priceWithoutVat,
                shippingMessage: selectedPackageForQuote.logistics?.shippingMode === 'separate_quote_required'
                    ? 'satış görüşmesinde netleşir'
                    : selectedPackageForQuote.logistics?.isShippingIncluded
                        ? 'fiyata dahil'
                        : 'alıcıya ait',
                refCode,
            });

            const whatsappUrl = buildWhatsAppLink(message);
            window.open(whatsappUrl, '_blank');

            setShowQuoteModal(false);
            setQuoteForm({
                customerName: "",
                customerEmail: "",
                customerPhone: "",
                customerCompany: "",
                customerAddress: "",
                kvkkConsent: false,
            });
            setSelectedPackageForQuote(null);

        } catch {
            console.error('WhatsApp teklif akışı tamamlanamadı.');
            notifyWizardResultFormError({
                ...buildResultEventBase(selectedPackageForQuote),
                form_type: 'whatsapp',
                error_type: 'submit_failed',
            });
            alert("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyiniz.");
        } finally {
            setIsSubmittingQuote(false);
        }
    };

    const recommendedPackage = selectRecommendedPackage(calculatedPackages);
    const recommendedTotalM2 = recommendedPackage ? getPackageTotalM2(recommendedPackage) : 0;
    const recommendedPackageCount = recommendedPackage?.logistics?.packageCount ?? 0;
    const recommendedShippingStatus = recommendedPackage ? getShippingStatusText(recommendedPackage) : '';
    const recommendedM2PriceWithVat = recommendedPackage ? recommendedPackage.pricePerM2 * 1.2 : 0;
    const recommendedM2PriceWithoutVat = recommendedPackage ? recommendedPackage.pricePerM2 : 0;
    const recommendedShippingMode = recommendedPackage?.logistics?.shippingMode;
    const recommendedM2Label = recommendedShippingMode === 'included_in_sale_price'
        ? 'KDV ve nakliye dahil m² maliyeti'
        : recommendedShippingMode === 'separate_quote_required'
            ? 'KDV dahil ürün m² maliyeti · nakliye teyitli'
            : 'KDV dahil m² maliyeti · nakliye hariç';
    const resultPanelTexture = selectedMalzeme === 'eps'
        ? '/images/ikonlar/EPS Levha.webp'
        : '/images/ikonlar/tas-yunu-levha.webp';

    return (
        <div className="flex flex-col bg-fe-bg">
            {/* WIZARD */}
            <section
                className="relative bg-cover bg-center py-10 lg:py-14"
                style={{
                    backgroundImage: `linear-gradient(to right, rgba(11, 11, 12, 0.97), rgba(11, 11, 12, 0.88)), url('/images/bina-dis-cephe-mantolama.webp')`,
                }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-8 lg:gap-12 items-start">
                        {/* Sol Taraf — proof / önizleme modülü (hero'nun delili) */}
                        <div className="text-white">
                            <div className="eyebrow text-hub-gold-soft mb-3">Canlı Hesap Önizlemesi</div>
                            <h3 className="font-heading text-base sm:text-lg font-semibold leading-snug mb-2 tracking-tight text-white/90">
                                <span className="hidden lg:inline">Sağdaki</span>
                                <span className="lg:hidden">Aşağıdaki</span>{' '}
                                formu deneyin — paket, nakliye ve iskonto eş zamanlı işler.
                            </h3>
                            <p className="text-fe-text/75 text-sm leading-relaxed mb-5 max-w-md">
                                8 kalemli komple set + 3 paket alternatifi + bölge iskontosu, tek formdan PDF teklife.
                            </p>

                            {/* Mini stat strip (eski hero altından taşındı) */}
                            <div className="grid grid-cols-3 gap-3 sm:gap-5 mb-6 border-y border-white/10 py-5">
                                {[
                                    { value: 'Tam', label: 'Araç sevkiyatı' },
                                    { value: '8',  label: 'Kalem set' },
                                    { value: '3',  label: 'Paket seçeneği' },
                                ].map((s) => (
                                    <div key={s.label}>
                                        <div className="font-heading font-bold text-white text-2xl sm:text-3xl tracking-tight leading-none">
                                            {s.value}
                                        </div>
                                        <div className="text-[10.5px] sm:text-xs text-fe-text/65 mt-1.5 uppercase tracking-[0.14em]">
                                            {s.label}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-white/[0.06] backdrop-blur rounded-xl p-4 border border-white/10">
                                <h3 className="font-heading text-xs font-semibold mb-3 text-hub-gold-soft uppercase tracking-[0.14em]">8 Kalem Sete Dahil</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm text-fe-text/90">
                                    <span>✓ Yalıtım Levhası</span>
                                    <span>✓ Yapıştırıcı</span>
                                    <span>✓ Isı Yalıtım Sıvası</span>
                                    <span>✓ Donatı Filesi</span>
                                    <span>✓ Dübel (kalınlığa uygun)</span>
                                    <span>✓ Kaplama Astarı</span>
                                    <span>✓ Mineral Kaplama</span>
                                    <span>✓ Fileli Köşe</span>
                                </div>
                                <p className="text-xs text-fe-text/60 mt-3 leading-relaxed">
                                    Standart sarfiyat değerlerine göre. Paket miktarı metraja göre yukarı yuvarlanır.
                                </p>
                            </div>

                        </div>

                        {/* Sağ Taraf - Wizard (CTA scroll target burası) */}
                        <div
                            id="mantolama-hesaplayici"
                            className="bg-fe-surface/85 backdrop-blur-md border border-hub-gold-soft/25 rounded-2xl p-6 sm:p-8 shadow-[0_24px_60px_-30px_rgba(198,158,84,0.25)] scroll-mt-24"
                        >
                            {/* Hesaplama aracı başlığı — mobilde bilişsel friction azaltma */}
                            <div className="mb-6 sm:mb-7">
                                <h2 className="font-heading font-bold text-white text-xl sm:text-2xl tracking-tight leading-tight">
                                    Mantolama Hesaplama Aracı
                                </h2>
                                <p className="mt-1.5 text-sm text-fe-muted leading-relaxed">
                                    4 adımda paket, fiyat ve nakliye koşulunuz.
                                </p>
                            </div>

                            {/* Step Progress Bar */}
                            {(() => {
                                const stepLabels = ['Malzeme', 'Kalınlık', 'Konum', 'Metraj'];
                                return (
                                    <div className="flex items-center mb-7">
                                        {[1, 2, 3, 4].map((step, i) => (
                                            <div key={step} className="flex items-center flex-1 last:flex-none">
                                                <div className="flex flex-col items-center">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                                                        activeStep === step
                                                            ? 'bg-brand-500 text-[#1a0f08] shadow-lg shadow-brand-500/40'
                                                            : activeStep > step
                                                                ? 'bg-green-600 text-white'
                                                                : 'bg-fe-raised text-fe-muted'
                                                    }`}>
                                                        {activeStep > step ? '✓' : step}
                                                    </div>
                                                    <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                                                        activeStep === step ? 'text-brand-400' : activeStep > step ? 'text-green-500' : 'text-fe-muted'
                                                    }`}>
                                                        {stepLabels[i]}
                                                    </span>
                                                </div>
                                                {i < 3 && (
                                                    <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-all duration-300 ${
                                                        activeStep > step ? 'bg-green-600' : 'bg-fe-raised'
                                                    }`} />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}

                            {/* Step Content — min-h prevents layout shift between steps */}
                            <div className="min-h-[360px]">
                            <AnimatePresence mode="wait">
                                {activeStep === 1 && (
                                    <WizardStep1
                                        key="step1"
                                        selectedMalzeme={selectedMalzeme}
                                        setSelectedMalzeme={setSelectedMalzeme}
                                        selectedBrandId={selectedBrandId}
                                        setSelectedBrandId={setSelectedBrandId}
                                        brands={wizardSelectableBrands}
                                        selectedModel={selectedModel}
                                        setSelectedModel={setSelectedModel}
                                        availableModels={availableModels}
                                    />
                                )}
                                {activeStep === 2 && (
                                    <WizardStep2
                                        key="step2"
                                        selectedKalinlik={selectedKalinlik}
                                        setSelectedKalinlik={setSelectedKalinlik}
                                    />
                                )}
                                {activeStep === 3 && (
                                    <WizardStep3
                                        key="step3"
                                        shippingZones={shippingZones}
                                        selectedCityCode={selectedCityCode}
                                        onCityChange={handleCityChange}
                                        citySubRegion={citySubRegion}
                                        onCitySubRegionChange={setCitySubRegion}
                                    />
                                )}
                                {activeStep === 4 && (
                                    <WizardStep4
                                        key="step4"
                                        metraj={metraj}
                                        setMetraj={setMetraj}
                                        currentLogistics={effectiveLogistics}
                                        selectedKalinlik={selectedKalinlik}
                                        shippingZones={shippingZones}
                                        selectedCityCode={selectedCityCode}
                                        selectedMalzeme={selectedMalzeme}
                                        validation={metrajValidation}
                                        suppressZoneDiscounts={isBonusSelected}
                                    />
                                )}
                            </AnimatePresence>
                            </div>

                            {/* Navigation */}
                            <div className="mt-6 flex gap-3">
                                {activeStep > 1 && (
                                    <button
                                        onClick={goBack}
                                        className="px-5 py-3 rounded-xl border border-fe-border text-fe-text font-semibold text-sm hover:border-fe-muted/50 hover:text-white transition-all"
                                    >
                                        ← Geri
                                    </button>
                                )}
                                {activeStep < 4 ? (
                                    <button
                                        onClick={goNext}
                                        disabled={!isCurrentStepValid()}
                                        className="flex-1 py-3 rounded-xl font-bold text-base text-[#1a0f08] bg-brand-500 hover:bg-brand-400 disabled:bg-fe-raised disabled:text-fe-muted disabled:cursor-not-allowed transition-all"
                                    >
                                        {(['Kalınlık Seçimine Geç', 'Konum Seçimine Geç', 'Metraj Gir'] as const)[activeStep - 1] ?? 'İleri →'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleShowPrices}
                                        disabled={isLoading || !isStepValid()}
                                        className="flex-1 py-5 px-4 rounded-xl font-bold text-xl text-[#1a0f08] bg-brand-500 hover:bg-brand-600 disabled:bg-fe-raised disabled:text-fe-muted disabled:cursor-not-allowed transition-colors"
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                Hesaplanıyor...
                                            </span>
                                        ) : (
                                            "3 Teklifi Karşılaştır"
                                        )}
                                    </button>
                                )}
                            </div>

                            <p className="text-center text-fe-muted text-xs mt-4">
                                Fiyatlar KDV hariçtir. Nakliye, tam araç veya uygun EPS seti koşulu sağlandığında fiyata dahildir.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* RESULTS - PACKAGE CARDS */}
            {showResults && calculatedPackages.length > 0 && (
                <section ref={resultsRef} className="pt-12 pb-28 md:py-12 bg-fe-bg scroll-mt-20">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h3 className="font-heading text-2xl font-bold text-white mb-2 text-center tracking-tight">
                            <span className="font-heading tabular-nums text-brand-500">{Number(metraj).toLocaleString('tr-TR')} m²</span> talep için{' '}
                            {(() => {
                                const pkg0 = calculatedPackages[0];
                                if (pkg0?.logistics?.packageCount && pkg0?.logistics?.packageSizeM2) {
                                    const siparisM2 = (pkg0.logistics.packageCount * pkg0.logistics.packageSizeM2).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                                    return <span className="font-heading tabular-nums text-brand-500">{siparisM2} m²</span>;
                                }
                                return <span className="font-heading tabular-nums text-brand-500">{metraj} m²</span>;
                            })()} sipariş hesaplandı
                        </h3>
                        <p className="text-fe-muted text-center mb-2 text-sm">
                            {(() => {
                                const pkg0 = calculatedPackages[0];
                                if (pkg0?.logistics?.packageCount && pkg0?.logistics?.packageSizeM2) {
                                    return `${pkg0.logistics.packageCount} paket × ${pkg0.logistics.packageSizeM2} m² · sipariş miktarı paket metrajına göre yukarı yuvarlanmıştır`;
                                }
                                return null;
                            })()}
                        </p>
                        <p className="text-fe-muted text-center mb-10 max-w-2xl mx-auto">
                            {shippingZones.find(z => z.city_code === selectedCityCode)?.city_name} bölgesine özel {isBonusSelected ? 'nakliye hesaplanmış' : 'nakliye ve iskonto hesaplanmış'} mantolama seti fiyatlarıdır.
                        </p>

                        {recommendedPackage && (
                            <div className="relative mb-8 overflow-hidden rounded-2xl border border-brand-600/45 bg-fe-surface/95 p-5 shadow-xl shadow-brand-950/20 md:p-6">
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgba(198,158,84,0.16),transparent_28%),linear-gradient(90deg,rgba(255,255,255,0.03),rgba(11,11,12,0.18)_52%,rgba(11,11,12,0.38))]"
                                />
                                <div className="relative grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
                                    <div>
                                        <div className="mb-4 flex items-center gap-3">
                                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-brand-600/35 bg-fe-bg/80 p-2 shadow-inner shadow-black/40">
                                                {/* eslint-disable-next-line @next/next/no-img-element -- küçük ikon/logo, next/image getirisi yok */}
                                                <img
                                                    src={resultPanelTexture}
                                                    alt=""
                                                    aria-hidden="true"
                                                    className="h-full w-full object-contain opacity-90"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="inline-flex items-center rounded-full border border-brand-600/50 bg-brand-900/35 px-3 py-1 text-xs font-bold text-brand-200">
                                                    Önerilen paket: {recommendedPackage.definition.name}
                                                </div>
                                            </div>
                                        </div>
                                        <h4 className="font-heading text-2xl font-bold text-white tracking-tight">
                                            Bu m² fiyatıyla teklif kaydı oluşturun
                                        </h4>
                                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fe-muted">
                                            Bu fiyatla teklif kaydı oluşturun. Satış ekibimiz stok, ödeme ve sevkiyat koşullarını teyit ederek sipariş sürecini netleştirsin.
                                        </p>
                                        {recommendedPackage.logistics?.shippingWarning && (
                                            <p className="mt-3 rounded-xl border border-blue-700/40 bg-blue-900/20 px-3 py-2 text-xs font-medium leading-relaxed text-blue-200">
                                                {recommendedPackage.logistics.shippingWarning}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <div className="rounded-2xl border border-brand-600/45 bg-brand-950/25 p-4">
                                            <div className="text-[11px] font-bold uppercase tracking-wide text-brand-200">
                                                {recommendedM2Label}
                                            </div>
                                            <div className="mt-1 font-heading text-4xl font-bold tabular-nums text-white">
                                                {formatCurrency(recommendedM2PriceWithVat)} ₺/m²
                                            </div>
                                            <div className="mt-1 text-xs text-fe-muted">
                                                KDV hariç: {formatCurrency(recommendedM2PriceWithoutVat)} ₺/m²
                                                {recommendedShippingMode === 'included_in_sale_price' && (
                                                    <span className="font-semibold text-emerald-400"> · ✅ Nakliye dahil</span>
                                                )}
                                                {recommendedShippingMode === 'buyer_pays' && ' · Nakliye alıcıya ait'}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="rounded-xl border border-fe-border bg-fe-bg/70 p-3">
                                                <div className="text-[11px] uppercase tracking-wide text-fe-muted">Toplam</div>
                                                <div className="mt-1 font-heading text-xl font-bold tabular-nums text-white">
                                                    {formatCurrency(recommendedPackage.grandTotal * 1.2)} ₺
                                                </div>
                                                <div className="mt-0.5 text-[11px] text-fe-muted">KDV dahil toplam</div>
                                            </div>
                                            <div className="rounded-xl border border-fe-border bg-fe-bg/70 p-3">
                                                <div className="text-[11px] uppercase tracking-wide text-fe-muted">Sipariş</div>
                                                <div className="mt-1 font-heading text-xl font-bold tabular-nums text-white">
                                                    {recommendedTotalM2 > 0 ? `${formatM2(recommendedTotalM2)} m²` : `${formatM2(Number(metraj) || 0)} m²`}
                                                </div>
                                                <div className="mt-0.5 text-[11px] text-fe-muted">
                                                    {recommendedPackageCount > 0 ? `${recommendedPackageCount} paket` : 'Paket hesabı teklif kaydında görünür'}
                                                </div>
                                            </div>
                                            <div className="rounded-xl border border-fe-border bg-fe-bg/70 p-3">
                                                <div className="text-[11px] uppercase tracking-wide text-fe-muted">KDV</div>
                                                <div className="mt-1 font-semibold text-white">Dahil gösterildi</div>
                                                <div className="mt-0.5 text-[11px] text-fe-muted">
                                                    KDV hariç: {formatCurrency(recommendedPackage.grandTotal)} ₺
                                                </div>
                                            </div>
                                            <div className="rounded-xl border border-fe-border bg-fe-bg/70 p-3">
                                                <div className="text-[11px] uppercase tracking-wide text-fe-muted">Nakliye</div>
                                                <div className="mt-1 font-semibold text-white">{recommendedShippingStatus}</div>
                                                <div className="mt-0.5 text-[11px] text-fe-muted">Koşul teklifte kayıt altına alınır</div>
                                            </div>
                                        </div>

                                        <div className="grid gap-2 sm:grid-cols-3">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenPdfOffer(recommendedPackage, 'result_summary')}
                                                className="rounded-xl bg-brand-500 px-4 py-3 text-sm font-bold text-[#1a0f08] transition-colors hover:bg-brand-400"
                                            >
                                                Teklif kaydı oluştur
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleGetQuote(recommendedPackage, 'result_summary')}
                                                className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-green-500"
                                            >
                                                WhatsApp&apos;tan teyit iste
                                            </button>
                                            <PhoneCallLink
                                                href={TEL_URL}
                                                source="wizard_result_phone"
                                                productName={recommendedPackage.definition.name}
                                                onClickCapture={() => trackResultCtaClick(recommendedPackage, 'phone', 'result_summary')}
                                                className="inline-flex items-center justify-center rounded-xl border border-fe-border bg-fe-bg/70 px-4 py-3 text-sm font-bold text-fe-text transition-colors hover:border-fe-muted hover:text-white"
                                            >
                                                Telefonla konuş
                                            </PhoneCallLink>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                            {calculatedPackages.map((pkg, index) => (
                                <PackageCard
                                    key={pkg.definition.id}
                                    pkg={pkg}
                                    index={index}
                                    isPopular={pkg.definition.name.toLocaleLowerCase('tr-TR').includes('dengeli') || pkg.definition.tier === 'balanced'}
                                    expandedCards={expandedCards}
                                    onToggleExpand={(id) => {
                                        setExpandedCards(prev =>
                                            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
                                        );
                                    }}
                                    onWhatsAppOrder={(selectedPkg) => handleGetQuote(selectedPkg, 'result_card')}
                                    onDownloadPDF={(selectedPkg) => handleOpenPdfOffer(selectedPkg, 'result_card')}
                                    getOfferValidityDate={getOfferValidityDate}
                                    getTruckMeterColor={getTruckMeterColor}
                                    getSmartAdvice={getSmartAdviceWithDiscount}
                                />
                            ))}
                        </div>

                        {/* ─── Bonus meydan okuma kartı (Sprint 1.2) ─── */}
                        {bonusChallenge.status !== 'hidden' && (
                            <div
                                className="mx-auto mt-8 max-w-3xl rounded-2xl border border-brand-500/40 bg-brand-950/20 p-5"
                                data-testid="bonus-challenge-card"
                            >
                                <p className="mb-1 font-heading text-lg font-bold text-white">
                                    Aynı koşullarda Bonus&apos;a da baktınız mı?
                                </p>

                                {bonusChallenge.status === 'need_sub' && (
                                    <div>
                                        <p className="mb-2 text-sm text-fe-muted">
                                            Bonus fiyatı {citySubRegionQuestion(bonusChallenge.context.cityCode)?.question === 'yaka'
                                                ? 'yakaya' : 'bölgeye'} göre değişir — teslimat {citySubRegionQuestion(bonusChallenge.context.cityCode)?.question === 'yaka' ? 'yakanızı' : 'bölgenizi'} seçin, farkı gerçek hesapla gösterelim:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {bonusChallenge.options.map((choice) => (
                                                <button
                                                    key={choice}
                                                    type="button"
                                                    onClick={() => void finalizeBonusChallenge(bonusChallenge.context, choice)}
                                                    className="cursor-pointer rounded-lg border border-fe-border bg-fe-raised/60 px-3 py-1.5 text-sm font-medium text-fe-text transition-colors hover:border-brand-500/40"
                                                >
                                                    {choice === 'avrupa' ? 'Avrupa Yakası'
                                                        : choice === 'anadolu' ? 'Anadolu Yakası'
                                                        : choice === 'gebze' ? 'Gebze'
                                                        : 'Merkez ve diğer ilçeler'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {bonusChallenge.status === 'ready' && (
                                    <div aria-live="polite">
                                        <p className="text-sm text-fe-text">
                                            Bonus {bonusChallenge.context.challengerModel} + Optimix toz grubu komple set:{' '}
                                            <span className="font-bold tabular-nums text-white">
                                                {bonusChallenge.result.bonusPricePerM2.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺/m²
                                            </span>{' '}
                                            — seçiminizden{' '}
                                            <span className="font-bold tabular-nums text-emerald-300">
                                                {bonusChallenge.result.unitDiffTL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺/m² daha düşük
                                            </span>
                                        </p>
                                        <p className="mt-1 text-sm text-fe-muted">
                                            Bonus siparişi:{' '}
                                            <span className="tabular-nums">{bonusChallenge.result.bonusOrderM2.toLocaleString('tr-TR')} m²</span>{' '}
                                            → <span className="font-semibold tabular-nums text-white">{bonusChallenge.result.bonusTotalExVat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>{' '}
                                            (KDV hariç)
                                        </p>
                                        <p className="mt-2 text-[11px] leading-snug text-fe-muted">
                                            {sameConditionLabel({
                                                cityName: shippingZones.find(z => z.city_code === bonusChallenge.context.cityCode)?.city_name ?? '',
                                                subLabel: bonusChallenge.sub === 'avrupa' ? 'Avrupa Yakası'
                                                    : bonusChallenge.sub === 'anadolu' ? 'Anadolu Yakası'
                                                    : bonusChallenge.sub === 'gebze' ? 'Gebze'
                                                    : bonusChallenge.sub === 'diger' ? 'Merkez ve diğer ilçeler'
                                                    : null,
                                                thicknessCm: bonusChallenge.context.thicknessCm,
                                            })} · fark gerçek hesap sonucudur
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleChallengePick}
                                            className="mt-4 inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-[#1a0f08] transition-colors hover:bg-brand-400 sm:w-auto"
                                        >
                                            Bonus {bonusChallenge.context.challengerModel} ile hesapla →
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {showResults && recommendedPackage && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-fe-border bg-fe-bg/95 px-3 py-3 shadow-2xl backdrop-blur md:hidden">
                    <div className="mx-auto max-w-md">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-fe-muted">Önerilen: {recommendedPackage.definition.name}</p>
                                <p className="font-heading text-lg font-bold tabular-nums text-white">
                                    {formatCurrency(recommendedM2PriceWithVat)} ₺/m²
                                </p>
                                <p className="text-[10px] text-fe-muted">KDV dahil</p>
                            </div>
                            <div className="shrink-0 text-right text-[11px] text-fe-muted">
                                <div>{formatCurrency(recommendedPackage.grandTotal * 1.2)} ₺ toplam · KDV dahil</div>
                                <div>{recommendedShippingStatus}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                            <button
                                type="button"
                                onClick={() => handleOpenPdfOffer(recommendedPackage, 'sticky_mobile')}
                                className="min-h-[44px] rounded-xl bg-brand-500 px-3 text-xs font-bold text-[#1a0f08]"
                            >
                                Teklif kaydı
                            </button>
                            <button
                                type="button"
                                onClick={() => handleGetQuote(recommendedPackage, 'sticky_mobile')}
                                className="min-h-[44px] rounded-xl bg-green-600 px-3 text-xs font-bold text-white"
                            >
                                WhatsApp
                            </button>
                            <PhoneCallLink
                                href={TEL_URL}
                                source="wizard_result_phone"
                                productName={recommendedPackage.definition.name}
                                onClickCapture={() => trackResultCtaClick(recommendedPackage, 'phone', 'sticky_mobile')}
                                aria-label="Telefonla konuş"
                                className="inline-flex h-[44px] min-w-[48px] items-center justify-center rounded-xl border border-fe-border bg-fe-surface px-3 text-sm font-bold text-white"
                            >
                                Ara
                            </PhoneCallLink>
                        </div>
                    </div>
                </div>
            )}

            {/* QUOTE MODAL */}
            <AnimatePresence>
                {showQuoteModal && selectedPackageForQuote && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-fe-bg/80 backdrop-blur-sm"
                        onClick={() => setShowQuoteModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-fe-surface border border-fe-border rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setShowQuoteModal(false)}
                                className="absolute top-4 right-4 text-fe-muted hover:text-white"
                            >
                                ✕
                            </button>

                            <h3 className="text-xl font-bold text-white mb-1">WhatsApp&apos;tan Devam Edelim</h3>
                            <p className="text-sm text-fe-muted mb-6">
                                {selectedPackageForQuote.definition.name} paketi için teklif kaydını açalım. Stok, ödeme ve sevkiyat koşullarını WhatsApp&apos;ta netleştiririz.
                            </p>

                            <form onSubmit={handleSubmitQuote} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-fe-text mb-1">Ad Soyad / Firma</label>
                                    <input
                                        required
                                        type="text"
                                        value={quoteForm.customerName}
                                        onChange={e => setQuoteForm({ ...quoteForm, customerName: e.target.value })}
                                        className="w-full px-4 py-3 bg-fe-raised border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-fe-text mb-1">Telefon</label>
                                    <input
                                        required
                                        type="tel"
                                        value={quoteForm.customerPhone}
                                        onChange={e => setQuoteForm({ ...quoteForm, customerPhone: e.target.value })}
                                        className="w-full px-4 py-3 bg-fe-raised border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-fe-text mb-1">
                                        E-posta <span className="text-fe-muted text-xs">(opsiyonel)</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={quoteForm.customerEmail}
                                        onChange={e => setQuoteForm({ ...quoteForm, customerEmail: e.target.value })}
                                        className="w-full px-4 py-3 bg-fe-raised border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-fe-text mb-1">
                                        Adres <span className="text-fe-muted text-xs">(opsiyonel)</span>
                                    </label>
                                    <textarea
                                        value={quoteForm.customerAddress}
                                        onChange={e => setQuoteForm({ ...quoteForm, customerAddress: e.target.value })}
                                        className="w-full px-4 py-3 bg-fe-raised border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                                        rows={3}
                                    />
                                </div>

                                {/* KVKK — PdfOfferModal ile aynı standart */}
                                <div className="flex items-start gap-2.5 pt-1">
                                    <input
                                        type="checkbox"
                                        id="quoteWaKvkkConsent"
                                        checked={quoteForm.kvkkConsent}
                                        onChange={e => {
                                            setQuoteForm({ ...quoteForm, kvkkConsent: e.target.checked });
                                            if (e.target.checked) setQuoteFormError(null);
                                        }}
                                        disabled={isSubmittingQuote}
                                        className="mt-0.5 w-4 h-4 rounded accent-brand-500 cursor-pointer"
                                    />
                                    <label htmlFor="quoteWaKvkkConsent" className="text-xs text-fe-muted cursor-pointer leading-relaxed">
                                        Kişisel verilerimin teklif oluşturma amacıyla işlenmesini kabul ediyorum.{' '}
                                        <a href="/kvkk" target="_blank" rel="noopener noreferrer" className="text-brand-400 underline hover:text-brand-300">
                                            Aydınlatma Metni
                                        </a>
                                    </label>
                                </div>
                                {quoteFormError && (
                                    <p className="text-red-400 text-xs">{quoteFormError}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSubmittingQuote}
                                    className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isSubmittingQuote ? "Yönlendiriliyor..." : (
                                        <>
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                            </svg>
                                            Mesajı WhatsApp&apos;ta Aç
                                        </>
                                    )}
                                </button>

                                <p className="text-center text-xs text-fe-muted mt-3">
                                    Teklif kaydınız oluşur; sipariş süreci WhatsApp görüşmesinden sonra netleşir.
                                </p>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PDF OFFER MODAL */}
            <PdfOfferModal
                isOpen={showPdfOfferModal}
                onClose={() => {
                    if (isSubmittingPdf) return;
                    setShowPdfOfferModal(false);
                    setSelectedPackageForPdf(null);
                }}
                onSubmit={handleSubmitPdfOffer}
                isSubmitting={isSubmittingPdf}
                defaultCity={getSelectedCityName()}
            />
            {pdfDelivery && (
                <PdfDeliveryCard
                    {...pdfDelivery}
                    onClose={() => {
                        URL.revokeObjectURL(pdfDelivery.pdfUrl);
                        setPdfDelivery(null);
                    }}
                />
            )}
        </div>
    );
}
