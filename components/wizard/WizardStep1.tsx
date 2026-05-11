'use client';

import { motion } from "framer-motion";
import { useEffect } from "react";
import { Check } from "@phosphor-icons/react";
import type { Brand } from "@/lib/types";

const DIS_CEPHE_MODELLER = [
    'SW035', 'Premium', 'HD150', 'LD125', 'TR7.5',
    'İdeal Carbon', 'Double Carbon', 'EPS Karbonlu',
    'EPS Beyaz', 'EPS 035 Beyaz', 'Optimix Karbonlu',
];

const MARKA_LOGOLARI: Record<string, string> = {
    'Dalmaçyalı': '/images/markalogolar/dalmaçyalı-taşyünü- fiyatları.webp',
    'Expert':     '/images/markalogolar/fawori-taşyünü- fiyatları.webp',
    'Optimix':    '/images/markalogolar/fawori-taşyünü- fiyatları.webp',
    'Fawori':     '/images/markalogolar/fawori-taşyünü- fiyatları.webp',
    'Knauf':      '/images/markalogolar/Knauf Mineral yünleri.webp',
    'Tekno':      '/images/markalogolar/Tekno Taşyünü ve EPs Fiyatları.webp',
    'Filli Boya': '/images/markalogolar/filli-boya-mantolama.webp',
};

// Chip etiketleri — hesaplayıcı seçimine bağlamsal kısa ipucu.
// Mevcut sub-label'ı (Yüksek Yangın Dayanımı / Uygun Fiyat) değiştirir.
const MALZEME_CHIPS: Record<'tasyunu' | 'eps', string> = {
    tasyunu: 'Yangın / Isı / Ses Yalıtımı',
    eps:     'Ekonomik Isı ve Ses Yalıtımı',
};

const BRAND_CHIPS: Record<string, string> = {
    'Dalmaçyalı': 'PREMIUM',
    'Expert':     'Endüstriyel',
    'Optimix':    'Ekonomik',
};

// Model meta — chip (kullanım alanı) opsiyonel; desc (yoğunluk) ana bilgidir.
const MODEL_META: Record<string, { chip?: string; desc: string }> = {
    'SW035':   { chip: 'Konut · Villa', desc: '120 kg/m³ yoğunluk' },
    'LD125':   {                         desc: '125 kg/m³ yoğunluk' },
    'HD150':   {                         desc: '150 kg/m³ yoğunluk' },
    'Premium': {                         desc: '120 kg/m³ yoğunluk' },
    'TR7.5':   {                         desc: '120 kg/m³ yoğunluk' },
};

interface WizardStep1Props {
    selectedMalzeme: "tasyunu" | "eps";
    setSelectedMalzeme: (v: "tasyunu" | "eps") => void;
    selectedBrandId: number | null;
    setSelectedBrandId: (id: number | null) => void;
    brands: Brand[];
    selectedModel: string | null;
    setSelectedModel: (m: string | null) => void;
    availableModels: string[];
}

export function WizardStep1({
    selectedMalzeme, setSelectedMalzeme,
    selectedBrandId, setSelectedBrandId, brands,
    selectedModel, setSelectedModel, availableModels,
}: WizardStep1Props) {
    useEffect(() => {
        if (selectedBrandId && availableModels.length > 0 && !selectedModel) {
            const filtered = availableModels.filter(m => DIS_CEPHE_MODELLER.includes(m));
            if (filtered.length > 0) setSelectedModel(filtered[0]);
        }
    }, [selectedBrandId, availableModels, selectedModel, setSelectedModel]);

    const filteredModels = availableModels.filter(m => DIS_CEPHE_MODELLER.includes(m));

    return (
        <motion.div
            key="step1"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
        >
            {/* Malzeme Tipi */}
            <div className="mb-5">
                <label className="block text-sm font-semibold text-white mb-3">Malzeme Tipi</label>
                <div className="grid grid-cols-2 gap-3">
                    {([
                        { value: "tasyunu", label: "Taşyünü", img: "/images/ikonlar/tas-yunu-levha.webp" },
                        { value: "eps",     label: "EPS",     img: "/images/ikonlar/EPS Levha.webp" },
                    ] as const).map(({ value, label, img }) => (
                        <button
                            key={value}
                            onClick={() => { setSelectedMalzeme(value); setSelectedModel(null); }}
                            className={`relative p-3 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${
                                selectedMalzeme === value
                                    ? "bg-fe-raised border-brand-500 shadow-lg shadow-brand-500/20"
                                    : "bg-fe-surface border-fe-border hover:border-fe-muted/50"
                            }`}
                        >
                            <img src={img} alt={label} className="w-9 h-9 object-contain shrink-0" />
                            <div className="text-left min-w-0">
                                <div className={`font-bold text-sm leading-tight ${selectedMalzeme === value ? "text-white" : "text-fe-text"}`}>{label}</div>
                                <div className="mt-0.5 text-[11px] text-brand/85 leading-tight">
                                    {MALZEME_CHIPS[value]}
                                </div>
                            </div>
                            {selectedMalzeme === value && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Marka */}
            <div className="mb-5">
                <label className="block text-sm font-semibold text-white mb-3">Levha Markası</label>
                <div className="grid grid-cols-3 gap-3">
                    {brands
                        .filter(b => ['Dalmaçyalı', 'Expert', 'Optimix'].includes(b.name))
                        .map(brand => (
                            <button
                                key={brand.id}
                                onClick={() => setSelectedBrandId(brand.id)}
                                className={`relative p-2 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center min-h-[5.5rem] bg-fe-bg/40 ${
                                    selectedBrandId === brand.id
                                        ? "border-brand-500 ring-2 ring-brand-500/20"
                                        : "border-fe-border hover:border-fe-muted/50"
                                }`}
                            >
                                {MARKA_LOGOLARI[brand.name] ? (
                                    <img src={MARKA_LOGOLARI[brand.name]} alt={brand.name} className="h-7 w-auto object-contain" />
                                ) : (
                                    <span className="font-bold text-white text-sm">{brand.name}</span>
                                )}
                                <span className="mt-0.5 text-[11px] font-semibold text-fe-text">{brand.name}</span>
                                {BRAND_CHIPS[brand.name] && (
                                    <span className="mt-1 inline-block rounded-full bg-brand/12 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-brand leading-snug whitespace-nowrap">
                                        {BRAND_CHIPS[brand.name]}
                                    </span>
                                )}
                                {selectedBrandId === brand.id && (
                                    <div className="absolute -top-2 -right-2 bg-brand-500 text-[#1a0f08] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
                                        <Check size={12} weight="bold" />
                                    </div>
                                )}
                            </button>
                        ))}
                </div>
            </div>

            {/* Model — her zaman render edilir, boş iken de alan rezerve edilir */}
            <div className="min-h-[72px]">
                {filteredModels.length >= 1 && (
                    <div>
                        <label className="block text-sm font-semibold text-white mb-3">Levha Modeli</label>
                        <div className="grid grid-cols-3 gap-2">
                            {filteredModels.map(model => {
                                const meta = MODEL_META[model];
                                const isSelected = selectedModel === model;
                                return (
                                    <button
                                        key={model}
                                        onClick={() => setSelectedModel(model)}
                                        className={`flex flex-col items-center justify-center text-center px-2 py-2.5 rounded-xl border-2 transition-all min-h-[5rem] ${
                                            isSelected
                                                ? "bg-fe-surface border-brand-500 text-white shadow-lg shadow-brand-500/10"
                                                : "bg-fe-surface border-fe-border text-fe-text hover:border-fe-muted/50"
                                        }`}
                                    >
                                        <span className="font-bold text-sm leading-tight">{model}</span>
                                        {meta?.chip && (
                                            <span className="mt-1 inline-block rounded-full bg-brand/12 px-2 py-0.5 text-[9px] font-medium leading-snug text-brand whitespace-nowrap">
                                                {meta.chip}
                                            </span>
                                        )}
                                        {meta?.desc && (
                                            <span className="mt-1 text-[10px] text-fe-muted leading-snug">
                                                {meta.desc}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 flex items-center justify-center">
                <a
                    href="/iletisim"
                    className="text-xs text-fe-muted underline underline-offset-4 hover:text-fe-text transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded"
                >
                    Emin değilim, benimle iletişime geçin
                </a>
            </div>
        </motion.div>
    );
}
