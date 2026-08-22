import { useQuery } from '@tanstack/react-query';

import type { CombinationMetrics } from '@/app/api/admin/combination-metrics/types';
import type { DashboardMetrics } from '@/app/api/admin/dashboard-metrics/types';

export const ADMIN_DASHBOARD_METRICS_KEY = ['admin', 'dashboard-metrics'] as const;

// Sekmeler koşullu render edildiği için her geçişte yeniden monte oluyor;
// ham `useEffect + fetch` her montajda yeni istek atıyordu (dashboard-metrics
// bir gezintide 3, combination-metrics 2 kez). Ortak önbellek bunu keser.

async function fetchJson<T>(url: string, key: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok) {
    throw new Error(payload?.error ?? `Veri alınamadı (HTTP ${res.status}).`);
  }
  return payload[key] as T;
}

export function useDashboardMetrics() {
  const query = useQuery({
    queryKey: ADMIN_DASHBOARD_METRICS_KEY,
    queryFn: () => fetchJson<DashboardMetrics>('/api/admin/dashboard-metrics', 'metrics'),
    staleTime: 60_000,
    retry: 1,
  });

  return {
    metrics: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useCombinationMetrics() {
  const query = useQuery({
    queryKey: ['admin', 'combination-metrics'],
    queryFn: () => fetchJson<CombinationMetrics>('/api/admin/combination-metrics', 'metrics'),
    staleTime: 60_000,
    retry: 1,
  });

  return {
    metrics: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
