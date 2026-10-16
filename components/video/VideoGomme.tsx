'use client';

// Video kabı (15 Ekim 2026, Animasyon/numuneler/yayin/video-gomme'den). Davranış lib/video/video-gomme.js'te,
// olaylar lib/analytics/videoEvents.ts köprüsünden çıkar (video_start / progress / complete / cta_click; dönüşüm değil).
// İşaretleme sunucuda üretilir (poster ve yer tutma JS'siz çalışır); davranış useEffect'te bağlanır.
// Çağrı öğesi: sayfanın herhangi bir yerinde data-vg-cta="<id>" taşıyan bağlantı (video_cta_click).
// Kullanım yerleri: StandardPlatePurchaseExperience (S4, SW035 5/8/10 cm), HomePageClient (S2A).

import { useEffect, useRef } from 'react';
import { mount } from '@/lib/video/video-gomme.js';
import { trackVideo } from '@/lib/analytics/videoEvents';

type Kaynak = { variant: string; w: number; h: number; poster: string; webm?: string; mp4: string };

type Props = {
  id: string;
  mod: 'loop' | 'click';
  sayfa: string;
  etiket: string;
  masaustu: Kaynak;
  mobil?: Kaynak;
  kirilim?: string;
  oncelik?: boolean;
  className?: string;
};

export default function VideoGomme({
  id, mod, sayfa, etiket, masaustu, mobil, kirilim = '(max-width: 768px)', oncelik = false, className,
}: Props) {
  const kap = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!kap.current) return;
    const d = mount(kap.current, { track: trackVideo });
    return () => d?.destroy();
  }, []);

  const dongu = mod === 'loop';
  return (
    <figure
      ref={kap}
      className={['vg', className].filter(Boolean).join(' ')}
      data-vg={id}
      data-vg-mode={mod}
      data-vg-page={sayfa}
      style={{ position: 'relative', margin: 0, overflow: 'hidden' }}
    >
      <picture>
        {mobil && <source media={kirilim} srcSet={mobil.poster} width={mobil.w} height={mobil.h} />}
        <img
          src={masaustu.poster}
          width={masaustu.w}
          height={masaustu.h}
          alt=""
          loading={oncelik ? 'eager' : 'lazy'}
          decoding="async"
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </picture>
      <video
        muted
        playsInline
        preload="none"
        loop={dongu}
        controls={!dongu}
        aria-label={etiket}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      >
        {mobil?.webm && <source media={kirilim} src={mobil.webm} type="video/webm" data-variant={mobil.variant} />}
        {mobil && <source media={kirilim} src={mobil.mp4} type="video/mp4" data-variant={mobil.variant} />}
        {masaustu.webm && <source src={masaustu.webm} type="video/webm" data-variant={masaustu.variant} />}
        <source src={masaustu.mp4} type="video/mp4" data-variant={masaustu.variant} />
      </video>
      <button type="button" className="vg-btn" data-vg-btn hidden aria-label="Videoyu oynat" />
    </figure>
  );
}
