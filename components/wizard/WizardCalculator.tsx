"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { generateQuotePDF } from "@/lib/pdfGenerator";
import { WHATSAPP_ORDER } from "@/lib/config";
import { uploadPdfToStorage } from "@/lib/uploadPdfToStorage";
import {
  notifyWizardShowPrices,
  notifyPdfQuoteRequested,
  notifyWhatsappOrderRequested,
} from "@/lib/notifyWizardEvent";
import { PackageCard } from "@/components/package/PackageCard";
import { PdfOfferModal } from "@/components/modal/PdfOfferModal";
import { WizardStep1 } from "@/components/wizard/WizardStep1";
import { WizardStep2 } from "@/components/wizard/WizardStep2";
import { WizardStep3 } from "@/components/wizard/WizardStep3";
import { WizardStep4 } from "@/components/wizard/WizardStep4";
import {
    getOfferValidityDate,
    getTruckMeterColor,
    getSmartAdvice,
    generateWhatsAppMessage,
    generateWhatsAppURL
} from "@/lib/utils/packageHelpers";
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
    const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [selectedMalzeme, setSelectedMalzeme] = useState<"tasyunu" | "eps">("tasyunu");
    const [selectedKalinlik, setSelectedKalinlik] = useState("5");
    const [metraj, setMetraj] = useState("");

    // Dynamic Slider State
    const [currentLogistics, setCurrentLogistics] = useState<LogisticsCapacity | null>(null);
    const [isLoadingLogistics, setIsLoadingLogistics] = useState(false);

    // Sonuçlar
    const [calculatedPackages, setCalculatedPackages] = useState<CalculatedPackage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // Wizard step
    const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);

    const isCurrentStepValid = (): boolean => {
        switch (activeStep) {
            case 1: return selectedBrandId != null;
            case 2: return !!selectedKalinlik;
            case 3: return selectedCityCode != null;
            case 4: {
                if (!metraj || Number(metraj) <= 0) return false;
                const m2 = Number(metraj);
                const matType = materialTypes.find(m => m.slug === selectedMalzeme);
                const minOrder = matType?.min_order_m2 ?? 0;
                if (minOrder > 0 && m2 < minOrder) return false;
                if (matType?.full_vehicle_only && currentLogistics
                    && !isValidFullVehicleMetraj(m2, currentLogistics)) return false;
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
    const getSmartAdviceWithDiscount = (logistics: any): string | null => {
        if (!logistics || logistics.vehicleType === 'multiple') return null;
        const activeFill = logistics.vehicleType === 'lorry'
            ? logistics.lorryFillPercentage
            : logistics.truckFillPercentage;
        if (activeFill >= 86) {
            const isLorry = logistics.vehicleType === 'lorry';
            const zone = shippingZones.find(z => z.city_code === selectedCityCode);
            const discPct = isLorry ? (zone?.discount_kamyon ?? null) : (zone?.discount_tir ?? null);
            const vehicleLabel = isLorry ? 'Kamyon' : 'TIR';
            return `✅ Mükemmel — ${vehicleLabel} tam kapasite kullanılıyor, nakliye fiyata dahildir${discPct != null ? ` + %${discPct} iskonto` : ''}!`;
        }
        if (logistics.packagesNeededForOptimal > 0) {
            const additionalM2 = (logistics.packagesNeededForOptimal * logistics.packageSizeM2).toFixed(1);
            return `💡 Sadece ${logistics.packagesNeededForOptimal} paket daha (${additionalM2} m²) eklerseniz araç tam dolacak ve nakliye farkı sıfırlanacak!`;
        }
        return null;
    };

    // Seçili plaka için gerçek paket m²'sini hesapla (Step4 gamification tutarlılığı)
    const effectiveLogistics = useMemo(() => {
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
    }, [currentLogistics, plates, platePrices, selectedBrandId, selectedModel, selectedKalinlik, selectedMalzeme, materialTypes]);

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
                supabase.from("accessories").select("*").eq("is_active", true),
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
                const dalmacyali = brandsRes.data.find((b: Brand) => b.name === 'Dalmaçyalı');
                if (dalmacyali) setSelectedBrandId(dalmacyali.id);
            }
        }
        fetchData();
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

    const getSliderMetrics = () => {
        if (!currentLogistics || !metraj) return null;
        const currentM2 = parseFloat(metraj);
        const packageCount = Math.round(currentM2 / currentLogistics.package_size_m2);
        return {
            packageCount,
            lorryFillPercentage: (currentM2 / currentLogistics.lorry_capacity_m2) * 100,
            truckFillPercentage: (currentM2 / currentLogistics.truck_capacity_m2) * 100,
            isOverLorry: currentM2 > currentLogistics.lorry_capacity_m2,
            isOverTruck: currentM2 > currentLogistics.truck_capacity_m2
        };
    };

    const handleCityChange = (cityCode: number) => {
        setSelectedCityCode(cityCode);
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

        // PDF toplamına KDV eklenir.
        const priceWithoutVat = (pkg.totalProductCost || 0) + (pkg.shippingCost || 0);
        const vatAmount = priceWithoutVat * 0.20;
        const grandTotal = priceWithoutVat + vatAmount;

        const refCode = externalRefCode || `TY${Date.now().toString().slice(-7)}`;
        const validityDate = getOfferValidityDate();

        const metrajNumber = Number(metraj) || 0;
        const waMessage = `Merhaba ${refCode} no lu teklif formunu sipariş etmek istiyorum`;
        const whatsappOrderLink = generateWhatsAppURL("", waMessage);

        const totalM2 =
            pkg.logistics?.packageCount && pkg.logistics?.packageSizeM2
                ? pkg.logistics.packageCount * pkg.logistics.packageSizeM2
                : (metrajNumber || 1);

        const materialLabel = selectedMalzeme === "tasyunu" ? "Taşyünü" : "EPS";
        const materialLongName = materialTypes.find(m => m.slug === selectedMalzeme)?.name || materialLabel;

        const itemsForPdf = (pkg.items || []).map((it) => {
            const baseName = `${it.brandName} ${it.shortName}`.trim();
            const description = it.isPlate
                ? `${baseName} ${materialLabel} ${selectedKalinlik} cm`
                : baseName;
            const consumptionRate = metrajNumber > 0 ? it.quantity / metrajNumber : 0;

            return {
                description: it.name, // Orijinal uzun ismi kullan
                quantity: it.quantity,
                unit: it.unit,
                consumptionRate,
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
            systemDescription: `${pkg.plateBrandName} ${selectedModel || ''} ${materialLabel} ${selectedKalinlik}cm + ${pkg.accessoryBrandName} Toz Grubu`,
            cityName,
            city: customer.city || cityName,
            district: customer.district || "",
            materialLongName,
            grandTotal,
            pricePerM2: totalM2 > 0 ? grandTotal / totalM2 : 0,
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
            shippingWarning: pkg.logistics?.shippingWarning,
            specialOrderNote: pkg.requiresSpecialOrder ? pkg.specialOrderNote : undefined,
        };
    };

    const handleOpenPdfOffer = (pkg: CalculatedPackage) => {
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
            });

            // 1. PDF üret (müşteri otomatik indirir)
            const pdfResult = await generateQuotePDF(buildPdfData(selectedPackageForPdf, data, refCode));

            // 2. Storage'a yükle (paralel, bloklamaz)
            let pdfUrl: string | null = null;
            let pdfStoragePath: string | null = null;
            try {
                const uploaded = await uploadPdfToStorage(pdfResult.blob, `${refCode}.pdf`);
                if (uploaded) {
                    pdfUrl = uploaded.publicUrl;
                    pdfStoragePath = uploaded.storagePath;
                }
            } catch { /* storage hatası akışı durdurmasın */ }

            // 3. DB kaydet
            const quoteRes = await fetch('/api/quotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...quotePayload, pdfUrl, pdfStoragePath }),
            });

            const quoteResult = await quoteRes.json();
            if (!quoteRes.ok || !quoteResult.ok) {
                console.error('PDF quote save failed:', {
                    status: quoteRes.status,
                    result: quoteResult,
                    payload: quotePayload,
                });
                throw new Error(quoteResult.error || "Teklif kaydı oluşturulamadı.");
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
                    ref_code:               refCode,
                    customer_type:          data.customerCompany ? 'company' : 'individual',
                });
            }

            // 4. Yeni sekmede aç
            try { window.open(pdfResult.blobUrl, '_blank'); } catch { /* popup blocker */ }
            setShowPdfOfferModal(false);
            setSelectedPackageForPdf(null);
        } catch (error) {
            console.error("PDF oluşturma hatası:", error);
            alert("PDF oluşturulurken bir hata oluştu. Lütfen tekrar deneyiniz.");
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

    // Satış fiyatı hesapla
    // profitMarginPct opsiyonel: hacim-bazlı marj kademe sisteminden gelir (EPS için 35/23/10).
    // Verilmezse mevcut sabit %10 davranışı korunur (geriye dönük uyum).
    const calculateSalePrice = (
        basePrice: number,
        discount1: number,
        discount2: number,
        brandName: string,
        isLevha: boolean = false,
        isKdvIncluded: boolean = true,
        profitMarginPct: number = 10
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
    // Migration v12'den önce material_types alanı boş ise → 10 fallback.
    const selectMarginPct = (matType: MaterialType | undefined, totalM2: number): number => {
        if (!matType) return 10;
        const t1Max = matType.tier1_max_m2;
        const t1Pct = matType.tier1_margin_pct;
        const t2Max = matType.tier2_max_m2;
        const t2Pct = matType.tier2_margin_pct;
        const t3Pct = matType.tier3_margin_pct;
        if (t1Max != null && t1Pct != null && totalM2 <= t1Max) return Number(t1Pct);
        if (t2Max != null && t2Pct != null && totalM2 <= t2Max) return Number(t2Pct);
        if (t3Pct != null) return Number(t3Pct);
        return 10;
    };

    // Taşyünü tam-araç kuralı: kullanıcı metrajı yalnızca N×Kamyon + M×TIR
    // kombinasyonlarına denk geliyorsa geçerli. Tolerans paket boyutunun yarısı kadar.
    const isValidFullVehicleMetraj = (
        m2: number,
        logistics: LogisticsCapacity | null
    ): boolean => {
        if (!logistics) return true;
        const lorry = logistics.lorry_capacity_m2;
        const truck = logistics.truck_capacity_m2;
        if (!lorry || !truck) return true;
        const tolerance = (logistics.package_size_m2 || 1) / 2;
        const maxTrucks = Math.ceil(m2 / truck) + 1;
        for (let t = 0; t <= maxTrucks; t++) {
            const remainder = m2 - t * truck;
            if (remainder < -tolerance) break;
            if (Math.abs(remainder) <= tolerance) return true;
            const lorries = Math.round(remainder / lorry);
            if (lorries >= 0 && Math.abs(remainder - lorries * lorry) <= tolerance) {
                return true;
            }
        }
        return false;
    };

    // Hedef metrajın yakınında geçerli tam-araç kombinasyonları üretir
    // (kullanıcıya snap-suggestion butonları için). En yakın 4 öneri.
    const getValidFullVehicleOptions = (
        m2: number,
        logistics: LogisticsCapacity | null
    ): { m2: number; label: string }[] => {
        if (!logistics) return [];
        const lorry = logistics.lorry_capacity_m2;
        const truck = logistics.truck_capacity_m2;
        if (!lorry || !truck) return [];
        const options: { m2: number; label: string }[] = [];
        const maxTrucks = Math.max(2, Math.ceil(m2 / truck) + 1);
        const maxLorries = Math.max(2, Math.ceil(m2 / lorry) + 1);
        for (let t = 0; t <= maxTrucks; t++) {
            for (let l = 0; l <= maxLorries; l++) {
                if (t === 0 && l === 0) continue;
                const total = t * truck + l * lorry;
                const parts: string[] = [];
                if (l > 0) parts.push(`${l} Kamyon`);
                if (t > 0) parts.push(`${t} TIR`);
                options.push({ m2: total, label: parts.join(' + ') });
            }
        }
        // En yakın 4 öneri (mutlak farka göre sırala)
        return options
            .sort((a, b) => Math.abs(a.m2 - m2) - Math.abs(b.m2 - m2))
            .slice(0, 4)
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
        if (matType.full_vehicle_only && currentLogistics
            && !isValidFullVehicleMetraj(m2, currentLogistics)) {
            return {
                isValid: false,
                kind: 'full_vehicle',
                suggestions: getValidFullVehicleOptions(m2, currentLogistics),
            };
        }
        return { isValid: true };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metraj, selectedMalzeme, materialTypes, currentLogistics]);

    // Fiyatları Göster
    const handleShowPrices = async () => {
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

        // Adım 3b: ≥10.000 m² özel teklif kontrolü (sadece Taşyünü için seed'lendi)
        const specialThreshold = matType?.special_order_threshold_m2 ?? null;
        const requiresSpecialOrder = specialThreshold != null && totalM2 >= specialThreshold;
        const specialOrderNote = requiresSpecialOrder ? (matType?.special_order_note ?? null) : null;

        const calculated: CalculatedPackage[] = [];

        for (const pkgDef of packageDefinitions) {
            if (pkgDef.plate_brand_id !== selectedBrandId) continue;

            const items: CalculatedPackageItem[] = [];
            let totalProductCost = 0;

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
                let plateIsKdvIncluded = platePrice ? platePrice.is_kdv_included : plate.is_kdv_included;

                const plateBrand = brands.find(b => b.id === plate?.brand_id);
                // EPS için bayi iskontosu (İSK2) %8 fallback (Admin ile aynı)
                let plateDiscount2 = (platePrice?.discount_2 ?? plate.discount_2 ?? (selectedMalzeme === "eps" ? 8 : 0)) as number;

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

                // Debug için fiyat detaylarını konsola yaz
                console.log(`Fiyat Hesaplama Detayı (${plate.name}):`, {
                    'Liste Fiyatı': plateBasePrice,
                    'KDV Dahil mi?': plateIsKdvIncluded,
                    'Bölge İskontosu (İsk1)': effectivePlateDiscount1,
                    'Bayi İskontosu (İsk2)': plateDiscount2,
                    'Hacim Marjı (%)': marginPct,
                    'Toplam Metraj': totalM2,
                    'Sonuç (KDV Hariç Net Paket)': platePackagePrice,
                    'm² Fiyatı': plateM2Price,
                    'Paket Metrajı': realPackageM2
                });

                items.push({
                    name: `${plateBrand?.name || ''} ${plate.short_name} ${selectedKalinlik} cm ${materialSuffix}`.trim(),
                    shortName: plate.short_name,
                    brandName: plateBrand?.name || '',
                    quantity: totalM2,
                    unit: 'm²',
                    unitPrice: plateM2Price,
                    totalPrice: plateTotal,
                    isPlate: true,
                    packageCount: packageCount
                });
            }

            const accBrandName = brands.find(b => b.id === pkgDef.accessory_brand_id)?.name ?? '';
            const pkgAccessories = accessories.filter(acc => acc.brand_id === pkgDef.accessory_brand_id);

            for (const accType of accessoryTypes) {
                const acc = pkgAccessories.find(a =>
                    a.accessory_type_id === accType.id &&
                    (selectedMalzeme === 'eps' ? a.is_for_eps : a.is_for_tasyunu)
                );
                if (acc) {
                    const consumption = selectedMalzeme === 'eps'
                        ? accType.consumption_rate_eps
                        : accType.consumption_rate_tasyunu;

                    if (consumption > 0) {
                        const totalNeed = totalM2 * consumption;
                        const itemQuantity = Math.ceil(totalNeed / acc.unit_content);

                        let accIsk1 = acc.discount_1;
                        let accIsk2 = acc.discount_2;

                        // EPS için özel iskonto: levha markasından bağımsız, aksesuar markasına göre kontrol
                        if (selectedMalzeme === "eps" && selectedCity && (accBrandName === "Dalmaçyalı" || accBrandName === "Expert" || accBrandName === "Optimix")) {
                            const cityIsk1 = selectedCity.eps_toz_region_discount ?? 0;
                            if (cityIsk1 > 0) accIsk1 = cityIsk1;

                            if (accBrandName === "Optimix" && acc.discount_2 >= 10) {
                                accIsk2 = selectedCity.optimix_toz_discount ?? accIsk2;
                            }
                        }

                        const accUnitPrice = calculateSalePrice(
                            acc.base_price,
                            accIsk1,
                            accIsk2,
                            selectedBrand.name,
                            false,
                            acc.is_kdv_included,
                            marginPct
                        );

                        const accTotal = roundToKurus(accUnitPrice * itemQuantity);
                        totalProductCost += accTotal;

                        items.push({
                            name: acc.name,
                            shortName: acc.short_name,
                            brandName: brands.find(b => b.id === pkgDef.accessory_brand_id)?.name || '',
                            quantity: itemQuantity,
                            unit: acc.unit,
                            unitPrice: accUnitPrice,
                            totalPrice: accTotal,
                            isPlate: false
                        });
                    }
                }
            }

            // Tam-araç kuralı aktifken (yeni davranış) parsiyel taşıma kabul edilmediği için
            // step4'ten geçerli metraj zaten doğrulanmış olur — nakliye daima dahil.
            // full_vehicle_only=false (eski davranış) için düşük metrajlı taşyünü uyarısı korunur.
            const fullVehicleOnly = matType?.full_vehicle_only ?? false;
            const isLowMetrageTasyunu = !fullVehicleOnly
                && selectedMalzeme === 'tasyunu'
                && logistics
                && packageCount < logistics.lorry_capacity_packages;

            // Aksesuar markası stoktan toplanıyorsa (örn. TEKNO) set tek noktadan
            // çıkamaz → nakliye alıcıya ait. brands.requires_separate_shipping=TRUE
            // olan aksesuar markaları bu kuralı tetikler.
            const accBrand = brands.find(b => b.id === pkgDef.accessory_brand_id);
            const requiresSeparateShipping = accBrand?.requires_separate_shipping === true;

            const isShippingIncluded = !isLowMetrageTasyunu && !requiresSeparateShipping;
            const shippingWarning = requiresSeparateShipping
                ? `${accBrand?.name ?? 'Bu aksesuar grubu'} stoktan toplandığı için set tek noktadan sevk edilemez — nakliye alıcıya aittir.`
                : isLowMetrageTasyunu
                    ? "Metraj kamyon kapasitesinin altında olduğu için nakliye alıcıya aittir. Ancak fabrikadan en iyi 'Tır İskontosu' fiyatları uygulanmıştır."
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
                    vehicleType: packageCount > logistics.truck_capacity_packages ? 'multiple' :
                                 packageCount >= logistics.lorry_capacity_packages ? 'truck' : 'lorry',
                    isShippingIncluded,
                    shippingWarning,
                }
            });
        }

        setCalculatedPackages(calculated);
        setIsLoading(false);
        setShowResults(true);

        // GA4 event — kullanıcı fiyat ekranına ulaştı (Fiyat_Gosterildi)
        // PDF/WhatsApp talep etmeden ayrılırsa "abandoned" lead izlemesi
        const cheapest = calculated.length > 0
            ? calculated.reduce((min, p) => p.grandTotal < min.grandTotal ? p : min, calculated[0])
            : null;
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
        });

        setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    const handleGetQuote = (pkg: CalculatedPackage) => {
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
        }
    ) => {
        const selectedBrand = brands.find(b => b.id === selectedBrandId);
        const selectedCity = selectedCityCode
            ? shippingZones.find(z => z.city_code === selectedCityCode)
            : null;

        const priceWithoutVat = roundToKurus((pkg.totalProductCost || 0) + (pkg.shippingCost || 0));
        const vatAmount = roundToKurus(priceWithoutVat * 0.20);
        const totalPrice = roundToKurus(priceWithoutVat + vatAmount);

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
            pricePerM2: roundToKurus(pkg.pricePerM2 * 1.20),
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
        };
    };

    const handleSubmitQuote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPackageForQuote) return;

        setQuoteFormError(null);

        if (!quoteForm.kvkkConsent) {
            setQuoteFormError('Devam etmek için KVKK onayı gereklidir.');
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
                    ref_code:               refCode,
                });
            }

            const message = generateWhatsAppMessage(
                selectedPackageForQuote,
                Number(metraj) || 0,
                selectedCityCode ? shippingZones.find(z => z.city_code === selectedCityCode)?.city_name || "" : ""
            );

            const whatsappUrl = `https://wa.me/${WHATSAPP_ORDER}?text=${encodeURIComponent(message)}`;
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

        } catch (error) {
            console.error("Teklif gönderme hatası:", error);
            alert("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyiniz.");
        } finally {
            setIsSubmittingQuote(false);
        }
    };

    return (
        <div className="flex flex-col bg-fe-bg">
            {/* Hesap formu ve güven notları */}
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
                                    { value: '81', label: 'İl sevkiyat' },
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
                                    4 adımda paket, fiyat ve nakliye dahil teklifiniz.
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
                                        brands={brands}
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
                                Fiyatlar KDV hariç, nakliye dahildir. Bölge iskontosu uygulanmıştır.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* RESULTS - PACKAGE CARDS */}
            {showResults && calculatedPackages.length > 0 && (
                <section ref={resultsRef} className="py-12 bg-fe-bg scroll-mt-20">
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
                            {shippingZones.find(z => z.city_code === selectedCityCode)?.city_name} bölgesine özel nakliye ve iskonto hesaplanmış mantolama seti fiyatlarıdır.
                        </p>

                        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                            {calculatedPackages.map((pkg, index) => (
                                <PackageCard
                                    key={pkg.definition.id}
                                    pkg={pkg}
                                    index={index}
                                    expandedCards={expandedCards}
                                    onToggleExpand={(id) => {
                                        setExpandedCards(prev =>
                                            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
                                        );
                                    }}
                                    onWhatsAppOrder={handleGetQuote}
                                    onDownloadPDF={handleOpenPdfOffer}
                                    getOfferValidityDate={getOfferValidityDate}
                                    getTruckMeterColor={getTruckMeterColor}
                                    getSmartAdvice={getSmartAdviceWithDiscount}
                                />
                            ))}
                        </div>
                    </div>
                </section>
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

                            <h3 className="text-xl font-bold text-white mb-1">Teklif İste</h3>
                            <p className="text-sm text-fe-muted mb-6">
                                {selectedPackageForQuote.definition.name} Paketi için WhatsApp üzerinden hızlı teklif alın.
                            </p>

                            <form onSubmit={handleSubmitQuote} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-fe-text mb-1">Ad Soyad</label>
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
                                    <label className="block text-sm font-medium text-fe-text mb-1">Firma</label>
                                    <input
                                        type="text"
                                        value={quoteForm.customerCompany}
                                        onChange={e => setQuoteForm({ ...quoteForm, customerCompany: e.target.value })}
                                        className="w-full px-4 py-3 bg-fe-raised border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-fe-text mb-1">Adres</label>
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
                                            WhatsApp ile Teklif İste
                                        </>
                                    )}
                                </button>

                                <p className="text-center text-xs text-fe-muted mt-3">
                                    Teklifiniz sistemde kayıt altına alınır; sipariş onayı için WhatsApp üzerinden ilerlersiniz.
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
        </div>
    );
}
