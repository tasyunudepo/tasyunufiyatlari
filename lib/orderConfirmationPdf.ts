import jsPDF from 'jspdf';
import {
    buildOrderConfirmationHtml,
    buildOrderConfirmationModel,
    orderConfirmationFileName,
    type OrderConfirmationInput,
} from '@/lib/pdf/orderConfirmation';

// Sipariş Onay Formu'nu tarayıcıda tek sayfalık PDF olarak üretir.
// Teklif PDF'iyle aynı yöntem: HTML kabı → html2canvas → jsPDF.

export async function generateOrderConfirmationPDF(input: OrderConfirmationInput): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const html2canvas = (await import('html2canvas')).default;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '794px'; // A4 genişliği
    container.style.background = '#fff';
    container.style.color = '#0f172a';
    container.style.padding = '40px';
    container.style.boxSizing = 'border-box';
    container.style.fontFamily = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    container.style.lineHeight = '1.4';
    container.style.fontVariantNumeric = 'tabular-nums';
    container.innerHTML = buildOrderConfirmationHtml(
        buildOrderConfirmationModel(input),
        `/images/teklifpdf/logo_dark.png?v=${Date.now()}`,
    );

    document.body.appendChild(container);

    try {
        await Promise.all(
            Array.from(container.querySelectorAll('img')).map((img) =>
                img.complete && img.naturalHeight !== 0
                    ? Promise.resolve()
                    : new Promise<void>((resolve) => {
                          img.onload = () => resolve();
                          img.onerror = () => resolve();
                      }),
            ),
        );

        const canvas = await html2canvas(container, {
            scale: 1.5,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
        });

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Tek sayfa: içerik taşarsa A4'e sığacak kadar küçültülür.
        let width = pageWidth;
        let height = (canvas.height * width) / canvas.width;
        if (height > pageHeight) {
            width = (width * pageHeight) / height;
            height = pageHeight;
        }

        doc.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, width, height, undefined, 'FAST');
        doc.save(orderConfirmationFileName(input.quoteCode));
    } finally {
        container.remove();
    }
}
