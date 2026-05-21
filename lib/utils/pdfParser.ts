
export interface ParsedProduct {
  name: string;
  shortName: string;
  unit: string;
  unitContent: number;
  basePrice: number;
  categorySlug: string;
  isForEps: boolean;
  isForTasyunu: boolean;
  dowelLength?: number;
}

/**
 * Tekno PDF formatını parse eder
 * Format: "ÜRÜN ADI - 25 KG\nAçıklama\nFiyat: 8,80 TL/KG"
 */
export function parseTeknoProducts(pdfText: string): ParsedProduct[] {
  const products: ParsedProduct[] = [];
  const lines = pdfText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // "Fiyat:" kelimesini içeren satırı bul
    if (line.startsWith('Fiyat:')) {
      // Önceki satırları kontrol et (ürün adı için)
      let productName = '';
      let unitContent = 1;
      let unit = 'ADET';

      // 1-2 satır önce ürün adı olmalı
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const checkLine = lines[j];

        // Format 1: "TEKNOİZOFİX - 25 KG"
        const match1 = checkLine.match(/^([A-ZÇĞİÖŞÜ0-9\s\-()\.X]+?)\s*-\s*(\d+)\s*(KG|MM|ADET|GR|CM)$/i);
        if (match1) {
          productName = match1[1].trim();
          unitContent = parseInt(match1[2]);
          unit = match1[3].toUpperCase();
          break;
        }

        // Format 2: "FİLELİ PVC KÖŞE PROFİLİ" (birim yok)
        if (!productName && /^[A-ZÇĞİÖŞÜ0-9\s\-()\.X]+$/.test(checkLine) && checkLine.length > 5) {
          productName = checkLine;
        }
      }

      if (!productName) continue;

      // Fiyat bilgisini parse et
      const priceMatch = line.match(/Fiyat:\s*([\d,]+)\s*TL\/?(KG|ADET|M²|MT)?/i);
      if (!priceMatch) continue;

      const basePrice = parseFloat(priceMatch[1].replace(',', '.'));

      // Eğer fiyatta birim varsa onu kullan
      if (priceMatch[2]) {
        const priceUnit = priceMatch[2].toUpperCase();
        // GR'yi M² olarak kabul et
        if (priceUnit === 'M²' || unit === 'GR') {
          unit = 'M²';
        } else {
          unit = priceUnit;
        }
      }

      // CM'yi MM'ye çevir
      if (unit === 'CM') {
        unitContent = unitContent * 10;
        unit = 'MM';
      }

      // Kategoriyi ürün adından tahmin et
      const category = detectCategory(productName);

      // EPS/Taşyünü uyumluluğunu belirle
      const { isForEps, isForTasyunu } = detectMaterialType(productName);

      // Dübel boyunu yakala
      const dowelLength = detectDowelLength(productName);

      // Kısa ad oluştur
      const shortName = generateShortName(productName);

      products.push({
        name: productName,
        shortName,
        unit,
        unitContent,
        basePrice,
        categorySlug: category,
        isForEps,
        isForTasyunu,
        dowelLength
      });
    }
  }

  return products;
}

/**
 * Ürün adından kategoriyi tespit eder
 */
function detectCategory(productName: string): string {
  const name = productName.toUpperCase();

  // YAPISTIRICI
  if (name.includes('YAPIŞ') || name.includes('İZOFİX') || name.includes('FIX')) {
    return 'yapistirici';
  }

  // SIVA
  if (name.includes('SIVA') || name.includes('İZOSIVA')) {
    return 'siva';
  }

  // KAPLAMA (Dekoratif Sıva)
  if (name.includes('DEKO') || name.includes('DEKORATİF') || name.includes('İNCE') || name.includes('KALIN') || name.includes('ÇİZGİ')) {
    return 'kaplama';
  }

  // DÜBEL
  if (name.includes('DÜBEL') || name.includes('DUBEL')) {
    return 'dubel';
  }

  // FILE
  if (name.includes('FİLE') && !name.includes('KÖŞE')) {
    return 'file';
  }

  // FILELI KÖŞE
  if (name.includes('FİLE') && name.includes('KÖŞE')) {
    return 'fileli-kose';
  }

  // ASTAR
  if (name.includes('ASTAR')) {
    return 'astar';
  }

  // Varsayılan olarak sıva (en yaygın kategori)
  return 'siva';
}

/**
 * Ürünün EPS/Taşyünü uyumluluğunu belirler
 */
function detectMaterialType(productName: string): { isForEps: boolean; isForTasyunu: boolean } {
  const name = productName.toUpperCase();

  // Özel durumlar
  if (name.includes('EPS')) {
    return { isForEps: true, isForTasyunu: false };
  }

  if (name.includes('TAŞYÜNÜ')) {
    return { isForEps: false, isForTasyunu: true };
  }

  // Dübeller genelde her ikisi için de kullanılır
  if (name.includes('DÜBEL')) {
    return { isForEps: true, isForTasyunu: true };
  }

  // File ve file köşe her ikisi için
  if (name.includes('FİLE')) {
    return { isForEps: true, isForTasyunu: true };
  }

  // Yapıştırıcı ve sıvalar genelde her ikisi için
  if (name.includes('YAPIŞ') || name.includes('SIVA') || name.includes('DEKO')) {
    return { isForEps: true, isForTasyunu: true };
  }

  // Varsayılan: her ikisi için de uyumlu
  return { isForEps: true, isForTasyunu: true };
}

/**
 * Dübel boyunu tespit eder (mm cinsinden)
 */
function detectDowelLength(productName: string): number | undefined {
  const name = productName.toUpperCase();

  // "115 MM", "11.5 CM", "155MM" gibi formatları yakala
  const mmMatch = name.match(/(\d+)\s*MM/i);
  if (mmMatch) {
    return parseInt(mmMatch[1]);
  }

  const cmMatch = name.match(/(\d+\.?\d*)\s*CM/i);
  if (cmMatch) {
    return Math.round(parseFloat(cmMatch[1]) * 10);
  }

  return undefined;
}

/**
 * Kısa ürün adı oluşturur
 */
function generateShortName(productName: string): string {
  const name = productName.toUpperCase();

  // Yaygın kısaltmalar
  if (name.includes('TEKNOİZOFİX')) return 'Yapıştırıcı';
  if (name.includes('TEKNOİZOSIVA')) return 'Sıva';
  if (name.includes('TEKNODEKO İNCE')) return 'Deko İnce';
  if (name.includes('TEKNODEKO KALIN')) return 'Deko Kalın';
  if (name.includes('TEKNODEKO ÇİZGİ')) return 'Deko Çizgili';
  if (name.includes('FİLE') && name.includes('KÖŞE')) return 'Fileli Köşe';
  if (name.includes('FİLE')) return 'File';
  if (name.includes('ÇELİK') && name.includes('DÜBEL')) {
    const length = detectDowelLength(name);
    return length ? `Çelik Dübel ${length / 10}cm` : 'Çelik Dübel';
  }
  if (name.includes('PLASTİK') && name.includes('DÜBEL')) {
    const length = detectDowelLength(name);
    return length ? `Plastik Dübel ${length / 10}cm` : 'Plastik Dübel';
  }

  // Genel format: İlk 3 kelime
  const words = productName.split(/\s+/).slice(0, 3);
  return `${words.join(' ')}`;
}

/**
 * PDF buffer'ını parse eder
 */
export async function parsePDFBuffer(buffer: Buffer): Promise<ParsedProduct[]> {
  try {
    // pdf-parse CommonJS modülü olduğu için dynamic import kullanıyoruz
    type PdfParseFn = (buffer: Buffer) => Promise<{ text: string }>;
    const mod = await import('pdf-parse');
    const pdfParse = ((mod as { default?: PdfParseFn }).default ?? mod) as PdfParseFn;
    const data = await pdfParse(buffer);
    return parseTeknoProducts(data.text);
  } catch (error) {
    console.error('PDF parse hatası:', error);
    throw new Error('PDF dosyası okunamadı');
  }
}

/**
 * Manuel metin girişini parse eder (test için)
 */
export function parseManualText(text: string): ParsedProduct[] {
  return parseTeknoProducts(text);
}
