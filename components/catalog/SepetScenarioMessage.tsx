"use client";

// SepetScenarioMessage
// SepetUI'ın fabrika tam araç senaryolarının mesaj kartlarını barındırır.
// Saf görsel + dış callback'ler. State SepetUI'da kalır; bu bileşen sadece
// mevcut scenario'ya uygun mesajı render eder.
//
// React.memo: scenario veya ilgili türetilmiş değer değişmedikçe re-render yapmaz.

import { memo } from "react";
import type { SepetScenario } from "./SepetUI";

function fmt(v: number, d = 2) {
  return v.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

interface OptimalCombo {
  kamyon: number;
  tir: number;
  totalM2: number;
  totalTL: number;
}

interface Props {
  scenario: SepetScenario;
  // Sayısal/lojistik
  lorryM2: number;
  truckM2: number;
  lorryPrice: number | null;
  truckPrice: number | null;
  ihtiyac: number;
  // Türetilmiş durum
  kamyon: number;
  tir: number;
  truckLotM2: number;
  truckRoundedUp: boolean;
  optimalCombo: OptimalCombo | null;
  suggestionDiffersFromCurrent: boolean;
  // Callback'ler
  onGeriAl: () => void;
}

function SepetScenarioMessageImpl({
  scenario,
  lorryM2,
  truckM2,
  lorryPrice,
  truckPrice,
  ihtiyac,
  kamyon: _kamyon,
  tir,
  truckLotM2,
  truckRoundedUp,
  optimalCombo,
  suggestionDiffersFromCurrent,
  onGeriAl,
}: Props) {
  return (
    <div aria-live="polite">
      {scenario === "lorry_optimal" && (
        <div className="rounded-xl border border-brand-700/30 bg-brand-950/20 p-4">
          <p className="text-sm font-semibold text-brand-200">Tam Kamyon yüklemesi seçildi</p>
          <p className="mt-1 text-[11px] leading-relaxed text-brand-200/70">
            Fabrika çıkışı teklif {fmt(lorryM2, 0)} m² ve katları üzerinden hazırlanır.
            Girdiğiniz metraj daha düşükse sipariş bir tam Kamyona tamamlanır.
          </p>
        </div>
      )}

      {/* TIR seçenek */}
      {scenario === "tir_optimal" && (
        <div className="rounded-xl border border-brand-700/30 bg-brand-950/20 p-4">
          <p className="text-sm font-semibold text-brand-200">
            {tir === 1
              ? truckRoundedUp
                ? "Fabrika siparişi için minimum 1 TIR"
                : "1 TIR tam yükleme için uygun"
              : `${tir} TIR yüklemesi`}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-brand-200/70">
            {truckRoundedUp
              ? `Bu kalınlık fabrikadan minimum ${fmt(truckM2, 0)} m² (1 TIR) alınabilir. Girdiğiniz ${fmt(ihtiyac, 0)} m² için sipariş ${fmt(truckLotM2, 0)} m²'ye tamamlandı.`
              : tir === 1
                ? "Girdiğiniz metraj 1 TIR kapasitesine denk geliyor. Bu seçenek, yüksek metrajlı projeler için en avantajlı m² fiyatını sunar."
                : `${fmt(truckLotM2, 0)} m² TIR yüklemesi, yüksek metrajlı projelerde en düşük m² fiyatını sunar.`}
          </p>
          {suggestionDiffersFromCurrent && optimalCombo && (
            <button
              type="button"
              onClick={onGeriAl}
              className="mt-2 text-[11px] font-semibold text-brand-300 hover:text-brand-100 transition-colors"
            >
              {optimalCombo.tir} TIR seç →
            </button>
          )}
        </div>
      )}

      {/* Büyük proje: karışık veya çoklu yükleme */}
      {scenario === "large_project" && (
        <div className="rounded-xl border border-brand-700/30 bg-brand-950/20 p-4">
          <p className="text-sm font-semibold text-brand-200">
            Büyük metrajlı proje için özel teklif
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-brand-200/70">
            Bu metraj birden fazla yükleme planı gerektirebilir. Fiyat, sevkiyat ve teslim
            süresi proje detayına göre netleştirilir.
          </p>
          {suggestionDiffersFromCurrent && optimalCombo && (
            <button
              type="button"
              onClick={onGeriAl}
              className="mt-2 text-[11px] font-semibold text-brand-300 hover:text-brand-100 transition-colors"
            >
              Önerilen kombinasyonu uygula →
            </button>
          )}
        </div>
      )}

      {/* Ara metraj: seçim bekleniyor */}
      {scenario === "ara_metraj" && lorryPrice !== null && truckPrice !== null && (
        <div className="rounded-xl border border-fe-border/60 bg-fe-raised/30 p-4">
          <p className="text-sm font-semibold text-fe-text">
            Teklif için tam Kamyon veya tam TIR seçimi gerekir.
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-fe-muted">
            Fabrika çıkışı siparişler tam Kamyon ({fmt(lorryM2, 0)} m²), tam TIR
            ({fmt(truckM2, 0)} m²) veya bunların kombinasyonu olarak hazırlanır.
          </p>
          <button
            type="button"
            onClick={onGeriAl}
            className="mt-3 rounded-lg border border-brand-600/50 bg-brand-900/30 px-3 py-1.5 text-[11px] font-semibold text-brand-300 transition-colors hover:bg-brand-900/50"
          >
            Önerilen tam araç planını uygula
          </button>
        </div>
      )}
    </div>
  );
}

const SepetScenarioMessage = memo(SepetScenarioMessageImpl);
export default SepetScenarioMessage;
