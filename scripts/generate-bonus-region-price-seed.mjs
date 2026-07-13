#!/usr/bin/env node
// v19b seed dosyasını tek kaynaktan üretir:
//   lib/pricing/bonus/bonus-region-prices.json
//     → scripts/migration-v19b-seed-bonus-region-prices.sql
// Elle SQL yazımı yasak: fiyat hücreleri yalnız doğrulanmış JSON'dan gelir.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(
  readFileSync(resolve(root, 'lib/pricing/bonus/bonus-region-prices.json'), 'utf8'),
)

// Kuruş hassasiyeti: float sapmasını önlemek için tamsayı kuruş üzerinden
// hesaplanır (224,75 × 0,90 = 202,275 → 202,28; SQL round() ile birebir).
const discountedKurus = (listPrice, discountPct) => {
  const listCents = Math.round(listPrice * 100)
  return Math.round((listCents * (100 - discountPct)) / 100) / 100
}
const sqlNum = (v) => Number(v).toFixed(2)

const sourceDoc = data.source.document
const sourceDate = data.source.documentDate
const discount = data.discountPct / 100

let totalRows = 0
const valueLines = []

for (const product of data.products) {
  for (const row of product.rows) {
    row.listPricesByRegion.forEach((listPrice, idx) => {
      const region = idx + 1
      const basePrice = discountedKurus(listPrice, data.discountPct)
      totalRows += 1
      valueLines.push(
        `  ('${product.brandName}', '${product.shortName}', ${region}, ${row.thicknessMm}, ` +
          `${sqlNum(listPrice)}, ${sqlNum(basePrice)}, ${row.packagePieces}, ${row.packageM2}, ` +
          `${row.truckPackages}, ${row.truckM2}, ${row.trailerPackages}, ${row.trailerM2})`,
      )
    })
  }
}

const zoneLines = Object.entries(data.regionsByCityCode)
  .filter(([, region]) => region !== null)
  .map(([code, region]) => `  (${code}, ${region})`)

const sql = `-- ============================================================
-- Migration v19b — Bonus bölge fiyat seed'i (ÜRETİLMİŞ DOSYA)
-- Kaynak: lib/pricing/bonus/bonus-region-prices.json
-- Üretici: node scripts/generate-bonus-region-price-seed.mjs
-- ELLE DÜZENLEMEYİN — değişiklik JSON'da yapılır, dosya yeniden üretilir.
--
-- Belge: ${sourceDoc} (${sourceDate}); taban = liste × ${(1 - discount).toFixed(2)}
-- ============================================================

BEGIN;

-- ─── Şehir → Bonus bölgesi (İstanbul 34 ve Kocaeli 41 bilinçli NULL) ──

UPDATE public.shipping_zones sz
SET bonus_region = m.region
FROM (VALUES
${zoneLines.join(',\n')}
) AS m(city_code, region)
WHERE sz.city_code = m.city_code;

UPDATE public.shipping_zones SET bonus_region = NULL WHERE city_code IN (34, 41);

DO $zone_assert$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM public.shipping_zones
  WHERE bonus_region IS NULL AND city_code NOT IN (34, 41);
  IF n <> 0 THEN
    RAISE EXCEPTION 'v19b: % şehir bonus_region eşlemesi olmadan kaldı', n;
  END IF;
END;
$zone_assert$;

-- ─── Bölge fiyatları (${totalRows} hücre) ──────────────────────────

WITH seed (brand_name, short_name, region, thickness_mm, list_price, base_price,
           package_pieces, package_m2, truck_packages, truck_m2,
           trailer_packages, trailer_m2) AS (
  VALUES
${valueLines.join(',\n')}
)
INSERT INTO public.plate_region_prices
  (plate_id, region, thickness_mm, list_price, base_price,
   package_pieces, package_m2, truck_packages, truck_m2,
   trailer_packages, trailer_m2, source_doc, source_date)
SELECT
  p.id, s.region, s.thickness_mm, s.list_price, s.base_price,
  s.package_pieces, s.package_m2, s.truck_packages, s.truck_m2,
  s.trailer_packages, s.trailer_m2,
  '${sourceDoc}', DATE '${sourceDate}'
FROM seed s
JOIN public.brands b ON b.name = s.brand_name
JOIN public.plates p ON p.brand_id = b.id AND p.short_name = s.short_name
ON CONFLICT (plate_id, region, thickness_mm) DO UPDATE SET
  list_price       = EXCLUDED.list_price,
  base_price       = EXCLUDED.base_price,
  package_pieces   = EXCLUDED.package_pieces,
  package_m2       = EXCLUDED.package_m2,
  truck_packages   = EXCLUDED.truck_packages,
  truck_m2         = EXCLUDED.truck_m2,
  trailer_packages = EXCLUDED.trailer_packages,
  trailer_m2       = EXCLUDED.trailer_m2,
  source_doc       = EXCLUDED.source_doc,
  source_date      = EXCLUDED.source_date,
  updated_at       = now();

DO $price_assert$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n
  FROM public.plate_region_prices prp
  JOIN public.plates p ON p.id = prp.plate_id
  JOIN public.brands b ON b.id = p.brand_id
  WHERE b.name = 'Bonus';
  IF n <> ${totalRows} THEN
    RAISE EXCEPTION 'v19b: ${totalRows} fiyat hücresi bekleniyordu, % bulundu. plates/brands eşleşmesini kontrol edin.', n;
  END IF;
END;
$price_assert$;

COMMIT;
`

const outPath = resolve(root, 'scripts/migration-v19b-seed-bonus-region-prices.sql')
writeFileSync(outPath, sql)
console.log(`Üretildi: ${outPath} (${totalRows} fiyat hücresi, ${zoneLines.length} şehir eşlemesi)`)
