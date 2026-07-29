"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";

interface Props {
    activeSection: string;
    onNavigate: (id: string) => void;
    children: ReactNode;
}

export function AdminShell({ activeSection, onNavigate, children }: Props) {
    // Kenar çubuğu <1024px'te çekmece olur (audit E1/V1: eskiden inline
    // marginLeft:240px sabitti ve hiçbir medya sorgusu yoktu; 375px'te
    // içeriğe 135px kalıyordu). Masaüstünde bu durum yok sayılır —
    // CSS sabit 240px sütunu geri verir.
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Sekme seçilince çekmece kapanır — effect içinde setState yerine
    // doğrudan olay içinde, çünkü kapanış gezinmenin bir parçası.
    const handleNavigate = (id: string) => {
        setDrawerOpen(false);
        onNavigate(id);
    };

    // Esc ile kapanış — klavyeyle çıkış yolu olmalı.
    useEffect(() => {
        if (!drawerOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setDrawerOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [drawerOpen]);

    return (
        <div className="nx-shell">
            <div className="nx-blobs">
                <div className="nx-blob-mid" />
            </div>

            <div
                className="nx-sidebar-backdrop"
                data-open={drawerOpen ? "true" : "false"}
                onClick={() => setDrawerOpen(false)}
                aria-hidden="true"
            />

            <AdminSidebar
                active={activeSection}
                onNavigate={handleNavigate}
                open={drawerOpen}
            />

            <div className="nx-content relative z-10 flex flex-col">
                <AdminTopbar
                    activeSection={activeSection}
                    drawerOpen={drawerOpen}
                    onToggleDrawer={() => setDrawerOpen((v) => !v)}
                />
                <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 min-w-0 animate-nx-fade-in">
                    <div className="max-w-[1280px] mx-auto w-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
