'use client';

import { motion } from "framer-motion";
import type { ShippingZone } from "@/lib/types";
import { citySubRegionQuestion, type BonusSubRegionChoice } from "@/lib/pricing/bonus/subRegions";

interface WizardStep3Props {
    shippingZones: ShippingZone[];
    selectedCityCode: number | null;
    onCityChange: (code: number) => void;
    citySubRegion: BonusSubRegionChoice | null;
    onCitySubRegionChange: (value: BonusSubRegionChoice | null) => void;
}

// Bonus bölge haritası gereği iki ilde teslimat alt-bölgesi sorulur:
// İstanbul (Avrupa/Anadolu yakası) ve Kocaeli (Gebze/diğer ilçeler).
const SUB_REGION_UI: Record<string, { label: string; options: Array<{ value: BonusSubRegionChoice; text: string }> }> = {
    yaka: {
        label: 'Teslimat Yakası',
        options: [
            { value: 'avrupa',  text: 'Avrupa Yakası' },
            { value: 'anadolu', text: 'Anadolu Yakası' },
        ],
    },
    gebze: {
        label: 'Kocaeli Teslimat Bölgesi',
        options: [
            { value: 'gebze', text: 'Gebze' },
            { value: 'diger', text: 'Diğer ilçeler' },
        ],
    },
};

const ZONE_CONFIG = {
    green:  { emoji: '🟢', label: 'Yeşil Bölge',  bg: 'bg-green-900/30',  border: 'border-green-700/40',  text: 'text-green-300',  sub: 'text-green-400'  },
    yellow: { emoji: '🟡', label: 'Sarı Bölge',    bg: 'bg-yellow-900/30', border: 'border-yellow-700/40', text: 'text-yellow-300', sub: 'text-yellow-400' },
    red:    { emoji: '🔴', label: 'Kırmızı Bölge', bg: 'bg-red-900/30',    border: 'border-red-700/40',    text: 'text-red-300',    sub: 'text-red-400'    },
} as const;

const PRIORITY_CITIES = ["İstanbul", "Kocaeli", "Bolu", "Sakarya", "Düzce", "Tekirdağ", "Yalova", "Bursa", "Balıkesir"];

export function WizardStep3({
    shippingZones, selectedCityCode, onCityChange,
    citySubRegion, onCitySubRegionChange,
}: WizardStep3Props) {
    const selectedZone = shippingZones.find(z => z.city_code === selectedCityCode);
    const zoneKey = selectedZone?.zone ?? null;
    const cfg = zoneKey ? (ZONE_CONFIG[zoneKey] ?? ZONE_CONFIG.green) : null;

    const subRegionQuestion = selectedCityCode != null ? citySubRegionQuestion(selectedCityCode) : null;
    const subRegionUi = subRegionQuestion ? SUB_REGION_UI[subRegionQuestion.question] : null;

    return (
        <motion.div
            key="step3"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
        >
            <div className="mb-5">
                <label className="block text-sm font-semibold text-white mb-2">Teslimat İli</label>
                <p className="mt-2 text-sm text-fe-muted leading-relaxed">
                    Şehir nakliye tutarını ve iskonto bölgesini belirler. Tam araç dolduğunda iskonto otomatik uygulanır.
                </p>
                <select
                    value={selectedCityCode ?? ""}
                    onChange={e => onCityChange(Number(e.target.value))}
                    className="w-full px-4 py-3.5 border border-fe-border rounded-xl bg-fe-bg text-white focus:ring-1 focus:ring-brand-500/40 focus:border-brand-500 outline-none transition-all text-base"
                >
                    <option value="">İl seçiniz...</option>
                    <optgroup label="Sık Kullanılan">
                        {PRIORITY_CITIES.map(name => {
                            const z = shippingZones.find(z => z.city_name === name);
                            return z ? <option key={z.city_code} value={z.city_code}>{z.city_name}</option> : null;
                        })}
                    </optgroup>
                    <optgroup label="Tüm İller">
                        {shippingZones
                            .filter(z => !PRIORITY_CITIES.includes(z.city_name))
                            .map(z => <option key={z.city_code} value={z.city_code}>{z.city_name}</option>)}
                    </optgroup>
                </select>
            </div>

            {/* Alt-bölge sorusu — yalnız İstanbul (yaka) ve Kocaeli (Gebze) */}
            {subRegionUi && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="mb-5"
                >
                    <label className="block text-sm font-semibold text-white mb-2">{subRegionUi.label}</label>
                    <div className="grid grid-cols-2 gap-3">
                        {subRegionUi.options.map(({ value, text }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => onCitySubRegionChange(value)}
                                className={`px-3 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                                    citySubRegion === value
                                        ? "bg-fe-surface border-brand-500 text-white shadow-lg shadow-brand-500/10"
                                        : "bg-fe-surface border-fe-border text-fe-text hover:border-fe-muted/50"
                                }`}
                            >
                                {text}
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-[11px] text-fe-muted">
                        Bazı markaların fiyat listesi bu ilde teslimat bölgesine göre farklılık gösterir.
                    </p>
                </motion.div>
            )}

            {/* Zone reveal — şehir seçilince açılır */}
            {selectedZone && cfg && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`p-4 rounded-xl border ${cfg.bg} ${cfg.border}`}
                >
                    <div className="flex items-center gap-2 mb-3">
                        <span className={`font-bold text-sm ${cfg.text}`}>{cfg.emoji} {cfg.label}</span>
                        <span className="text-xs text-fe-muted">— {selectedZone.city_name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-fe-surface/60 rounded-lg p-2.5">
                            <div className="text-[10px] text-fe-muted uppercase tracking-wide mb-1">🚛 TIR İskontosu</div>
                            <div className={`text-2xl font-bold tabular-nums ${cfg.sub}`}>%{selectedZone.discount_tir}</div>
                        </div>
                        <div className="bg-fe-surface/60 rounded-lg p-2.5">
                            <div className="text-[10px] text-fe-muted uppercase tracking-wide mb-1">🚚 Kamyon İskontosu</div>
                            <div className={`text-2xl font-bold tabular-nums ${cfg.sub}`}>%{selectedZone.discount_kamyon}</div>
                        </div>
                    </div>
                    <p className="mt-3 text-[11px] text-fe-muted text-center">
                        Bir sonraki adımda metrajınıza göre hangi oran aktif olacağını göreceksiniz.
                    </p>
                </motion.div>
            )}

            {selectedZone?.city_name === 'İstanbul' && (
                <p className="text-[11px] text-fe-muted text-center mt-3">
                    Varsayılan İstanbul. Farklı il için seçim yapın.
                </p>
            )}
        </motion.div>
    );
}
