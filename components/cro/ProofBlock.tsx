import Image from 'next/image';
import { FileText, Truck, BuildingOffice, ShieldCheck, ChatCircle, Package, MapPin } from '@phosphor-icons/react/dist/ssr';
import { ICON_WEIGHT } from '@/lib/design/tokens';

const TRUST_ROW = [
  { Icon: ShieldCheck, t: 'TSE & CE belgeli sistem', d: 'Tüm kalemler standartlara uygun, raporlu.' },
  { Icon: BuildingOffice, t: 'ÖzerGrup — 2006', d: 'Yalıtım ve izolasyon alanında 19 yıl.' },
  { Icon: Truck, t: '81 il sevkiyat', d: 'Kısmi yükten tam araca her ölçek.' },
] as const;

const SEVKIYAT_AKISI = [
  { Icon: ChatCircle, t: 'Sipariş onayı', d: 'PDF teklifteki referans no ile WhatsApp\'tan onay.' },
  { Icon: Package, t: 'Tuzla\'da yükleme', d: 'Paletli sayım, fotoğraflı çıkış kaydı.' },
  { Icon: MapPin, t: 'Bölgenize teslim', d: 'Sevkiyat tipine göre 1-5 iş günü içinde sahada.' },
] as const;

export function ProofBlock() {
  return (
    <section
      aria-labelledby="proof-baslik"
      className="bg-fe-raised/40 py-16 sm:py-24"
    >
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="text-center max-w-[680px] mx-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Söz Değil, Kanıt
          </p>
          <h2
            id="proof-baslik"
            className="mt-3 font-heading font-extrabold text-[28px] sm:text-[36px] leading-[1.15] tracking-tight text-fe-text"
          >
            Referanslı PDF teklif, paletli sevkiyat, kayıtlı süreç
          </h2>
          <p className="mt-4 text-sm sm:text-base text-fe-muted leading-relaxed">
            Teklifte ürün kalemleri, m² maliyeti, referans kodu ve güncel hesap bilgileri yer alır. Sipariş onayından sonra stok ve sevkiyat koşulları netleştirilir.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PDF kartı */}
          <div className="rounded-2xl border border-fe-border/40 bg-fe-raised/40 p-6">
            <div className="flex items-center gap-3">
              <FileText size={26} weight={ICON_WEIGHT} className="text-brand" aria-hidden />
              <h3 className="text-lg font-semibold text-fe-text">Örnek PDF teklif</h3>
            </div>
            <p className="mt-2 text-sm text-fe-muted leading-relaxed">
              Taşyünü Fiyatları; Filli Boya, Tekno ve Bestkim ürünlerini Özergrup tedarik altyapısı üzerinden hesaplayan teklif ve maliyet ekranıdır.
              <span className="block mt-1.5 text-xs text-fe-muted/80">
                Aşağıdaki örnek anonimleştirilmiştir; tarih ve referans numarası gerçek teklifte sizin tarihinizle yenilenir.
              </span>
            </p>
            <div className="mt-5 overflow-hidden rounded-lg border border-fe-border/30 bg-fe-surface/40">
              <Image
                src="/images/ornek-pdf.webp"
                alt="Anonimleştirilmiş örnek mantolama PDF teklifi"
                width={800}
                height={1100}
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Sağ kolon — Depo kartı + Sevkiyat süreci kartı dikey stack */}
          <div className="flex flex-col gap-6">
            {/* Depo kartı */}
            <div className="rounded-2xl border border-fe-border/40 bg-fe-raised/40 p-6">
              <div className="flex items-center gap-3">
                <BuildingOffice size={26} weight={ICON_WEIGHT} className="text-brand" aria-hidden />
                <h3 className="text-lg font-semibold text-fe-text">Depodan paletli yükleme</h3>
              </div>
              <p className="mt-2 text-sm text-fe-muted leading-relaxed">
                Ürünler sevkiyat öncesi sayılır, paletli hazırlanır ve yükleme kaydıyla çıkar.
              </p>
              <div className="mt-5 overflow-hidden rounded-lg border border-fe-border/30 bg-fe-surface/40">
                <Image
                  src="/images/depo.webp"
                  alt="ÖzerGrup Tuzla deposundan paletli sevkiyat çıkışı"
                  width={1200}
                  height={800}
                  className="w-full h-auto"
                />
              </div>
            </div>

            {/* Sevkiyat akışı — 3 adım, depo kartının altında dengeleyici */}
            <div className="flex-1 rounded-2xl border border-fe-border/40 bg-fe-raised/40 p-6">
              <div className="flex items-center gap-3">
                <Truck size={26} weight={ICON_WEIGHT} className="text-brand" aria-hidden />
                <h3 className="text-lg font-semibold text-fe-text">Onaydan teslimata 3 adım</h3>
              </div>
              <p className="mt-2 text-sm text-fe-muted leading-relaxed">
                PDF onayı, depo yüklemesi ve bölgenize teslim süreci net ilerler.
              </p>
              <ol className="mt-5 space-y-5">
                {SEVKIYAT_AKISI.map((s, i) => (
                  <li key={s.t} className="flex items-start gap-4">
                    <span
                      aria-hidden
                      className="font-mono text-sm font-semibold text-brand/70 leading-none mt-1 tabular-nums shrink-0 w-5"
                    >
                      0{i + 1}
                    </span>
                    <s.Icon size={22} weight={ICON_WEIGHT} className="mt-0.5 shrink-0 text-brand/80" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-fe-text leading-snug">{s.t}</p>
                      <p className="mt-0.5 text-xs text-fe-muted leading-relaxed">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {TRUST_ROW.map(({ Icon, t, d }) => (
            <div key={t} className="flex items-start gap-3 rounded-2xl border border-fe-border/40 bg-fe-surface/60 p-4">
              <Icon size={22} weight={ICON_WEIGHT} className="mt-0.5 shrink-0 text-brand" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-fe-text">{t}</p>
                <p className="mt-0.5 text-xs text-fe-muted">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
