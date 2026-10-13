import type { CalculatedPackage } from '@/lib/types';
import { formatValidUntil, offerValidUntil } from '@/lib/quote/validity';

/**
 * Site teklifinin geçerli olduğu son gün ("09.10.2026").
 * 13 Ekim 2026'ya kadar bu fonksiyon teklifin üretildiği anı döndürüyordu.
 */
export const getOfferValidityDate = (now: Date = new Date()): string =>
    formatValidUntil(offerValidUntil(now));

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
