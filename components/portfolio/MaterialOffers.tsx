import Image from "next/image";
import OfferEvents from "@/components/portfolio/OfferEvents";
import {
  MATERIAL_OFFER_KEYS,
  PORTFOLIO_OFFERS,
  offerHref,
  type OfferPlacement,
} from "@/lib/portfolio/offers";

// "Alçı ve alçıpan da lazım mı?" bloğu.
//
// Ürün sayfasında sunucu HTML'inde durur (Google bağlantıları görür) ve
// ana teklif eyleminden bir kademe sakin çizilir. Hesap sonucu ve teklif
// teslimi gibi müşterinin fiyatı gördüğü ya da teklifini aldığı yüzeylerde
// dolu düğmeyle, en görünür haliyle çizilir (yuvarlak masa, 13 Ekim 2026).

type Tone = "warm" | "dark";
type Emphasis = "calm" | "strong";

interface Props {
  placement: OfferPlacement;
  tone: Tone;
  emphasis: Emphasis;
  /** Dar yüzeyde (teslim kartı) görsel ve boşluklar küçülür. */
  compact?: boolean;
}

const IMAGES: Record<(typeof MATERIAL_OFFER_KEYS)[number], { src: string; alt: string; width: number; height: number }> = {
  alci: { src: "/portfolio/alcitek-toro.webp", alt: "Alçıtek Toro makine sıva alçısı 35 kg torba", width: 400, height: 526 },
  alcipan: { src: "/portfolio/corex-beyaz.webp", alt: "Dalsan Beyaz COREX alçı levha paleti", width: 800, height: 854 },
};

const INTRO: Partial<Record<OfferPlacement, string>> = {
  pdp: "Projenizin iç mekân malzemelerini de fiyatlandırın.",
  hesap_sonucu: "Aynı projenin iç mekân malzemelerine de fiyat alın.",
  teklif_teslim: "Aynı projenin iç mekân malzemelerine de fiyat alın.",
};

const TONES: Record<Tone, {
  heading: string;
  intro: string;
  rule: string;
  card: string;
  title: string;
  product: string;
  amount: string;
  meta: string;
  domain: string;
  calm: string;
  strong: string;
}> = {
  warm: {
    heading: "text-hub-ink",
    intro: "text-hub-ink-2",
    rule: "bg-hub-gold-soft",
    card: "border-hub-rule bg-white",
    title: "text-hub-ink",
    product: "text-hub-ink-2",
    amount: "text-hub-ink",
    meta: "text-hub-muted",
    domain: "text-hub-muted",
    calm: "border border-hub-ink text-hub-ink hover:bg-hub-ink hover:text-hub-cream",
    strong: "bg-hub-gold-soft text-hub-ink hover:bg-hub-gold hover:text-white",
  },
  dark: {
    heading: "text-white",
    intro: "text-white/70",
    rule: "bg-[#e5cc8d]",
    card: "border-white/12 bg-white/[0.05]",
    title: "text-white",
    product: "text-white/75",
    amount: "text-white",
    meta: "text-white/55",
    domain: "text-white/55",
    calm: "border border-white/40 text-white hover:bg-white hover:text-[#171711]",
    strong: "bg-[#e5cc8d] text-[#171711] hover:bg-[#f2dda7]",
  },
};

/** Tutar ile para birimi dar ekranda ayrı satıra düşmesin. */
function keepCurrencyTogether(text: string): string {
  return text.replace(/ ₺/gu, "\u00a0₺");
}

function OfferCard({
  offerKey,
  placement,
  tone,
  emphasis,
  compact,
}: {
  offerKey: (typeof MATERIAL_OFFER_KEYS)[number];
  placement: OfferPlacement;
  tone: Tone;
  emphasis: Emphasis;
  compact: boolean;
}) {
  const offer = PORTFOLIO_OFFERS[offerKey];
  const image = IMAGES[offerKey];
  const t = TONES[tone];
  const price = offer.price;

  return (
    <div className={`flex rounded-2xl border ${t.card} ${compact ? "gap-3 p-3" : "gap-4 p-4 sm:p-5"}`}>
      <div className={`flex shrink-0 items-center justify-center rounded-xl bg-white ${compact ? "h-16 w-14 p-1" : "h-24 w-[4.5rem] p-1.5 sm:h-28 sm:w-24"}`}>
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes={compact ? "56px" : "96px"}
          className="h-full w-full object-contain"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className={`font-heading font-bold tracking-tight ${t.title} ${compact ? "text-base" : "text-xl"}`}>
          {offer.title}
        </p>

        {price && (
          <>
            <p className={`mt-0.5 leading-snug ${t.product} ${compact ? "text-xs" : "text-sm"}`}>{price.product}</p>
            <p className={`font-heading font-extrabold tabular-nums ${t.amount} ${compact ? "mt-1 text-lg" : "mt-2 text-2xl"}`}>
              {keepCurrencyTogether(price.amount)}
            </p>
            {price.vehicle && (
              <p className={`font-semibold tabular-nums ${t.product} ${compact ? "text-xs" : "text-sm"}`}>
                {keepCurrencyTogether(price.vehicle)}
              </p>
            )}
            <p className={`mt-1 text-xs leading-snug ${t.meta}`}>
              {price.terms} · Liste tarihi {price.listDate}
            </p>
          </>
        )}

        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${compact ? "mt-2.5" : "mt-4"}`}>
          <a
            href={offerHref(offerKey, placement)}
            target="_blank"
            rel="noopener"
            data-portfolio-offer={offerKey}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors ${compact ? "min-h-10" : "min-h-11"} ${emphasis === "strong" ? t.strong : t.calm}`}
          >
            {offer.cta}
            <span aria-hidden="true">→</span>
          </a>
          <span className={`text-xs ${t.domain}`}>{offer.domainLabel}</span>
        </div>
      </div>
    </div>
  );
}

export default function MaterialOffers({ placement, tone, emphasis, compact = false }: Props) {
  const t = TONES[tone];
  const headingId = `material-offers-${placement}`;
  const intro = INTRO[placement];

  return (
    <OfferEvents placement={placement}>
      <section aria-labelledby={headingId} data-testid={headingId}>
        <span className={`block h-1 w-12 rounded-full ${t.rule}`} aria-hidden="true" />
        <h2
          id={headingId}
          className={`font-heading font-bold tracking-tight ${t.heading} ${compact ? "mt-3 text-lg" : "mt-4 text-2xl sm:text-3xl"}`}
        >
          Alçı ve alçıpan da lazım mı?
        </h2>
        {intro && (
          <p className={`${t.intro} ${compact ? "mt-1 text-sm" : "mt-2 text-base"}`}>{intro}</p>
        )}

        <div className={`grid grid-cols-1 ${compact ? "mt-3 gap-2.5" : "mt-6 gap-4 md:grid-cols-2"}`}>
          {MATERIAL_OFFER_KEYS.map((key) => (
            <OfferCard
              key={key}
              offerKey={key}
              placement={placement}
              tone={tone}
              emphasis={emphasis}
              compact={compact}
            />
          ))}
        </div>
      </section>
    </OfferEvents>
  );
}
