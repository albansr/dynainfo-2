import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiClient } from '../client';
import { usesFacturadoOnly, type SalesMetricPreset } from '@/core/utils/salesMetric';
import { useMergedFilters } from './useMergedFilters';
import { appendFilterParams, type FilterMap } from '@/core/api/downloadExcel';
import type { BalanceSheetResponse, BalanceQueryParams } from '../types';

/** Balance query string: period, closed-period flag and filters (shared by /balance and /balance/reach). */
export function buildBalanceParams(
  params: BalanceQueryParams,
  facturadoOnly: boolean,
  filters?: FilterMap,
  includeUnits = false
): URLSearchParams {
  const q = new URLSearchParams();
  if (params.startDate) q.append('startDate', params.startDate);
  if (params.endDate) q.append('endDate', params.endDate);
  // Closed periods exclude comprometido from budget-relative metrics
  if (facturadoOnly) q.append('facturadoOnly', 'true');
  // Opt-in units/cost aggregate (product listings' totals row)
  if (includeUnits) q.append('includeUnits', 'true');
  appendFilterParams(q, filters);
  return q;
}

async function fetchBalance(
  params: BalanceQueryParams,
  facturadoOnly: boolean,
  filters: FilterMap | undefined,
  includeUnits: boolean
): Promise<BalanceSheetResponse> {
  const qs = buildBalanceParams(params, facturadoOnly, filters, includeUnits).toString();
  return apiClient<BalanceSheetResponse>(`/api/balance${qs ? `?${qs}` : ''}`);
}

export function useBalance(
  startDate: Date,
  endDate: Date,
  preset: SalesMetricPreset,
  filters?: FilterMap,
  { includeUnits = false }: { includeUnits?: boolean } = {}
) {
  const params: BalanceQueryParams = {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
  };
  const facturadoOnly = usesFacturadoOnly(preset);

  // Channel/scope roles get their data filtered automatically
  const mergedFilters = useMergedFilters(filters);

  return useQuery({
    queryKey: ['balance', params.startDate, params.endDate, facturadoOnly, includeUnits, mergedFilters],
    queryFn: () => fetchBalance(params, facturadoOnly, mergedFilters, includeUnits),
  });
}
