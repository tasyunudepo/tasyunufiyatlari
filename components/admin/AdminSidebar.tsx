"use client";

import {
    LayoutDashboard, FileText, BarChart2, Sliders, Package, Flame, FlaskConical,
} from "lucide-react";

// Menü TEK kaynaktır: Topbar başlıkları da buradan türetilir (audit:
// etiketler iki dosyada kopyalanmıştı). 12 sekme → 6 gruplu yapı
// (15 Temmuz 2026 audit kararı): Fiyatlandırma ve Katalog çatı sekmeleri
// alt-sekmelerini kendi içinde barındırır.
export const NAV_ITEMS = [
    { id: "dashboard",   label: "Genel Bakış",     Icon: LayoutDashboard },
    { id: "quotes",      label: "Teklifler",        Icon: FileText },
    { id: "experiments", label: "Satış Deneyleri",  Icon: FlaskConical },
    { id: "analytics",   label: "Analiz",           Icon: BarChart2 },
    { id: "pricing",     label: "Fiyatlandırma",    Icon: Sliders },
    { id: "catalog",     label: "Katalog",          Icon: Package },
] as const;

export const SECTION_LABELS: Record<string, string> = Object.fromEntries(
    NAV_ITEMS.map((item) => [item.id, item.label]),
);

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

            {/* Sürüm bilgisi (eski sahte "Sistem Durumu" ışıklarının yerine —
                ışıklar hiçbir gerçek durumu ölçmüyordu) */}
            <div className="px-4 py-4 border-t border-[var(--nx-border)]">
                <p className="text-[10px] leading-relaxed text-[var(--nx-text-muted)]">
                    Next.js 16.2.9 · React 19.2.1 · Supabase
                </p>
            </div>
        </nav>
    );
}
