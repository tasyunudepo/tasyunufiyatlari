"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { ShippingZone } from "@/lib/types";

export function DiscountsTab() {
    const [zones, setZones] = useState<ShippingZone[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadZones() {
            const { data, error } = await supabase.from("shipping_zones").select("*").order("city_name");
            if (!error && data) setZones(data);
            setLoading(false);
        }
        loadZones();
    }, []);

    const greenZone = zones.filter(z => z.zone === "green");
    const yellowZone = zones.filter(z => z.zone === "yellow");
    const redZone = zones.filter(z => z.zone === "red");

    if (loading) {
        return <div className="admin-nexus-panel p-6"><p className="text-slate-400">Yükleniyor...</p></div>;
    }

    return (
        <div className="admin-nexus-panel p-6">
            <h2 className="text-lg font-semibold text-white mb-4">İskonto Yönetimi</h2>
            <p className="text-sm text-slate-400 mb-6">Bölge ve şehir bazlı iskonto oranları ({zones.length} şehir)</p>
            <div className="space-y-6">
                <div>
                    <h3 className="font-semibold text-white mb-3">Bölge İskontoları</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { zone: greenZone, color: "green", label: "🟢 Yeşil Bölge", textColor: "text-green-400", textLight: "text-green-300", border: "border-green-500/30", bg: "bg-green-600/10", borderFull: "border-2 border-green-500/30" },
                            { zone: yellowZone, color: "yellow", label: "🟡 Sarı Bölge", textColor: "text-yellow-400", textLight: "text-yellow-300", border: "border-yellow-500/30", bg: "bg-yellow-600/10", borderFull: "border-2 border-yellow-500/30" },
                            { zone: redZone, color: "red", label: "🔴 Kırmızı Bölge", textColor: "text-red-400", textLight: "text-red-300", border: "border-red-500/30", bg: "bg-red-600/10", borderFull: "border-2 border-red-500/30" },
                        ].map(({ zone, label, textColor, textLight, bg, borderFull }) => (
                            <div key={label} className={`${borderFull} ${bg} rounded-xl p-4 backdrop-blur-sm`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`font-semibold ${textColor}`}>{label}</span>
                                    <span className={`text-sm ${textLight}`}>{zone.length} şehir</span>
                                </div>
                                <p className="text-xs text-slate-400 mb-3">{zone.map(z => z.city_name).join(", ").substring(0, 60)}...</p>
                                {zone.length > 0 && (
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between"><span className="text-slate-400">TIR İskonto:</span><span className={`font-medium ${textLight}`}>{zone[0].discount_tir}%</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Kamyon İskonto:</span><span className={`font-medium ${textLight}`}>{zone[0].discount_kamyon}%</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Optimix Toz:</span><span className={`font-medium ${textLight}`}>{zone[0].optimix_toz_discount}%</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Optimix Levha:</span><span className={`font-medium ${textLight}`}>{zone[0].optimix_levha_discount}%</span></div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 className="font-semibold text-white mb-3">Tüm Şehirler</h3>
                    <div className="admin-nexus-table-wrap">
                        <table className="admin-nexus-table min-w-full">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Şehir</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Bölge</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">TIR İsk.</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Kamyon İsk.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {zones.slice(0, 10).map((zone, index) => (
                                    <tr key={`${zone.city_code}-${index}`}>
                                        <td className="px-4 py-3 text-sm text-white">{zone.city_name}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${zone.zone === "green" ? "bg-green-500/20 text-green-400 border-green-500/30" : zone.zone === "yellow" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
                                                {zone.zone === "green" ? "🟢 Yeşil" : zone.zone === "yellow" ? "🟡 Sarı" : "🔴 Kırmızı"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-300">{zone.discount_tir}%</td>
                                        <td className="px-4 py-3 text-sm text-slate-300">{zone.discount_kamyon}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {zones.length > 10 && <p className="text-xs text-slate-500 text-center py-2">İlk 10 şehir gösteriliyor. Toplam: {zones.length}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
