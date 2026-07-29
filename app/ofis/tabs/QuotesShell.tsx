"use client";

import { useState } from "react";
import { FilePlus2, List } from "lucide-react";

import { useAdminRole } from "@/lib/admin/useAdminRole";

import { QuotesTab } from "./QuotesTab";
import { QuoteBuilder } from "./quotes/QuoteBuilder";

// Teklifler çatı sekmesi (Fiyatlandırma/Katalog ile aynı kalıp).
//
// "Yeni Teklif" kenar çubuğuna 7. öğe olarak eklenmedi: teklif yazmak
// Teklifler alanının bir EYLEMİ, ayrı bir bölüm değil.

const SUB_TABS = [
    { id: "liste", label: "Teklif Listesi", Icon: List },
    { id: "yeni", label: "Yeni Teklif", Icon: FilePlus2 },
] as const;

type SubTabId = (typeof SUB_TABS)[number]["id"];

export function QuotesShell() {
    const { canMutate } = useAdminRole();
    const [active, setActive] = useState<SubTabId>("liste");

    // Salt-okunur hesap teklif yazamaz; sekmeyi hiç göstermeyiz.
    const tabs = canMutate ? SUB_TABS : SUB_TABS.filter((t) => t.id !== "yeni");

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {tabs.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setActive(id)}
                        aria-current={active === id ? "page" : undefined}
                        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                            active === id
                                ? "border-[rgba(201,168,76,0.45)] bg-[rgba(201,168,76,0.12)] text-[var(--nx-gold)]"
                                : "border-[rgba(92,98,108,0.24)] bg-[rgba(18,20,24,0.6)] text-[var(--nx-text-soft)] hover:text-[var(--nx-text)]"
                        }`}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </button>
                ))}
            </div>

            {active === "liste" && <QuotesTab />}
            {/* Kaydettikten sonra sekme DEĞİŞTİRİLMEZ: editör kendi başarı
                ekranını gösterir (teklif kodu + PDF indirme). Otomatik listeye
                atlamak operatörün PDF'i almasını engelliyordu. */}
            {active === "yeni" && canMutate && <QuoteBuilder />}
        </div>
    );
}
