'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardText, X } from '@phosphor-icons/react';
import { quoteSchema, type QuoteFormData } from '@/lib/schemas/quote.schema';
import { ICON_WEIGHT } from '@/lib/design/tokens';
import type { CalculatedPackage } from '@/lib/types';

interface QuoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedPackage: CalculatedPackage;
    metraj: number;
    selectedMalzeme: string;
    selectedKalinlik: string;
    selectedCityName: string;
    onSubmit: (formData: QuoteFormData) => Promise<void>;
}

export function QuoteModal({
    isOpen,
    onClose,
    selectedPackage,
    metraj,
    selectedMalzeme,
    selectedKalinlik,
    selectedCityName,
    onSubmit
}: QuoteModalProps) {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset
    } = useForm<QuoteFormData>({
        resolver: zodResolver(quoteSchema),
        defaultValues: {
            customerName: '',
            customerEmail: '',
            customerPhone: '',
            customerCompany: '',
            customerAddress: '',
            kvkkConsent: false,
        }
    });

    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, isSubmitting, onClose]);

    const onSubmitForm = async (data: QuoteFormData) => {
        try {
            await onSubmit(data);
            reset();
            onClose();
        } catch (error) {
            console.error('Teklif gönderme hatası:', error);
        }
    };

    if (!isOpen || !selectedPackage) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-fe-bg/80 backdrop-blur-sm"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Teklif Talebi"
        >
            <div
                className="bg-fe-bg border border-fe-border w-full sm:max-w-lg shadow-2xl flex flex-col rounded-t-2xl sm:rounded-2xl max-h-[100dvh] sm:max-h-[90dvh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* HEADER */}
                <div className="shrink-0 px-6 pt-6 pb-4 border-b border-fe-border/60 relative">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 inline-flex items-center justify-center w-9 h-9 rounded-lg text-fe-muted hover:text-white hover:bg-fe-surface/60 transition-colors"
                        disabled={isSubmitting}
                        aria-label="Kapat"
                    >
                        <X weight={ICON_WEIGHT} size={20} />
                    </button>
                    <h3 className="text-xl font-bold text-white mb-1">Teklif Talebi</h3>
                    <p className="text-sm text-fe-muted">
                        {selectedPackage.definition.name} • {metraj} m²
                    </p>
                </div>

                {/* FORM */}
                <form
                    id="quote-form"
                    onSubmit={handleSubmit(onSubmitForm)}
                    className="flex flex-col flex-1 min-h-0"
                >
                    {/* SCROLL BODY */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                        {/* Sipariş Özeti */}
                        <div className="rounded-xl border border-fe-border/60 bg-fe-surface/60 p-4">
                            <h4 className="font-semibold text-fe-text mb-3 flex items-center gap-2 text-sm">
                                <ClipboardText weight={ICON_WEIGHT} size={16} className="text-brand" /> Sipariş Özeti
                            </h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-fe-muted text-xs">Paket</span>
                                    <div className="font-medium text-fe-text">{selectedPackage.definition.name}</div>
                                </div>
                                <div>
                                    <span className="text-fe-muted text-xs">Malzeme</span>
                                    <div className="font-medium text-fe-text">
                                        {selectedMalzeme === "tasyunu" ? "Taşyünü" : "EPS"} {selectedKalinlik}cm
                                    </div>
                                </div>
                                <div>
                                    <span className="text-fe-muted text-xs">Metraj</span>
                                    <div className="font-medium text-fe-text">{metraj} m²</div>
                                </div>
                                <div>
                                    <span className="text-fe-muted text-xs">Toplam Fiyat</span>
                                    <div className="font-bold text-brand">
                                        {selectedPackage.grandTotal.toLocaleString("tr-TR")} ₺
                                    </div>
                                </div>
                                <div>
                                    <span className="text-fe-muted text-xs">Şehir</span>
                                    <div className="font-medium text-fe-text">{selectedCityName}</div>
                                </div>
                                <div>
                                    <span className="text-fe-muted text-xs">Paket Sayısı</span>
                                    <div className="font-medium text-fe-text">
                                        {selectedPackage.logistics?.packageCount || 0} paket
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-fe-text mb-1">
                                Ad Soyad <span className="text-red-400">*</span>
                            </label>
                            <input
                                {...register('customerName')}
                                type="text"
                                placeholder="Örn: Ahmet Yılmaz"
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 bg-fe-surface border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                            {errors.customerName && (
                                <p className="text-red-400 text-xs mt-1">{errors.customerName.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-fe-text mb-1">
                                Telefon <span className="text-red-400">*</span>
                            </label>
                            <input
                                {...register('customerPhone')}
                                type="tel"
                                placeholder="05321234567"
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 bg-fe-surface border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                            {errors.customerPhone && (
                                <p className="text-red-400 text-xs mt-1">{errors.customerPhone.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-fe-text mb-1">
                                E-posta <span className="text-fe-muted text-xs">(opsiyonel)</span>
                            </label>
                            <input
                                {...register('customerEmail')}
                                type="email"
                                placeholder="mail@firma.com"
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 bg-fe-surface border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                            {errors.customerEmail && (
                                <p className="text-red-400 text-xs mt-1">{errors.customerEmail.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-fe-text mb-1">
                                Firma Adı <span className="text-fe-muted text-xs">(opsiyonel)</span>
                            </label>
                            <input
                                {...register('customerCompany')}
                                type="text"
                                placeholder="Örn: ABC İnşaat Ltd. Şti."
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 bg-fe-surface border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-fe-text mb-1">
                                Teslimat Adresi <span className="text-fe-muted text-xs">(opsiyonel)</span>
                            </label>
                            <textarea
                                {...register('customerAddress')}
                                rows={2}
                                placeholder="Tam adresinizi giriniz..."
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 bg-fe-surface border border-fe-border rounded-xl text-white focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                            />
                        </div>

                        <div className="flex items-start gap-2.5 pt-1">
                            <input
                                type="checkbox"
                                id="quoteKvkkConsent"
                                {...register('kvkkConsent')}
                                disabled={isSubmitting}
                                className="mt-0.5 w-4 h-4 rounded accent-brand-500 cursor-pointer"
                            />
                            <label htmlFor="quoteKvkkConsent" className="text-xs text-fe-muted cursor-pointer leading-relaxed">
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

                    {/* FOOTER */}
                    <div className="shrink-0 px-6 py-4 border-t border-fe-border/60 bg-fe-bg rounded-b-2xl flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 border border-fe-border text-fe-muted rounded-xl font-medium hover:text-fe-text hover:bg-fe-surface/40 transition-colors min-h-[48px]"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 rounded-xl font-bold text-base text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors min-h-[48px]"
                        >
                            {isSubmitting ? "Gönderiliyor..." : "Teklif Gönder"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
