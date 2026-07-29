import { ShieldCheck } from '@phosphor-icons/react/dist/ssr';
import { ICON_WEIGHT } from '@/lib/design/tokens';

const ITEMS = [
  {
    n: '01',
    mistake: 'Kalınlığı sadece ucuzluğa göre seçmek',
    mistakeBody: 'Karar yalnız metre kare fiyatıyla verilmez; ürün performansı ve uygulama koşulu birlikte değerlendirilir.',
    fix: 'Bölge ve kullanım amacını birlikte değerlendirin',
    fixBody: 'Isı, ses veya çatı amacını seçin; ürün ve kalınlık kararını proje koşullarıyla teyit edin.',
  },
  {
    n: '02',
    mistake: 'Sadece levha fiyatına bakmak',
    mistakeBody: 'Sıva, dübel, file, profil, köşebent — sistem 8 kalemdir; tek kalem yanıltıcıdır.',
    fix: '8 kalemli komple sistem tek tabloda',
    fixBody: 'Levha, yapıştırıcı, sıva, dübel, file, astar, kaplama ve köşe profili bir arada hesaplanır.',
  },
  {
    n: '03',
    mistake: 'Nakliyeyi sonradan eklemek',
    mistakeBody: 'Tam araç veya EPS seti koşulu kontrol edilmeden yapılan hesap toplam maliyeti yanıltır.',
    fix: 'Nakliye koşulunu teklifin içinde görün',
    fixBody: 'Taşyününde tam araç, EPS setinde levha ve toz grubu koşulu hesapla birlikte değerlendirilir.',
  },
  {
    n: '04',
    mistake: 'Belge ve uygunluk istememek',
    mistakeBody: 'Ürün uygunluğu proje gereksinimleriyle karşılaştırılmadan yalnız fiyata göre karar verilmemelidir.',
    fix: 'Teknik belgeyi marka ve model bazında kontrol edin',
    fixBody: 'Gereken belge ve performans değerlerini sipariş öncesinde ürün dokümanıyla teyit edin.',
  },
] as const;

export function RiskMistakesBlock() {
  return (
    <section
      aria-labelledby="risk-mistakes-baslik"
      className="bg-fe-raised/60 border-y border-brand/15 py-16 sm:py-24"
    >
      <div className="max-w-[1100px] mx-auto px-4">
        <div className="max-w-[680px]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Sahada Sık Görülen
          </p>
          <h2
            id="risk-mistakes-baslik"
            className="mt-3 font-heading font-extrabold text-[28px] sm:text-[36px] leading-[1.15] tracking-tight text-fe-text"
          >
            Manuel hesapta kaybedilen 4 maliyet — sistemin nasıl kapattığı
          </h2>
          <p className="mt-3 text-sm sm:text-base text-fe-muted leading-relaxed">
            Solda sahada sık yapılan hata, sağda hesaplayıcının bunu nasıl çözdüğü.
          </p>
        </div>

        <ol className="mt-12 space-y-8">
          {ITEMS.map((item) => (
            <li
              key={item.n}
              className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start border-t border-fe-border/40 pt-8"
            >
              {/* Numara */}
              <div className="lg:col-span-1">
                <span
                  aria-hidden
                  className="font-mono text-3xl sm:text-4xl font-light text-brand leading-none tabular-nums"
                >
                  {item.n}
                </span>
              </div>

              {/* Sol: Hata */}
              <div className="lg:col-span-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fe-muted">
                  Hata
                </p>
                <p className="mt-1.5 text-base sm:text-lg font-semibold text-fe-text leading-snug">
                  {item.mistake}
                </p>
                <p className="mt-2 text-sm text-fe-muted leading-relaxed">
                  {item.mistakeBody}
                </p>
              </div>

              {/* Sağ: Sistem nasıl kapatıyor */}
              <div className="lg:col-span-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand inline-flex items-center gap-1.5">
                  <ShieldCheck size={12} weight={ICON_WEIGHT} aria-hidden />
                  Sistem nasıl kapatıyor
                </p>
                <p className="mt-1.5 text-base sm:text-lg font-semibold text-fe-text leading-snug">
                  {item.fix}
                </p>
                <p className="mt-2 text-sm text-fe-muted leading-relaxed">
                  {item.fixBody}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
