'use client';

import { motion } from "framer-motion";

const KALINLIKLAR = [
    { value: "3",  label: "3cm"  },
    { value: "4",  label: "4cm"  },
    { value: "5",  label: "5cm"  },
    { value: "6",  label: "6cm"  },
    { value: "8",  label: "8cm"  },
    { value: "10", label: "10cm", popular: true },
    { value: "12", label: "12cm" },
    { value: "15", label: "15cm" },
];

interface WizardStep2Props {
    selectedKalinlik: string;
    setSelectedKalinlik: (v: string) => void;
}

export function WizardStep2({ selectedKalinlik, setSelectedKalinlik }: WizardStep2Props) {
    return (
        <motion.div
            key="step2"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
        >
            <label className="block text-sm font-semibold text-white mb-4">Yalıtım Kalınlığını Seçin</label>
            <p className="mt-2 text-sm text-fe-muted leading-relaxed">
                Apartman/villa için <strong className="text-fe-text">5–6 cm</strong> ılıman bölgelerde, <strong className="text-fe-text">8–10 cm</strong> soğuk bölgelerde standart. 10 cm &quot;Popüler&quot; çünkü EKB hedefini büyük çoğunlukla karşılar.
            </p>
            <div className="grid grid-cols-4 gap-3">
                {KALINLIKLAR.map(k => (
                    <button
                        key={k.value}
                        onClick={() => setSelectedKalinlik(k.value)}
                        className={`relative py-4 rounded-xl border-2 font-bold text-base transition-all ${
                            selectedKalinlik === k.value
                                ? "bg-fe-surface border-brand-500 text-white shadow-lg shadow-brand-500/20"
                                : "bg-fe-surface border-fe-border text-fe-text hover:border-fe-muted/50"
                        }`}
                    >
                        {k.label}
                        {k.popular && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded-full bg-green-500 text-white font-bold whitespace-nowrap">
                                Popüler
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </motion.div>
    );
}
