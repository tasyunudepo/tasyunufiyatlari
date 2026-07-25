"use client";

import { useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import {
    ClipboardList, Wrench, CheckCircle2, XCircle, Flame, Snowflake, TrendingDown,
} from "lucide-react";
import { formatCurrency } from "@/lib/admin/utils";
import { validateRules, getRulesPreview } from "@/lib/catalog/decision";
import type { Accessory, LogisticsCapacity, Plate, PlatePrice, ShippingZone } from "@/lib/types";
import type { MinimumOrderType, PricingVisibilityMode, ProductRules, SalesMode } from "@/lib/catalog/types";

// Supabase join'li admin satırları — katalog kural kolonları base tiplerde yok.
interface AdminPlatePrice extends PlatePrice {
    stock_tuzla?: number | null;
}

interface CatalogRuleFields {
    slug?: string | null;
    sales_mode?: SalesMode | null;
    pricing_visibility_mode?: PricingVisibilityMode | null;
    minimum_order_type?: MinimumOrderType | null;
    minimum_order_value?: number | null;
    requires_system_context?: boolean | null;
    catalog_description?: string | null;
    meta_title?: string | null;
    meta_description?: string | null;
}

interface AdminPlate extends Plate, CatalogRuleFields {
    is_active?: boolean;
    requires_city_for_pricing?: boolean | null;
    depot_discount?: number | null;
    depot_min_m2?: number | null;
    brands?: { name: string } | null;
    material_types?: { name: string; slug: string } | null;
    plate_prices?: AdminPlatePrice[];
}

interface DepotStockRow {
    id: number;
    thickness: number;
    stock_tuzla: number;
}

interface EditingPlate extends AdminPlate {
    _depotStocks?: DepotStockRow[];
}

interface AdminAccessory extends Accessory, CatalogRuleFields {
    is_active?: boolean;
    image_cover?: string | null;
    accessory_types?: { name: string; sort_order: number } | null;
    brands?: { name: string } | null;
}

interface StatCardProps {
    title: string;
    value: number | string;
    icon: ReactNode;
    color: "blue" | "green" | "orange" | "purple";
    onClick?: () => void;
}

function StatCard({ title, value, icon, color, onClick }: StatCardProps) {
    const colors: Record<string, string> = {
        blue: "from-amber-500/14 to-amber-500/4 text-amber-300 border-amber-400/20",
        green: "from-emerald-500/14 to-emerald-500/4 text-emerald-300 border-emerald-400/20",
        orange: "from-amber-500/14 to-amber-500/4 text-amber-300 border-amber-400/20",
        purple: "from-fuchsia-500/14 to-fuchsia-500/4 text-fuchsia-300 border-fuchsia-400/20",
    };
    return (
        <div className={`admin-nexus-card bg-gradient-to-br p-6 ${colors[color] || colors.blue} ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(2,8,23,0.46)] transition-all duration-300' : ''}`} onClick={onClick}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{title}</p>
                    <p className="text-3xl font-bold mt-2 text-slate-50">{value}</p>
                </div>
                <div className="text-4xl opacity-90">{icon}</div>
            </div>
        </div>
    );
}

export function ProductsTab() {
    const [activeProductTab, setActiveProductTab] = useState<"plates" | "accessories">("plates");
    const [plates, setPlates] = useState<AdminPlate[]>([]);
    const [accessories, setAccessories] = useState<AdminAccessory[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<"all" | "tasyunu" | "eps">("all");
    const [filterBrand, setFilterBrand] = useState<string>("all");
    const [selectedCityCode, setSelectedCityCode] = useState<number | null>(null);
    const [tasyunuVehicle, setTasyunuVehicle] = useState<"tir" | "kamyon">("tir");
    const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
    const [logisticsData, setLogisticsData] = useState<LogisticsCapacity[]>([]);
    const [editingPlate, setEditingPlate] = useState<EditingPlate | null>(null);
    const [editingAccessory, setEditingAccessory] = useState<AdminAccessory | null>(null);

    const patchEditingPlate = (patch: Partial<EditingPlate>) =>
        setEditingPlate((prev) => (prev ? { ...prev, ...patch } : prev));
    const patchEditingAccessory = (patch: Partial<AdminAccessory>) =>
        setEditingAccessory((prev) => (prev ? { ...prev, ...patch } : prev));
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const [imageLibrary, setImageLibrary] = useState<Array<{ name: string; url: string }>>([]);
    const [imageLibraryLoaded, setImageLibraryLoaded] = useState(false);
    const [imagePickerOpen, setImagePickerOpen] = useState(false);
    const [imagePickerQuery, setImagePickerQuery] = useState('');

    async function ensureImageLibrary() {
        if (imageLibraryLoaded) return;
        try {
            const res = await fetch('/api/admin/storage-images');
            const json = await res.json();
            if (res.ok) setImageLibrary(json.files ?? []);
        } finally {
            setImageLibraryLoaded(true);
        }
    }

    async function savePlateRules(id: number, fields: Record<string, unknown>) {
        setEditSaving(true);
        setEditError(null);
        try {
            const res = await fetch(`/api/admin/plates/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
            });
            const json = await res.json();
            if (!res.ok) { setEditError(json.error ?? 'Kayıt başarısız'); return false; }
            setPlates((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
            setEditingPlate(null);
            return true;
        } catch {
            setEditError('Bağlantı hatası');
            return false;
        } finally {
            setEditSaving(false);
        }
    }

    async function saveAccessoryRules(id: number, fields: Record<string, unknown>) {
        setEditSaving(true);
        setEditError(null);
        try {
            const res = await fetch(`/api/admin/accessories/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
            });
            const json = await res.json();
            if (!res.ok) { setEditError(json.error ?? 'Kayıt başarısız'); return false; }
            setAccessories((prev) => prev.map((a) => (a.id === id ? { ...a, ...fields } : a)));
            setEditingAccessory(null);
            return true;
        } catch {
            setEditError('Bağlantı hatası');
            return false;
        } finally {
            setEditSaving(false);
        }
    }

    useEffect(() => { loadProducts(); }, []);

    async function loadProducts() {
        const [platesRes, accessoriesRes, pricesRes, zonesRes, logisticsRes] = await Promise.all([
            supabase.from("plates").select(`*, brands:brand_id (name), material_types:material_type_id (name, slug)`).order("material_type_id", { ascending: false }).order("short_name"),
            supabase.from("accessories").select(`*, accessory_types:accessory_type_id (name, sort_order), brands:brand_id (name)`).order("name"),
            supabase.from("plate_prices").select("*"),
            supabase.from("shipping_zones").select("*").order("city_name"),
            supabase.from("logistics_capacity").select("*").order("thickness")
        ]);

        if (platesRes.data && pricesRes.data) {
            const platesWithPrices = platesRes.data.map(plate => ({
                ...plate,
                plate_prices: pricesRes.data!.filter(price => price.plate_id === plate.id)
            }));
            setPlates(platesWithPrices);
        }
        if (accessoriesRes.data) setAccessories(accessoriesRes.data);
        if (zonesRes.data) {
            const PRIORITY_CITIES = ["İstanbul", "Kocaeli", "Bolu", "Sakarya", "Düzce", "Tekirdağ", "Yalova", "Bursa", "Balıkesir"];
            const priorityMap = new Map(PRIORITY_CITIES.map((name, idx) => [name.toLocaleLowerCase("tr-TR"), idx]));
            const sortedZones = [...zonesRes.data].sort((a, b) => {
                const aKey = String(a.city_name || "").toLocaleLowerCase("tr-TR");
                const bKey = String(b.city_name || "").toLocaleLowerCase("tr-TR");
                const ai = priorityMap.get(aKey), bi = priorityMap.get(bKey);
                if (ai != null && bi != null) return ai - bi;
                if (ai != null) return -1; if (bi != null) return 1;
                return String(a.city_name || "").localeCompare(String(b.city_name || ""), "tr-TR");
            });
            setShippingZones(sortedZones);
            const istanbul = zonesRes.data.find((z) => z.city_code === 34) || zonesRes.data.find((z) => (z.city_name || "").toLowerCase() === "istanbul") || zonesRes.data.find((z) => z.city_name === "İstanbul");
            if (istanbul) setSelectedCityCode(istanbul.city_code);
        }
        if (logisticsRes.data) setLogisticsData(logisticsRes.data);
        setLoading(false);
    }

    const filteredPlates = plates.filter(plate => {
        const materialSlug = plate.material_types?.slug;
        if (filterType !== "all" && materialSlug !== filterType) return false;
        if (filterBrand !== "all" && plate.brands?.name !== filterBrand) return false;
        return true;
    });

    const platesByBrand = filteredPlates.reduce((acc, plate) => {
        const brand = plate.brands?.name || "Diğer";
        if (!acc[brand]) acc[brand] = [];
        acc[brand].push(plate);
        return acc;
    }, {} as Record<string, AdminPlate[]>);

    const uniqueBrands = Array.from(new Set(plates.map(p => p.brands?.name).filter(Boolean)));

    const accessoriesByType = accessories.reduce((acc, acc_item) => {
        const type = acc_item.accessory_types?.name || "Diğer";
        if (!acc[type]) acc[type] = [];
        acc[type].push(acc_item);
        return acc;
    }, {} as Record<string, AdminAccessory[]>);

    const accessoryTypeCount = Object.keys(accessoriesByType).length;
    const activeAccessoryCount = accessories.filter((item) => item.is_active).length;
    const totalPlateVariantCount = plates.reduce((total, plate) => total + (plate.thickness_options?.length || 0), 0);
    const filteredPlateVariantCount = filteredPlates.reduce((total, plate) => total + (plate.thickness_options?.length || 0), 0);
    const filteredActivePlateVariantCount = filteredPlates.reduce((total, plate) => total + ((plate.is_active ? plate.thickness_options?.length : 0) || 0), 0);
    const activePlateVariantCount = plates.reduce((total, plate) => total + ((plate.is_active ? plate.thickness_options?.length : 0) || 0), 0);
    const activeAccessoryTypeCount = Object.entries(accessoriesByType).filter(([, items]) => items.some((item) => item.is_active)).length;

    return (
        <div className="admin-nexus-panel p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Ürün Kataloğu</h2>

            <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard title="Levha Ailesi" value={plates.length} icon="🧱" color="blue" />
                <StatCard title="Levha Varyantı" value={totalPlateVariantCount} icon="📏" color="purple" />
                <StatCard title="Aksesuar Kaydı" value={accessories.length} icon="🧰" color="green" />
                <StatCard title="Aksesuar Türü" value={accessoryTypeCount} icon="🗂️" color="orange" />
            </div>

            <div className="mb-6 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                <div className="admin-nexus-subtle p-5">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-amber-300/80">Katalog Mantığı</p>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                        Bu ekrandaki sayaçlar aynı veri katmanını saymaz. Levhalarda aile ve varyant ayrı, aksesuarlarda ise kayıt ve tür ayrı tutulur.
                    </p>
                </div>
                <div className="admin-nexus-subtle p-5">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Canlı Kapsam</p>
                    <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between text-slate-300"><span>Aktif levha varyantı</span><span className="font-semibold text-slate-50">{activePlateVariantCount}</span></div>
                        <div className="flex items-center justify-between text-slate-300"><span>Aktif aksesuar kaydı</span><span className="font-semibold text-slate-50">{activeAccessoryCount}</span></div>
                        <div className="flex items-center justify-between text-slate-300"><span>Marka sayısı</span><span className="font-semibold text-slate-50">{uniqueBrands.length}</span></div>
                    </div>
                </div>
            </div>

            {/* Product Type Tabs */}
            <div className="mb-6 flex gap-2 border-b border-slate-700/50 pb-2">
                <button onClick={() => setActiveProductTab("plates")} className={`admin-nexus-tab flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${activeProductTab === "plates" ? "admin-nexus-tab-active" : ""}`}>
                    <ClipboardList className="w-4 h-4" />
                    Levha Aileleri ({filteredPlates.length}/{plates.length})
                    <span className="text-xs text-slate-500">• {filteredPlateVariantCount}/{totalPlateVariantCount} varyant</span>
                </button>
                <button onClick={() => setActiveProductTab("accessories")} className={`admin-nexus-tab flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${activeProductTab === "accessories" ? "admin-nexus-tab-active" : ""}`}>
                    <Wrench className="w-4 h-4" />
                    Aksesuar Kayıtları ({accessories.length})
                    <span className="text-xs text-slate-500">• {accessoryTypeCount} tür</span>
                </button>
            </div>

            {activeProductTab === "plates" ? (
                <div className="mb-6 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                    <div className="admin-nexus-subtle p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.22em] text-amber-300/80">Levha Görünümü</p>
                                <p className="mt-2 text-sm text-slate-300">Filtreler sonrası görünen aile ve varyant kümesi.</p>
                            </div>
                            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">{filteredPlates.length} aile</span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Filtrelenen Varyant</p>
                                <p className="mt-2 text-2xl font-semibold text-white">{filteredPlateVariantCount}</p>
                                <p className="mt-1 text-xs text-slate-500">Toplam {totalPlateVariantCount} varyant içinde</p>
                            </div>
                            <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Aktif Varyant</p>
                                <p className="mt-2 text-2xl font-semibold text-emerald-300">{filteredActivePlateVariantCount}</p>
                                <p className="mt-1 text-xs text-slate-500">Canlı satışta görünür varyantlar</p>
                            </div>
                            <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Şehir / Araç</p>
                                <p className="mt-2 text-base font-semibold text-white">
                                    {selectedCityCode ? shippingZones.find((zone) => zone.city_code === selectedCityCode)?.city_name || "Seçili şehir" : "Varsayılan görünüm"}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">{filterType !== "eps" ? `Taşyünü ${tasyunuVehicle === "tir" ? "tır" : "kamyon"} indirimi uygulanır` : "EPS filtresi aktif"}</p>
                            </div>
                        </div>
                    </div>
                    <div className="admin-nexus-subtle p-5">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Filtre Özeti</p>
                        <div className="mt-4 space-y-3 text-sm text-slate-300">
                            <div className="flex items-center justify-between"><span>Tip filtresi</span><span className="font-medium text-slate-50">{filterType === "all" ? "Tümü" : filterType === "tasyunu" ? "Taşyünü" : "EPS"}</span></div>
                            <div className="flex items-center justify-between"><span>Marka filtresi</span><span className="font-medium text-slate-50">{filterBrand === "all" ? "Tüm markalar" : filterBrand}</span></div>
                            <div className="flex items-center justify-between"><span>Aktif aile oranı</span>
                                <span className="font-medium text-slate-50">{filteredPlates.length > 0 ? `%${Math.round((filteredPlates.filter((plate) => plate.is_active).length / filteredPlates.length) * 100)}` : "%0"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mb-6 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                    <div className="admin-nexus-subtle p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.22em] text-amber-300/80">Aksesuar Operasyon Görünümü</p>
                                <p className="mt-2 text-sm text-slate-300">Aksesuar tarafında liste, satış fiyatı ve paket/adet bilgisi aynı tabloda okunur.</p>
                            </div>
                            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">{accessoryTypeCount} tür</span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Toplam Kayıt</p>
                                <p className="mt-2 text-2xl font-semibold text-white">{accessories.length}</p>
                                <p className="mt-1 text-xs text-slate-500">Ham katalog satırları</p>
                            </div>
                            <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Aktif Kayıt</p>
                                <p className="mt-2 text-2xl font-semibold text-emerald-300">{activeAccessoryCount}</p>
                                <p className="mt-1 text-xs text-slate-500">{activeAccessoryTypeCount} aktif tür içinde</p>
                            </div>
                            <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Şehir Etkisi</p>
                                <p className="mt-2 text-base font-semibold text-white">{selectedCityCode ? shippingZones.find((zone) => zone.city_code === selectedCityCode)?.city_name || "Seçili şehir" : "Varsayılan fiyat"}</p>
                                <p className="mt-1 text-xs text-slate-500">EPS/Toz bölge iskontosu şehir bazlı uygulanır</p>
                            </div>
                        </div>
                    </div>
                    <div className="admin-nexus-subtle p-5">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Kapsam Özeti</p>
                        <div className="mt-4 space-y-3 text-sm text-slate-300">
                            <div className="flex items-center justify-between"><span>Aktif tür oranı</span><span className="font-medium text-slate-50">%{accessoryTypeCount > 0 ? Math.round((activeAccessoryTypeCount / accessoryTypeCount) * 100) : 0}</span></div>
                            <div className="flex items-center justify-between"><span>Marka sayısı</span><span className="font-medium text-slate-50">{uniqueBrands.length}</span></div>
                            <div className="flex items-center justify-between"><span>Şehir filtresi</span><span className="font-medium text-slate-50">{selectedCityCode ? "Aktif" : "Yok"}</span></div>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <p className="text-slate-400">Yükleniyor...</p>
            ) : (
                <>
                    {/* Plates View */}
                    {activeProductTab === "plates" && (
                        <div className="space-y-4">
                            <div className="flex gap-3 pb-4 border-b border-slate-700/50">
                                <select value={filterType} onChange={(e) => setFilterType(e.target.value as "all" | "tasyunu" | "eps")} className="admin-nexus-input px-3 py-2 text-sm">
                                    <option value="all">Tüm Türler</option>
                                    <option value="tasyunu">🔥 Taşyünü</option>
                                    <option value="eps">❄️ EPS</option>
                                </select>
                                <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className="admin-nexus-input px-3 py-2 text-sm">
                                    <option value="all">Tüm Markalar</option>
                                    {uniqueBrands.map(brand => (<option key={brand} value={brand}>{brand}</option>))}
                                </select>
                                <select value={selectedCityCode || ""} onChange={(e) => setSelectedCityCode(e.target.value ? parseInt(e.target.value) : null)} className="admin-nexus-input px-3 py-2 text-sm">
                                    <option value="">Şehir Seçin</option>
                                    {shippingZones.map((zone) => (<option key={zone.city_code} value={zone.city_code}>{zone.city_name} (Taşyünü: TIR %{zone.discount_tir} / Kamyon %{zone.discount_kamyon})</option>))}
                                </select>
                                {filterType !== "eps" && (
                                    <select value={tasyunuVehicle} onChange={(e) => setTasyunuVehicle(e.target.value as "tir" | "kamyon")} className="admin-nexus-input px-3 py-2 text-sm" title="Taşyünü levha için İSK1 (şehir/araç) seçimi">
                                        <option value="tir">Taşyünü: Tır</option>
                                        <option value="kamyon">Taşyünü: Kamyon</option>
                                    </select>
                                )}
                            </div>

                            {Object.entries(platesByBrand).map(([brand, brandPlates]) => (
                                <div key={brand} className="admin-nexus-group">
                                    <div className="admin-nexus-group-header">
                                        <h3 className="font-semibold text-white">
                                            {brand}
                                            <span className="ml-2 text-sm font-normal text-slate-400">({brandPlates.reduce((total: number, plate) => total + (plate.thickness_options?.length || 0), 0)} varyant)</span>
                                        </h3>
                                    </div>
                                    <div className="admin-nexus-table-wrap rounded-none border-0">
                                        <table className="admin-nexus-table w-full" style={{ tableLayout: 'fixed' }}>
                                            <thead>
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" style={{ width: '200px' }}>Ürün</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" style={{ width: '100px' }}>Tip</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" style={{ width: '80px' }}>Kalınlık</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" style={{ width: '130px' }}>İskontolar</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" style={{ width: '100px' }}>Paket Metrajı</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-700/20" style={{ width: '160px' }}>Net Alış (KDV Hariç)</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider bg-green-500/10 text-green-400 border-x border-green-500/20" style={{ width: '170px' }} title="Kaba tahmin: net alış + sabit %10. Gerçek satış fiyatı Fiyatlandırma sekmesindeki marka/malzeme marj kuralına ve KDV'ye göre hesaplanır.">Kaba m² Tahmini <span className="normal-case text-[10px] text-green-500/70">(+%10, gösterge)</span></th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" style={{ width: '100px' }}>Durum</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" style={{ width: '60px' }}>Katalog</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {brandPlates.flatMap((plate) =>
                                                    (plate.thickness_options || []).map((thickness, idx) => {
                                                        const priceData = plate.plate_prices?.find((p) => p.thickness === thickness);
                                                        const thicknessMm = thickness * 10;
                                                        const logisticsInfo = logisticsData.find((l) => l.thickness === thicknessMm);
                                                        const packageM2 = priceData?.package_m2 || plate.package_m2 || logisticsInfo?.package_size_m2 || 0;
                                                        const basePrice = priceData?.base_price || plate.base_price || (plate.base_price_per_cm || 0) * thickness;
                                                        const isKdvIncluded = priceData?.is_kdv_included ?? plate.is_kdv_included ?? false;
                                                        const basePriceKdvHaric = isKdvIncluded ? basePrice / 1.20 : basePrice;
                                                        const materialSlug = plate.material_types?.slug;
                                                        const listPriceM2 = packageM2 > 0 ? basePriceKdvHaric / packageM2 : basePriceKdvHaric;
                                                        const selectedCity = shippingZones.find((z) => z.city_code === selectedCityCode);
                                                        const brandName = plate.brands?.name || '';
                                                        let plateDiscount1 = 0;
                                                        let plateDiscount2 = (priceData?.discount_2 ?? plate.discount_2 ?? 0) as number;

                                                        if (materialSlug === "eps" && plateDiscount1 === 0) {
                                                            plateDiscount1 = selectedCity?.eps_toz_region_discount ?? 9;
                                                        }
                                                        if (plateDiscount2 === 0) plateDiscount2 = 8;

                                                        if (materialSlug === "tasyunu") {
                                                            if (selectedCity) {
                                                                plateDiscount1 = tasyunuVehicle === "tir" ? (selectedCity.discount_tir || 0) : (selectedCity.discount_kamyon || 0);
                                                            }
                                                        } else {
                                                            plateDiscount1 = (priceData?.discount_1 ?? plate.discount_1 ?? 0) as number;
                                                            if (selectedCity && (brandName === "Dalmaçyalı" || brandName === "Expert" || brandName === "Optimix")) {
                                                                const cityIsk1 = selectedCity.eps_toz_region_discount ?? 0;
                                                                if (cityIsk1 > 0) plateDiscount1 = cityIsk1;
                                                            }
                                                        }

                                                        if (brandName === 'Optimix' && selectedCity && plateDiscount2 >= 10) {
                                                            plateDiscount2 = selectedCity?.optimix_levha_discount || plateDiscount2;
                                                        }

                                                        const m2Alis = listPriceM2 * (1 - plateDiscount1 / 100) * (1 - plateDiscount2 / 100);
                                                        const paketAlis = packageM2 > 0 ? m2Alis * packageM2 : 0;

                                                        return (
                                                            <tr key={`${plate.id}-${thickness}`} className={!plate.is_active ? "opacity-50" : ""}>
                                                                <td className="px-4 py-3 text-sm font-medium text-slate-200">{plate.short_name} {thickness}cm</td>
                                                                <td className="px-4 py-3 text-sm">
                                                                    {plate.material_types?.slug === "tasyunu" ? (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30"><Flame className="w-3 h-3" />Taşyünü</span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-blue-300 border border-orange-500/30"><Snowflake className="w-3 h-3" />EPS</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-slate-200 font-medium">{thickness} cm</td>
                                                                <td className="px-4 py-3 text-sm">
                                                                    <div className="flex flex-col gap-1">
                                                                        {plateDiscount1 > 0 && <span className="text-red-400 text-xs font-medium">İSK1: %{plateDiscount1}</span>}
                                                                        {plateDiscount2 > 0 && <span className="text-orange-400 text-xs font-medium">İSK2: %{plateDiscount2}</span>}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-slate-400">{packageM2} m²</td>
                                                                <td className="px-4 py-3 text-sm bg-slate-700/10">
                                                                    <div className="text-slate-200 font-medium">{formatCurrency(paketAlis)} /Pkt</div>
                                                                    <div className="text-slate-400 text-xs">{formatCurrency(m2Alis)} /m²</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-sm bg-green-500/10 border-x border-green-500/10">
                                                                    <div className="text-green-300 font-semibold">{formatCurrency(paketAlis * 1.10)} /Pkt</div>
                                                                    <div className="text-green-500 font-bold text-base">{formatCurrency(m2Alis * 1.10)} /m²</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-sm">
                                                                    {plate.is_active ? (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/30"><CheckCircle2 className="w-3 h-3" />Aktif</span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-600/30 text-slate-400 border border-slate-600/50"><XCircle className="w-3 h-3" />Pasif</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm">
                                                                    {idx === 0 && (
                                                                        <button type="button" onClick={() => setEditingPlate({ ...plate, _depotStocks: (plate.plate_prices || []).slice().sort((a, b) => a.thickness - b.thickness).map((p) => ({ id: p.id, thickness: p.thickness, stock_tuzla: p.stock_tuzla ?? 0 })) })} title="Katalog kurallarını düzenle" className="p-1.5 rounded text-slate-500 hover:text-orange-400 hover:bg-slate-700/50 transition-colors">
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                            {filteredPlates.length === 0 && <p className="text-center text-slate-500 py-8">Bu filtreyle eşleşen levha bulunamadı</p>}
                        </div>
                    )}

                    {/* Accessories View */}
                    {activeProductTab === "accessories" && (
                        <div className="space-y-4">
                            <div className="flex gap-3 pb-4 border-b border-slate-700/50">
                                <select value={selectedCityCode || ""} onChange={(e) => setSelectedCityCode(e.target.value ? parseInt(e.target.value) : null)} className="admin-nexus-input px-3 py-2 text-sm">
                                    <option value="">Şehir Seçin</option>
                                    {shippingZones.map((zone) => (<option key={zone.city_code} value={zone.city_code}>{zone.city_name} (EPS/Toz Bölge İSK: %{zone.eps_toz_region_discount ?? 0})</option>))}
                                </select>
                                {selectedCityCode && <span className="text-xs text-slate-400 self-center">Seçilen şehir için bölge/Optimix iskontoları uygulanır.</span>}
                            </div>
                            {accessories.length === 0 ? (
                                <p className="text-center text-slate-500 py-8">Aksesuar bulunamadı</p>
                            ) : (
                                <>
                                    {Object.entries(accessoriesByType).map(([type, typeAccessories]) => (
                                        <div key={type} className="admin-nexus-group">
                                            <div className="admin-nexus-group-header">
                                                <h3 className="font-semibold text-white">{type}<span className="ml-2 text-sm font-normal text-slate-400">({typeAccessories.length} ürün)</span></h3>
                                            </div>
                                            <div className="admin-nexus-table-wrap rounded-none border-0">
                                                <table className="admin-nexus-table w-full" style={{ tableLayout: 'fixed' }}>
                                                    <thead>
                                                        <tr>
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase" style={{ width: '380px' }}>Ürün Adı</th>
                                                            <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase" style={{ width: '150px' }}>Liste Fiyatı</th>
                                                            <th className="px-2 py-3 text-left text-xs font-medium text-slate-400 uppercase" style={{ width: '130px' }}>İskontolar</th>
                                                            <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase" style={{ width: '150px' }} title="Kaba tahmin: şehir iskontolu net + sabit %10 + KDV. Gerçek satış fiyatı marka/malzeme marj kuralına göre değişir.">Kaba Satış Tahmini</th>
                                                            <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase" style={{ width: '120px' }}>Paket</th>
                                                            <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase" style={{ width: '100px' }}>Durum</th>
                                                            <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase" style={{ width: '60px' }}>Katalog</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {typeAccessories.map((acc) => {
                                                            const listPrice = acc.base_price || 0;
                                                            const kdvRate = acc.is_kdv_included ? 1.20 : 1;
                                                            const priceWithoutKdv = listPrice / kdvRate;
                                                            const selectedCity = shippingZones.find((z) => z.city_code === selectedCityCode);
                                                            const brandName: string = acc.brands?.name || "";
                                                            let isk1 = acc.discount_1 || 0;
                                                            let isk2 = acc.discount_2 || 0;
                                                            if (selectedCity && (brandName === "Dalmaçyalı" || brandName === "Expert" || brandName === "Optimix")) {
                                                                const cityIsk1 = selectedCity.eps_toz_region_discount ?? 0;
                                                                if (cityIsk1 > 0) isk1 = cityIsk1;
                                                            }
                                                            if (brandName === "Optimix" && (acc.discount_2 || 0) >= 10 && selectedCity) {
                                                                isk2 = selectedCity.optimix_toz_discount ?? isk2;
                                                            }
                                                            const afterDiscount1 = priceWithoutKdv * (1 - isk1 / 100);
                                                            const afterDiscount2 = afterDiscount1 * (1 - isk2 / 100);
                                                            const finalPrice = afterDiscount2 * 1.10 * 1.20;
                                                            return (
                                                                <tr key={acc.id} className={!acc.is_active ? "opacity-50" : ""}>
                                                                    <td className="px-4 py-3 text-sm font-medium text-slate-200" title={acc.name || "-"}>
                                                                        <div className="flex flex-col">
                                                                            <div className="font-semibold text-white">{acc.short_name || acc.name || "-"}</div>
                                                                            {acc.short_name && acc.name && acc.short_name !== acc.name && <div className="text-xs text-slate-400 truncate mt-0.5">{acc.name}</div>}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 text-sm">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-slate-300 font-medium">{listPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                                                                            <span className="text-xs text-slate-500">{acc.is_kdv_included ? "KDV Dahil" : "KDV Hariç"}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-2 py-3 text-sm">
                                                                        <div className="flex gap-1">
                                                                            {isk1 > 0 && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30"><TrendingDown className="w-3 h-3" />%{isk1}</span>}
                                                                            {isk2 > 0 && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30"><TrendingDown className="w-3 h-3" />%{isk2}</span>}
                                                                            {!isk1 && !isk2 && <span className="text-xs text-slate-500">-</span>}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 text-sm">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-green-300 font-semibold">{finalPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                                                                            <span className="text-xs text-slate-500">tahmini · KDV dahil, sabit +%10</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 text-sm"><span className="text-slate-300">{acc.unit_content || 1} {acc.unit || "PKT"}</span></td>
                                                                    <td className="px-3 py-3 text-sm">
                                                                        {acc.is_active ? (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/30"><CheckCircle2 className="w-3 h-3" />Aktif</span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-600/30 text-slate-400 border border-slate-600/50"><XCircle className="w-3 h-3" />Pasif</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-3 text-sm">
                                                                        <button type="button" onClick={() => setEditingAccessory({ ...acc })} title="Katalog kurallarını düzenle" className="p-1.5 rounded text-slate-500 hover:text-orange-400 hover:bg-slate-700/50 transition-colors">
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Katalog Kural Düzenleme Modal */}
            {editingPlate && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                            <div>
                                <h2 className="text-base font-semibold text-white">Katalog Kuralları</h2>
                                <p className="text-xs text-slate-400 mt-0.5">{editingPlate.name} — {editingPlate.brands?.name}</p>
                            </div>
                            <button type="button" onClick={() => { setEditingPlate(null); setEditError(null); }} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-6">
                            <fieldset className="space-y-3">
                                <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-700 w-full">Satış Ayarları</legend>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Satış Modu</label>
                                    <select value={editingPlate.sales_mode ?? 'quote_only'} onChange={(e) => patchEditingPlate({ sales_mode: e.target.value as SalesMode })} className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500">
                                        <option value="quote_only">Sadece Teklif</option>
                                        <option value="single_only">Direkt Alım</option>
                                        <option value="single_or_quote">Alım veya Teklif</option>
                                        <option value="system_only">Sistem Ürünü</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Minimum Sipariş Tipi</label>
                                        <select value={editingPlate.minimum_order_type ?? 'm2'} onChange={(e) => patchEditingPlate({ minimum_order_type: e.target.value as MinimumOrderType })} className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500">
                                            <option value="none">Yok</option><option value="m2">m²</option><option value="package">Paket</option><option value="pallet">Palet</option><option value="quantity">Adet</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Minimum Değer</label>
                                        <input type="number" value={editingPlate.minimum_order_value ?? ''} onChange={(e) => patchEditingPlate({ minimum_order_value: e.target.value ? Number(e.target.value) : null })} disabled={(editingPlate.minimum_order_type ?? 'm2') === 'none'} placeholder="örn. 40" className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 disabled:opacity-40" />
                                    </div>
                                </div>
                            </fieldset>
                            <fieldset className="space-y-3">
                                <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-700 w-full">Fiyat Davranışı</legend>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Fiyat Görünürlüğü</label>
                                    <select value={editingPlate.pricing_visibility_mode ?? 'quote_required'} onChange={(e) => patchEditingPlate({ pricing_visibility_mode: e.target.value as PricingVisibilityMode })} className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500">
                                        <option value="quote_required">Teklif ile belirlenir</option><option value="from_price">Başlangıç fiyatı göster</option><option value="exact_price">Tam fiyat göster</option><option value="hidden">Fiyat gizle</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={editingPlate.requires_city_for_pricing ?? true} onChange={(e) => patchEditingPlate({ requires_city_for_pricing: e.target.checked })} className="rounded border-slate-600 bg-slate-800" />
                                        <span className="text-sm text-slate-300">Fiyat için şehir gerekli</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={editingPlate.requires_system_context ?? false} onChange={(e) => patchEditingPlate({ requires_system_context: e.target.checked })} className="rounded border-slate-600 bg-slate-800" />
                                        <span className="text-sm text-slate-300">Sistem ürünü</span>
                                    </label>
                                </div>
                            </fieldset>
                            <fieldset className="space-y-3">
                                <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-700 w-full">Katalog Bilgileri</legend>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Slug (URL)</label>
                                    <input type="text" value={editingPlate.slug ?? ''} onChange={(e) => patchEditingPlate({ slug: e.target.value })} placeholder="ornek-urun-tasyunu-5cm" className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-orange-500" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Katalog Açıklaması</label>
                                    <textarea value={editingPlate.catalog_description ?? ''} onChange={(e) => patchEditingPlate({ catalog_description: e.target.value })} rows={3} className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 resize-none" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Meta Başlık</label>
                                    <input type="text" value={editingPlate.meta_title ?? ''} onChange={(e) => patchEditingPlate({ meta_title: e.target.value })} className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Meta Açıklaması</label>
                                    <textarea value={editingPlate.meta_description ?? ''} onChange={(e) => patchEditingPlate({ meta_description: e.target.value })} rows={2} className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 resize-none" />
                                </div>
                            </fieldset>
                            <fieldset className="space-y-3">
                                <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-700 w-full">Depo Stoku (Tuzla)</legend>
                                {(editingPlate._depotStocks ?? []).length > 0 ? (
                                    <div className="rounded-lg border border-slate-700 overflow-hidden">
                                        <div className="grid grid-cols-2 px-3 py-1.5 bg-slate-800/60 text-[11px] text-slate-500 font-medium"><span>Kalınlık</span><span>Stok (m²)</span></div>
                                        {(editingPlate._depotStocks ?? []).map((row) => (
                                            <div key={row.id} className="grid grid-cols-2 items-center px-3 py-2 border-t border-slate-700/50">
                                                <span className="text-xs text-slate-300">{row.thickness} cm</span>
                                                <input type="number" min={0} value={row.stock_tuzla} onChange={(e) => setEditingPlate((prev) => (prev ? { ...prev, _depotStocks: (prev._depotStocks ?? []).map((r) => r.id === row.id ? { ...r, stock_tuzla: Number(e.target.value) } : r) } : prev))} className="w-24 bg-slate-800 border border-slate-600 text-white text-sm rounded px-2 py-1 focus:outline-none focus:border-orange-500" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-slate-500">Bu ürün için kalınlık fiyatı tanımlanmamış.</p>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">İskonto (%)</label>
                                        <input type="number" min={0} max={100} value={editingPlate.depot_discount ?? 0} onChange={(e) => patchEditingPlate({ depot_discount: Number(e.target.value) })} className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Min. Sipariş (m²)</label>
                                        <input type="number" min={1} value={editingPlate.depot_min_m2 ?? 300} onChange={(e) => patchEditingPlate({ depot_min_m2: Number(e.target.value) })} className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500" />
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-500">0 olan kalınlıklar için Depo tier&apos;ı gösterilmez.</p>
                            </fieldset>
                            {editError && <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{editError}</p>}
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-700">
                            <button type="button" onClick={() => { setEditingPlate(null); setEditError(null); }} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">İptal</button>
                            <button type="button" disabled={editSaving} onClick={() => savePlateRules(editingPlate.id, {
                                sales_mode: editingPlate.sales_mode, pricing_visibility_mode: editingPlate.pricing_visibility_mode,
                                minimum_order_type: editingPlate.minimum_order_type, minimum_order_value: editingPlate.minimum_order_value,
                                requires_city_for_pricing: editingPlate.requires_city_for_pricing, requires_system_context: editingPlate.requires_system_context,
                                slug: editingPlate.slug || null, catalog_description: editingPlate.catalog_description || null,
                                meta_title: editingPlate.meta_title || null, meta_description: editingPlate.meta_description || null,
                                depot_discount: editingPlate.depot_discount ?? 0, depot_min_m2: editingPlate.depot_min_m2 ?? 300,
                                plate_prices_depot: (editingPlate._depotStocks ?? []).map((r) => ({ id: r.id, stock_tuzla: r.stock_tuzla })),
                            })} className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                                {editSaving ? 'Kaydediliyor…' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Aksesuar Katalog Kural Düzenleme Modal */}
            {editingAccessory && createPortal((() => {
                // Live validation + preview — kullanıcı yazarken anlık güncellenir
                const draftRules: ProductRules = {
                    sales_mode: editingAccessory.sales_mode ?? 'system_only',
                    pricing_visibility_mode: editingAccessory.pricing_visibility_mode ?? 'quote_required',
                    minimum_order_type: editingAccessory.minimum_order_type ?? 'none',
                    minimum_order_value: editingAccessory.minimum_order_value ?? null,
                    requires_city_for_pricing: false,
                    requires_system_context: editingAccessory.requires_system_context ?? true,
                    recommended_bundle_family: null,
                };
                const issues = validateRules(draftRules);
                const preview = getRulesPreview(draftRules, editingAccessory.base_price ?? null);
                const hasError = (field: string) => issues.find(i => i.field === field);

                return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                            <div>
                                <h2 className="text-base font-semibold text-white">Aksesuar Katalog Kuralları</h2>
                                <p className="text-xs text-slate-400 mt-0.5">{editingAccessory.name} — {editingAccessory.brands?.name}</p>
                            </div>
                            <button type="button" onClick={() => { setEditingAccessory(null); setEditError(null); }} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-6">
                            <fieldset className="space-y-3">
                                <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-700 w-full">Satış Ayarları</legend>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Satış Modu</label>
                                    <select value={editingAccessory.sales_mode ?? 'system_only'} onChange={(e) => patchEditingAccessory({ sales_mode: e.target.value as SalesMode })} className={`w-full bg-slate-800 border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 ${hasError('sales_mode') ? 'border-red-500' : 'border-slate-600'}`}>
                                        <option value="system_only">Sistem Ürünü</option>
                                        <option value="single_or_quote">Alım veya Teklif</option>
                                        <option value="single_only">Direkt Alım</option>
                                        <option value="quote_only">Sadece Teklif</option>
                                    </select>
                                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                        Müşteri bu ürünle ne yapabilir?<br/>
                                        <span className="text-slate-400">• Sistem Ürünü: Tek başına satılmaz, paket içinde<br/>• Alım veya Teklif: Hem direkt sipariş, hem teklif<br/>• Direkt Alım: Sepete ekleyip sipariş ver<br/>• Sadece Teklif: Yalnız teklif iste</span>
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Fiyat Görünürlüğü</label>
                                    <select value={editingAccessory.pricing_visibility_mode ?? 'quote_required'} onChange={(e) => patchEditingAccessory({ pricing_visibility_mode: e.target.value as PricingVisibilityMode })} className={`w-full bg-slate-800 border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 ${hasError('pricing_visibility_mode') ? 'border-red-500' : 'border-slate-600'}`}>
                                        <option value="quote_required">Teklif ile belirlenir</option>
                                        <option value="from_price">Başlangıç fiyatı göster</option>
                                        <option value="exact_price">Tam fiyat göster</option>
                                        <option value="hidden">Fiyat gizle</option>
                                    </select>
                                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                        Müşteri sayfada fiyatı nasıl görür?<br/>
                                        <span className="text-slate-400">• Teklif ile belirlenir: &ldquo;Fiyat için teklif al&rdquo;<br/>• Başlangıç fiyatı: &ldquo;850 ₺&apos;ten başlayan&rdquo;<br/>• Tam fiyat: Net rakam görünür<br/>• Gizle: Hiçbir fiyat gösterme</span>
                                    </p>
                                    {hasError('pricing_visibility_mode') && (
                                        <p className="text-xs text-red-400 mt-1">⚠ {hasError('pricing_visibility_mode')!.message}</p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Min. Sipariş Tipi</label>
                                        <select value={editingAccessory.minimum_order_type ?? 'none'} onChange={(e) => patchEditingAccessory({ minimum_order_type: e.target.value as MinimumOrderType })} className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500">
                                            <option value="none">Yok</option><option value="m2">m²</option><option value="package">Paket</option><option value="pallet">Palet</option><option value="quantity">Adet</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Min. Değer</label>
                                        <input type="number" value={editingAccessory.minimum_order_value ?? ''} onChange={(e) => patchEditingAccessory({ minimum_order_value: e.target.value ? Number(e.target.value) : null })} disabled={(editingAccessory.minimum_order_type ?? 'none') === 'none'} placeholder="örn. 10" className={`w-full bg-slate-800 border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 disabled:opacity-40 ${hasError('minimum_order_type') ? 'border-red-500' : 'border-slate-600'}`} />
                                    </div>
                                </div>
                                {hasError('minimum_order_type') && (
                                    <p className="text-xs text-red-400">⚠ {hasError('minimum_order_type')!.message}</p>
                                )}
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    En az ne kadar alınmalı? Birim ile değer (örn. 10 paket).
                                </p>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={editingAccessory.requires_system_context ?? true} onChange={(e) => patchEditingAccessory({ requires_system_context: e.target.checked })} className="rounded border-slate-600 bg-slate-800" />
                                    <span className="text-sm text-slate-300">Sistem ürünü (kombinasyon gerekli)</span>
                                </label>
                            </fieldset>

                            {/* LIVE PREVIEW */}
                            <fieldset className="space-y-2 bg-slate-800/40 border border-slate-700 rounded-lg p-4">
                                <legend className="text-xs font-semibold text-orange-400 uppercase tracking-wider px-2">Önizleme</legend>
                                <div className="text-xs text-slate-400 space-y-2">
                                    <div>
                                        <span className="text-slate-500">📦 Listede:</span>{' '}
                                        <span className="text-slate-200">{preview.cardSummary}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">📄 Detay sayfasında:</span>{' '}
                                        <span className="text-slate-200">{preview.detailPrice}</span>
                                        <span className="text-slate-500"> · CTA: </span>
                                        <span className="text-orange-300">[{preview.detailCta}]</span>
                                    </div>
                                    {preview.minOrderNote && (
                                        <div>
                                            <span className="text-slate-500">📐 </span>
                                            <span className="text-slate-200">{preview.minOrderNote}</span>
                                        </div>
                                    )}
                                </div>
                            </fieldset>
                            <fieldset className="space-y-3">
                                <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-700 w-full">Katalog Bilgileri</legend>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Kapak Görseli</label>
                                    <div className="flex items-start gap-3">
                                        <div className="w-24 h-24 shrink-0 rounded-lg border border-slate-600 bg-slate-800 overflow-hidden flex items-center justify-center">
                                            {editingAccessory.image_cover ? (
                                                <img src={editingAccessory.image_cover} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-[10px] text-slate-500">Görsel yok</span>
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <input type="text" value={editingAccessory.image_cover ?? ''} onChange={(e) => patchEditingAccessory({ image_cover: e.target.value })} placeholder="https://...supabase.co/storage/.../foto.webp" className="w-full bg-slate-800 border border-slate-600 text-white text-xs rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-orange-500" />
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => { ensureImageLibrary(); setImagePickerOpen(true); setImagePickerQuery(''); }} className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors">Galeriden Seç</button>
                                                {editingAccessory.image_cover && (
                                                    <button type="button" onClick={() => patchEditingAccessory({ image_cover: null })} className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">Kaldır</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Slug (URL)</label>
                                    <input type="text" value={editingAccessory.slug ?? ''} onChange={(e) => patchEditingAccessory({ slug: e.target.value })} placeholder="ornek-aksesuar" className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-orange-500" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Katalog Açıklaması</label>
                                    <textarea value={editingAccessory.catalog_description ?? ''} onChange={(e) => patchEditingAccessory({ catalog_description: e.target.value })} rows={3} className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 resize-none" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Meta Başlık</label>
                                    <input type="text" value={editingAccessory.meta_title ?? ''} onChange={(e) => patchEditingAccessory({ meta_title: e.target.value })} className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Meta Açıklaması</label>
                                    <textarea value={editingAccessory.meta_description ?? ''} onChange={(e) => patchEditingAccessory({ meta_description: e.target.value })} rows={2} className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 resize-none" />
                                </div>
                            </fieldset>
                            {editError && <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{editError}</p>}
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-700">
                            <button type="button" onClick={() => { setEditingAccessory(null); setEditError(null); }} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">İptal</button>
                            <button
                                type="button"
                                disabled={editSaving || issues.length > 0}
                                title={issues.length > 0 ? 'Önce hataları düzelt' : ''}
                                onClick={() => {
                                    if (issues.length > 0) {
                                        setEditError(issues.map(i => i.message).join(' '));
                                        return;
                                    }
                                    saveAccessoryRules(editingAccessory.id, {
                                        sales_mode: editingAccessory.sales_mode,
                                        pricing_visibility_mode: editingAccessory.pricing_visibility_mode,
                                        minimum_order_type: editingAccessory.minimum_order_type,
                                        minimum_order_value: editingAccessory.minimum_order_value,
                                        requires_system_context: editingAccessory.requires_system_context,
                                        slug: editingAccessory.slug || null,
                                        catalog_description: editingAccessory.catalog_description || null,
                                        meta_title: editingAccessory.meta_title || null,
                                        meta_description: editingAccessory.meta_description || null,
                                        image_cover: editingAccessory.image_cover || null,
                                    });
                                }}
                                className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors">
                                {editSaving ? 'Kaydediliyor…' : (issues.length > 0 ? `${issues.length} hata var` : 'Kaydet')}
                            </button>
                        </div>
                    </div>
                </div>
                );
            })(), document.body)}
            {imagePickerOpen && createPortal(
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setImagePickerOpen(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                            <h3 className="text-sm font-semibold text-white">Görsel Galerisi ({imageLibrary.length})</h3>
                            <button onClick={() => setImagePickerOpen(false)} className="text-slate-400 hover:text-white">×</button>
                        </div>
                        <div className="px-5 py-3 border-b border-slate-700">
                            <input type="text" value={imagePickerQuery} onChange={(e) => setImagePickerQuery(e.target.value)} placeholder="Dosya adında ara..." className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500" autoFocus />
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {!imageLibraryLoaded ? (
                                <p className="text-sm text-slate-400 text-center py-8">Yükleniyor...</p>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                    {imageLibrary
                                        .filter((f) => !imagePickerQuery || f.name.toLowerCase().includes(imagePickerQuery.toLowerCase()))
                                        .map((f) => (
                                            <button
                                                key={f.name}
                                                type="button"
                                                onClick={() => {
                                                    setEditingAccessory((prev) => (prev ? { ...prev, image_cover: f.url } : prev));
                                                    setImagePickerOpen(false);
                                                }}
                                                className={`group relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${editingAccessory?.image_cover === f.url ? 'border-orange-500' : 'border-slate-700 hover:border-slate-500'}`}
                                            >
                                                <img src={f.url} alt={f.name} className="w-full h-full object-cover" loading="lazy" />
                                                <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1 text-[10px] text-white font-mono truncate">{f.name}</div>
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
