'use client'

import { notifyContactUnlocked } from '@/lib/analytics/leadQualification'

interface PdfDeliveryCardProps {
  refCode: string
  pdfUrl: string
  pdfFilename: string
  whatsappUrl: string
  emailUrl: string
  onClose: () => void
}

export function PdfDeliveryCard({
  refCode,
  pdfUrl,
  pdfFilename,
  whatsappUrl,
  emailUrl,
  onClose,
}: PdfDeliveryCardProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-fe-bg/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="PDF teklifiniz hazır"
    >
      <div className="w-full max-w-lg rounded-2xl border border-green-700/40 bg-fe-bg p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <span className="text-xl leading-none" aria-hidden="true">
            ✓
          </span>
          <div>
            <h3 className="text-lg font-bold text-white">PDF teklifiniz hazır</h3>
            <p className="mt-1 text-sm text-fe-muted">Referans: {refCode}</p>
          </div>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-fe-text">
          Talebiniz kaydedildi. Teklifinizi indirin veya hazır mesajla iletişime geçin.
        </p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => notifyContactUnlocked({ source: 'pdf_delivery' })}
            className="rounded-lg bg-green-700 px-3 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-green-600"
          >
            WhatsApp’ta aç
          </a>
          <a
            href={emailUrl}
            className="rounded-lg bg-brand-600 px-3 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-500"
          >
            E-postada aç
          </a>
          <a
            href={pdfUrl}
            download={pdfFilename}
            className="rounded-lg bg-fe-raised px-3 py-3 text-center text-sm font-semibold text-fe-text transition-colors hover:bg-fe-surface"
          >
            PDF indir
          </a>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-fe-muted">
          WhatsApp ve e-posta düğmeleri uygulamanızı hazır metinle açar; gönderim sizin onayınızla tamamlanır.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg border border-fe-border px-3 py-2.5 text-sm font-semibold text-fe-text transition-colors hover:bg-fe-raised"
        >
          Kapat
        </button>
      </div>
    </div>
  )
}
