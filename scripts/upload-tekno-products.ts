import { parseManualText } from '../lib/utils/pdfParser';

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

async function uploadTeknoProducts() {
  console.log('🚀 Tekno Ürünleri Yükleme İşlemi Başlıyor...\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Parse products
    console.log('📄 PDF metni parse ediliyor...');
    const products = parseManualText(teknoProductList);
    console.log(`✅ ${products.length} ürün başarıyla parse edildi!\n`);

    // 2. Show products to be uploaded
    console.log('📦 Yüklenecek Ürünler:\n');
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   └─ Kategori: ${product.categorySlug} | ${product.unitContent} ${product.unit} | ${product.basePrice} TL/${product.unit}`);
    });
    console.log('');

    // 3. Call API endpoint
    console.log('🌐 API endpoint\'e gönderiliyor...');
    const response = await fetch('http://localhost:3000/api/products/bulk-insert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_name: 'TEKNO',
        products,
        discounts: {
          isk1: 40, // %40
          isk2: 8,  // %8
          kar: 10,  // %10
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Hata:', result.error);
      if (result.details) {
        console.error('   Detay:', result.details);
      }
      return;
    }

    // 4. Success
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ BAŞARILI!');
    console.log(`📊 ${result.inserted_count} ürün veritabanına eklendi\n`);

    // 5. Show inserted products with calculated prices
    interface InsertedProduct {
      id: number | string;
      name: string;
      base_price: number;
      unit_content: number;
      unit: string;
      discount_1: number;
      discount_2: number;
    }
    if (result.products && result.products.length > 0) {
      console.log('💰 Eklenen Ürünler ve Fiyatlar:\n');
      result.products.forEach((product: InsertedProduct, index: number) => {
        const pricePerUnit = product.base_price / product.unit_content;
        console.log(`${index + 1}. ${product.name}`);
        console.log(`   Birim: ${product.unit_content} ${product.unit}/paket`);
        console.log(`   Birim Fiyatı: ${pricePerUnit.toFixed(2)} TL/${product.unit}`);
        console.log(`   Paket Fiyatı: ${product.base_price.toFixed(2)} TL`);
        console.log(`   İndirimler: %${product.discount_1} + %${product.discount_2}`);
        console.log(`   ID: ${product.id}`);
        console.log('');
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Beklenmeyen hata:', message);
    console.error(error);
  }
}

uploadTeknoProducts();
