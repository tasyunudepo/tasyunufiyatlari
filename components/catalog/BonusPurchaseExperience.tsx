import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  Flame,
  MapPin,
  Ruler,
  ShieldCheck,
  Truck,
} from "lucide-react";
import type { CatalogProductView } from "@/lib/catalog/types";
import {
  APPLICATION_SCOPE_LABELS,
  densitySourceLabel,
  getProfileByModel,
} from "@/lib/technical-profiles";
import { WAREHOUSE_INFO } from "@/lib/business/info";
import ProductImage from "./ProductImage";
import BonusPurchaseDesk, { type BonusPurchaseShippingZone } from "./BonusPurchaseDesk";
import ProductSectionTracker from "./ProductSectionTracker";

interface BonusPurchaseExperienceProps {
  product: CatalogProductView;
  shippingZones: BonusPurchaseShippingZone[];
}

const CATALOG_BRANDS = [
  {
    name: "Bonus",
    src: "/images/markalogolar/bonus-logo-red.svg",
    width: 132,
    height: 50,
  },
  {
    name: "Fawori",
    src: "/images/markalogolar/fawori-taşyünü- fiyatları.webp",
    width: 112,
    height: 34,
  },
  {
    name: "Filli Boya",
    src: "/images/markalogolar/filli-boya-mantolama.webp",
    width: 126,
    height: 34,
  },
  {
    name: "Dalmaçyalı",
    src: "/images/markalogolar/dalmaçyalı-taşyünü- fiyatları.webp",
    width: 136,
    height: 34,
  },
] as const;

export default function BonusPurchaseExperience({
  product,
  shippingZones,
}: BonusPurchaseExperienceProps) {
  const profile = product.model ? getProfileByModel(product.model) : null;
  const displayTitle = profile?.displayName ?? product.name;
  const productTypeLabel = displayTitle !== product.name
    ? product.name.replace(displayTitle, '').trim() || 'Taşyünü Isı Yalıtım Levhası'
    : product.category.name;
  const thicknessOptions = product.thickness_options ?? [];
  const thicknessRange = thicknessOptions.length
    ? `${Math.min(...thicknessOptions)}–${Math.max(...thicknessOptions)} cm`
    : "Kalınlık seçeneği";

  const specs = [
    profile?.density
      ? {
          Icon: ShieldCheck,
          value: profile.density.display,
          note: densitySourceLabel(profile),
        }
      : null,
    profile
      ? {
          Icon: Flame,
          value: `${profile.fireClass} sınıfı`,
          note: "Yangına tepki sınıfı",
        }
      : null,
    {
      Icon: Ruler,
      value: thicknessRange,
      note: `${thicknessOptions.length} kalınlık seçeneği`,
    },
    profile
      ? {
          Icon: Building2,
          value: APPLICATION_SCOPE_LABELS[profile.applicationScope],
          note: "Kullanım alanı",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <main className="flex-1 bg-hub-warm text-hub-ink">
      <div className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <section
          aria-labelledby="bonus-product-title"
          data-testid="pdp-purchase-summary"
          className="overflow-hidden rounded-[14px] border border-[#d8d0bf] bg-white shadow-[0_20px_46px_rgba(39,31,17,0.15)]"
        >
          <div className="grid xl:grid-cols-[0.8fr_1.12fr_1.38fr]">
            <article data-testid="pdp-product-identity" className="flex min-w-0 flex-col border-b border-[#ded7c8] bg-[#fffaf0] p-5 sm:p-7 xl:min-h-[590px] xl:border-b-0 xl:border-r">
              <Image
                src="/images/markalogolar/bonus-logo-red.svg"
                alt="Bonus"
                width={142}
                height={55}
                className="h-12 w-auto self-start object-contain object-left"
              />

              <div className="mt-7 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#a98336]/25 bg-[#a98336]/8 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#74551d]">
                  Direkt alım
                </span>
                <span className="rounded-full border border-[#d8d0bf] bg-white px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#665f53]">
                  {product.category.name}
                </span>
              </div>

              <h1
                id="bonus-product-title"
                className="mt-4 max-w-[13ch] text-balance font-heading text-[2.2rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-[#17140f] sm:text-[2.65rem]"
              >
                {displayTitle}
              </h1>
              <p className="mt-3 text-base font-medium leading-6 text-[#6d6558]">
                {productTypeLabel}
              </p>

              <ul className="mt-7 grid gap-3 border-t border-[#ded7c8] pt-6 sm:grid-cols-2 xl:grid-cols-1">
                {specs.map(({ Icon, value, note }) => (
                  <li key={`${value}-${note}`} className="grid grid-cols-[20px_1fr] gap-2.5">
                    <Icon aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] text-[#8a6727]" />
                    <span className="min-w-0">
                      <strong className="block text-[13px] font-bold leading-5 text-[#262119]">
                        {value}
                      </strong>
                      <span className="block text-[11px] leading-4 text-[#756d60]">{note}</span>
                    </span>
                  </li>
                ))}
              </ul>

              {profile && (
                <section
                  aria-labelledby="technical-decision-title"
                  className="mt-6 border-t border-[#ded7c8] pt-5"
                >
                  <h2
                    id="technical-decision-title"
                    className="font-heading text-sm font-bold tracking-[-0.015em] text-[#2b251c]"
                  >
                    Teknik karar özeti
                  </h2>
                  <dl className="mt-3 divide-y divide-[#e6dfd2] text-[11px] leading-4">
                    <div className="grid grid-cols-[92px_1fr] gap-3 py-2 first:pt-0">
                      <dt className="font-medium text-[#756d60]">Isı iletkenliği</dt>
                      <dd className="min-w-0 font-semibold text-[#332c22]">{profile.lambdaDisplay}</dd>
                    </div>
                    <div className="grid grid-cols-[92px_1fr] gap-3 py-2">
                      <dt className="font-medium text-[#756d60]">Çekme dayanımı</dt>
                      <dd className="min-w-0 font-semibold text-[#332c22]">{profile.tensileDisplay}</dd>
                    </div>
                    <div className="grid grid-cols-[92px_1fr] gap-3 py-2 last:pb-0">
                      <dt className="font-medium text-[#756d60]">Basma dayanımı</dt>
                      <dd className="min-w-0 font-semibold text-[#332c22]">{profile.compressiveDisplay}</dd>
                    </div>
                  </dl>
                </section>
              )}
            </article>

            <figure data-testid="pdp-product-visual" className="relative min-h-[280px] overflow-hidden border-b border-[#ded7c8] bg-[radial-gradient(circle_at_50%_45%,#fff_0%,#f7f0e2_48%,#eee4d2_100%)] sm:min-h-[400px] xl:min-h-[590px] xl:border-b-0 xl:border-r">
              <div className="absolute inset-x-5 top-5 z-10 flex items-center justify-between font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-[#70685a]">
                <span>Ürün numunesi</span>
                <span>{product.model}</span>
              </div>
              <div className="absolute inset-x-5 bottom-14 top-11">
                <ProductImage
                  src={product.image_cover}
                  alt={product.name}
                  priority
                  className="h-full w-full"
                />
              </div>
              <figcaption className="absolute inset-x-5 bottom-4 flex items-end justify-between gap-4 border-t border-[#d8d0bf] pt-3 text-[11px] text-[#756d60]">
                <span>
                  <strong className="block text-[13px] text-[#2c261d]">{product.model}</strong>
                  Gerçek ürün görseli
                </span>
                {profile?.density && (
                  <span className="font-mono font-semibold text-[#7d5d20]">
                    {profile.density.display}
                  </span>
                )}
              </figcaption>
            </figure>

            <BonusPurchaseDesk product={product} shippingZones={shippingZones} />
          </div>

          <ProductSectionTracker sectionName="seller_payment_process" productName={product.name} brandName={product.brand.name} productSlug={product.slug}>
          <div aria-label="Sipariş ve satış güvenceleri" className="grid border-t border-[#ded7c8] bg-[#fffdf8] lg:grid-cols-[1.08fr_1.92fr]">
            <div className="flex items-start gap-3 border-b border-[#ded7c8] bg-[#faf6ed] px-5 py-5 sm:px-7 lg:border-b-0 lg:border-r">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#7d5d20]" />
              <div>
                <h2 className="font-heading text-base font-bold tracking-[-0.015em] text-[#211c15]">
                  Bonus ürünü, ÖzerGrup satışı
                </h2>
                <p className="mt-1 max-w-[48ch] text-xs leading-5 text-[#6d6558]">
                  Sipariş görüşmesi Bonus yetkili bayisi ÖzerGrup üzerinden ilerler.
                </p>
              </div>
            </div>

            <ul className="grid sm:grid-cols-3">
              {[
                {
                  Icon: Banknote,
                  title: "KDV hariç fiyat",
                  body: "Birim fiyat ve toplam tutar ayrı ayrı gösterilir.",
                },
                {
                  Icon: Truck,
                  title: "Koşullu nakliye",
                  body: "Geçerli tam araç planında nakliye fiyata dahildir.",
                },
                {
                  Icon: CreditCard,
                  title: "Tek seferde ödeme",
                  body: "Kredi kartı veya banka havalesi; sipariş onayında alınır.",
                },
              ].map(({ Icon, title, body }, index) => (
                <li
                  key={title}
                  className={`grid min-h-[104px] grid-cols-[22px_1fr] gap-3 px-5 py-5 ${
                    index < 2 ? "border-b border-[#ded7c8] sm:border-b-0 sm:border-r" : ""
                  }`}
                >
                  <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 text-[#7d5d20]" />
                  <span>
                    <strong className="block text-xs font-bold text-[#2b251c]">{title}</strong>
                    <span className="mt-1 block text-[11px] leading-4 text-[#746c60]">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          </ProductSectionTracker>
        </section>

        <section className="mt-5 overflow-hidden rounded-[14px] bg-[#171612] text-white shadow-[0_20px_46px_rgba(39,31,17,0.15)]">
          <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
            <div className="relative min-h-[270px] lg:min-h-[390px]">
              <Image
                src="/video/ozer-grup-depo-hero-poster.webp"
                alt="ÖzerGrup depo ve yükleme operasyonu"
                fill
                sizes="(max-width: 1024px) 100vw, 46vw"
                className="object-cover"
              />
              <span className="absolute bottom-4 left-4 rounded-md border border-white/20 bg-black/55 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                Gerçek operasyon görüntüsü
              </span>
            </div>
            <div className="flex flex-col justify-center px-5 py-9 sm:px-9 sm:py-12 lg:px-12">
              <h2 className="max-w-[620px] font-heading text-3xl font-bold leading-tight tracking-[-0.025em] sm:text-4xl">
                Sipariş planının arkasında gerçek depo ve yükleme operasyonu var.
              </h2>
              <p className="mt-4 max-w-[620px] text-sm leading-7 text-[#c8c0b3] sm:text-base">
                Sipariş görüşmesi ürün, teslim bölgesi ve tam araç planıyla başlar. Üretim uygunluğu ile sevkiyat ayrıntıları satış ekibi tarafından teyit edilir.
              </p>
              <div className="mt-6 flex items-start gap-3 border-t border-white/10 pt-5">
                <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#d8b668]" />
                <div>
                  <p className="text-sm font-bold text-white">{WAREHOUSE_INFO.name}</p>
                  <p className="mt-1 text-xs leading-5 text-[#b8b0a4]">
                    {WAREHOUSE_INFO.addressLine} · {WAREHOUSE_INFO.cityLine}
                  </p>
                </div>
              </div>
              <Link
                href="/depomuz"
                prefetch={false}
                className="mt-6 inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-[8px] border border-[#6d6048] px-4 text-sm font-bold text-[#f2e8d5] transition-colors hover:border-[#e7c77d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#171612]"
              >
                Depo ve sevkiyat kanıtını incele
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <ProductSectionTracker sectionName="technical" productName={product.name} brandName={product.brand.name} productSlug={product.slug}>
        <section className="mt-5 overflow-hidden rounded-[14px] border border-[#d8d0bf] bg-white shadow-[0_10px_28px_rgba(39,31,17,0.07)]">
          <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h2 className="font-heading text-2xl font-bold tracking-[-0.025em] text-[#1c1812]">
                Teknik ürün bilgisi ve mantolama karşılaştırması
              </h2>
              <p className="mt-3 max-w-[68ch] text-sm leading-6 text-[#665f53]">
                {profile?.editorial?.summary ?? product.catalog_description ?? `${product.name} için ürün, kalınlık ve teslim koşullarını birlikte değerlendirin.`}
              </p>
              {profile?.editorial?.highlights && (
                <ul className="mt-4 grid gap-2 text-sm leading-6 text-[#665f53] sm:grid-cols-2">
                  {profile.editorial.highlights.map((item) => (
                    <li key={item} className="grid grid-cols-[8px_1fr] gap-2">
                      <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 rounded-full bg-[#9a762f]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col justify-center gap-3 lg:items-end">
              <Link
                href="/tasyunu-karsilastir?entry=pdp"
                prefetch={false}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-[#7d5d20] px-5 text-sm font-extrabold text-[#604615] transition-colors hover:bg-[#faf6ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7d5d20] focus-visible:ring-offset-2 sm:w-auto"
              >
                Diğer taşyünü levhalarla karşılaştır
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <a
                href="#siparis-masasi"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] px-4 text-sm font-bold text-[#7d5d20] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7d5d20] focus-visible:ring-offset-2 sm:w-auto"
              >
                Sipariş masasına dön
                <ArrowRight aria-hidden="true" className="h-4 w-4 -rotate-90" />
              </a>
            </div>
          </div>

          <div className="grid gap-5 border-t border-[#ded7c8] bg-[#faf6ed] px-5 py-5 sm:px-7 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
            <div>
              <h3 className="font-heading text-base font-bold tracking-[-0.015em] text-[#211c15]">
                Karşılaştırmada yer alan markalar
              </h3>
              <p className="mt-1 max-w-[52ch] text-xs leading-5 text-[#6d6558]">
                Bu sayfadaki ürün Bonus markalıdır. Diğer logolar, fiyatı karşılaştırılan ürün ailelerini bilgi amacıyla gösterir.
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATALOG_BRANDS.map((brand) => (
                <li
                  key={brand.name}
                  className="flex min-h-[62px] items-center justify-center rounded-[10px] border border-[#ded7c8] bg-white px-3"
                >
                  <Image
                    src={brand.src}
                    alt={brand.name}
                    width={brand.width}
                    height={brand.height}
                    className="max-h-8 w-auto max-w-full object-contain"
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
        </ProductSectionTracker>
      </div>
    </main>
  );
}
