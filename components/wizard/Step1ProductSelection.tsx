'use client';

import { motion } from "framer-motion";
import { useEffect } from "react";
import type { Brand, LogisticsCapacity, ShippingZone } from "@/lib/types";

type SliderMetrics = {
    packageCount: number;
    lorryFillPercentage: number;
    truckFillPercentage: number;
    isOverLorry: boolean;
    isOverTruck: boolean;
};

interface Step1Props {
    // Material Type
    selectedMalzeme: "tasyunu" | "eps";
    setSelectedMalzeme: (value: "tasyunu" | "eps") => void;

    // Brand
    selectedBrandId: number | null;
    setSelectedBrandId: (id: number | null) => void;
    brands: Brand[];

    // Model
    selectedModel: string | null;
    setSelectedModel: (model: string | null) => void;
    availableModels: string[];

    // Thickness
    selectedKalinlik: string;
    setSelectedKalinlik: (value: string) => void;

    // Area
    metraj: string;
    setMetraj: (value: string) => void;

    // Location
    shippingZones: ShippingZone[];
    selectedCityCode: number | null;
    onCityChange: (cityCode: number) => void;

    // Logistics
    isLoadingLogistics: boolean;
    currentLogistics: LogisticsCapacity | null;
    getSliderMetrics: () => SliderMetrics | null;
    getDowelLength: ((thickness: number) => number) | null;
}

const KALINLIKLAR = [
    { value: "3", label: "3cm" },
    { value: "4", label: "4cm" },
    { value: "5", label: "5cm" },
    { value: "6", label: "6cm" },
    { value: "8", label: "8cm" },
    { value: "10", label: "10cm", popular: true },
];

// Dış Cephe Mantolama için uygun modeller
const DIS_CEPHE_MODELLER = [
    'SW035', 'Premium', 'HD150', 'LD125', 'TR7.5',
    'İdeal Carbon', 'Double Carbon', 'EPS Karbonlu',
    'EPS Beyaz', 'EPS 035 Beyaz', 'Optimix Karbonlu'
];

const MARKA_LOGOLARI: { [key: string]: string } = {
    'Dalmaçyalı': '/images/markalogolar/dalmaçyalı-taşyünü- fiyatları.webp',
    'Expert': '/images/markalogolar/fawori-taşyünü- fiyatları.webp',
    'Optimix': '/images/markalogolar/fawori-taşyünü- fiyatları.webp',
    'Fawori': '/images/markalogolar/fawori-taşyünü- fiyatları.webp',
    'Knauf': '/images/markalogolar/Knauf Mineral yünleri.webp',
    'Tekno': '/images/markalogolar/Tekno Taşyünü ve EPs Fiyatları.webp',
    'Filli Boya': '/images/markalogolar/filli-boya-mantolama.webp'
};

export function Step1ProductSelection({
    selectedMalzeme,
    setSelectedMalzeme,
    selectedBrandId,
    setSelectedBrandId,
    brands,
    selectedModel,
    setSelectedModel,
    availableModels,
    selectedKalinlik,
    setSelectedKalinlik,
    metraj,
    setMetraj,
    shippingZones,
    selectedCityCode,
    onCityChange,
    isLoadingLogistics: _isLoadingLogistics,
    currentLogistics,
    getSliderMetrics: _getSliderMetrics,
    getDowelLength,
}: Step1Props) {
    // Marka değiştiğinde otomatik olarak ilk modeli seç
    useEffect(() => {
        if (selectedBrandId && availableModels.length > 0) {
            const filteredModels = availableModels.filter(m => DIS_CEPHE_MODELLER.includes(m));
            if (filteredModels.length > 0 && !selectedModel) {
                setSelectedModel(filteredModels[0]);
            }
        }
    }, [selectedBrandId, availableModels, selectedModel, setSelectedModel]);

    return (
        <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
        >
            <h2 className="font-heading text-white text-xl font-bold mb-4 flex items-center gap-2 tracking-tight">
                <span className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-sm font-heading">1</span>
                Ürün Bilgileri
            </h2>
            <p className="text-sm text-fe-muted mb-6">Malzeme tipini, markayı, kalınlığı ve metrajı seçin.</p>

            {/* Malzeme Tipi - BÜYÜK BUTONLAR */}
            <div className="mb-5">
                <label className="block text-sm font-medium text-white mb-3">
                    Malzeme Tipi
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => {
                            setSelectedMalzeme("tasyunu");
                            setSelectedModel(null);
                        }}
                        className={`
                            relative group p-3 rounded-xl border-2 transition-all duration-300 flex items-center gap-3
                            ${selectedMalzeme === "tasyunu"
                                ? "bg-fe-raised border-brand-500 shadow-lg shadow-brand-500/20"
                                : "bg-fe-surface border-fe-border hover:border-fe-muted/50"
                            }
                        `}
                    >
                        <img
                            src="/images/ikonlar/tas-yunu-levha.webp"
                            alt="Taşyünü"
                            className="w-9 h-9 object-contain"
                        />
                        <div className="text-left">
                            <div className={`font-bold leading-tight text-sm ${selectedMalzeme === "tasyunu" ? "text-white" : "text-fe-text"}`}>Taşyünü</div>
                            <div className="text-[11px] text-fe-muted leading-tight">Yüksek Yangın Dayanımı</div>
                        </div>
                        {selectedMalzeme === "tasyunu" && (
                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                        )}
                    </button>

                    <button
                        onClick={() => {
                            setSelectedMalzeme("eps");
                            setSelectedModel(null);
                        }}
                        className={`
                            relative group p-3 rounded-xl border-2 transition-all duration-300 flex items-center gap-3
                            ${selectedMalzeme === "eps"
                                ? "bg-fe-raised border-brand-500 shadow-lg shadow-brand-500/20"
                                : "bg-fe-surface border-fe-border hover:border-fe-muted/50"
                            }
                        `}
                    >
                        <img
                            src="/images/ikonlar/EPS Levha.webp"
                            alt="EPS"
                            className="w-11 h-7 object-contain"
                        />
                        <div className="text-left">
                            <div className={`font-bold leading-tight text-sm ${selectedMalzeme === "eps" ? "text-white" : "text-fe-text"}`}>EPS</div>
                            <div className="text-[11px] text-fe-muted leading-tight">Uygun Fiyat</div>
                        </div>
                        {selectedMalzeme === "eps" && (
                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                        )}
                    </button>
                </div>
            </div>

            {/* Marka Seçimi */}
            <div className="mb-5">
                <label className="block text-sm font-medium text-white mb-2">
                    Marka Seçin
                </label>
                <div className="grid grid-cols-3 gap-3">
                    {brands
                        .filter(b => {
                            // Görseldeki gibi: 3'lü marka seti
                            return ['Dalmaçyalı', 'Expert', 'Optimix'].includes(b.name);
                        })
                        .map((brand) => (
                            <button
                                key={brand.id}
                                onClick={() => setSelectedBrandId(brand.id)}
                                className={`
                                    relative p-2 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center h-16 bg-fe-bg/40
                                    ${selectedBrandId === brand.id
                                        ? "border-brand-500 ring-2 ring-brand-500/20 z-10"
                                        : "border-fe-border hover:border-fe-muted/50"
                                    }
                                `}
                            >
                                {MARKA_LOGOLARI[brand.name] ? (
                                    <img 
                                        src={MARKA_LOGOLARI[brand.name]} 
                                        alt={brand.name} 
                                        className="h-7 w-auto object-contain"
                                    />
                                ) : (
                                    <span className="font-bold text-white">{brand.name}</span>
                                )}
                                <span className="mt-0.5 text-[11px] font-semibold text-fe-text">{brand.name}</span>
                                {selectedBrandId === brand.id && (
                                    <div className="absolute -top-2 -right-2 bg-brand-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                                        ✓
                                    </div>
                                )}
                            </button>
                        ))}
                </div>
            </div>

            {/* Model & Kalınlık & Metraj (Grid Yapı) */}
            <div className="space-y-4">
                {/* Model (butonlar) */}
                {availableModels.filter(m => DIS_CEPHE_MODELLER.includes(m)).length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-white mb-2">Model</label>
                        <div className="grid grid-cols-3 gap-3">
                            {availableModels
                                .filter(m => DIS_CEPHE_MODELLER.includes(m))
                                .map((model) => {
                                    const selected = selectedModel === model;
                                    return (
                                        <button
                                            key={model}
                                            type="button"
                                            onClick={() => setSelectedModel(model)}
                                            className={`px-3 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                                                selected
                                                    ? "bg-fe-surface border-brand-500 text-white shadow-lg shadow-brand-500/10"
                                                    : "bg-fe-surface border-fe-border text-fe-text hover:border-fe-muted/50"
                                            }`}
                                        >
                                            {model}
                                        </button>
                                    );
                                })}
                        </div>
                    </div>
                )}

                {/* Kalınlık (butonlar) */}
                <div>
                    <label className="block text-sm font-medium text-white mb-2">
                        Kalınlık
                        {getDowelLength && selectedKalinlik && (
                            <span className="ml-2 text-xs text-fe-muted">
                                (Dübel: {getDowelLength(parseInt(selectedKalinlik))}cm)
                            </span>
                        )}
                    </label>
                    {/* tek satır görünümü için 6'lı grid */}
                    <div className="grid grid-cols-6 gap-2">
                        {KALINLIKLAR.map((k) => {
                            const selected = selectedKalinlik === k.value;
                            return (
                                <button
                                    key={k.value}
                                    type="button"
                                    onClick={() => setSelectedKalinlik(k.value)}
                                    className={`relative w-full px-0 py-2 rounded-xl border-2 font-bold text-sm transition-all ${
                                        selected
                                            ? "bg-fe-surface border-brand-500 text-white shadow-lg shadow-brand-500/10"
                                            : "bg-fe-surface border-fe-border text-fe-text hover:border-fe-muted/50"
                                    }`}
                                >
                                    {k.label}
                                    {k.popular && (
                                        <span className="absolute -top-2 -right-2 text-[10px] px-2 py-0.5 rounded-full bg-green-500 text-white font-bold">
                                            Popüler
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Metraj */}
                <div>
                    <label className="block text-sm font-medium text-white mb-2">Metraj (m²)</label>
                    <div className="relative">
                        <input
                            type="number"
                            min="1"
                            placeholder="Örn: 150"
                            value={metraj}
                            onChange={(e) => setMetraj(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-fe-border rounded-xl bg-fe-bg text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all tabular-nums pr-12"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-fe-muted font-bold">m²</span>
                    </div>
                </div>

                {/* Teslimat Konumu */}
                <div>
                    <label className="block text-sm font-medium text-white mb-2">
                        Teslimat Konumu (İl)
                    </label>
                    <select
                        value={selectedCityCode ?? ""}
                        onChange={(e) => onCityChange(Number(e.target.value))}
                        className="w-full px-4 py-3 border-2 border-fe-border rounded-xl bg-fe-bg text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                    >
                        <option value="">İl seçiniz...</option>
                        {shippingZones.map((zone) => (
                            <option key={zone.city_code} value={zone.city_code}>
                                {zone.city_name}
                            </option>
                        ))}
                    </select>
                    <p className="mt-2 text-[11px] text-fe-muted">
                        Nakliye ve iskonto oranı şehir bazlı uygulanır.
                    </p>
                </div>

                {/* Kapasite satırı (eski görünüm) */}
                {currentLogistics && (
                    <div className="px-4 py-2 rounded-xl bg-fe-surface border border-fe-border text-xs text-fe-muted">
                        Kamyon: {Math.round(currentLogistics.lorry_capacity_m2)} m² • TIR: {Math.round(currentLogistics.truck_capacity_m2)} m²
                    </div>
                )}
            </div>

        </motion.div>
    );
}
