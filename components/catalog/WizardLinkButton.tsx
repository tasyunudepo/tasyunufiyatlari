"use client";

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/lib/store/wizardStore';
import type { WizardPrefill } from '@/lib/catalog/types';

interface WizardLinkButtonProps {
  prefill: WizardPrefill | null;
  targetStep?: 1 | 2;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  icon?: ReactNode;
}

/**
 * Wizard'a pre-fill yaparak yönlendiren buton.
 * Zustand store'u doldurur ve / sayfasına gider.
 */
export default function WizardLinkButton({
  prefill,
  targetStep = 1,
  label,
  variant = 'primary',
  className = '',
  icon,
}: WizardLinkButtonProps) {
  const router = useRouter();
  const store  = useWizardStore();

  function handleClick() {
    // WizardCalculator yalnız situationPreset köprüsünü tüketir;
    // markaId/modelAdi alanlarına yazmak prefill'i sessizce kaybettirir.
    if (prefill && prefill.levhaTipi) {
      store.reset();
      store.setProductPreset({
        material: prefill.levhaTipi,
        thicknessCm: prefill.kalinlik ?? 5,
        brandName: prefill.markaAdi ?? undefined,
        modelShortName: prefill.modelAdi ?? undefined,
      });
      if (targetStep === 2 && prefill.markaId !== null) store.goToStep(2);
    }
    router.push('/');
  }

  const base    = 'inline-flex items-center justify-center gap-2 rounded-lg transition-all duration-150 cursor-pointer';
  const variant_= variant === 'primary'
    ? 'px-5 py-3 font-semibold text-sm bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white'
    : variant === 'secondary'
    ? 'px-5 py-3 font-semibold text-sm border border-fe-border hover:border-brand-500 text-fe-text hover:text-brand-400 bg-transparent'
    : 'font-normal text-fe-muted hover:text-fe-text bg-transparent';

  return (
    <button type="button" onClick={handleClick} className={`${base} ${variant_} ${className}`}>
      {icon && icon}
      {label}
    </button>
  );
}
