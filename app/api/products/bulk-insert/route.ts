import { NextResponse } from 'next/server';
import { requireAdminMutationAuth } from '@/lib/security/adminMutationAuth';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { ParsedProduct } from '@/lib/utils/pdfParser';

export async function POST(req: Request) {
  const auth = requireAdminMutationAuth(req);
  if (!auth.ok) return auth.response;

  const supabase = createServerSupabaseClient();
  try {
    const { brand_name, products, discounts } = await req.json();

    if (!brand_name || !products || !Array.isArray(products)) {
      return NextResponse.json(
        { error: 'brand_name ve products gerekli' },
        { status: 400 }
      );
    }

    // 1. Get brand_id
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id')
      .eq('name', brand_name)
      .single();

    if (brandError || !brand) {
      return NextResponse.json(
        { error: `Marka bulunamadı: ${brand_name}` },
        { status: 404 }
      );
    }

    const brand_id = brand.id;

    // 2. Get accessory_type_id mapping (slug -> id)
    const { data: accessoryTypes, error: typesError } = await supabase
      .from('accessory_types')
      .select('id, slug');

    if (typesError || !accessoryTypes) {
      return NextResponse.json(
        { error: 'Kategori bilgileri alınamadı' },
        { status: 500 }
      );
    }

    const typeMap = new Map<string, number>();
    accessoryTypes.forEach((type) => {
      typeMap.set(type.slug, type.id);
    });

    // 3. Prepare products for insertion
    const insertData = products.map((product: ParsedProduct) => {
      const accessory_type_id = typeMap.get(product.categorySlug);

      if (!accessory_type_id) {
        throw new Error(`Kategori bulunamadı: ${product.categorySlug} (${product.name})`);
      }

      // Get discount rates (default: İSK1=40%, İSK2=8%, Kar=10%)
      const isk1 = discounts?.isk1 ?? 40;
      const isk2 = discounts?.isk2 ?? 8;
      const kar = discounts?.kar ?? 10;

      // Price calculation
      // basePrice from PDF is assumed to be per-unit price (KDV dahil)
      const priceWithoutVat = product.basePrice / 1.20;

      // Apply discounts and profit margin
      const afterIsk1 = priceWithoutVat * (1 - isk1 / 100);
      const afterIsk2 = afterIsk1 * (1 - isk2 / 100);
      const withKar = afterIsk2 * (1 + kar / 100);
      const finalPricePerUnit = withKar * 1.20;

      // Calculate package price (final price for the entire package)
      const packagePrice = finalPricePerUnit * product.unitContent;

      return {
        brand_id,
        accessory_type_id,
        name: product.name,
        short_name: product.shortName,
        unit: product.unit,
        unit_content: product.unitContent,
        base_price: packagePrice, // Total package price (KDV dahil)
        is_for_eps: product.isForEps,
        is_for_tasyunu: product.isForTasyunu,
        dowel_length: product.dowelLength || null,
        discount_1: isk1,
        discount_2: isk2,
        is_kdv_included: true,
        is_active: true,
      };
    });

    // 4. Insert into database
    const { data: insertedProducts, error: insertError } = await supabase
      .from('accessories')
      .insert(insertData)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: 'Ürünler eklenemedi', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      inserted_count: insertedProducts?.length || 0,
      products: insertedProducts,
    });
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('Bulk insert error:', error);
    return NextResponse.json(
      { error: 'Bir hata oluştu', details },
      { status: 500 }
    );
  }
}
