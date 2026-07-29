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
// Neden veriyi düzeltmiyoruz: `short_name` katalog sayfalarında, PDP
// başlıklarında ve arama sonuçlarında da kullanılıyor; oradaki adı
// değiştirmek SEO ve müşteri yüzeyini etkiler. Birleştirme kuralını tek
// yerde toplamak hem geçmiş kayıtları hem yenilerini düzeltiyor.

/** Türkçe duyarlı karşılaştırma için normalize et. */
function norm(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
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
