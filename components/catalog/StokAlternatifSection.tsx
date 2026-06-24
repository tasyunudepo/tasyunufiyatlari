"use client";

import { WHATSAPP_ORDER } from "@/lib/config";
import { notifyWhatsappIntent } from "@/lib/notifyWhatsappIntent";

interface Props {
  depotStock: number;
  depotPrice: number;
  depotMinM2: number;
  ihtiyac: number;
  packageRefPrice: number | null;
  productName?: string;
  resultSessionId?: string;
}

function fmt(v: number, d = 2) {
  return v.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function StokAlternatifSection({
  depotStock,
  depotPrice,
  depotMinM2,
  ihtiyac,
  packageRefPrice,
  productName,
  resultSessionId,
}: Props) {
  if (depotStock <= 0) return null;

  const stokYeterli = ihtiyac > 0 && depotStock >= ihtiyac;
  const stokFarkPct =
    packageRefPrice !== null && packageRefPrice > 0
      ? ((packageRefPrice - depotPrice) / packageRefPrice) * 100
      : null;

  const stokYetersiz = ihtiyac > 0 && !stokYeterli;

  return (
    <div className="mt-6 rounded-2xl border border-fe-border/60 bg-fe-raised/30 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base">{stokYetersiz ? "⚠️" : "⚡"}</span>
        <h3 className="text-sm font-semibold text-fe-text">
          {stokYetersiz ? "Stok teyidi gerekiyor" : "Tuzla depo stoklu seçenek"}
        </h3>
        <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
          stokYetersiz
            ? "border-brand-600/30 bg-brand-950/30 text-brand-300"
            : "border-brand-600/30 bg-brand-950/30 text-brand-300"
        }`}>
          Stokta
        </span>
      </div>

      {stokYetersiz ? (
        <p className="mb-4 text-[11px] leading-relaxed text-fe-muted">
          Girdiğiniz metraj mevcut depo stokunu aşabilir. Teslim süresi ve alternatif sevkiyat
          için WhatsApp üzerinden teyit alabilirsiniz.
        </p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-fe-border/40 bg-fe-bg/60 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-fe-muted">Mevcut Stok</p>
              <p className="mt-1 text-[13px] font-semibold text-fe-text">{fmt(depotStock, 0)} m²</p>
            </div>
            <div className="rounded-lg border border-fe-border/40 bg-fe-bg/60 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-fe-muted">m² Fiyatı</p>
              <p className="mt-1 text-[13px] font-semibold text-fe-text">{fmt(depotPrice)} ₺/m²</p>
            </div>
            <div className="rounded-lg border border-fe-border/40 bg-fe-bg/60 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-fe-muted">Min. Sipariş</p>
              <p className="mt-1 text-[13px] font-semibold text-fe-text">{fmt(depotMinM2, 0)} m²</p>
            </div>
          </div>

          {stokFarkPct !== null && stokFarkPct < 0 && (
            <div className="mb-4 rounded-lg border border-brand-700/25 bg-brand-950/20 px-3 py-2.5">
              <p className="text-xs text-brand-200">
                Fabrika siparişine göre{" "}
                <strong>%{fmt(Math.abs(stokFarkPct), 1)} daha pahalı</strong> — sevkiyat
                koşulu görüşmede netleşir.
              </p>
            </div>
          )}

          {stokYeterli && (
            <p className="mb-3 text-xs text-green-300">
              ✓ Projenizin {fmt(ihtiyac, 0)} m² ihtiyacını karşılayacak stok mevcut.
            </p>
          )}
        </>
      )}

      <a
        href={stokYetersiz
          ? `https://wa.me/${WHATSAPP_ORDER}?text=Merhaba%2C+stok+ve+teslimat+bilgisi+almak+istiyorum`
          : `https://wa.me/${WHATSAPP_ORDER}?text=Merhaba%2C+depodaki+ürünle+ilgili+bilgi+almak+istiyorum`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => notifyWhatsappIntent({
          source: 'product_detail_card',
          productName,
          resultSessionId,
          ctaLocation: 'product_detail_card',
        })}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-600/40 bg-green-900/20 py-3 text-sm font-semibold text-green-300 transition-colors hover:bg-green-900/35"
        aria-label="WhatsApp'tan stok ve sevkiyat teyidi al"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        {stokYetersiz ? "Stok ve sevkiyat sor" : "WhatsApp'tan teyit iste"}
      </a>
    </div>
  );
}
