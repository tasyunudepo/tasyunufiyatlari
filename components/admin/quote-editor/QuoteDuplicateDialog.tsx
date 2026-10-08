"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Search, X } from "lucide-react";

import { formatCurrency } from "@/lib/admin/utils";
import { useAdminQuotes } from "@/lib/hooks/useAdminQuotes";
import {
  createEmptyLine,
  type EditorLine,
} from "@/components/admin/quote-editor/useQuoteEditor";
import type { TechnicalConsumptionUnit } from "@/lib/types";

// Teklif çoğaltma.
//
// NEDEN: 27 Temmuz 2026'daki gerçek iş "sıfırdan teklif yaz" değildi;
// "var olan teklifi al, metrajı 7.002'den 6.652,8'e çevir, miktarları
// yeniden hesapla"ydı ve elle betikle yapıldı. Çoğaltma bu işin ekrandaki
// karşılığıdır: sepet gelir, metraj değişince miktarlar kendiliğinden
// yeniden hesaplanır (useQuoteEditor.rescaleQuantities).
//
// Müşteri ve şehir bilgisi DE taşınır (8 Ekim 2026 kullanıcı kararı). İlk
// hâli yalnız sepeti getiriyordu; aynı müşteriye ikinci marka için teklif
// yazarken ad, telefon ve şehir tek tek yeniden giriliyordu.

export type QuoteShippingMode =
  | "included_in_sale_price"
  | "buyer_pays"
  | "separate_quote_required";

export type QuoteConsentChannel = "telefon" | "yuz_yuze" | "eposta" | "whatsapp";

export interface DuplicateSource {
  /** Kaynak teklifin kimliği — revizede hangi kaydın güncelleneceği. */
  quoteId: number | null;
  quoteCode: string | null;
  /** `manual_quote` = ofis teklifi; yalnız o revize edilebilir. */
  requestType: string | null;
  lines: EditorLine[];
  areaM2: number;
  title: string | null;
  notes: string | null;
  discountPct: number;
  shippingCharge: number;
  /** Kayıtta yoksa null — ekrandaki seçim korunur, uydurulmaz. */
  shippingMode: QuoteShippingMode | null;
  validityDays: number | null;
  materialType: "tasyunu" | "eps" | "karma";
  customerName: string;
  customerPhone: string;
  customerCompany: string;
  customerEmail: string;
  cityCode: string;
  consentChannel: QuoteConsentChannel | null;
}

interface KayitliKalem {
  name?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  listUnitPrice?: number;
  lineDiscountPct?: number;
  isPlate?: boolean;
  thicknessCm?: number | null;
  packageCount?: number | null;
  catalogKey?: string | null;
  kind?: string;
  netCost?: number | null;
  consumptionRate?: number | null;
  consumptionUnit?: TechnicalConsumptionUnit | null;
  unitContent?: number | null;
}

const KINDS = ["levha", "aksesuar", "hizmet", "serbest"] as const;
type Kind = (typeof KINDS)[number];

function toKind(raw: unknown): Kind {
  return KINDS.includes(raw as Kind) ? (raw as Kind) : "serbest";
}

/**
 * Levha kalınlığı. Eski kayıtlarda satırda saklanmıyordu; katalog anahtarı
 * (`levha-42-4`) ya da teklifin kendi kalınlık kolonu aynı bilgiyi taşır.
 * Kalınlık kaybolursa toz grubunda dübel boyu yanlış seçilir.
 */
function levhaKalinligi(k: KayitliKalem, teklifKalinligi: number | null): number | null {
  if (k.isPlate !== true) return null;
  if (k.thicknessCm != null && Number(k.thicknessCm) > 0) return Number(k.thicknessCm);
  const anahtardan = /^levha-\d+-(\d+(?:\.\d+)?)$/.exec(String(k.catalogKey ?? ""))?.[1];
  if (anahtardan) return Number(anahtardan);
  return teklifKalinligi != null && teklifKalinligi > 0 ? teklifKalinligi : null;
}

/** Kayıtlı `package_items` satırını editör satırına çevirir. */
function kalemdenSatir(k: KayitliKalem, teklifKalinligi: number | null = null): EditorLine | null {
  const ad = String(k.name ?? "").trim();
  const miktar = Number(k.quantity ?? 0);
  if (!ad || !(miktar > 0)) return null;

  return {
    ...createEmptyLine(),
    kind: toKind(k.kind),
    catalogKey: k.catalogKey ?? null,
    description: ad,
    quantity: miktar,
    unit: String(k.unit ?? "adet"),
    // Kayıtta `unitPrice` iskonto İŞLENMİŞ fiyattır; liste fiyatı ayrı
    // saklanır. Çoğaltmada liste fiyatı esas alınır ki toplu iskonto
    // ikinci kez uygulanıp fiyatı iki kere kırmasın.
    unitPrice: Number(k.listUnitPrice ?? k.unitPrice ?? 0),
    lineDiscountPct: Number(k.lineDiscountPct ?? 0),
    isPlate: k.isPlate === true,
    thicknessCm: levhaKalinligi(k, teklifKalinligi),
    packageCount: k.packageCount ?? null,
    suggestedUnitPrice: Number(k.listUnitPrice ?? k.unitPrice ?? 0) || null,
    netCost: k.netCost != null && k.netCost > 0 ? Number(k.netCost) : null,
    consumptionRate: k.consumptionRate != null ? Number(k.consumptionRate) : null,
    consumptionUnit: k.consumptionUnit ?? null,
    unitContent: k.unitContent != null ? Number(k.unitContent) : null,
  };
}

const SHIPPING_MODES: QuoteShippingMode[] = [
  "included_in_sale_price",
  "buyer_pays",
  "separate_quote_required",
];
const CONSENT_CHANNELS: QuoteConsentChannel[] = ["telefon", "yuz_yuze", "eposta", "whatsapp"];

const duzMetin = (v: unknown): string => (v == null ? "" : String(v).trim());

/**
 * Başlıksız ofis teklifinin `package_name` kolonuna "Ofis teklifi" yazılır.
 * Bu yer tutucu başlık diye geri yüklenirse PDF'te "Seçilen Sistem" satırı
 * levha adı yerine "Ofis teklifi" çıkar (TE-2026-000241'de böyle oldu).
 */
function teklifBasligi(ham: string | null | undefined): string | null {
  const baslik = duzMetin(ham);
  return baslik && baslik.toLocaleLowerCase("tr-TR") !== "ofis teklifi" ? baslik : null;
}

/**
 * Kayıtlı teklifi editörün yükleyebileceği kaynağa çevirir — çoğaltma ve
 * revize aynı kaynağı kullanır. Kalemi olmayan teklif için null döner.
 */
export function quoteToDuplicateSource(teklif: Record<string, unknown>): DuplicateSource | null {
  const pi = teklif.package_items as
    | {
        items?: KayitliKalem[];
        manual?: {
          discountPct?: number;
          shippingCharge?: number;
          shippingMode?: string | null;
          validityDays?: number | null;
          title?: string | null;
          notes?: string | null;
        };
      }
    | null;
  const teklifKalinligi = Number(teklif.thickness_cm ?? 0) || null;
  const satirlar = (pi?.items ?? [])
    .map((k) => kalemdenSatir(k, teklifKalinligi))
    .filter((s): s is EditorLine => s != null);
  if (satirlar.length === 0) return null;

  const malzeme = String(teklif.material_type ?? "karma");
  const id = Number(teklif.id);
  const nakliyeModu = pi?.manual?.shippingMode as QuoteShippingMode | undefined;
  const kanal = teklif.consent_channel as QuoteConsentChannel | undefined;
  const gecerlilik = Number(pi?.manual?.validityDays ?? 0);

  return {
    quoteId: Number.isSafeInteger(id) && id > 0 ? id : null,
    quoteCode: duzMetin(teklif.quote_code) || null,
    requestType: duzMetin(teklif.request_type) || null,
    lines: satirlar,
    areaM2: Number(teklif.area_m2 ?? 0),
    title: teklifBasligi(pi?.manual?.title ?? (teklif.package_name as string | null)),
    notes: pi?.manual?.notes ?? null,
    discountPct: Number(pi?.manual?.discountPct ?? teklif.discount_percentage ?? 0),
    shippingCharge: Number(pi?.manual?.shippingCharge ?? 0),
    shippingMode: nakliyeModu && SHIPPING_MODES.includes(nakliyeModu) ? nakliyeModu : null,
    validityDays: gecerlilik >= 1 && gecerlilik <= 90 ? Math.round(gecerlilik) : null,
    materialType: malzeme === "tasyunu" || malzeme === "eps" ? malzeme : "karma",
    customerName: duzMetin(teklif.customer_name),
    customerPhone: duzMetin(teklif.customer_phone),
    customerCompany: duzMetin(teklif.customer_company),
    customerEmail: duzMetin(teklif.customer_email),
    cityCode: duzMetin(teklif.city_code),
    consentChannel: kanal && CONSENT_CHANNELS.includes(kanal) ? kanal : null,
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (kaynak: DuplicateSource) => void;
}

export function QuoteDuplicateDialog({ open, onClose, onPick }: Props) {
  const { quotes, isLoading } = useAdminQuotes();
  const [arama, setArama] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Yalnız kalemi olan teklifler çoğaltılabilir; kalemsiz kayıt boş sepet açar.
  const adaylar = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    return quotes
      .filter((t) => {
        const pi = t.package_items as { items?: unknown[] } | null;
        return Array.isArray(pi?.items) && pi.items.length > 0;
      })
      .filter((t) => {
        if (!q) return true;
        const metin = [t.quote_code, t.customer_name, t.package_name, t.city_name]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("tr-TR");
        return metin.includes(q);
      })
      .slice(0, 40);
  }, [quotes, arama]);

  if (!open || typeof document === "undefined") return null;

  function sec(teklif: Record<string, unknown>) {
    const kaynak = quoteToDuplicateSource(teklif);
    if (kaynak) onPick(kaynak);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Çoğaltılacak teklifi seç"
        data-testid="quote-duplicate-dialog"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-[rgba(92,98,108,0.3)] bg-[#12141a] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(92,98,108,0.24)] px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-white">Teklifi çoğalt</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Müşteri, şehir ve kalemler gelir; metrajı değiştirdiğinizde
              sarfiyata bağlı miktarlar kendiliğinden yeniden hesaplanır.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-[rgba(92,98,108,0.18)] px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--nx-text-muted)]" />
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              aria-label="Teklif ara"
              autoFocus
              className="w-full rounded-xl border border-[rgba(92,98,108,0.28)] bg-[rgba(18,20,24,0.8)] py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-[rgba(201,168,76,0.5)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isLoading && <p className="p-6 text-center text-sm text-slate-400">Teklifler yükleniyor…</p>}

          {!isLoading && adaylar.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-400">
              {arama ? "Aramaya uyan teklif yok." : "Çoğaltılabilir teklif bulunamadı."}
            </p>
          )}

          <ul className="space-y-1.5">
            {adaylar.map((t) => {
              const pi = t.package_items as { items?: unknown[] } | null;
              const kalemSayisi = pi?.items?.length ?? 0;
              return (
                <li key={String(t.id)}>
                  <button
                    type="button"
                    onClick={() => sec(t)}
                    data-testid={`duplicate-quote-${t.id}`}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-[rgba(92,98,108,0.22)] px-3 py-2.5 text-left transition-colors hover:border-[rgba(201,168,76,0.45)] hover:bg-[rgba(201,168,76,0.06)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {String(t.package_name ?? "Teklif")}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--nx-text-muted)]">
                        <span className="font-mono">{String(t.quote_code ?? "—")}</span>
                        {" · "}{String(t.customer_name ?? "—")}
                        {" · "}{Number(t.area_m2 ?? 0).toLocaleString("tr-TR")} m²
                        {" · "}{kalemSayisi} kalem
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums text-sm font-semibold text-[var(--nx-gold)]">
                        {formatCurrency(Number(t.total_price ?? 0))}
                      </span>
                      <Copy className="h-3.5 w-3.5 text-[var(--nx-text-muted)]" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}
