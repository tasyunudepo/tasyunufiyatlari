// /urunler hub üst trust strip — SİYAH zemin (sayfanın üst kenarı).
// Sayfa siyah çerçeve içinde krem içerik mantığı.

import Link from 'next/link';

export default function TrustStrip() {
  return (
    <div className="bg-hub-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[11.5px]">
        <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-hub-warm">
          <span><span className="text-hub-gold-soft font-medium">Fabrika çıkışlı</span> satış</span>
          <span className="text-hub-warm/30">·</span>
          <span>Tam araç ve uygun EPS seti</span>
          <span className="text-hub-warm/30">·</span>
          <span>Bölgeye göre iskonto</span>
          <span className="text-hub-warm/30">·</span>
          <span>KDV hariç</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/#mantolama-hesaplayici"
            prefetch={false}
            className="text-hub-gold-soft font-medium hover:underline"
          >
            1 TIR istiyorum →
          </Link>
        </div>
      </div>
    </div>
  );
}
