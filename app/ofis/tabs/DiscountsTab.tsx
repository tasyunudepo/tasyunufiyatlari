"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ShippingZone } from "@/lib/types";

// İskonto Yönetimi (salt-okunur görünüm): şehir bazlı gerçek iskonto
// kolonları. Not: Yeşil/Sarı/Kırmızı "bölge" sınıflandırması bir veritabanı
// alanına dayanmıyordu (shipping_zones.zone kolonu yok) — hep boş
// gösteriyordu; kaldırıldı. Sınıflandırma gerçek bir özellik olarak
// istenirse eşikler ticari kararla tanımlanıp ayrıca eklenmeli.

export function DiscountsTab() {
    const [zones, setZones] = useState<ShippingZone[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

    useEffect(() => {
        async function loadZones() {
            const { data, error } = await supabase
                .from("shipping_zones")
                .select("*")
                .order("city_name");
            if (!error && data) setZones(data);
            setLoading(false);
        }
        loadZones();
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLocaleLowerCase("tr-TR");
        if (!q) return zones;
        return zones.filter((z) =>
            (z.city_name ?? "").toLocaleLowerCase("tr-TR").includes(q),
        );
    }, [zones, query]);

    if (loading) {
        return (
            <div className="admin-nexus-panel p-6">
                <p className="text-slate-400">Yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="admin-nexus-panel p-6">
            <h2 className="text-lg font-semibold text-white mb-1">İskonto Yönetimi</h2>
            <p className="text-sm text-slate-400 mb-4">
                Şehir bazlı nakliye ve grup iskonto oranları ({zones.length} şehir)
            </p>

            <div className="mb-4">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Şehir ara…"
                    className="admin-nexus-input w-full max-w-xs px-3 py-2 text-sm"
                />
            </div>

            <div className="admin-nexus-table-wrap">
                <table className="admin-nexus-table min-w-full">
                    <thead>
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Şehir</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase" title="Taşyünü tam TIR iskontosu">TIR İsk.</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase" title="Taşyünü tam Kamyon iskontosu">Kamyon İsk.</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase" title="EPS + Toz grubu bölge iskontosu (İSK1)">EPS/Toz Bölge</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase" title="Optimix toz grubu iskontosu">Optimix Toz</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase" title="Optimix levha iskontosu">Optimix Levha</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((zone) => (
                            <tr key={zone.city_code}>
                                <td className="px-4 py-3 text-sm text-white">{zone.city_name}</td>
                                <td className="px-4 py-3 text-sm text-right tabular-nums text-slate-200">{zone.discount_tir}%</td>
                                <td className="px-4 py-3 text-sm text-right tabular-nums text-slate-200">{zone.discount_kamyon}%</td>
                                <td className="px-4 py-3 text-sm text-right tabular-nums text-slate-300">{zone.eps_toz_region_discount ?? 0}%</td>
                                <td className="px-4 py-3 text-sm text-right tabular-nums text-slate-300">{zone.optimix_toz_discount}%</td>
                                <td className="px-4 py-3 text-sm text-right tabular-nums text-slate-300">{zone.optimix_levha_discount}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-6">
                        “{query}” ile eşleşen şehir yok.
                    </p>
                )}
            </div>
        </div>
    );
}
