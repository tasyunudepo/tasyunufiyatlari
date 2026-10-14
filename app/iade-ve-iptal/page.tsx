import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import Eyebrow from '@/components/shared/Eyebrow';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { ICON_WEIGHT } from '@/lib/design/tokens';

import { BUSINESS_INFO } from '@/lib/business/info';

// İade, iptal ve geri ödeme koşulları (14 Ekim 2026). Merchant Center ücretsiz listeleme için iade ve geri
// ödeme politikasının ayrı, girişsiz erişilen bir sayfada olmasını ister. Kurallar
// Kullanım Koşulları 5. maddeyle aynıdır (işletmenin yayındaki beyanı); iki sayfa birlikte güncellenir.
// Telefon yazılı, bağlantı değil: herkese açık sayfalarda doğrudan arama bağlantısı verilmez (iletişim kapısı).

const COMPANY       = BUSINESS_INFO.legalName;
const ADDRESS_LINE  = BUSINESS_INFO.address.streetAddress;
const ADDRESS_CITY  = `${BUSINESS_INFO.address.addressLocality} / ${BUSINESS_INFO.address.addressRegion}`;
const PHONE_DISPLAY = BUSINESS_INFO.phone.display;
const LAST_UPDATED  = '14 Ekim 2026';

export const metadata: Metadata = {
  title: 'İade, İptal ve Geri Ödeme Koşulları',
  description:
    'tasyunufiyatlari.com iade, iptal ve geri ödeme koşulları: sevkiyattan önce iptal kesintisiz kabul edilir ve ödenen tutar geri ödenir; sevkiyattan sonra iade kabul edilmez; üretici hatasında inceleme açılır.',
  alternates: { canonical: '/iade-ve-iptal' },
};

export default function IadeVeIptalPage() {
  return (
    <div className="min-h-screen bg-hub-cream flex flex-col">
      <SiteHeader tone="warm" />

      <main className="flex-1">
        <section className="border-b border-hub-rule">
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <Eyebrow tone="warm" className="mb-5">Yasal · İade ve İptal</Eyebrow>
            <h1 className="font-heading font-extrabold text-hub-ink tracking-tight leading-[1.05] text-[clamp(2rem,4vw,3.5rem)] mb-5">
              İade, İptal ve Geri Ödeme Koşulları
            </h1>
            <p className="text-hub-ink-2 text-base sm:text-lg leading-relaxed">
              tasyunufiyatlari.com üzerinden verilen siparişlerde iptal, iade ve geri ödeme {COMPANY} tarafından
              aşağıdaki koşullarla yürütülür.
            </p>
            <p className="text-hub-ink-2/70 text-sm mt-4">Yürürlük tarihi: {LAST_UPDATED}</p>
          </div>
        </section>

        <section>
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-14 sm:py-20 space-y-12">
            <Block title="Kısaca">
              <ul className="list-disc pl-5 space-y-1.5" data-testid="return-policy-summary">
                <li><span className="font-semibold text-hub-ink">Sevkiyattan önce iptal:</span> kabul edilir, kesinti yapılmaz.</li>
                <li><span className="font-semibold text-hub-ink">Sevkiyattan sonra iade:</span> kabul edilmez.</li>
                <li><span className="font-semibold text-hub-ink">Üretici hatası:</span> fotoğraflı bildirimle inceleme açılır; üretici garantisine tabidir.</li>
              </ul>
            </Block>

            <Block title="1. Sevkiyattan önce iptal ve geri ödeme">
              <p>
                Sipariş onaylandıktan sonra, ürün depodan çıkmadan önce iptal talebiniz herhangi bir kesinti
                olmadan işleme alınır ve ödediğiniz tutarın tamamı geri ödenir. Geri ödeme, iptal onaylandığında
                ödemenin yapıldığı yöntemle (kredi kartı veya banka havalesi) başlatılır; tutarın hesabınıza
                yansıma süresi bankanıza göre değişir.
              </p>
            </Block>

            <Block title="2. Sevkiyattan sonra iade">
              <p>
                <span className="font-semibold text-hub-ink">Sevkiyat sonrası iade kabul edilmez.</span>
                {' '}Ürün depodan çıkıp yola düştükten itibaren iade süreci açılmaz. Bu nedenle sipariş onayı
                vermeden önce miktar, kalınlık, marka ve teslimat adresi bilgilerini dikkatle kontrol etmeniz
                tavsiye edilir.
              </p>
            </Block>

            <Block title="3. Üretici hatasından kaynaklı uygunsuzluk">
              <p>
                Üretici hatasından kaynaklı ürün uygunsuzluklarında, ürün tesliminden itibaren makul süre içinde
                fotoğraflı kayıtla bildirim yapılması hâlinde inceleme açılır; yerinde ya da numune bazlı denetim
                sonrası uygun çözüm önerilir. Bu kapsam üretici garantisine tabidir ve yukarıdaki iade kuralından
                bağımsız değerlendirilir.
              </p>
            </Block>

            <Block title="4. Talep nasıl iletilir">
              <p>
                İptal ve uygunsuzluk taleplerinizi PDF teklifinizdeki referans kodu ile{' '}
                <span className="font-semibold text-hub-ink">{PHONE_DISPLAY}</span> numaralı hattan ya da{' '}
                <Link href="/iletisim" className="text-hub-gold underline hover:text-hub-gold/80">iletişim sayfamızdan</Link>{' '}
                iletebilirsiniz.
              </p>
            </Block>

            <Block title="5. Satıcı bilgileri">
              <ul className="list-disc pl-5 space-y-1.5">
                <li><span className="font-semibold text-hub-ink">Unvan:</span> {COMPANY}</li>
                <li><span className="font-semibold text-hub-ink">Adres:</span> {ADDRESS_LINE}, {ADDRESS_CITY}</li>
                <li><span className="font-semibold text-hub-ink">Telefon:</span> {PHONE_DISPLAY}</li>
              </ul>
              <p>
                Sipariş, sevkiyat ve sorumluluk koşullarının tamamı için{' '}
                <Link href="/kullanim-kosullari" className="text-hub-gold underline hover:text-hub-gold/80">Kullanım Koşulları</Link>{' '}
                sayfasına bakın.
              </p>
            </Block>

            <div className="pt-8 border-t border-hub-rule flex flex-wrap items-center justify-between gap-4">
              <p className="text-hub-ink-2 text-sm">Soru ve talepleriniz için iletişim sayfamızı kullanabilirsiniz.</p>
              <Link href="/iletisim" className="btn-secondary">
                İletişime Geç
                <ArrowRight weight={ICON_WEIGHT} size={16} className="btn-arrow" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter tone="warm" />
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article>
      <h2 className="font-heading font-bold text-hub-ink tracking-tight text-2xl sm:text-3xl mb-4 leading-snug">
        {title}
      </h2>
      <div className="text-hub-ink-2 text-base leading-relaxed space-y-3">
        {children}
      </div>
    </article>
  );
}
