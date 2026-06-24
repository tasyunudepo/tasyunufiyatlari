'use client';

import { motion } from 'framer-motion';
import type { CalculatedPackage } from '@/lib/types';

interface PackageCardProps {
    pkg: CalculatedPackage;
    index: number;
    isPopular?: boolean;
    expandedCards: number[];
    onToggleExpand: (id: number) => void;
    onWhatsAppOrder: (pkg: CalculatedPackage) => void;
    onDownloadPDF: (pkg: CalculatedPackage) => void;
    getOfferValidityDate: () => string;
    getTruckMeterColor: (percentage: number) => string;
    getSmartAdvice: (logistics: CalculatedPackage['logistics']) => string | null;
}

export function PackageCard({
    pkg,
    index,
    isPopular = false,
    expandedCards,
    onToggleExpand,
    onWhatsAppOrder,
    onDownloadPDF,
    getTruckMeterColor,
    getSmartAdvice
}: PackageCardProps) {
    const isExpanded = expandedCards.includes(pkg.definition.id);
    const visibleItems = isExpanded ? pkg.items : pkg.items.slice(0, 5);
    const hiddenCount = pkg.items.length - 5;
    const totalWithVat = pkg.grandTotal * 1.2;
    const m2PriceWithVat = pkg.pricePerM2 * 1.2;
    const m2PriceLabel = pkg.logistics?.isShippingIncluded
        ? 'KDV ve nakliye dahil m² maliyeti'
        : 'KDV dahil m² maliyeti';

    return (
        <motion.div
            key={pkg.definition.id}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.5,
                delay: index * 0.2,
                ease: 'easeOut'
            }}
            whileHover={{ scale: 1.03 }}
            className={`relative rounded-2xl border-2 p-6 transition-all hover:shadow-xl backdrop-blur-md ${isPopular
                ? 'border-brand-600 bg-fe-bg/90 md:scale-105 shadow-lg shadow-brand-600/20'
                : 'border-fe-border bg-fe-bg/80'
                }`}
        >
            {/* Badge */}
            {pkg.definition.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {pkg.definition.badge}
                </div>
            )}

            {/* Paket Başlığı */}
            <h4 className="font-heading text-lg font-bold text-white mb-1 mt-2 tracking-tight">
                {pkg.definition.name}
            </h4>
            <p className="text-sm text-fe-muted mb-1">{pkg.definition.description}</p>
            {(() => {
                const sentences = [
                    'Marka bütünlüğü isteyen projeler için.',
                    'Fiyat/performans dengesi arayan projeler için.',
                    'En düşük toplam maliyeti hedefleyen projeler için.',
                ];
                const s = sentences[index];
                return s ? <p className="text-xs text-fe-muted italic mb-1">{s}</p> : null;
            })()}
            <p className="text-xs text-brand-500 mb-4 font-medium">
                Levha: {pkg.plateBrandName} • Toz Grubu: {pkg.accessoryBrandName}
            </p>

            {/* Teklif referans bilgisi */}
            <div className="mb-3 flex items-center gap-2 text-xs bg-brand-900/30 border border-brand-700/50 rounded-lg px-3 py-2">
                <span className="text-brand-500">📄</span>
                <span className="text-fe-text">
                    Teklif referans kodu ve güncel hesap bilgileri PDF kaydında yer alır
                </span>
            </div>

            {/* Büyük Metraj — Özel Teklif Rozeti (≥10.000 m² Taşyünü) */}
            {pkg.requiresSpecialOrder && (
                <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-900/15 p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                            Büyük Metraj
                        </span>
                        <span className="text-xs font-bold text-amber-200">Özel Teklif</span>
                    </div>
                    {pkg.specialOrderNote && (
                        <p className="text-[11px] leading-relaxed text-amber-100/80">
                            {pkg.specialOrderNote}
                        </p>
                    )}
                </div>
            )}

            {/* Fiyat */}
            <div className="mb-4">
                <div className="text-xs font-bold text-brand-500 mb-0.5">{m2PriceLabel}</div>
                <div className="font-heading text-4xl font-bold text-white tabular-nums">
                    {m2PriceWithVat.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺/m²
                </div>
                <div className="mt-1 text-sm text-fe-text">
                    Toplam:{' '}
                    <span className="font-heading font-bold tabular-nums text-white">
                        {totalWithVat.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                    </span>
                    <span className="text-fe-muted"> · KDV dahil</span>
                </div>
                <div className="mt-0.5 text-xs text-fe-muted">
                    KDV hariç m²: <span className="font-heading tabular-nums">{pkg.pricePerM2.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺/m²</span>
                    {!pkg.logistics?.isShippingIncluded && ' · Nakliye alıcıya ait'}
                </div>

                {/* Nakliye Uyarısı */}
                {pkg.logistics?.shippingWarning && (
                    <div className="mt-2 p-2 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                        <div className="flex items-start gap-2">
                            <span className="text-blue-400 text-sm">ℹ️</span>
                            <div className="text-xs text-blue-300 leading-relaxed font-medium">
                                {pkg.logistics.shippingWarning}
                            </div>
                        </div>
                    </div>
                )}

                {/* LOSS AVERSION: Düşük Metraj Farkı */}
                {pkg.logistics?.lowMetrageSurcharge && pkg.logistics.lowMetrageSurcharge > 0 && (
                    <div className="mt-2 p-2 bg-red-900/30 border border-red-700/50 rounded-lg">
                        <div className="flex items-start gap-2">
                            <span className="text-red-500 text-sm">⚠️</span>
                            <div>
                                <div className="text-sm font-semibold text-red-400 font-heading tabular-nums">
                                    Düşük Metraj Nakliye Farkı: +
                                    {pkg.logistics.lowMetrageSurcharge.toLocaleString('tr-TR', {
                                        maximumFractionDigits: 0
                                    })}{' '}
                                    ₺
                                </div>
                                <div className="text-xs text-red-300 mt-1">
                                    Araç tam dolmadığı için eklenen nakliye farkıdır.
                                    {pkg.logistics.packagesNeededForOptimal &&
                                        pkg.logistics.packagesNeededForOptimal > 0 && (
                                            <>
                                                {' '}
                                                Metrajı{' '}
                                                <strong>
                                                    {(
                                                        pkg.logistics.packagesNeededForOptimal *
                                                        pkg.logistics.packageSizeM2
                                                    ).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                                                    m²
                                                </strong>{' '}
                                                artırırsanız bu ücret{' '}
                                                <strong className="text-green-400">0 TL</strong> olacaktır.
                                            </>
                                        )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="text-xs text-fe-muted mt-2">
                    KDV hariç toplam:{' '}
                    <span className="font-heading tabular-nums">{pkg.grandTotal.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                </div>
            </div>

            {/* Garanti */}
            <div className="flex items-center gap-2 mb-4 text-sm text-fe-text">
                <span className="text-green-500">✓</span>
                <span>
                    {pkg.plateBrandName?.includes('Dalmaçyalı') && pkg.accessoryBrandName?.includes('Dalmaçyalı')
                        ? '10 yıl Dalmaçyalı sistem garanti koşulları geçerlidir'
                        : 'Üretici ürün garanti koşulları geçerlidir'}
                </span>
            </div>

            {/* GAMIFIED TRUCK METER */}
            {pkg.logistics && (
                <div className="mb-4 p-4 bg-fe-surface/50 rounded-xl border border-fe-border shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-white font-heading">Nakliye &amp; Doluluk</span>
                        <span className="text-xs text-fe-muted font-heading tabular-nums">
                            {pkg.logistics.packageCount} paket × {pkg.logistics.packageSizeM2} m²
                        </span>
                    </div>

                    {/* Araç Durumu */}
                    <div className="text-xs font-medium mb-3 font-heading tabular-nums">
                        {pkg.logistics.vehicleType === 'lorry' && (
                            <span className="text-fe-text">
                                🚚 Kamyon ({pkg.logistics.lorryFillPercentage.toFixed(0)}% Doluluk)
                            </span>
                        )}
                        {pkg.logistics.vehicleType === 'truck' && (
                            <span className="text-fe-text">
                                🚛 Tır ({pkg.logistics.truckFillPercentage.toFixed(0)}% Doluluk)
                            </span>
                        )}
                        {pkg.logistics.vehicleType === 'multiple' && (
                            <span className="text-brand-500 font-medium">
                                🚛🚛 Birden fazla araç gerekli
                            </span>
                        )}
                    </div>

                    {/* GAMIFIED PROGRESS BAR */}
                    {pkg.logistics.vehicleType !== 'multiple' && (() => {
                        const activeFill =
                            pkg.logistics.vehicleType === 'lorry'
                                ? pkg.logistics.lorryFillPercentage
                                : pkg.logistics.truckFillPercentage;
                        const barColor = getTruckMeterColor(activeFill);

                        return (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-fe-text">
                                    <span className="font-medium">
                                        {pkg.logistics.vehicleType === 'lorry' ? 'Kamyon' : 'Tır'}{' '}
                                        Kapasitesi
                                    </span>
                                    <span className="font-semibold font-heading tabular-nums">
                                        {(
                                            pkg.logistics.packageCount * pkg.logistics.packageSizeM2
                                        ).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                                        /{' '}
                                        {(
                                            (pkg.logistics.vehicleType === 'lorry'
                                                ? pkg.logistics.lorryCapacityPackages
                                                : pkg.logistics.truckCapacityPackages) *
                                            pkg.logistics.packageSizeM2
                                        ).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                                        m²
                                    </span>
                                </div>

                                {/* Animated Progress Bar */}
                                <div className="w-full bg-fe-surface rounded-full h-3 overflow-hidden shadow-inner">
                                    <motion.div
                                        className={`h-full rounded-full ${barColor} shadow-md`}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(activeFill, 100)}%` }}
                                        transition={{
                                            duration: 1.2,
                                            ease: 'easeOut',
                                            delay: index * 0.3
                                        }}
                                    />
                                </div>

                                {/* Efficiency Label */}
                                <div className="text-center text-xs font-semibold">
                                    {activeFill >= 86 && (
                                        <span className="text-green-500">✅ Tam Kapasite</span>
                                    )}
                                    {activeFill >= 41 && activeFill < 86 && (
                                        <span className="text-brand-500">⚡ Standart Sevkiyat</span>
                                    )}
                                    {activeFill < 41 && (
                                        <span className="text-red-500">⚠️ Verimsiz Sevkiyat</span>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* SMART ADVICE */}
                    {(() => {
                        const advice = getSmartAdvice(pkg.logistics);
                        if (!advice) return null;

                        return (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                transition={{ duration: 0.5, delay: index * 0.3 + 0.8 }}
                                className="mt-3 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg"
                            >
                                <div className="text-xs text-blue-300 leading-relaxed">{advice}</div>
                            </motion.div>
                        );
                    })()}

                    {/* Paket Detayı */}
                    <div className="text-xs text-fe-muted mt-3 pt-2 border-t border-fe-border">
                        Her pakette {pkg.logistics.itemsPerPackage} adet levha (600×1000mm)
                    </div>
                </div>
            )}

            {/* Ürün Listesi */}
            <div className="border-t border-fe-border pt-4 mb-4">
                <p className="text-xs font-semibold text-fe-muted mb-2">PAKET İÇERİĞİ:</p>
                <div className="space-y-1.5 text-sm">
                    {visibleItems.map((item, i) => (
                        <div key={i} className="flex justify-between text-fe-text">
                            <span className="truncate pr-2" title={item.name}>
                                {item.brandName} {item.shortName}
                            </span>
                            <span className="text-fe-muted whitespace-nowrap">
                                {item.quantity % 1 === 0
                                    ? item.quantity
                                    : item.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} {item.unit}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Genişlet/Daralt Butonu */}
                {hiddenCount > 0 && (
                    <button
                        onClick={() => onToggleExpand(pkg.definition.id)}
                        className="mt-2 text-brand-500 hover:text-brand-400 text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                        {isExpanded ? (
                            <>
                                <span>Daralt</span>
                                <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 15l7-7 7 7"
                                    />
                                </svg>
                            </>
                        ) : (
                            <>
                                <span>+{hiddenCount} ürün daha göster</span>
                                <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                    />
                                </svg>
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* CTA BUTTONS */}
            <div className="mt-6 space-y-3">
                {/* Primary: WhatsApp Sipariş */}
                <button
                    onClick={() => onWhatsAppOrder(pkg)}
                    className={`w-full py-3.5 rounded-xl font-bold text-base transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg ${isPopular
                        ? 'bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white hover:from-[#20BA5A] hover:to-[#0E7A6B]'
                        : 'bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white hover:from-[#20BA5A] hover:to-[#0E7A6B]'
                        }`}
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    <span>WhatsApp&apos;tan Teyit İste</span>
                </button>

                {/* Secondary: PDF Teklif İndir */}
                <button
                    onClick={() => onDownloadPDF(pkg)}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all border-2 border-fe-border bg-fe-surface text-fe-text hover:bg-fe-surface hover:border-fe-muted flex items-center justify-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                    <span>PDF Teklif Kaydı Oluştur</span>
                </button>
            </div>
        </motion.div>
    );
}
