"use client";

import {
    LayoutDashboard, FileText, BarChart2, Sliders, Package, Flame, FlaskConical,
    Users, Boxes, StickyNote, ListChecks, LineChart, Settings,
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

// Hızlı erişim: altı ana bölüm aynen durur; bunlar gerçek kayıt gösteren ek
// görünümlere ve var olan bölümlere kısa yoldur. `target` doluysa o ana
// bölüme götürür (Ürünler → Katalog, Raporlar → Analiz).
export const QUICK_ITEMS = [
    { id: "customers", label: "Müşteriler",    Icon: Users },
    { id: "products",  label: "Ürünler",       Icon: Boxes,     target: "catalog" },
    { id: "notes",     label: "Proje Notları", Icon: StickyNote },
    { id: "tasks",     label: "Görevler",      Icon: ListChecks },
    { id: "reports",   label: "Raporlar",      Icon: LineChart, target: "analytics" },
] as const;

export const SECTION_LABELS: Record<string, string> = Object.fromEntries(
    [...NAV_ITEMS, ...QUICK_ITEMS, { id: "settings", label: "Ayarlar" }].map((item) => [item.id, item.label]),
);

interface Props {
    active: string;
    onNavigate: (id: string) => void;
    /** Dar ekranda çekmece açık mı (masaüstünde yok sayılır). */
    open?: boolean;
}

export function AdminSidebar({ active, onNavigate, open = false }: Props) {
    return (
        <nav
            className="nx-sidebar"
            data-open={open ? "true" : "false"}
            aria-label="Ofis navigasyonu"
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-4 py-5 border-b border-[var(--nx-border)]">
                <div
                    className="ofis-brand-mark w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                >
                    <Flame className="w-5 h-5 text-[#1a1510]" strokeWidth={2.3} />
                </div>
                <div>
                    <p className="text-base font-bold text-[var(--nx-text)] tracking-tight leading-none">TAŞYÜNÜ</p>
                    <p className="text-sm uppercase tracking-[0.22em] text-[var(--nx-gold)] mt-0.5 leading-none">Ofis</p>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 px-3 py-4 space-y-1">
                <p className="px-3 mb-2 text-sm uppercase tracking-[0.2em] text-[var(--nx-text-muted)]">
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
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--nx-gold)]" />
                        )}
                    </button>
                ))}

                <p className="px-3 mt-5 mb-2 text-sm uppercase tracking-[0.2em] text-[var(--nx-text-muted)]">
                    Hızlı erişim
                </p>
                {QUICK_ITEMS.map(({ id, label, Icon, ...rest }) => {
                    const target = "target" in rest ? rest.target : id;
                    return (
                        <button
                            key={id}
                            onClick={() => onNavigate(target)}
                            aria-current={active === id ? "page" : undefined}
                            className={`nx-nav-item w-full text-left ${active === id ? "active" : ""}`}
                        >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1">{label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="px-3 pb-2">
                <button
                    onClick={() => onNavigate("settings")}
                    aria-current={active === "settings" ? "page" : undefined}
                    className={`nx-nav-item w-full text-left ${active === "settings" ? "active" : ""}`}
                >
                    <Settings className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">Ayarlar</span>
                </button>
            </div>

            {/* Sürüm bilgisi (eski sahte "Sistem Durumu" ışıklarının yerine —
                ışıklar hiçbir gerçek durumu ölçmüyordu) */}
            <div className="px-4 py-4 border-t border-[var(--nx-border)]">
                <p className="text-sm leading-relaxed text-[var(--nx-text-muted)]">
                    Teklif ve satış yönetimi
                </p>
            </div>
        </nav>
    );
}
