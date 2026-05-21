'use client';

import { motion } from "framer-motion";
import type { ShippingZone } from "@/lib/types";

interface WizardStep3Props {
    shippingZones: ShippingZone[];
    selectedCityCode: number | null;
    onCityChange: (code: number) => void;
}

const ZONE_CONFIG = {
    green:  { emoji: '🟢', label: 'Yeşil Bölge',  bg: 'bg-green-900/30',  border: 'border-green-700/40',  text: 'text-green-300',  sub: 'text-green-400'  },
    yellow: { emoji: '🟡', label: 'Sarı Bölge',    bg: 'bg-yellow-900/30', border: 'border-yellow-700/40', text: 'text-yellow-300', sub: 'text-yellow-400' },
    red:    { emoji: '🔴', label: 'Kırmızı Bölge', bg: 'bg-red-900/30',    border: 'border-red-700/40',    text: 'text-red-300',    sub: 'text-red-400'    },
} as const;

const PRIORITY_CITIES = ["İstanbul", "Kocaeli", "Bolu", "Sakarya", "Düzce", "Tekirdağ", "Yalova", "Bursa", "Balıkesir"];

export function WizardStep3({ shippingZones, selectedCityCode, onCityChange }: WizardStep3Props) {
    const selectedZone = shippingZones.find(z => z.city_code === selectedCityCode);
    const zoneKey = selectedZone?.zone ?? null;
    const cfg = zoneKey ? (ZONE_CONFIG[zoneKey] ?? ZONE_CONFIG.green) : null;

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
