import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import Eyebrow from '@/components/shared/Eyebrow';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { ICON_WEIGHT } from '@/lib/design/tokens';

import { BUSINESS_INFO } from '@/lib/business/info';

const COMPANY       = BUSINESS_INFO.legalName;
// Kullanım Koşulları işletmecinin kurumsal merkezini gösterir (kanonik ofis).
const ADDRESS_LINE  = BUSINESS_INFO.address.streetAddress;
const ADDRESS_CITY  = `${BUSINESS_INFO.address.addressLocality} / ${BUSINESS_INFO.address.addressRegion}`;
const EMAIL         = BUSINESS_INFO.email;
const PHONE_DISPLAY = BUSINESS_INFO.phone.display;
const SITE          = 'tasyunufiyatlari.com';
const LAST_UPDATED  = '11 Mayıs 2026';

export const metadata: Metadata = {
  title: 'Kullanım Koşulları',
  description:
    'tasyunufiyatlari.com kullanım koşulları — hizmet kapsamı, fiyatlandırma, sevkiyat, sorumluluk ve uyuşmazlık çözümü.',
  alternates: { canonical: '/kullanim-kosullari' },
};

export default function KullanimKosullariPage() {
  return (
    <div className="min-h-screen bg-hub-cream flex flex-col">
      <SiteHeader tone="warm" />

      <main className="flex-1">
        {/* HERO */}
        <section className="border-b border-hub-rule">
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <Eyebrow tone="warm" className="mb-5">Yasal · Kullanım Koşulları</Eyebrow>
            <h1 className="font-heading font-extrabold text-hub-ink tracking-tight leading-[1.05] text-[clamp(2rem,4vw,3.5rem)] mb-5">
              Kullanım Koşulları
            </h1>
            <p className="text-hub-ink-2 text-base sm:text-lg leading-relaxed">
              {SITE} üzerinden sunulan hizmetler {COMPANY} (&ldquo;İşletmeci&rdquo;) tarafından
              aşağıda yer alan koşullar dahilinde sunulur. Sitemizi kullanan ve/veya teklif talep
              eden tüm ziyaretçilerimiz bu koşulları okumuş ve kabul etmiş sayılır.
            </p>
            <p className="text-hub-ink-2/70 text-sm mt-4">Yürürlük tarihi: {LAST_UPDATED}</p>
          </div>
        </section>

        {/* İÇERİK */}
        <section>
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-14 sm:py-20 space-y-12">

            <Block title="1. İşletmeci Bilgileri">
              <ul className="list-disc pl-5 space-y-1.5">
                <li><span className="font-semibold text-hub-ink">Unvan:</span> {COMPANY}</li>
                <li><span className="font-semibold text-hub-ink">Adres:</span> {ADDRESS_LINE}, {ADDRESS_CITY}</li>
                <li><span className="font-semibold text-hub-ink">Telefon:</span> {PHONE_DISPLAY}</li>
                <li><span className="font-semibold text-hub-ink">E-posta:</span>{' '}
                  <a href={`mailto:${EMAIL}`} className="text-hub-gold underline hover:text-hub-gold/80">{EMAIL}</a>
                </li>
                <li><span className="font-semibold text-hub-ink">Web:</span>{' '}
                  <Link href="/" className="text-hub-gold underline hover:text-hub-gold/80">{SITE}</Link>
                </li>
              </ul>
            </Block>

            <Block title="2. Hizmet Kapsamı">
              <p>
                İşletmeci, sitemiz üzerinden <span className="font-semibold text-hub-ink">taş yünü, EPS levha
                ve mantolama sistemleri tedariki</span> hizmeti sunar. Maliyet hesaplayıcı bir bilgilendirme aracıdır;
                sahaya kesin fiyat ancak resmi PDF teklif veya yazılı/sözlü sipariş onayı sonrasında bağlayıcı hâle gelir.
              </p>
              <p>
                Sitemiz Türkiye&apos;de mukim, kurumsal kullanıcılar ile yapı uygulayıcılarına yönelik olarak yapılandırılmıştır.
              </p>
            </Block>

            <Block title="3. Fiyatlandırma">
              <p>
                <span className="font-semibold text-hub-ink">KDV:</span> Sitedeki tüm fiyatlar
                <span className="font-semibold text-hub-ink"> KDV hariç</span> olarak gösterilir;
                %20 KDV ayrıca eklenir. Resmi PDF teklifte hem KDV hariç tutar hem KDV dahil
                toplam tutar ayrı ayrı yer alır.
              </p>

              <p>
                Fiyatlar; ham madde piyasası, döviz kuru, üretici fiyat listeleri ve sevkiyat
                kapasitesine bağlı olarak değişebilir. Hesaplayıcıda gördüğünüz değer talebiniz anındaki
                geçerli fiyat listesini yansıtır; sonraki tarihlerde aynı kalmasını garanti etmez.
              </p>

              <p>
                <span className="font-semibold text-hub-ink">Teklif geçerlilik süresi:</span> Resmi PDF teklif,
                oluşturulma tarihinden itibaren <span className="font-semibold text-hub-ink">24 saat</span>
                {' '}boyunca geçerlidir. Süre sonunda güncel fiyatla yenileme talep edebilirsiniz.
              </p>
            </Block>

            <Block title="4. Sipariş ve Sevkiyat">
              <p>
                Sipariş, müşterinin PDF teklifteki referans numarasıyla onay vermesi ve İşletmeci&apos;nin
                yazılı/sistemik teyidiyle kurulur.
              </p>
              <p>
                Türkiye geneli sevkiyat yapılır. Teslim süreleri ürün stoku, sevkiyat hattı ve hava
                koşullarına göre değişiklik gösterebilir. Net teslim tarihi siparişe özel olarak bildirilir.
              </p>
              <p>
                Kısmi yük, kamyon ve TIR doluluk eşiklerine göre sevkiyat ücreti ve bölgesel iskonto
                hesaplayıcıda otomatik olarak hesaplanır.
              </p>
            </Block>

            <Block title="5. İade ve İptal">
              <p>
                <span className="font-semibold text-hub-ink">Sevkiyat öncesi iptal kabul edilir.</span>
                {' '}Sipariş onaylandıktan sonra, ürün depodan çıkmadan önce iptal talebiniz herhangi bir
                kesinti olmadan işleme alınır.
              </p>
              <p>
                <span className="font-semibold text-hub-ink">Sevkiyat sonrası iade kabul edilmez.</span>
                {' '}Ürün depodan çıkıp yola düştükten itibaren iade süreci açılmaz; bu nedenle
                sipariş onayı vermeden önce miktar, kalınlık, marka ve teslimat adresi bilgilerini
                dikkatle kontrol etmeniz tavsiye edilir.
              </p>
              <p>
                Üretici hatasından kaynaklı ürün uygunsuzluklarında, ürün tesliminden itibaren makul süre
                içinde fotoğraflı kayıtla bildirim yapılması hâlinde inceleme açılır; yerinde ya da numune
                bazlı denetim sonrası uygun çözüm önerilir. Bu kapsam üretici garantisine tabidir ve
                yukarıdaki iade kuralından bağımsız değerlendirilir.
              </p>
            </Block>

            <Block title="6. Sorumluluk Sınırı">
              <p>
                Yapı malzemesi montajı, uygulama hataları ve sonrasında oluşan kullanım koşulları
                <span className="font-semibold text-hub-ink"> üreticisinin garanti şartlarına</span> ve
                uygulayıcı firmanın işçilik sorumluluğuna tabidir.
              </p>
              <p>
                İşletmeci, ürünün <span className="font-semibold text-hub-ink">orijinal üretici garantisi
                kapsamında</span> tedarikinden sorumludur; uygulama, projelendirme veya statik hesaplama
                kapsamına giren konular sözleşmeli yapı mühendisliği hizmetiyle ayrıca yönetilmelidir.
              </p>
              <p>
                Sitedeki teknik bilgiler ve hesaplayıcı çıktıları yol gösterici niteliktedir; nihai
                karar, projeye özel mühendislik onayı ile alınmalıdır.
              </p>
            </Block>

            <Block title="7. Fikri Mülkiyet">
              <p>
                Site içeriği, logolar, marka isimleri, görseller, metinler ve yazılımların tüm hakları
                İşletmeci&apos;ye veya ilgili üreticilere aittir. İzinsiz kopyalama, çoğaltma veya ticari
                kullanım yasaktır.
              </p>
            </Block>

            <Block title="8. Kişisel Veriler">
              <p>
                Formlardan ve site kullanımından elde edilen kişisel veriler, KVKK uyarınca işlenir.
                Detay için{' '}
                <Link href="/kvkk" className="text-hub-gold underline hover:text-hub-gold/80">
                  Aydınlatma Metni
                </Link>
                {' '}ve{' '}
                <Link href="/cerez-politikasi" className="text-hub-gold underline hover:text-hub-gold/80">
                  Çerez Politikası
                </Link>
                {' '}sayfalarımıza bakın.
              </p>
            </Block>

            <Block title="9. Uyuşmazlık Çözümü">
              <p>
                Tarafların öncelikle iyi niyetle ve müzakere yoluyla uzlaşma araması esastır.
              </p>
              <p>
                Uzlaşma sağlanamaması hâlinde, işbu koşullardan doğacak uyuşmazlıklarda
                <span className="font-semibold text-hub-ink"> İstanbul Anadolu Mahkemeleri ve
                İcra Daireleri</span> yetkilidir. Uygulanacak hukuk Türk Hukuku&apos;dur.
              </p>
            </Block>

            <Block title="10. Değişiklikler">
              <p>
                Bu Kullanım Koşulları, mevzuatta veya iş süreçlerimizde meydana gelen değişiklikler
                doğrultusunda güncellenebilir. Güncellenen metin yayım tarihi itibarıyla yürürlüğe
                girer; en güncel sürüm her zaman bu sayfadan ulaşılabilir.
              </p>
            </Block>

            {/* Alt CTA */}
            <div className="pt-8 border-t border-hub-rule flex flex-wrap items-center justify-between gap-4">
              <p className="text-hub-ink-2 text-sm">
                Soru ve teklif talepleriniz için iletişim sayfamızı kullanabilirsiniz.
              </p>
              <Link href="/iletisim" className="btn-secondary">
                İletişime Geç
                <ArrowRight weight={ICON_WEIGHT} size={16} className="btn-arrow" />
              </Link>
            </div>

            <p className="text-hub-ink-2/60 text-xs pt-4">
              İşletmeci: {COMPANY} · {ADDRESS_LINE}, {ADDRESS_CITY}
            </p>
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
