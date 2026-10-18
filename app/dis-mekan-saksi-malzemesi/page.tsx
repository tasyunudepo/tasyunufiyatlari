import type { Metadata } from 'next';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import Eyebrow from '@/components/shared/Eyebrow';
import { buildMetadata } from '@/lib/seo/buildMetadata';

// Bağımsız bilgi yazısı (GCR bağlantı planı, Emrah onayı 18 Ekim 2026). Ayrı bir işletmenin
// (FiberglasArt) sayfalarına küçük bağlantı verir; ürün ve teklif ekranlarında gösterilmez,
// yalnız altbilgiden bağlanır (Kiralık Jeneratör sayfasıyla aynı kural, yuvarlak masa 13 Ekim 2026).

const DIS_MEKAN_SAKSI_PATH = '/dis-mekan-saksi-malzemesi';

export const metadata: Metadata = buildMetadata({
  title: 'Dış mekân saksısında malzeme: beton, plastik ve fiberglas',
  description:
    'Teras, balkon ve bahçe saksısında malzeme seçimi: ağırlık, dayanıklılık ve taşıma. Beton, plastik ve fiberglas saksıyı karşılaştıran kısa rehber.',
  path: DIS_MEKAN_SAKSI_PATH,
  type: 'website',
});

const MATERIALS = [
  {
    name: 'Beton',
    text: 'Ağır ve sağlamdır; ağırlığı sayesinde rüzgârda daha dengeli durur. Dona ve suya dayanımı karışıma ve yüzey işlemine bağlıdır. Aynı ağırlık taşımayı ve yerleştirmeyi zorlaştırır, teras ve balkonda yükü artırır.',
  },
  {
    name: 'Plastik',
    text: 'Hafif ve ekonomiktir. Uzun süre güneşte kalan ince gövdelerde renk açılması ve kırılganlaşma görülebilir.',
  },
  {
    name: 'Fiberglas',
    text: 'Cam elyafıyla güçlendirilmiş reçineden üretilir; hafiftir, paslanmaz ve çürümez. Kalıpla büyük ölçülerde ve istenen renkte üretilebilir. Hafif olduğu için büyük ve boş gövdeler rüzgârlı yerlerde sabitlenmelidir; fiyatı plastikten yüksektir.',
  },
];

const FIBERGLASART = {
  largeUrl: 'https://www.fiberglasart.com/buyuk-saksi/',
  largeAnchor: 'büyük saksı modelleri',
  homeUrl: 'https://www.fiberglasart.com/',
  homeAnchor: 'fiber saksı',
};

const linkClass = 'font-semibold text-hub-gold underline underline-offset-2 hover:text-hub-ink';

export default function DisMekanSaksiPage() {
  return (
    <div className="min-h-screen bg-hub-cream flex flex-col">
      <SiteHeader tone="warm" />

      <main className="flex-1">
        <section className="border-b border-hub-rule">
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <Eyebrow tone="warm" className="mb-5">Teras ve bahçe</Eyebrow>
            <h1 className="font-heading font-extrabold text-hub-ink tracking-tight leading-[1.05] text-[clamp(2rem,4vw,3.5rem)] mb-5">
              Dış mekân saksısında malzeme seçimi
            </h1>
            <p className="text-hub-ink-2 text-base sm:text-lg leading-relaxed max-w-2xl">
              Teras, balkon ve bahçe için saksı seçerken malzeme; saksının ağırlığını, dış hava koşullarına
              dayanımını ve taşınmasını belirler. Bu sayfa yaygın üç malzemeyi kısaca karşılaştırır.
            </p>
          </div>
        </section>

        <section>
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-14 sm:py-20 space-y-12 text-hub-ink-2 text-base leading-relaxed">
            <div>
              <h2 className="font-heading font-bold text-hub-ink tracking-tight text-2xl sm:text-3xl mb-4">
                Terasta önce ağırlık
              </h2>
              <p>
                Teras ve çatıda saksının kendi ağırlığına toprak, su ve bitki eklenir. Büyük ya da çok sayıda saksı
                konacaksa dolu saksıların toplam yükünü yapının taşıma kapasitesine göre bir statik uzmanına kontrol
                ettirin. Isı ve su yalıtımı katmanlarının üzerine konacak saksılarda drenajı ve suyun nereye akacağını
                baştan planlayın.
              </p>
            </div>

            <div>
              <h2 className="font-heading font-bold text-hub-ink tracking-tight text-2xl sm:text-3xl mb-4">
                Üç malzeme kısaca
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                {MATERIALS.map((item) => (
                  <li key={item.name}>
                    <span className="font-semibold text-hub-ink">{item.name}:</span> {item.text}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-heading font-bold text-hub-ink tracking-tight text-2xl sm:text-3xl mb-4">
                Büyük saksıda taşıma ve yerleştirme
              </h2>
              <p>
                Yüz litre ve üzeri saksılarda boş gövdenin ağırlığı; merdivenden çıkarma, asansöre sığdırma ve
                yerine yerleştirme işini belirler. Saksıyı dikimden önce son yerine koymak, toprak dolduktan sonra
                taşımaktan çok daha kolaydır.
              </p>
            </div>

            <p className="border-t border-hub-rule pt-8" data-testid="fiberglasart-links">
              FiberglasArt, Tuzla&rsquo;da fiberglas saksı üreten bir firmadır; tasyunufiyatlari.com ve Özer
              Grup&rsquo;tan ayrı bir işletmedir. Fiberglas gövdeli büyük ölçüleri karşılaştırmak için{' '}
              <a href={FIBERGLASART.largeUrl} className={linkClass}>
                {FIBERGLASART.largeAnchor}
              </a>{' '}
              sayfasına, üreticinin bütün{' '}
              <a href={FIBERGLASART.homeUrl} className={linkClass}>
                {FIBERGLASART.homeAnchor}
              </a>{' '}
              modelleri için ana sayfasına bakabilirsiniz.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter tone="warm" />
    </div>
  );
}
