"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Native controls in a disclosure: Tab navigation, Escape and outside close. */
export function QuoteMoreActions({ name, children }: { name: string; children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const id = useId();

    useEffect(() => {
        if (!open) return;
        const outside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", outside);
        return () => document.removeEventListener("pointerdown", outside);
    }, [open]);

    return (
        <div ref={root} className="ofis-more" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }} onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
                event.preventDefault(); event.stopPropagation();
                setOpen(false); trigger.current?.focus();
            }
        }}>
            <button ref={trigger} type="button" className="ofis-secondary"
                aria-expanded={open} aria-controls={id} aria-label={`${name}: Diğer işlemler`}
                onClick={() => setOpen(!open)}>
                Diğer <ChevronDown size={16} aria-hidden="true" />
            </button>
            {open && <div id={id} className="ofis-more-panel" role="group" aria-label={`${name}: Diğer işlemler`}>
                {children}
            </div>}
        </div>
    );
}
