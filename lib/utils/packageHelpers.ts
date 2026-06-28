import type { CalculatedPackage } from '@/lib/types';

/**
 * Teklif kayıt tarihi (eski API adı korunuyor).
 */
export const getOfferValidityDate = (): string => {
    const date = new Date();
    return date.toLocaleString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/**
 * Gamification: Doluluk oranına göre renk
 */
export const getTruckMeterColor = (fillPercentage: number): string => {
    if (fillPercentage >= 86) return 'bg-green-500'; // Mükemmel
    if (fillPercentage >= 41) return 'bg-yellow-500'; // Standart
    return 'bg-red-500'; // Verimsiz
};

/**
 * Smart Advice: Lojistik önerisi
 */
export const getSmartAdvice = (logistics: CalculatedPackage['logistics']): string | null => {
    if (!logistics || logistics.vehicleType === 'multiple') return null;

    const activeFill =
        logistics.vehicleType === 'lorry'
            ? logistics.lorryFillPercentage
            : logistics.truckFillPercentage;

    if (activeFill >= 86) {
        return '🎉 Mükemmel! Araç tam kapasitede kullanılıyor - En uygun nakliye maliyeti.';
    }

    if (logistics.packagesNeededForOptimal && logistics.packagesNeededForOptimal > 0) {
        const additionalM2 = (
            logistics.packagesNeededForOptimal * logistics.packageSizeM2
        ).toFixed(1);
        return `💡 Sadece ${logistics.packagesNeededForOptimal} paket daha (${additionalM2} m²) eklerseniz araç tam dolacak ve nakliye farkı sıfırlanacak!`;
    }

    return null;
};

/**
 * WhatsApp mesajı artık merkezi `lib/utils/whatsapp.ts` modülünde.
 * generateQuoteWhatsAppMessage + buildWhatsAppLink fonksiyonlarına geçildi.
 */
