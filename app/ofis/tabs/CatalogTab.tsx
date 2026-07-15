"use client";

import { useState } from "react";
import { ProductsTab } from "./ProductsTab";
import { LogisticsTab } from "./LogisticsTab";

// Katalog çatısı (audit, 15 Temmuz 2026): ürün/varyant ve lojistik
// kapasite aynı veri kümesi — salt-okunur Lojistik tablosu ayrı sekme
// hacminde değildi, alt-sekme oldu.

const SUB_TABS = [
    { id: "products", label: "Ürünler" },
    { id: "logistics", label: "Lojistik Kapasite" },
] as const;

type SubTabId = (typeof SUB_TABS)[number]["id"];

export function CatalogTab() {
    const [active, setActive] = useState<SubTabId>("products");

    return (
        <div className="space-y-4">
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

            {active === "products" && <ProductsTab />}
            {active === "logistics" && <LogisticsTab />}
        </div>
    );
}
