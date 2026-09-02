"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  notifyProductDetailSectionView,
} from "@/lib/notifyWizardEvent";
import type { PdpMeasuredSection } from "@/lib/analytics/pdpJourney";
import { useProductInteractive } from "./ProductInteractiveContext";

interface Props {
  children: ReactNode;
  sectionName: PdpMeasuredSection;
  productName: string;
  brandName: string;
  productSlug: string;
}

export default function ProductSectionTracker({
  children,
  sectionName,
  productName,
  brandName,
  productSlug,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const firedRef = useRef(false);
  const interactive = useProductInteractive();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || firedRef.current) return;

    const reveal = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      interactive.markSectionSeen(sectionName);
      notifyProductDetailSectionView({
        product_name: productName,
        brand_name: brandName,
        product_slug: productSlug,
        result_session_id: interactive.resultSessionId,
        section_name: sectionName,
        ...interactive.getMeasurementSnapshot(),
      });
    };

    if (typeof IntersectionObserver === 'undefined') {
      reveal();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35)) {
        reveal();
        observer.disconnect();
      }
    }, { threshold: [0.35] });
    observer.observe(root);
    return () => observer.disconnect();
  }, [brandName, interactive, productName, productSlug, sectionName]);

  return <div ref={rootRef}>{children}</div>;
}
