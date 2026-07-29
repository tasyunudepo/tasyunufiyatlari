import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { BUSINESS_INFO } from '@/lib/business/info';
import {
    getShippingPresentation,
    type ShippingMode,
} from '@/lib/pricing/commercialRules';

export interface QuotePDFResult {
    blobUrl: string;
    blob: Blob;
    filename: string;
}

// --- Yardımcı Fonksiyonlar ---

function escapeHtml(input: string): string {
    if (!input) return '';
    return String(input)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function trToAscii(input: string): string {
    if (!input) return '';
    return input
        .normalize('NFD') // Karakteri ve aksanı ayırır (örn: ö -> o + ¨)
        .replace(/[\u0300-\u036f]/g, '') // Aksanları siler
        .replace(/İ/g, 'I') // NFD 'İ'yi bazen doğru ayıramaz, manuel fix
        .replace(/ı/g, 'i')
        .replace(/Ğ/g, 'G')
        .replace(/ğ/g, 'g')
        .replace(/Ş/g, 'S')
        .replace(/ş/g, 's');
}

// Container içindeki tüm resimlerin yüklenmesini bekleyen Promise
const waitForImages = (element: HTMLElement): Promise<void> => {
    const images = Array.from(element.querySelectorAll('img'));
    const promises = images.map((img) => {
        if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve(); // Hata alsa bile süreci kilitlememeli
        });
    });
    return Promise.all(promises).then(() => { });
};

// --- Tipler ---

export interface PDFQuoteItem {
    description: string;
    quantity: number;
    unit: string;
    consumptionRate: number;
    unitPrice: number;
    totalPrice: number;
    isPlate?: boolean;
    packageCount?: number;
}

export interface PDFQuoteData {
    packageName: string;
    packageDescription: string;
    plateBrandName: string;
    accessoryBrandName: string;
    metraj: number | string;
    thickness: string;
    materialType: 'tasyunu' | 'eps';
    cityName: string;
    grandTotal: number;
    pricePerM2: number;
    totalProductCost: number;
    shippingCost: number;
    priceWithoutVat: number;
    vatAmount: number;
    refCode: string;
    validityDate?: string;
    whatsappOrderLink: string;
    customerCompany: string;
    relatedPerson: string;
    deliveryAddress: string;
    phone: string;
    email: string;
    city?: string;
    district?: string;
    materialLongName?: string;
    systemDescription?: string;
    items: PDFQuoteItem[];
    isShippingIncluded?: boolean;
    shippingMode?: ShippingMode;
    shippingWarning?: string;
    specialOrderNote?: string;
}

function buildSafeFileName(data: PDFQuoteData): string {
    const safeStr = (s: string) => trToAscii(s || '').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    let namePart = safeStr(data.customerCompany);
    if (!namePart || namePart.length < 2) {
        namePart = safeStr(data.relatedPerson);
    }

    const metrajPart = `${data.metraj}m2`;
    const thicknessPart = `${data.thickness}cm`;
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    return `TY-Teklif_${namePart}_${metrajPart}_${thicknessPart}_${datePart}.pdf`;
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 6): number {
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + (lines.length * lineHeight);
}

function generateFallbackQuotePDF(data: PDFQuoteData): QuotePDFResult {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
    });

    const fmtMoney = (v: number) => `${v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
    let y = 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Mantolama Seti Fiyat Teklifi', 14, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Referans: ${data.refCode}`, 14, y);
    doc.text(`Tarih: ${new Date().toLocaleString('tr-TR')}`, 140, y, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('Musteri Bilgileri', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    y = addWrappedText(doc, `Firma: ${data.customerCompany || '-'}`, 14, y, 180);
    y = addWrappedText(doc, `Ilgili Kisi: ${data.relatedPerson}`, 14, y, 180);
    y = addWrappedText(doc, `Telefon: ${data.phone}`, 14, y, 180);
    y = addWrappedText(doc, `Mail: ${data.email || '-'}`, 14, y, 180);
    y = addWrappedText(doc, `Adres: ${data.deliveryAddress || '-'}`, 14, y, 180);
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('Sistem Bilgileri', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    y = addWrappedText(doc, `Paket: ${data.packageName}`, 14, y, 180);
    y = addWrappedText(doc, `Sistem: ${data.systemDescription || '-'}`, 14, y, 180);
    y = addWrappedText(doc, `Sehir: ${data.city || data.cityName}`, 14, y, 180);
    y = addWrappedText(doc, `Metraj: ${data.metraj} m2`, 14, y, 180);
    y = addWrappedText(doc, `Kalinlik: ${data.thickness} cm`, 14, y, 180);
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('Kalemler', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    data.items.forEach((item, index) => {
        if (y > 260) {
            doc.addPage();
            y = 16;
        }
        y = addWrappedText(
            doc,
            `${index + 1}. ${item.description} | Miktar: ${item.quantity} ${item.unit} | Birim: ${fmtMoney(item.unitPrice)} | Tutar: ${fmtMoney(item.totalPrice)}`,
            14,
            y,
            182,
            5
        );
        y += 1;
    });

    if (y > 240) {
        doc.addPage();
        y = 16;
    }

    y += 4;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Ara Toplam: ${fmtMoney(data.priceWithoutVat)}`, 14, y);
    y += 7;
    doc.text(`KDV: ${fmtMoney(data.vatAmount)}`, 14, y);
    y += 7;
    doc.text(`Genel Toplam: ${fmtMoney(data.grandTotal)}`, 14, y);
    y += 7;
    doc.text(`m² Fiyat (KDV Hariç): ${fmtMoney(data.pricePerM2)}`, 14, y);

    const filename = buildSafeFileName(data);
    const blob = doc.output('blob') as Blob;
    const blobUrl = URL.createObjectURL(blob);
    doc.save(filename);
    return { blobUrl, blob, filename };
}

// --- Ana Fonksiyon ---

export async function generateQuotePDF(data: PDFQuoteData): Promise<QuotePDFResult> {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const html2canvas = (await import('html2canvas')).default;

        // --- Tasarım Sabitleri (Design System) ---
        const COLORS = {
            slate900: '#0f172a', // Başlıklar ve Ana Çerçeveler
            slate700: '#334155', // Alt metinler
            slate600: '#475569', // Ara metinler
            slate500: '#64748b', // Pasif metinler
            slate300: '#cbd5e1', // Açık gri border/metin
            slate100: '#f1f5f9', // Tablo zebra
            slate200: '#e2e8f0', // Hafif borderlar
            orange600: '#a07a2c', // Vurgu / CTA — hub-gold
            orange100: '#f8efd3', // Vurgu zemin — light gold
            green600: '#16a34a', // Başarı / Onay
            border: '#cbd5e1',   // Genel border (Açık Lacivert/Gri)
        };

        // SELLER bilgileri — telefon ve adres BUSINESS_INFO'dan tek kaynaktan.
        const SELLER = {
            name: BUSINESS_INFO.legalName.toLocaleUpperCase('tr-TR'),
            address: `${BUSINESS_INFO.address.streetAddress} ${BUSINESS_INFO.address.addressLocality} / ${BUSINESS_INFO.address.addressRegion}`,
            phones: BUSINESS_INFO.phone.display,
            website: 'www.ozeryapiinsaat.com',
        };

        // Bankaları sadeleştir (Sadece ilk 2'sini gösterelim, kalabalık yapmasın)
        const ALL_BANKS = [
            { bank: 'KUVEYTTÜRK', iban: 'TR22 0020 5000 0947 0027 8000 01', currency: 'TL' },
            { bank: 'VAKIFBANK', iban: 'TR54 0001 5001 5800 7223 2324 14', currency: 'TL' },
        ];

        // Hesaplamalar ve Formatlama
        const metrajValue = typeof data.metraj === 'string' ? Number(data.metraj) || 0 : data.metraj;
        const today = new Date().toLocaleString('tr-TR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        const materialLabel = data.materialType === 'tasyunu' ? 'Taşyünü' : 'EPS';
        const shippingMode: ShippingMode = data.shippingMode
            ?? (data.isShippingIncluded ? 'included_in_sale_price' : 'buyer_pays');
        const shippingPresentation = getShippingPresentation(shippingMode);
        // M2 Fiyatını data'dan alalım yoksa hesaplayalım
        const calculatedM2Price = data.pricePerM2 > 0 ? data.pricePerM2 : (metrajValue > 0 ? data.grandTotal / metrajValue : 0);

        const fmtMoney = (v: number) => `${v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
        const fmtQty = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        const fmtRate = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

        const qrDataUrl = await QRCode.toDataURL(data.whatsappOrderLink, { margin: 1, width: 256, color: { dark: COLORS.slate900, light: '#ffffff' } });

        // --- Container Oluşturma ---
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-10000px';
        container.style.top = '0';
        container.style.width = '794px'; // A4 Width
        container.style.background = '#fff';
        container.style.color = COLORS.slate900;
        container.style.padding = '40px';
        container.style.boxSizing = 'border-box';
        // Font: Sistem fontları ile clean bir görünüm ve TABULAR NUMS (Rakam hizalama)
        container.style.fontFamily = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
        container.style.lineHeight = '1.4';
        container.style.fontVariantNumeric = 'tabular-nums';

        // --- HTML İçeriği ---

        // 1. Tablo Satırları (0 TL sorunu çözülmüş halde)
        const itemsHtml = data.items
            .map((it, idx) => {
                const bg = idx % 2 === 0 ? '#fff' : COLORS.slate100;

                // 0 TL ise "Paket İçeriği" yaz, değilse fiyatı bas.
                // Eğer ürün bir LEVHA (Ana Ürün) ise, fiyat 0 olsa bile göster ki hata olduğu anlaşılsın.
                //
                // NEGATİF fiyat "paket içeriği" DEĞİLDİR: ofis teklifinde toplu
                // alım iskontosu negatif kalem satırı olarak basılıyor. Eski
                // `it.unitPrice < 0.01` kontrolü negatifi de yutuyordu ve
                // iskonto satırı tutar yerine "📦 Paket İçeriği" gösteriyordu.
                const isZeroPrice = it.unitPrice >= 0 && it.unitPrice < 0.01 && !it.isPlate;
                const unitPriceDisplay = isZeroPrice
                    ? `<span style="font-size:10px;color:#64748b;font-style:italic;background:#f1f5f9;padding:2px 6px;border-radius:4px;">📦 Paket İçeriği</span>`
                    : fmtMoney(it.unitPrice);

                // Levha için paket sayısı ekle — paket bilgisi yoksa
                // "(0 PKT)" yazmak yanlış bilgi olur, hiç yazma.
                const description = it.isPlate && (it.packageCount ?? 0) > 0
                    ? `${it.description} (${it.packageCount} PKT)`
                    : it.description;

                const totalDisplay = isZeroPrice
                    ? `<span style="color:#94a3b8;">-</span>`
                    : `<strong>${fmtMoney(it.totalPrice)}</strong>`;

                return `
          <tr style="background-color: ${bg}; border-bottom:1px solid ${COLORS.border};">
            <td style="padding:8px;font-size:11px;text-align:center;color:${COLORS.slate700};font-feature-settings:'tnum';">${idx + 1}</td>
            <td style="padding:8px;font-size:11px;font-weight:600;color:${COLORS.slate900};">${escapeHtml(description)}</td>
            <td style="padding:8px;font-size:11px;text-align:center;font-feature-settings:'tnum';">${escapeHtml(fmtQty(it.quantity))}</td>
            <td style="padding:8px;font-size:11px;text-align:center;color:${COLORS.slate700};">${escapeHtml(it.unit)}</td>
            <td style="padding:8px;font-size:11px;text-align:center;color:${COLORS.slate700};font-feature-settings:'tnum';">${escapeHtml(fmtRate(it.consumptionRate))}</td>
            <td style="padding:8px;font-size:11px;text-align:right;font-feature-settings:'tnum';">${unitPriceDisplay}</td>
            <td style="padding:8px;font-size:11px;text-align:right;font-feature-settings:'tnum';">${totalDisplay}</td>
          </tr>
        `;
            })
            .join('');

        // 2. Banka Satırları
        const bankRows = ALL_BANKS.map(
            (b) => `
        <div style="display:flex;justify-content:space-between;font-size:9px;border-bottom:1px solid ${COLORS.border};padding:4px 0;">
            <span style="font-weight:700;width:80px;">${b.bank}:</span>
            <span style="font-family:monospace;color:${COLORS.slate700};">${b.iban}</span>
        </div>
      `
        ).join('');

        container.innerHTML = `
      <!-- Header Area - Clean UI -->
      <div style="margin-bottom:24px;">
        <!-- HEADER: Logo (Sol) + İletişim (Sağ) -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:2px solid ${COLORS.slate900};">
             <!-- Sol: Ana Firma Logosu -->
             <img src="/images/teklifpdf/logo_dark.png?v=${Date.now()}" style="height:50px;width:auto;" onerror="this.style.display='none'" />
             
             <!-- Sağ: İletişim Bilgileri -->
             <div style="text-align:right;font-size:11px;color:${COLORS.slate700};line-height:1.5;">
                <div style="font-weight:700;color:${COLORS.slate900};margin-bottom:2px;">${SELLER.name}</div>
                <div>${SELLER.address}</div>
                <div style="margin-top:2px;">
                  <span style="font-weight:600;">Tel:</span> ${SELLER.phones} | 
                  <span style="font-weight:600;">Web:</span> ${SELLER.website}
                </div>
             </div>
        </div>

        <!-- Başlık (Header Altında) -->
        <div style="margin-top:16px;padding-bottom:12px;border-bottom:1px solid ${COLORS.border};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <h1 style="margin:0 0 2px 0;font-size:16px;font-weight:800;color:${COLORS.slate900};letter-spacing:-0.3px;">MANTOLAMA SETİ FİYAT TEKLİFİ</h1>
              <div style="font-size:12px;font-weight:700;color:${COLORS.orange600};">Teklif No: ${escapeHtml(data.refCode)}</div>
            </div>
            <div style="font-size:11px;color:${COLORS.slate700};text-align:right;">Tarih: <b>${escapeHtml(today)}</b></div>
          </div>
        </div>
      </div>

      <!-- HERO SECTION -->
      <div style="display:flex;gap:16px;margin-bottom:24px;">
         <!-- Sol: Proje Detayları -->
         <div style="flex:1.5;background:#fff;border:1px solid ${COLORS.border};border-radius:8px;padding:16px;">
            <h3 style="margin:0 0 12px 0;font-size:12px;text-transform:uppercase;color:${COLORS.slate700};letter-spacing:1px;border-bottom:1px solid ${COLORS.border};padding-bottom:4px;">MÜŞTERİ & PROJE BİLGİLERİ</h3>
            <div style="display:grid;grid-template-columns: 1fr 1fr;gap:12px;font-size:11px;">
                <div>
                    <div style="color:${COLORS.slate700};font-size:10px;">Sayın / Firma</div>
                    <div style="font-weight:700;color:${COLORS.slate900};font-size:12px;">${escapeHtml(data.customerCompany || data.relatedPerson)}</div>
                </div>
                <div>
                    <div style="color:${COLORS.slate700};font-size:10px;">Lokasyon / Bölge</div>
                    <div style="font-weight:600;color:${COLORS.slate900};">${escapeHtml(data.city || data.cityName)} / ${escapeHtml(data.district || '-')}</div>
                </div>
                <div>
                    <div style="color:${COLORS.slate700};font-size:10px;">Telefon</div>
                    <div style="font-weight:600;color:${COLORS.slate900};">${escapeHtml(data.phone)}</div>
                </div>
                <div>
                     <div style="color:${COLORS.slate700};font-size:10px;">Seçilen Sistem</div>
                     <div style="font-weight:600;color:${COLORS.slate900};">${
                         // Beyaz PDF zemininde markanın kırmızı logosu kullanılır
                         // (koyu site zemininde beyaz versiyon: bonus-logo.svg).
                         data.plateBrandName?.startsWith('Bonus')
                             ? `<img src="/images/markalogolar/bonus-logo-red.svg" style="height:16px;width:auto;vertical-align:middle;margin-right:6px;" onerror="this.style.display='none'" />`
                             : ''
                     }${escapeHtml(data.systemDescription || `${materialLabel} ${data.thickness} cm`)}</div>
                </div>
            </div>
         </div>

         <!-- Sağ: Fiyat Vurgusu (Hero - Technical Card Style) -->
         <!-- Zemin BEYAZ, Border LACİVERT, Yazılar LACİVERT -->
         <div style="flex:1; background:#fff; border:2px solid ${COLORS.slate900}; border-radius:8px; padding:16px; display:flex; flex-direction:column; justify-content:center;">
            
            <!-- Karar (Emrah, 24 Temmuz 2026): kutunun kahramanı TOPLAM
                 METRAJ — en üstte ve büyük. KDV dahil/hariç m² fiyatları
                 altta EŞİT boyutta iki satır. Değer tabanları değişmedi:
                 dahil = calculatedM2Price × 1,2 (ekran kartıyla aynı),
                 hariç = calculatedM2Price. -->
            <div style="font-size:11px; font-weight:700; color:${COLORS.slate700}; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">Toplam Metraj</div>

            <div style="font-size:34px; font-weight:800; color:${COLORS.slate900}; line-height:1; margin-bottom:10px; font-feature-settings:'tnum';">
                ${(data.items[0]?.quantity || metrajValue).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                <span style="font-size:16px; font-weight:600; color:${COLORS.slate500};">m²</span>
            </div>

            <div style="padding-top:8px; border-top:2px solid ${COLORS.border}; font-size:10px; font-weight:700; color:${COLORS.slate700}; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">${shippingPresentation.heroLabel}</div>

            <!-- KDV DAHİL: ekrandaki 3 paket kartıyla aynı taban (PackageCard m2PriceWithVat) -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-size:11px; font-weight:600; color:${COLORS.slate700};">KDV DAHİL</span>
                <span style="font-size:15px; font-weight:800; color:${COLORS.slate900}; font-feature-settings:'tnum';">${escapeHtml(fmtMoney(calculatedM2Price * 1.2))} / m²</span>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                <span style="font-size:11px; font-weight:600; color:${COLORS.slate700};">KDV hariç</span>
                <span style="font-size:15px; font-weight:800; color:${COLORS.slate900}; font-feature-settings:'tnum';">${escapeHtml(fmtMoney(calculatedM2Price))} / m²</span>
            </div>
         </div>
      </div>

      <!-- Tablo -->
      <table style="width:100%;border-collapse:separate;border-spacing:0;margin-bottom:20px;border:1px solid ${COLORS.border};border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background-color:${COLORS.slate900};color:white;">
            <th style="padding:10px;font-size:10px;font-weight:600;text-align:center;width:30px;">NO</th>
            <th style="padding:10px;font-size:10px;font-weight:600;text-align:left;">ÜRÜN / HİZMET DETAYI</th>
            <th style="padding:10px;font-size:10px;font-weight:600;text-align:center;width:50px;">MİKTAR</th>
            <th style="padding:10px;font-size:10px;font-weight:600;text-align:center;width:40px;">BİRİM</th>
            <th style="padding:10px;font-size:10px;font-weight:600;text-align:center;width:50px;">SARF.</th>
            <th style="padding:10px;font-size:10px;font-weight:600;text-align:right;width:80px;">BİRİM FİYAT<br />(KDV HARİÇ)</th>
            <th style="padding:10px;font-size:10px;font-weight:600;text-align:right;width:110px;">TUTAR<br />(KDV HARİÇ)</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Alt Bölüm: Toplamlar ve Notlar -->
      <div style="display:flex;gap:32px;align-items:flex-start;">
        
        <!-- Sol: Şartlar ve Banka (Temiz Görünüm) -->
        <div style="flex:1.4;">
            <!-- BANKA HESAP BİLGİLERİ (Sabit, En Üstte) -->
            <div style="margin-bottom:16px;">
                <h4 style="font-size:11px;font-weight:700;margin:0 0 6px 0;color:${COLORS.slate900};">BANKA HESAP BİLGİLERİ</h4>
                <div style="border:1px solid ${COLORS.border};border-radius:6px;padding:8px;background:#f8fafc;">
                    ${bankRows}
                </div>
            </div>

            <!-- DİKKAT: TEKLİF REFERANS NOTU (Banka Altında) -->
            <div style="background:${COLORS.orange100};border-left:4px solid ${COLORS.orange600};padding:8px 12px;border-radius:0 4px 4px 0;margin-bottom:12px;">
                <div style="font-weight:700;font-size:11px;color:${COLORS.orange600};display:flex;align-items:center;gap:6px;">
                    ⚠️ DİKKAT: TEKLİF REFERANS NOTU
                </div>
                <div style="font-size:10px;color:${COLORS.slate700};margin-top:2px;">
                    Bu PDF teklif kaydı referans kodu ve güncel hesap bilgileriyle oluşturulmuştur. Stok, ödeme ve sevkiyat koşulları satış ekibi görüşmesinde netleştirilir.
                </div>
            </div>

            <div style="margin-bottom:12px;">
                <h4 style="font-size:11px;font-weight:700;margin:0 0 4px 0;color:${COLORS.slate900};">ÖNEMLİ NOTLAR</h4>
                <ul style="margin:0;padding-left:16px;font-size:10px;color:${COLORS.slate700};line-height:1.4;">
                    <li>Birim fiyatlar ve ara toplam <strong>KDV HARİÇTİR</strong>; KDV genel toplamda ayrıca gösterilir. Nakliye <strong>${shippingPresentation.termsLabel}.</strong></li>
                    ${data.shippingWarning ? `<li style="color:${COLORS.orange600}; font-weight:700;">${escapeHtml(data.shippingWarning)}</li>` : ''}
                    ${data.specialOrderNote ? `<li style="color:${COLORS.orange600}; font-weight:700;">⭐ Büyük Metraj — Özel Teklif: ${escapeHtml(data.specialOrderNote)}</li>` : ''}
                    <li>Ürünler şantiyeye teslimdir, indirme alıcıya aittir.</li>
                    <li>Sipariş onayı ile birlikte ödeme talep edilir.</li>
                </ul>
            </div>
            <!-- MÜŞTERİ ONAYI (ÖNEMLİ NOTLAR Altında) -->
            <div style="margin-top:20px;padding-top:12px;border-top:1px solid ${COLORS.slate200};">
                <h4 style="font-size:9px;font-weight:600;margin:0 0 8px 0;color:${COLORS.slate500};text-transform:uppercase;letter-spacing:0.5px;">Müşteri Onayı</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px;">
                    <div>
                        <div style="font-size:8px;color:${COLORS.slate600};margin-bottom:2px;">İsim - Soyisim</div>
                        <div style="border-bottom:1px solid ${COLORS.slate300};height:20px;"></div>
                    </div>
                    <div>
                        <div style="font-size:8px;color:${COLORS.slate600};margin-bottom:2px;">Tarih</div>
                        <div style="border-bottom:1px solid ${COLORS.slate300};height:20px;"></div>
                    </div>
                </div>
                <div>
                    <div style="font-size:8px;color:${COLORS.slate600};margin-bottom:2px;">İmza ve Kaşe (opsiyonel)</div>
                    <div style="border-bottom:1px solid ${COLORS.slate300};height:24px;"></div>
                </div>
            </div>

        </div>

        <!-- Sağ: Büyük Toplam Kartı -->
        <div style="flex:1;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <tr>
                    <td style="padding:8px 0;color:${COLORS.slate700};border-bottom:1px solid ${COLORS.border};">Ara Toplam</td>
                    <td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid ${COLORS.border};">${escapeHtml(fmtMoney(data.priceWithoutVat))}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0;color:${COLORS.slate700};border-bottom:1px solid ${COLORS.border};">KDV (%20)</td>
                    <td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid ${COLORS.border};">${escapeHtml(fmtMoney(data.vatAmount))}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0;color:${shippingPresentation.isIncluded ? COLORS.green600 : COLORS.orange600};font-weight:600;font-size:11px;border-bottom:1px solid ${COLORS.border};">${shippingPresentation.isIncluded ? '✅ Nakliye Hizmeti' : '⚠️ Nakliye Durumu'}</td>
                    <td style="padding:8px 0;text-align:right;color:${shippingPresentation.isIncluded ? COLORS.green600 : COLORS.orange600};font-size:11px;font-weight:600;border-bottom:1px solid ${COLORS.border};">${shippingPresentation.statusLabel}</td>
                </tr>
            </table>
            
            <!-- TOPLAM TEKLİF BEDELİ - Kurumsal Vurgu -->
            <div style="margin-top:16px;background:${COLORS.slate900};padding:20px;border-radius:4px;">
                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">ÖDENECEK GENEL TOPLAM</div>
                <div style="display:flex;align-items:baseline;justify-content:flex-end;gap:4px;">
                    <span style="font-size:28px;font-weight:800;color:#ffffff;font-feature-settings:'tnum';">${escapeHtml(data.grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</span>
                    <span style="font-size:18px;font-weight:700;color:${COLORS.orange600};">₺</span>
                </div>
                <div style="font-size:9px;color:#64748b;text-align:right;margin-top:4px;">KDV <span style="color:${COLORS.orange600};font-weight:600;">DAHİL</span> | NAKLİYE <span style="color:${shippingPresentation.isIncluded ? COLORS.green600 : COLORS.orange600};font-weight:600;">${shippingPresentation.footerLabel}</span></div>
            </div>

            <!-- QR ve Onay -->
            <div style="margin-top:16px;display:flex;align-items:center;justify-content:flex-end;gap:12px;">
                <div style="text-align:right;">
                    <div style="font-weight:700;font-size:11px;color:${COLORS.slate900};">SİPARİŞİ ONAYLA</div>
                    <div style="font-size:9px;color:${COLORS.slate700};">WhatsApp'tan iletmek için okutun →</div>
                </div>
                <img src="${qrDataUrl}" style="width:64px;height:64px;border:2px solid ${COLORS.slate900};border-radius:8px;padding:2px;" />
            </div>
        </div>

      </div>

      <!-- Footer: İletişim + Trust Badges (Tedarikçi Logoları) -->
      <div style="margin-top:32px;padding-top:16px;border-top:2px solid ${COLORS.border};">
        <!-- İletişim Bilgileri -->
        <div style="font-size:9px;color:${COLORS.slate700};text-align:center;margin-bottom:12px;">
          <span style="font-weight:700;color:${COLORS.slate900};">${SELLER.name}</span> | 
          ${SELLER.address} | 
          ${SELLER.phones} | 
          ${SELLER.website}
        </div>

        <!-- Trust Badges: Tedarikçi Logoları (Grayscale + Opacity) -->
        <div style="text-align:center;margin-top:12px;">
          <img 
            src="/images/teklifpdf/bannerozeryapi.png?v=${Date.now()}" 
            style="
              width:100%;
              height:auto;
              max-height:40px;
              object-fit:contain;
              filter:grayscale(100%);
              opacity:0.5;
            " 
            alt="Trust Badges"
          />
        </div>
      </div>
    `;

        document.body.appendChild(container);

        try {
            // ÖNCE görsellerin yüklenmesini bekle (race condition önleme)
            await waitForImages(container);

            // Scale 1.5 (optimal: kalite vs boyut dengesi)
            // PNG yerine JPEG kullanarak dosya boyutunu ~80% küçült
            const canvas = await html2canvas(container, {
                scale: 1.5,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false, // Konsol kirliliğini önler
                allowTaint: true // CDN veya dış kaynaklı görseller için
            });

            // JPEG format (0.85 quality) - PNG'ye göre çok daha küçük dosya
            const imgData = canvas.toDataURL('image/jpeg', 0.85);

            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true // PDF compression
            });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // Tek sayfa: Eğer içerik sayfadan taşıyorsa otomatik küçült
            let finalWidth = imgWidth;
            let finalHeight = imgHeight;

            if (imgHeight > pageHeight) {
                // İçerik taşıyor, A4'e sığdır
                const scaleFactor = pageHeight / imgHeight;
                finalHeight = pageHeight;
                finalWidth = imgWidth * scaleFactor;
            }

            doc.addImage(imgData, 'JPEG', 0, 0, finalWidth, finalHeight, undefined, 'FAST');

            const filename = buildSafeFileName(data);
            const blob = doc.output('blob') as Blob;
            const blobUrl = URL.createObjectURL(blob);
            doc.save(filename);
            return { blobUrl, blob, filename };
        } catch (error) {
            console.error('Rich PDF render failed, falling back to basic PDF:', error);
            return generateFallbackQuotePDF(data);
        } finally {
            container.remove();
        }
    }
    return { blobUrl: '', blob: new Blob(), filename: '' };
}
