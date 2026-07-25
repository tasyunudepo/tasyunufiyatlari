"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { LogisticsCapacity } from "@/lib/types";

export function LogisticsTab() {
    const [logisticsData, setLogisticsData] = useState<LogisticsCapacity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadLogistics() {
            const { data, error } = await supabase
                .from("logistics_capacity")
                .select("*")
                .order("thickness");
            if (!error && data) setLogisticsData(data);
            setLoading(false);
        }
        loadLogistics();
    }, []);

    if (loading) {
        return <div className="admin-nexus-panel p-6"><p className="text-slate-400">Yükleniyor...</p></div>;
    }

    return (
        <div className="admin-nexus-panel p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Lojistik Yönetimi</h2>
            <p className="text-slate-400 mb-6">Kalınlık bazlı paket bilgileri ve araç kapasiteleri</p>
            <div className="overflow-x-auto">
                <table className="admin-nexus-table min-w-full">
                    <thead>
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Kalınlık</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Paket İçi</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Paket m²</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Kamyon m² (paket)</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tır m² (paket)</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Popüler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logisticsData.map((item) => (
                            <tr key={item.thickness} className={item.is_popular ? "bg-amber-500/10 border-l-4 border-amber-400" : ""}>
                                <td className="px-4 py-3 text-sm font-medium text-white">{item.thickness / 10} cm ({item.thickness}mm)</td>
                                <td className="px-4 py-3 text-sm text-slate-300">{item.items_per_package} adet</td>
                                <td className="px-4 py-3 text-sm text-slate-300">{item.package_size_m2} m²</td>
                                <td className="px-4 py-3 text-sm text-slate-300 font-medium">
                                    {(item.lorry_capacity_packages * item.package_size_m2).toFixed(1)} m² <span className="text-slate-500">({item.lorry_capacity_packages} paket)</span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-300 font-medium">
                                    {(item.truck_capacity_packages * item.package_size_m2).toFixed(1)} m² <span className="text-slate-500">({item.truck_capacity_packages} paket)</span>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    {item.is_popular ? (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">⭐ Popüler</span>
                                    ) : (
                                        <span className="text-slate-500">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {logisticsData.length === 0 && <p className="text-center text-slate-500 py-8">Lojistik verisi bulunamadı</p>}
        </div>
    );
}
