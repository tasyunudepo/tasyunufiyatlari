"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle, Database, FileSpreadsheet, Plus, Upload } from "lucide-react";
import { ImportPreview } from "@/components/admin/ImportPreview";
import type { ImportPreviewRow, ImportSummary } from "@/lib/importTypes";

export function ExcelImportTab() {
    const [isUploading, setIsUploading] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [isRollingBack, setIsRollingBack] = useState(false);
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    const [fileId, setFileId] = useState<string | null>(null);
    const [fileStatus, setFileStatus] = useState<"matched" | "applied" | null>(null);
    const [fileName, setFileName] = useState("");
    const [summary, setSummary] = useState<ImportSummary | null>(null);
    const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
    const [statusMsg, setStatusMsg] = useState<{ msg: string; type: "info" | "success" | "error" } | null>(null);
    const [newCreated, setNewCreated] = useState<{
        created: number;
        skipped_duplicates: number;
        skipped_not_accessory: number;
    } | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setFileId(null);
        setFileStatus(null);
        setSummary(null);
        setPreviewRows([]);
        setNewCreated(null);
        setIsUploading(true);
        setStatusMsg({ msg: "Dosya yükleniyor ve analiz ediliyor...", type: "info" });

        try {
            const form = new FormData();
            form.append("file", file);
            form.append("uploaded_by", "admin");

            const res = await fetch("/api/import", { method: "POST", body: form });
            const data = await res.json();

            if (!res.ok || data.error) {
                setStatusMsg({ msg: data.error ?? "Import hatası", type: "error" });
                return;
            }

            setFileId(data.fileId);
            setFileStatus("matched");
            setSummary(data.summary);
            setPreviewRows(data.rows ?? []);
            setStatusMsg({
                msg: `${data.summary.totalRows} satır analiz edildi - ${data.summary.matchedCount} eşleşti, ${data.summary.newProductCount} yeni ürün, ${data.summary.variantMissingCount} varyant eksik.`,
                type: "success",
            });
        } catch {
            setStatusMsg({ msg: "Bağlantı hatası - tekrar deneyin.", type: "error" });
        } finally {
            setIsUploading(false);
        }
    };

    const handleApply = async (allowExtremeDeviation = false) => {
        if (!fileId) return;

        if (allowExtremeDeviation) {
            const approved = window.confirm(
                "%100 üzeri fiyat değişimi olan satırlar için güvenlik kilidi aşılacak.\n\n" +
                "Bu işlemi yalnızca zamların doğruluğu teyit edildiyse yapın.\n\n" +
                "Devam etmek istiyor musunuz?",
            );
            if (!approved) return;
        }

        setIsApplying(true);
        setStatusMsg({
            msg: allowExtremeDeviation
                ? "Fiyatlar override onayıyla uygulanıyor..."
                : "Fiyatlar uygulanıyor...",
            type: "info",
        });

        try {
            const res = await fetch(`/api/import/${fileId}/apply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ allowExtremeDeviation }),
            });
            const data = await res.json();

            if (!data.ok) {
                setStatusMsg({ msg: data.error ?? "Apply hatası", type: "error" });
                return;
            }

            setFileStatus("applied");
            setStatusMsg({
                msg: `${data.result.appliedCount} fiyat güncellendi. Geri almak için "Geri Al" butonunu kullanın.`,
                type: "success",
            });
        } catch {
            setStatusMsg({ msg: "Apply bağlantı hatası", type: "error" });
        } finally {
            setIsApplying(false);
        }
    };

    const handleRollback = async () => {
        if (!fileId) return;

        setIsRollingBack(true);
        setStatusMsg({ msg: "Geri alınıyor...", type: "info" });

        try {
            const res = await fetch(`/api/import/${fileId}/rollback`, { method: "POST" });
            const data = await res.json();

            if (!data.ok) {
                setStatusMsg({ msg: data.error ?? "Rollback hatası", type: "error" });
                return;
            }

            setFileStatus("matched");
            setStatusMsg({
                msg: `${data.result.reverted} kayıt geri alındı. Dosya tekrar "matched" durumuna döndü.`,
                type: "success",
            });
        } catch {
            setStatusMsg({ msg: "Rollback bağlantı hatası", type: "error" });
        } finally {
            setIsRollingBack(false);
        }
    };

    const handleCreateNew = async () => {
        if (!fileId || !summary?.newProductCount) return;

        if (!window.confirm(
            `${summary.newProductCount} yeni ürün accessories tablosuna eklenecek.\n\n` +
            "• Sadece aksesuarlar eklenir (levhalar atlanır)\n" +
            "• Zaten var olan ürünler tekrar eklenmez\n\n" +
            "Onaylıyor musunuz?",
        )) return;

        setIsCreatingNew(true);
        setStatusMsg({ msg: "Yeni ürünler sisteme ekleniyor...", type: "info" });

        try {
            const res = await fetch(`/api/import/${fileId}/create-new-products`, { method: "POST" });
            const data = await res.json();

            if (!data.ok) {
                setStatusMsg({ msg: data.error ?? "Oluşturma hatası", type: "error" });
                return;
            }

            const result = data.result;
            setNewCreated({
                created: result.created,
                skipped_duplicates: result.skipped_duplicates,
                skipped_not_accessory: result.skipped_not_accessory,
            });

            setStatusMsg({
                msg:
                    `${result.created} yeni aksesuar oluşturuldu.` +
                    (result.skipped_duplicates > 0 ? ` ${result.skipped_duplicates} zaten mevcuttu.` : "") +
                    (result.skipped_not_accessory > 0 ? ` ${result.skipped_not_accessory} levha atlandı.` : ""),
                type: "success",
            });
        } catch {
            setStatusMsg({ msg: "Bağlantı hatası", type: "error" });
        } finally {
            setIsCreatingNew(false);
        }
    };

    const isBusy = isUploading || isApplying || isRollingBack || isCreatingNew;

    return (
        <div className="space-y-6">
            <div className="admin-nexus-panel p-8">
                <div className="mb-8 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-orange-500/30 bg-blue-600/20">
                        <FileSpreadsheet className="h-6 w-6 text-orange-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Excel&apos;den Fiyat Güncelle</h2>
                        <p className="text-sm text-slate-400">Güncel fiyat listesini (.xlsx) yükleyerek sistemi senkronize edin.</p>
                        <div className="mt-2 flex gap-4 text-[10px] font-bold uppercase tracking-widest text-[var(--nx-text-muted)]">
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> Kalem Bazında (KDV Dahil)</span>
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> Taşyünü Listesi (KDV Hariç)</span>
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Optimix Sayfası (KDV Dahil)</span>
                        </div>
                    </div>
                </div>

                <div className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-all ${isBusy ? "border-slate-700/30 bg-slate-900/35 opacity-60" : "border-amber-400/20 bg-slate-900/28 hover:border-amber-400/45 hover:bg-amber-400/[0.04]"}`}>
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} disabled={isBusy} className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed" />
                    <Upload className={`mb-4 h-12 w-12 ${isUploading ? "animate-pulse text-orange-400" : "text-[var(--nx-text-muted)]"}`} />
                    <p className="font-medium text-slate-300">{isUploading ? "Analiz ediliyor..." : fileName || "Excel dosyasını buraya sürükleyin veya tıklayın"}</p>
                    <p className="mt-2 text-xs text-[var(--nx-text-muted)]">Maximum dosya boyutu: 10MB</p>
                </div>

                {statusMsg && (
                    <div className={`mt-6 flex items-center gap-3 rounded-xl border p-4 ${statusMsg.type === "error" ? "border-red-500/30 bg-red-500/10 text-red-400" : statusMsg.type === "success" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-orange-500/30 bg-orange-500/10 text-orange-400"}`}>
                        {statusMsg.type === "error" ? <AlertTriangle className="h-5 w-5 flex-shrink-0" /> : <CheckCircle className="h-5 w-5 flex-shrink-0" />}
                        <span className="text-sm font-medium">{statusMsg.msg}</span>
                    </div>
                )}

                {fileId && (
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => handleApply(false)}
                            disabled={isBusy || fileStatus === "applied"}
                            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-[var(--nx-text-muted)]"
                        >
                            <Database className="h-4 w-4" />
                            {isApplying ? "Uygulanıyor..." : fileStatus === "applied" ? "Uygulandı ✓" : "Fiyatları Uygula"}
                        </button>

                        {summary && summary.requiresReviewCount > 0 && fileStatus !== "applied" && (
                            <button
                                onClick={() => handleApply(true)}
                                disabled={isBusy}
                                className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/50 px-5 py-2.5 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-900/60 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <AlertTriangle className="h-4 w-4" />
                                Güvenliği Aşarak Uygula
                            </button>
                        )}

                        {fileStatus === "applied" && (
                            <button
                                onClick={handleRollback}
                                disabled={isBusy}
                                className="rounded-lg border border-red-500/30 bg-red-950/50 px-5 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-950/80 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isRollingBack ? "Geri alınıyor..." : "↩ Geri Al"}
                            </button>
                        )}

                        {summary && summary.newProductCount > 0 && !newCreated && (
                            <button
                                onClick={handleCreateNew}
                                disabled={isBusy}
                                className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/50 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Plus className="h-4 w-4" />
                                {isCreatingNew ? "Ekleniyor..." : `Yeni Ürünleri Ekle (${summary.newProductCount})`}
                            </button>
                        )}

                        {newCreated && newCreated.created > 0 && (
                            <span className="text-xs font-medium text-emerald-400">✓ {newCreated.created} aksesuar oluşturuldu</span>
                        )}

                        <span className="ml-1 text-xs text-[var(--nx-text-muted)]">
                            {fileStatus === "matched"
                                ? "• Staging - production'a henüz yazılmadı"
                                : fileStatus === "applied"
                                  ? "• Production'a yazıldı"
                                  : ""}
                        </span>
                    </div>
                )}
            </div>

            <ImportPreview summary={summary} rows={previewRows} isLoading={isUploading} />
        </div>
    );
}
