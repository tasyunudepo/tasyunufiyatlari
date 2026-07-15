"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Bell, Home, User, LogOut } from "lucide-react";

const SECTION_LABELS: Record<string, string> = {
    dashboard:    "Dashboard",
    quotes:       "Teklifler",
    analytics:    "Talep Analizi",
    logistics:    "Lojistik",
    discounts:    "İskontolar",
    products:     "Ürünler",
    "excel-import": "Excel Yükle",
    "margin-rules": "Marj Kuralları",
    brands:       "Markalar",
    settings:     "Ayarlar",
};

interface Props {
    activeSection: string;
}

export function AdminTopbar({ activeSection }: Props) {
    const [time, setTime] = useState("");
    const [date, setDate] = useState("");
    const [authUser, setAuthUser] = useState("");

    useEffect(() => {
        const tick = () => {
            const now = new Date();
            setTime(now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
            setDate(now.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        fetch("/api/admin/me", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : { user: "" }))
            .then((d) => setAuthUser(d.user ?? ""))
            .catch(() => setAuthUser(""));
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
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="text-[var(--nx-text-muted)]">Admin</span>
                <span className="text-[var(--nx-text-muted)]">/</span>
                <span className="text-[var(--nx-gold)] font-medium truncate">
                    {SECTION_LABELS[activeSection] ?? activeSection}
                </span>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-sm hidden md:block">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--nx-text-muted)]" />
                    <input
                        type="text"
                        aria-label="Admin içinde ara"
                        placeholder="Ara…"
                        className="w-full h-9 pl-9 pr-3 text-xs rounded-xl bg-[rgba(18,20,24,0.72)] border border-[rgba(92,98,108,0.24)] text-[var(--nx-text)] placeholder:text-[var(--nx-text-muted)] focus:outline-none focus-visible:border-[var(--nx-border-accent)] focus-visible:ring-2 focus-visible:ring-[rgba(201,168,76,0.12)] backdrop-blur-md transition-colors"
                    />
                </div>
            </div>

            {/* Right: time + actions */}
            <div className="ml-auto flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end leading-none">
                    <span className="font-mono text-xs text-[var(--nx-gold)] tracking-wider">{time}</span>
                    <span className="font-mono text-[10px] text-[var(--nx-text-muted)] mt-0.5">{date}</span>
                </div>

                <button aria-label="Bildirimleri aç" className="relative w-9 h-9 rounded-xl border border-[rgba(92,98,108,0.24)] bg-[rgba(18,20,24,0.72)] flex items-center justify-center text-[var(--nx-text-soft)] hover:text-[var(--nx-gold)] hover:border-[var(--nx-border-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(201,168,76,0.14)] backdrop-blur-md transition-colors">
                    <Bell className="w-3.5 h-3.5" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--nx-gold)] shadow-[0_0_6px_rgba(201,168,76,0.6)]" />
                </button>

                <Link
                    href="/"
                    className="h-9 px-3 rounded-xl border border-[rgba(92,98,108,0.24)] bg-[rgba(18,20,24,0.72)] flex items-center gap-1.5 text-xs text-[var(--nx-text-soft)] hover:text-[var(--nx-gold)] hover:border-[var(--nx-border-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(201,168,76,0.14)] backdrop-blur-md transition-colors"
                >
                    <Home className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ana Sayfa</span>
                </Link>

                <div
                    className="h-9 px-2.5 rounded-xl flex items-center gap-2 flex-shrink-0"
                    style={{
                        background: "linear-gradient(135deg, rgba(201,168,76,0.22) 0%, rgba(184,115,51,0.22) 100%)",
                        border: "1px solid rgba(201,168,76,0.30)",
                    }}
                    aria-label="Giriş yapan kullanıcı"
                >
                    <User className="w-4 h-4 text-[var(--nx-gold)] shrink-0" />
                    <span className="hidden sm:inline text-xs font-medium text-[var(--nx-gold)] tracking-wide truncate max-w-[120px]">
                        {authUser || "—"}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="Çıkış yap"
                    title="Çıkış yap"
                    className="h-9 px-3 rounded-xl border border-[rgba(92,98,108,0.24)] bg-[rgba(18,20,24,0.72)] flex items-center gap-1.5 text-xs text-[var(--nx-text-soft)] hover:text-[var(--nx-gold)] hover:border-[var(--nx-border-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(201,168,76,0.14)] backdrop-blur-md transition-colors"
                >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Çıkış</span>
                </button>
            </div>
        </header>
    );
}
