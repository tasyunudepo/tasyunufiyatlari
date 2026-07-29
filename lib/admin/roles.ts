// Ofis paneli rol sözlüğü — tek kaynak.
//
// 'patron' salt-okunur hesaptır: bütün ofis ekranlarını görür ama hiçbir
// mutasyon yapamaz (lib/security/adminMutationAuth.ts:requireAdminMutationAuth
// bu hesaba 403 döner). Arayüz bu rolde değiştirme kontrollerini hiç
// göstermemelidir — aksi hâlde kullanıcı tıklar, sunucu 403 döner ve
// ekranda hiçbir açıklama olmaz (audit B1, 26 Temmuz 2026).

export type AdminRole = 'admin' | 'patron';

export interface AdminIdentity {
  user: string;
  role: AdminRole | null;
}

/** Rol henüz yüklenmemişse (null) mutasyon kontrolü gösterilmez — fail-closed. */
export function canMutate(role: AdminRole | null): boolean {
  return role === 'admin';
}

export const READ_ONLY_HINT =
  'Bu hesap salt okunurdur — veri değiştirme yetkisi yok.';
