"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { DashboardTab } from "./tabs/DashboardTab";
import { AnalyticsTab } from "./tabs/AnalyticsTab";
import { QuotesShell } from "./tabs/QuotesShell";
import { ExperimentsTab } from "./tabs/ExperimentsTab";
import { PricingTab } from "./tabs/PricingTab";
import { CatalogTab } from "./tabs/CatalogTab";
import { CustomersView, NotesView, SettingsView, TasksView } from "@/components/admin/OfficeQuickViews";

export default function AdminPanel() {
    const [activeTab, setActiveTab] = useState<string>("dashboard");
    // Üst çubuktaki arama ve "+ Yeni teklif": Teklifler bölümünü istenen
    // görünüm ve arama metniyle açar. `nonce` aynı isteğin yeniden
    // uygulanabilmesi içindir.
    const [quotesIntent, setQuotesIntent] = useState<{ view: "liste" | "yeni"; search: string; nonce: number }>({ view: "liste", search: "", nonce: 0 });
    const openQuotes = (view: "liste" | "yeni", search = "") => {
        setQuotesIntent({ view, search, nonce: Date.now() });
        setActiveTab("quotes");
    };

    return (
        <AdminShell
            activeSection={activeTab}
            onNavigate={setActiveTab}
            onSearch={(term) => openQuotes("liste", term)}
            onNewQuote={() => openQuotes("yeni")}
        >
            <div className="space-y-6">
                {activeTab === "dashboard"   && <DashboardTab onNavigate={setActiveTab} />}
                {activeTab === "quotes"      && <QuotesShell key={quotesIntent.nonce} initialView={quotesIntent.view} initialSearch={quotesIntent.search} />}
                {activeTab === "experiments" && <ExperimentsTab />}
                {activeTab === "analytics"   && <AnalyticsTab />}
                {activeTab === "pricing"     && <PricingTab />}
                {activeTab === "catalog"     && <CatalogTab />}
                {activeTab === "customers"   && <CustomersView />}
                {activeTab === "tasks"       && <TasksView />}
                {activeTab === "notes"       && <NotesView />}
                {activeTab === "settings"    && <SettingsView />}
            </div>
        </AdminShell>
    );
}
