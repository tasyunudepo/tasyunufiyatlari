import OfferEvents from "@/components/portfolio/OfferEvents";
import {
  PORTFOLIO_OFFERS,
  SALES_CHANNEL_KEYS,
  offerHref,
} from "@/lib/portfolio/offers";

// ÖzerGrup'un diğer malzeme satış kanalları. Statik yüzeydir: bağlantılar
// sunucu HTML'inde temiz adresle durur. Kiralık Jeneratör ayrı bir
// işletme olduğu için bu listede yer almaz.

interface Props {
  placement: "anasayfa" | "hakkimizda";
  /** `line`: tek satır bağlantı dizisi. `list`: her kanal kendi cümlesiyle. */
  variant: "line" | "list";
}

const linkClass =
  "font-semibold text-hub-gold underline underline-offset-2 transition-colors hover:text-hub-ink";

export default function SalesChannels({ placement, variant }: Props) {
  const channels = SALES_CHANNEL_KEYS.map((key) => PORTFOLIO_OFFERS[key]);

  if (variant === "line") {
    return (
      <OfferEvents placement={placement}>
        <p className="text-sm leading-7 text-hub-ink-2" data-testid={`sales-channels-${placement}`}>
          <span className="font-semibold text-hub-ink">ÖzerGrup&rsquo;un diğer satış kanalları:</span>{" "}
          {channels.map((channel, index) => (
            <span key={channel.key}>
              <a
                href={offerHref(channel.key, placement)}
                target="_blank"
                rel="noopener"
                data-portfolio-offer={channel.key}
                className={linkClass}
              >
                {channel.channelAnchor}
              </a>
              {index < channels.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>
      </OfferEvents>
    );
  }

  return (
    <OfferEvents placement={placement}>
      <ul className="divide-y divide-hub-rule border-y border-hub-rule" data-testid={`sales-channels-${placement}`}>
        {channels.map((channel) => (
          <li key={channel.key} className="flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:gap-6">
            <a
              href={offerHref(channel.key, placement)}
              target="_blank"
              rel="noopener"
              data-portfolio-offer={channel.key}
              className={`${linkClass} shrink-0 text-lg sm:w-64`}
            >
              {channel.channelAnchor}
            </a>
            <span className="text-base leading-relaxed text-hub-ink-2">
              {channel.channelLine}{" "}
              <span className="text-hub-muted">{channel.domainLabel}</span>
            </span>
          </li>
        ))}
      </ul>
    </OfferEvents>
  );
}
