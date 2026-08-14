"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    AlertTriangle,
    CheckCircle2,
    Copy,
    Download,
    FileText,
    Layers,
    Truck,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { generateQuotePDF } from "@/lib/pdfGenerator";
import { uploadPdfToStorage } from "@/lib/uploadPdfToStorage";
import { buildManualPdfData } from "@/lib/quote/buildManualPdfData";
import { describeVehicles, fitVehicles } from "@/lib/quote/vehicleArea";
import { formatCurrency } from "@/lib/admin/utils";
import { useAdminRole } from "@/lib/admin/useAdminRole";
import { useAdminQuotes } from "@/lib/hooks/useAdminQuotes";
import type { CatalogItem } from "@/app/api/admin/catalog-items/route";
import type { AccessorySetOption } from "@/app/api/admin/accessory-sets/route";
import { QuoteLineTable } from "@/components/admin/quote-editor/QuoteLineTable";
import { ProductPickerDialog } from "@/components/admin/quote-editor/ProductPickerDialog";
import { AccessorySetDialog } from "@/components/admin/quote-editor/AccessorySetDialog";
import { QuoteIndicatorPanel } from "@/components/admin/quote-editor/QuoteIndicatorPanel";
import {
    QuoteDuplicateDialog,
    type DuplicateSource,
} from "@/components/admin/quote-editor/QuoteDuplicateDialog";
import {
    lineFromAccessorySet,
    lineFromCatalog,
    useQuoteEditor,
    type EditorLine,
} from "@/components/admin/quote-editor/useQuoteEditor";

// Yarı otomatik teklif ekranı.
//
// KURGU (27 Tem 2026 kullanıcı kararı): "manuel değil, YARI OTOMATİK".
// Sistem doldurur, operatör ince ayar yapar. Elle yazmak istisnadır.
//   · levha seçilir → metraj araç cinsinden girilebilir ("3 TIR")
//   · toz grubu TEK TIKLA komple gelir (wizard'la birebir aynı ürünler)
//   · marj kadranı çevrilir, tüm fiyatlar yeniden üretilir
//   · kâr, site farkı ve paket artığı kaydetmeden önce görünür
//   · var olan teklif çoğaltılır, metraj değişince miktarlar yeniden hesaplanır
//
// Kayıt yolu public teklif akışından ayrıdır (submit_quote_guarded hız limiti
// ve zorunlu KVKK rızası operatör akışıyla bağdaşmıyor).

const control =
    "rounded-xl border border-[rgba(92,98,108,0.28)] bg-[rgba(18,20,24,0.8)] px-3 py-2 text-sm text-white outline-none focus:border-[rgba(201,168,76,0.5)]";
const label = "block text-[11px] uppercase tracking-wider text-[var(--nx-text-muted)] mb-1";

const SUB_LABELS: Record<string, string> = {
    avrupa: "Avrupa Yakası",
    anadolu: "Anadolu Yakası",
    gebze: "Gebze",
    diger: "Diğer ilçeler",
};

interface Zone {
    city_code: number;
    city_name: string;
}

type Sonuc =
    | { tip: "yok" }
    | {
        tip: "basarili";
        quoteId: number;
        quoteCode: string;
        /** Tarayıcıda üretilen PDF — kaydedilemese bile indirilebilir. */
        pdfBlobUrl: string | null;
        pdfFilename: string | null;
        /** PDF arşivlenemediyse sebebi; teklif yine kayıtlıdır. */
        pdfUyarisi: string | null;
    }
    | { tip: "hata"; mesaj: string; uyarilar?: string[]; onayGerekli?: boolean };

export function QuoteBuilder({ onSaved }: { onSaved?: () => void }) {
    const { canMutate } = useAdminRole();
    const { refresh } = useAdminQuotes();

    // ── Müşteri ──
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerCompany, setCustomerCompany] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");

    // ── Bağlam ──
    const [cityCode, setCityCode] = useState<string>("");
    const [materialType, setMaterialType] = useState<"tasyunu" | "eps" | "karma">("karma");
    const [vehicle, setVehicle] = useState<"tir" | "kamyon">("tir");
    // Bonus fiyatı İstanbul'da yakaya, Kocaeli'de Gebze/diğer ayrımına bağlı;
    // seçilmeden Bonus ürünleri katalogda görünmez.
    const [subRegion, setSubRegion] = useState<string>("");
    const [areaM2, setAreaM2] = useState<string>("");
    const [title, setTitle] = useState("");
    const [validityDays, setValidityDays] = useState(7);
    const [notes, setNotes] = useState("");
    const [consentChannel, setConsentChannel] = useState<"telefon" | "yuz_yuze" | "eposta" | "whatsapp">("telefon");

    // ── Akış ──
    const [pickerRowId, setPickerRowId] = useState<string | null>(null);
    const [setDialogAcik, setSetDialogAcik] = useState(false);
    const [cogaltDialogAcik, setCogaltDialogAcik] = useState(false);
    const [targetMarginPct, setTargetMarginPct] = useState(5);
    // Nakliyenin belgede nasıl görüneceği — tutardan çıkarım YAPILMAZ.
    const [shippingMode, setShippingMode] = useState<
        "included_in_sale_price" | "buyer_pays" | "separate_quote_required"
    >("included_in_sale_price");
    const [saving, setSaving] = useState(false);
    const [sonuc, setSonuc] = useState<Sonuc>({ tip: "yok" });
    const [overrideReason, setOverrideReason] = useState("");

    const areaNum = Number(areaM2.replace(",", ".")) || 0;
    const editor = useQuoteEditor(areaNum);

    // Şehir listesi — katalog fiyatı şehir iskontosuna bağlı.
    const { data: zones = [] } = useQuery<Zone[]>({
        queryKey: ["admin", "shipping-zones"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("shipping_zones")
                .select("city_code, city_name")
                .order("city_name");
            if (error) throw new Error(error.message);
            return (data ?? []) as Zone[];
        },
        staleTime: 10 * 60 * 1000,
    });

    // Katalog — şehir, metraj, araç ve malzeme değişince fiyatlar yeniden hesaplanır.
    const catalogQuery = useQuery({
        queryKey: ["admin", "catalog-items", cityCode, Math.round(areaNum), vehicle, subRegion, materialType],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (cityCode) params.set("cityCode", cityCode);
            if (areaNum > 0) params.set("areaM2", String(Math.round(areaNum)));
            params.set("vehicle", vehicle);
            params.set("materialType", materialType);
            if (subRegion) params.set("sub", subRegion);
            const res = await fetch(`/api/admin/catalog-items?${params}`, { cache: "no-store" });
            const json = await res.json();
            if (!res.ok || !json.ok) throw new Error(json.error ?? "Katalog alınamadı");
            return json as {
                items: CatalogItem[];
                notes: string[];
                context: {
                    bonusSubRegion: { cityName: string; question: string; options: Record<string, number> } | null;
                };
            };
        },
        staleTime: 5 * 60 * 1000,
    });

    const catalogItems = useMemo(() => catalogQuery.data?.items ?? [], [catalogQuery.data]);
    const catalogNotes = catalogQuery.data?.notes ?? [];
    const bonusSubRegion = catalogQuery.data?.context.bonusSubRegion ?? null;

    // Toz grubu paketleri — yalnız dialog açıkken hesaplanır (ağır sorgu).
    // ── Toz grubunun malzemesi SEÇİLEN LEVHADAN gelir ──
    //
    // 29 Temmuz 2026 hatası: `materialType === "eps" ? "eps" : "tasyunu"`
    // yazıyordu. Malzeme kutusu varsayılan "Karma"da kalınca EPS levhaya
    // TAŞYÜNÜ sarfiyatı (6 kg/m², 4 yerine) ve TAŞYÜNÜ dübeli uygulandı.
    // TE-2026-000143 numaralı gerçek teklif 14.229,93 ₺ fazla çıktı.
    //
    // Artık levhanın kendi malzemesi esastır; levha yoksa operatörün
    // seçimine düşülür ve "karma" ASLA sessizce taşyünü sayılmaz.
    const plateMaterialSlug = useMemo(() => {
        const anahtar = editor.lines.find((l) => l.isPlate && l.catalogKey)?.catalogKey;
        const item = catalogItems.find((i) => i.key === anahtar);
        return item?.materialSlug === "eps" || item?.materialSlug === "tasyunu"
            ? item.materialSlug
            : null;
    }, [editor.lines, catalogItems]);

    const tozMalzeme: "tasyunu" | "eps" | null =
        plateMaterialSlug ?? (materialType === "karma" ? null : materialType);

    // Dübel boyu malzeme kadar levha kalınlığına da bağlıdır. Katalog satırı
    // bu bilgiyi zaten taşır; set API'sine göndermemek 9 cm levhada ilk ürün
    // olan 11,5 cm dübelin seçilmesine yol açıyordu (TE-2026-000170).
    const plateThicknessCm = useMemo(() => {
        const line = editor.lines.find((l) => l.isPlate && l.catalogKey);
        return line?.thicknessCm ?? null;
    }, [editor.lines]);

    /** Levha seçilince malzeme kutusu da onunla hizalanır. */
    useEffect(() => {
        if (plateMaterialSlug && materialType !== plateMaterialSlug) {
            setMaterialType(plateMaterialSlug);
        }
    }, [plateMaterialSlug, materialType]);

    // Toz grubu paketleri — yalnız dialog açıkken ve MALZEME KESİNKEN
    // hesaplanır. Malzeme belirsizken set kurmak, 29 Temmuz'daki yanlış
    // sarfiyat hatasının ta kendisiydi (fail-closed).
    const setQuery = useQuery({
        queryKey: ["admin", "accessory-sets", tozMalzeme, plateThicknessCm, Math.round(areaNum), cityCode],
        enabled: setDialogAcik && areaNum > 0 && tozMalzeme != null,
        queryFn: async () => {
            const params = new URLSearchParams({
                materialType: tozMalzeme as string,
                areaM2: String(areaNum),
            });
            if (cityCode) params.set("cityCode", cityCode);
            if (plateThicknessCm != null) params.set("plateThicknessCm", String(plateThicknessCm));
            const res = await fetch(`/api/admin/accessory-sets?${params}`, { cache: "no-store" });
            const json = await res.json();
            if (!res.ok || !json.ok) throw new Error(json.error ?? "Toz grubu paketleri alınamadı");
            return json as { sets: AccessorySetOption[] };
        },
        staleTime: 5 * 60 * 1000,
    });

    const cityName = useMemo(
        () => zones.find((z) => String(z.city_code) === cityCode)?.city_name ?? "",
        [zones, cityCode],
    );

    // ── Araç ↔ metraj ──
    // Kapasite seçili LEVHAYA bağlı: Bonus 4 cm'de TIR 2.217,6 m², genel
    // taşyünü 4 cm'de 1.872 m². Yanlış kaynaktan okunursa metraj yanlış çıkar.
    const plateCatalogKey = editor.lines.find((l) => l.isPlate && l.catalogKey)?.catalogKey ?? null;
    const kapasite = useMemo(() => {
        const item = catalogItems.find((i) => i.key === plateCatalogKey) ?? null;
        return { truckM2: item?.truckM2 ?? null, lorryM2: item?.lorryM2 ?? null };
    }, [catalogItems, plateCatalogKey]);
    const aracKarsiligi = describeVehicles(fitVehicles(areaNum, kapasite));

    /** Araç sayısını metraja çevirir — "3 TIR" → 6.652,8 m². */
    function aracSec(adet: number) {
        const birim = vehicle === "tir" ? kapasite.truckM2 : kapasite.lorryM2;
        if (!birim || birim <= 0) return;
        const yeni = Math.round(adet * birim * 100) / 100;
        setAreaM2(String(yeni).replace(".", ","));
        editor.rescaleQuantities(yeni);
    }

    // Metraj girilmediyse m² birimli satırlardan türet — operatörün iki kez
    // aynı sayıyı yazmasına gerek kalmasın.
    const tureyenMetraj = useMemo(
        () =>
            editor.filledLines
                .filter((l) => l.unit.toLocaleLowerCase("tr-TR").includes("m²"))
                .reduce((s, l) => s + l.quantity, 0),
        [editor.filledLines],
    );

    useEffect(() => {
        if (!areaM2 && tureyenMetraj > 0) setAreaM2(String(Math.round(tureyenMetraj)));
    }, [tureyenMetraj, areaM2]);

    // Eksik listesi SATIR SATIR söyler. Eski hâli "en az bir kalem" diyordu;
    // oysa satır vardı, yalnız miktarı boştu — operatör neyi düzelteceğini
    // anlayamıyordu (27 Tem 2026 kullanıcı geri bildirimi).
    const eksikler: string[] = [];
    if (customerName.trim().length < 2) eksikler.push("Müşteri adı girin");
    if (customerPhone.trim().length < 7) eksikler.push("Telefon girin");
    if (!cityCode) eksikler.push("Şehir seçin");
    if (areaNum <= 0) eksikler.push("İş metrajı girin");

    const doluAciklama = editor.lines.filter((l) => l.description.trim().length > 0);
    if (doluAciklama.length === 0) {
        eksikler.push("En az bir ürün ekleyin");
    } else {
        for (const [i, l] of editor.lines.entries()) {
            if (l.description.trim().length === 0) continue;
            if (l.quantity <= 0) eksikler.push(`${i + 1}. satırda miktar girin`);
            else if (l.unitPrice <= 0) eksikler.push(`${i + 1}. satırda birim fiyat girin`);
        }
    }

    const kaydedilebilir = canMutate && eksikler.length === 0 && !saving;

    /** Katalog kalemini bir satıra yazar — dialogdan da, satır içi aramadan da. */
    function satiraUygula(rowId: string, item: CatalogItem) {
        // m² birimli üründe miktar = iş metrajı. Operatör zaten metrajı
        // yazdı; aynı sayıyı ikinci kez istemek gereksiz ve unutulunca
        // "Teklifi kaydet" sessizce kapalı kalıyordu.
        const mevcut = editor.lines.find((l) => l.rowId === rowId);
        const m2Birimi = item.unit.toLocaleLowerCase("tr-TR").includes("m²");
        const onerilenMiktar =
            mevcut && mevcut.quantity > 0
                ? mevcut.quantity
                : m2Birimi && areaNum > 0
                    ? areaNum
                    : 0;

        const yeni: EditorLine = lineFromCatalog(item, onerilenMiktar);
        editor.updateLine(rowId, {
            kind: yeni.kind,
            catalogKey: yeni.catalogKey,
            description: yeni.description,
            unit: yeni.unit,
            unitPrice: yeni.unitPrice,
            suggestedUnitPrice: yeni.suggestedUnitPrice,
            isPlate: yeni.isPlate,
            thicknessCm: yeni.thicknessCm,
            netCost: yeni.netCost,
            unitContent: yeni.unitContent,
            quantity: onerilenMiktar,
        });

        // Miktar boş kaldıysa imleci oraya götür — sıradaki iş o.
        if (onerilenMiktar <= 0) {
            requestAnimationFrame(() => {
                const index = editor.lines.findIndex((l) => l.rowId === rowId);
                if (index < 0) return;
                document
                    .querySelector<HTMLInputElement>(`input[aria-label="Satır ${index + 1} miktar"]`)
                    ?.focus();
            });
        }
    }

    function handlePick(item: CatalogItem) {
        if (!pickerRowId) return;
        satiraUygula(pickerRowId, item);
        setPickerRowId(null);
    }

    /** Toz grubu setini komple ekler — 7 satır tek tıkla. */
    function handleApplySet(set: AccessorySetOption) {
        const yeniSatirlar = set.items.map(lineFromAccessorySet);

        editor.setLines((prev) => {
            // Aynı ürün zaten varsa tazelenir, yenisi eklenmez — set iki kez
            // uygulanınca satırlar ikizlenmesin.
            const guncel = prev.map((l) => {
                const eslesen = yeniSatirlar.find((y) => y.catalogKey === l.catalogKey);
                return eslesen
                    ? { ...l, quantity: eslesen.quantity, unitPrice: eslesen.unitPrice, netCost: eslesen.netCost, consumptionRate: eslesen.consumptionRate, consumptionUnit: eslesen.consumptionUnit, unitContent: eslesen.unitContent }
                    : l;
            });
            const mevcutAnahtarlar = new Set(
                guncel.map((l) => l.catalogKey).filter(Boolean) as string[],
            );
            const eklenecek = yeniSatirlar.filter(
                (l) => !mevcutAnahtarlar.has(l.catalogKey as string),
            );
            // Baştaki boş satır varsa yut — çöp satır bırakma.
            const temiz = guncel.filter((l) => l.description.trim().length > 0 || l.quantity > 0);
            return [...temiz, ...eklenecek];
        });
        setSetDialogAcik(false);
    }

    /** Var olan teklifi kalemleriyle yükler — "kopyala, metrajı değiştir". */
    const handleDuplicate = useCallback(
        (kaynak: DuplicateSource) => {
            editor.setLines(kaynak.lines);
            editor.setDiscountPct(kaynak.discountPct);
            editor.setShippingCharge(kaynak.shippingCharge);
            setMaterialType(kaynak.materialType);
            if (kaynak.title) setTitle(kaynak.title);
            if (kaynak.areaM2 > 0) setAreaM2(String(kaynak.areaM2).replace(".", ","));
            setCogaltDialogAcik(false);
            // Müşteri bilgisi BİLEREK taşınmaz — çoğaltılan şey sepet, kişi değil.
        },
        [editor],
    );

    async function handleSave(overrideOnay = false) {
        setSaving(true);
        setSonuc({ tip: "yok" });

        const payload = {
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerCompany: customerCompany.trim() || null,
            customerEmail: customerEmail.trim() || null,
            cityCode,
            cityName,
            materialType,
            areaM2: areaNum,
            title: title.trim() || null,
            validityDays,
            notes: notes.trim() || null,
            lines: editor.filledLines.map((l) => ({
                kind: l.kind,
                catalogKey: l.catalogKey ?? null,
                description: l.description,
                quantity: l.quantity,
                unit: l.unit,
                unitPrice: l.unitPrice,
                lineDiscountPct: l.lineDiscountPct,
                isPlate: l.isPlate,
                thicknessCm: l.thicknessCm ?? null,
                packageCount: l.packageCount ?? null,
                note: l.note ?? null,
                netCost: l.netCost ?? null,
                consumptionRate: l.consumptionRate ?? null,
                consumptionUnit: l.consumptionUnit ?? null,
                unitContent: l.unitContent ?? null,
            })),
            discountPct: editor.discountPct,
            shippingCharge: editor.shippingCharge,
            shippingMode,
            appliedMarginPct: editor.uniformMarginPct,
            expectedPriceWithoutVat: editor.totals.priceWithoutVat,
            expectedTotalPrice: editor.totals.totalPrice,
            consentBasis: "sozlesme_hazirligi" as const,
            consentChannel,
            overrideCommercialRules: overrideOnay,
            overrideReason: overrideOnay ? overrideReason.trim() || "Operatör onayı" : null,
        };

        try {
            const res = await fetch("/api/admin/quotes/manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json().catch(() => null);

            if (res.status === 422 && json?.needsOverride) {
                setSonuc({ tip: "hata", mesaj: json.error, uyarilar: json.warnings, onayGerekli: true });
                return;
            }
            if (!res.ok || !json?.ok) {
                setSonuc({
                    tip: "hata",
                    mesaj: json?.error ?? `Teklif kaydedilemedi (HTTP ${res.status}).`,
                });
                return;
            }

            // ── PDF ──
            // Sıra: önce teklif kaydı (kodu sunucu verir), sonra PDF üretimi,
            // sonra private storage'a yükleme. Wizard'da kod istemcide
            // üretildiği için sıra terstir; kod sunucudan geldiğinden
            // bu sıra hem zorunlu hem daha güvenli.
            // PDF üretimi/yüklemesi başarısız olsa bile TEKLİF KAYITLIDIR.
            let pdfBlobUrl: string | null = null;
            let pdfFilename: string | null = null;
            let pdfUyarisi: string | null = null;

            try {
                const pdfData = buildManualPdfData({
                    quoteCode: json.quoteCode,
                    customerName: payload.customerName,
                    customerCompany: payload.customerCompany,
                    customerPhone: payload.customerPhone,
                    customerEmail: payload.customerEmail,
                    customerAddress: null,
                    cityName: payload.cityName,
                    title: payload.title,
                    notes: payload.notes,
                    materialType: payload.materialType,
                    areaM2: payload.areaM2,
                    validityDays: payload.validityDays,
                    lines: payload.lines,
                    discountPct: payload.discountPct,
                    shippingCharge: payload.shippingCharge,
                    shippingMode: payload.shippingMode,
                    totals: editor.totals,
                });

                const pdf = await generateQuotePDF(pdfData);
                pdfBlobUrl = pdf.blobUrl;
                pdfFilename = pdf.filename;

                if (json.pdfUploadCapability) {
                    const yuklendi = await uploadPdfToStorage(pdf.blob, {
                        quoteId: json.quoteId,
                        capability: json.pdfUploadCapability,
                        filename: `${json.quoteCode}.pdf`,
                    });
                    if (!yuklendi) {
                        pdfUyarisi = "PDF arşive yüklenemedi — aşağıdan indirebilirsiniz.";
                    }
                } else {
                    pdfUyarisi = "PDF arşivleme yapılandırılmamış — aşağıdan indirebilirsiniz.";
                }
            } catch {
                pdfUyarisi = "PDF üretilemedi. Teklif kaydedildi; PDF'i teklif listesinden yeniden alabilirsiniz.";
            }

            setSonuc({
                tip: "basarili",
                quoteId: json.quoteId,
                quoteCode: json.quoteCode,
                pdfBlobUrl,
                pdfFilename,
                pdfUyarisi,
            });
            void refresh();
            onSaved?.();
        } catch {
            setSonuc({ tip: "hata", mesaj: "Bağlantı hatası — teklif kaydedilemedi." });
        } finally {
            setSaving(false);
        }
    }

    function yeniTeklif() {
        editor.resetLines();
        setCustomerName(""); setCustomerPhone(""); setCustomerCompany(""); setCustomerEmail("");
        setTitle(""); setNotes(""); setAreaM2("");
        setOverrideReason("");
        setSonuc({ tip: "yok" });
    }

    if (!canMutate) {
        return (
            <div className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-6 text-sm text-sky-200">
                Salt okunur hesap — teklif yazma yetkiniz yok.
            </div>
        );
    }

    if (sonuc.tip === "basarili") {
        return (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6" data-testid="manual-quote-success">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" />
                    <div>
                        <h3 className="text-lg font-semibold text-white">Teklif kaydedildi</h3>
                        <p className="mt-1 text-sm text-emerald-200">
                            Teklif no: <span className="font-mono">{sonuc.quoteCode}</span>
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {/* Tarayıcıda üretilen kopya — arşivleme başarısız olsa
                                bile operatör PDF'i eline alabilsin. */}
                            {sonuc.pdfBlobUrl && (
                                <a
                                    href={sonuc.pdfBlobUrl}
                                    download={sonuc.pdfFilename ?? `${sonuc.quoteCode}.pdf`}
                                    data-testid="manual-quote-pdf-download"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/25"
                                >
                                    <Download className="h-4 w-4" /> PDF indir
                                </a>
                            )}
                            {!sonuc.pdfUyarisi && (
                                <a
                                    href={`/api/admin/quotes/${sonuc.quoteId}/pdf`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-400/20"
                                >
                                    <FileText className="h-4 w-4" /> Arşivdeki PDF
                                </a>
                            )}
                            <button type="button" onClick={yeniTeklif}
                                className="rounded-lg bg-[var(--nx-gold)] px-4 py-2 text-sm font-bold text-black hover:opacity-90">
                                Yeni teklif yaz
                            </button>
                        </div>

                        {sonuc.pdfUyarisi && (
                            <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"
                                data-testid="manual-quote-pdf-warning">
                                {sonuc.pdfUyarisi}
                            </p>
                        )}

                        <p className="mt-3 text-[11px] text-emerald-200/70">
                            Teklif listede &ldquo;Ofis&rdquo; kanalı ve &ldquo;Teklif Verildi&rdquo; durumuyla görünür.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4" data-testid="manual-quote-editor">
            {/* ── Müşteri ve bağlam ── */}
            <div className="rounded-2xl border border-[rgba(92,98,108,0.24)] bg-[rgba(13,15,18,0.7)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 className="text-base font-semibold text-white">Yeni Teklif</h3>
                        <p className="mt-0.5 text-xs text-slate-400">
                            Fiyatlar şehir/araç iskontosu ve marj kuralıyla gelir; her kalem yine tek tek düzenlenebilir.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setCogaltDialogAcik(true)}
                        data-testid="open-duplicate-dialog"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(92,98,108,0.35)] px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-[rgba(201,168,76,0.4)] hover:text-white"
                    >
                        <Copy className="h-3.5 w-3.5" />
                        Teklifi çoğalt
                    </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block">
                        <span className={label}>Müşteri adı *</span>
                        <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={`${control} w-full`} />
                    </label>
                    <label className="block">
                        <span className={label}>Telefon *</span>
                        <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={`${control} w-full`} />
                    </label>
                    <label className="block">
                        <span className={label}>Firma</span>
                        <input value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} className={`${control} w-full`} />
                    </label>
                    <label className="block">
                        <span className={label}>E-posta</span>
                        <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className={`${control} w-full`} />
                    </label>

                    <label className="block">
                        <span className={label}>Şehir *</span>
                        <select value={cityCode} onChange={(e) => setCityCode(e.target.value)} className={`${control} w-full [color-scheme:dark]`}>
                            <option value="">Seçin…</option>
                            {zones.map((z) => (
                                <option key={z.city_code} value={String(z.city_code)}>{z.city_name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className={label}>Malzeme</span>
                        <select value={materialType} onChange={(e) => setMaterialType(e.target.value as typeof materialType)} className={`${control} w-full [color-scheme:dark]`}>
                            <option value="karma">Karma</option>
                            <option value="tasyunu">Taşyünü</option>
                            <option value="eps">EPS</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className={label}>Araç (taşyünü iskontosu)</span>
                        <select value={vehicle} onChange={(e) => setVehicle(e.target.value as typeof vehicle)} className={`${control} w-full [color-scheme:dark]`}>
                            <option value="tir">Tır</option>
                            <option value="kamyon">Kamyon</option>
                        </select>
                    </label>

                    {/* Metraj + araç dönüşümü.
                        Operatör ve müşteri "3 TIR" diye konuşuyor, sistem m²
                        istiyor. Kapasite seçili levhaya bağlı olduğu için bu
                        hesap kafadan yapılamaz (27 Tem 2026'da elle yapıldı). */}
                    <div>
                        <span className={label}>İş metrajı (m²) *</span>
                        <input
                            value={areaM2}
                            onChange={(e) => {
                                setAreaM2(e.target.value);
                                const n = Number(e.target.value.replace(",", ".")) || 0;
                                if (n > 0) editor.rescaleQuantities(n);
                            }}
                            inputMode="decimal"
                            aria-label="İş metrajı (m²)"
                            className={`${control} w-full text-right tabular-nums`}
                        />
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {kapasite.truckM2 || kapasite.lorryM2 ? (
                                <>
                                    <Truck className="h-3 w-3 shrink-0 text-[var(--nx-text-muted)]" />
                                    {[1, 2, 3, 4].map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => aracSec(n)}
                                            data-testid={`arac-${n}`}
                                            className="rounded border border-[rgba(92,98,108,0.3)] px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 transition-colors hover:border-[rgba(201,168,76,0.45)] hover:text-white"
                                        >
                                            {n} {vehicle === "tir" ? "TIR" : "kamyon"}
                                        </button>
                                    ))}
                                </>
                            ) : (
                                <span className="text-[10px] text-[var(--nx-text-muted)]">
                                    Levha seçilince araç kapasitesi görünür
                                </span>
                            )}
                        </div>
                        {aracKarsiligi && (
                            <p className="mt-1 text-[10px] font-semibold text-emerald-300" data-testid="arac-karsiligi">
                                = {aracKarsiligi} (tam araç)
                            </p>
                        )}
                    </div>

                    {/* Bonus fiyatı bölgeye bağlı: İstanbul'da yaka,
                        Kocaeli'de Gebze/diğer. Seçilmeden Bonus ürünleri
                        katalogda görünmez (fail-closed). */}
                    {bonusSubRegion && (
                        <label className="block">
                            <span className={label}>
                                {bonusSubRegion.question === "yaka" ? "Teslimat yakası" : "İlçe"} (Bonus) *
                            </span>
                            <select
                                value={subRegion}
                                onChange={(e) => setSubRegion(e.target.value)}
                                className={`${control} w-full [color-scheme:dark] ${!subRegion ? "border-amber-400/50" : ""}`}
                            >
                                <option value="">Seçin…</option>
                                {Object.keys(bonusSubRegion.options).map((k) => (
                                    <option key={k} value={k}>{SUB_LABELS[k] ?? k}</option>
                                ))}
                            </select>
                        </label>
                    )}

                    <label className="block lg:col-span-2">
                        <span className={label}>Teklif başlığı</span>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${control} w-full`} />
                    </label>
                    <label className="block">
                        <span className={label}>Geçerlilik (gün)</span>
                        <input type="number" min={1} max={90} value={validityDays}
                            onChange={(e) => setValidityDays(Number(e.target.value) || 7)}
                            className={`${control} w-full text-right tabular-nums`} />
                    </label>
                    <label className="block">
                        <span className={label}>Temas kanalı</span>
                        <select value={consentChannel} onChange={(e) => setConsentChannel(e.target.value as typeof consentChannel)} className={`${control} w-full [color-scheme:dark]`}>
                            <option value="telefon">Telefon</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="yuz_yuze">Yüz yüze</option>
                            <option value="eposta">E-posta</option>
                        </select>
                    </label>
                </div>

                {catalogNotes.length > 0 && (
                    <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                        {catalogNotes.map((n) => <p key={n}>{n}</p>)}
                    </div>
                )}
            </div>

            {/* ── Toz grubu tek tıkla ──
                Bu sitenin kuruluş amacı teklif hazırlama zahmetini kaldırmaktı;
                toz grubunu 7 satır tek tek yazmak o amaca ters (27 Tem 2026). */}
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setSetDialogAcik(true)}
                    disabled={areaNum <= 0 || tozMalzeme == null}
                    data-testid="open-accessory-set"
                    title={
                        areaNum <= 0
                            ? "Önce iş metrajını girin"
                            : tozMalzeme == null
                                ? "Önce levhayı seçin veya Malzeme'yi Taşyünü/EPS yapın — sarfiyat ve dübel tipi buna bağlı"
                                : undefined
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.12)] px-3 py-2 text-xs font-bold text-[var(--nx-gold)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-35"
                >
                    <Layers className="h-3.5 w-3.5" />
                    Toz grubu paketi ekle
                </button>
                <span className="text-[11px] text-[var(--nx-text-muted)]">
                    {tozMalzeme == null
                        ? "Malzeme belirsiz — levhayı seçin ya da Malzeme'yi Taşyünü/EPS yapın."
                        : `Yapıştırıcı, sıva, dübel, file, profil, astar ve kaplama tek seferde gelir (${tozMalzeme === "eps" ? "EPS" : "taşyünü"} sarfiyatı).`}
                </span>
            </div>

            {/* ── Kalemler ── */}
            <QuoteLineTable
                lines={editor.lines}
                catalogItems={catalogItems}
                onPickCatalogItem={satiraUygula}
                onUpdate={editor.updateLine}
                onRemove={editor.removeLine}
                onDuplicate={editor.duplicateLine}
                onMove={editor.moveLine}
                onAdd={() => editor.addLine()}
                onAddMany={editor.addLines}
                onPickProduct={setPickerRowId}
            />

            {/* ── Göstergeler ── */}
            <QuoteIndicatorPanel
                indicators={editor.indicators}
                uniformMarginPct={editor.uniformMarginPct}
                targetMarginPct={targetMarginPct}
                onTargetMarginChange={setTargetMarginPct}
                onApplyMargin={() => editor.applyMarginToLines(targetMarginPct)}
                disabled={editor.indicators.knownCost <= 0}
            />

            {/* ── Toplamlar ── */}
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                <div className="rounded-2xl border border-[rgba(92,98,108,0.24)] bg-[rgba(13,15,18,0.7)] p-4">
                    <label className="block">
                        <span className={label}>Teklif notu (PDF&apos;e girer)</span>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
                            className={`${control} w-full resize-none`} />
                    </label>
                </div>

                <div className="rounded-2xl border border-[rgba(201,168,76,0.28)] bg-[rgba(201,168,76,0.06)] p-4">
                    <div className="space-y-2.5 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-300">
                                {editor.discountPct > 0 ? "Liste toplamı" : "Ara toplam"}
                            </span>
                            <span className="font-medium tabular-nums text-white">{formatCurrency(editor.totals.listeToplami)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-300" title="Birim fiyatlara işlenir — belgede ayrı satır olarak görünmez">
                                Toplu iskonto
                            </span>
                            <div className="flex items-center gap-1.5">
                                <input
                                    value={editor.discountPct === 0 ? "" : String(editor.discountPct)}
                                    onChange={(e) => editor.setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value.replace(",", ".")) || 0)))}
                                    inputMode="decimal"
                                    aria-label="Toplu iskonto yüzdesi"
                                    className="w-14 rounded-lg border border-[rgba(92,98,108,0.3)] bg-[rgba(18,20,24,0.8)] px-2 py-1 text-right text-sm tabular-nums text-white outline-none focus:border-[rgba(201,168,76,0.5)]"
                                />
                                <span className="text-xs text-slate-400">%</span>
                                <span className="w-24 text-right font-medium tabular-nums text-amber-300">
                                    {editor.totals.discountAmount > 0 ? `−${formatCurrency(editor.totals.discountAmount)}` : "—"}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-300">Nakliye</span>
                            <input
                                value={editor.shippingCharge === 0 ? "" : String(editor.shippingCharge)}
                                onChange={(e) => editor.setShippingCharge(Math.max(0, Number(e.target.value.replace(",", ".")) || 0))}
                                inputMode="decimal"
                                aria-label="Nakliye tutarı"
                                className="w-32 rounded-lg border border-[rgba(92,98,108,0.3)] bg-[rgba(18,20,24,0.8)] px-2 py-1 text-right text-sm tabular-nums text-white outline-none focus:border-[rgba(201,168,76,0.5)]"
                            />
                        </div>

                        {/* Belgede nakliye nasıl yazsın — AÇIK seçim.
                            Önceden tutar 0 ise otomatik "DAHİL" yazılıyordu ve
                            nakliye hariç teklif verilemiyordu (29 Tem 2026). */}
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-300">Belgede nakliye</span>
                            <select
                                value={editor.shippingCharge > 0 ? "buyer_pays" : shippingMode}
                                disabled={editor.shippingCharge > 0}
                                onChange={(e) => setShippingMode(e.target.value as typeof shippingMode)}
                                aria-label="Belgede nakliye sunumu"
                                data-testid="shipping-mode"
                                className="w-52 rounded-lg border border-[rgba(92,98,108,0.3)] bg-[rgba(18,20,24,0.8)] px-2 py-1 text-sm text-white outline-none [color-scheme:dark] focus:border-[rgba(201,168,76,0.5)] disabled:opacity-50"
                            >
                                <option value="included_in_sale_price">Fiyata dahil</option>
                                <option value="buyer_pays">Hariç — alıcıya ait</option>
                                <option value="separate_quote_required">Görüşmede netleşir</option>
                            </select>
                        </div>
                        {editor.shippingCharge > 0 && (
                            <p className="text-[10px] text-[var(--nx-text-muted)]">
                                Nakliye ayrı kalem olarak eklendi — belgede &ldquo;alıcıya ait&rdquo; yazar.
                            </p>
                        )}
                        {editor.discountPct > 0 && (
                            <div className="flex items-center justify-between border-t border-[rgba(92,98,108,0.2)] pt-2.5">
                                <span className="text-slate-300">İskontolu ara toplam</span>
                                <span className="font-medium tabular-nums text-white">{formatCurrency(editor.totals.linesNet)}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between border-t border-[rgba(92,98,108,0.2)] pt-2.5">
                            <span className="text-slate-300">KDV %20</span>
                            <span className="font-medium tabular-nums text-white">{formatCurrency(editor.totals.vatAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-[rgba(201,168,76,0.25)] pt-2.5">
                            <span className="font-semibold text-white">Genel toplam</span>
                            <span className="text-xl font-bold tabular-nums text-[var(--nx-gold)]" data-testid="manual-quote-total">
                                {formatCurrency(editor.totals.totalPrice)}
                            </span>
                        </div>
                        <p className="text-[11px] text-[var(--nx-text-muted)]">KDV dahil</p>
                    </div>

                    {eksikler.length > 0 && (
                        <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200"
                            data-testid="manual-quote-missing">
                            <p className="font-semibold">Kaydetmek için:</p>
                            <ul className="mt-1 space-y-0.5">
                                {eksikler.map((e) => <li key={e}>• {e}</li>)}
                            </ul>
                        </div>
                    )}

                    {sonuc.tip === "hata" && (
                        <div role="alert" data-testid="manual-quote-error"
                            className="mt-4 rounded-lg border border-red-400/35 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                            <p className="flex items-start gap-1.5">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{sonuc.mesaj}</span>
                            </p>
                            {sonuc.uyarilar?.map((u) => (
                                <p key={u} className="mt-1 pl-5 text-amber-200">• {u}</p>
                            ))}
                            {sonuc.onayGerekli && (
                                <div className="mt-2 pl-5">
                                    <input
                                        value={overrideReason}
                                        onChange={(e) => setOverrideReason(e.target.value)}
                                        aria-label="Kural aşımı gerekçesi"
                                        className="w-full rounded-lg border border-amber-400/30 bg-[rgba(18,20,24,0.8)] px-2 py-1.5 text-xs text-white outline-none"
                                    />
                                    <button type="button" disabled={overrideReason.trim().length < 3 || saving}
                                        onClick={() => void handleSave(true)}
                                        className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 disabled:opacity-40">
                                        Gerekçeyle kaydet
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        type="button"
                        disabled={!kaydedilebilir}
                        onClick={() => void handleSave(false)}
                        data-testid="manual-quote-save"
                        className="mt-4 w-full rounded-xl bg-[var(--nx-gold)] px-4 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {saving ? "Kaydediliyor…" : "Teklifi kaydet"}
                    </button>
                </div>
            </div>

            <ProductPickerDialog
                open={pickerRowId !== null}
                items={catalogItems}
                loading={catalogQuery.isLoading}
                onClose={() => setPickerRowId(null)}
                onPick={handlePick}
            />

            <AccessorySetDialog
                open={setDialogAcik}
                sets={setQuery.data?.sets ?? []}
                loading={setQuery.isLoading}
                error={setQuery.error ? (setQuery.error as Error).message : null}
                areaM2={areaNum}
                onClose={() => setSetDialogAcik(false)}
                onApply={handleApplySet}
            />

            <QuoteDuplicateDialog
                open={cogaltDialogAcik}
                onClose={() => setCogaltDialogAcik(false)}
                onPick={handleDuplicate}
            />
        </div>
    );
}
