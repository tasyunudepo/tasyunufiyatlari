"use client";

import { useEffect, useRef } from "react";
import { useWizardStore } from "@/lib/store/wizardStore";
import {
  notifyBonusChallengeShown,
  notifyBonusChallengePicked,
} from "@/lib/notifyWizardEvent";

// ============================================================
// Ana sayfa Bonus giriş kapısı (Sprint 1.5)
//
// Rakam/oran iddiası İÇERMEZ — fark ancak hesabın içinde, gerçek
// sonuçtan gösterilir. Buton hesaplayıcıyı Bonus seçili açar
// (situationPreset köprüsü — PDP prefill hattının aynısı).
// ============================================================

export default function BonusChallengeBanner() {
  const shownFired = useRef(false);

  useEffect(() => {
    if (shownFired.current) return;
    shownFired.current = true;
    notifyBonusChallengeShown({ surface: "anasayfa" });
  }, []);

  function handleClick() {
    notifyBonusChallengePicked({ surface: "anasayfa", bonus_model: "F 150" });
    const store = useWizardStore.getState();
    store.reset();
    store.setProductPreset({
      material: "tasyunu",
      thicknessCm: 5,
      brandName: "Bonus",
      modelShortName: "F 150",
    });
    document
      .getElementById("mantolama-hesaplayici")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="border-y border-brand-500/25 bg-brand-950/25">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-3 px-4 py-3.5 sm:flex-row">
        <p className="text-center text-sm text-fe-text sm:text-left">
          <span className="font-semibold text-white">Filli grubu fiyatına mı bakıyorsunuz?</span>{" "}
          Aynı şehir ve kalınlık koşullarında Bonus&apos;u görmeden karar vermeyin.
        </p>
        <button
          type="button"
          onClick={handleClick}
          className="shrink-0 cursor-pointer rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-[#1a0f08] transition-colors hover:bg-brand-400"
        >
          Bonus fiyatını gör →
        </button>
      </div>
    </div>
  );
}
