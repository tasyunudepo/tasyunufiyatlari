import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/shared/SiteHeader';
import SiteFooter from '@/components/shared/SiteFooter';
import Eyebrow from '@/components/shared/Eyebrow';
import PhoneCallLink from '@/components/shared/PhoneCallLink';
import { ArrowRight, EnvelopeSimple, Phone, MapPin } from '@phosphor-icons/react/dist/ssr';
import { ICON_WEIGHT } from '@/lib/design/tokens';
import { BUSINESS_INFO, WAREHOUSE_INFO } from '@/lib/business/info';

const COMPANY       = BUSINESS_INFO.legalName;
// KVKK başvuru kanalı olarak depo adresi (sahaya yakın iletişim) tercih ediliyor.
const ADDRESS_LINE  = WAREHOUSE_INFO.addressLine;
const ADDRESS_CITY  = WAREHOUSE_INFO.cityLine;
const PHONE_DISPLAY = BUSINESS_INFO.phone.display;
const PHONE_TEL     = BUSINESS_INFO.phone.tel;
const EMAIL         = BUSINESS_INFO.email;
const SITE          = 'tasyunufiyatlari.com';
const LAST_UPDATED  = '30 Nisan 2026';

export const metadata: Metadata = {
  title: 'KVKK Aydınlatma Metni',
  description:
    "ÖzerGrup Yalıtım ve İzolasyon A.Ş. KVKK Aydınlatma Metni — kişisel verilerin işlenmesine ilişkin bilgilendirme.",
  alternates: { canonical: '/kvkk' },
};

export default function KvkkPage() {
  return (
    <div className="min-h-screen bg-hub-cream flex flex-col">
      <SiteHeader tone="warm" />

      <main className="flex-1">
        {/* HERO */}
        <section className="border-b border-hub-rule">
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <Eyebrow tone="warm" className="mb-5">Yasal · Aydınlatma</Eyebrow>
            <h1 className="font-heading font-extrabold text-hub-ink tracking-tight leading-[1.05] text-[clamp(2rem,4vw,3.5rem)] mb-5">
              KVKK Aydınlatma Metni
            </h1>
            <p className="text-hub-ink-2 text-base sm:text-lg leading-relaxed">
              6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;) uyarınca, veri sorumlusu sıfatıyla {COMPANY}
              tarafından kişisel verilerinizin nasıl toplandığı, işlendiği, aktarıldığı ve haklarınız hakkında sizi bilgilendirmek isteriz.
            </p>
            <p className="text-hub-ink-2/70 text-sm mt-4">Son güncelleme: {LAST_UPDATED}</p>
          </div>
        </section>

        {/* İÇERİK */}
        <section>
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-14 sm:py-20 space-y-12">

            <Block title="1. Veri Sorumlusu">
              <p>
                Veri sorumlusu, ticari merkezi <span className="font-semibold text-hub-ink">{COMPANY}</span> olan,
                <span className="font-semibold text-hub-ink"> {ADDRESS_LINE}, {ADDRESS_CITY}</span> adresinde faaliyet gösteren tüzel kişiliktir.
                {' '}
                <Link href="/" className="text-hub-gold hover:underline">{SITE}</Link>{' '}
                alan adı üzerinden sunulan hizmetler bu metnin kapsamındadır.
              </p>
            </Block>

            <Block title="2. İşlenen Kişisel Veriler">
              <p className="mb-3">
                Sitemiz üzerindeki maliyet hesaplayıcı, teklif formu ve iletişim kanalları aracılığıyla aşağıdaki kişisel verileri toplayabiliriz:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><span className="font-semibold text-hub-ink">Kimlik bilgileri:</span> ad, soyad, ilgili kişi unvanı.</li>
                <li><span className="font-semibold text-hub-ink">İletişim bilgileri:</span> telefon numarası, e-posta adresi, teslimat / ikamet adresi, şehir-ilçe.</li>
                <li><span className="font-semibold text-hub-ink">Müşteri/firma bilgileri:</span> firma adı, vergi-fatura bilgisi (sipariş aşamasında).</li>
                <li><span className="font-semibold text-hub-ink">İşlem bilgileri:</span> talep edilen ürün, metraj, kalınlık, paket tercihi, oluşturulan teklif kodu (TY-prefix).</li>
                <li><span className="font-semibold text-hub-ink">Teknik bilgiler:</span> IP adresi, tarayıcı bilgisi, ziyaret zamanı (analitik amacıyla anonimize edilir).</li>
              </ul>
            </Block>

            <Block title="3. Kişisel Verilerin İşlenme Amaçları">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Talep ettiğiniz fiyat teklifinin oluşturulması, PDF olarak iletilmesi ve kayıt altına alınması.</li>
                <li>Sipariş, sevkiyat ve fatura süreçlerinin yürütülmesi.</li>
                <li>WhatsApp, telefon, e-posta gibi kanallar üzerinden tarafınıza dönüş yapılması.</li>
                <li>Yasal yükümlülüklerin (vergi, fatura, KVKK ilgili kişi başvuruları) yerine getirilmesi.</li>
                <li>Hizmet kalitesinin ölçülmesi, hata/uyumsuzlukların tespiti ve sitenin iyileştirilmesi.</li>
                <li>Açık rızanız olması halinde kampanya ve yeni ürün bilgilendirmeleri.</li>
              </ul>
            </Block>

            <Block title="4. Hukuki Sebepler">
              <p className="mb-3">Kişisel verileriniz KVKK md. 5 uyarınca aşağıdaki hukuki sebeplere dayanılarak işlenir:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Sözleşmenin kurulması veya ifası için gerekli olması (teklif → sipariş → sevkiyat).</li>
                <li>Veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi (vergi/fatura mevzuatı).</li>
                <li>Bir hakkın tesisi, kullanılması veya korunması.</li>
                <li>İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla, veri sorumlusunun meşru menfaatleri (analitik, hizmet iyileştirme).</li>
                <li>Belirli durumlarda açık rızanız (pazarlama amaçlı iletişim).</li>
              </ul>
            </Block>

            <Block title="5. Aktarılan Taraflar">
              <p className="mb-3">Verileriniz, yalnızca aşağıdaki sınırlı kapsamda paylaşılabilir:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Sevkiyat, kargo ve nakliye iş ortaklarımız (teslimat amacıyla ad, telefon, adres).</li>
                <li>Yasal mercilerce talep edilmesi halinde yetkili kamu kurum ve kuruluşları.</li>
                <li>Teklif PDF&apos;lerinin saklandığı, KVKK uyumlu bulut hizmet sağlayıcımız (Supabase / AB ve TR sunucular).</li>
                <li>Mali müşavir, hukuk danışmanı ve denetim kuruluşları (yasal yükümlülük çerçevesinde).</li>
              </ul>
              <p className="mt-3 text-sm text-hub-ink-2">
                Üçüncü taraflara açık rızanız olmadan pazarlama amacıyla veri aktarımı yapılmaz.
              </p>
            </Block>

            <Block title="6. Saklama Süresi">
              <p>
                Kişisel verileriniz, ilgili mevzuatta öngörülen saklama süreleri boyunca (vergi/fatura için 10 yıl, sözleşmesel ilişki için sözleşme süresi + 10 yıl)
                veya işleme amacının ortadan kalkmasına kadar saklanır. Süre sonunda veriler silinir, yok edilir veya anonim hale getirilir.
              </p>
            </Block>

            <Block title="7. Veri Güvenliği Tedbirleri">
              <p>
                Kişisel verilerinizin hukuka aykırı işlenmesini ve erişilmesini önlemek için idari ve teknik tedbirler alınır: erişim yetkilendirmesi,
                aktarım sırasında SSL/TLS şifreleme, sunucu güvenlik duvarı, düzenli yedekleme ve sızma testleri.
              </p>
            </Block>

            <Block title="8. İlgili Kişinin Hakları (KVKK md. 11)">
              <p className="mb-3">KVKK kapsamında her ilgili kişi şu haklara sahiptir:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Kişisel verilerinin işlenip işlenmediğini öğrenme.</li>
                <li>İşlenmişse buna ilişkin bilgi talep etme.</li>
                <li>Kişisel verilerin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme.</li>
                <li>Yurt içinde veya yurt dışında kişisel verilerin aktarıldığı üçüncü kişileri bilme.</li>
                <li>Eksik veya yanlış işlenmiş kişisel verilerin düzeltilmesini isteme.</li>
                <li>KVKK md. 7&apos;de öngörülen şartlar çerçevesinde silinmesini veya yok edilmesini isteme.</li>
                <li>Düzeltme, silme veya yok etme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme.</li>
                <li>İşlenen verilerin münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhine bir sonucun ortaya çıkmasına itiraz etme.</li>
                <li>Kanuna aykırı işleme nedeniyle zarara uğraması halinde zararın giderilmesini talep etme.</li>
              </ul>
            </Block>

            <Block title="9. Başvuru Yöntemi">
              <p className="mb-4">
                Yukarıda sayılan haklarınızı kullanmak için kimliğinizi tevsik edici bilgilerle birlikte aşağıdaki kanallardan birini tercih ederek bizimle iletişime geçebilirsiniz.
                Talebiniz, KVKK uyarınca en geç 30 gün içinde sonuçlandırılır.
              </p>
              <div className="grid sm:grid-cols-3 gap-3 mt-6">
                <ContactCard
                  Icon={Phone}
                  label="Telefon"
                  value={PHONE_DISPLAY}
                  href={`tel:${PHONE_TEL}`}
                />
                <ContactCard
                  Icon={EnvelopeSimple}
                  label="E-posta"
                  value={EMAIL}
                  href={`mailto:${EMAIL}`}
                />
                <ContactCard
                  Icon={MapPin}
                  label="Posta"
                  value={`${ADDRESS_LINE}, ${ADDRESS_CITY}`}
                />
              </div>
            </Block>

            <Block title="10. Değişiklikler">
              <p>
                İşbu Aydınlatma Metni; mevzuatta veya iş süreçlerimizde meydana gelen değişiklikler doğrultusunda güncellenebilir.
                Güncellenen metin yayım tarihi itibarıyla yürürlüğe girer; en güncel sürüm her zaman bu sayfadan ulaşılabilir.
              </p>
            </Block>

            {/* Alt CTA */}
            <div className="pt-8 border-t border-hub-rule flex flex-wrap items-center justify-between gap-4">
              <p className="text-hub-ink-2 text-sm">
                Sorularınız için iletişim sayfamızı kullanabilirsiniz.
              </p>
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

function ContactCard({
  Icon,
  label,
  value,
  href,
}: {
  Icon: typeof Phone;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="bg-hub-warm rounded-xl ring-1 ring-hub-rule p-4 h-full">
      <div className="flex items-center gap-2 mb-2 text-hub-gold">
        <Icon weight={ICON_WEIGHT} size={18} />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className="text-hub-ink font-medium text-sm leading-snug break-words">
        {value}
      </div>
    </div>
  );

  if (!href) return content;

  // Telefon linkleri için GA4 "Telefon_Aramalari" event'ini tetikle
  if (href.startsWith('tel:')) {
    return (
      <PhoneCallLink href={href} source="kvkk_phone" className="block hover:opacity-90 transition-opacity">
        {content}
      </PhoneCallLink>
    );
  }

  return (
    <a href={href} className="block hover:opacity-90 transition-opacity">
      {content}
    </a>
  );
}
