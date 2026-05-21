// Marka adı normalizasyonu (Türkçe karakter encoding sorunları için)
// "Dalma?yali" gibi bozuk kayıtları "Dalmaçyalı" ile aynı grupta toplar.
export function normBrandKey(name: string): string {
    return (name || "")
        .toLowerCase()
        .replace(/[çc]/g, "c")
        .replace(/[ğg]/g, "g")
        .replace(/[ıiİI]/g, "i")
        .replace(/[öo]/g, "o")
        .replace(/[şs]/g, "s")
        .replace(/[üu]/g, "u")
        .replace(/[^a-z0-9]/g, "");
}

// Aynı normalize key'e sahip isimler arasından en "doğru" olanı seç
export function canonicalBrandName(names: string[]): string {
    const withTr = names.filter((n) => /[çğışöüÇĞİŞÖÜ]/.test(n));
    return withTr[0] ?? names.sort((a, b) => b.length - a.length)[0] ?? names[0];
}

// Tüm quote listesinden normalize edilmiş marka sıralaması üret
export function buildBrandRanking(
    quotes: Array<{ brand_name?: string | null }>,
    limit = 4,
): [string, number][] {
    const map: Record<string, { count: number; names: string[] }> = {};
    for (const q of quotes) {
        const raw = q.brand_name || "Belirsiz";
        const key = normBrandKey(raw) || "belirsiz";
        if (!map[key]) map[key] = { count: 0, names: [] };
        map[key].count++;
        if (!map[key].names.includes(raw)) map[key].names.push(raw);
    }
    return Object.values(map)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map((v) => [canonicalBrandName(v.names), v.count]);
}

export const roundToKurus = (value: number): number => Math.round(value * 100) / 100;

export const formatCurrency = (val: number) => {
    if (!val || isNaN(val)) return "-";
    return val.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
};

export const formatAmount = (val: number) => {
    if (!val || isNaN(val)) return "—";
    if (val >= 1_000_000) return (val / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + "M ₺";
    if (val >= 1_000) return (val / 1_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + "K ₺";
    return val.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺";
};

export const formatM2 = (val: number) => {
    if (!val || isNaN(val)) return "—";
    return val.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " m²";
};
