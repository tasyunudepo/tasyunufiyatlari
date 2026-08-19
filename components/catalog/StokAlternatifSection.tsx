"use client";


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
          teklif kaydınız oluştuktan sonra sevkiyat koşullarını teyit edebilirsiniz.
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
              <p className="mt-0.5 text-[9px] text-fe-muted-strong">KDV hariç</p>
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

      <p className="rounded-xl border border-fe-border/60 bg-fe-bg/60 px-4 py-3 text-center text-xs text-fe-muted">
        Stok ve sevkiyat teyidi, referanslı PDF teklif oluşturulduktan sonra açılır.
      </p>
    </div>
  );
}
