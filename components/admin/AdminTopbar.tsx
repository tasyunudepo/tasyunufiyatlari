"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Home, User, LogOut, Eye, Menu, X, Plus, Search } from "lucide-react";
import { SECTION_LABELS } from "./AdminSidebar";
import { useAdminRole } from "@/lib/admin/useAdminRole";
import { READ_ONLY_HINT } from "@/lib/admin/roles";

interface Props {
    activeSection: string;
    drawerOpen?: boolean;
    onToggleDrawer?: () => void;
    /** Arama Teklifler listesini bu metinle açar. */
    onSearch?: (term: string) => void;
    onNewQuote?: () => void;
}

export function AdminTopbar({ activeSection, drawerOpen = false, onToggleDrawer, onSearch, onNewQuote }: Props) {
    const [term, setTerm] = useState("");
    const [time, setTime] = useState("");
    const [date, setDate] = useState("");
    // Kimlik/rol tek kaynaktan (useAdminRole) gelir; eski yerel fetch
    // kaldırıldı — aynı isteği hem topbar hem sekmeler atıyordu.
    const { user: authUser, isReadOnly, canMutate } = useAdminRole();

    useEffect(() => {
        const tick = () => {
            const now = new Date();
            setTime(now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }));
            setDate(now.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }));
        };
        tick();
        const id = setInterval(tick, 60_000);
        return () => clearInterval(id);
    }, []);

    const handleLogout = async () => {
        if (!confirm("Çıkış yapmak istediğinize emin misiniz?")) return;
        try {
            await fetch("/api/admin/logout", {
                headers: { Authorization: "Basic " + btoa("logout:logout") },
                cache: "no-store",
            });
        } catch {
            // 401 dönmesi beklenen davranış; fetch yine de hata fırlatabilir.
        }
        window.location.href = "/";
    };

    return (
        <header className="nx-topbar">
            {/* Çekmece düğmesi — yalnız <1024px'te görünür (CSS) */}
            <button
                type="button"
                onClick={onToggleDrawer}
                data-testid="admin-drawer-toggle"
                aria-label={drawerOpen ? "Menüyü kapat" : "Menüyü aç"}
                aria-expanded={drawerOpen}
                className="nx-drawer-toggle h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgba(92,98,108,0.24)] bg-[rgba(18,20,24,0.72)] text-[var(--nx-text-soft)] transition-colors hover:text-[var(--nx-gold)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(201,168,76,0.2)]"
            >
                {drawerOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-base min-w-0">
                <span className="text-[var(--nx-text-muted)]">Ofis</span>
                <span className="text-[var(--nx-text-muted)]">/</span>
                <span className="text-[var(--nx-gold)] font-medium truncate">
                    {SECTION_LABELS[activeSection] ?? activeSection}
                </span>
            </div>

            {onSearch && (
                <form
                    role="search"
                    className="ofis-top-search"
                    onSubmit={(e) => { e.preventDefault(); onSearch(term.trim()); }}
                >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    <input
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        aria-label="Müşteri, teklif veya ürün ara"
                        placeholder="Müşteri, teklif veya ürün ara"
                    />
                </form>
            )}

            {/* Right: time + actions */}
            <div className="ml-auto flex items-center gap-1 sm:gap-3">
                {/* Salt-okunur hesap uyarısı: patron mutasyon kontrollerini hiç
                    görmez, bu rozet nedenini açıklar (audit B1/B3). */}
                {isReadOnly && (
                    <span
                        data-testid="read-only-badge"
                        title={READ_ONLY_HINT}
                        className="hidden md:inline-flex h-11 items-center gap-1.5 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 text-sm font-medium text-sky-200"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        Salt okunur
                    </span>
                )}
                {onNewQuote && canMutate && (
                    <button type="button" onClick={onNewQuote} className="ofis-primary ofis-top-new" aria-label="Yeni teklif yaz">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        <span>Yeni teklif</span>
                    </button>
                )}
                <div className="hidden xl:flex flex-col items-end leading-none">
                    <span className="tabular-nums text-sm text-[var(--nx-gold)] tracking-wider">{time}</span>
                    <span className="tabular-nums text-sm text-[var(--nx-text-muted)] mt-0.5">{date}</span>
                </div>

                <Link
                    href="/"
                    aria-label="Ana sayfa"
                    className="h-11 px-3 rounded-xl border border-[rgba(92,98,108,0.24)] bg-[rgba(18,20,24,0.72)] flex items-center gap-1.5 text-sm text-[var(--nx-text-soft)] hover:text-[var(--nx-gold)] hover:border-[var(--nx-border-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(201,168,76,0.14)] backdrop-blur-md transition-colors"
                >
                    <Home className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ana Sayfa</span>
                </Link>

                <div
                    className="hidden sm:flex h-11 px-2.5 rounded-xl flex items-center gap-2 flex-shrink-0"
                    aria-label="Giriş yapan kullanıcı"
                >
                    <User className="w-4 h-4 text-[var(--nx-gold)] shrink-0" />
                    <span className="hidden sm:inline text-sm font-medium text-[var(--nx-gold)] tracking-wide truncate max-w-[120px]">
                        {authUser || "—"}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="Çıkış yap"
                    title="Çıkış yap"
                    className="h-11 px-3 rounded-xl border border-[rgba(92,98,108,0.24)] bg-[rgba(18,20,24,0.72)] flex items-center gap-1.5 text-sm text-[var(--nx-text-soft)] hover:text-[var(--nx-gold)] hover:border-[var(--nx-border-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(201,168,76,0.14)] backdrop-blur-md transition-colors"
                >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Çıkış</span>
                </button>
            </div>
        </header>
    );
}
