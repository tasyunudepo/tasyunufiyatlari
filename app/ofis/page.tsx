"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { DashboardTab } from "./tabs/DashboardTab";
import { AnalyticsTab } from "./tabs/AnalyticsTab";
import { QuotesTab } from "./tabs/QuotesTab";
import { ExperimentsTab } from "./tabs/ExperimentsTab";
import { PricingTab } from "./tabs/PricingTab";
import { CatalogTab } from "./tabs/CatalogTab";

export default function AdminPanel() {
    const [activeTab, setActiveTab] = useState<string>("dashboard");

    return (
        <AdminShell
            activeSection={activeTab}
            onNavigate={setActiveTab}
        >
            <div className="space-y-6">
                {activeTab === "dashboard"   && <DashboardTab onNavigate={setActiveTab} />}
                {activeTab === "quotes"      && <QuotesTab />}
                {activeTab === "experiments" && <ExperimentsTab />}
                {activeTab === "analytics"   && <AnalyticsTab />}
                {activeTab === "pricing"     && <PricingTab />}
                {activeTab === "catalog"     && <CatalogTab />}
            </div>
        </AdminShell>
    );
}
