import * as XLSX from 'xlsx';
import { Plate, PlatePrice, Accessory } from './types';

export interface ExcelPriceRow {
    brandName: string;
    productName: string;
    thickness?: number;
    basePrice: number;
    packageM2?: number;
    isKdvIncluded: boolean;
    type: 'plate' | 'accessory';
}

/**
 * Excel dosyasındaki satırları normalize eder
 */
export const parseExcelPriceFile = async (file: File): Promise<ExcelPriceRow[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const results: ExcelPriceRow[] = [];

                // Tüm sayfaları tara (Örn: "Kalem Bazında" ve "Optimix" farklı sayfalarda olabilir)
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    type Cell = string | number | boolean | null | undefined;
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as Cell[][];

                    const sheetStr = sheetName.toLowerCase();
                    // "Kalem Bazında" veya "Optimix" sayfaları KDV DAHİL gelir
                    const isKdvIncludedSheet = sheetStr.includes('kalem') || sheetStr.includes('bazında') || sheetStr.includes('optimix');

                    rows.forEach((row, _idx) => {
                        if (!row || row.length === 0) return;

                        const rowStr = row.join(' ').toLowerCase();
                        if (rowStr.length < 5) return;

                        const numericCells = row.map(c => {
                            const n = parseFloat(String(c));
                            return isNaN(n) ? null : n;
                        }).filter((n): n is number => n !== null && n > 5);

                        if (numericCells.length === 0) return;

                        let brand = '';
                        let product = '';
                        let isEps = false;
                        let isAccessory = false;

                        // Marka tespiti (Dalmçyalı yazım hatasını da kapsar)
                        if (rowStr.includes('dalm') || rowStr.includes('dalmaçyalı')) brand = 'Dalmaçyalı';
                        else if (rowStr.includes('expert')) brand = 'Expert';
                        else if (rowStr.includes('optimix') || sheetStr.includes('optimix')) brand = 'Optimix';
                        else if (rowStr.includes('fawori')) brand = 'Optimix';

                        if (rowStr.includes('karbonlu')) product = 'Karbonlu';
                        else if (rowStr.includes('ideal')) product = 'İdeal Carbon';
                        else if (rowStr.includes('beyaz')) product = 'Beyaz';
                        else if (rowStr.includes('taşyünü') || rowStr.includes('tasyunu') || rowStr.includes('p-te')) brand = brand || 'Expert';

                        if (rowStr.includes('eps')) isEps = true;

                        // Aksesuar tespiti: Toz grubu/Aksesuar anahtar kelimeleri
                        if (rowStr.includes('yapıştırıcı') || rowStr.includes('harç') || rowStr.includes('sıva') ||
                            rowStr.includes('dübel') || rowStr.includes('file') || rowStr.includes('astar') ||
                            rowStr.includes('kaplama') || rowStr.includes('mineral') || rowStr.includes('veile') ||
                            rowStr.includes('toz')) {
                            isAccessory = true;
                        }

                        // Kalınlık tespiti
                        const thicknessMatch = rowStr.match(/(\d+)\s*(cm|mm)/i);
                        let thickness = thicknessMatch ? parseInt(thicknessMatch[1]) : undefined;
                        if (thickness && thickness >= 20) thickness = thickness / 10;

                        if (brand && numericCells.length > 0) {
                            // KDV Kuralı: 
                            // 1. "Kalem Bazında" veya "Optimix" sheet ise KDV DAHİL
                            // 2. EPS ürünü ise KDV DAHİL
                            // 3. Aksesuar (toz grubu) "Kalem Bazında" sheet'inde ise KDV DAHİL
                            const rowIsKdvIncluded = isKdvIncludedSheet || isEps;

                            // Liste fiyatı genelde ilk büyük sayısal kolondur.
                            const basePrice = numericCells[0];

                            results.push({
                                brandName: brand,
                                productName: product || (row[0] ? row[0].toString() : brand),
                                thickness,
                                basePrice,
                                isKdvIncluded: rowIsKdvIncluded,
                                type: isAccessory ? 'accessory' : 'plate'
                            });
                        }
                    });
                });

                resolve(results);
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = (err) => reject(err);
        reader.readAsBinaryString(file);
    });
};

/**
 * Eşleştirme ve Güncelleme Hazırlığı
 */
export const mapExcelToDatabase = (
    excelData: ExcelPriceRow[],
    existingPlates: Plate[],
    existingPlatePrices: PlatePrice[],
    existingAccessories: Accessory[]
) => {
    const updates: {
        type: 'plate_price' | 'accessory';
        id: number;
        data: { base_price: number; is_kdv_included: boolean };
    }[] = [];

    excelData.forEach(row => {
        if (row.type === 'plate') {
            const plate = existingPlates.find(p =>
                p.name.toLowerCase().includes(row.productName.toLowerCase()) ||
                p.short_name.toLowerCase().includes(row.productName.toLowerCase())
            );

            if (plate && (row.thickness || plate.thickness_options?.length === 0)) {
                const priceRecord = existingPlatePrices.find(pp =>
                    pp.plate_id === plate.id && (!row.thickness || pp.thickness === row.thickness)
                );

                if (priceRecord) {
                    updates.push({
                        type: 'plate_price',
                        id: priceRecord.id,
                        data: {
                            base_price: row.basePrice,
                            is_kdv_included: row.isKdvIncluded
                        }
                    });
                }
            }
        } else {
            const accessory = existingAccessories.find(a =>
                a.name.toLowerCase().includes(row.productName.toLowerCase()) ||
                a.short_name.toLowerCase().includes(row.productName.toLowerCase())
            );

            if (accessory) {
                updates.push({
                    type: 'accessory',
                    id: accessory.id,
                    data: {
                        base_price: row.basePrice,
                        is_kdv_included: row.isKdvIncluded
                    }
                });
            }
        }
    });

    return updates;
};
