// Ürün adı birleştirme — tek kaynak.
//
// SORUN (27 Temmuz 2026, canlı veriyle doğrulandı):
// Levha kalem adı `${marka} ${short_name}` diye kuruluyordu. Çoğu üründe
// doğru çalışıyor ("Optimix" + "TR7.5" → "Optimix TR7.5"), ama bazı
// ürünlerin `short_name` değeri markayı ZATEN içeriyor:
//
//   marka="Optimix", short_name="Optimix Karbonlu"
//     → "Optimix Optimix Karbonlu 5 cm EPS"   ← müşteriye giden PDF'te böyle
//
// Aynı tekrar /ofis Analiz sekmesinde ve teklif kalemlerinde de görünüyordu.
//
// 16 Ekim 2026: kaynak veri de düzeltildi. Ürün 42'nin kaydı diğer
// levhalarla aynı düzene alındı: short_name="Karbonlu",
// name="Optimix Karbonlu", slug="optimix-karbonlu-eps" (eski adres 301,
// next.config.ts). Bu dosyadaki birleştirme kuralları yine de kalır: bir
// kayıt ileride markayı short_name'e yazarsa ad tekrar çiftlenmez.

/** Türkçe duyarlı karşılaştırma için normalize et. */
function norm(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

/**
 * Art arda iki kez yazılmış kelimeyi teke indirir. Eski kayıtlardan gelen
 * ya da gözden kaçan bir birleştirmenin ürettiği tekrarı müşteriye
 * gitmeden siler. Yalnız en az üç harfli kelimelere dokunur; sayılar ve
 * ölçüler ("5 5") olduğu gibi kalır.
 *
 * @example
 * collapseRepeatedWords('Optimix Optimix Karbonlu 5 cm EPS') // 'Optimix Karbonlu 5 cm EPS'
 * collapseRepeatedWords('TEKNO TEKNO GRENLİ BOYA')           // 'TEKNO GRENLİ BOYA'
 */
export function collapseRepeatedWords<T extends string | null | undefined>(text: T): T {
  if (!text) return text;
  return text.replace(/(^|[\s(])(\p{L}{3,})(?:\s+\2)+(?=[\s),.;:]|$)/giu, '$1$2') as T;
}

/**
 * Marka ile model adını, markayı tekrar etmeden birleştirir.
 *
 * @example
 * joinBrandAndModel('Optimix', 'Optimix Karbonlu') // 'Optimix Karbonlu'
 * joinBrandAndModel('Optimix', 'TR7.5')            // 'Optimix TR7.5'
 * joinBrandAndModel('Bonus', 'F 150 Pro')          // 'Bonus F 150 Pro'
 */
export function joinBrandAndModel(
  brandName: string | null | undefined,
  modelName: string | null | undefined,
): string {
  const brand = (brandName ?? '').trim();
  const model = (modelName ?? '').trim();

  if (!brand) return model;
  if (!model) return brand;

  const b = norm(brand);
  const m = norm(model);

  // Model markayla başlıyorsa markayı bir kez daha yazma.
  if (m === b || m.startsWith(`${b} `)) return model;

  return `${brand} ${model}`;
}

/**
 * Analiz RPC'si `plate_brand` alanını bazı satırlarda zaten "marka + model"
 * olarak döndürüyor, bazı satırlarda yalnız marka olarak. Model'i koşulsuz
 * eklemek "Bonus F 150 Pro F 150 Pro" üretiyordu.
 *
 * @example
 * composePlateLabel('Optimix Optimix Karbonlu', 'Optimix Karbonlu') // 'Optimix Karbonlu'
 * composePlateLabel('Bonus F 150 Pro', 'F 150 Pro')                 // 'Bonus F 150 Pro'
 * composePlateLabel('Bonus', 'Gold Plus 70')                        // 'Bonus Gold Plus 70'
 */
export function composePlateLabel(
  plateBrand: string | null | undefined,
  model: string | null | undefined,
): string {
  const composed = (plateBrand ?? '').trim();
  const modelName = (model ?? '').trim();

  if (!modelName || modelName === '—') return composed;
  if (!composed) return modelName;

  const c = norm(composed);
  const m = norm(modelName);

  // plate_brand modeli zaten içeriyorsa marka kısmını ayırıp yeniden birleştir;
  // böylece "Optimix Optimix Karbonlu" da sadeleşir.
  if (c === m) return modelName;
  if (c.endsWith(` ${m}`)) {
    const brandPart = composed.slice(0, composed.length - modelName.length).trim();
    return joinBrandAndModel(brandPart, modelName);
  }

  return joinBrandAndModel(composed, modelName);
}

/**
 * PDF ve teklif kalemlerindeki tam levha adı.
 *
 * @example
 * buildPlateItemName('Optimix', 'Optimix Karbonlu', '5', 'EPS')
 * // 'Optimix Karbonlu 5 cm EPS'
 */
export function buildPlateItemName(
  brandName: string | null | undefined,
  shortName: string | null | undefined,
  thicknessCm: string | number,
  materialSuffix: string,
): string {
  const base = joinBrandAndModel(brandName, shortName);
  return `${base} ${thicknessCm} cm ${materialSuffix}`.replace(/\s+/g, ' ').trim();
}
