"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";

import { lineTotal } from "@/lib/schemas/manualQuote.schema";
import { formatCurrency } from "@/lib/admin/utils";
import { searchCatalogItems } from "@/lib/quote/searchCatalog";
import type { CatalogItem } from "@/app/api/admin/catalog-items/route";

import { parsePastedRows, parseTrNumber, type EditorLine } from "./useQuoteEditor";

// Excel benzeri satır tablosu.
//   · Yazdıkça → katalogdan anlık öneri (↑↓ gez, Enter seç, Esc kapat)
//   · Enter    → öneri kapalıysa yeni satır
//   · Yapıştır → Excel'den kopyalanan blok satırlara açılır
//   · Birim fiyat katalogdan gelir; operatör üstüne yazarsa fark rozetle görünür

const cell =
  "w-full bg-transparent px-2 py-1.5 text-sm text-white outline-none rounded " +
  "focus:bg-[rgba(255,255,255,0.06)] focus:ring-1 focus:ring-[rgba(201,168,76,0.4)]";

interface Props {
  lines: EditorLine[];
  readOnly?: boolean;
  /** Satır içi arama kaynağı — boşsa öneri açılmaz, davranış eskisi gibi kalır. */
  catalogItems?: CatalogItem[];
  onUpdate: (rowId: string, patch: Partial<EditorLine>) => void;
  onRemove: (rowId: string) => void;
  onDuplicate: (rowId: string) => void;
  onMove: (rowId: string, yon: -1 | 1) => void;
  onAdd: () => void;
  onAddMany: (lines: EditorLine[]) => void;
  onPickProduct: (rowId: string) => void;
  /** Öneriden seçildiğinde — satırı katalog kalemiyle doldurur. */
  onPickCatalogItem?: (rowId: string, item: CatalogItem) => void;
}

export function QuoteLineTable({
  lines,
  readOnly = false,
  catalogItems = [],
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
  onAdd,
  onAddMany,
  onPickProduct,
  onPickCatalogItem,
}: Props) {
  // Öneri listesi tek seferde tek satırda açılır; hangi satır ve hangi
  // sıradaki önerinin seçili olduğu burada tutulur.
  const [aramaRowId, setAramaRowId] = useState<string | null>(null);
  const [vurgulu, setVurgulu] = useState(0);

  const aramaSatiri = lines.find((l) => l.rowId === aramaRowId) ?? null;
  const oneriler = useMemo(() => {
    if (!aramaSatiri || !onPickCatalogItem || catalogItems.length === 0) return [];
    return searchCatalogItems(catalogItems, aramaSatiri.description);
  }, [aramaSatiri, catalogItems, onPickCatalogItem]);

  function oneriKapat() {
    setAramaRowId(null);
    setVurgulu(0);
  }

  function oneriSec(rowId: string, item: CatalogItem) {
    onPickCatalogItem?.(rowId, item);
    oneriKapat();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text/plain");
    // Tek hücrelik yapıştırma normal davransın; yalnız çok sütun/satırlı
    // blokları tabloya aç.
    if (!text.includes("\t") && !text.includes("\n")) return;
    const yeni = parsePastedRows(text);
    if (yeni.length === 0) return;
    e.preventDefault();
    onAddMany(yeni);
  }

  return (
    <div className="rounded-xl border border-[rgba(92,98,108,0.24)] bg-[rgba(13,15,18,0.6)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-[rgba(92,98,108,0.24)] bg-[rgba(255,255,255,0.02)]">
              <th className="w-10 px-2 py-2.5 text-left text-[10px] uppercase tracking-wider text-[var(--nx-text-muted)]">#</th>
              <th className="px-2 py-2.5 text-left text-[10px] uppercase tracking-wider text-[var(--nx-text-muted)]">Ürün / Hizmet</th>
              <th className="w-24 px-2 py-2.5 text-right text-[10px] uppercase tracking-wider text-[var(--nx-text-muted)]">Miktar</th>
              <th className="w-20 px-2 py-2.5 text-left text-[10px] uppercase tracking-wider text-[var(--nx-text-muted)]">Birim</th>
              <th className="w-32 px-2 py-2.5 text-right text-[10px] uppercase tracking-wider text-[var(--nx-text-muted)]">Birim Fiyat</th>
              <th className="w-20 px-2 py-2.5 text-right text-[10px] uppercase tracking-wider text-[var(--nx-text-muted)]" title="Satır bazlı iskonto">İsk. %</th>
              <th className="w-32 px-2 py-2.5 text-right text-[10px] uppercase tracking-wider text-[var(--nx-text-muted)]">Tutar</th>
              {!readOnly && <th className="w-28 px-2 py-2.5" />}
            </tr>
          </thead>
          <tbody onPaste={readOnly ? undefined : handlePaste}>
            {lines.map((line, index) => {
              const tutar = lineTotal(line);
              const ezildi =
                line.suggestedUnitPrice != null &&
                Math.abs(line.suggestedUnitPrice - line.unitPrice) > 0.005;

              return (
                <tr
                  key={line.rowId}
                  className="border-b border-[rgba(92,98,108,0.12)] hover:bg-[rgba(255,255,255,0.02)]"
                >
                  <td className="px-2 py-1 text-center text-xs text-[var(--nx-text-muted)]">{index + 1}</td>

                  <td className="relative px-1 py-1">
                    <div className="flex items-center gap-1">
                      <input
                        value={line.description}
                        readOnly={readOnly}
                        onChange={(e) => {
                          onUpdate(line.rowId, { description: e.target.value });
                          setAramaRowId(line.rowId);
                          setVurgulu(0);
                        }}
                        onBlur={() => {
                          // Öneriye tıklamak da blur tetikler; seçimin kaydolması
                          // için kapatma bir tık geciktirilir.
                          window.setTimeout(() => {
                            setAramaRowId((mevcut) => (mevcut === line.rowId ? null : mevcut));
                          }, 150);
                        }}
                        onKeyDown={(e) => {
                          const acik = aramaRowId === line.rowId && oneriler.length > 0;
                          if (acik && e.key === "ArrowDown") {
                            e.preventDefault();
                            setVurgulu((v) => (v + 1) % oneriler.length);
                            return;
                          }
                          if (acik && e.key === "ArrowUp") {
                            e.preventDefault();
                            setVurgulu((v) => (v - 1 + oneriler.length) % oneriler.length);
                            return;
                          }
                          if (acik && e.key === "Escape") {
                            e.preventDefault();
                            oneriKapat();
                            return;
                          }
                          if (e.key === "Enter") {
                            e.preventDefault();
                            // Öneri açıkken Enter SEÇER; kapalıyken yeni satır açar.
                            if (acik) oneriSec(line.rowId, oneriler[vurgulu]);
                            else onAdd();
                          }
                        }}
                        placeholder="Ürün adı yazın veya katalogdan seçin…"
                        aria-label={`Satır ${index + 1} ürün adı`}
                        role={onPickCatalogItem ? "combobox" : undefined}
                        aria-expanded={onPickCatalogItem ? aramaRowId === line.rowId && oneriler.length > 0 : undefined}
                        aria-autocomplete={onPickCatalogItem ? "list" : undefined}
                        className={cell}
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => onPickProduct(line.rowId)}
                          title="Katalogdan seç"
                          className="shrink-0 rounded-md border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.1)] px-2 py-1 text-[10px] font-medium text-[var(--nx-gold)] hover:bg-[rgba(201,168,76,0.18)]"
                        >
                          Katalog
                        </button>
                      )}
                    </div>
                    {line.note && <p className="px-2 text-[10px] text-[var(--nx-text-muted)]">{line.note}</p>}

                    {/* Yazdıkça öneri — katalog istemcide olduğu için her
                        tuşta sunucuya gidilmez (27 Tem 2026 isteği). */}
                    {aramaRowId === line.rowId && oneriler.length > 0 && (
                      <ul
                        role="listbox"
                        aria-label="Ürün önerileri"
                        data-testid="urun-onerileri"
                        className="absolute left-1 right-1 top-full z-30 mt-0.5 max-h-64 overflow-y-auto rounded-xl border border-[rgba(201,168,76,0.3)] bg-[#12141a] py-1 shadow-2xl"
                      >
                        {oneriler.map((item, i) => (
                          <li key={item.key}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={i === vurgulu}
                              onMouseEnter={() => setVurgulu(i)}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => oneriSec(line.rowId, item)}
                              className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors ${
                                i === vurgulu ? "bg-[rgba(201,168,76,0.15)]" : "hover:bg-white/5"
                              }`}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-xs text-white" title={item.kind === "aksesuar" ? item.fullName : item.label}>
                                  {item.kind === "aksesuar" ? item.fullName : item.label}
                                </span>
                                <span className="block text-[10px] text-[var(--nx-text-muted)]">
                                  {item.brandName} · {item.unit}
                                  {item.kind === "aksesuar" && item.unitContent && item.unitContent > 1
                                    ? ` · paket içeriği ${item.unitContent}`
                                    : ""}
                                </span>
                              </span>
                              <span className="shrink-0 tabular-nums text-xs font-semibold text-[var(--nx-gold)]">
                                {formatCurrency(item.suggestedUnitPrice)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>

                  <td className="px-1 py-1">
                    <input
                      value={line.quantity === 0 ? "" : String(line.quantity)}
                      readOnly={readOnly}
                      inputMode="decimal"
                      onChange={(e) =>
                        onUpdate(line.rowId, { quantity: parseTrNumber(e.target.value) ?? 0 })
                      }
                      aria-label={`Satır ${index + 1} miktar`}
                      className={`${cell} text-right tabular-nums`}
                    />
                  </td>

                  <td className="px-1 py-1">
                    <input
                      value={line.unit}
                      readOnly={readOnly}
                      onChange={(e) => onUpdate(line.rowId, { unit: e.target.value })}
                      aria-label={`Satır ${index + 1} birim`}
                      className={cell}
                    />
                  </td>

                  <td className="px-1 py-1">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        value={line.unitPrice === 0 ? "" : String(line.unitPrice)}
                        readOnly={readOnly}
                        inputMode="decimal"
                        onChange={(e) =>
                          onUpdate(line.rowId, { unitPrice: parseTrNumber(e.target.value) ?? 0 })
                        }
                        aria-label={`Satır ${index + 1} birim fiyat`}
                        className={`${cell} text-right tabular-nums`}
                      />
                      {ezildi && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdate(line.rowId, { unitPrice: line.suggestedUnitPrice! })
                          }
                          title={`Sistem önerisi: ${formatCurrency(line.suggestedUnitPrice!)} — tıkla, geri al`}
                          className="shrink-0 rounded px-1 text-[10px] font-semibold text-amber-300 hover:bg-amber-400/15"
                        >
                          ●
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="px-1 py-1">
                    <input
                      value={line.lineDiscountPct === 0 ? "" : String(line.lineDiscountPct)}
                      readOnly={readOnly}
                      inputMode="decimal"
                      placeholder="0"
                      onChange={(e) =>
                        onUpdate(line.rowId, {
                          lineDiscountPct: Math.min(100, Math.max(0, parseTrNumber(e.target.value) ?? 0)),
                        })
                      }
                      aria-label={`Satır ${index + 1} iskonto yüzdesi`}
                      className={`${cell} text-right tabular-nums`}
                    />
                  </td>

                  <td className="px-2 py-1 text-right text-sm font-medium tabular-nums text-white">
                    {tutar > 0 ? formatCurrency(tutar) : "—"}
                  </td>

                  {!readOnly && (
                    <td className="px-1 py-1">
                      <div className="flex items-center justify-end gap-0.5">
                        <button type="button" onClick={() => onMove(line.rowId, -1)} aria-label="Yukarı taşı" title="Yukarı taşı"
                          className="rounded p-1 text-[var(--nx-text-muted)] hover:bg-white/5 hover:text-white">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => onMove(line.rowId, 1)} aria-label="Aşağı taşı" title="Aşağı taşı"
                          className="rounded p-1 text-[var(--nx-text-muted)] hover:bg-white/5 hover:text-white">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => onDuplicate(line.rowId)} aria-label="Satırı kopyala" title="Satırı kopyala"
                          className="rounded p-1 text-[var(--nx-text-muted)] hover:bg-white/5 hover:text-white">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => onRemove(line.rowId)} aria-label="Satırı sil" title="Satırı sil"
                          className="rounded p-1 text-red-400/70 hover:bg-red-500/15 hover:text-red-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="flex items-center justify-between gap-3 border-t border-[rgba(92,98,108,0.18)] px-3 py-2">
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(92,98,108,0.3)] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Satır ekle
          </button>
          <p className="text-[11px] text-[var(--nx-text-muted)]">
            <kbd className="rounded bg-white/10 px-1">Enter</kbd> yeni satır ·
            Excel&apos;den kopyalayıp tabloya yapıştırabilirsiniz
          </p>
        </div>
      )}
    </div>
  );
}
