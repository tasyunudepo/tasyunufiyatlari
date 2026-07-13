'use client';

// Next.js App Router client-side navigation gtag.js'in otomatik pageview
// mekanizmasını tetiklemez. Bu komponent route değişikliklerini dinler;
// query/hash ve tam href'i GA4'e taşımadan tekil page_view eventi atar.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { emitDeduplicatedPageView } from '@/lib/analytics/pageview';

interface Props {
  measurementId: string;
}

type GtagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

function Tracker({ measurementId }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as GtagWindow;
    if (typeof w.gtag !== 'function') return;

    emitDeduplicatedPageView({
      gtag: w.gtag,
      pathname,
      origin: window.location.origin,
      title: document.title,
      measurementId,
    });
  }, [pathname, measurementId]);

  return null;
}

export default function GAPageviewTracker(props: Props) {
  return <Tracker {...props} />;
}
