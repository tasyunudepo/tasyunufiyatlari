import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import Eyebrow from '@/components/shared/Eyebrow';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { ICON_WEIGHT } from '@/lib/design/tokens';

import { BUSINESS_INFO } from '@/lib/business/info';

const COMPANY      = BUSINESS_INFO.legalName;
const SITE         = 'tasyunufiyatlari.com';
const GA_ID        = 'G-VCHRKVJCEN';
const LAST_UPDATED = '11 Mayıs 2026';

export const metadata: Metadata = {
  title: 'Çerez Politikası',
  description:
    'tasyunufiyatlari.com — kullanılan çerezler, GA4 anonim ölçüm, IP maskelenmesi ve çerez opt-out yöntemleri.',
  alternates: { canonical: '/cerez-politikasi' },
};

export default function CerezPolitikasiPage() {
  return (
    <div className="min-h-screen bg-hub-cream flex flex-col">
      <SiteHeader tone="warm" />

      <main className="flex-1">
        {/* HERO */}
        <section className="border-b border-hub-rule">
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <Eyebrow tone="warm" className="mb-5">Yasal · Çerezler</Eyebrow>
            <h1 className="font-heading font-extrabold text-hub-ink tracking-tight leading-[1.05] text-[clamp(2rem,4vw,3.5rem)] mb-5">
              Çerez Politikası
            </h1>
            <p className="text-hub-ink-2 text-base sm:text-lg leading-relaxed">
              {SITE} üzerinde çerezleri nasıl kullandığımızı, hangi verileri topladığımızı ve
              çerezleri kontrol etme yöntemlerinizi şeffafça anlatıyoruz.
            </p>
            <p className="text-hub-ink-2/70 text-sm mt-4">Yürürlük tarihi: {LAST_UPDATED}</p>
          </div>
        </section>

        {/* İÇERİK */}
        <section>
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-14 sm:py-20 space-y-12">

            <Block title="1. Çerez Nedir?">
              <p>
                Çerez (cookie), web sitelerinin tarayıcınıza kaydettiği küçük bir metin dosyasıdır.
                Bu dosyalar sitenin nasıl kullanıldığına dair anonim istatistikler tutmaya, oturum
                tercihlerinizi hatırlamaya veya güvenliği sağlamaya yarayabilir.
              </p>
            </Block>

            <Block title="2. Sitemizde Kullanılan Çerezler">
              <p className="mb-4">
                {SITE} üzerinde yalnızca <span className="font-semibold text-hub-ink">analitik ölçüm</span> ve
                <span className="font-semibold text-hub-ink"> teknik işlevsellik</span> amacıyla çerez kullanıyoruz.
                Kişiselleştirilmiş reklam çerezi <span className="font-semibold text-hub-ink">kullanmıyoruz</span>.
              </p>

              <h3 className="font-semibold text-hub-ink text-lg mt-6 mb-3">Google Analytics 4 (GA4)</h3>
              <p className="mb-3">
                Ölçüm kimliği: <code className="bg-hub-warm px-2 py-0.5 rounded text-sm">{GA_ID}</code>
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <code className="bg-hub-warm px-1.5 py-0.5 rounded text-sm">_ga</code> — site ziyaretçilerini
                  birbirinden ayırt etmek için kullanılır (2 yıl).
                </li>
                <li>
                  <code className="bg-hub-warm px-1.5 py-0.5 rounded text-sm">_ga_VCHRKVJCEN</code> — GA4
                  oturum durumunu tutar (2 yıl).
                </li>
              </ul>

              <p className="mt-4">
                <span className="font-semibold text-hub-ink">Reklam çerezleri (ad_storage):</span> Google
                Consent Mode v2 üzerinden varsayılan olarak <span className="font-semibold text-hub-ink">denied</span> durumda;
                yani reklam kişiselleştirme ve dönüşüm takibi çerezleri sitemizde aktif değildir.
              </p>
            </Block>

            <Block title="3. Veri Toplama Disiplini">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <span className="font-semibold text-hub-ink">IP işleme:</span> GA4 bağlantısı sırasında IP adresi
                  konum bilgisinin türetilmesi için Google tarafından kullanılabilir. Google&apos;ın GA4 açıklamasına göre
                  tam IP adresi Analytics raporlarına yazılmadan önce sistemden çıkarılır.
                </li>
                <li>
                  <span className="font-semibold text-hub-ink">Google Signals kapalı:</span>
                  <code className="bg-hub-warm px-1.5 py-0.5 rounded text-sm mx-1">allow_google_signals: false</code>
                  — cross-device tracking ve demografik veri zenginleştirme kapalıdır.
                </li>
                <li>
                  <span className="font-semibold text-hub-ink">Reklam sinyalleri kapalı:</span>
                  <code className="bg-hub-warm px-1.5 py-0.5 rounded text-sm mx-1">allow_ad_personalization_signals: false</code>
                  — kişiselleştirilmiş reklam için sinyal gönderilmez.
                </li>
                <li>
                  <span className="font-semibold text-hub-ink">Veri redaksiyonu:</span>
                  <code className="bg-hub-warm px-1.5 py-0.5 rounded text-sm mx-1">ads_data_redaction: true</code>
                  — reklam ölçümünde kullanılan parametreler maskelenir.
                </li>
                <li>
                  Form göndermediğiniz sürece <span className="font-semibold text-hub-ink">ad, soyad, telefon, e-posta
                  gibi kişisel veri çerezde tutulmaz</span>. Form gönderimleri ayrı KVKK rızasıyla işlenir
                  (<Link href="/kvkk" className="text-hub-gold underline hover:text-hub-gold/80">Aydınlatma Metni</Link>).
                </li>
              </ul>
            </Block>

            <Block title="4. Çerezleri Nasıl Kontrol Edebilirsiniz?">
              <p className="mb-4">
                Çerezleri kabul etmek zorunlu değildir; istediğiniz zaman aşağıdaki yöntemlerle devre dışı bırakabilirsiniz.
              </p>

              <h3 className="font-semibold text-hub-ink text-lg mb-2">Tarayıcı ayarlarından çerez engelleme</h3>
              <p className="mb-4">
                Modern tarayıcılar (Chrome, Firefox, Edge, Safari) ayarlar menüsünde belirli sitelere veya tüm
                sitelere ait çerezleri engelleme imkânı sunar.
                <code className="bg-hub-warm px-1.5 py-0.5 rounded text-sm mx-1">_ga</code> ve
                <code className="bg-hub-warm px-1.5 py-0.5 rounded text-sm mx-1">_ga_VCHRKVJCEN</code>
                çerezlerini siteye özel olarak da engelleyebilirsiniz.
              </p>

              <h3 className="font-semibold text-hub-ink text-lg mb-2">Google Analytics opt-out add-on</h3>
              <p className="mb-4">
                Google&apos;ın resmi tarayıcı eklentisi tüm GA4 sitelerinde ölçümünüzü devre dışı bırakır:
                <br />
                <a
                  href="https://tools.google.com/dlpage/gaoptout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-hub-gold underline hover:text-hub-gold/80 break-all"
                >
                  https://tools.google.com/dlpage/gaoptout
                </a>
              </p>

              <h3 className="font-semibold text-hub-ink text-lg mb-2">Do Not Track</h3>
              <p>
                Site şu anda tarayıcının &quot;Do Not Track&quot; sinyaline bağlı ayrı bir ölçüm davranışı uygulamaz.
                GA4 ölçümünü engellemek için tarayıcı çerez ayarlarını veya yukarıdaki Google opt-out eklentisini kullanabilirsiniz.
              </p>
            </Block>

            <Block title="5. Kişisel Veri Talepleriniz">
              <p>
                Sitemizdeki çerezler aracılığıyla kişisel veriniz işlendiğini düşünüyorsanız veya KVKK
                kapsamındaki haklarınızı kullanmak istiyorsanız, lütfen{' '}
                <Link href="/kvkk" className="text-hub-gold underline hover:text-hub-gold/80">
                  KVKK Aydınlatma Metni
                </Link>
                {' '}üzerinden başvuru yöntemlerimizi inceleyin. KVKK uyarınca talepleriniz en geç 30 gün içinde sonuçlandırılır.
              </p>
            </Block>

            <Block title="6. Değişiklikler">
              <p>
                Bu Çerez Politikası, mevzuatta veya kullandığımız teknolojilerde meydana gelen değişiklikler
                doğrultusunda güncellenebilir. Güncellenen metin yayım tarihi itibarıyla yürürlüğe girer;
                en güncel sürüm her zaman bu sayfadan ulaşılabilir.
              </p>
            </Block>

            {/* Alt CTA */}
            <div className="pt-8 border-t border-hub-rule flex flex-wrap items-center justify-between gap-4">
              <p className="text-hub-ink-2 text-sm">
                Veri sahibi haklarınız için Aydınlatma Metni&apos;ne bakın.
              </p>
              <Link href="/kvkk" className="btn-secondary">
                KVKK Aydınlatma Metni
                <ArrowRight weight={ICON_WEIGHT} size={16} className="btn-arrow" />
              </Link>
            </div>

            <p className="text-hub-ink-2/60 text-xs pt-4">
              Veri sorumlusu: {COMPANY}
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
