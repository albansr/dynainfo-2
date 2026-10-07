import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '../client';
import { usesFacturadoOnly, type SalesMetricPreset } from '@/core/utils/salesMetric';
import type { FilterMap } from '@/core/api/downloadExcel';
import type { ReachValues } from '@/core/components/analytics/ReachMetricsBlock';
import { useMergedFilters } from './useMergedFilters';
import { buildBalanceParams } from './useBalance';

/**
 * Query string for the reach block and its "sin compra" detail/export: same
 * period, closed-period flag and (role-merged) filters as the balance.
 */
export function useBalanceReachParams(
  startDate: Date,
  endDate: Date,
  preset: SalesMetricPreset,
  filters?: FilterMap
): URLSearchParams {
  const mergedFilters = useMergedFilters(filters);
  return buildBalanceParams(
    { startDate: format(startDate, 'yyyy-MM-dd'), endDate: format(endDate, 'yyyy-MM-dd') },
    usesFacturadoOnly(preset),
    mergedFilters
  );
}

/** Items, Numérica and Clientes sin compra for an analysis board. */
export function useBalanceReach(params: URLSearchParams) {
  const query = params.toString();
  return useQuery({
    queryKey: ['balance-reach', query],
    queryFn: async () => (await apiClient<{ data: ReachValues }>(`/api/balance/reach?${query}`)).data,
  });
}
