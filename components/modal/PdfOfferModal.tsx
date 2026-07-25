'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, CaretDown } from '@phosphor-icons/react';
import { pdfOfferSchema, type PdfOfferFormData } from '@/lib/schemas/pdfOffer.schema';
import { ICON_WEIGHT } from '@/lib/design/tokens';

interface PdfOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PdfOfferFormData) => Promise<void>;
  isSubmitting?: boolean;
  defaultCompanyName?: string;
  defaultCity?: string;
}

export function PdfOfferModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  defaultCompanyName,
  defaultCity,
}: PdfOfferModalProps) {
  // Detay toggle — Akkaya tipi kararlı kullanıcı için opsiyonel alanları
  // gizli ama erişilebilir tutar; sürtünme azaltır.
  const [showDetails, setShowDetails] = useState(false);

  // Modal her açılışta detaylar kapalı başlar — effect yerine render
  // sırasında uyarlama (cascading render tetiklemez).
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setShowDetails(false);
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PdfOfferFormData>({
    resolver: zodResolver(pdfOfferSchema),
    defaultValues: {
      customerCompany: defaultCompanyName || '',
      relatedPerson: '',
      deliveryAddress: '',
      phone: '',
      email: '',
      city: defaultCity || '',
      district: '',
      kvkkConsent: false,
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    reset((prev) => ({
      ...prev,
      relatedPerson: '',
      deliveryAddress: '',
      phone: '',
      city: defaultCity || prev.city || '',
      district: '',
    }));
  }, [isOpen, reset, defaultCity]);

  // Body scroll lock — modal açıkken arka sayfa kaymaz
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // ESC ile kapat
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-fe-bg/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Teklif Bilgileri"
    >
      <div
        className="bg-fe-bg border border-fe-border w-full sm:max-w-lg shadow-2xl relative flex flex-col rounded-t-2xl sm:rounded-2xl max-h-[100dvh] sm:max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER — sticky top */}
        <div className="shrink-0 px-6 pt-6 pb-4 border-b border-fe-border/60 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 inline-flex items-center justify-center w-9 h-9 rounded-lg text-fe-muted hover:text-white hover:bg-fe-surface/60 transition-colors"
            disabled={isSubmitting}
            aria-label="Kapat"
            type="button"
          >
            <X weight={ICON_WEIGHT} size={20} />
          </button>
          <h3 className="text-xl font-bold text-white mb-1">PDF Teklif Kaydı</h3>
          <p className="text-sm text-fe-muted">
            Teklif belgenizi oluşturalım. Satış ekibimiz aynı kayıt üzerinden stok, ödeme ve sevkiyat koşullarını teyit eder.
          </p>
          {defaultCity && (
            <p className="mt-2 text-xs text-brand-200">
              Fiyat ili: {defaultCity}
            </p>
          )}
        </div>

        {/* FORM (flex-1 col, body scroll içinde) */}
        <form
          onSubmit={handleSubmit(async (data) => {
            await onSubmit(data);
          })}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* SCROLL BODY */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* ── Zorunlu alanlar: İlgili kişi + Telefon. İl wizard seçiminden gelir. ── */}
            {defaultCity && <input type="hidden" {...register('city')} />}
            <div>
              <label className="block text-sm font-medium text-fe-text mb-1">
                Ad Soyad / Firma <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                {...register('relatedPerson')}
                className="w-full px-4 py-3 bg-fe-surface border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none"
                disabled={isSubmitting}
              />
              {errors.relatedPerson && (
                <p className="text-red-400 text-xs mt-1">{errors.relatedPerson.message}</p>
              )}
            </div>

            <div className={defaultCity ? '' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
              <div>
                <label className="block text-sm font-medium text-fe-text mb-1">
                  Telefon <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  {...register('phone')}
                  className="w-full px-4 py-3 bg-fe-surface border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none"
                  disabled={isSubmitting}
                />
                {errors.phone && (
                  <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>
                )}
              </div>

              {!defaultCity && (
                <div>
                  <label className="block text-sm font-medium text-fe-text mb-1">
                    İl <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('city')}
                    className="w-full px-4 py-3 bg-fe-surface border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none"
                    disabled={isSubmitting}
                  />
                  {errors.city && (
                    <p className="text-red-400 text-xs mt-1">{errors.city.message}</p>
                  )}
                </div>
              )}
            </div>

            {/* ── Opsiyonel detay toggle ── */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowDetails(v => !v)}
                disabled={isSubmitting}
                aria-expanded={showDetails}
                aria-controls="pdf-modal-details"
                className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-fe-border bg-fe-surface/40 hover:bg-fe-surface text-sm text-fe-text transition-colors"
              >
                <span className="text-left">
                  <span className="block font-medium text-white">
                    Daha fazla detay eklemek ister misiniz?
                  </span>
                  <span className="block text-xs text-fe-muted mt-0.5">
                    Firma / e-posta / adres bilgilerini ekleyin
                  </span>
                </span>
                <CaretDown
                  weight={ICON_WEIGHT}
                  size={18}
                  className={`text-fe-muted transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}
                />
              </button>

              {showDetails && (
                <div id="pdf-modal-details" className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-fe-text mb-1">
                      Firma Adı <span className="text-fe-muted text-xs">(opsiyonel)</span>
                    </label>
                    <input
                      type="text"
                      {...register('customerCompany')}
                      className="w-full px-4 py-3 bg-fe-surface border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none"
                      disabled={isSubmitting}
                    />
                    {errors.customerCompany && (
                      <p className="text-red-400 text-xs mt-1">{errors.customerCompany.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-fe-text mb-1">
                        İlçe <span className="text-fe-muted text-xs">(opsiyonel)</span>
                      </label>
                      <input
                        type="text"
                        {...register('district')}
                        className="w-full px-4 py-3 bg-fe-surface border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none"
                        disabled={isSubmitting}
                      />
                      {errors.district && (
                        <p className="text-red-400 text-xs mt-1">{errors.district.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fe-text mb-1">
                        E-posta <span className="text-fe-muted text-xs">(opsiyonel)</span>
                      </label>
                      <input
                        type="email"
                        autoComplete="email"
                        {...register('email')}
                        className="w-full px-4 py-3 bg-fe-surface border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none"
                        disabled={isSubmitting}
                      />
                      {errors.email && (
                        <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fe-text mb-1">
                      Açık Adres <span className="text-fe-muted text-xs">(opsiyonel)</span>
                    </label>
                    <textarea
                      rows={2}
                      {...register('deliveryAddress')}
                      className="w-full px-4 py-3 bg-fe-surface border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                      disabled={isSubmitting}
                    />
                    {errors.deliveryAddress && (
                      <p className="text-red-400 text-xs mt-1">{errors.deliveryAddress.message}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                id="kvkkConsent"
                {...register('kvkkConsent')}
                disabled={isSubmitting}
                className="mt-0.5 w-4 h-4 rounded accent-brand-500 cursor-pointer"
              />
              <label htmlFor="kvkkConsent" className="text-xs text-fe-muted cursor-pointer leading-relaxed">
                Kişisel verilerimin teklif oluşturma amacıyla işlenmesini kabul ediyorum.{' '}
                <a href="/kvkk" target="_blank" rel="noopener noreferrer" className="text-brand-400 underline hover:text-brand-300">
                  Aydınlatma Metni
                </a>
              </label>
            </div>
            {errors.kvkkConsent && (
              <p className="text-red-400 text-xs">{errors.kvkkConsent.message}</p>
            )}
          </div>

          {/* FOOTER — sticky bottom */}
          <div className="shrink-0 px-6 py-4 border-t border-fe-border/60 bg-fe-bg rounded-b-2xl">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl font-bold text-base text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors min-h-[48px]"
            >
              {isSubmitting ? 'Hazırlanıyor...' : 'PDF Teklif Kaydı Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
