'use client';

import { useRouter } from 'next/navigation';
import {
  Thermometer,
  SpeakerSimpleHigh,
  House,
  Question,
} from '@phosphor-icons/react/dist/ssr';
import type { ComponentType, SVGProps } from 'react';
import { ICON_WEIGHT } from '@/lib/design/tokens';
import { notifySituationSelected, type SituationKey } from '@/lib/notifyWizardEvent';
import { useWizardStore, type SituationPresetKey } from '@/lib/store/wizardStore';

type IconType = ComponentType<{
  size?: number | string;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'duotone' | 'fill';
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
} & SVGProps<SVGSVGElement>>;

type Situation = {
  key: SituationKey;
  Icon: IconType;
  label: string;
  helper: string;
  // '#' ile başlıyorsa scrollIntoView, başka her şey için router.push
  scrollTarget: string;
};

const SITUATIONS: Situation[] = [
  {
    key: 'isi_yalitimi',
    Icon: Thermometer as IconType,
    label: 'Isı kaybını düşürmek istiyorum',
    helper: 'Doğalgaz/elektrik faturası hedefse — sistem önerelim.',
    scrollTarget: '#mantolama-hesaplayici',
  },
  {
    key: 'ses_yalitimi',
    Icon: SpeakerSimpleHigh as IconType,
    label: 'Ses yalıtımı benim için önemli',
    helper: 'Komşu, sokak veya iş yeri gürültüsü için yoğunluk farkı kritik.',
    scrollTarget: '#mantolama-hesaplayici',
  },
  {
    key: 'cati_yalitimi',
    Icon: House as IconType,
    label: 'Çatı/teras için doğru çözümü arıyorum',
    helper: 'Üst kat için VF80 toz grubu ürünümüze yönlendirelim.',
    scrollTarget: '/urunler/tasyunu-levha/expert-vf80-tasyunu/8-cm',
  },
  {
    key: 'emin_degilim',
    Icon: Question as IconType,
    label: 'Kararsızım, birlikte seçelim',
    helper: 'Sahanızı paylaşın, doğru paketi sizin için biz belirleyelim.',
    scrollTarget: '/iletisim',
  },
];

// Niyet → wizard preset eşleşmesi olan kartlar.
// cati_yalitimi ve emin_degilim wizard'a girmez — doğrudan başka URL'lere gider.
const PRESET_KEYS = new Set<SituationKey>(['isi_yalitimi', 'ses_yalitimi']);

export function SituationSelector() {
  const router = useRouter();
  const setSituationPreset = useWizardStore((state) => state.setSituationPreset);

  const onSelect = (s: Situation) => {
    notifySituationSelected({ situationKey: s.key, situationLabel: s.label });

    // Wizard preset (4. kart "emin_degilim" iletişime gider, preset yok)
    if (PRESET_KEYS.has(s.key)) {
      setSituationPreset(s.key as SituationPresetKey);
    }

    if (s.scrollTarget.startsWith('#')) {
      const el = document.querySelector(s.scrollTarget);
      if (el instanceof HTMLElement) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      router.push(s.scrollTarget);
    }
  };

  return (
    <section
      aria-labelledby="situation-baslik"
      className="bg-fe-bg pt-10 pb-12 sm:pt-12 sm:pb-16"
    >
      <div className="max-w-[1100px] mx-auto px-4">
        <div className="text-center max-w-[640px] mx-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Önce Niyetinizi Söyleyin
          </p>
          <h2
            id="situation-baslik"
            className="mt-2 font-heading font-extrabold text-[28px] sm:text-[36px] leading-[1.15] tracking-tight text-fe-text"
          >
            Hangi sorun için araştırıyorsunuz?
          </h2>
          <p className="mt-2 text-sm text-fe-muted leading-relaxed">
            Seçiminiz hesaplayıcıyı doğru yönlendirir.
          </p>
        </div>
        <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {SITUATIONS.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                className="group h-full w-full text-left rounded-2xl border border-fe-border/50 bg-fe-raised/40 p-4 sm:p-5 transition hover:border-brand/60 hover:bg-fe-raised/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 flex items-start gap-3.5 sm:block"
              >
                <s.Icon
                  size={26}
                  weight={ICON_WEIGHT}
                  className="text-brand shrink-0 mt-0.5 sm:mt-0 sm:mb-0"
                  aria-hidden
                />
                <div className="flex-1 min-w-0 sm:mt-4">
                  <p className="text-[15px] sm:text-base font-semibold text-fe-text leading-snug">{s.label}</p>
                  <p className="mt-1 sm:mt-1.5 text-xs text-fe-muted leading-relaxed">{s.helper}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
