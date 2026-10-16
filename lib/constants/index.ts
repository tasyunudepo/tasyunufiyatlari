import type { KalinlikOption, UygulamaKategorisi } from '@/lib/types';

// ==========================================
// KALINLIK SEÇENEKLERİ
// ==========================================

export const KALINLIKLAR: KalinlikOption[] = [
    { value: "3", label: "3cm" },
    { value: "4", label: "4cm" },
    { value: "5", label: "5cm" },
    { value: "6", label: "6cm" },
    { value: "8", label: "8cm" },
    { value: "10", label: "10cm", popular: true },
];

// ==========================================
// UYGULAMA KATEGORİLERİ
// ==========================================

export const UYGULAMA_KATEGORILERI: UygulamaKategorisi[] = [
    {
        id: 'dis-cephe',
        name: 'Dış Cephe',
        icon: '🏢',
        description: 'Mantolama',
        levhalar: ['SW035', 'Premium', 'HD150', 'LD125', 'TR7.5', 'İdeal Carbon', 'Double Carbon', 'EPS Karbonlu', 'EPS Beyaz', 'EPS 035 Beyaz', 'Karbonlu']
    },
    {
        id: 'cati',
        name: 'Çatı',
        icon: '🏠',
        description: 'Teras & Çatı',
        levhalar: ['CS60', 'RF150', 'PW50']
    },
    {
        id: 'ara-bolme',
        name: 'Ara Bölme',
        icon: '🧱',
        description: 'Cephe Giydirme',
        levhalar: ['Yangın Bariyeri', 'VF80']
    }
];

// ==========================================
// SMART DEFAULTS
// ==========================================

export const SMART_DEFAULTS: {
    [key: string]: {
        material: "tasyunu" | "eps";
        thickness: string;
        brandHint?: string;
    }
} = {
    'dis-cephe': {
        material: "tasyunu",
        thickness: "5",
        brandHint: "Paroc"
    },
    'cati': {
        material: "tasyunu",
        thickness: "8",
        brandHint: "Rockwool"
    },
    'ara-bolme': {
        material: "eps",
        thickness: "3",
        brandHint: "Optimix"
    }
};

// ==========================================
// MARKA LOGOLARI
// ==========================================

export const MARKA_LOGOLARI: { [key: string]: string } = {
    'Dalmaçyalı': '/images/markalogolar/dalmaçyalı-taşyünü- fiyatları.webp',
    'Expert': '/images/markalogolar/fawori-taşyünü- fiyatları.webp',
    'Optimix': '/images/markalogolar/fawori-taşyünü- fiyatları.webp',
    'Fawori': '/images/markalogolar/fawori-taşyünü- fiyatları.webp',
    'Knauf': '/images/markalogolar/Knauf Mineral yünleri.webp',
    'Tekno': '/images/markalogolar/Tekno Taşyünü ve EPs Fiyatları.webp',
    'Filli Boya': '/images/markalogolar/filli-boya-mantolama.webp'
};
