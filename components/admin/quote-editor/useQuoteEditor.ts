"use client";

import { useCallback, useMemo, useState } from "react";

import { buildQuoteTotals, roundToKurus } from "@/lib/pricing/quoteTotals";
import { effectiveLineTotal, lineTotal, type ManualQuoteLine } from "@/lib/schemas/manualQuote.schema";
import {
  computeQuoteIndicators,
  impliedMarginPct,
  unitPriceAtMargin,
} from "@/lib/quote/quoteIndicators";
import type { CatalogItem } from "@/app/api/admin/catalog-items/route";
import type { AccessorySetItem } from "@/lib/quote/buildAccessorySet";

// Teklif editörünün durumu ve canlı hesabı.
//
// KDV tek kaynaktan gelir: lib/pricing/quoteTotals.ts (%20). Ekranda gösterilen
// toplam ile sunucunun kaydettiği toplam aynı fonksiyondan çıkar; sunucu yine
// de yeniden hesaplayıp 2 kuruştan fazla sapmada reddeder.

export interface EditorLine extends ManualQuoteLine {
  /** Satır kimliği — React anahtarı ve satır işlemleri için. */
  rowId: string;
  /** Katalogdan gelen öneri; operatör üstüne yazarsa fark görünür. */
  suggestedUnitPrice: number | null;

  // ── Maliyet dayanağı ──
  // Marj kadranı ve kâr göstergesi bunlara dayanır. Serbest yazılan satırda
  // hepsi null'dır; o satır marj kadranından ETKİLENMEZ ve kâr hesabında
  // "maliyeti bilinmeyen" sayılır (uydurma maliyet üretilmez).
  /** İskontolar uygulanmış birim alış, KDV hariç. */
  netCost: number | null;
  /** m² başına sarfiyat — yalnız toz setinden gelen kalemlerde. */
  consumptionRate: number | null;
  /** Paket içeriği — paket artığı göstergesi için. */
  unitContent: number | null;
}

let rowCounter = 0;
function nextRowId(): string {
  rowCounter += 1;
  return `r${rowCounter}`;
}

export function createEmptyLine(): EditorLine {
  return {
    rowId: nextRowId(),
    kind: "serbest",
    catalogKey: null,
    description: "",
    quantity: 0,
    unit: "adet",
    unitPrice: 0,
    lineDiscountPct: 0,
    isPlate: false,
    thicknessCm: null,
    packageCount: null,
    note: null,
    suggestedUnitPrice: null,
    netCost: null,
    consumptionRate: null,
    unitContent: null,
  };
}

export function lineFromCatalog(item: CatalogItem, quantity: number): EditorLine {
  return {
    ...createEmptyLine(),
    kind: item.kind === "levha" ? "levha" : "aksesuar",
    catalogKey: item.key,
    description: item.label,
    quantity,
    unit: item.unit,
    unitPrice: item.suggestedUnitPrice,
    isPlate: item.kind === "levha",
    thicknessCm: item.thicknessCm,
    suggestedUnitPrice: item.suggestedUnitPrice,
    netCost: item.netCost > 0 ? item.netCost : null,
    unitContent: item.unitContent,
  };
}

/** Toz grubu setinin bir kalemini editör satırına çevirir. */
export function lineFromAccessorySet(item: AccessorySetItem): EditorLine {
  return {
    ...createEmptyLine(),
    kind: "aksesuar",
    catalogKey: `acc-${item.accessoryId}`,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    suggestedUnitPrice: item.unitPrice,
    netCost: item.netCost > 0 ? item.netCost : null,
    consumptionRate: item.consumptionRate,
    unitContent: item.unitContent,
  };
}

export function useQuoteEditor(areaM2 = 0) {
  const [lines, setLines] = useState<EditorLine[]>([createEmptyLine()]);
  const [discountPct, setDiscountPct] = useState(0);
  const [shippingCharge, setShippingCharge] = useState(0);

  const addLine = useCallback((line?: EditorLine) => {
    setLines((prev) => [...prev, line ?? createEmptyLine()]);
  }, []);

  const addLines = useCallback((yeni: EditorLine[]) => {
    setLines((prev) => [...prev, ...yeni]);
  }, []);

  const updateLine = useCallback((rowId: string, patch: Partial<EditorLine>) => {
    setLines((prev) => prev.map((l) => (l.rowId === rowId ? { ...l, ...patch } : l)));
  }, []);

  const removeLine = useCallback((rowId: string) => {
    setLines((prev) => {
      const next = prev.filter((l) => l.rowId !== rowId);
      return next.length > 0 ? next : [createEmptyLine()];
    });
  }, []);

  const duplicateLine = useCallback((rowId: string) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.rowId === rowId);
      if (i < 0) return prev;
      const kopya = { ...prev[i], rowId: nextRowId() };
      return [...prev.slice(0, i + 1), kopya, ...prev.slice(i + 1)];
    });
  }, []);

  const moveLine = useCallback((rowId: string, yon: -1 | 1) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.rowId === rowId);
      const j = i + yon;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const resetLines = useCallback(() => {
    setLines([createEmptyLine()]);
    setDiscountPct(0);
    setShippingCharge(0);
  }, []);

  /**
   * Marj kadranı: hedef marja göre TÜM maliyeti bilinen satırların birim
   * fiyatını yeniden üretir.
   *
   * NEDEN BU VAR: operatör marjla düşünüyor, ekran iskonto soruyordu.
   * "%2 iskonto" ile "marjı %5'ten %3'e indirmek" aynı şey değil (%5→%3
   * fiyatta %1,90 eder) ve bu karışıklık 27 Temmuz'da gerçek bir teklifte
   * yanlış fiyat üretti. Artık asıl kadran marj.
   *
   * Maliyeti bilinmeyen satır DEĞİŞMEZ — orada uydurma bir maliyetten
   * fiyat türetmek sessizce yanlış rakam üretmek olurdu.
   */
  const applyMarginToLines = useCallback((marginPct: number) => {
    setLines((prev) =>
      prev.map((l) => {
        const yeni = unitPriceAtMargin(
          { quantity: l.quantity, unitPrice: l.unitPrice, netCost: l.netCost ?? undefined },
          marginPct,
        );
        return yeni == null ? l : { ...l, unitPrice: yeni };
      }),
    );
  }, []);

  /**
   * Metraj değişince sarfiyata bağlı miktarları yeniden hesaplar.
   *
   * NEDEN BU VAR: 27 Temmuz'daki asıl iş "sıfırdan teklif yaz" değil,
   * "var olan teklifi al, metrajı değiştir"di (7002 m² → 6652,8 m²) ve
   * miktarlar elle betikle yeniden hesaplandı.
   *
   * Yalnız sarfiyatı bilinen kalemler ve m² birimli satırlar güncellenir;
   * serbest satırlara dokunulmaz.
   */
  const rescaleQuantities = useCallback((yeniAlanM2: number) => {
    if (!(yeniAlanM2 > 0)) return;
    setLines((prev) =>
      prev.map((l) => {
        const sarfiyat = l.consumptionRate ?? 0;
        const icerik = l.unitContent ?? 0;
        if (sarfiyat > 0 && icerik > 0) {
          return { ...l, quantity: Math.ceil((yeniAlanM2 * sarfiyat) / icerik) };
        }
        if (l.unit.toLocaleLowerCase("tr-TR").includes("m²")) {
          return { ...l, quantity: yeniAlanM2 };
        }
        return l;
      }),
    );
  }, []);

  /** Dolu satırlar — boş satırlar kayda gitmez. */
  const filledLines = useMemo(
    () => lines.filter((l) => l.description.trim().length > 0 && l.quantity > 0),
    [lines],
  );

  /** İskontosuz liste toplamı — yalnız "ne kadar indirildi"yi göstermek için. */
  const listeToplami = useMemo(
    () => roundToKurus(filledLines.reduce((sum, l) => sum + lineTotal(l), 0)),
    [filledLines],
  );

  /**
   * Toplamlar. İskonto BİRİM FİYATLARA işlenir, ayrı bir eksi satır
   * oluşturulmaz (27 Tem 2026 kararı) — belgedeki aritmetik böylece
   * satır satır tutar.
   */
  const totalsFor = useCallback(
    (pct: number) => {
      const linesNet = roundToKurus(
        filledLines.reduce((sum, l) => sum + effectiveLineTotal(l, pct), 0),
      );
      const discountAmount = roundToKurus(listeToplami - linesNet);
      const { priceWithoutVat, vatAmount, totalPrice } = buildQuoteTotals(
        linesNet,
        shippingCharge,
      );
      return { linesNet, listeToplami, discountAmount, priceWithoutVat, vatAmount, totalPrice };
    },
    [filledLines, listeToplami, shippingCharge],
  );

  const totals = useMemo(() => totalsFor(discountPct), [totalsFor, discountPct]);

  /**
   * Canlı göstergeler — kâr, gerçekleşen marj, site fiyatına göre fark ve
   * paket artığı. Hiçbiri müşteriye giden yüzeye YAZILMAZ.
   */
  const indicators = useMemo(
    () =>
      computeQuoteIndicators({
        lines: filledLines.map((l) => ({
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineDiscountPct: l.lineDiscountPct,
          netCost: l.netCost ?? undefined,
          listUnitPrice: l.suggestedUnitPrice ?? undefined,
          consumptionRate: l.consumptionRate,
          unitContent: l.unitContent,
        })),
        discountPct,
        shippingCharge,
        areaM2,
      }),
    [filledLines, discountPct, shippingCharge, areaM2],
  );

  /**
   * Kadranın göstereceği marj. Tüm maliyetli satırlar aynı marjdaysa o
   * değer, farklıysa null döner — "karışık" durumu gizlenmez, çünkü tek
   * bir sayı göstermek operatörü yanıltır.
   */
  const uniformMarginPct = useMemo(() => {
    const marjlar = filledLines
      .filter((l) => (l.netCost ?? 0) > 0)
      .map((l) => impliedMarginPct({ quantity: l.quantity, unitPrice: l.unitPrice, netCost: l.netCost as number }))
      .filter((m): m is number => m != null);

    if (marjlar.length === 0) return null;
    const ilk = marjlar[0];
    // Kuruş yuvarlaması yüzünden birebir eşitlik beklenmez; 0,05 puan tolerans.
    return marjlar.every((m) => Math.abs(m - ilk) < 0.05) ? ilk : null;
  }, [filledLines]);

  return {
    lines,
    filledLines,
    discountPct,
    shippingCharge,
    totals,
    indicators,
    uniformMarginPct,
    setDiscountPct,
    setShippingCharge,
    setLines,
    addLine,
    addLines,
    updateLine,
    removeLine,
    duplicateLine,
    moveLine,
    resetLines,
    applyMarginToLines,
    rescaleQuantities,
  };
}

/**
 * Excel/Sheets'ten yapıştırılan bloğu satırlara çevirir.
 *
 * Beklenen sütun sırası (public/templates/mantolama-teklif-sablonu.xlsx ile
 * aynı): ÜRÜN · MİKTAR · BİRİM · BİRİM FİYAT
 * Eksik sütunlar boş bırakılır; sayı ayracı olarak hem "1.234,56" hem
 * "1234.56" kabul edilir.
 */
export function parsePastedRows(text: string): EditorLine[] {
  const satirlar = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const cikti: EditorLine[] = [];

  for (const satir of satirlar) {
    const hucreler = satir.split("\t").map((h) => h.trim());
    if (hucreler.length < 2) continue;

    const [aciklama, miktarRaw, birim, fiyatRaw] = hucreler;
    if (!aciklama) continue;

    const miktar = parseTrNumber(miktarRaw);
    if (miktar == null || miktar <= 0) continue;

    cikti.push({
      ...createEmptyLine(),
      description: aciklama.slice(0, 300),
      quantity: miktar,
      unit: (birim || "adet").slice(0, 20),
      unitPrice: parseTrNumber(fiyatRaw) ?? 0,
    });
  }

  return cikti;
}

/** "1.234,56" ve "1234.56" biçimlerinin ikisini de okur. */
export function parseTrNumber(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const temiz = String(raw).replace(/[^\d.,-]/g, "").trim();
  if (!temiz) return null;

  const sonVirgul = temiz.lastIndexOf(",");
  const sonNokta = temiz.lastIndexOf(".");
  let normalize: string;

  if (sonVirgul > sonNokta) {
    // Türkçe biçim: nokta binlik, virgül ondalık
    normalize = temiz.replace(/\./g, "").replace(",", ".");
  } else {
    // İngilizce biçim: virgül binlik
    normalize = temiz.replace(/,/g, "");
  }

  const n = Number(normalize);
  return Number.isFinite(n) ? n : null;
}
