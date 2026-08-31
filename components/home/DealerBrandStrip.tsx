import Image from 'next/image';

interface DealerBrand {
  name: string;
  src: string;
  width: number;
  height: number;
  /** Kare/dikey logolar aynı pikselde optik olarak küçük durduğu için birkaç piksel yükseltilir. */
  heightClass: string;
}

// Kaynak logoların tuval içi boşlukları farklı olduğu için şeritte kırpılmış
// kopyalar kullanılır; böylece hepsi aynı optik yükseklikte durur.
const DEALER_BRANDS: readonly DealerBrand[] = [
  { name: 'Bonus', src: '/images/markalogolar/bonus-logo-red.svg', width: 307, height: 118, heightClass: 'h-[18px]' },
  { name: 'Fawori', src: '/images/markalogolar/strip/fawori.webp', width: 71, height: 71, heightClass: 'h-5' },
  { name: 'Dalmaçyalı', src: '/images/markalogolar/strip/dalmacyali.webp', width: 180, height: 64, heightClass: 'h-[18px]' },
  { name: 'TEKNO', src: '/images/markalogolar/strip/tekno.webp', width: 179, height: 48, heightClass: 'h-[18px]' },
  { name: 'Filli Boya', src: '/images/markalogolar/strip/filli-boya.webp', width: 130, height: 87, heightClass: 'h-[22px]' },
];

export default function DealerBrandStrip() {
  return (
    <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="text-[9px] font-bold uppercase leading-3 tracking-[0.12em] text-[#7d7768]">
        Bayilikler
      </span>
      <span
        className="flex flex-wrap items-center gap-1.5"
        role="img"
        aria-label={`Bayisi olduğumuz markalar: ${DEALER_BRANDS.map(brand => brand.name).join(', ')}`}
      >
        {DEALER_BRANDS.map(brand => (
          <span
            key={brand.name}
            className="flex h-8 items-center rounded-md bg-[#fffdf8] px-2 ring-1 ring-black/10"
          >
            <Image
              src={brand.src}
              alt=""
              width={brand.width}
              height={brand.height}
              className={`${brand.heightClass} w-auto object-contain`}
            />
          </span>
        ))}
      </span>
    </div>
  );
}
