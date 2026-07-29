import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import type { AdminRole } from '@/lib/admin/roles';

// Kimliği proxy.ts doğrular ve x-auth-user başlığını enjekte eder; burada
// yalnızca o kimlik role çevrilir. Rol, arayüzün patron hesabına
// değiştiremeyeceği kontrolleri göstermemesi için gerekli (audit B1/B3).
// Bu bir yetki kapısı DEĞİLDİR — asıl kapı her mutasyonda
// requireAdminMutationAuth'tur; burası yalnızca arayüz sinyali.
export async function GET() {
  const h = await headers();
  const user = h.get('x-auth-user') ?? '';

  const adminUser = process.env.ADMIN_USER?.trim() || 'admin';
  let role: AdminRole | null = null;
  if (user === 'patron') role = 'patron';
  else if (user && user === adminUser) role = 'admin';

  return NextResponse.json(
    { user, role },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
