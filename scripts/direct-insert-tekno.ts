import { parseManualText } from '../lib/utils/pdfParser';
import { supabase } from '../lib/supabase';

// Tekno ürün listesi (PDF'den kopyalanmış)
const teknoProductList = `
TEKNOİZOFİX - 25 KG
Isı yalıtım levha yapıştırıcı
Fiyat: 8,80 TL/KG

TEKNOİZOSIVA - 25 KG
Isı yalıtım levha üstü sıvası
Fiyat: 9,70 TL/KG

TEKNODEKO İNCE (1,2 MM) - 25 KG
İnce tane dokulu dekoratif sıva
Fiyat: 12,20 TL/KG

TEKNODEKO KALIN (2 MM) - 25 KG
Kalın tane dokulu dekoratif sıva
Fiyat: 12,20 TL/KG

FİLE 4X4 - 160 GR
Mantolama filesi
Fiyat: 32,00 TL/M²

FİLELİ PVC KÖŞE PROFİLİ
Mantolama köşe profili
Fiyat: 16,60 TL/MT

ÇELİK ÇİVİLİ DÜBEL 115 MM
Mekanik tırnaklı mantolama dübeli
Fiyat: 4,50 TL/ADET

ÇELİK ÇİVİLİ DÜBEL 155 MM
Mekanik tırnaklı mantolama dübeli
Fiyat: 5,20 TL/ADET

PLASTİK ÇİVİLİ DÜBEL 10 CM
Mantolama dübeli
Fiyat: 2,10 TL/ADET

PLASTİK ÇİVİLİ DÜBEL 12 CM
Mantolama dübeli
Fiyat: 2,40 TL/ADET
`;

async function directInsertTekno() {
  console.log('🚀 Tekno Ürünleri Yükleme İşlemi (Direct Insert)...\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Parse products
    console.log('📄 PDF metni parse ediliyor...');
    const products = parseManualText(teknoProductList);
    console.log(`✅ ${products.length} ürün başarıyla parse edildi!\n`);

    // 2. Get TEKNO brand_id
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id')
      .eq('name', 'TEKNO')
      .single();

    if (brandError || !brand) {
      console.error('❌ TEKNO markası bulunamadı');
      return;
    }

    const brand_id = brand.id;
    console.log(`✅ TEKNO brand_id: ${brand_id}\n`);

    // 3. Get accessory_type_id mapping
    const { data: accessoryTypes, error: typesError } = await supabase
      .from('accessory_types')
      .select('id, slug');

    if (typesError || !accessoryTypes) {
      console.error('❌ Kategori bilgileri alınamadı');
      return;
    }

    const typeMap = new Map<string, number>();
    accessoryTypes.forEach((type) => {
      typeMap.set(type.slug, type.id);
    });

    // 4. Generate SQL INSERT statements
    console.log('📝 SQL INSERT statements oluşturuluyor...\n');
    console.log('-- Tekno Ürünleri SQL Insert Statements');
    console.log('-- Aşağıdaki SQL\'i Supabase SQL Editor\'de çalıştırın:\n');

    const isk1 = 40; // %40
    const isk2 = 8;  // %8
    const kar = 10;  // %10

    products.forEach((product, index) => {
      const accessory_type_id = typeMap.get(product.categorySlug);

      if (!accessory_type_id) {
        console.error(`⚠️ Kategori bulunamadı: ${product.categorySlug}`);
        return;
      }

      // Price calculation
      const priceWithoutVat = product.basePrice / 1.20;
      const afterIsk1 = priceWithoutVat * (1 - isk1 / 100);
      const afterIsk2 = afterIsk1 * (1 - isk2 / 100);
      const withKar = afterIsk2 * (1 + kar / 100);
      const finalPricePerUnit = withKar * 1.20;
      const packagePrice = finalPricePerUnit * product.unitContent;

      console.log(`-- ${index + 1}. ${product.name}`);
      console.log(`INSERT INTO accessories (`);
      console.log(`  brand_id, accessory_type_id, name, short_name, unit, unit_content,`);
      console.log(`  base_price, is_for_eps, is_for_tasyunu, discount_1, discount_2,`);
      console.log(`  is_kdv_included, is_active${product.dowelLength ? ', dowel_length' : ''}`);
      console.log(`) VALUES (`);
      console.log(`  ${brand_id}, ${accessory_type_id}, '${product.name.replace(/'/g, "''")}', '${product.shortName.replace(/'/g, "''")}', '${product.unit}', ${product.unitContent},`);
      console.log(`  ${packagePrice.toFixed(2)}, ${product.isForEps}, ${product.isForTasyunu}, ${isk1}, ${isk2},`);
      console.log(`  true, true${product.dowelLength ? `, ${product.dowelLength}` : ''}`);
      console.log(`);`);
      console.log('');
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SQL statements oluşturuldu!');
    console.log('📋 Yukarıdaki SQL\'i kopyalayıp Supabase SQL Editor\'de çalıştırın.');
    console.log('   https://supabase.com/dashboard/project/latlzskzemmdnotzpscc/sql/new');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 5. Show pricing calculation example
    console.log('💰 FİYAT HESAPLAMA ÖRNEĞİ (İLK ÜRÜN):\n');
    const firstProduct = products[0];
    const priceWithoutVat = firstProduct.basePrice / 1.20;
    const afterIsk1 = priceWithoutVat * (1 - isk1 / 100);
    const afterIsk2 = afterIsk1 * (1 - isk2 / 100);
    const withKar = afterIsk2 * (1 + kar / 100);
    const finalPricePerUnit = withKar * 1.20;
    const packagePrice = finalPricePerUnit * firstProduct.unitContent;

    console.log(`Ürün: ${firstProduct.name}`);
    console.log(`Liste Fiyatı (KDV Dahil): ${firstProduct.basePrice.toFixed(2)} TL/${firstProduct.unit}`);
    console.log(`KDV Hariç: ${priceWithoutVat.toFixed(2)} TL`);
    console.log(`İSK1 (%${isk1}): ${afterIsk1.toFixed(2)} TL`);
    console.log(`İSK2 (%${isk2}): ${afterIsk2.toFixed(2)} TL`);
    console.log(`Kar (%${kar}): ${withKar.toFixed(2)} TL`);
    console.log(`\n✅ Satış Fiyatı (Birim): ${finalPricePerUnit.toFixed(2)} TL/${firstProduct.unit}`);
    console.log(`✅ Paket Fiyatı (${firstProduct.unitContent} ${firstProduct.unit}): ${packagePrice.toFixed(2)} TL\n`);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Beklenmeyen hata:', message);
    console.error(error);
  }
}

directInsertTekno();
