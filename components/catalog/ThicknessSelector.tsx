"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  buildProductPathWithThickness,
  getThicknessFromProductPath,
  parseThicknessQueryValue,
} from "@/lib/catalog/thickness-url";
import { useProductInteractiveOptional } from "./ProductInteractiveContext";

interface ThicknessSelectorProps {
  thicknessOptions: number[];
  popularThickness?: number | null;
  mobileMode?: "block" | "inline";
}

interface MechanicalThicknessPickerProps {
  thicknessOptions: number[];
  activeThickness: number;
  popularThickness: number | null;
  onSelect: (thickness: number) => void;
  mobileMode: "block" | "inline";
}

const ROW_HEIGHT = 48;
const WINDOW_HEIGHT = 188;
const INLINE_WINDOW_HEIGHT = 132;

export default function ThicknessSelector({
  thicknessOptions,
  popularThickness,
  mobileMode = "block",
}: ThicknessSelectorProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const interactive = useProductInteractiveOptional();

  if (!thicknessOptions || thicknessOptions.length === 0) return null;

  // Provider varsa state context'ten; yoksa URL fallback (geri uyumlu)
  const ctxThickness = interactive?.activeThickness ?? null;
  const pathThickness = getThicknessFromProductPath(pathname);
  const queryThickness = parseThicknessQueryValue(searchParams.get("kalinlik"));

  const candidate =
    ctxThickness != null && thicknessOptions.includes(ctxThickness)
      ? ctxThickness
      : pathThickness != null && thicknessOptions.includes(pathThickness)
        ? pathThickness
        : queryThickness != null && thicknessOptions.includes(queryThickness)
          ? queryThickness
          : null;

  const activeThickness =
    candidate ??
    (popularThickness != null && thicknessOptions.includes(popularThickness)
      ? popularThickness
      : thicknessOptions[0]);

  function select(thickness: number) {
    if (interactive) {
      interactive.setActiveThickness(thickness);
      return;
    }
    if (typeof window === "undefined") return;
    const nextPath = buildProductPathWithThickness(pathname, thickness);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("kalinlik");
    const queryString = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${nextPath}${queryString ? `?${queryString}` : ""}`
    );
  }

  if (thicknessOptions.length === 1) {
    return (
      <div className="flex flex-wrap gap-2">
        <span className="rounded-lg border border-brand-500/50 bg-brand-600/20 px-3 py-1.5 text-sm font-medium text-brand-400">
          {thicknessOptions[0]} cm
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="lg:hidden">
        <MechanicalThicknessPicker
          key={`${mobileMode}-${activeThickness}`}
          thicknessOptions={thicknessOptions}
          activeThickness={activeThickness}
          popularThickness={popularThickness ?? null}
          onSelect={select}
          mobileMode={mobileMode}
        />
      </div>

      <div className="hidden lg:flex lg:flex-wrap lg:gap-2">
        {thicknessOptions.map((thickness) => {
          const isActive = thickness === activeThickness;
          const isPopular =
            popularThickness != null &&
            thickness === popularThickness &&
            thickness === activeThickness;

          return (
            <div key={thickness} className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => select(thickness)}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-brand-500/50 bg-brand-600/20 text-brand-400"
                    : "border-fe-border bg-fe-raised/60 text-fe-text hover:border-brand-500/40 hover:text-brand-300"
                }`}
              >
                {thickness} cm
              </button>
              {isPopular && (
                <span className="mt-0.5 text-[9px] leading-none text-brand-400/70">
                  En çok tercih
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function MechanicalThicknessPicker({
  thicknessOptions,
  activeThickness,
  popularThickness,
  onSelect,
  mobileMode,
}: MechanicalThicknessPickerProps) {
  const activeIndex = Math.max(0, thicknessOptions.indexOf(activeThickness));

  const [previewIndex, setPreviewIndex] = useState(activeIndex);
  const [scrollPos, setScrollPos] = useState(activeIndex * ROW_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  const dragStartYRef = useRef(0);
  const dragStartScrollRef = useRef(activeIndex * ROW_HEIGHT);
  const lastMoveYRef = useRef(0);
  const lastMoveTRef = useRef(0);
  const dragVelocityRef = useRef(0);
  const lastHapticIndexRef = useRef(activeIndex);
  const pointerIdRef = useRef<number | null>(null);
  const scrollPosRef = useRef(activeIndex * ROW_HEIGHT);
  const dragDistanceRef = useRef(0);
  const isInline = mobileMode === "inline";

  function pulseHaptic(pattern: number | number[]) {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;

    try {
      navigator.vibrate(pattern);
    } catch {}
  }

  function nearestIndex(position: number) {
    return clamp(Math.round(position / ROW_HEIGHT), 0, thicknessOptions.length - 1);
  }

  function setVirtualScroll(nextPosition: number) {
    const min = 0;
    const max = (thicknessOptions.length - 1) * ROW_HEIGHT;
    let safePosition = nextPosition;

    if (safePosition < min) safePosition = min + (safePosition - min) * 0.35;
    if (safePosition > max) safePosition = max + (safePosition - max) * 0.35;

    setScrollPos(safePosition);
    scrollPosRef.current = safePosition;

    const nextIndex = nearestIndex(safePosition);
    if (isDragging && nextIndex !== lastHapticIndexRef.current) {
      pulseHaptic(12);
      lastHapticIndexRef.current = nextIndex;
    }

    setPreviewIndex(nextIndex);
  }

  function commitIndex(index: number, hapticPattern?: number | number[], silent = false) {
    const safeIndex = clamp(index, 0, thicknessOptions.length - 1);
    const thickness = thicknessOptions[safeIndex];

    if (hapticPattern !== undefined) pulseHaptic(hapticPattern);

    lastHapticIndexRef.current = safeIndex;
    setPreviewIndex(safeIndex);
    setScrollPos(safeIndex * ROW_HEIGHT);
    scrollPosRef.current = safeIndex * ROW_HEIGHT;
    setIsSnapping(true);

    if (!silent && thickness !== activeThickness) {
      onSelect(thickness);
    }
  }

  // İlk açılış nudge — picker'ın "döner" sinyali (drum-picker-v2 prototipinden)
  // Aynı thickness setine bir oturumda 1 kere; URL/onSelect tetiklemez (silent)
  useEffect(() => {
    if (thicknessOptions.length < 2) return;
    if (typeof window === "undefined") return;
    const flagKey = `tn_nudge_${thicknessOptions.join(",")}`;
    try {
      if (window.sessionStorage.getItem(flagKey)) return;
    } catch {
      return;
    }

    const startIdx = activeIndex;
    const teaseIdx =
      startIdx < thicknessOptions.length - 1
        ? startIdx + 1
        : Math.max(0, startIdx - 1);
    if (teaseIdx === startIdx) return;

    const t1 = window.setTimeout(() => commitIndex(teaseIdx, undefined, true), 700);
    const t2 = window.setTimeout(() => {
      commitIndex(startIdx, undefined, true);
      try {
        window.sessionStorage.setItem(flagKey, "1");
      } catch {}
    }, 700 + 380);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function snapFromVelocity(currentScrollPos: number) {
    const flick = Math.round(dragVelocityRef.current * 0.12);
    const targetIndex = nearestIndex(currentScrollPos - flick * ROW_HEIGHT);
    commitIndex(targetIndex);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    setIsDragging(true);
    setIsSnapping(false);
    dragStartYRef.current = event.clientY;
    dragStartScrollRef.current = scrollPos;
    lastMoveYRef.current = event.clientY;
    lastMoveTRef.current = performance.now();
    dragVelocityRef.current = 0;
    dragDistanceRef.current = 0;
    lastHapticIndexRef.current = previewIndex;
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    pulseHaptic(8);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDragging) return;

    const dy = event.clientY - dragStartYRef.current;
    const nextScroll = dragStartScrollRef.current - dy;
    dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.abs(dy));
    const now = performance.now();
    const dt = now - lastMoveTRef.current;

    if (dt > 0) {
      dragVelocityRef.current = ((event.clientY - lastMoveYRef.current) / dt) * 16;
    }

    lastMoveYRef.current = event.clientY;
    lastMoveTRef.current = now;
    setVirtualScroll(nextScroll);
  }

  function handlePointerEnd(event?: ReactPointerEvent<HTMLDivElement>) {
    if (!isDragging) return;

    setIsDragging(false);

    if (event && pointerIdRef.current !== null) {
      try {
        event.currentTarget.releasePointerCapture(pointerIdRef.current);
      } catch {}
    }

    pointerIdRef.current = null;
    snapFromVelocity(scrollPosRef.current);
  }

  function stepSelection(direction: -1 | 1) {
    commitIndex(previewIndex + direction, [6, 10, 6]);
  }

  const selectedThickness = thicknessOptions[previewIndex];
  const centerOffset = (isInline ? INLINE_WINDOW_HEIGHT : WINDOW_HEIGHT) / 2 - ROW_HEIGHT / 2;

  if (isInline) {
    return (
      <div className="w-full pt-1">
        <div className="relative mx-auto flex w-full max-w-[156px] flex-col items-center rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,15,18,0.98),rgba(8,8,10,0.98))] px-0 pb-1 pt-1.5 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="text-[9px] font-semibold uppercase tracking-[0.32em] text-brand-400/70">
            Kalınlık
          </div>

          <button
            type="button"
            onClick={() => stepSelection(-1)}
            className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-fe-text/80 transition-colors hover:text-brand-300 active:scale-95"
            aria-label="Kalınlığı azalt"
          >
            <ChevronUp className="h-3 w-3" />
          </button>

          <div
            className="relative mt-1 h-[132px] w-full overflow-hidden rounded-[20px]"
            style={{ touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            {/* üst/alt fade */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent" />

            {/* aktif satır altın pill — iki dikey halter içerde */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-[48px] -translate-y-1/2 rounded-[12px] border border-brand-400/45 bg-[linear-gradient(180deg,rgba(224,187,111,0.12),rgba(205,164,75,0.22),rgba(120,90,32,0.18))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.18),0_12px_24px_rgba(0,0,0,0.18)]">
              <span className="absolute left-2 top-1/2 h-[22px] w-[8px] -translate-y-1/2 rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.02))]" />
              <span className="absolute right-2 top-1/2 h-[22px] w-[8px] -translate-y-1/2 rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.02))]" />
            </div>

            {/* sağ kenar kademeli cetvel — prototip: 7 tick, odd kısa / even uzun, sade beyaz */}
            <div className="pointer-events-none absolute right-2.5 top-12 bottom-12 z-20 flex w-2.5 flex-col items-end justify-between">
              {Array.from({ length: 7 }).map((_, i) => (
                <span
                  key={i}
                  className={`block h-px bg-white/15 ${i % 2 === 0 ? "w-2.5" : "w-1.5"}`}
                />
              ))}
            </div>

            <div
              className={`relative ${isSnapping ? "transition-transform duration-300 ease-out" : ""}`}
              style={{ transform: `translateY(${centerOffset - scrollPos}px)` }}
              onTransitionEnd={() => setIsSnapping(false)}
            >
              {thicknessOptions.map((thickness, index) => {
                const distance = Math.abs(index - previewIndex);
                const isActive = index === previewIndex;
                const isNear = distance === 1;

                return (
                  <button
                    key={thickness}
                    type="button"
                    onClick={() => {
                      if (dragDistanceRef.current > 6) return;
                      commitIndex(index, 10);
                    }}
                    className={`flex h-[48px] w-full flex-col items-center justify-center gap-0 px-3 text-center transition-all ${
                      isActive
                        ? "text-brand-200"
                        : isNear
                          ? "text-fe-text/55"
                          : "text-fe-muted/35"
                    }`}
                  >
                    <span
                      className={`font-extrabold leading-none tracking-tight ${
                        isActive
                          ? String(thickness).length >= 2 ? "text-[24px]" : "text-[28px]"
                          : isNear
                            ? String(thickness).length >= 2 ? "text-[15px]" : "text-[18px]"
                            : "text-[12px]"
                      }`}
                    >
                      {thickness}
                    </span>
                    <span
                      className={`mt-1 uppercase tracking-[0.18em] leading-none ${
                        isActive
                          ? "text-[9px] text-brand-200/85"
                          : isNear
                            ? "text-[8px] text-fe-muted/55"
                            : "text-[7px] text-fe-muted/35"
                      }`}
                    >
                      cm
                    </span>
                    {isActive && popularThickness === thickness && (
                      <span className="mt-0.5 whitespace-nowrap text-[7px] font-semibold uppercase leading-none tracking-[0.1em] text-brand-300/95">
                        En çok tercih
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => stepSelection(1)}
            className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-fe-text/80 transition-colors hover:text-brand-300 active:scale-95"
            aria-label="Kalınlığı artır"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[372px] rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(8,12,20,0.95))] p-3 shadow-[0_20px_45px_-30px_rgba(0,0,0,0.7)]">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-400/70">
            Kalınlık ayarı
          </div>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-[34px] font-semibold leading-none text-white">
              {selectedThickness}
            </span>
            <span className="pb-1 text-sm uppercase tracking-[0.22em] text-fe-muted/80">
              cm
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full border border-brand-400/30 bg-brand-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-brand-200">
            Aktif
          </span>
          {popularThickness === selectedThickness && (
            <span className="text-[10px] text-brand-300/75">
              En çok tercih
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-[320px] items-center gap-2.5">
        <button
          type="button"
          onClick={() => stepSelection(-1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-fe-text transition-colors active:scale-[0.98]"
          aria-label="Kalınlığı azalt"
        >
          <ChevronUp className="h-4 w-4" />
        </button>

        <div
          className="relative h-44 w-[230px] shrink-0 overflow-hidden rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(5,8,15,0.94),rgba(10,14,24,0.98))] sm:w-[244px]"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-[#05080f] via-[#05080f]/88 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-[#05080f] via-[#05080f]/88 to-transparent" />

          <div className="pointer-events-none absolute inset-x-2 top-1/2 z-20 h-[52px] -translate-y-1/2 rounded-[18px] border border-brand-400/30 bg-brand-400/[0.09] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),0_0_20px_rgba(217,119,6,0.12)]" />
          <div className="pointer-events-none absolute left-3 right-3 top-1/2 z-20 h-px -translate-y-[26px] bg-gradient-to-r from-transparent via-brand-400/35 to-transparent" />
          <div className="pointer-events-none absolute left-3 right-3 top-1/2 z-20 h-px translate-y-[26px] bg-gradient-to-r from-transparent via-brand-400/35 to-transparent" />

          <div
            className={`relative ${isSnapping ? "transition-transform duration-300 ease-out" : ""}`}
            style={{ transform: `translateY(${centerOffset - scrollPos}px)` }}
            onTransitionEnd={() => setIsSnapping(false)}
          >
            {thicknessOptions.map((thickness, index) => {
              const distance = Math.abs(index - previewIndex);
              const isActive = index === previewIndex;
              const isNear = distance === 1;
              const isPopular = popularThickness === thickness;

              return (
                <button
                  key={thickness}
                  type="button"
                  onClick={() => {
                    if (dragDistanceRef.current > 6) return;
                    commitIndex(index, 10);
                  }}
                  className={`flex h-[52px] w-full items-center justify-between px-4 text-left transition-all ${
                    isActive
                      ? "scale-[1.02] text-white"
                      : isNear
                        ? "text-fe-text/82"
                        : "text-fe-muted/70"
                  }`}
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[28px] font-semibold tracking-tight">
                      {thickness}
                    </span>
                    <span className="text-xs uppercase tracking-[0.2em] text-fe-muted/75">
                      cm
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isPopular && (
                      <span
                        className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.18em] ${
                          isActive
                            ? "border-brand-400/40 bg-brand-400/12 text-brand-200"
                            : "border-white/10 bg-white/5 text-fe-muted"
                        }`}
                      >
                        Popüler
                      </span>
                    )}
                    <span
                      className={`h-2.5 w-2.5 rounded-full transition-all ${
                        isActive ? "bg-brand-300 shadow-[0_0_14px_rgba(253,224,71,0.7)]" : "bg-white/15"
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => stepSelection(1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-fe-text transition-colors active:scale-[0.98]"
          aria-label="Kalınlığı artır"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-4 text-fe-muted/80">
        Kaydırın ya da oklarla değiştirin.
      </p>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
