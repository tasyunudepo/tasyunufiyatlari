import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { collapseRepeatedWords } from '@/lib/catalog/productLabel';
import { toPdfRect } from '@/lib/pdf/portfolioSection';
import { buildQrOrderLink, buildQuoteDocument } from '@/lib/pdf/quoteDocument';
import { QUOTE_DOCUMENT_CSS, SHEET_WIDTH_PX } from '@/lib/pdf/quoteDocumentStyles';
import { paginateQuoteDocument } from '@/lib/pdf/quotePagination';
import { addInvisibleTextLayer, loadTextLayerFont, registerTextLayerFont } from '@/lib/pdf/textLayer';
import type { ShippingMode } from '@/lib/pricing/commercialRules';
import { formatTechnicalConsumption } from '@/lib/quote/technicalConsumption';
import type { TechnicalConsumptionUnit } from '@/lib/types';

export interface QuotePDFResult {
    blobUrl: string;
    blob: Blob;
    filename: string;
}

// --- Yardımcı Fonksiyonlar ---

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
    consumptionUnit?: TechnicalConsumptionUnit;
    unitPrice: number;
    totalPrice: number;
    isPlate?: boolean;
    packageCount?: number;
    /** Levha satırının altına yazılan teknik not (ör. "Yoğunluk: 70 kg/m³ · Föy beyanı"). */
    technicalNote?: string | null;
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

function generateFallbackQuotePDF(input: PDFQuoteData): QuotePDFResult {
    const data: PDFQuoteData = {
        ...input,
        systemDescription: collapseRepeatedWords(input.systemDescription),
        packageName: collapseRepeatedWords(input.packageName),
        items: input.items.map((item) => ({ ...item, description: collapseRepeatedWords(item.description) })),
    };
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
            `${index + 1}. ${item.description} | Miktar: ${item.quantity} ${item.unit} | Sarfiyat: ${formatTechnicalConsumption(item.consumptionRate, item.consumptionUnit)} | Birim: ${fmtMoney(item.unitPrice)} | Tutar: ${fmtMoney(item.totalPrice)}`,
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
//
// Belge sitenin içinde, ekran dışındaki bir kapta kurulur, A4 sayfalarına
// bölünür ve her sayfa ayrı bir görüntü olarak PDF'e konur. İçerik
// küçültülmez: sığmayan blok sonraki sayfaya geçer.
//
//   blokları üretir   lib/pdf/quoteDocument.ts   (şablon ve metinler)
//   sayfalara böler   lib/pdf/quotePagination.ts
//   stil              lib/pdf/quoteDocumentStyles.ts

/** Belgenin yazı tipleri yüklenmeden ölçüm yapılmaz; sayfa kesimi kayar. */
async function loadDocumentFonts(root: HTMLElement): Promise<void> {
    if (!document.fonts) return;
    const style = getComputedStyle(root);
    const families = ['--font-geist-sans', '--font-barlow']
        .map((name) => style.getPropertyValue(name).trim())
        .filter(Boolean);
    const sample = 'Teklif İıŞşĞğÜüÖöÇç 0123456789';
    const loads = families.flatMap((family) =>
        [400, 600, 700, 800].map((weight) => document.fonts.load(`${weight} 12px ${family}`, sample).catch(() => [])),
    );
    // Yazı tipi gelmezse belge yedek yazı tipiyle basılır; üretim beklemede kalmaz.
    await Promise.race([
        Promise.all(loads).then(() => document.fonts.ready),
        new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
}

/**
 * jsPDF, görüntü akışını yazarken sıkıştırma filtresini belgenin ortak
 * listesinden çıkarır. Belge iki kez yazıldığı için (depoya giden kopya ve
 * indirilen dosya) ikinci yazımda sayfa içerikleri sıkıştırılmaz; metin
 * katmanıyla dosya ~100 KB büyür. Filtre her yazımdan önce geri konur.
 */
function restoreStreamCompression(doc: jsPDF): void {
    const filters = (doc.internal as unknown as { getFilters?: () => string[] }).getFilters?.();
    if (Array.isArray(filters) && !filters.includes('FlateEncode')) filters.push('FlateEncode');
}

export async function generateQuotePDF(data: PDFQuoteData): Promise<QuotePDFResult> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return { blobUrl: '', blob: new Blob(), filename: '' };
    }

    const html2canvas = (await import('html2canvas')).default;

    // Karekod sayfa görüntüsünün içinde kalırsa JPEG sıkıştırmasıyla
    // bulanır; ayrıca üretilir ve PDF'e kendi keskin görüntüsüyle basılır.
    // Kâğıttan okunabilsin diye kısa bağlantıyı taşır (bkz. buildQrOrderLink).
    const qrDataUrl = await QRCode.toDataURL(buildQrOrderLink(data.refCode), {
        margin: 2,
        width: 480,
        errorCorrectionLevel: 'M',
        color: { dark: '#141A16', light: '#ffffff' },
    });

    const parts = buildQuoteDocument(data, { qrDataUrl });

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.innerHTML = `<style>${QUOTE_DOCUMENT_CSS}</style><div class="tq${parts.single ? ' tq-single' : ''}"></div>`;
    document.body.appendChild(container);
    const root = container.querySelector('.tq') as HTMLElement;

    // html2canvas yazının taban çizgisini gövdeye eklediği 1 px'lik bir
    // resimle ölçer. Sitenin sıfırlama stili resimleri blok yaptığı için
    // ölçüm bir satır yüksekliği kadar büyük çıkar ve bütün yazı aşağı
    // kayar. Üretim süresince o ölçüm resmi satır içi tutulur.
    const baselineProbeFix = document.createElement('style');
    baselineProbeFix.textContent = 'body>div>img[width="1"][height="1"]{display:inline!important}';
    document.head.appendChild(baselineProbeFix);

    try {
        await loadDocumentFonts(root);
        const pages = paginateQuoteDocument(root, parts);
        // Görsellerin yüklenmesini bekle (race condition önleme)
        await waitForImages(container);

        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true,
        });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const mmPerPx = pageWidth / SHEET_WIDTH_PX;

        // Sayfa resim olduğu için yazı seçilemez; görünmez metin katmanı
        // IBAN'ı kopyalanır, belgeyi aranır yapar. Yazı tipi gelmezse
        // belge katmansız üretilir.
        const textFont = await loadTextLayerFont();
        if (textFont) registerTextLayerFont(doc, textFont);
        // Uzun ofis tekliflerinde dosya boyutu yükleme sınırını (5 MB) aşmasın.
        const scale = pages.length > 4 ? 1.5 : 2;

        for (let index = 0; index < pages.length; index += 1) {
            const page = pages[index];
            if (index > 0) doc.addPage();

            // Her sayfa ayrı görüntü: tek büyük tuval iOS Safari'nin tuval
            // sınırını aşar. JPEG, PNG'ye göre dosyayı ~%80 küçültür.
            const canvas = await html2canvas(page, {
                scale,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                // Belge kabı dışındaki site içeriği kopyalanmaz.
                ignoreElements: (element) => element.parentElement === document.body && element !== container,
            });
            doc.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');

            const origin = page.getBoundingClientRect();

            if (textFont) {
                try {
                    addInvisibleTextLayer(doc, page, origin, mmPerPx);
                } catch (error) {
                    console.warn('PDF metin katmanı yazılamadı:', error);
                }
            }

            page.querySelectorAll<HTMLElement>('img[data-pdf-qr]').forEach((element) => {
                const area = toPdfRect(element.getBoundingClientRect(), origin, mmPerPx);
                doc.addImage(qrDataUrl, 'PNG', area.x, area.y, area.w, area.h, 'quote-qr', 'FAST');
            });

            // Sayfa resim olduğu için bağlantılar ayrıca işaretlenir.
            page.querySelectorAll<HTMLElement>('[data-pdf-link]').forEach((element) => {
                const url = element.dataset.pdfLink;
                if (!url) return;
                const area = toPdfRect(element.getBoundingClientRect(), origin, mmPerPx);
                doc.link(area.x, area.y, area.w, area.h, { url });
            });
        }

        const filename = buildSafeFileName(data);
        restoreStreamCompression(doc);
        const blob = doc.output('blob') as Blob;
        const blobUrl = URL.createObjectURL(blob);
        restoreStreamCompression(doc);
        doc.save(filename);
        return { blobUrl, blob, filename };
    } catch (error) {
        console.error('Rich PDF render failed, falling back to basic PDF:', error);
        return generateFallbackQuotePDF(data);
    } finally {
        baselineProbeFix.remove();
        container.remove();
    }
}
