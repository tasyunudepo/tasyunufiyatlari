import { useQuery } from '@tanstack/react-query';

import { canMutate, type AdminIdentity, type AdminRole } from './roles';

/**
 * Giriş yapan ofis kullanıcısının kimliği ve rolü.
 *
 * Tek kaynak: `GET /api/admin/me` (rolü proxy'nin x-auth-user başlığından
 * türetir). Bütün ofis sekmeleri bu hook'u kullanır; AdminTopbar da dahil —
 * react-query aynı anahtarı paylaştığı için istek bir kez atılır.
 *
 * Fail-closed: rol yüklenmediyse veya bilinmiyorsa `canMutate` false döner,
 * yani mutasyon kontrolleri gösterilmez.
 *
 * @example
 * const { role, canMutate } = useAdminRole();
 * {canMutate && <button onClick={sil}>Sil</button>}
 */
export function useAdminRole() {
  const query = useQuery<AdminIdentity>({
    queryKey: ['admin', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/admin/me', { cache: 'no-store' });
      if (!res.ok) throw new Error('Kimlik bilgisi alınamadı');
      const json = await res.json();
      return {
        user: typeof json.user === 'string' ? json.user : '',
        role: (json.role ?? null) as AdminRole | null,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const role = query.data?.role ?? null;

  return {
    user: query.data?.user ?? '',
    role,
    canMutate: canMutate(role),
    isReadOnly: role === 'patron',
    isLoading: query.isLoading,
  };
}
