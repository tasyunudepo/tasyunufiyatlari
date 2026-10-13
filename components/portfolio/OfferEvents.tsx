"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  isOfferKey,
  notifyPortfolioOfferClick,
  notifyPortfolioOfferView,
} from "@/lib/analytics/portfolioOffers";
import type { OfferPlacement } from "@/lib/portfolio/offers";

interface Props {
  placement: OfferPlacement;
  children: ReactNode;
}

/**
 * İçindeki kardeş kanal bağlantılarını ölçer: blok en az %35 görününce bir
 * kez görünüm, her bağlantı tıklamasında tık olayı. Bağlantılar düz `<a>`
 * olarak kalır; dinleyici gezinmeyi engellemez.
 */
export default function OfferEvents({ placement, children }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
        "a[data-portfolio-offer]",
      );
      const offer = link?.dataset.portfolioOffer;
      if (isOfferKey(offer)) notifyPortfolioOfferClick(offer, placement);
    };
    root.addEventListener("click", onClick);

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") {
      notifyPortfolioOfferView(placement);
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35)) {
            notifyPortfolioOfferView(placement);
            observer?.disconnect();
          }
        },
        { threshold: [0.35] },
      );
      observer.observe(root);
    }

    return () => {
      root.removeEventListener("click", onClick);
      observer?.disconnect();
    };
  }, [placement]);

  return <div ref={rootRef}>{children}</div>;
}
