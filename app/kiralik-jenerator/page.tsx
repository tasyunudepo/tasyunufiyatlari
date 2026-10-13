import type { Metadata } from 'next';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import Eyebrow from '@/components/shared/Eyebrow';
import { buildMetadata } from '@/lib/seo/buildMetadata';
import { GENERATOR_PAGE_PATH, GENERATOR_SITE } from '@/lib/portfolio/offers';

// Kiralık Jeneratör ayrı bir işletmedir. Bu sayfa footer'daki tek
// bağlantının hedefidir; jeneratör ürün ve teklif ekranlarında gösterilmez
// (karar: yuvarlak masa, 13 Ekim 2026).

export const metadata: Metadata = buildMetadata({
  title: 'Mantolamada kiralık jeneratör ve şantiye elektriği',
  description:
    'Mantolama şantiyesinde elektrik kullanımı, jeneratör gereken durumlar ve kiralama öncesi netleştirilecek konular için kısa rehber.',
  path: GENERATOR_PAGE_PATH,
  type: 'website',
});

const POWER_USES = [
  {
    work: 'Sıva ve yapıştırıcı karıştırma',
    why: 'Harç hazırlarken kullanılan elektrikli karıştırıcılar enerji ister.',
  },
  {
    work: 'Dübel delme',
    why: 'Yalıtım levhalarını sabitlemek üzere duvarda delik açmak için elektrikli matkap kullanılır.',
  },
  {
    work: 'İskele aydınlatması',
    why: 'Işığın yetersiz kaldığı çalışma alanlarında aydınlatma için elektrik gerekir.',
  },
  {
    work: 'Malzeme kaldırma',
    why: 'Elektrikli vinç veya kaldırma ekipmanı kullanılıyorsa elektrik beslemesi gerekir.',
  },
];

const RENTAL_CHECKS = [
  {
    topic: 'Makineler',
    detail: 'Aynı anda çalışacak ekipmanları ve her birinin güç gereksinimini belirleyin.',
  },
  {
    topic: 'Çalışma süresi',
    detail: 'Günlük kullanım süresini ve makinelerin kesintisiz mi, aralıklı mı çalışacağını netleştirin.',
  },
  {
    topic: 'Yakıt ve teslimat',
    detail: 'Yakıt temini, nakliye ve kurulumun kim tarafından karşılanacağını görüşün.',
  },
  {
    topic: 'Şantiye konumu',
    detail: 'Adresi, araç girişini ve jeneratörün yerleştirileceği alanı kiralama işletmesine bildirin.',
  },
];

const linkClass = 'font-semibold text-hub-gold underline underline-offset-2 hover:text-hub-ink';

export default function KiralikJeneratorPage() {
  return (
    <div className="min-h-screen bg-hub-cream flex flex-col">
      <SiteHeader tone="warm" />

      <main className="flex-1">
        <section className="border-b border-hub-rule">
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <Eyebrow tone="warm" className="mb-5">Şantiye</Eyebrow>
            <h1 className="font-heading font-extrabold text-hub-ink tracking-tight leading-[1.05] text-[clamp(2rem,4vw,3.5rem)] mb-5">
              Mantolama şantiyesi için kiralık jeneratör
            </h1>
            <p className="text-hub-ink-2 text-base sm:text-lg leading-relaxed max-w-2xl">
              Mantolama şantiyesinde sıva hazırlamak, dübel delmek ve çalışma alanını aydınlatmak için elektrik
              gerekir. Elektrik kaynağının kullanılacak makineleri besleyebilmesi, işin planlandığı gibi ilerlemesi
              açısından önemlidir.
            </p>
          </div>
        </section>

        <section>
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-14 sm:py-20 space-y-12 text-hub-ink-2 text-base leading-relaxed">
            <div>
              <h2 className="font-heading font-bold text-hub-ink tracking-tight text-2xl sm:text-3xl mb-4">
                Mantolama şantiyesinde elektrik nerede gerekir
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                {POWER_USES.map((item) => (
                  <li key={item.work}>
                    <span className="font-semibold text-hub-ink">{item.work}:</span> {item.why}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-heading font-bold text-hub-ink tracking-tight text-2xl sm:text-3xl mb-4">
                Jeneratör ne zaman gerekir
              </h2>
              <p>
                Şebeke bağlantısı bulunmayan şantiyelerde jeneratör gerekebilir. Mevcut bağlantı, aynı anda çalışan
                makineleri beslemeye yetmiyorsa jeneratör seçeneği değerlendirilir. Seçim yapılırken makinelerin
                çalışma yükü ve ilk çalıştırma sırasında çektiği güç dikkate alınır.
              </p>
            </div>

            <div>
              <h2 className="font-heading font-bold text-hub-ink tracking-tight text-2xl sm:text-3xl mb-4">
                Kiralamadan önce netleştirilecekler
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                {RENTAL_CHECKS.map((item) => (
                  <li key={item.topic}>
                    <span className="font-semibold text-hub-ink">{item.topic}:</span> {item.detail}
                  </li>
                ))}
              </ul>
            </div>

            <p className="border-t border-hub-rule pt-8" data-testid="generator-links">
              Kiralık Jeneratör, tasyunufiyatlari.com ve ÖzerGrup&rsquo;tan ayrı bir işletmedir. Kiralama görüşmesini
              bu işletmenin sitesinden yürütmek için{' '}
              <a href={GENERATOR_SITE.homeUrl} className={linkClass}>
                {GENERATOR_SITE.homeAnchor}
              </a>{' '}
              ana sayfasına geçebilir, şantiyedeki kullanımınıza yönelik talebinizi{' '}
              <a href={GENERATOR_SITE.siteUseUrl} className={linkClass}>
                {GENERATOR_SITE.siteUseAnchor}
              </a>{' '}
              sayfası üzerinden iletebilirsiniz.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter tone="warm" />
    </div>
  );
}
