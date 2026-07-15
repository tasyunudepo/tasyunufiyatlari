"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminLoadingScreen } from "@/components/admin/AdminLoadingScreen";
import { DashboardTab } from "./tabs/DashboardTab";
import { AnalyticsTab } from "./tabs/AnalyticsTab";
import { QuotesTab } from "./tabs/QuotesTab";
import { ExperimentsTab } from "./tabs/ExperimentsTab";
import { PricesTab } from "./tabs/PricesTab";
import { LogisticsTab } from "./tabs/LogisticsTab";
import { DiscountsTab } from "./tabs/DiscountsTab";
import { ProductsTab } from "./tabs/ProductsTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { ExcelImportTab } from "./tabs/ExcelImportTab";
import { MarginRulesTab } from "./tabs/MarginRulesTab";
import { BrandsTab } from "./tabs/BrandsTab";

export default function AdminPanel() {
    const [activeTab, setActiveTab] = useState<string>("dashboard");
    const [stats, setStats] = useState({
        plateCount: 0,
        accessoryCount: 0,
        priceCount: 0,
        cityCount: 0,
    });

    useEffect(() => {
        async function loadStats() {
            const [platesRes, accessoriesRes, pricesRes, citiesRes] = await Promise.all([
                supabase.from("plates").select("id", { count: "exact", head: true }),
                supabase.from("accessories").select("id", { count: "exact", head: true }),
                supabase.from("plate_prices").select("id", { count: "exact", head: true }),
                supabase.from("shipping_zones").select("id", { count: "exact", head: true }),
            ]);
            setStats({
                plateCount: platesRes.count || 0,
                accessoryCount: accessoriesRes.count || 0,
                priceCount: pricesRes.count || 0,
                cityCount: citiesRes.count || 0,
            });
        }
        loadStats();
    }, []);

    return (
        <>
            <AdminLoadingScreen />
            <AdminShell
                activeSection={activeTab}
                onNavigate={setActiveTab}
            >
                <div className="space-y-6">
                    {activeTab === "dashboard"     && <DashboardTab stats={stats} onNavigate={setActiveTab} />}
                    {activeTab === "quotes"        && <QuotesTab />}
                    {activeTab === "experiments"   && <ExperimentsTab />}
                    {activeTab === "analytics"     && <AnalyticsTab />}
                    {activeTab === "prices"        && <PricesTab />}
                    {activeTab === "margin-rules"  && <MarginRulesTab />}
                    {activeTab === "brands"        && <BrandsTab />}
                    {activeTab === "logistics"     && <LogisticsTab />}
                    {activeTab === "discounts"     && <DiscountsTab />}
                    {activeTab === "products"      && <ProductsTab />}
                    {activeTab === "excel-import"  && <ExcelImportTab />}
                    {activeTab === "settings"      && <SettingsTab />}
                </div>
            </AdminShell>
        </>
    );
}
