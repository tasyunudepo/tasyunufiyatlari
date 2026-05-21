"use client";

import { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";

interface Props {
    activeSection: string;
    onNavigate: (id: string) => void;
    children: ReactNode;
}

export function AdminShell({ activeSection, onNavigate, children }: Props) {
    return (
        <div className="nx-shell">
            <div className="nx-blobs">
                <div className="nx-blob-mid" />
            </div>

            <AdminSidebar active={activeSection} onNavigate={onNavigate} />

            <div className="relative z-10 flex flex-col" style={{ marginLeft: "240px" }}>
                <AdminTopbar activeSection={activeSection} />
                <main className="flex-1 px-6 py-6 min-w-0 animate-nx-fade-in">
                    <div className="max-w-[1280px] mx-auto w-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
