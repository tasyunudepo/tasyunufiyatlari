"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SepetVehicleCards from "./SepetVehicleCards";
import SepetScenarioMessage from "./SepetScenarioMessage";

// ─── Tipler ────────────────────────────────────────────────────────────────

export type SepetScenario =
  | 'empty'          // ihtiyac = 0
  | 'lorry_optimal'  // 1+ kamyon (tir = 0)
  | 'tir_optimal'    // 1+ tir (kamyon = 0)
  | 'large_project'  // karışık: tir + kamyon
  | 'ara_metraj';    // ihtiyac > 0 ama sepet boş (no auto-apply)

export interface SepetState {
  kamyon: number;
  tir: number;
  autoApplied: boolean;
  totalM2: number;
  effectivePrice: number | null;
  scenario: SepetScenario;
}

// Tek state nesnesi: render sırasında tek setState çağrısıyla güncellenir
type SepetInternal = {
  kamyon: number;
  tir: number;
  autoApplied: boolean;
};

interface Props {
  lorryM2: number;
  truckM2: number;
  lorryPrice: number | null;
  truckPrice: number | null;
  packageRefPrice: number | null;
  ihtiyac: number;
  onChange: (state: SepetState) => void;
  /** Vehicle cards bloğunu portal ile başka bir DOM noktasına render et.
   *  null/verilmezse SepetUI'ın içinde yerinde render edilir (geri uyumlu). */
  vehicleCardsSlot?: HTMLElement | null;
}

type OptimalResult = {
  kamyon: number;
  tir: number;
  totalM2: number;
  totalTL: number;
} | null;

// ─── Pure fonksiyonlar (bileşen dışında, render'da yeniden oluşturulmaz) ──

export function findOptimalCombination(
  ihtiyac: number,
  lorryM2: number,
  truckM2: number,
  lorryPrice: number,
  truckPrice: number
): OptimalResult {
  if (ihtiyac <= 0 || lorryM2 <= 0 || truckM2 <= 0) return null;

  // Karar (Emrah, 20 Temmuz 2026): plan formülü sabittir — ihtiyaç
  // kamyona sığıyorsa 1 Kamyon; değilse tam TIR'lara bölünür, kalan
  // kamyona sığıyorsa 1 Kamyon eklenir, sığmıyorsa bir üst tam TIR'a
  // yuvarlanır. Birden fazla kamyon önerilmez. Önceki TL taraması hem
  // "N TIR + 5 Kamyon" gibi saha gerçeğine aykırı planlar üretiyordu
  // hem de 10 TIR tavanı yüzünden büyük metrajlarda (ör. 14.500 m²)
  // hiç sonuç döndürmüyordu.
  let kamyon = 0;
  let tir = 0;
  if (ihtiyac <= lorryM2) {
    kamyon = 1;
  } else {
    tir = Math.floor(ihtiyac / truckM2);
    const kalan = ihtiyac - tir * truckM2;
    if (kalan > 1e-9) {
      if (kalan <= lorryM2) kamyon = 1;
      else tir += 1;
    }
  }
  const totalM2 = tir * truckM2 + kamyon * lorryM2;
  const totalTL = tir * truckM2 * truckPrice + kamyon * lorryM2 * lorryPrice;
  return { kamyon, tir, totalM2, totalTL };
}

function buildEffectivePrice(
  kamyon: number,
  tir: number,
  lorryM2: number,
  truckM2: number,
  lorryPrice: number | null,
  truckPrice: number | null
): number | null {
  const totalM2 = kamyon * lorryM2 + tir * truckM2;
  if (totalM2 === 0) return null;
  const totalTL =
    (lorryPrice !== null ? kamyon * lorryM2 * lorryPrice : 0) +
    (truckPrice !== null ? tir * truckM2 * truckPrice : 0);
  return totalTL / totalM2;
}

function resolveScenario(ihtiyac: number, kamyon: number, tir: number): SepetScenario {
  if (ihtiyac <= 0) return 'empty';
  if (kamyon === 0 && tir === 0) return 'ara_metraj';
  if (kamyon > 0 && tir === 0) return 'lorry_optimal';
  if (tir > 0 && kamyon === 0) return 'tir_optimal';
  if (kamyon > 0 && tir > 0) return 'large_project';
  return 'ara_metraj';
}

// ─── Sabitler ───────────────────────────────────────────────────────────────

const INITIAL_SEPET: SepetInternal = {
  kamyon: 0,
  tir: 0,
  autoApplied: false,
};

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────

export default function SepetUI({
  lorryM2,
  truckM2,
  lorryPrice,
  truckPrice,
  packageRefPrice,
  ihtiyac,
  onChange,
  vehicleCardsSlot,
}: Props) {
  // prevIhtiyac'ı state olarak tut: render sırasında ihtiyac değişimini yakalar
  // ve "setState during render" escape hatch'i ile tepki verir (effect yerine).
  // Bu, React'ın önerdiği getDerivedStateFromProps eşdeğeri: react.dev/learn/you-might-not-need-an-effect
  const [prevIhtiyac, setPrevIhtiyac] = useState<number>(-1);
  const [sepet, setSepet] = useState<SepetInternal>(INITIAL_SEPET);

  // ─── TEK KAYNAK: optimal kombinasyon memo'su ────────────────────────────
  const optimalCombo = useMemo<OptimalResult>(() => {
    if (ihtiyac <= 0 || !lorryPrice || !truckPrice) return null;
    return findOptimalCombination(ihtiyac, lorryM2, truckM2, lorryPrice, truckPrice);
  }, [ihtiyac, lorryM2, truckM2, lorryPrice, truckPrice]);

  // ─── ihtiyac değişince otomatik uygula — render sırasında (effect değil) ──
  // React'ın "store information from previous renders" escape hatch'i.
  // ESLint react-hooks/set-state-in-effect kuralını tetiklemez.
  if (prevIhtiyac !== ihtiyac) {
    setPrevIhtiyac(ihtiyac);

    if (ihtiyac <= 0) {
      setSepet(INITIAL_SEPET);
    } else if (optimalCombo) {
      setSepet({
        kamyon: optimalCombo.kamyon,
        tir: optimalCombo.tir,
        autoApplied: true,
      });
    } else {
      setSepet(INITIAL_SEPET);
    }
  }

  // ─── onChange callback'ini her state değişiminde çağır ──────────────────
  // lastSentRef: state'e gelecekte object eklense bile sonsuz döngüyü engeller.
  // useCallback(fn, []) ile stabil tutulan onChange olmazsa döngüye girer —
  // bu guard ikinci savunma hattı.
  const lastSentRef = useRef<string>("");

  useEffect(() => {
    const totalM2 = sepet.kamyon * lorryM2 + sepet.tir * truckM2;
    const effectivePrice = buildEffectivePrice(
      sepet.kamyon,
      sepet.tir,
      lorryM2,
      truckM2,
      lorryPrice,
      truckPrice
    );
    const currentScenario = resolveScenario(ihtiyac, sepet.kamyon, sepet.tir);
    const signature = `${sepet.kamyon}-${sepet.tir}-${sepet.autoApplied}-${totalM2}-${effectivePrice ?? "null"}-${currentScenario}`;
    if (lastSentRef.current === signature) return;
    lastSentRef.current = signature;
    onChange({
      kamyon: sepet.kamyon,
      tir: sepet.tir,
      autoApplied: sepet.autoApplied,
      totalM2,
      effectivePrice,
      scenario: currentScenario,
    });
  }, [sepet, ihtiyac, lorryM2, truckM2, lorryPrice, truckPrice, onChange]);

  // ─── Manuel değişim ─────────────────────────────────────────────────────
  function handleKamyon(delta: number) {
    setSepet((prev) => ({
      ...prev,
      kamyon: Math.max(0, prev.kamyon + delta),
      autoApplied: false,
    }));
  }

  function handleTir(delta: number) {
    setSepet((prev) => ({
      ...prev,
      tir: Math.max(0, prev.tir + delta),
      autoApplied: false,
    }));
  }

  function handleGeriAl() {
    if (!optimalCombo) return;
    setSepet({
      kamyon: optimalCombo.kamyon,
      tir: optimalCombo.tir,
      autoApplied: true,
    });
  }

  // ─── Türetilmiş değerler ────────────────────────────────────────────────
  const { kamyon, tir, autoApplied } = sepet;

  const totalM2 = kamyon * lorryM2 + tir * truckM2;
  const totalTL =
    (lorryPrice !== null ? kamyon * lorryM2 * lorryPrice : 0) +
    (truckPrice !== null ? tir * truckM2 * truckPrice : 0);
  const fazlaM2 = totalM2 > ihtiyac && ihtiyac > 0 ? totalM2 - ihtiyac : 0;

  const lorryAvantaj =
    packageRefPrice !== null && lorryPrice !== null ? packageRefPrice - lorryPrice : null;
  const truckAvantaj =
    packageRefPrice !== null && truckPrice !== null ? packageRefPrice - truckPrice : null;

  // Kamyon/TIR senaryosu için türetilmiş yardımcılar
  const truckLotM2 = tir * truckM2;
  const truckRoundedUp = tir > 0 && kamyon === 0 && ihtiyac > 0 && ihtiyac < truckLotM2;

  const scenario = resolveScenario(ihtiyac, kamyon, tir);

  // Manuel mod önerisi: sepet dolu ama optimal farklı
  const suggestionDiffersFromCurrent =
    !autoApplied &&
    (kamyon > 0 || tir > 0) &&
    optimalCombo !== null &&
    (optimalCombo.kamyon !== kamyon || optimalCombo.tir !== tir);

  return (
    <div className="mt-4 space-y-3" aria-label="Sepet">

      {/* ─── Tek Ana Karar Mesajı ──────────────────────────────────── */}
      <SepetScenarioMessage
        scenario={scenario}
        lorryM2={lorryM2}
        truckM2={truckM2}
        lorryPrice={lorryPrice}
        truckPrice={truckPrice}
        ihtiyac={ihtiyac}
        kamyon={kamyon}
        tir={tir}
        truckLotM2={truckLotM2}
        truckRoundedUp={truckRoundedUp}
        optimalCombo={optimalCombo}
        suggestionDiffersFromCurrent={suggestionDiffersFromCurrent}
        onGeriAl={handleGeriAl}
      />

      {/* ─── Araç Kartları (portal kullanılırsa üst grid'e taşınır) ──── */}
      {(() => {
        const cardsBlock = (
          <div>
            <SepetVehicleCards
              kamyon={kamyon}
              lorryM2={lorryM2}
              lorryPrice={lorryPrice}
              lorryAvantaj={lorryAvantaj}
              lorryRoleLabel={autoApplied && kamyon > 0 && tir === 0 ? "Önerilen" : "Hızlı Seçim"}
              onKamyonInc={() => handleKamyon(1)}
              onKamyonDec={() => handleKamyon(-1)}
              tir={tir}
              truckM2={truckM2}
              truckPrice={truckPrice}
              truckAvantaj={truckAvantaj}
              truckRoleLabel={autoApplied && tir > 0 && kamyon === 0 ? "Önerilen" : "Tam Araç"}
              onTirInc={() => handleTir(1)}
              onTirDec={() => handleTir(-1)}
              showSummary={!vehicleCardsSlot}
              totalM2={totalM2}
              totalTL={totalTL}
              fazlaM2={fazlaM2}
              layout={vehicleCardsSlot ? "vertical" : "horizontal"}
            />
          </div>
        );

        return vehicleCardsSlot ? createPortal(cardsBlock, vehicleCardsSlot) : cardsBlock;
      })()}

    </div>
  );
}
