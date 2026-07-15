"use client";

import { useState } from "react";
import { ExcelImportTab } from "./ExcelImportTab";
import { MarginRulesTab } from "./MarginRulesTab";
import { BrandsTab } from "./BrandsTab";
import { DiscountsTab } from "./DiscountsTab";

// Fiyatlandırma çatısı (audit, 15 Temmuz 2026): dağınık dört fiyat
// sekmesi tek grup altında. Ana giriş Excel ile güncellemedir; eski
// "Fiyatlar" sekmesi bayat olduğu için tamamen kaldırıldı.

const SUB_TABS = [
    { id: "excel-import", label: "Excel ile Güncelle" },
    { id: "margin-rules", label: "Marj Kuralları" },
    { id: "brands", label: "Markalar" },
    { id: "discounts", label: "İskontolar" },
] as const;

type SubTabId = (typeof SUB_TABS)[number]["id"];

export function PricingTab() {
    const [active, setActive] = useState<SubTabId>("excel-import");

    return (
        <div className="space-y-4">
            {/* Fiyat kuralları rehberi (eski Ayarlar sekmesinden taşındı) */}
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 text-sm text-slate-300">
                <span className="font-medium text-white">Kural haritası:</span>{" "}
                kâr marjı kademeleri <span className="text-amber-300">Marj Kuralları</span>&apos;nda,
                marka bazlı marj (ör. Bonus %5) <span className="text-amber-300">Markalar</span>&apos;da,
                şehir/bölge iskontoları <span className="text-amber-300">İskontolar</span>&apos;da yönetilir.
                Marka marjı doluysa malzeme kuralını ezer. KDV %20 — kilitli ticari karar, panelden değiştirilemez.
            </div>

            <div className="flex flex-wrap gap-2">
                {SUB_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActive(tab.id)}
                        className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                            active === tab.id
                                ? "border-[rgba(201,168,76,0.45)] bg-[rgba(201,168,76,0.12)] text-[var(--nx-gold)]"
                                : "border-[rgba(92,98,108,0.24)] bg-[rgba(18,20,24,0.6)] text-[var(--nx-text-soft)] hover:text-[var(--nx-text)]"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {active === "excel-import" && <ExcelImportTab />}
            {active === "margin-rules" && <MarginRulesTab />}
            {active === "brands" && <BrandsTab />}
            {active === "discounts" && <DiscountsTab />}
        </div>
    );
}
