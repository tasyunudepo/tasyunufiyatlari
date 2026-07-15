"use client";

import {
    LayoutDashboard, FileText, Truck, Tag,
    Package, Upload, Settings, Flame, BarChart2, Sliders, Store, FlaskConical,
} from "lucide-react";

const NAV_ITEMS = [
    { id: "dashboard",    label: "Dashboard",        Icon: LayoutDashboard },
    { id: "quotes",       label: "Teklifler",         Icon: FileText },
    { id: "experiments",  label: "Satış Deneyleri",   Icon: FlaskConical },
    { id: "analytics",    label: "Talep Analizi",     Icon: BarChart2 },
    { id: "margin-rules", label: "Marj Kuralları",   Icon: Sliders },
    { id: "brands",       label: "Markalar",          Icon: Store },
    { id: "logistics",    label: "Lojistik",          Icon: Truck },
    { id: "discounts",    label: "İskontolar",        Icon: Tag },
    { id: "products",     label: "Ürünler",           Icon: Package },
    { id: "excel-import", label: "Excel Yükle",       Icon: Upload },
    { id: "settings",     label: "Ayarlar",           Icon: Settings },
];

interface Props {
    active: string;
    onNavigate: (id: string) => void;
}

export function AdminSidebar({ active, onNavigate }: Props) {
    return (
        <nav className="nx-sidebar">
            {/* Logo */}
            <div className="flex items-center gap-3 px-4 py-5 border-b border-[var(--nx-border)]">
                <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                        background: "linear-gradient(135deg, #c9a84c 0%, #b87333 100%)",
                        boxShadow: "0 6px 20px rgba(201,168,76,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
                    }}
                >
                    <Flame className="w-5 h-5 text-[#1a1510]" strokeWidth={2.3} />
                </div>
                <div>
                    <p className="text-sm font-bold text-[var(--nx-text)] tracking-tight leading-none">TASYÜNÜ</p>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--nx-gold)] mt-0.5 leading-none">Admin Paneli</p>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 px-3 py-4 space-y-1">
                <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.2em] text-[var(--nx-text-muted)]">
                    Navigasyon
                </p>
                {NAV_ITEMS.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        onClick={() => onNavigate(id)}
                        aria-current={active === id ? "page" : undefined}
                        className={`nx-nav-item w-full text-left ${active === id ? "active" : ""}`}
                    >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1">{label}</span>
                        {active === id && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--nx-gold)] animate-nx-pulse" />
                        )}
                    </button>
                ))}
            </div>

            {/* Status footer */}
            <div className="px-3 py-4 border-t border-[var(--nx-border)]">
                <p className="px-1 mb-2 text-[10px] uppercase tracking-[0.2em] text-[var(--nx-text-muted)]">
                    Sistem Durumu
                </p>
                <div className="nx-card p-3 space-y-2">
                    <StatusLine label="Veritabanı" color="green" />
                    <StatusLine label="Teklif Akışı" color="cyan" />
                    <StatusLine label="Import API" color="green" />
                </div>
            </div>
        </nav>
    );
}

function StatusLine({ label, color }: { label: string; color: "green" | "cyan" | "amber" | "red" }) {
    const colors = {
        green: "bg-[var(--nx-green)] shadow-[0_0_8px_rgba(34,197,94,0.5)]",
        cyan:  "bg-[var(--nx-gold)] shadow-[0_0_8px_rgba(201,168,76,0.5)]",
        amber: "bg-[var(--nx-amber)] shadow-[0_0_8px_rgba(245,158,11,0.5)]",
        red:   "bg-[var(--nx-red)] shadow-[0_0_8px_rgba(239,68,68,0.5)]",
    };
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--nx-text-soft)]">{label}</span>
            <span className={`w-2 h-2 rounded-full ${colors[color]}`} />
        </div>
    );
}
