'use client';

import { motion, AnimatePresence } from "framer-motion";
import {
    Truck, Package, WarningCircle, CheckCircle, Confetti,
    CaretUp, ArrowBendDownRight, Lightbulb,
} from "@phosphor-icons/react";
import { useEffect, useRef, type ComponentType } from "react";
import type { LogisticsCapacity, ShippingZone } from "@/lib/types";

export type MetrajValidation =
    | { isValid: true }
    | { isValid: false; kind: 'min_order'; minOrder: number }
    | { isValid: false; kind: 'full_vehicle'; suggestions: { m2: number; label: string }[] };

type IconCmp = ComponentType<{ size?: number; weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'; className?: string }>;

interface WizardStep4Props {
    metraj: string;
    setMetraj: (v: string) => void;
    currentLogistics: LogisticsCapacity | null;
    selectedKalinlik: string;
    shippingZones: ShippingZone[];
    selectedCityCode: number | null;
    selectedMalzeme: 'tasyunu' | 'eps';
    validation: MetrajValidation;
}

type Tier = 'parsiyel' | 'kamyon' | 'tir';

function getTier(m2: number, lorryM2: number, truckM2: number): Tier {
    if (m2 >= truckM2) return 'tir';
    if (m2 >= lorryM2) return 'kamyon';
    return 'parsiyel';
}

const TIER_CONFIG: Record<Tier, { label: string; Icon: IconCmp; iconWeight: 'regular' | 'fill' | 'bold'; ring: string; bg: string; text: string }> = {
    parsiyel: { label: 'Kısmi Yük',     Icon: Package, iconWeight: 'regular', ring: 'ring-fe-muted',  bg: 'bg-fe-raised',    text: 'text-fe-text' },
    kamyon:   { label: 'Kamyon Dolusu', Icon: Truck,   iconWeight: 'regular', ring: 'ring-brand-500',  bg: 'bg-brand-900/40', text: 'text-brand-300' },
    tir:      { label: 'TIR Dolusu',    Icon: Truck,   iconWeight: 'fill',    ring: 'ring-brand-500',  bg: 'bg-brand-900/40', text: 'text-brand-300'  },
};

export function WizardStep4({
    metraj, setMetraj,
    currentLogistics, selectedKalinlik,
    shippingZones, selectedCityCode,
    selectedMalzeme, validation,
}: WizardStep4Props) {
    const didPrefillMetraj = useRef(false);
    const m2 = parseFloat(metraj) || 0;
    const lorryM2   = currentLogistics?.lorry_capacity_m2        ?? 480;
    const truckM2   = currentLogistics?.truck_capacity_m2        ?? 1200;
    const pkgSizeM2 = currentLogistics?.package_size_m2          ?? 7.2;
    const lorryPkgs = currentLogistics?.lorry_capacity_packages  ?? 0;
    const truckPkgs = currentLogistics?.truck_capacity_packages  ?? 0;

    const hasVal = m2 > 0;
    const suggestedStartM2 = selectedMalzeme === 'tasyunu' && lorryM2 > 0
        ? Math.round(lorryM2)
        : null;

    useEffect(() => {
        if (didPrefillMetraj.current) return;
        if (selectedMalzeme !== 'tasyunu' || suggestedStartM2 == null) return;
        if (metraj.trim() !== '') return;

        didPrefillMetraj.current = true;
        setMetraj(String(suggestedStartM2));
    }, [metraj, selectedMalzeme, setMetraj, suggestedStartM2]);

    // Ham paket yuvarlama (kullanıcı girdisinden)
    const rawPkgCount  = hasVal ? Math.ceil(m2 / pkgSizeM2) : 0;
    const rawRoundedM2 = rawPkgCount * pkgSizeM2;
    const showRound    = hasVal && Math.abs(rawRoundedM2 - m2) > 0.05;

    // ±15 m² toleranslı araç sınırına otomatik yuvarlama
    const SNAP_THRESHOLD = 15;
    const snapBoundaries: number[] = [];
    if (hasVal && lorryM2 > 0) snapBoundaries.push(lorryM2);
    if (hasVal && truckM2 > 0) {
        const maxN = Math.max(3, Math.ceil((rawRoundedM2 + SNAP_THRESHOLD) / truckM2) + 1);
        for (let n = 1; n <= maxN; n++) snapBoundaries.push(n * truckM2);
    }
    const snapTarget = hasVal
        ? snapBoundaries.reduce<number | null>((best, b) => {
            const diff = Math.abs(rawRoundedM2 - b);
            if (diff > SNAP_THRESHOLD) return best;
            if (best === null) return b;
            return diff < Math.abs(rawRoundedM2 - best) ? b : best;
        }, null)
        : null;

    // Nihai sipariş değerleri (snap sonrası)
    const pkgCount  = snapTarget !== null ? Math.round(snapTarget / pkgSizeM2) : rawPkgCount;
    const roundedM2 = pkgCount * pkgSizeM2;
    const isSnapped = snapTarget !== null && Math.abs(roundedM2 - rawRoundedM2) > 0.05;
    const snapLabel = isSnapped
        ? (snapTarget === lorryM2
            ? 'Kamyon tam dolu'
            : `${Math.round(snapTarget! / truckM2)} TIR tam dolu`)
        : null;

    // Tier hesabı (roundedM2 üzerinden)
    const rawTier       = hasVal ? getTier(m2, lorryM2, truckM2) : 'parsiyel';
    const effectiveTier = hasVal ? getTier(roundedM2, lorryM2, truckM2) : 'parsiyel';
    const tier          = effectiveTier;
    const roundingBonus = (showRound || isSnapped) && effectiveTier !== rawTier;

    // Progress bar yüzdeleri
    const lorryPct = Math.min((roundedM2 / lorryM2) * 100, 100);
    const truckPct = Math.min((roundedM2 / truckM2) * 100, 100);

    // Çoklu araç hesabı
    const isMultiVehicle  = hasVal && roundedM2 > truckM2;
    const fullTirCount    = isMultiVehicle ? Math.floor(roundedM2 / truckM2) : 0;
    const remainAfterTir  = isMultiVehicle ? roundedM2 - fullTirCount * truckM2 : 0;
    const remainKisiPaket = remainAfterTir > 0.1 ? Math.ceil(remainAfterTir / pkgSizeM2) : 0;

    // Bir sonraki tam araca kaç paket eksik
    const pkgsToLorry = (tier === 'parsiyel' && lorryPkgs > pkgCount) ? lorryPkgs - pkgCount : 0;
    const pkgsToTir   = (tier === 'kamyon'   && truckPkgs > pkgCount) ? truckPkgs - pkgCount : 0;

    // Multi: kısmi yükü bir sonraki tam TIR'a tamamlamak için gereken paket
    const pkgsToCompleteTir = (isMultiVehicle && truckPkgs > 0 && remainKisiPaket > 0)
        ? truckPkgs - remainKisiPaket : 0;
    const m2ToCompleteTir = pkgsToCompleteTir * pkgSizeM2;
    const FILL_THRESHOLD = 10;

    // Bölge iskonto oranları
    const selectedZone = shippingZones.find(z => z.city_code === selectedCityCode);
    const discTir    = selectedZone?.discount_tir    ?? null;
    const discKamyon = selectedZone?.discount_kamyon ?? null;
    const isFullVehicleInvalid = !validation.isValid && validation.kind === 'full_vehicle';

    const formatM2 = (value: number) => Math.round(value).toLocaleString('tr-TR');
    const isWholeNumber = (value: number) => Math.abs(value - Math.round(value)) < 0.05;
    const formatDeltaM2 = (value: number) => value.toLocaleString('tr-TR', {
        minimumFractionDigits: isWholeNumber(value) ? 0 : 1,
        maximumFractionDigits: 1,
    });
    const vehicleBenefitText = (label: string) => {
        const upperLabel = label.toLocaleUpperCase('tr-TR');
        if (upperLabel.includes('TIR')) {
            return discTir != null
                ? `%${discTir} TIR iskontosu · nakliye fiyata dahil`
                : 'TIR dolusu · nakliye fiyata dahil';
        }

        return discKamyon != null
            ? `%${discKamyon} kamyon iskontosu · nakliye fiyata dahil`
            : 'Kamyon dolusu · nakliye fiyata dahil';
    };
    const vehiclePresets = selectedMalzeme === 'tasyunu'
        ? [
            {
                key: 'kamyon',
                label: 'Kamyon dolusu',
                m2: Math.round(lorryM2),
                benefit: discKamyon != null ? `%${discKamyon} bölge iskontosu` : 'Tam araç siparişi',
            },
            {
                key: 'tir',
                label: 'TIR dolusu',
                m2: Math.round(truckM2),
                benefit: discTir != null ? `%${discTir} bölge iskontosu` : 'Tam araç siparişi',
            },
        ]
        : [];
    const fullVehicleOptions = isFullVehicleInvalid
        ? validation.suggestions
            .map(opt => ({ ...opt, roundedM2: Math.round(opt.m2) }))
            .sort((a, b) => a.m2 - b.m2)
        : [];
    const currentOrderM2 = hasVal ? roundedM2 : m2;
    const primaryFullVehicleOption = fullVehicleOptions.find(opt => opt.m2 >= currentOrderM2 - 0.05)
        ?? fullVehicleOptions[0]
        ?? null;
    const primaryDeltaM2 = primaryFullVehicleOption
        ? Math.max(0, primaryFullVehicleOption.m2 - currentOrderM2)
        : 0;
    const secondaryFullVehicleOptions = fullVehicleOptions
        .filter(opt => opt.roundedM2 !== primaryFullVehicleOption?.roundedM2)
        .slice(0, 3);

    // Nudge mesajı
    type NudgeType =
        | { remainingPkgs: number; target: 'kamyon' | 'tir'; pct: number }
        | { done: true; pct: number }
        | { bonus: true; tier: 'kamyon' | 'tir'; pct: number }
        | { multi: true; pct: number | null };
    let nudge: NudgeType | null = null;
    if (hasVal) {
        if (isMultiVehicle) {
            nudge = { multi: true, pct: discTir };
        } else if (roundingBonus) {
            const bonusPct = effectiveTier === 'tir' ? discTir : discKamyon;
            if (bonusPct != null) nudge = { bonus: true, tier: effectiveTier as 'kamyon' | 'tir', pct: bonusPct };
        } else if (tier === 'parsiyel' && discKamyon != null && pkgsToLorry > 0) {
            nudge = { remainingPkgs: pkgsToLorry, target: 'kamyon', pct: discKamyon };
        } else if (tier === 'kamyon' && discTir != null && pkgsToTir > 0) {
            nudge = { remainingPkgs: pkgsToTir, target: 'tir', pct: discTir };
        } else if (tier === 'tir' && discTir != null) {
            nudge = { done: true, pct: discTir };
        }
    }

    return (
        <motion.div
            key="step4"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
        >
            {/* m² input */}
            <div className="mb-4">
                <label className="block text-sm font-semibold text-white mb-2">
                    Sipariş metrajı
                </label>
                <p className="mt-2 text-sm text-fe-muted leading-relaxed">
                    {selectedMalzeme === 'tasyunu' && suggestedStartM2 != null
                        ? `${selectedKalinlik} cm levhada ${suggestedStartM2.toLocaleString('tr-TR')} m² kamyon dolusu seçili gelir. TIR dolusuna geçebilir veya kendi metrajınızı yazabilirsiniz.`
                        : 'Cephe alanınızı yazın; sistem paket metrajına göre sipariş miktarını hesaplar.'}
                </p>
                {vehiclePresets.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        {vehiclePresets.map((preset) => {
                            const isSelectedPreset = hasVal
                                && validation.isValid
                                && Math.abs(Math.round(roundedM2) - preset.m2) <= 1;

                            return (
                                <button
                                    key={preset.key}
                                    type="button"
                                    onClick={() => setMetraj(String(preset.m2))}
                                    className={`rounded-xl border px-3 py-3 text-left transition-all ${
                                        isSelectedPreset
                                            ? 'border-brand-500 bg-brand-900/35 shadow-lg shadow-brand-600/10'
                                            : 'border-fe-border bg-fe-surface hover:border-brand-600/60 hover:bg-fe-raised'
                                    }`}
                                >
                                    <span className={`mb-1 flex items-center gap-1.5 text-xs font-bold ${
                                        isSelectedPreset ? 'text-brand-200' : 'text-white'
                                    }`}>
                                        <Truck size={15} weight={preset.key === 'tir' ? 'fill' : 'regular'} />
                                        {preset.label}
                                    </span>
                                    <span className="block text-xl font-black tabular-nums text-white">
                                        {formatM2(preset.m2)} m²
                                    </span>
                                    <span className="mt-1 block text-[11px] font-semibold text-brand-300">
                                        {preset.benefit}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
                <div className="relative mt-3">
                    <input
                        type="number"
                        min="1"
                        value={metraj}
                        onChange={e => setMetraj(e.target.value)}
                        className={`w-full px-4 py-4 border rounded-xl bg-fe-bg text-white text-xl font-bold focus:ring-1 outline-none transition-all tabular-nums pr-16 ${
                            !validation.isValid
                                ? 'border-red-500/60 focus:ring-red-500/30 focus:border-red-500/80'
                                : 'border-fe-border focus:ring-brand-500/40 focus:border-brand-500'
                        }`}
                        autoFocus
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-fe-muted font-bold text-lg">m²</span>
                </div>

                {/* Validation: EPS minimum sipariş uyarısı */}
                {!validation.isValid && validation.kind === 'min_order' && (
                    <div className="mt-2 p-3 rounded-xl border bg-red-900/15 border-red-700/40">
                        <p className="text-sm font-semibold text-red-300 mb-1 flex items-center gap-1.5">
                            <WarningCircle size={16} weight="fill" /> Minimum sipariş {validation.minOrder} m²
                        </p>
                        <p className="text-xs text-red-200/80">
                            Bu metrajın altındaki siparişlerde nakliye masrafı maliyeti karşılamaz.
                            Lütfen <span className="font-bold">{validation.minOrder} m²</span> veya üzerinde bir değer girin.
                        </p>
                        <button
                            type="button"
                            onClick={() => setMetraj(String(validation.minOrder))}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-200 underline decoration-dotted underline-offset-2 hover:decoration-solid"
                        >
                            <ArrowBendDownRight size={14} weight="bold" /> {validation.minOrder} m²&apos;ye yuvarla
                        </button>
                    </div>
                )}

                {/* Validation: Taşyünü tam-araç kuralı bilgi paneli */}
                {!validation.isValid && validation.kind === 'full_vehicle' && (
                    <div className="mt-2 p-3 rounded-xl border bg-amber-900/15 border-amber-700/40">
                        <p className="text-sm font-semibold text-amber-200 mb-1 flex items-center gap-1.5">
                            <Truck size={16} weight="fill" /> Bu metraj tam araç düzenine uymuyor
                        </p>
                        <p className="text-xs text-amber-100/80">
                            Taşyünü siparişi tam Kamyon/TIR metrajına göre ilerler.
                            Araç dolu olmadığında nakliye ayrıca ücretlendirilir.
                        </p>
                        {primaryFullVehicleOption && (
                            <button
                                type="button"
                                onClick={() => setMetraj(String(primaryFullVehicleOption.roundedM2))}
                                className="mt-3 w-full rounded-xl border border-amber-500/55 bg-amber-900/35 px-3 py-3 text-left transition-colors hover:border-amber-400 hover:bg-amber-800/40"
                            >
                                <span className="block text-[11px] font-bold uppercase tracking-wide text-amber-300">
                                    En yakın geçerli metraj
                                </span>
                                <span className="mt-1 block text-xl font-black tabular-nums text-white">
                                    {formatM2(primaryFullVehicleOption.m2)} m² · {primaryFullVehicleOption.label}
                                </span>
                                <span className="mt-1 block text-xs font-semibold text-amber-100/90">
                                    {primaryDeltaM2 > 0
                                        ? `${formatDeltaM2(primaryDeltaM2)} m² eklenir`
                                        : 'Metraj bu seçeneğe alınır'}
                                    {' '}· {vehicleBenefitText(primaryFullVehicleOption.label)}
                                </span>
                            </button>
                        )}
                        {secondaryFullVehicleOptions.length > 0 && (
                            <div className="mt-2">
                                <p className="mb-1 text-[11px] font-semibold text-amber-100/70">
                                    Diğer geçerli seçenekler
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {secondaryFullVehicleOptions.map((opt) => (
                                        <button
                                            key={`${opt.m2}-${opt.label}`}
                                            type="button"
                                            onClick={() => setMetraj(String(opt.roundedM2))}
                                            className="rounded-full border border-amber-600/35 bg-amber-950/25 px-3 py-1.5 text-[11px] font-semibold text-amber-100 hover:border-amber-500/60 hover:bg-amber-800/35 transition-colors"
                                        >
                                            {formatM2(opt.m2)} m² · {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {/* Yuvarlama / snap gösterimi */}
                {isSnapped && (
                    <div className="mt-2 rounded-xl border border-blue-700/35 bg-blue-900/15 p-3">
                        <p className="text-[11px] leading-relaxed text-blue-100/90">
                            Bu metrajı <span className="font-bold text-white">{roundedM2.toFixed(1)} m²</span>&apos;ye yuvarladık.
                            Tam dolu araç eşiğinde olmanız için; bu sayede bölge iskontosu uygulanır.
                        </p>
                    </div>
                )}
                {isSnapped && (
                    <p className="mt-1.5 text-xs text-fe-muted inline-flex items-center gap-1 flex-wrap">
                        <ArrowBendDownRight size={12} weight="bold" />
                        {m2.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} m² →{' '}
                        <span className="font-bold text-white">{roundedM2.toFixed(1)} m²</span>{' '}
                        ({pkgCount} paket × {pkgSizeM2} m²) —{' '}
                        <span className="font-bold text-green-400">{snapLabel}</span>
                    </p>
                )}
                {!isSnapped && showRound && (
                    <p className="mt-1.5 text-xs text-brand-400/80 inline-flex items-center gap-1 flex-wrap">
                        <ArrowBendDownRight size={12} weight="bold" />
                        Sipariş {roundedM2.toFixed(1)} m² olacak ({pkgCount} paket × {pkgSizeM2} m²)
                        {isMultiVehicle && (
                            <span className="text-brand-300/80">
                                {' '}— {fullTirCount} TIR{remainKisiPaket > 0 ? ` + ${remainKisiPaket} paket kısmi` : ' (tam dolu)'}
                            </span>
                        )}
                    </p>
                )}
                {hasVal && !showRound && !isSnapped && pkgCount > 0 && (
                    <p className="mt-1.5 text-xs text-fe-muted">
                        {pkgCount} paket × {pkgSizeM2} m²
                    </p>
                )}
            </div>

            {/* Tier badge row */}
            {!isFullVehicleInvalid && (
                <div className="flex gap-2 mb-4">
                    {(['parsiyel', 'kamyon', 'tir'] as Tier[]).map(t => {
                        const cfg = TIER_CONFIG[t];
                        const isActive = tier === t && hasVal;
                        const isPast   = hasVal && (
                            (t === 'parsiyel') ||
                            (t === 'kamyon' && (tier === 'kamyon' || tier === 'tir')) ||
                            (t === 'tir'    && tier === 'tir')
                        );
                        return (
                            <div
                                key={t}
                                className={`flex-1 flex flex-col items-center py-2 px-1 rounded-xl border transition-all duration-300 ${
                                    isActive
                                        ? `${cfg.bg} border-transparent ring-1 ${cfg.ring}`
                                        : isPast && t !== tier
                                            ? 'bg-fe-raised/40 border-fe-border/50 opacity-50'
                                            : 'bg-fe-surface border-fe-border'
                                }`}
                            >
                                <cfg.Icon
                                    size={20}
                                    weight={isActive ? 'fill' : 'regular'}
                                    className={`mb-0.5 ${isActive ? 'text-brand-200' : 'text-fe-muted/60'}`}
                                />
                                <span className={`text-[10px] font-bold text-center leading-tight ${isActive ? 'text-brand-200' : 'text-fe-muted/70'}`}>
                                    {cfg.label}
                                </span>
                                {/* İskonto oranı badge */}
                                {t === 'kamyon' && discKamyon != null && (
                                    <span className={`mt-1 text-[10px] font-bold tabular-nums ${isActive ? 'text-brand-200' : 'text-fe-muted/60'}`}>
                                        %{discKamyon}
                                    </span>
                                )}
                                {t === 'tir' && discTir != null && (
                                    <span className={`mt-1 text-[10px] font-bold tabular-nums ${isActive ? 'text-brand-200' : 'text-fe-muted/60'}`}>
                                        {isActive && isMultiVehicle ? `×${fullTirCount} TIR` : `%${discTir}`}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Progress bars / Araç Planı */}
            {currentLogistics && (
                isMultiVehicle ? (
                    <div className="space-y-2 mb-4">
                        <div className="text-[10px] text-fe-muted uppercase tracking-wider mb-1">Araç Planı</div>
                        {Array.from({ length: fullTirCount }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span className="text-xs text-fe-muted w-16 shrink-0 inline-flex items-center gap-1"><Truck size={14} weight="fill" /> TIR {i + 1}</span>
                                <div className="flex-1 h-2 bg-fe-raised rounded-full overflow-hidden">
                                    <div className="h-full w-full bg-brand-400 rounded-full" />
                                </div>
                                <span className="text-xs font-bold tabular-nums text-brand-300 w-20 text-right shrink-0">
                                    {truckM2.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²
                                </span>
                            </div>
                        ))}
                        {remainKisiPaket > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-fe-muted w-16 shrink-0 inline-flex items-center gap-1"><Package size={14} /> Kısmi</span>
                                <div className="flex-1 h-2 bg-fe-raised rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-fe-muted/60 rounded-full"
                                        style={{ width: `${Math.min((remainAfterTir / truckM2) * 100, 100)}%` }}
                                    />
                                </div>
                                <span className="text-xs text-fe-muted tabular-nums w-20 text-right shrink-0">
                                    {remainKisiPaket} paket
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2.5 mb-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-fe-muted inline-flex items-center gap-1"><Truck size={14} /> Kamyon</span>
                                <span className={`text-xs font-bold tabular-nums ${lorryPct >= 100 ? 'text-brand-300' : 'text-fe-muted'}`}>
                                    {hasVal
                                        ? `${roundedM2.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} / ${Math.round(lorryM2).toLocaleString('tr-TR')} m²`
                                        : `${Math.round(lorryM2)} m²`}
                                </span>
                            </div>
                            <div className="h-2.5 bg-fe-raised rounded-full overflow-hidden">
                                <motion.div
                                    className={`h-full rounded-full ${lorryPct >= 100 ? 'bg-brand-400' : 'bg-brand-500/70'}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${lorryPct}%` }}
                                    transition={{ duration: 0.45, ease: "easeOut" }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-fe-muted inline-flex items-center gap-1"><Truck size={14} weight="fill" /> TIR</span>
                                <span className={`text-xs font-bold tabular-nums ${truckPct >= 100 ? 'text-brand-300' : 'text-fe-muted'}`}>
                                    {hasVal
                                        ? `${roundedM2.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} / ${Math.round(truckM2).toLocaleString('tr-TR')} m²`
                                        : `${Math.round(truckM2)} m²`}
                                </span>
                            </div>
                            <div className="h-2.5 bg-fe-raised rounded-full overflow-hidden">
                                <motion.div
                                    className={`h-full rounded-full ${truckPct >= 100 ? 'bg-brand-400' : 'bg-brand-500/70'}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${truckPct}%` }}
                                    transition={{ duration: 0.45, ease: "easeOut" }}
                                />
                            </div>
                        </div>
                    </div>
                )
            )}

            {/* Nudge / tebrik mesajı */}
            <AnimatePresence mode="wait">
                {!isFullVehicleInvalid && 'multi' in (nudge ?? {}) && nudge && (
                    <motion.div
                        key="multi"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className={remainKisiPaket === 0
                            ? 'p-3 rounded-xl border bg-green-900/20 border-green-700/40'
                            : 'p-3 rounded-xl border bg-brand-900/20 border-brand-700/40'}
                    >
                        {/* Başlık */}
                        <p className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                            <Truck size={16} weight="fill" /> {fullTirCount} TIR
                            {remainKisiPaket > 0
                                ? <> + <span className="text-brand-300">{remainAfterTir.toFixed(1)} m² TIR kapasitesi aşımı</span></>
                                : <span className="text-green-300"> — Tam Doluluk</span>
                            }
                        </p>
                        {remainKisiPaket > 0 && (
                            <>
                                {/* Bilgi: 1 TIR ve üzeri varyasyonlarda TIR iskontosu zaten uygulanır */}
                                {fullTirCount >= 1 && (nudge as any).pct != null && (
                                    <div className="flex items-start gap-2 p-2 rounded-lg bg-green-900/20 border border-green-700/30 mb-1.5">
                                        <CheckCircle size={16} weight="fill" className="text-green-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-green-200">
                                            1 TIR ve üzeri Kamyon + TIR varyasyonlarında{' '}
                                            <span className="font-bold text-green-100">%{(nudge as any).pct} TIR iskontosu</span>{' '}
                                            uygulanır.
                                        </p>
                                    </div>
                                )}
                                {/* Seçenek: Ekle → sonraki TIR (sadece yakınsa) — nakliye optimizasyonu */}
                                {pkgsToCompleteTir > 0 && pkgsToCompleteTir <= FILL_THRESHOLD ? (
                                    <div className="flex items-start gap-2 p-2 rounded-lg bg-brand-900/20 border border-brand-700/30">
                                        <CaretUp size={16} weight="bold" className="text-brand-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs text-brand-300">
                                                <span className="font-bold">{m2ToCompleteTir.toFixed(1)} m² ({pkgsToCompleteTir} paket) ekleyin</span>
                                                {' '}→ {fullTirCount + 1}. TIR tam dolar · nakliye fiyata dahildir
                                            </p>
                                            <p className="mt-1 text-[11px] text-brand-300/80">
                                                Bu fiyat tam dolu araç sipariş koşulunda geçerlidir; altında kalındığında nakliye ayrıca ücretlendirilir.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-brand-400/70 inline-flex items-center gap-1">
                                        <WarningCircle size={12} weight="fill" /> Kısmi yük ({remainKisiPaket} paket · {remainAfterTir.toFixed(1)} m²) için nakliye ayrıca ücretlendirilir
                                    </p>
                                )}
                            </>
                        )}
                        {(nudge as any).pct != null && remainKisiPaket === 0 && (
                            <>
                                <p className="text-xs text-white">
                                    TIR&apos;lara <span className="font-bold text-green-300">%{(nudge as any).pct}</span> bölge iskontosu uygulanır · nakliye fiyata dahildir
                                </p>
                                <p className="mt-1 text-[11px] text-green-200/80">
                                    Bu fiyat tam dolu araç sipariş koşulunda geçerlidir; altında kalındığında nakliye ayrıca ücretlendirilir.
                                </p>
                            </>
                        )}
                    </motion.div>
                )}
                {!isFullVehicleInvalid && 'remainingPkgs' in (nudge ?? {}) && nudge && (
                    <motion.div
                        key={(nudge as any).target}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className={`p-3 rounded-xl border ${ (nudge as any).target === 'kamyon' ? 'bg-brand-900/20 border-brand-700/40' : 'bg-brand-900/20 border-brand-700/40' }`}
                    >
                        <p className="text-sm font-bold text-white mb-1 flex items-center gap-1.5">
                            <Truck size={16} weight={(nudge as any).target === 'kamyon' ? 'regular' : 'fill'} />
                            {(nudge as any).target === 'kamyon' ? 'Kamyona' : "TIR'a"}{' '}
                            <span className="text-brand-300">
                                {((nudge as any).remainingPkgs * pkgSizeM2).toFixed(1)} m² kaldı
                            </span>
                        </p>
                        {(nudge as any).target === 'kamyon' ? (
                            <>
                                <p className="text-xs text-brand-300">
                                    <button
                                        type="button"
                                        onClick={() => setMetraj(String(Math.round((rawPkgCount + (nudge as any).remainingPkgs) * pkgSizeM2)))}
                                        className="inline-flex items-center gap-1 font-semibold underline decoration-dotted underline-offset-2 hover:text-hub-warm hover:decoration-solid transition-colors"
                                    >
                                        <CaretUp size={12} weight="bold" /> {((nudge as any).remainingPkgs * pkgSizeM2).toFixed(1)} m² ekleyin
                                    </button>
                                    {' '}→ nakliye fiyata dahildir + <span className="font-bold text-brand-200">%{(nudge as any).pct}</span> iskonto!
                                </p>
                                <p className="mt-1 text-[11px] text-brand-300/80">
                                    Bu fiyat tam dolu araç sipariş koşulunda geçerlidir; altında kalındığında nakliye ayrıca ücretlendirilir.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-xs text-brand-300">
                                    <button
                                        type="button"
                                        onClick={() => setMetraj(String(Math.round((rawPkgCount + (nudge as any).remainingPkgs) * pkgSizeM2)))}
                                        className="inline-flex items-center gap-1 font-semibold underline decoration-dotted underline-offset-2 hover:text-hub-warm hover:decoration-solid transition-colors"
                                    >
                                        <CaretUp size={12} weight="bold" /> {((nudge as any).remainingPkgs * pkgSizeM2).toFixed(1)} m² daha ekleyin
                                    </button>{' '}
                                    {discKamyon != null && (nudge as any).pct > discKamyon && (
                                        <><span className="font-bold text-brand-200">%{(nudge as any).pct - discKamyon} ekstra iskontolu</span>{' '}</>
                                    )}
                                    → <span className="font-bold text-brand-200">%{(nudge as any).pct}</span> TIR iskontosu kazanıyorsunuz
                                </p>
                                <p className="mt-1 text-[11px] text-brand-300/80">
                                    Tam dolu TIR siparişinde nakliye fiyata dahildir; altında kalındığında nakliye ayrıca ücretlendirilir.
                                </p>
                            </>
                        )}
                    </motion.div>
                )}
                {!isFullVehicleInvalid && 'bonus' in (nudge ?? {}) && nudge && (
                    <motion.div
                        key="bonus"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.25 }}
                        className={(nudge as any).tier === 'tir'
                            ? 'p-3 rounded-xl border bg-brand-900/25 border-brand-600/50'
                            : 'p-3 rounded-xl border bg-brand-900/25 border-brand-600/50'}
                    >
                        <p className="text-sm font-medium text-brand-300 inline-flex items-center gap-1.5 flex-wrap">
                            <Confetti size={16} weight="fill" className="text-amber-400" />
                            {(nudge as any).tier === 'tir' ? 'TIR tam dolu' : 'Kamyon tam dolu'} —{' '}
                            <span className="font-bold text-brand-200">
                                %{(nudge as any).pct}
                            </span>{' '}
                            bölge iskontosu uygulandı, nakliye fiyata dahildir.
                        </p>
                    </motion.div>
                )}
                {!isFullVehicleInvalid && 'done' in (nudge ?? {}) && nudge && !('bonus' in (nudge ?? {})) && (
                    <motion.div
                        key="done"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="p-3 rounded-xl border bg-brand-900/20 border-brand-700/40"
                    >
                        <p className="text-sm font-medium text-brand-300 inline-flex items-center gap-1.5 flex-wrap">
                            <Truck size={16} weight="fill" /> TIR doldu —{' '}
                            <span className="font-bold text-brand-200">%{(nudge as any).pct}</span>{' '}
                            bölge iskontosu uygulandı, nakliye fiyata dahildir.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* TIR avantajı bilgi notu */}
            {hasVal && !isFullVehicleInvalid && tier !== 'tir' && discTir != null && (
                <p className="mt-2 text-[11px] text-fe-muted text-center leading-relaxed inline-flex items-center justify-center gap-1 flex-wrap">
                    <Lightbulb size={12} weight="fill" className="text-amber-400" /> Tam dolu TIR siparişinde nakliye fiyata dahildir +{' '}
                    <span className="text-fe-muted font-semibold">%{discTir}</span>{' '}
                    bölge iskontosu uygulanır
                    {discKamyon != null && discTir > discKamyon
                        ? ` (kamyon iskontosu %${discKamyon})`
                        : ''}
                </p>
            )}

            {!hasVal && currentLogistics && (
                <p className="text-xs text-fe-muted text-center mt-2">
                    {selectedKalinlik}cm kalınlık: kamyon {Math.round(lorryM2)} m² · TIR {Math.round(truckM2)} m²
                </p>
            )}
        </motion.div>
    );
}
